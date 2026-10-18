import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, ReviewFrequency } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { ProjectAccessService } from '../common/services/project-access.service';
import { StepDocumentService, formatDate, latest } from '../common/services/step-document.service';
import { heading, paragraph, table, text, ProseMirrorNode } from '../documents/templates/doc-control.template';
import { MeasurementDto, ObjectiveDto, UpdateObjectiveDto } from './dto/audit-prep.dto';
import { FREQUENCY_LABELS, P4, checklist } from './keys';

/** Conformio pre-populates every project with these 8 top-level objectives. */
const DEFAULT_OBJECTIVES = (targetDate: Date | null): { title: string; measurement: string; frequency: ReviewFrequency }[] => [
  { title: 'Decrease the number of incidents by 10 %', measurement: 'Number of incidents in the Incident register, compared with the previous year', frequency: 'YEARLY' },
  { title: 'Increase the revenue by 5 % as a result of ISO 27001 implementation/certification', measurement: 'Revenue from customers that required ISO 27001, compared with the previous year', frequency: 'YEARLY' },
  { title: 'Decrease the costs of complying with information security & privacy regulations by 50 % because of ISO 27001 implementation', measurement: 'Compliance costs (audits, fines, consultants), compared with the previous year', frequency: 'YEARLY' },
  { title: 'Increase customer satisfaction by 10 % because of stable information systems', measurement: 'Customer satisfaction survey score, compared with the previous year', frequency: 'YEARLY' },
  {
    title: targetDate
      ? `Finish the ISO 27001 implementation project by ${formatDate(targetDate)}`
      : 'Finish the ISO 27001 implementation project in 3 months',
    measurement: 'Date of the successful certification audit compared with the planned date',
    frequency: 'YEARLY',
  },
  { title: '95 % of the resources were available for running the project', measurement: 'Approved resources compared with the resources requested in the Risk Treatment Plan', frequency: 'MONTHLY' },
  { title: 'On a scale from 1 to 5, we want to achieve 4.5 on how much security is adapted to existing processes in the company', measurement: 'Employee survey, scale 1 to 5', frequency: 'YEARLY' },
  { title: 'On a scale from 1 to 5, we want to achieve 4.5 for clarity and level of implementation of security documents', measurement: 'Employee survey, scale 1 to 5', frequency: 'YEARLY' },
];

