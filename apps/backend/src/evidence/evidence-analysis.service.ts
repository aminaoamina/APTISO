import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../common/services/project-access.service';
import { AiJobsService, isActive } from '../ai/jobs.service';
import { KnowledgeService } from '../ai/knowledge.service';
import { SOA_KEY } from '../audit-prep/keys';
import { FileStorage } from './file-storage';

/** File types the AI service can read, and the largest file it is sent. */
const READABLE = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
const MAX_ANALYSED_BYTES = 15 * 1024 * 1024;

interface Suggestion { ref: string; title: string; reason: string; confidence: 'likely' | 'possible' }
interface Result {
  text: string; pages: number; ocr_pages: number;
  summary: string | null; document_type: string | null; suggested: Suggestion[];
  expiry: { date: string; quote: string } | null; run_id: string | null; note?: string;
}

/**
 * The AI reads evidence files after upload (background job of the AI service).
 * It only proposes: a summary, controls or clauses the file may prove, and its
 * expiry date. A person applies them with the normal evidence actions.
 */
@Injectable()
export class EvidenceAnalysisService {
  private readonly logger = new Logger(EvidenceAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly storage: FileStorage,
    private readonly jobs: AiJobsService,
    private readonly knowledge: KnowledgeService,
  ) {}

  /** Hook after an upload: never blocks or fails the upload. */
  analyzeInBackground(fileId: string, userId: string) {
    this.analyze(fileId, userId).catch(e => this.logger.warn(`Evidence analysis of ${fileId} not started: ${(e as Error).message}`));
  }

  async analyze(fileId: string, userId: string) {
    const file = await this.prisma.evidenceFile.findUnique({
      where: { id: fileId },
      include: { evidence: { select: { id: true, project_id: true, title: true, description: true } }, analysis: true },
    });
    if (!file || !READABLE.has(file.mime_type)) return;
    const projectId = file.evidence.project_id;
    if (file.size_bytes > MAX_ANALYSED_BYTES) {
      await this.save(fileId, projectId, { status: 'FAILED', error: 'The file is larger than 15 MB: it is not analysed.' });
      return;
    }
    const attempts = (file.analysis?.attempts ?? 0) + 1;
    const data = (await this.storage.read(file.storage_key)).toString('base64');
    const job = await this.jobs.submit<Result>(
      'evidence',
      `evidence:${projectId}:${file.sha256}${attempts > 1 ? `:retry-${attempts - 1}` : ''}`,
      projectId,
      userId,
      {
        evidence: { id: file.evidence.id, title: file.evidence.title, description: file.evidence.description },
        file: { name: file.file_name, mime: file.mime_type, sha256: file.sha256, data },
      },
    );
    await this.save(fileId, projectId, { job_id: job.job_id, status: job.status, attempts, error: null, completed_at: null });
  }

  /** The analysis of the evidence's current file, with each proposal mapped to what a click would do. */
  async view(projectId: string, userId: string, evidenceId: string) {
    await this.access.forProject(projectId, userId);
    const evidence = await this.prisma.evidence.findFirst({
      where: { id: evidenceId, project_id: projectId },
      select: { title: true, valid_until: true, links: { select: { target_type: true, target_id: true } },
        files: { orderBy: { uploaded_at: 'desc' }, take: 1, select: { id: true, analysis: true } } },
    });
    if (!evidence) throw new NotFoundException('Evidence not found');
    let analysis = evidence.files[0]?.analysis ?? null;
    if (analysis?.job_id && isActive(analysis.status)) analysis = await this.sync(analysis.id, analysis.job_id, projectId, evidenceId, evidence.title);
    if (!analysis) return { analysis: null };

    const soaStep = await this.access.stepByKey(projectId, SOA_KEY);
    const suggestions = (analysis.suggestions as Suggestion[] | null) ?? [];
    const rows = soaStep
      ? await this.prisma.soaControl.findMany({
          where: { step_id: soaStep.id, control: { code: { in: suggestions.map(s => s.ref) } } },
          select: { id: true, control: { select: { code: true } } },
        })
      : [];
    // A clause is linked as is; a control through its row in the Statement of Applicability (none before the SoA exists).
    const targetFor = (ref: string) => {
      if (!ref.startsWith('A.')) return { type: 'CLAUSE', id: ref };
      const row = rows.find(r => r.control.code === ref);
      return row ? { type: 'SOA_CONTROL', id: row.id } : null;
    };
    return {
      analysis: {
        status: analysis.status,
        error: analysis.status === 'FAILED' ? analysis.error ?? 'The analysis could not be completed.' : null,
        note: analysis.note,
        summary: analysis.summary,
        document_type: analysis.document_type,
        pages: analysis.pages,
        ocr_pages: analysis.ocr_pages,
        suggestions: suggestions.map(s => {
          const target = targetFor(s.ref);
          return { ...s, target, linked: !!target && evidence.links.some(l => l.target_type === target.type && l.target_id === target.id) };
        }),
        expiry: analysis.expiry_date
          ? { date: analysis.expiry_date.toISOString().slice(0, 10), quote: analysis.expiry_quote, applied: evidence.valid_until?.getTime() === analysis.expiry_date.getTime() }
          : null,
      },
    };
  }

  async retry(projectId: string, userId: string, evidenceId: string) {
    this.access.assertEdit(await this.access.forProject(projectId, userId));
    const file = await this.prisma.evidenceFile.findFirst({ where: { evidence: { id: evidenceId, project_id: projectId } }, orderBy: { uploaded_at: 'desc' }, select: { id: true } });
    if (!file) throw new NotFoundException('This evidence has no file');
    await this.analyze(file.id, userId);
    return this.view(projectId, userId, evidenceId);
  }

  /** Saves the job's outcome once (guarded by the status), then indexes what was read for the companion. */
  private async sync(analysisId: string, jobId: string, projectId: string, evidenceId: string, title: string) {
    const job = await this.jobs.get<Result>(jobId, projectId);
    if (isActive(job.status)) {
      return this.prisma.evidenceAnalysis.update({ where: { id: analysisId }, data: { status: job.status } });
    }
    const r = job.result;
    const claimed = await this.prisma.evidenceAnalysis.updateMany({
      where: { id: analysisId, status: { in: ['QUEUED', 'RUNNING'] } },
      data: r && job.status === 'DONE'
        ? {
            status: 'DONE', completed_at: new Date(), run_id: r.run_id, summary: r.summary, document_type: r.document_type,
            suggestions: r.suggested as unknown as Prisma.InputJsonValue, pages: r.pages, ocr_pages: r.ocr_pages, note: r.note ?? null,
            expiry_date: r.expiry ? new Date(r.expiry.date) : null, expiry_quote: r.expiry?.quote ?? null,
          }
        : { status: 'FAILED', completed_at: new Date(), error: 'The analysis could not be completed.' },
    });
    if (claimed.count === 1 && r?.summary) this.knowledge.indexEvidence(projectId, evidenceId, title, r.summary, r.text);
    return this.prisma.evidenceAnalysis.findUniqueOrThrow({ where: { id: analysisId } });
  }

  private save(fileId: string, projectId: string, data: Omit<Prisma.EvidenceAnalysisUncheckedCreateInput, 'file_id' | 'project_id'>) {
    return this.prisma.evidenceAnalysis.upsert({ where: { file_id: fileId }, update: data, create: { file_id: fileId, project_id: projectId, ...data } });
  }
}
