import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActionStatus,
  AuditAction,
  FindingSource,
  IncidentStatus,
  NonconformityStatus,
  Prisma,
  TaskType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { TasksService } from '../tasks/tasks.service';
import { ProjectAccess, ProjectAccessService } from '../common/services/project-access.service';
import {
  CreateActionDto,
  CreateIncidentDto,
  CreateNonconformityDto,
  NotRelevantDto,
  ResolveNonconformityDto,
  UpdateActionDto,
  UpdateIncidentDto,
  UpdateNonconformityDto,
} from './dto/improvement.dto';

const NC_INCLUDE = { actions: { orderBy: { created_at: 'asc' } } } satisfies Prisma.NonconformityInclude;

/**
 * Clause 10.2 lifecycle, with Conformio's states:
 * UNASSIGNED -> ASSIGNED (responsible set) -> ACTIONS_DEFINED (correction,
 * root cause and corrective actions recorded) -> RESOLVED (actions done and
 * effectiveness reviewed); NOT_RELEVANT dismisses it with a reason.
 */
export function deriveNonconformityStatus(nc: {
  status: NonconformityStatus;
  responsible_id: string | null;
  correction: string | null;
  root_cause: string | null;
  actionCount: number;
}): NonconformityStatus {
  if (nc.status === 'RESOLVED' || nc.status === 'NOT_RELEVANT') return nc.status;
  if (!nc.responsible_id) return 'UNASSIGNED';
  if (nc.correction && nc.root_cause && nc.actionCount > 0) return 'ACTIONS_DEFINED';
  return 'ASSIGNED';
}

