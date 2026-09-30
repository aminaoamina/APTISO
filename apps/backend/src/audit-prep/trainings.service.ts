import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, TrainingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { ProjectAccessService } from '../common/services/project-access.service';
import { StepDocumentService, formatDate, latest } from '../common/services/step-document.service';
import { heading, paragraph, table, text, ProseMirrorNode } from '../documents/templates/doc-control.template';
import { CreateTrainingDto, UpdateTrainingDto } from './dto/audit-prep.dto';
import { P4, checklist } from './keys';

type StepTrainingRow = { user_id: string; skills: string; training?: string };

export const TRAINING_STATUS_LABELS: Record<TrainingStatus, string> = {
  PROPOSED: 'Proposed',
  APPROVED: 'Approved',
  SCHEDULED: 'Scheduled',
  PERFORMED: 'Performed',
  CANCELLED: 'Cancelled',
};

/** Clause 7.2 / A.6.3: Training Plan and Record. */
@Injectable()
export class TrainingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly access: ProjectAccessService,
    private readonly documents: StepDocumentService,
  ) {}

  async get(stepId: string, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.TRAINING_PLAN);
    const [trainings, members, needs, documents, completion] = await Promise.all([
      this.prisma.training.findMany({ where: { project_id: access.projectId }, orderBy: { created_at: 'asc' } }),
      this.access.members(access.projectId),
      this.pendingNeeds(access.projectId),
      this.documents.list(stepId),
      this.getCompletion(stepId),
    ]);
    const count = (s: TrainingStatus) => trainings.filter(t => t.status === s).length;
    return {
      trainings,
      members,
      pendingNeeds: needs,
      counters: { approved: count('APPROVED'), scheduled: count('SCHEDULED'), performed: count('PERFORMED'), proposed: count('PROPOSED') },
      documents,
      completion,
      permissions: { canEdit: access.canEdit, canDecide: access.canDecide, userId },
    };
  }

  /** Training needs entered in the steps' Training panels that are not in the plan yet. */
  private async pendingNeeds(projectId: string) {
    const [steps, existing] = await Promise.all([
      this.prisma.projectStep.findMany({
        where: { phase: { project_id: projectId } },
        select: { id: true, title: true, completion_data: true },
      }),
      this.prisma.training.findMany({ where: { project_id: projectId, source_key: { not: null } }, select: { source_key: true } }),
    ]);
    const imported = new Set(existing.map(t => t.source_key));
    const needs: { source_key: string; step_id: string; step_title: string; row: StepTrainingRow }[] = [];
    for (const step of steps) {
      const data = (step.completion_data ?? {}) as { training?: { rows?: StepTrainingRow[] } };
      (data.training?.rows ?? []).forEach((row, i) => {
        const key = `${step.id}:${i}`;
        if (!imported.has(key)) needs.push({ source_key: key, step_id: step.id, step_title: step.title, row });
      });
    }
    return needs;
  }

  async importNeeds(stepId: string, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.TRAINING_PLAN);
    this.access.assertEdit(access);
    const needs = await this.pendingNeeds(access.projectId);
    await this.prisma.training.createMany({
      data: needs.map(n => ({
        project_id: access.projectId,
        title: (n.row.training?.trim() || n.row.skills).slice(0, 300),
        skills: n.row.skills,
        participant_ids: [n.row.user_id],
        source_step_id: n.step_id,
        source_key: n.source_key,
        created_by: userId,
      })),
      skipDuplicates: true,
    });
    await this.log(userId, access.projectId, { action: 'import_training_needs', count: needs.length });
    return this.get(stepId, userId);
  }

  async create(stepId: string, dto: CreateTrainingDto, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.TRAINING_PLAN);
    this.access.assertEdit(access);
    await this.access.assertMembers(access.projectId, dto.participant_ids);
    await this.prisma.training.create({
      data: {
        project_id: access.projectId,
        title: dto.title.trim(),
        skills: dto.skills.trim(),
        participant_ids: [...new Set(dto.participant_ids)],
        method: dto.method?.trim() || null,
        provider: dto.provider?.trim() || null,
        planned_date: dto.planned_date ? new Date(dto.planned_date) : null,
        created_by: userId,
      },
    });
    await this.log(userId, access.projectId, { action: 'create_training', title: dto.title });
    return this.get(stepId, userId);
  }

  async update(stepId: string, trainingId: string, dto: UpdateTrainingDto, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.TRAINING_PLAN);
    this.access.assertEdit(access);
    const training = await this.prisma.training.findFirst({ where: { id: trainingId, project_id: access.projectId } });
    if (!training) throw new NotFoundException('Training not found');
    if (dto.participant_ids) await this.access.assertMembers(access.projectId, dto.participant_ids);

    const next = {
      planned_date: dto.planned_date !== undefined ? dto.planned_date : training.planned_date,
      performed_date: dto.performed_date !== undefined ? dto.performed_date : training.performed_date,
      evidence: dto.evidence !== undefined ? dto.evidence.trim() : training.evidence,
    };
    if (dto.status && dto.status !== training.status) {
      if (dto.status === 'APPROVED' || (training.status === 'PROPOSED' && dto.status !== 'CANCELLED')) {
        throw new BadRequestException('Use "Approve" — trainings are approved by top management');
      }
      if (dto.status === 'SCHEDULED' && !next.planned_date) throw new BadRequestException('Set the planned date before scheduling');
      if (dto.status === 'PERFORMED' && (!next.performed_date || !next.evidence)) {
        throw new BadRequestException('Record the date performed and the evidence (attendance list, certificates) first');
      }
    }

    // Changing what is trained after approval requires a new approval.
    const contentChanged = dto.title !== undefined || dto.skills !== undefined || dto.participant_ids !== undefined;
    const reApprove = contentChanged && training.status === 'APPROVED';
    await this.prisma.training.update({
      where: { id: trainingId },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.skills !== undefined && { skills: dto.skills.trim() }),
        ...(dto.participant_ids !== undefined && { participant_ids: [...new Set(dto.participant_ids)] }),
        ...(dto.method !== undefined && { method: dto.method.trim() || null }),
        ...(dto.provider !== undefined && { provider: dto.provider.trim() || null }),
        ...(dto.planned_date !== undefined && { planned_date: dto.planned_date ? new Date(dto.planned_date) : null }),
        ...(dto.performed_date !== undefined && { performed_date: dto.performed_date ? new Date(dto.performed_date) : null }),
        ...(dto.evidence !== undefined && { evidence: dto.evidence.trim() || null }),
        ...(dto.effectiveness !== undefined && { effectiveness: dto.effectiveness.trim() || null }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(reApprove && { status: 'PROPOSED', approved_by: null, approved_at: null }),
      },
    });
    await this.log(userId, access.projectId, { action: 'update_training', training: trainingId, fields: Object.keys(dto) });
    return this.get(stepId, userId);
  }

  async approve(stepId: string, trainingId: string, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.TRAINING_PLAN);
    this.access.assertDecide(access);
    const training = await this.prisma.training.findFirst({ where: { id: trainingId, project_id: access.projectId } });
    if (!training) throw new NotFoundException('Training not found');
    if (training.status !== 'PROPOSED') throw new BadRequestException('Only proposed trainings can be approved');
    await this.prisma.training.update({
      where: { id: trainingId },
      data: { status: 'APPROVED', approved_by: userId, approved_at: new Date() },
    });
    await this.log(userId, access.projectId, { action: 'approve_training', training: trainingId });
    return this.get(stepId, userId);
  }

  async remove(stepId: string, trainingId: string, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.TRAINING_PLAN);
    this.access.assertEdit(access);
    const training = await this.prisma.training.findFirst({ where: { id: trainingId, project_id: access.projectId } });
    if (!training) throw new NotFoundException('Training not found');
    if (training.status === 'PERFORMED') throw new BadRequestException('A performed training is a record and cannot be deleted');
    await this.prisma.training.delete({ where: { id: trainingId } });
    await this.log(userId, access.projectId, { action: 'delete_training', title: training.title });
    return this.get(stepId, userId);
  }

  async createDocument(stepId: string, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.TRAINING_PLAN);
    this.access.assertEdit(access);
    const [trainings, members, project] = await Promise.all([
      this.prisma.training.findMany({ where: { project_id: access.projectId, status: { not: 'CANCELLED' } }, orderBy: { planned_date: 'asc' } }),
      this.access.members(access.projectId),
      this.prisma.complianceProject.findUnique({ where: { id: access.projectId }, select: { organization: { select: { name: true } } } }),
    ]);
    if (trainings.length === 0) throw new BadRequestException('Add at least one training first');
    const name = (id: string | null) => members.find(m => m.id === id)?.label ?? '—';

    const content: ProseMirrorNode = {
      type: 'doc',
      content: [
        heading(1, 'Training Plan and Record'),
        paragraph(text(`Organization: ${project?.organization?.name ?? 'Organization'}`)),
        paragraph(text(`Date: ${formatDate(new Date())}`)),
        paragraph(text('This document is both the plan of information security trainings and the record of trainings performed, as evidence of competence (ISO/IEC 27001 clause 7.2 and control A.6.3).')),
        heading(2, '1. Training plan and record'),
        table([
          ['Training', 'Knowledge and skills', 'Participants', 'Method / provider', 'Planned', 'Performed', 'Status', 'Approved by'].map(h => [text(h)]),
          ...trainings.map(t => [
            [text(t.title)],
            [text(t.skills)],
            [text((t.participant_ids as string[]).map(name).join(', ') || '—')],
            [text([t.method, t.provider].filter(Boolean).join(' / ') || '—')],
            [text(formatDate(t.planned_date))],
            [text(formatDate(t.performed_date))],
            [text(TRAINING_STATUS_LABELS[t.status])],
            [text(t.approved_by ? `${name(t.approved_by)} (${formatDate(t.approved_at)})` : '—')],
          ]),
        ]),
        heading(2, '2. Evidence and effectiveness of performed trainings'),
        ...(trainings.some(t => t.status === 'PERFORMED')
          ? [table([
              ['Training', 'Evidence', 'Effectiveness evaluation'].map(h => [text(h)]),
              ...trainings.filter(t => t.status === 'PERFORMED').map(t => [
                [text(t.title)], [text(t.evidence || '—')], [text(t.effectiveness || 'Not evaluated yet')],
              ]),
            ])]
          : [paragraph(text('No training has been performed yet.'))]),
      ],
    };
    await this.documents.upsert({
      stepId,
      templateCode: 'TRAINING-PLAN',
      templateName: 'Training Plan and Record',
      templateDescription: 'Plan and record of information security trainings (ISO/IEC 27001 clause 7.2, control A.6.3).',
      title: 'Training Plan and Record',
      content,
      userId,
    });
    return this.get(stepId, userId);
  }

  async getCompletion(stepId: string) {
    const step = await this.prisma.projectStep.findUnique({ where: { id: stepId }, select: { phase: { select: { project_id: true } } } });
    if (!step) throw new NotFoundException('Step not found');
    const projectId = step.phase.project_id;
    const [trainings, needs] = await Promise.all([
      this.prisma.training.findMany({ where: { project_id: projectId, status: { not: 'CANCELLED' } }, select: { status: true, updated_at: true } }),
      this.pendingNeeds(projectId),
    ]);
    const doc = await this.documents.status(stepId, latest(trainings.map(t => t.updated_at)));
    const proposed = trainings.filter(t => t.status === 'PROPOSED').length;
    return checklist([
      { key: 'needs', label: 'Training needs from all steps are in the plan', done: needs.length === 0, detail: `${needs.length} need(s) not imported` },
      { key: 'trainings', label: 'The plan contains at least one training', done: trainings.length > 0, detail: 'No training planned' },
      { key: 'approved', label: 'Top management approved every training', done: trainings.length > 0 && proposed === 0, detail: `${proposed} training(s) awaiting approval` },
      { key: 'document', label: 'The Training Plan and Record is generated and up to date', done: doc.upToDate, detail: doc.exists ? 'Trainings changed; refresh the document' : 'Document not generated yet' },
    ]);
  }

  private async log(userId: string, projectId: string, details: Record<string, unknown>) {
    await this.auditLog.log({ userId, action: AuditAction.DOCUMENT_UPDATED, entityType: 'training_plan', entityId: projectId, details: details as Prisma.InputJsonValue as never });
  }
}
