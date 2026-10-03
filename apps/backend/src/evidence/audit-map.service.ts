import { Injectable } from '@nestjs/common';
import { EvidenceTargetType, StepStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ISO_REQUIREMENTS } from '../audit-prep/iso-requirements';
import { P4, REQUIREMENTS_KEY, RISK_REGISTER_KEY, SOA_KEY } from '../audit-prep/keys';

const STEP = {
  DOC_CONTROL: 'iso27001.p1s2.doc-control',
  PROJECT_PLAN: 'iso27001.p1s3.project-plan',
  REQ_PROCEDURE: 'iso27001.p1s4.req-identification',
  SCOPE: 'iso27001.p1s6.isms-scope',
  POLICY: 'iso27001.p1s7.security-policy',
  METHODOLOGY: 'iso27001.p2s1.risk-methodology',
} as const;

type RecordKey =
  | 'requirements' | 'risks' | 'soa' | 'treatment_plan' | 'objectives' | 'measurements' | 'resources'
  | 'trainings' | 'awareness' | 'audits' | 'reviews' | 'review_decisions' | 'nonconformities';

const RECORD_LABELS: Record<RecordKey, string> = {
  requirements: 'requirements of interested parties',
  risks: 'assessed risks',
  soa: 'controls decided in the SoA',
  treatment_plan: 'controls in the Risk Treatment Plan',
  objectives: 'approved security objectives',
  measurements: 'objective measurements',
  resources: 'decided resource requests',
  trainings: 'performed trainings',
  awareness: 'awareness campaigns sent',
  audits: 'approved internal audit reports',
  reviews: 'completed management reviews',
  review_decisions: 'management review decisions',
  nonconformities: 'nonconformities handled',
};

/**
 * What an auditor looks at for each clause: the documented information
 * (approved, in the library) and the records produced by the registers.
 * Clauses without either are proven by evidence only (e.g. 6.3, 7.4).
 */
const CLAUSE_SOURCES: Record<string, { documents: string[]; records: RecordKey[] }> = {
  '4.1': { documents: [STEP.SCOPE], records: [] },
  '4.2': { documents: [STEP.REQ_PROCEDURE, REQUIREMENTS_KEY], records: ['requirements'] },
  '4.3': { documents: [STEP.SCOPE], records: [] },
  '4.4': { documents: [STEP.PROJECT_PLAN], records: [] },
  '5.1': { documents: [STEP.POLICY], records: ['reviews'] },
  '5.2': { documents: [STEP.POLICY], records: [] },
  '5.3': { documents: [STEP.POLICY], records: [] },
  '6.1.1': { documents: [STEP.METHODOLOGY], records: ['risks'] },
  '6.1.2': { documents: [STEP.METHODOLOGY, RISK_REGISTER_KEY], records: ['risks'] },
  '6.1.3': { documents: [SOA_KEY], records: ['soa', 'treatment_plan'] },
  '6.2': { documents: [P4.OBJECTIVES], records: ['objectives'] },
  '6.3': { documents: [], records: [] },
  '7.1': { documents: [], records: ['resources'] },
  '7.2': { documents: [P4.TRAINING_PLAN], records: ['trainings'] },
  '7.3': { documents: [], records: ['awareness'] },
  '7.4': { documents: [], records: [] },
  '7.5': { documents: [STEP.DOC_CONTROL], records: [] },
  '8.1': { documents: [SOA_KEY], records: ['treatment_plan'] },
  '8.2': { documents: [RISK_REGISTER_KEY], records: ['risks'] },
  '8.3': { documents: [SOA_KEY], records: ['treatment_plan'] },
  '9.1': { documents: [P4.OBJECTIVES], records: ['measurements'] },
  '9.2': { documents: [P4.AUDIT_PROCEDURE, P4.INTERNAL_AUDIT], records: ['audits'] },
  '9.3': { documents: [P4.MANAGEMENT_REVIEW], records: ['reviews'] },
  '10.1': { documents: [], records: ['review_decisions'] },
  '10.2': { documents: [P4.NC_PROCEDURE], records: ['nonconformities'] },
};

export type CoverageStatus = 'COVERED' | 'EXPIRED' | 'MISSING_EVIDENCE' | 'MISSING_DOCUMENT' | 'NOT_IMPLEMENTED';

export interface DocumentRef { step_id: string; title: string; in_library: boolean; version: string | null }
export interface EvidenceCount { valid: number; expired: number }

/**
 * The evidence map: for every ISO 27001 clause and every applicable Annex A
 * control, the documents, records and evidence an auditor would check, and
 * whether something is missing.
 */
@Injectable()
export class AuditMapService {
  constructor(private readonly prisma: PrismaService) {}

