import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { ProjectAccessService } from '../common/services/project-access.service';
import { StepDocumentService, formatDate } from '../common/services/step-document.service';
import { bulletList, heading, paragraph, table, text, ProseMirrorNode } from '../documents/templates/doc-control.template';
import { InternalAuditService } from '../audit-prep/internal-audit.service';
import { DEFAULT_AUDIT_CRITERIA, DEFAULT_AUDIT_SCOPE } from '../audit-prep/iso-requirements';
import { MAINTENANCE_STEP_KEY, P4 } from '../audit-prep/keys';
import { CreateProgramAuditDto, UpdateAuditProgramDto, UpdateProgramAuditDto } from './maintenance.dto';
import { addMonths, cycleStart } from './cycle';

const DEFAULT_OBJECTIVES =
  'Verify that the ISMS conforms to the requirements of ISO/IEC 27001 and of the organization, and that it is effectively implemented and maintained (clause 9.2.1).';
const DEFAULT_METHODS =
  'Review of documents and records, interviews with the people responsible, observation of activities, sampling of records and technical checks of the implemented controls.';

/** An internal audit takes place two months before each audit by the certification body. */
const PLANNED_MONTHS = [10, 22, 34];
const AUDIT_DAYS = 14;

export type ProgramAuditStatus = 'PLANNED' | 'LATE' | 'IN_PROGRESS' | 'DONE';

/** DONE once the report of the started audit is approved; LATE when the planned month passed without an audit. */
export const programAuditStatus = (a: { planned_month: Date; internal_audit: { status: AuditStatus } | null }, now = new Date()): ProgramAuditStatus =>
  a.internal_audit ? (a.internal_audit.status === 'APPROVED' ? 'DONE' : 'IN_PROGRESS') : addMonths(a.planned_month, 1) <= now ? 'LATE' : 'PLANNED';

const firstOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const monthLabel = (d: Date) => d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const LINES = { orderBy: { planned_month: 'asc' }, include: { internal_audit: { select: { id: true, title: true, status: true } } } } as const;

