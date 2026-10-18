import { PrismaService } from '../prisma/prisma.service';
import { Sheet } from './excel';

/** Registers that can be exported, in the order of the "All registers" workbook. */
export const REGISTERS = [
  'documents', 'requirements', 'risks', 'soa', 'treatment-plan', 'nonconformities',
  'incidents', 'trainings', 'objectives', 'internal-audits', 'evidence',
] as const;
export type RegisterKey = (typeof REGISTERS)[number];

/** "ACTIONS_DEFINED" → "Actions defined". */
const label = (v: string | null | undefined) => (v ? v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ') : '');
const yesNo = (v: boolean | null | undefined) => (v == null ? '' : v ? 'Yes' : 'No');
const addMonths = (d: Date, months: number) => { const r = new Date(d); r.setMonth(r.getMonth() + months); return r; };
const ref = (prefix: string, n: number) => `${prefix}-${String(n).padStart(3, '0')}`;
const PERSON = { select: { first_name: true, last_name: true } } as const;
const fullName = (u: { first_name: string; last_name: string } | null | undefined) => (u ? `${u.first_name} ${u.last_name}`.trim() : '');

type Ctx = { prisma: PrismaService; projectId: string; people: (id: string | null | undefined) => string };
const inProject = (projectId: string) => ({ step: { phase: { project_id: projectId } } });

/**
 * Builds the sheets of the given registers (some have two, e.g. corrective
 * actions). `provided` supplies sheets built elsewhere (the evidence list).
 */
export async function registerSheets(
  prisma: PrismaService,
  projectId: string,
  keys: readonly RegisterKey[],
  provided: Record<Exclude<RegisterKey, keyof typeof BUILDERS>, () => Promise<Sheet[]>>,
): Promise<Sheet[]> {
  const members = await prisma.projectMember.findMany({ where: { project_id: projectId }, select: { user_id: true, user: PERSON } });
  const names = new Map(members.map(m => [m.user_id, fullName(m.user)]));
  const ctx: Ctx = { prisma, projectId, people: id => (id ? names.get(id) ?? '' : '') };
  const sheets: Sheet[] = [];
  for (const key of keys) sheets.push(...(await (key in BUILDERS ? BUILDERS[key as keyof typeof BUILDERS](ctx) : provided[key as keyof typeof provided]())));
  return sheets;
}

const BUILDERS: Record<Exclude<RegisterKey, 'evidence'>, (ctx: Ctx) => Promise<Sheet[]>> = {
  /** Master list of documents (clause 7.5): every controlled document and its current approved version. */
  documents: async ({ prisma, projectId }) => {
    const docs = await prisma.documentInstance.findMany({
      where: inProject(projectId),
      select: {
        code: true, title: true, status: true, confidentiality: true, update_interval: true,
        owner: PERSON,
        step: { select: { order: true, phase: { select: { order: true, name: true } } } },
        versions: { orderBy: { published_at: 'desc' }, take: 1, select: { version: true, published_at: true, approver: PERSON } },
      },
      orderBy: [{ step: { phase: { order: 'asc' } } }, { step: { order: 'asc' } }],
    });
    return [{
      name: 'Master list of documents',
      columns: [
        { header: 'Code', width: 16 }, { header: 'Title', width: 40 }, { header: 'Phase', width: 26 }, { header: 'Version', width: 10 },
        { header: 'Approved by', width: 20 }, { header: 'Approved on', width: 13 }, { header: 'Owner', width: 20 },
        { header: 'Review every (months)', width: 12 }, { header: 'Next review', width: 13 }, { header: 'Confidentiality', width: 15 }, { header: 'Status', width: 22 },
      ],
      rows: docs.map(d => {
        const v = d.versions[0];
        return [
          d.code, d.title, d.step ? `${d.step.phase.order} ${d.step.phase.name}` : '', v?.version ?? 'Not approved yet',
          fullName(v?.approver), v?.published_at, fullName(d.owner), d.update_interval,
          v && d.update_interval ? addMonths(v.published_at, d.update_interval) : null, d.confidentiality,
          d.status === 'PUBLISHED' ? 'In the library' : d.status === 'IN_REVIEW' ? 'Waiting for approval' : v ? 'Revision in progress' : 'Draft',
        ];
      }),
    }];
  },

  requirements: async ({ prisma, projectId }) => {
    const items = await prisma.requirement.findMany({ where: inProject(projectId), include: { responsible_person: PERSON }, orderBy: { created_at: 'asc' } });
    return [{
      name: 'Requirements',
      columns: [
        { header: 'Type', width: 16 }, { header: 'Interested party', width: 22 }, { header: 'Requirement', width: 50 }, { header: 'Law / regulation or document', width: 30 },
        { header: 'Valid from / document date', width: 14 }, { header: 'Jurisdiction', width: 16 }, { header: 'Related area', width: 28 },
        { header: 'Responsible', width: 20 }, { header: 'Deadline', width: 12 }, { header: 'Status', width: 14 }, { header: 'Link', width: 30 },
      ],
      rows: items.map(r => [
        label(r.requirement_type), r.interested_party, r.description, r.law_regulation_name ?? r.document_stipulating,
        r.valid_from ?? r.date_of_document, [r.country, r.state].filter(Boolean).join(', '), r.related_area,
        fullName(r.responsible_person), r.deadline, label(r.status), r.link,
      ]),
    }];
  },

  /** Risk register (clauses 6.1.2 and 8.2): scale 0-2, level = impact + likelihood, 3-4 unacceptable. */
  risks: async ({ prisma, projectId }) => {
    const items = await prisma.riskItem.findMany({
      where: { ...inProject(projectId), discarding: false },
      include: {
        asset: { select: { name: true } }, vulnerability: { select: { name: true } }, threat: { select: { name: true } },
        risk_owner: PERSON, treatment_controls_link: { select: { control: { select: { code: true } } } },
      },
      orderBy: { created_at: 'asc' },
    });
    return [{
      name: 'Risk register',
      columns: [
        { header: '#', width: 6 }, { header: 'Asset', width: 26 }, { header: 'Vulnerability', width: 28 }, { header: 'Threat', width: 28 },
        { header: 'Existing controls', width: 30 }, { header: 'Impact (0-2)', width: 9 }, { header: 'Likelihood (0-2)', width: 11 }, { header: 'Risk level (0-4)', width: 10 },
        { header: 'Acceptable', width: 12 }, { header: 'Risk owner', width: 20 }, { header: 'Treatment', width: 14 }, { header: 'Treatment controls', width: 22 },
        { header: 'Treatment description', width: 34 }, { header: 'Residual risk', width: 10 }, { header: 'Owner approval', width: 14 }, { header: 'Approved on', width: 13 },
      ],
      rows: items.map((r, i) => [
        i + 1, r.asset.name, r.vulnerability.name, r.threat.name, r.existing_controls, r.impact, r.likelihood, r.level,
        label(r.acceptability), fullName(r.risk_owner), label(r.treatment_option),
        r.treatment_controls_link.map(l => l.control.code).join(', '), r.treatment_description, r.residual_risk,
        label(r.approval_decision), r.approval_at,
      ]),
    }];
  },

  /** Statement of Applicability (clause 6.1.3 d): the 93 Annex A controls. */
  soa: async ({ prisma, projectId }) => {
    const rows = await prisma.soaControl.findMany({ where: inProject(projectId), include: { control: { select: { code: true, title: true } } } });
    rows.sort((a, b) => a.control.code.localeCompare(b.control.code, undefined, { numeric: true }));
    return [{
      name: 'Statement of Applicability',
      columns: [
        { header: 'Control', width: 9 }, { header: 'Title', width: 40 }, { header: 'Applicable', width: 11 }, { header: 'Justification', width: 50 },
        { header: 'Implementation method', width: 50 }, { header: 'Status', width: 16 },
      ],
      rows: rows.map(r => [r.control.code, r.control.title, yesNo(r.applicable), r.justification, r.implementation_method, label(r.status)]),
    }];
  },

  /** Risk Treatment Plan (clause 6.1.3 e): applicable controls not implemented yet. */
  'treatment-plan': async ({ prisma, projectId, people }) => {
    const rows = await prisma.soaControl.findMany({
      where: { ...inProject(projectId), applicable: true, status: { not: 'IMPLEMENTED' } },
      include: { control: { select: { code: true, title: true } } },
    });
    rows.sort((a, b) => a.control.code.localeCompare(b.control.code, undefined, { numeric: true }));
    return [{
      name: 'Risk Treatment Plan',
      columns: [
        { header: 'Control', width: 9 }, { header: 'Title', width: 36 }, { header: 'Status', width: 16 }, { header: 'What to do', width: 46 },
        { header: 'Responsible', width: 20 }, { header: 'Deadline', width: 12 }, { header: 'Resources', width: 30 }, { header: 'Resources decision', width: 16 },
      ],
      rows: rows.map(r => [r.control.code, r.control.title, label(r.status), r.implementation_method, people(r.responsible_id), r.deadline, r.resources, label(r.resources_decision)]),
    }];
  },

  /** Nonconformities and corrective actions (clause 10.2). */
  nonconformities: async ({ prisma, projectId, people }) => {
    const ncs = await prisma.nonconformity.findMany({ where: { project_id: projectId }, include: { actions: { orderBy: { created_at: 'asc' } } }, orderBy: { number: 'asc' } });
    return [
      {
        name: 'Nonconformities',
        columns: [
          { header: 'Ref', width: 9 }, { header: 'Title', width: 30 }, { header: 'Description', width: 40 }, { header: 'Source', width: 16 }, { header: 'Detected on', width: 13 },
          { header: 'Responsible', width: 20 }, { header: 'Correction', width: 34 }, { header: 'Root cause', width: 34 }, { header: 'Status', width: 16 },
          { header: 'Effectiveness review', width: 34 }, { header: 'Verified by', width: 20 }, { header: 'Closed on', width: 13 },
        ],
        rows: ncs.map(n => [
          ref('NC', n.number), n.title, n.description, label(n.source), n.detected_on, people(n.responsible_id), n.correction, n.root_cause,
          label(n.status), n.effectiveness_review ?? n.not_relevant_reason, people(n.effectiveness_verified_by), n.closed_at,
        ]),
      },
      {
        name: 'Corrective actions',
        columns: [{ header: 'Nonconformity', width: 13 }, { header: 'Action', width: 50 }, { header: 'Responsible', width: 20 }, { header: 'Due date', width: 12 }, { header: 'Status', width: 13 }, { header: 'Done on', width: 12 }],
        rows: ncs.flatMap(n => n.actions.map(a => [ref('NC', n.number), a.description, people(a.responsible_id), a.due_date, label(a.status), a.completed_at])),
      },
    ];
  },

  /** Incidents (A.5.24 to A.5.28). */
  incidents: async ({ prisma, projectId, people }) => {
    const items = await prisma.incident.findMany({ where: { project_id: projectId }, orderBy: { number: 'asc' } });
    return [{
      name: 'Incidents',
      columns: [
        { header: 'Ref', width: 9 }, { header: 'Title', width: 30 }, { header: 'Description', width: 40 }, { header: 'Occurred on', width: 13 }, { header: 'Severity', width: 10 },
        { header: 'Affects (C/I/A)', width: 10 }, { header: 'Security incident', width: 11 }, { header: 'Responsible', width: 20 }, { header: 'Assessment', width: 34 },
        { header: 'Response', width: 34 }, { header: 'Evidence collected', width: 30 }, { header: 'Lessons learned', width: 34 }, { header: 'Status', width: 12 }, { header: 'Closed on', width: 13 },
      ],
      rows: items.map(i => [
        ref('INC', i.number), i.title, i.description, i.occurred_at, label(i.severity),
        [i.affects_confidentiality && 'C', i.affects_integrity && 'I', i.affects_availability && 'A'].filter(Boolean).join(''),
        yesNo(i.is_security_incident), people(i.responsible_id), i.assessment, i.response, i.evidence, i.lessons_learned, label(i.status), i.closed_at,
      ]),
    }];
  },

  /** Training plan and records (clause 7.2). */
  trainings: async ({ prisma, projectId, people }) => {
    const items = await prisma.training.findMany({ where: { project_id: projectId }, orderBy: { created_at: 'asc' } });
    return [{
      name: 'Trainings',
      columns: [
        { header: 'Training', width: 30 }, { header: 'Knowledge and skills', width: 36 }, { header: 'Participants', width: 30 }, { header: 'Method / provider', width: 22 },
        { header: 'Planned on', width: 12 }, { header: 'Performed on', width: 12 }, { header: 'Status', width: 12 }, { header: 'Approved by', width: 20 },
        { header: 'Evidence', width: 30 }, { header: 'Effectiveness', width: 30 },
      ],
      rows: items.map(t => [
        t.title, t.skills, ((t.participant_ids as string[]) ?? []).map(people).join(', '), [t.method, t.provider].filter(Boolean).join(' / '),
        t.planned_date, t.performed_date, label(t.status), people(t.approved_by), t.evidence, t.effectiveness,
      ]),
    }];
  },

  /** Security objectives and their measurements (clauses 6.2 and 9.1). */
  objectives: async ({ prisma, projectId, people }) => {
    const items = await prisma.securityObjective.findMany({ where: { project_id: projectId }, include: { measurements: { orderBy: { measured_on: 'asc' } } }, orderBy: { order: 'asc' } });
    return [
      {
        name: 'Security objectives',
        columns: [
          { header: '#', width: 5 }, { header: 'Objective', width: 40 }, { header: 'Type', width: 12 }, { header: 'Action plan', width: 36 }, { header: 'Resources', width: 24 },
          { header: 'Responsible', width: 20 }, { header: 'Due date', width: 12 }, { header: 'How it is measured', width: 30 }, { header: 'Frequency', width: 14 },
          { header: 'Status', width: 12 }, { header: 'Approved by', width: 20 }, { header: 'Approved on', width: 13 },
        ],
        rows: items.map(o => [
          o.order, o.title, label(o.type), o.action_plan, o.resources, people(o.responsible_id), o.due_date, o.measurement,
          label(o.frequency), label(o.status), people(o.approved_by), o.approved_at,
        ]),
      },
      {
        name: 'Measurements',
        columns: [{ header: 'Objective', width: 40 }, { header: 'Measured on', width: 13 }, { header: 'Result', width: 30 }, { header: 'Achieved', width: 10 }, { header: 'Comment', width: 34 }, { header: 'Recorded by', width: 20 }],
        rows: items.flatMap(o => o.measurements.map(m => [o.title, m.measured_on, m.result, yesNo(m.achieved), m.comment, people(m.recorded_by)])),
      },
    ];
  },

  /** Internal audits and their checklist results (clause 9.2). */
  'internal-audits': async ({ prisma, projectId, people }) => {
    const audits = await prisma.internalAudit.findMany({ where: { project_id: projectId }, include: { items: { orderBy: { order: 'asc' } } }, orderBy: { start_date: 'asc' } });
    return [
      {
        name: 'Internal audits',
        columns: [
          { header: 'Audit', width: 30 }, { header: 'From', width: 12 }, { header: 'To', width: 12 }, { header: 'Lead auditor', width: 20 }, { header: 'Auditees', width: 24 },
          { header: 'Scope', width: 34 }, { header: 'Status', width: 12 }, { header: 'Conclusion', width: 40 }, { header: 'Approved by', width: 20 }, { header: 'Approved on', width: 13 },
        ],
        rows: audits.map(a => [a.title, a.start_date, a.end_date, people(a.lead_auditor_id), a.auditees, a.scope, label(a.status), a.conclusion, people(a.approved_by), a.approved_at]),
      },
      {
        name: 'Audit checklist',
        columns: [{ header: 'Audit', width: 26 }, { header: 'Ref', width: 9 }, { header: 'Requirement', width: 36 }, { header: 'Question', width: 50 }, { header: 'Result', width: 22 }, { header: 'Evidence', width: 40 }],
        rows: audits.flatMap(a => a.items.map(i => [a.title, i.ref, i.requirement, i.question, label(i.result), i.evidence])),
      },
    ];
  },

};