  async build(projectId: string) {
    const [steps, records, evidence, soaRows] = await Promise.all([
      this.prisma.projectStep.findMany({
        where: { phase: { project_id: projectId } },
        select: {
          id: true, key: true, title: true, status: true, completion_data: true, metadata_json: true,
          phase: { select: { order: true } },
          document_instance: { select: { version: true, _count: { select: { versions: true } } } },
        },
      }),
      this.countRecords(projectId),
      this.countEvidence(projectId),
      this.prisma.soaControl.findMany({
        where: { step: { phase: { project_id: projectId } }, applicable: true },
        select: { id: true, status: true, control: { select: { code: true, title: true } } },
      }),
    ]);

    const skipped = (s: (typeof steps)[number]) => s.status === StepStatus.COMPLETED && (s.completion_data as { skipped?: boolean } | null)?.skipped;
    const docRef = (s: (typeof steps)[number]): DocumentRef => ({
      step_id: s.id,
      title: s.title,
      in_library: !!s.document_instance?._count.versions,
      version: s.document_instance?._count.versions ? s.document_instance.version : null,
    });
    const byKey = new Map(steps.map(s => [s.key, s]));

    const clauses = ISO_REQUIREMENTS.map(req => {
      const sources = CLAUSE_SOURCES[req.ref];
      // A suggested step that was skipped is not required (e.g. the optional procedures).
      const documents = sources.documents.map(k => byKey.get(k)).filter((s): s is (typeof steps)[number] => !!s && !skipped(s)).map(docRef);
      const recordList = sources.records.map(k => ({ label: RECORD_LABELS[k], count: records[k] }));
      const ev = evidence.get(`${EvidenceTargetType.CLAUSE}:${req.ref}`) ?? { valid: 0, expired: 0 };
      return {
        ref: req.ref,
        title: req.requirement,
        question: req.question,
        documents,
        records: recordList,
        evidence: ev,
        status: this.clauseStatus(documents, recordList, ev),
      };
    });

    // Phase 3 policies list the controls they cover.
    const policies = steps.filter(s => s.phase.order === 3 && (s.metadata_json as { required?: boolean } | null)?.required !== false);
    const controls = soaRows
      .map(row => {
        const documents = policies
          .filter(p => ((p.metadata_json as { controls?: string[] } | null)?.controls ?? []).includes(row.control.code))
          .map(docRef);
        const ev = evidence.get(`${EvidenceTargetType.SOA_CONTROL}:${row.id}`) ?? { valid: 0, expired: 0 };
        return {
          id: row.id,
          code: row.control.code,
          title: row.control.title,
          implementation: row.status,
          documents,
          evidence: ev,
          status: this.controlStatus(row.status, documents, ev),
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    const soaStep = byKey.get(SOA_KEY);
    return { clauses, controls, soa_step_id: soaStep?.id ?? null };
  }

  /**
   * A clause needs its documents approved (in the library); it is then
   * covered by its records, by its documents alone when it defines no
   * records, or by valid evidence.
   */
  private clauseStatus(documents: DocumentRef[], records: { count: number }[], ev: EvidenceCount): CoverageStatus {
    if (documents.some(d => !d.in_library)) return 'MISSING_DOCUMENT';
    if (records.some(r => r.count > 0) || (documents.length > 0 && records.length === 0)) return 'COVERED';
    return this.evidenceStatus(ev);
  }

  /** An implemented control is proven by evidence, and its policies must be approved. */
  private controlStatus(implementation: string | null, documents: DocumentRef[], ev: EvidenceCount): CoverageStatus {
    if (implementation !== 'IMPLEMENTED') return 'NOT_IMPLEMENTED';
    if (documents.some(d => !d.in_library)) return 'MISSING_DOCUMENT';
    return this.evidenceStatus(ev);
  }

  private evidenceStatus(ev: EvidenceCount): CoverageStatus {
    if (ev.valid > 0) return 'COVERED';
    return ev.expired > 0 ? 'EXPIRED' : 'MISSING_EVIDENCE';
  }

  private async countEvidence(projectId: string) {
    const today = new Date(new Date().toDateString());
    const links = await this.prisma.evidenceLink.findMany({
      where: { evidence: { project_id: projectId, deleted_at: null } },
      select: { target_type: true, target_id: true, evidence: { select: { valid_until: true } } },
    });
    const counts = new Map<string, EvidenceCount>();
    for (const l of links) {
      const key = `${l.target_type}:${l.target_id}`;
      const c = counts.get(key) ?? { valid: 0, expired: 0 };
      if (l.evidence.valid_until && l.evidence.valid_until < today) c.expired++;
      else c.valid++;
      counts.set(key, c);
    }
    return counts;
  }

  private async countRecords(projectId: string): Promise<Record<RecordKey, number>> {
    const project = { project_id: projectId };
    const inProject = { step: { phase: { project_id: projectId } } };
    const [requirements, risks, soa, treatment_plan, objectives, measurements, resources, trainings, awarenessSteps, audits, reviews, review_decisions, nonconformities] = await Promise.all([
      this.prisma.requirement.count({ where: inProject }),
      this.prisma.riskItem.count({ where: { ...inProject, discarding: false, level: { not: null } } }),
      this.prisma.soaControl.count({ where: { ...inProject, applicable: { not: null } } }),
      this.prisma.soaControl.count({ where: { ...inProject, task_id: { not: null } } }),
      this.prisma.securityObjective.count({ where: { ...project, approved_at: { not: null } } }),
      this.prisma.objectiveMeasurement.count({ where: { objective: project } }),
      this.prisma.resourceRequest.count({ where: { ...project, status: { not: 'PENDING' } } }),
      this.prisma.training.count({ where: { ...project, status: 'PERFORMED' } }),
      this.prisma.projectStep.findMany({ where: { phase: { project_id: projectId } }, select: { completion_data: true } }),
      this.prisma.internalAudit.count({ where: { ...project, status: 'APPROVED' } }),
      this.prisma.managementReview.count({ where: { ...project, status: 'COMPLETED' } }),
      this.prisma.managementReviewDecision.count({ where: { review: project } }),
      this.prisma.nonconformity.count({ where: { ...project, status: { in: ['RESOLVED', 'NOT_RELEVANT'] } } }),
    ]);
    const awareness = awarenessSteps.filter(s => (s.completion_data as { awareness?: unknown } | null)?.awareness).length;
    return { requirements, risks, soa, treatment_plan, objectives, measurements, resources, trainings, awareness, audits, reviews, review_decisions, nonconformities };
  }
}