/** Clause 9.2.2: the internal audits planned over the certification cycle (Phase 5). */
@Injectable()
export class AuditProgramService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly access: ProjectAccessService,
    private readonly documents: StepDocumentService,
    private readonly internalAudits: InternalAuditService,
  ) {}

  async view(projectId: string, certification: Date | null) {
    if (!certification) return null;
    const program = await this.ensure(projectId, certification);
    const start = cycleStart(certification);
    return {
      period_start: start,
      period_end: addMonths(start, 36),
      objectives: program.objectives,
      criteria: program.criteria,
      methods: program.methods,
      audits: program.audits.map(a => ({ ...a, status: programAuditStatus(a) })),
    };
  }

  /** First planned month without a started audit: the date of the next internal audit. */
  async nextPlanned(projectId: string) {
    const next = await this.prisma.programAudit.findFirst({
      where: { program: { project_id: projectId }, internal_audit_id: null },
      orderBy: { planned_month: 'asc' },
      select: { planned_month: true },
    });
    return next?.planned_month ?? null;
  }

  async update(projectId: string, dto: UpdateAuditProgramDto, userId: string) {
    const program = await this.editable(projectId, userId);
    await this.prisma.auditProgram.update({
      where: { id: program.id },
      data: {
        ...(dto.objectives !== undefined && { objectives: dto.objectives.trim() || DEFAULT_OBJECTIVES }),
        ...(dto.criteria !== undefined && { criteria: dto.criteria.trim() || DEFAULT_AUDIT_CRITERIA }),
        ...(dto.methods !== undefined && { methods: dto.methods.trim() || DEFAULT_METHODS }),
      },
    });
    await this.log(userId, program.id, { action: 'update_audit_program', fields: Object.keys(dto) });
  }

  async addAudit(projectId: string, dto: CreateProgramAuditDto, userId: string) {
    const program = await this.editable(projectId, userId);
    await this.access.assertMembers(projectId, [dto.auditor_id]);
    const line = await this.prisma.programAudit.create({
      data: {
        program_id: program.id,
        planned_month: firstOfMonth(new Date(dto.planned_month)),
        auditor_id: dto.auditor_id,
        scope: dto.scope?.trim() || DEFAULT_AUDIT_SCOPE,
      },
    });
    await this.touch(program.id);
    await this.log(userId, line.id, { action: 'add_program_audit' });
  }

  async updateAudit(projectId: string, lineId: string, dto: UpdateProgramAuditDto, userId: string) {
    const { program, line } = await this.notStarted(projectId, lineId, userId);
    await this.access.assertMembers(projectId, [dto.auditor_id]);
    await this.prisma.programAudit.update({
      where: { id: line.id },
      data: {
        ...(dto.planned_month !== undefined && { planned_month: firstOfMonth(new Date(dto.planned_month)) }),
        ...(dto.auditor_id !== undefined && { auditor_id: dto.auditor_id }),
        ...(dto.scope !== undefined && { scope: dto.scope.trim() || DEFAULT_AUDIT_SCOPE }),
      },
    });
    await this.touch(program.id);
    await this.log(userId, line.id, { action: 'update_program_audit', fields: Object.keys(dto) });
  }

  async removeAudit(projectId: string, lineId: string, userId: string) {
    const { program, line } = await this.notStarted(projectId, lineId, userId);
    await this.prisma.programAudit.delete({ where: { id: line.id } });
    await this.touch(program.id);
    await this.log(userId, line.id, { action: 'delete_program_audit' });
  }

  /** Schedules the internal audit of this line in Phase 4, with its checklist and the auditor's task. */
  async startAudit(projectId: string, lineId: string, userId: string) {
    const { program, line } = await this.notStarted(projectId, lineId, userId);
    const step = await this.access.stepByKey(projectId, P4.INTERNAL_AUDIT);
    if (!step) throw new BadRequestException('This project has no Internal Audit step');
    const start = new Date(Math.max(line.planned_month.getTime(), Date.now()));
    const audit = await this.internalAudits.schedule(step.id, {
      title: `Internal audit ${monthLabel(line.planned_month)}`,
      scope: line.scope,
      criteria: program.criteria,
      start_date: start.toISOString(),
      end_date: new Date(start.getTime() + AUDIT_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      lead_auditor_id: line.auditor_id,
    }, userId);
    // Linking does not change the approved programme, so the programme is not touched.
    await this.prisma.programAudit.update({ where: { id: line.id }, data: { internal_audit_id: audit.id } });
    return { audit_id: audit.id, step_id: step.id };
  }

  /** The programme as the document of the Phase 5 step, approved through the library. */
  async createDocument(projectId: string, userId: string) {
    const access = await this.access.forProject(projectId, userId);
    this.access.assertEdit(access);
    const [step, setup, members, project] = await Promise.all([
      this.access.stepByKey(projectId, MAINTENANCE_STEP_KEY),
      this.prisma.maintenanceSetup.findUnique({ where: { project_id: projectId } }),
      this.access.members(projectId),
      this.prisma.complianceProject.findUnique({ where: { id: projectId }, select: { organization: { select: { name: true } } } }),
    ]);
    if (!step) throw new BadRequestException('This project has no maintenance step');
    const view = await this.view(projectId, setup?.certification_date ?? null);
    if (!view) throw new BadRequestException('Record the certification date first');
    if (view.audits.length === 0) throw new BadRequestException('Plan at least one internal audit first');
    const name = (id: string) => members.find(m => m.id === id)?.label ?? '—';
    const orgName = project?.organization?.name ?? 'Organization';

    const content: ProseMirrorNode[] = [
      heading(1, 'Internal Audit Program'),
      paragraph(text(`Organization: ${orgName}`)),
      heading(2, '1. Purpose, scope and users'),
      paragraph(text(
        `This program plans the internal audits of the ISMS of ${orgName} over the certification cycle: their frequency, methods, responsibilities, criteria and scope (ISO/IEC 27001 clause 9.2.2). It is used by top management, the project lead and the internal auditors.`,
      )),
      heading(2, '2. Reference documents'),
      bulletList([
        [text('ISO/IEC 27001 standard, clause 9.2')],
        [text('Internal Audit Procedure')],
        [text('Statement of Applicability')],
      ]),
      heading(2, '3. Program'),
      table([
        [[text('Period')], [text(`${formatDate(view.period_start)} – ${formatDate(view.period_end)}`)]],
        [[text('Certification body')], [text(setup?.certification_body || '—')]],
        [[text('Frequency')], [text('At least one internal audit of the whole ISMS every year, before each audit by the certification body')]],
        [[text('Objectives')], [text(view.objectives)]],
        [[text('Criteria')], [text(view.criteria)]],
        [[text('Methods')], [text(view.methods)]],
      ]),
      heading(2, '4. Responsibilities'),
      paragraph(text(
        'The project lead maintains this program. Each audit is performed by the auditor named below, who must be objective and impartial and must not audit their own work. The auditor reports the results with the checklist and the audit report; nonconformities are recorded in the Nonconformity register; top management approves the audit report.',
      )),
      heading(2, '5. Planned audits'),
      table([
        ['Planned month', 'Scope', 'Auditor'].map(h => [text(h)]),
        ...view.audits.map(a => [[text(monthLabel(a.planned_month))], [text(a.scope)], [text(name(a.auditor_id))]]),
      ]),
    ];

    await this.documents.upsert({
      stepId: step.id,
      templateCode: 'INTERNAL-AUDIT-PROGRAM',
      templateName: 'Internal Audit Program',
      templateDescription: 'Internal audits planned over the certification cycle (ISO/IEC 27001 clause 9.2.2).',
      title: 'Internal Audit Program',
      content: { type: 'doc', content },
      userId,
    });
  }

  /** Approved = the current programme is in the library (approved through the library flow). */
  async approved(projectId: string, stepId: string) {
    const [program, doc] = await Promise.all([
      this.prisma.auditProgram.findUnique({ where: { project_id: projectId }, select: { updated_at: true } }),
      this.prisma.documentInstance.findUnique({ where: { step_id: stepId }, select: { status: true, updated_at: true } }),
    ]);
    if (!doc) return { done: false, detail: 'Generate the Internal Audit Program and submit it to the library for approval' };
    if (program && doc.updated_at < program.updated_at) return { done: false, detail: 'The program changed: refresh the document and submit it again' };
    return { done: doc.status === 'PUBLISHED', detail: 'The Internal Audit Program is waiting for approval in the library' };
  }

  // ─── Helpers ───────────────────────────────────────────────────

  /** Created with the certificate: one audit per year of the cycle, planned before each external audit. */
  async ensure(projectId: string, certification: Date) {
    const existing = await this.prisma.auditProgram.findUnique({ where: { project_id: projectId }, include: { audits: LINES } });
    if (existing) return existing;
    const lead = await this.prisma.projectMember.findFirst({
      where: { project_id: projectId, privilege: 'PROJECT_LEAD' },
      orderBy: { joined_at: 'asc' },
      select: { user_id: true },
    });
    const start = cycleStart(certification);
    return this.prisma.auditProgram.create({
      data: {
        project_id: projectId,
        objectives: DEFAULT_OBJECTIVES,
        criteria: DEFAULT_AUDIT_CRITERIA,
        methods: DEFAULT_METHODS,
        ...(lead && {
          audits: {
            create: PLANNED_MONTHS.map(m => ({ planned_month: firstOfMonth(addMonths(start, m)), auditor_id: lead.user_id, scope: DEFAULT_AUDIT_SCOPE })),
          },
        }),
      },
      include: { audits: LINES },
    });
  }

  private async editable(projectId: string, userId: string) {
    const access = await this.access.forProject(projectId, userId);
    this.access.assertEdit(access);
    const program = await this.prisma.auditProgram.findUnique({ where: { project_id: projectId } });
    if (!program) throw new BadRequestException('Record the certification date first');
    return program;
  }

  private async notStarted(projectId: string, lineId: string, userId: string) {
    const program = await this.editable(projectId, userId);
    const line = await this.prisma.programAudit.findFirst({ where: { id: lineId, program_id: program.id } });
    if (!line) throw new NotFoundException('Planned audit not found');
    if (line.internal_audit_id) throw new BadRequestException('This audit has started: change it in the Internal Audit module');
    return { program, line };
  }

  /** Any change of the plan makes the approved document out of date. */
  private async touch(programId: string) {
    await this.prisma.auditProgram.update({ where: { id: programId }, data: { updated_at: new Date() } });
  }

  private async log(userId: string, entityId: string, details: Record<string, unknown>) {
    await this.auditLog.log({ userId, action: AuditAction.DOCUMENT_UPDATED, entityType: 'audit_program', entityId, details: details as never });
  }
}
