import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditResult, FindingSource, Prisma, TaskType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { TaskService } from '../common/services/task.service';
import { ProjectAccessService } from '../common/services/project-access.service';
import { StepDocumentService, formatDate, latest } from '../common/services/step-document.service';
import { heading, paragraph, table, text, bulletList, ProseMirrorNode } from '../documents/templates/doc-control.template';
import { compareControlCodes } from '../soa/soa.service';
import { ImprovementService } from './improvement.service';
import { AuditReportDto, CreateAuditDto, UpdateAuditDto, UpdateAuditItemDto } from './dto/audit-prep.dto';
import { DEFAULT_AUDIT_CRITERIA, DEFAULT_AUDIT_SCOPE, ISO_REQUIREMENTS } from './iso-requirements';
import { P4, SOA_KEY, checklist } from './keys';

export const RESULT_LABELS: Record<AuditResult, string> = {
  CONFORMING: 'Conforming',
  MINOR_NONCONFORMITY: 'Minor nonconformity',
  MAJOR_NONCONFORMITY: 'Major nonconformity',
  OBSERVATION: 'Observation / opportunity for improvement',
  NOT_AUDITED: 'Not audited',
};

const isNonconformity = (r: AuditResult | null) => r === 'MINOR_NONCONFORMITY' || r === 'MAJOR_NONCONFORMITY';

const AUDIT_INCLUDE = {
  items: {
    orderBy: { order: 'asc' },
    include: { nonconformity: { select: { id: true, number: true, status: true } } },
  },
} satisfies Prisma.InternalAuditInclude;

