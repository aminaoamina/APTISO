import { createHash } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AiFindingState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../common/services/project-access.service';
import { ISO_REQUIREMENTS } from '../audit-prep/iso-requirements';
import { SOA_KEY } from '../audit-prep/keys';
import { AiJobsService, isActive } from './jobs.service';
import { coverage } from './coverage';
import { proseText } from './text';

interface Finding { type: string; ref: string; quote: string | null; explanation: string; suggestion: string; severity: string }
interface ReviewResult { findings: Finding[]; run_id: string }
type Job = Awaited<ReturnType<AiJobsService['get']>> & { result: ReviewResult | null };
const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

/**
 * AI review of a document, as a background job of the AI service. The review
 * is advice: it never blocks submission or approval. Findings are saved here,
 * once per job, with the person's decision on each.
 */
@Injectable()
export class DocumentReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly jobs: AiJobsService,
  ) {}

  async request(projectId: string, userId: string, documentId: string) {
    this.access.assertEdit(await this.access.forProject(projectId, userId));
    const doc = await this.loadDocument(projectId, documentId);
    const refs = coverage(doc.step?.key ?? null, doc.template.code);
    if (refs.length === 0) throw new BadRequestException('This document has no ISO 27001 clauses or controls to review it against');
    const text = proseText(doc.content);
    if (!text.trim()) throw new BadRequestException('The document is empty');

    const contentHash = createHash('sha256').update(JSON.stringify(doc.content)).digest('hex');
    const previous = await this.prisma.documentAiReview.findMany({ where: { document_id: documentId, content_hash: contentHash }, orderBy: { created_at: 'desc' } });
    // Same content: show the existing review instead of starting a new one (a failed one can be retried).
    if (previous[0] && previous[0].status !== 'FAILED') return this.latest(projectId, userId, documentId);

    const job = await this.jobs.submit<ReviewResult>(
      'review',
      `review:${documentId}:${contentHash}${previous.length ? `:retry-${previous.length}` : ''}`,
      projectId,
      userId,
      { document: { id: documentId, title: doc.title, text }, covers: await this.covers(projectId, refs) },
    );
    await this.prisma.documentAiReview.upsert({
      where: { job_id: job.job_id },
      update: {},
      create: { document_id: documentId, project_id: projectId, requested_by: userId, content_hash: contentHash, job_id: job.job_id, status: job.status },
    });
    return this.latest(projectId, userId, documentId);
  }

  /** The latest review of the document; while it runs, its job is checked and the result saved when it is done. */
  async latest(projectId: string, userId: string, documentId: string) {
    await this.access.forProject(projectId, userId);
    const doc = await this.loadDocument(projectId, documentId);
    let review = await this.prisma.documentAiReview.findFirst({ where: { document_id: documentId }, orderBy: { created_at: 'desc' } });
    if (!review) return { review: null };
    if (isActive(review.status)) {
      await this.sync(review.id, await this.jobs.get<ReviewResult>(review.job_id, projectId));
      review = await this.prisma.documentAiReview.findUniqueOrThrow({ where: { id: review.id } });
    }
    const findings = await this.prisma.aiReviewFinding.findMany({ where: { review_id: review.id } });
    const titles = await this.titles(findings.map(f => f.ref));
    return {
      review: {
        id: review.id,
        status: review.status,
        error: review.status === 'FAILED' ? 'The review could not be completed. Try again.' : null,
        created_at: review.created_at,
        completed_at: review.completed_at,
        // The document changed after this review: its findings may no longer apply.
        outdated: review.content_hash !== createHash('sha256').update(JSON.stringify(doc.content)).digest('hex'),
        findings: findings
          .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3))
          .map(f => ({ ...f, ref_title: titles.get(f.ref) ?? null })),
      },
    };
  }

  async decide(projectId: string, userId: string, findingId: string, state: AiFindingState) {
    this.access.assertEdit(await this.access.forProject(projectId, userId));
    const finding = await this.prisma.aiReviewFinding.findFirst({ where: { id: findingId, review: { project_id: projectId } } });
    if (!finding) throw new NotFoundException('Finding not found');
    return this.prisma.aiReviewFinding.update({
      where: { id: findingId },
      data: { state, decided_by: state === 'OPEN' ? null : userId, decided_at: state === 'OPEN' ? null : new Date() },
    });
  }

  /** Saves the job's outcome once: the status change and the findings are one transaction, guarded by the status. */
  private async sync(reviewId: string, job: Job) {
    if (isActive(job.status)) {
      await this.prisma.documentAiReview.updateMany({ where: { id: reviewId, status: { in: ['QUEUED', 'RUNNING'] } }, data: { status: job.status } });
      return;
    }
    await this.prisma.$transaction(async tx => {
      const claimed = await tx.documentAiReview.updateMany({
        where: { id: reviewId, status: { in: ['QUEUED', 'RUNNING'] } },
        data: { status: job.status, completed_at: new Date(), run_id: job.result?.run_id ?? null, error: job.error },
      });
      if (claimed.count === 1 && job.status === 'DONE' && job.result) {
        await tx.aiReviewFinding.createMany({
          data: job.result.findings.map(f => ({ review_id: reviewId, type: f.type, ref: f.ref, quote: f.quote, explanation: f.explanation, suggestion: f.suggestion, severity: f.severity })),
        });
      }
    });
  }

  private async loadDocument(projectId: string, documentId: string) {
    const doc = await this.prisma.documentInstance.findFirst({
      where: { id: documentId, step: { phase: { project_id: projectId } } },
      select: { title: true, content: true, template: { select: { code: true } }, step: { select: { key: true } } },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  /** The clauses and controls with the organization's SoA entry for each control. */
  private async covers(projectId: string, refs: string[]) {
    const soaStep = await this.access.stepByKey(projectId, SOA_KEY);
    const rows = soaStep
      ? await this.prisma.soaControl.findMany({
          where: { step_id: soaStep.id, control: { code: { in: refs } } },
          select: { applicable: true, justification: true, implementation_method: true, status: true, control: { select: { code: true } } },
        })
      : [];
    return refs.map(ref => {
      const row = rows.find(r => r.control.code === ref);
      return { ref, soa: row ? { applicable: row.applicable, justification: row.justification, method: row.implementation_method, status: row.status } : null };
    });
  }

  private async titles(refs: string[]) {
    const controls = await this.prisma.riskControl.findMany({ where: { code: { in: refs } }, select: { code: true, title: true } });
    return new Map<string, string>([
      ...ISO_REQUIREMENTS.map(r => [r.ref, r.requirement] as [string, string]),
      ...controls.map(c => [c.code, c.title] as [string, string]),
    ]);
  }
}
