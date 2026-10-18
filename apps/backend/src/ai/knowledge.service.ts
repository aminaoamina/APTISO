import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../common/services/project-access.service';
import { RISK_REGISTER_KEY, SOA_KEY } from '../audit-prep/keys';
import { AiServiceClient } from './ai-service.client';
import { coverage } from './coverage';
import { proseText } from './text';

export interface Fact { text: string; source_type: string; source_id: string | null }

const REINDEX_DELAY_MS = 15_000;
const fmt = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const person = (u: { first_name: string; last_name: string } | null | undefined) => (u ? `${u.first_name} ${u.last_name}`.trim() : null);

/**
 * Keeps the AI service's search index in step with the documents, and turns
 * the project's records into facts for the companion chat. Indexing never
 * blocks the action that triggers it.
 */
@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private readonly pending = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly ai: AiServiceClient,
  ) {}

  /** (Re)indexes one document: library documents are visible to every member, drafts only to editors. */
  async indexDocument(documentId: string) {
    const doc = await this.prisma.documentInstance.findUnique({
      where: { id: documentId },
      select: {
        title: true, content: true, template: { select: { code: true } },
        step: { select: { key: true, phase: { select: { project_id: true } } } },
        versions: { orderBy: { published_at: 'desc' }, take: 1, select: { version: true } },
      },
    });
    if (!doc?.step) return;
    const sections = this.sections(proseText(doc.content));
    if (sections.length === 0) return;
    await this.ai.request('PUT', `/v1/index/documents/${documentId}`, {
      project_id: doc.step.phase.project_id,
      version: doc.versions[0]?.version ?? null,
      title: doc.title,
      visibility: doc.versions.length ? 'all' : 'editors',
      refs: coverage(doc.step.key, doc.template.code),
      sections,
    }, { timeoutMs: 120_000 });
  }

  /** What the AI read in an evidence file, so the companion can answer from it (evidence is visible to every member). */
  indexEvidence(projectId: string, evidenceId: string, title: string, summary: string, text: string) {
    this.ai.request('PUT', `/v1/index/documents/${evidenceId}`, {
      project_id: projectId, source_type: 'evidence', version: null, title, visibility: 'all', refs: [],
      sections: [{ heading: 'Summary', text: summary }, { heading: 'Content', text: text.slice(0, 50_000) }],
    }, { timeoutMs: 120_000 }).catch(e => this.logger.warn(`Indexing evidence ${evidenceId} failed: ${(e as Error).message}`));
  }

  /** Background variant for hooks (publishing, saving): failures are logged, never raised. */
  indexInBackground(documentId: string) {
    this.indexDocument(documentId).catch(e => this.logger.warn(`Indexing ${documentId} failed: ${(e as Error).message}`));
  }

  /** A draft is re-indexed a moment after its last save (autosave sends many saves while typing). */
  indexSoon(documentId: string) {
    clearTimeout(this.pending.get(documentId));
    this.pending.set(documentId, setTimeout(() => { this.pending.delete(documentId); this.indexInBackground(documentId); }, REINDEX_DELAY_MS));
  }

  /** Every AI record of a deleted project: indexed passages, jobs and runs. */
  removeProject(projectId: string) {
    this.ai.request('DELETE', `/v1/projects/${projectId}`)
      .catch(e => this.logger.warn(`Removing the AI data of project ${projectId} failed: ${(e as Error).message}`));
  }

  removeDocument(projectId: string, documentId: string) {
    this.ai.request('DELETE', `/v1/index/documents/${documentId}?project_id=${projectId}`)
      .catch(e => this.logger.warn(`Removing ${documentId} from the index failed: ${(e as Error).message}`));
  }

  /** Indexes every document of the project (first chat of a project, or "refresh knowledge"). */
  async reindexProject(projectId: string) {
    const docs = await this.prisma.documentInstance.findMany({ where: { step: { phase: { project_id: projectId } } }, select: { id: true } });
    for (const d of docs) await this.indexDocument(d.id);
    return { documents: docs.length };
  }

  async ensureIndexed(projectId: string) {
    const { chunks } = await this.ai.request<{ chunks: number }>('GET', `/v1/index/projects/${projectId}`, undefined, { timeoutMs: 5000 });
    if (chunks === 0) await this.reindexProject(projectId);
  }

  /**
   * The project's records about the given clauses and controls, following the
   * links the app already holds: SoA row → risks it treats → documents that
   * cover it → evidence. Read-only users see only library documents.
   */
  async facts(projectId: string, refs: string[], canEdit: boolean): Promise<Fact[]> {
    if (refs.length === 0) return [];
    const controls = refs.filter(r => r.startsWith('A.'));
    const clauses = refs.filter(r => !r.startsWith('A.'));
    const [soaStep, riskStep, documents] = await Promise.all([
      this.access.stepByKey(projectId, SOA_KEY),
      this.access.stepByKey(projectId, RISK_REGISTER_KEY),
      this.prisma.documentInstance.findMany({
        where: { step: { phase: { project_id: projectId } }, ...(!canEdit && { versions: { some: {} } }) },
        select: {
          id: true, title: true, status: true, template: { select: { code: true } }, step: { select: { key: true } },
          versions: { orderBy: { published_at: 'desc' }, take: 1, select: { version: true, published_at: true, approver: { select: { first_name: true, last_name: true } } } },
        },
      }),
    ]);
    const soa = soaStep && controls.length
      ? await this.prisma.soaControl.findMany({
          where: { step_id: soaStep.id, control: { code: { in: controls } } },
          select: { id: true, applicable: true, justification: true, implementation_method: true, status: true, deadline: true,
            control: { select: { code: true, title: true } }, responsible: { select: { first_name: true, last_name: true } } },
        })
      : [];
    const risks = riskStep && controls.length
      ? (await this.prisma.riskItem.findMany({
          where: { step_id: riskStep.id, discarding: false },
          orderBy: { created_at: 'asc' },
          select: { id: true, level: true, acceptability: true, treatment_option: true, residual_risk: true,
            asset: { select: { name: true } }, threat: { select: { name: true } },
            risk_owner: { select: { first_name: true, last_name: true } },
            treatment_controls_link: { select: { control: { select: { code: true } } } } },
        })).map((r, i) => ({ ...r, ref: `R-${String(i + 1).padStart(3, '0')}`, controls: r.treatment_controls_link.map(l => l.control.code) }))
          .filter(r => r.controls.some(c => controls.includes(c)))
      : [];
    const links = await this.prisma.evidenceLink.findMany({
      where: { OR: [{ target_type: 'SOA_CONTROL', target_id: { in: soa.map(s => s.id) } }, { target_type: 'CLAUSE', target_id: { in: clauses } }], evidence: { project_id: projectId, deleted_at: null } },
      select: { target_type: true, target_id: true, evidence: { select: { id: true, title: true, collected_on: true, valid_until: true } } },
    });

    const facts: Fact[] = [];
    for (const s of soa) {
      facts.push({
        source_type: 'soa', source_id: s.control.code,
        text: `Statement of Applicability, ${s.control.code} ${s.control.title}: ${s.applicable == null ? 'applicability not decided' : s.applicable ? 'applicable' : 'not applicable'}`
          + `${s.status ? `; implementation status ${s.status}` : ''}${s.implementation_method ? `; method: ${s.implementation_method}` : ''}`
          + `${s.justification ? `; justification: ${s.justification}` : ''}${person(s.responsible) ? `; responsible ${person(s.responsible)}` : ''}${s.deadline ? `; deadline ${fmt(s.deadline)}` : ''}.`,
      });
    }
    for (const r of risks.slice(0, 10)) {
      facts.push({
        source_type: 'risk', source_id: r.id,
        text: `Risk ${r.ref} (${r.asset.name} / ${r.threat.name}) treated by ${r.controls.filter(c => controls.includes(c)).join(', ')}: level ${r.level ?? 'not assessed'}, ${r.acceptability ?? 'acceptability not assessed'}`
          + `${r.treatment_option ? `, treatment ${r.treatment_option}` : ''}${r.residual_risk != null ? `, residual risk ${r.residual_risk}` : ''}${person(r.risk_owner) ? `, owner ${person(r.risk_owner)}` : ''}.`,
      });
    }
    for (const d of documents) {
      const covered = coverage(d.step?.key ?? null, d.template.code).filter(r => refs.includes(r));
      if (covered.length === 0) continue;
      const v = d.versions[0];
      facts.push({
        source_type: 'document', source_id: d.id,
        text: `Document "${d.title}" covers ${covered.join(', ')}: ${v ? `version ${v.version} in the library since ${fmt(v.published_at)}${person(v.approver) ? `, approved by ${person(v.approver)}` : ''}` : 'not in the library yet (draft)'}`
          + `${v && d.status !== 'PUBLISHED' ? ', with unpublished changes' : ''}.`,
      });
    }
    const today = new Date();
    for (const l of links) {
      const ref = l.target_type === 'CLAUSE' ? l.target_id : soa.find(s => s.id === l.target_id)?.control.code;
      const e = l.evidence;
      facts.push({
        source_type: 'evidence', source_id: e.id,
        text: `Evidence "${e.title}" for ${ref}: collected ${fmt(e.collected_on)}${e.valid_until ? `, valid until ${fmt(e.valid_until)}${e.valid_until < today ? ' (EXPIRED)' : ''}` : ''}.`,
      });
    }
    return facts.slice(0, 40);
  }

  /** Text split at its headings ("# ..." lines from proseText). */
  private sections(text: string) {
    const out: { heading: string | null; text: string }[] = [];
    let current: { heading: string | null; text: string } = { heading: null, text: '' };
    for (const line of text.split('\n')) {
      if (/^#{1,3} /.test(line)) {
        if (current.text.trim()) out.push(current);
        current = { heading: line.replace(/^#+ /, '').slice(0, 300), text: '' };
      } else current.text += `${line}\n`;
    }
    if (current.text.trim()) out.push(current);
    return out.map(s => ({ heading: s.heading, text: s.text.trim().slice(0, 50_000) }));
  }
}
