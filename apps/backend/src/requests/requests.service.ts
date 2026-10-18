import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, IsoRole, NotificationType, Prisma, ProjectRole, ResourceRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRequestDto, DecideRequestDto } from './requests.dto';

const PERSON = { select: { id: true, first_name: true, last_name: true } } as const;

const REQUEST_INCLUDE = {
  project: { select: { id: true, name: true, organization_id: true } },
  step: { select: { id: true, title: true, phase: { select: { name: true } } } },
  requester: PERSON,
  decider: PERSON,
} satisfies Prisma.ResourceRequestInclude;

/**
 * Requests for extra resources (clause 7.1). Top management decides; when no
 * project member has the Top management role, the project lead decides.
 */
@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(projectId: string, stepId: string, dto: CreateRequestDto, userId: string, ipAddress?: string, userAgent?: string) {
    const step = await this.prisma.projectStep.findUnique({ where: { id: stepId }, select: { phase: { select: { project_id: true } } } });
    if (!step || step.phase.project_id !== projectId) throw new NotFoundException('Step not found');

    const request = await this.prisma.resourceRequest.create({
      data: { project_id: projectId, step_id: stepId, kind: dto.kind, description: dto.description.trim(), requested_by: userId },
      include: REQUEST_INCLUDE,
    });
    for (const deciderId of await this.deciders(projectId)) {
      await this.notifications.notify({ userId: deciderId, actorId: userId, type: NotificationType.REQUEST_RECEIVED, projectId, requestId: request.id });
    }
    await this.log(userId, request.id, { action: 'request_resources', projectId, stepId, kind: dto.kind }, ipAddress, userAgent);
    return request;
  }

  /** Every request of the project, and whether the user may decide them. */
  async list(projectId: string, userId: string) {
    const [items, deciders] = await Promise.all([
      this.prisma.resourceRequest.findMany({ where: { project_id: projectId }, include: REQUEST_INCLUDE, orderBy: { created_at: 'desc' } }),
      this.deciders(projectId),
    ]);
    return { items, can_decide: deciders.includes(userId) };
  }

  /** Pending requests waiting for this user's decision, across all projects (sidebar counter). */
  async awaitingMe(userId: string) {
    const memberships = await this.prisma.projectMember.findMany({ where: { user_id: userId }, select: { project_id: true } });
    const projects: string[] = [];
    for (const m of memberships) {
      if ((await this.deciders(m.project_id)).includes(userId)) projects.push(m.project_id);
    }
    if (!projects.length) return [];
    return this.prisma.resourceRequest.findMany({
      where: { project_id: { in: projects }, status: ResourceRequestStatus.PENDING },
      select: { id: true, project_id: true },
    });
  }

  async decide(requestId: string, dto: DecideRequestDto, userId: string, ipAddress?: string, userAgent?: string) {
    const request = await this.prisma.resourceRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    if (!(await this.deciders(request.project_id)).includes(userId)) {
      throw new ForbiddenException('Only top management (or the project lead when nobody has that role) decides on requests');
    }
    if (request.status !== ResourceRequestStatus.PENDING) throw new BadRequestException('This request has already been decided');
    const comment = dto.comment?.trim() || null;
    if (dto.decision === 'REJECTED' && !comment) throw new BadRequestException('Give the reason for the rejection');

    const decided = await this.prisma.resourceRequest.update({
      where: { id: requestId },
      data: { status: dto.decision, decided_by: userId, decided_at: new Date(), decision_comment: comment },
      include: REQUEST_INCLUDE,
    });
    await this.notifications.notify({
      userId: request.requested_by,
      actorId: userId,
      type: NotificationType.REQUEST_DECIDED,
      projectId: request.project_id,
      requestId,
    });
    await this.log(userId, requestId, { action: 'decide_request', decision: dto.decision }, ipAddress, userAgent);
    return decided;
  }

  /** Members with the Top management role; the project leads when there is none. */
  private async deciders(projectId: string) {
    const members = await this.prisma.projectMember.findMany({
      where: { project_id: projectId },
      select: { user_id: true, privilege: true, iso_roles: { select: { iso_role: true } } },
    });
    const top = members.filter(m => m.iso_roles.some(r => r.iso_role === IsoRole.TOP_MANAGEMENT));
    return (top.length ? top : members.filter(m => m.privilege === ProjectRole.PROJECT_LEAD)).map(m => m.user_id);
  }

  private log(userId: string, requestId: string, details: Prisma.JsonObject, ipAddress?: string, userAgent?: string) {
    return this.auditLog.log({ userId, action: AuditAction.PROJECT_UPDATED, entityType: 'resource_request', entityId: requestId, details, ipAddress, userAgent });
  }
}