/** Clause 9.2: internal audit programme, checklist, findings and report. */
@Injectable()
export class InternalAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly tasks: TaskService,
    private readonly access: ProjectAccessService,
    private readonly documents: StepDocumentService,
    private readonly improvement: ImprovementService,
  ) {}

  async get(stepId: string, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.INTERNAL_AUDIT);
    const [audits, members, documents, completion] = await Promise.all([
      this.prisma.internalAudit.findMany({ where: { project_id: access.projectId }, include: AUDIT_INCLUDE, orderBy: { start_date: 'asc' } }),
      this.access.members(access.projectId),
      this.documents.list(stepId),
      this.getCompletion(stepId),
    ]);
    return {
      audits,
      members,
      counters: {
        planned: audits.filter(a => a.status === 'PLANNED').length,
        inProgress: audits.filter(a => a.status === 'IN_PROGRESS' || a.status === 'REPORTED').length,
        approved: audits.filter(a => a.status === 'APPROVED').length,
      },
      documents,
      completion,
      permissions: { canEdit: access.canEdit, canDecide: access.canDecide, userId },
    };
  }

  /** "Schedule new audit": the checklist covers clauses 4-10 and every applicable SoA control. */
  async create(stepId: string, dto: CreateAuditDto, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.INTERNAL_AUDIT);
    this.access.assertEdit(access);
    await this.access.assertMembers(access.projectId, [dto.lead_auditor_id]);
    if (new Date(dto.end_date) < new Date(dto.start_date)) throw new BadRequestException('The end date must be after the start date');

    const soaStep = await this.access.stepByKey(access.projectId, SOA_KEY);
    const controls = soaStep
      ? await this.prisma.soaControl.findMany({
          where: { step_id: soaStep.id, applicable: true },
          select: { implementation_method: true, control: { select: { code: true, title: true } } },
        })
      : [];
    controls.sort((a, b) => compareControlCodes(a.control.code, b.control.code));

    const items = [
      ...ISO_REQUIREMENTS.map(r => ({ ref: r.ref, requirement: r.requirement, question: r.question })),
      ...controls.map(c => ({
        ref: c.control.code,
        requirement: c.control.title,
        question: `Is the control implemented as declared in the Statement of Applicability, and is it effective?${c.implementation_method ? ` Declared method: ${c.implementation_method}` : ''}`,
      })),
    ];

    const audit = await this.prisma.internalAudit.create({
      data: {
        project_id: access.projectId,
        title: dto.title.trim(),
        scope: dto.scope?.trim() || DEFAULT_AUDIT_SCOPE,
        criteria: dto.criteria?.trim() || DEFAULT_AUDIT_CRITERIA,
        start_date: new Date(dto.start_date),
        end_date: new Date(dto.end_date),
        lead_auditor_id: dto.lead_auditor_id,
        auditees: dto.auditees?.trim() || null,
        items: { create: items.map((it, i) => ({ ...it, order: i + 1 })) },
      },
    });
    const task = await this.tasks.create({
      projectId: access.projectId,
      organizationId: access.organizationId,
      stepId,
      assignedTo: dto.lead_auditor_id,
      assignedBy: userId,
      type: TaskType.INTERNAL_AUDIT,
      notes: `Perform the internal audit "${audit.title}" (${formatDate(audit.start_date)} to ${formatDate(audit.end_date)}) using the checklist, and report the results.`,
      deadline: audit.end_date,
    });
    await this.prisma.internalAudit.update({ where: { id: audit.id }, data: { task_id: task.id } });
    await this.log(userId, audit.id, { action: 'schedule_audit', checklist_items: items.length });
    return this.get(stepId, userId);
  }

  async update(stepId: string, auditId: string, dto: UpdateAuditDto, userId: string) {
    const { audit } = await this.loadAudit(stepId, auditId, userId);
    if (audit.status === 'APPROVED') throw new BadRequestException('An approved audit report cannot be changed');
    if (dto.lead_auditor_id) await this.access.assertMembers(audit.project_id, [dto.lead_auditor_id]);
    await this.prisma.internalAudit.update({
      where: { id: auditId },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.scope !== undefined && { scope: dto.scope.trim() || DEFAULT_AUDIT_SCOPE }),
        ...(dto.criteria !== undefined && { criteria: dto.criteria.trim() || DEFAULT_AUDIT_CRITERIA }),
        ...(dto.start_date !== undefined && { start_date: new Date(dto.start_date) }),
        ...(dto.end_date !== undefined && { end_date: new Date(dto.end_date) }),
        ...(dto.lead_auditor_id !== undefined && { lead_auditor_id: dto.lead_auditor_id }),
        ...(dto.auditees !== undefined && { auditees: dto.auditees.trim() || null }),
        ...(dto.conclusion !== undefined && { conclusion: dto.conclusion.trim() || null }),
      },
    });
    await this.log(userId, auditId, { action: 'update_audit', fields: Object.keys(dto) });
    return this.get(stepId, userId);
  }

  async start(stepId: string, auditId: string, userId: string) {
    const { audit } = await this.loadAudit(stepId, auditId, userId);
    if (audit.status !== 'PLANNED') throw new BadRequestException('The audit has already started');
    await this.prisma.internalAudit.update({ where: { id: auditId }, data: { status: 'IN_PROGRESS' } });
    await this.log(userId, auditId, { action: 'start_audit' });
    return this.get(stepId, userId);
  }

  /** Records a checklist result; a nonconformity finding is added to the Nonconformity register. */
  async updateItem(stepId: string, auditId: string, itemId: string, dto: UpdateAuditItemDto, userId: string) {
    const { access, audit } = await this.loadAudit(stepId, auditId, userId);
    if (audit.status === 'PLANNED') throw new BadRequestException('Start the audit first');
    if (audit.status === 'APPROVED') throw new BadRequestException('An approved audit cannot be changed');
    const item = audit.items.find(i => i.id === itemId);
    if (!item) throw new NotFoundException('Checklist item not found');

    const result = dto.result !== undefined ? dto.result : item.result;
    const evidence = dto.evidence !== undefined ? dto.evidence.trim() || null : item.evidence;
    if ((isNonconformity(result) || result === 'OBSERVATION') && !evidence) {
      throw new BadRequestException('Describe the evidence for a nonconformity or an observation');
    }

    await this.prisma.auditChecklistItem.update({ where: { id: itemId }, data: { result, evidence } });

    if (isNonconformity(result) && !item.nonconformity) {
      await this.improvement.createNonconformityRecord(access, {
        title: `${RESULT_LABELS[result!]} — ${item.ref} ${item.requirement}`.slice(0, 300),
        description: `Internal audit "${audit.title}": ${evidence}`,
        source: FindingSource.INTERNAL_AUDIT,
        detected_on: new Date(),
        responsible_id: null,
        audit_item_id: item.id,
      });
    } else if (!isNonconformity(result) && item.nonconformity && item.nonconformity.status === 'UNASSIGNED') {
      // The finding was withdrawn before anyone worked on it.
      await this.prisma.nonconformity.update({
        where: { id: item.nonconformity.id },
        data: { status: 'NOT_RELEVANT', not_relevant_reason: 'The internal audit finding was changed to a non-nonconformity result.', closed_at: new Date(), audit_item_id: null },
      });
    }
    // Reporting again is required after a change.
    if (audit.status === 'REPORTED') await this.prisma.internalAudit.update({ where: { id: auditId }, data: { status: 'IN_PROGRESS' } });
    await this.log(userId, auditId, { action: 'checklist_result', ref: item.ref, result });
    return this.get(stepId, userId);
  }

  /** Lead auditor reports the audit (clause 9.2.2: results reported to management). */
  async report(stepId: string, auditId: string, dto: AuditReportDto, userId: string) {
    const { audit } = await this.loadAudit(stepId, auditId, userId);
    if (audit.status !== 'IN_PROGRESS') throw new BadRequestException('Only an audit in progress can be reported');
    const open = audit.items.filter(i => !i.result).length;
    if (open > 0) throw new BadRequestException(`${open} checklist item(s) have no result yet`);
    await this.prisma.internalAudit.update({ where: { id: auditId }, data: { status: 'REPORTED', conclusion: dto.conclusion.trim() } });
    if (audit.task_id) {
      await this.prisma.taskAssignment.updateMany({ where: { id: audit.task_id, status: { not: 'COMPLETED' } }, data: { status: 'COMPLETED', completed_at: new Date() } });
    }
    await this.log(userId, auditId, { action: 'report_audit' });
    return this.get(stepId, userId);
  }

  async approve(stepId: string, auditId: string, userId: string) {
    const { access, audit } = await this.loadAudit(stepId, auditId, userId);
    this.access.assertDecide(access);
    if (audit.status !== 'REPORTED') throw new BadRequestException('The audit must be reported before its report is approved');
    await this.prisma.internalAudit.update({ where: { id: auditId }, data: { status: 'APPROVED', approved_by: userId, approved_at: new Date() } });
    await this.log(userId, auditId, { action: 'approve_audit_report' });
    return this.get(stepId, userId);
  }

  async remove(stepId: string, auditId: string, userId: string) {
    const { audit } = await this.loadAudit(stepId, auditId, userId);
    if (audit.status !== 'PLANNED') throw new BadRequestException('Only a planned audit that has not started can be deleted');
    await this.prisma.internalAudit.delete({ where: { id: auditId } });
    await this.log(userId, auditId, { action: 'delete_audit', title: audit.title });
    return this.get(stepId, userId);
  }

  async createDocument(stepId: string, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.INTERNAL_AUDIT);
    this.access.assertEdit(access);
    const [audits, members, project] = await Promise.all([
      this.prisma.internalAudit.findMany({
        where: { project_id: access.projectId, status: { in: ['REPORTED', 'APPROVED'] } },
        include: AUDIT_INCLUDE,
        orderBy: { start_date: 'asc' },
      }),
      this.access.members(access.projectId),
      this.prisma.complianceProject.findUnique({ where: { id: access.projectId }, select: { organization: { select: { name: true } } } }),
    ]);
    if (audits.length === 0) throw new BadRequestException('Report at least one audit first');
    const name = (id: string | null) => members.find(m => m.id === id)?.label ?? '—';

    const content: ProseMirrorNode[] = [
      heading(1, 'Internal Audit Report'),
      paragraph(text(`Organization: ${project?.organization?.name ?? 'Organization'}`)),
      paragraph(text(`Date: ${formatDate(new Date())}`)),
    ];
    audits.forEach((a, n) => {
      const findings = a.items.filter(i => i.result && i.result !== 'CONFORMING' && i.result !== 'NOT_AUDITED');
      const count = (r: AuditResult) => a.items.filter(i => i.result === r).length;
      content.push(
        heading(2, `${n + 1}. ${a.title}`),
        table([
          [[text('Audit period')], [text(`${formatDate(a.start_date)} – ${formatDate(a.end_date)}`)]],
          [[text('Lead auditor')], [text(name(a.lead_auditor_id))]],
          [[text('Auditees')], [text(a.auditees || '—')]],
          [[text('Scope')], [text(a.scope)]],
          [[text('Criteria')], [text(a.criteria)]],
          [[text('Report approved by')], [text(a.approved_by ? `${name(a.approved_by)} (${formatDate(a.approved_at)})` : 'Pending approval')]],
        ]),
        heading(3, 'Summary of results'),
        bulletList([
          [text(`${a.items.length} requirements and controls in the checklist`)],
          [text(`${count('CONFORMING')} conforming`)],
          [text(`${count('MAJOR_NONCONFORMITY')} major and ${count('MINOR_NONCONFORMITY')} minor nonconformities`)],
          [text(`${count('OBSERVATION')} observations / opportunities for improvement`)],
          [text(`${count('NOT_AUDITED')} not audited`)],
        ]),
        heading(3, 'Findings'),
        ...(findings.length > 0
          ? [table([
              ['Ref', 'Requirement', 'Finding', 'Evidence', 'Nonconformity'].map(h => [text(h)]),
              ...findings.map(i => [
                [text(i.ref)], [text(i.requirement)], [text(RESULT_LABELS[i.result!])], [text(i.evidence || '—')],
                [text(i.nonconformity ? `NC-${String(i.nonconformity.number).padStart(3, '0')}` : '—')],
              ]),
            ])]
          : [paragraph(text('No nonconformities or observations were found.'))]),
        heading(3, 'Conclusion'),
        paragraph(text(a.conclusion || '—')),
      );
    });

    await this.documents.upsert({
      stepId,
      templateCode: 'INTERNAL-AUDIT-REPORT',
      templateName: 'Internal Audit Report',
      templateDescription: 'Results of internal audits of the ISMS (ISO/IEC 27001 clause 9.2).',
      title: 'Internal Audit Report',
      content: { type: 'doc', content },
      userId,
    });
    return this.get(stepId, userId);
  }

  async getCompletion(stepId: string) {
    const step = await this.prisma.projectStep.findUnique({ where: { id: stepId }, select: { phase: { select: { project_id: true } } } });
    if (!step) throw new NotFoundException('Step not found');
    const audits = await this.prisma.internalAudit.findMany({
      where: { project_id: step.phase.project_id },
      select: { status: true, updated_at: true, items: { select: { updated_at: true } } },
    });
    const approved = audits.filter(a => a.status === 'APPROVED').length;
    const doc = await this.documents.status(stepId, latest(audits.flatMap(a => [a.updated_at, ...a.items.map(i => i.updated_at)])));
    return checklist([
      { key: 'scheduled', label: 'An internal audit is scheduled', done: audits.length > 0, detail: 'No audit scheduled' },
      { key: 'approved', label: 'At least one audit is performed, reported and its report approved', done: approved > 0, detail: 'No approved audit report yet' },
      { key: 'document', label: 'The Internal Audit Report is generated and up to date', done: doc.upToDate, detail: doc.exists ? 'The audit changed; refresh the report' : 'Report not generated yet' },
    ]);
  }

  private async loadAudit(stepId: string, auditId: string, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.INTERNAL_AUDIT);
    this.access.assertEdit(access);
    const audit = await this.prisma.internalAudit.findFirst({ where: { id: auditId, project_id: access.projectId }, include: AUDIT_INCLUDE });
    if (!audit) throw new NotFoundException('Audit not found');
    return { access, audit };
  }

  private async log(userId: string, auditId: string, details: Record<string, unknown>) {
    await this.auditLog.log({ userId, action: AuditAction.DOCUMENT_UPDATED, entityType: 'internal_audit', entityId: auditId, details: details as never });
  }
}