/** Clauses 6.2 / 9.1: information security objectives. */
@Injectable()
export class ObjectivesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly access: ProjectAccessService,
    private readonly documents: StepDocumentService,
  ) {}

  async get(stepId: string, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.OBJECTIVES);
    await this.seedDefaults(access.projectId, access.canEdit);
    const [objectives, members, documents, completion] = await Promise.all([
      this.prisma.securityObjective.findMany({
        where: { project_id: access.projectId },
        include: { measurements: { orderBy: { measured_on: 'desc' } } },
        orderBy: { order: 'asc' },
      }),
      this.access.members(access.projectId),
      this.documents.list(stepId),
      this.getCompletion(stepId),
    ]);
    return {
      objectives,
      members,
      counters: {
        approved: objectives.filter(o => o.status === 'APPROVED').length,
        awaiting: objectives.filter(o => o.status === 'DRAFT').length,
      },
      documents,
      completion,
      permissions: { canEdit: access.canEdit, canDecide: access.canDecide, userId },
    };
  }

  private async seedDefaults(projectId: string, canEdit: boolean) {
    if (!canEdit) return;
    const count = await this.prisma.securityObjective.count({ where: { project_id: projectId } });
    if (count > 0) return;
    const [project, lead] = await Promise.all([
      this.prisma.complianceProject.findUnique({ where: { id: projectId }, select: { target_date: true } }),
      this.prisma.projectMember.findFirst({ where: { project_id: projectId, privilege: 'PROJECT_LEAD' }, orderBy: { joined_at: 'asc' }, select: { user_id: true } }),
    ]);
    await this.prisma.securityObjective.createMany({
      data: DEFAULT_OBJECTIVES(project?.target_date ?? null).map((o, i) => ({
        project_id: projectId,
        order: i + 1,
        title: o.title,
        measurement: o.measurement,
        frequency: o.frequency,
        responsible_id: lead?.user_id ?? null,
      })),
    });
  }

  async create(stepId: string, dto: ObjectiveDto, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.OBJECTIVES);
    this.access.assertEdit(access);
    await this.access.assertMembers(access.projectId, [dto.responsible_id]);
    const last = await this.prisma.securityObjective.aggregate({ where: { project_id: access.projectId }, _max: { order: true } });
    await this.prisma.securityObjective.create({
      data: {
        project_id: access.projectId,
        order: (last._max.order ?? 0) + 1,
        title: dto.title.trim(),
        type: dto.type,
        action_plan: dto.action_plan?.trim() || null,
        resources: dto.resources?.trim() || null,
        responsible_id: dto.responsible_id ?? null,
        due_date: dto.due_date ? new Date(dto.due_date) : null,
        measurement: dto.measurement?.trim() || null,
        frequency: dto.frequency,
      },
    });
    await this.log(userId, access.projectId, { action: 'create_objective' });
    return this.get(stepId, userId);
  }

  async update(stepId: string, id: string, dto: UpdateObjectiveDto, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.OBJECTIVES);
    this.access.assertEdit(access);
    const objective = await this.prisma.securityObjective.findFirst({ where: { id, project_id: access.projectId } });
    if (!objective) throw new NotFoundException('Objective not found');
    await this.access.assertMembers(access.projectId, [dto.responsible_id]);
    await this.prisma.securityObjective.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.action_plan !== undefined && { action_plan: dto.action_plan.trim() || null }),
        ...(dto.resources !== undefined && { resources: dto.resources.trim() || null }),
        ...(dto.responsible_id !== undefined && { responsible_id: dto.responsible_id }),
        ...(dto.due_date !== undefined && { due_date: dto.due_date ? new Date(dto.due_date) : null }),
        ...(dto.measurement !== undefined && { measurement: dto.measurement.trim() || null }),
        ...(dto.frequency !== undefined && { frequency: dto.frequency }),
        // A changed objective must be approved again by top management.
        status: 'DRAFT',
        approved_by: null,
        approved_at: null,
      },
    });
    await this.log(userId, access.projectId, { action: 'update_objective', objective: id, fields: Object.keys(dto) });
    return this.get(stepId, userId);
  }

  async remove(stepId: string, id: string, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.OBJECTIVES);
    this.access.assertEdit(access);
    const objective = await this.prisma.securityObjective.findFirst({
      where: { id, project_id: access.projectId },
      include: { _count: { select: { measurements: true } } },
    });
    if (!objective) throw new NotFoundException('Objective not found');
    if (objective._count.measurements > 0) throw new BadRequestException('An objective with measurements is a record and cannot be deleted');
    await this.prisma.securityObjective.delete({ where: { id } });
    await this.log(userId, access.projectId, { action: 'delete_objective', title: objective.title });
    return this.get(stepId, userId);
  }

  /** Conformio "Confirm objectives": top management approves every complete draft objective. */
  async confirm(stepId: string, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.OBJECTIVES);
    this.access.assertDecide(access);
    const drafts = await this.prisma.securityObjective.findMany({ where: { project_id: access.projectId, status: 'DRAFT' } });
    if (drafts.length === 0) throw new BadRequestException('There are no objectives awaiting approval');
    const incomplete = drafts.filter(o => !o.responsible_id || !o.measurement);
    if (incomplete.length > 0) {
      throw new BadRequestException(`${incomplete.length} objective(s) need a responsible person and a measurement method before approval (clause 6.2)`);
    }
    await this.prisma.securityObjective.updateMany({
      where: { id: { in: drafts.map(o => o.id) } },
      data: { status: 'APPROVED', approved_by: userId, approved_at: new Date() },
    });
    await this.log(userId, access.projectId, { action: 'confirm_objectives', count: drafts.length });
    return this.get(stepId, userId);
  }

  /** Clause 9.1: record a measurement of an objective. */
  async addMeasurement(stepId: string, id: string, dto: MeasurementDto, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.OBJECTIVES);
    this.access.assertEdit(access);
    const objective = await this.prisma.securityObjective.findFirst({ where: { id, project_id: access.projectId } });
    if (!objective) throw new NotFoundException('Objective not found');
    if (objective.status !== 'APPROVED') throw new BadRequestException('Only approved objectives are measured');
    await this.prisma.objectiveMeasurement.create({
      data: {
        objective_id: id,
        measured_on: new Date(dto.measured_on),
        result: dto.result.trim(),
        achieved: dto.achieved,
        comment: dto.comment?.trim() || null,
        recorded_by: userId,
      },
    });
    await this.prisma.securityObjective.update({ where: { id }, data: { updated_at: new Date() } });
    await this.log(userId, access.projectId, { action: 'measure_objective', objective: id, achieved: dto.achieved });
    return this.get(stepId, userId);
  }

  async createDocument(stepId: string, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.OBJECTIVES);
    this.access.assertEdit(access);
    const [objectives, members, project] = await Promise.all([
      this.prisma.securityObjective.findMany({
        where: { project_id: access.projectId },
        include: { measurements: { orderBy: { measured_on: 'desc' } } },
        orderBy: { order: 'asc' },
      }),
      this.access.members(access.projectId),
      this.prisma.complianceProject.findUnique({ where: { id: access.projectId }, select: { organization: { select: { name: true } } } }),
    ]);
    if (objectives.length === 0) throw new BadRequestException('Add at least one objective first');
    const name = (id: string | null) => members.find(m => m.id === id)?.label ?? '—';

    const content: ProseMirrorNode = {
      type: 'doc',
      content: [
        heading(1, 'List of Security Objectives and Fulfilment Report'),
        paragraph(text(`Organization: ${project?.organization?.name ?? 'Organization'}`)),
        paragraph(text(`Date: ${formatDate(new Date())}`)),
        paragraph(text('Information security objectives established by top management (ISO/IEC 27001 clause 6.2), and the results of their measurement (clause 9.1).')),
        heading(2, '1. Security objectives'),
        table([
          ['#', 'Objective', 'What will be done', 'Resources', 'Responsible', 'Due', 'Measurement', 'Frequency', 'Status'].map(h => [text(h)]),
          ...objectives.map((o, i) => [
            [text(String(i + 1))],
            [text(o.title)],
            [text(o.action_plan || '—')],
            [text(o.resources || '—')],
            [text(name(o.responsible_id))],
            [text(formatDate(o.due_date))],
            [text(o.measurement || '—')],
            [text(FREQUENCY_LABELS[o.frequency])],
            [text(o.status === 'APPROVED' ? `Approved by ${name(o.approved_by)} (${formatDate(o.approved_at)})` : 'Draft')],
          ]),
        ]),
        heading(2, '2. Fulfilment report'),
        ...(objectives.some(o => o.measurements.length > 0)
          ? [table([
              ['Objective', 'Measured on', 'Result', 'Achieved', 'Comment'].map(h => [text(h)]),
              ...objectives.flatMap(o => o.measurements.map(m => [
                [text(o.title)], [text(formatDate(m.measured_on))], [text(m.result)], [text(m.achieved ? 'Yes' : 'No')], [text(m.comment || '—')],
              ])),
            ])]
          : [paragraph(text('No measurement has been recorded yet. Objectives are measured with the frequency defined above and reported to the management review.'))]),
      ],
    };
    await this.documents.upsert({
      stepId,
      templateCode: 'SECURITY-OBJECTIVES',
      templateName: 'List of Security Objectives and Fulfilment Report',
      templateDescription: 'Information security objectives and their measurement (ISO/IEC 27001 clauses 6.2 and 9.1).',
      title: 'List of Security Objectives and Fulfilment Report',
      content,
      userId,
    });
    return this.get(stepId, userId);
  }

  async getCompletion(stepId: string) {
    const step = await this.prisma.projectStep.findUnique({ where: { id: stepId }, select: { phase: { select: { project_id: true } } } });
    if (!step) throw new NotFoundException('Step not found');
    const objectives = await this.prisma.securityObjective.findMany({
      where: { project_id: step.phase.project_id },
      select: { status: true, responsible_id: true, measurement: true, updated_at: true },
    });
    const doc = await this.documents.status(stepId, latest(objectives.map(o => o.updated_at)));
    const drafts = objectives.filter(o => o.status === 'DRAFT').length;
    const incomplete = objectives.filter(o => !o.responsible_id || !o.measurement).length;
    return checklist([
      { key: 'objectives', label: 'At least one security objective is defined', done: objectives.length > 0, detail: 'No objectives' },
      { key: 'complete', label: 'Every objective has a responsible person and a measurement method', done: objectives.length > 0 && incomplete === 0, detail: `${incomplete} objective(s) incomplete` },
      { key: 'approved', label: 'Top management approved the objectives', done: objectives.length > 0 && drafts === 0, detail: `${drafts} objective(s) awaiting approval` },
      { key: 'document', label: 'The List of Security Objectives is generated and up to date', done: doc.upToDate, detail: doc.exists ? 'Objectives changed; refresh the document' : 'Document not generated yet' },
    ]);
  }

  private async log(userId: string, projectId: string, details: Record<string, unknown>) {
    await this.auditLog.log({ userId, action: AuditAction.DOCUMENT_UPDATED, entityType: 'security_objectives', entityId: projectId, details: details as Prisma.InputJsonValue as never });
  }
}