@Injectable()
export class ImprovementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly tasks: TasksService,
    private readonly access: ProjectAccessService,
  ) {}

  // ─── Read ──────────────────────────────────────────────────────

  async getRegisters(projectId: string, userId: string) {
    const access = await this.access.forProject(projectId, userId);
    const [nonconformities, incidents, members] = await Promise.all([
      this.prisma.nonconformity.findMany({
        where: { project_id: projectId },
        include: { ...NC_INCLUDE, audit_item: { select: { ref: true, audit: { select: { title: true } } } }, incident: { select: { number: true, title: true } } },
        orderBy: { number: 'desc' },
      }),
      this.prisma.incident.findMany({
        where: { project_id: projectId },
        include: { nonconformities: { select: { id: true, number: true } } },
        orderBy: { number: 'desc' },
      }),
      this.access.members(projectId),
    ]);
    return {
      nonconformities,
      incidents,
      members,
      summary: await this.summary(projectId),
      permissions: { canEdit: access.canEdit, canDecide: access.canDecide, userId },
    };
  }

  /** Counts used by the registers page and the management review inputs. */
  async summary(projectId: string) {
    const [ncs, actions, incidents] = await Promise.all([
      this.prisma.nonconformity.groupBy({ by: ['status'], where: { project_id: projectId }, _count: true }),
      this.prisma.correctiveAction.groupBy({ by: ['status'], where: { nonconformity: { project_id: projectId } }, _count: true }),
      this.prisma.incident.findMany({ where: { project_id: projectId }, select: { status: true, is_security_incident: true } }),
    ]);
    const nc = Object.fromEntries(ncs.map(g => [g.status, g._count])) as Partial<Record<NonconformityStatus, number>>;
    const ca = Object.fromEntries(actions.map(g => [g.status, g._count])) as Partial<Record<ActionStatus, number>>;
    return {
      nonconformities: {
        total: ncs.reduce((n, g) => n + g._count, 0),
        open: (nc.UNASSIGNED ?? 0) + (nc.ASSIGNED ?? 0) + (nc.ACTIONS_DEFINED ?? 0),
        resolved: nc.RESOLVED ?? 0,
        notRelevant: nc.NOT_RELEVANT ?? 0,
      },
      correctiveActions: { total: actions.reduce((n, g) => n + g._count, 0), done: ca.DONE ?? 0 },
      incidents: {
        total: incidents.length,
        security: incidents.filter(i => i.is_security_incident).length,
        open: incidents.filter(i => i.status !== 'CLOSED').length,
      },
    };
  }

  // ─── Nonconformities ───────────────────────────────────────────

  async createNonconformity(projectId: string, dto: CreateNonconformityDto, userId: string) {
    const access = await this.access.forProject(projectId, userId);
    this.access.assertEdit(access);
    await this.access.assertMembers(projectId, [dto.responsible_id]);
    await this.createNonconformityRecord(access, {
      title: dto.title,
      description: dto.description,
      source: dto.source ?? FindingSource.OTHER,
      detected_on: new Date(dto.detected_on),
      responsible_id: dto.responsible_id ?? null,
    });
    return this.getRegisters(projectId, userId);
  }

  /** Used by this service, the internal audit and the incident register. */
  async createNonconformityRecord(
    access: ProjectAccess,
    data: {
      title: string;
      description: string;
      source: FindingSource;
      detected_on: Date;
      responsible_id: string | null;
      audit_item_id?: string;
      incident_id?: string;
    },
  ) {
    for (let attempt = 0; ; attempt++) {
      const last = await this.prisma.nonconformity.aggregate({ where: { project_id: access.projectId }, _max: { number: true } });
      try {
        const nc = await this.prisma.nonconformity.create({
          data: {
            ...data,
            project_id: access.projectId,
            number: (last._max.number ?? 0) + 1,
            reported_by: access.userId,
            status: data.responsible_id ? 'ASSIGNED' : 'UNASSIGNED',
          },
        });
        await this.log(access.userId, 'nonconformity', nc.id, { action: 'create', number: nc.number, source: data.source });
        return nc;
      } catch (e) {
        // Two users creating at the same time get the same number; retry once.
        if (attempt === 0 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
  }

  async updateNonconformity(projectId: string, id: string, dto: UpdateNonconformityDto, userId: string) {
    const { nc } = await this.loadNonconformity(projectId, id, userId);
    if (nc.status === 'RESOLVED' || nc.status === 'NOT_RELEVANT') {
      throw new BadRequestException('Reopen the nonconformity before changing it');
    }
    await this.access.assertMembers(projectId, [dto.responsible_id]);
    const data: Prisma.NonconformityUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.source !== undefined) data.source = dto.source;
    if (dto.detected_on !== undefined) data.detected_on = new Date(dto.detected_on);
    if (dto.responsible_id !== undefined) data.responsible_id = dto.responsible_id;
    if (dto.correction !== undefined) data.correction = dto.correction.trim() || null;
    if (dto.root_cause !== undefined) data.root_cause = dto.root_cause.trim() || null;
    const merged = {
      status: nc.status,
      responsible_id: dto.responsible_id !== undefined ? dto.responsible_id : nc.responsible_id,
      correction: dto.correction !== undefined ? dto.correction.trim() || null : nc.correction,
      root_cause: dto.root_cause !== undefined ? dto.root_cause.trim() || null : nc.root_cause,
      actionCount: nc.actions.length,
    };
    data.status = deriveNonconformityStatus(merged);
    await this.prisma.nonconformity.update({ where: { id }, data });
    await this.log(userId, 'nonconformity', id, { action: 'update', fields: Object.keys(dto) });
    return this.getRegisters(projectId, userId);
  }

  async addAction(projectId: string, id: string, dto: CreateActionDto, userId: string) {
    const { access, nc } = await this.loadNonconformity(projectId, id, userId);
    if (nc.status === 'RESOLVED' || nc.status === 'NOT_RELEVANT') throw new BadRequestException('Reopen the nonconformity first');
    await this.access.assertMembers(projectId, [dto.responsible_id]);

    const action = await this.prisma.correctiveAction.create({
      data: {
        nonconformity_id: id,
        description: dto.description.trim(),
        responsible_id: dto.responsible_id,
        due_date: dto.due_date ? new Date(dto.due_date) : null,
      },
    });
    const task = await this.tasks.create({
      projectId,
      organizationId: access.organizationId,
      stepId: null,
      assignedTo: dto.responsible_id,
      assignedBy: userId,
      type: TaskType.CORRECTIVE_ACTION,
      notes: `Corrective action for NC-${String(nc.number).padStart(3, '0')} "${nc.title}":\n${dto.description.trim()}`,
      deadline: action.due_date,
    });
    await this.prisma.correctiveAction.update({ where: { id: action.id }, data: { task_id: task.id } });
    await this.refreshStatus(id);
    await this.log(userId, 'nonconformity', id, { action: 'add_corrective_action', corrective_action: action.id });
    return this.getRegisters(projectId, userId);
  }

  async updateAction(projectId: string, id: string, actionId: string, dto: UpdateActionDto, userId: string) {
    const { nc } = await this.loadNonconformity(projectId, id, userId);
    const action = nc.actions.find(a => a.id === actionId);
    if (!action) throw new NotFoundException('Corrective action not found');
    if (nc.status === 'RESOLVED') throw new BadRequestException('Reopen the nonconformity first');
    await this.access.assertMembers(projectId, [dto.responsible_id]);

    await this.prisma.correctiveAction.update({
      where: { id: actionId },
      data: {
        ...(dto.description !== undefined && { description: dto.description.trim() }),
        ...(dto.responsible_id !== undefined && { responsible_id: dto.responsible_id }),
        ...(dto.due_date !== undefined && { due_date: dto.due_date ? new Date(dto.due_date) : null }),
        ...(dto.status !== undefined && {
          status: dto.status,
          completed_at: dto.status === 'DONE' ? action.completed_at ?? new Date() : null,
        }),
      },
    });
    if (dto.status === 'DONE' && action.task_id) {
      await this.prisma.taskAssignment.updateMany({
        where: { id: action.task_id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
        data: { status: 'COMPLETED', completed_at: new Date() },
      });
    } else {
      // The task follows its action: new responsible person, due date or description.
      await this.tasks.syncLinked(action.task_id, {
        assignedTo: dto.responsible_id,
        deadline: dto.due_date === undefined ? undefined : dto.due_date ? new Date(dto.due_date) : null,
        notes: dto.description === undefined ? undefined
          : `Corrective action for NC-${String(nc.number).padStart(3, '0')} "${nc.title}":
${dto.description.trim()}`,
      }, userId);
    }
    await this.log(userId, 'corrective_action', actionId, { action: 'update', fields: Object.keys(dto) });
    return this.getRegisters(projectId, userId);
  }

  async removeAction(projectId: string, id: string, actionId: string, userId: string) {
    const { nc } = await this.loadNonconformity(projectId, id, userId);
    if (!nc.actions.some(a => a.id === actionId)) throw new NotFoundException('Corrective action not found');
    if (nc.status === 'RESOLVED') throw new BadRequestException('Reopen the nonconformity first');
    await this.prisma.correctiveAction.delete({ where: { id: actionId } });
    await this.tasks.cancelLinked(nc.actions.find(a => a.id === actionId)!.task_id, userId);
    await this.refreshStatus(id);
    await this.log(userId, 'corrective_action', actionId, { action: 'delete', nonconformity: id });
    return this.getRegisters(projectId, userId);
  }

  /** Clause 10.2 d: resolve only after the actions are done and their effectiveness is reviewed. */
  async resolve(projectId: string, id: string, dto: ResolveNonconformityDto, userId: string) {
    const { nc } = await this.loadNonconformity(projectId, id, userId);
    if (nc.status !== 'ACTIONS_DEFINED') {
      throw new BadRequestException('Record the correction, the root cause and at least one corrective action first');
    }
    const open = nc.actions.filter(a => a.status !== 'DONE').length;
    if (open > 0) throw new BadRequestException(`${open} corrective action(s) are not done yet`);
    await this.prisma.nonconformity.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        effectiveness_review: dto.effectiveness_review.trim(),
        effectiveness_verified_by: userId,
        effectiveness_verified_at: new Date(),
        closed_at: new Date(),
      },
    });
    await this.log(userId, 'nonconformity', id, { action: 'resolve' });
    return this.getRegisters(projectId, userId);
  }

  async markNotRelevant(projectId: string, id: string, dto: NotRelevantDto, userId: string) {
    const { nc } = await this.loadNonconformity(projectId, id, userId);
    if (nc.status === 'RESOLVED') throw new BadRequestException('A resolved nonconformity cannot be dismissed');
    await this.prisma.nonconformity.update({
      where: { id },
      data: { status: 'NOT_RELEVANT', not_relevant_reason: dto.reason.trim(), closed_at: new Date() },
    });
    await this.log(userId, 'nonconformity', id, { action: 'not_relevant' });
    return this.getRegisters(projectId, userId);
  }

  async reopen(projectId: string, id: string, userId: string) {
    const { nc } = await this.loadNonconformity(projectId, id, userId);
    if (nc.status !== 'RESOLVED' && nc.status !== 'NOT_RELEVANT') throw new BadRequestException('The nonconformity is not closed');
    await this.prisma.nonconformity.update({
      where: { id },
      data: {
        status: deriveNonconformityStatus({ ...nc, status: 'ASSIGNED', actionCount: nc.actions.length }),
        closed_at: null,
        not_relevant_reason: null,
        effectiveness_verified_by: null,
        effectiveness_verified_at: null,
      },
    });
    await this.log(userId, 'nonconformity', id, { action: 'reopen' });
    return this.getRegisters(projectId, userId);
  }

  // ─── Incidents (A.5.24-A.5.28, A.6.8) ──────────────────────────

  async createIncident(projectId: string, dto: CreateIncidentDto, userId: string) {
    const access = await this.access.forProject(projectId, userId);
    this.access.assertEdit(access);
    await this.access.assertMembers(projectId, [dto.responsible_id]);
    for (let attempt = 0; ; attempt++) {
      const last = await this.prisma.incident.aggregate({ where: { project_id: projectId }, _max: { number: true } });
      try {
        const incident = await this.prisma.incident.create({
          data: {
            project_id: projectId,
            number: (last._max.number ?? 0) + 1,
            title: dto.title.trim(),
            description: dto.description.trim(),
            occurred_at: new Date(dto.occurred_at),
            reported_by: userId,
            responsible_id: dto.responsible_id ?? null,
            severity: dto.severity,
            affects_confidentiality: dto.affects_confidentiality ?? false,
            affects_integrity: dto.affects_integrity ?? false,
            affects_availability: dto.affects_availability ?? false,
          },
        });
        await this.log(userId, 'incident', incident.id, { action: 'report', number: incident.number });
        break;
      } catch (e) {
        if (attempt === 0 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    return this.getRegisters(projectId, userId);
  }

  async updateIncident(projectId: string, incidentId: string, dto: UpdateIncidentDto, userId: string) {
    const access = await this.access.forProject(projectId, userId);
    this.access.assertEdit(access);
    const incident = await this.prisma.incident.findFirst({ where: { id: incidentId, project_id: projectId } });
    if (!incident) throw new NotFoundException('Incident not found');
    await this.access.assertMembers(projectId, [dto.responsible_id]);

    const next = { ...incident, ...Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)) };
    if (dto.status && dto.status !== incident.status) {
      // Each state needs its evidence (A.5.25 assessment, A.5.26 response, A.5.27 lessons learned).
      const order: IncidentStatus[] = ['REPORTED', 'ASSESSED', 'RESOLVED', 'CLOSED'];
      const target = order.indexOf(dto.status);
      if (target >= 1 && (next.is_security_incident == null || !next.assessment?.trim())) {
        throw new BadRequestException('Assess the event first: decide whether it is a security incident and describe the assessment');
      }
      if (target >= 2 && next.is_security_incident && !next.response?.trim()) {
        throw new BadRequestException('Describe the response to the incident first');
      }
      if (target >= 3 && next.is_security_incident && !next.lessons_learned?.trim()) {
        throw new BadRequestException('Record the lessons learned before closing a security incident');
      }
    }

    await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.description !== undefined && { description: dto.description.trim() }),
        ...(dto.occurred_at !== undefined && { occurred_at: new Date(dto.occurred_at) }),
        ...(dto.responsible_id !== undefined && { responsible_id: dto.responsible_id }),
        ...(dto.severity !== undefined && { severity: dto.severity }),
        ...(dto.affects_confidentiality !== undefined && { affects_confidentiality: dto.affects_confidentiality }),
        ...(dto.affects_integrity !== undefined && { affects_integrity: dto.affects_integrity }),
        ...(dto.affects_availability !== undefined && { affects_availability: dto.affects_availability }),
        ...(dto.is_security_incident !== undefined && { is_security_incident: dto.is_security_incident }),
        ...(dto.assessment !== undefined && { assessment: dto.assessment.trim() || null }),
        ...(dto.response !== undefined && { response: dto.response.trim() || null }),
        ...(dto.lessons_learned !== undefined && { lessons_learned: dto.lessons_learned.trim() || null }),
        ...(dto.evidence !== undefined && { evidence: dto.evidence.trim() || null }),
        ...(dto.status !== undefined && { status: dto.status, closed_at: dto.status === 'CLOSED' ? new Date() : null }),
      },
    });
    await this.log(userId, 'incident', incidentId, { action: 'update', fields: Object.keys(dto) });
    return this.getRegisters(projectId, userId);
  }

  /** An incident caused by not following the rules is recorded as a nonconformity. */
  async nonconformityFromIncident(projectId: string, incidentId: string, userId: string) {
    const access = await this.access.forProject(projectId, userId);
    this.access.assertEdit(access);
    const incident = await this.prisma.incident.findFirst({ where: { id: incidentId, project_id: projectId } });
    if (!incident) throw new NotFoundException('Incident not found');
    await this.createNonconformityRecord(access, {
      title: `Incident INC-${String(incident.number).padStart(3, '0')}: ${incident.title}`.slice(0, 300),
      description: incident.description,
      source: FindingSource.INCIDENT,
      detected_on: incident.occurred_at,
      responsible_id: incident.responsible_id,
      incident_id: incident.id,
    });
    return this.getRegisters(projectId, userId);
  }

  // ─── Helpers ───────────────────────────────────────────────────

  private async loadNonconformity(projectId: string, id: string, userId: string) {
    const access = await this.access.forProject(projectId, userId);
    this.access.assertEdit(access);
    const nc = await this.prisma.nonconformity.findFirst({ where: { id, project_id: projectId }, include: NC_INCLUDE });
    if (!nc) throw new NotFoundException('Nonconformity not found');
    return { access, nc };
  }

  private async refreshStatus(id: string) {
    const nc = await this.prisma.nonconformity.findUnique({ where: { id }, include: { _count: { select: { actions: true } } } });
    if (!nc) return;
    const status = deriveNonconformityStatus({ ...nc, actionCount: nc._count.actions });
    if (status !== nc.status) await this.prisma.nonconformity.update({ where: { id }, data: { status } });
  }

  private async log(userId: string, entityType: string, entityId: string, details: Record<string, unknown>) {
    await this.auditLog.log({ userId, action: AuditAction.DOCUMENT_UPDATED, entityType, entityId, details: details as never });
  }
}
