import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditAction, NotificationType, Prisma, ProjectRole, TaskStatus, TaskType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DOCUMENT_TASK_TYPES, MANUAL_TASK_TYPES } from './task-labels';
import { AssignTaskDto, UpdateTaskDto } from './dto/task.dto';

export interface NewTask {
  projectId: string;
  organizationId: string;
  stepId: string | null;
  assignedTo: string;
  assignedBy: string;
  type: TaskType;
  notes: string | null;
  deadline: Date | null;
  documentId?: string | null;
  /** Recurring maintenance activity the task belongs to (see MaintenanceService). */
  activityKey?: string | null;
}

/** Days before the deadline when the assignee gets a reminder. */
const REMINDER_DAYS = 2;
const DAY = 24 * 60 * 60 * 1000;
const OPEN: TaskStatus[] = [TaskStatus.PENDING, TaskStatus.IN_PROGRESS];
const PERSON = { select: { id: true, email: true, first_name: true, last_name: true } } as const;

export const TASK_INCLUDE = {
  project: { select: { id: true, name: true, organization_id: true } },
  step: { select: { id: true, title: true, key: true } },
  document: { select: { id: true, title: true } },
  assignee: PERSON,
  assigner: PERSON,
} satisfies Prisma.TaskAssignmentInclude;

/**
 * Tasks of every module: created here so each one notifies its assignee and
 * is audit-logged, and completed here so linked records (corrective actions,
 * review decisions, the yearly risk review) follow.
 */
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(t: NewTask, ipAddress?: string, userAgent?: string) {
    const task = await this.prisma.taskAssignment.create({
      data: {
        project_id: t.projectId,
        step_id: t.stepId,
        document_instance_id: t.documentId ?? null,
        activity_key: t.activityKey ?? null,
        assigned_to: t.assignedTo,
        assigned_by: t.assignedBy,
        type: t.type,
        notes: t.notes,
        deadline: t.deadline,
      },
      include: TASK_INCLUDE,
    });
    await this.notifications.notify({
      userId: t.assignedTo,
      actorId: t.assignedBy,
      type: NotificationType.TASK_ASSIGNED,
      organizationId: t.organizationId,
      projectId: t.projectId,
      taskId: task.id,
    });
    await this.log(t.assignedBy, AuditAction.TASK_ASSIGNED, task.id, { projectId: t.projectId, stepId: t.stepId, assignedTo: t.assignedTo, type: t.type }, ipAddress, userAgent);
    return task;
  }

  // ─── Reading ─────────────────────────────────────────────────

  mine(userId: string) {
    return this.prisma.taskAssignment.findMany({
      where: { assigned_to: userId, status: { not: TaskStatus.CANCELLED } },
      include: TASK_INCLUDE,
      orderBy: [{ deadline: { sort: 'asc', nulls: 'last' } }, { created_at: 'desc' }],
    });
  }

  /** Tasks the user handed out, plus every task of the projects the user leads. */
  team(userId: string) {
    return this.prisma.taskAssignment.findMany({
      where: {
        assigned_to: { not: userId },
        OR: [
          { assigned_by: userId },
          { project: { members: { some: { user_id: userId, privilege: ProjectRole.PROJECT_LEAD } } } },
        ],
      },
      include: TASK_INCLUDE,
      orderBy: [{ deadline: { sort: 'asc', nulls: 'last' } }, { created_at: 'desc' }],
    });
  }

  forProject(projectId: string) {
    return this.prisma.taskAssignment.findMany({
      where: { project_id: projectId },
      include: TASK_INCLUDE,
      orderBy: { created_at: 'desc' },
    });
  }

  // ─── Assigning from a step ───────────────────────────────────

  async assign(projectId: string, stepId: string, dto: AssignTaskDto, userId: string, ipAddress?: string, userAgent?: string) {
    if (!MANUAL_TASK_TYPES.includes(dto.type)) throw new BadRequestException('This kind of task is created by its register');
    const step = await this.stepOf(projectId, stepId);
    await this.assertMember(projectId, dto.assigned_to);
    const documentTask = DOCUMENT_TASK_TYPES.includes(dto.type);
    if (documentTask && !step.document_instance) throw new BadRequestException('Create the document of this step first');

    return this.create({
      projectId,
      organizationId: step.phase.project.organization_id,
      stepId,
      documentId: documentTask ? step.document_instance!.id : null,
      assignedTo: dto.assigned_to,
      assignedBy: userId,
      type: dto.type,
      notes: dto.notes?.trim() || null,
      deadline: dto.deadline ? new Date(dto.deadline) : step.document_instance?.deadline ?? null,
    }, ipAddress, userAgent);
  }

  // ─── Working on a task ───────────────────────────────────────

  async complete(taskId: string, userId: string, notes?: string, ipAddress?: string, userAgent?: string) {
    const task = await this.load(taskId);
    if (task.assigned_to !== userId) throw new ForbiddenException('Only the assignee can complete this task');
    if (!OPEN.includes(task.status)) throw new BadRequestException('This task is already closed');

    const now = new Date();
    const updated = await this.prisma.taskAssignment.update({
      where: { id: taskId },
      data: { status: TaskStatus.COMPLETED, completed_at: now, completion_notes: notes?.trim() || null },
      include: TASK_INCLUDE,
    });

    // Completing the task of a register record completes the record itself.
    if (task.type === TaskType.CORRECTIVE_ACTION) {
      await this.prisma.correctiveAction.updateMany({ where: { task_id: taskId, status: { not: 'DONE' } }, data: { status: 'DONE', completed_at: now } });
    }
    if (task.type === TaskType.MANAGEMENT_REVIEW_ACTION) {
      await this.prisma.managementReviewDecision.updateMany({ where: { task_id: taskId, status: { not: 'DONE' } }, data: { status: 'DONE', completed_at: now } });
    }
    // The yearly risk review repeats: completing one schedules the next.
    if (task.type === TaskType.RISK_REVIEW && task.step_id) {
      await this.scheduleRiskReview(task.project_id, task.step_id, userId);
    }

    await this.notifications.notify({
      userId: task.assigned_by,
      actorId: userId,
      type: NotificationType.TASK_COMPLETED,
      projectId: task.project_id,
      taskId,
    });
    await this.log(userId, AuditAction.TASK_COMPLETED, taskId, { projectId: task.project_id, type: task.type }, ipAddress, userAgent);
    return updated;
  }

  /** New assignee or deadline of a hand-assigned task; by its assigner or the project lead. */
  async update(taskId: string, dto: UpdateTaskDto, userId: string, ipAddress?: string, userAgent?: string) {
    const task = await this.loadManageable(taskId, userId);
    if (dto.assigned_to) await this.assertMember(task.project_id, dto.assigned_to);
    const reassigned = !!dto.assigned_to && dto.assigned_to !== task.assigned_to;
    const deadline = dto.deadline === undefined ? undefined : dto.deadline ? new Date(dto.deadline) : null;

    const updated = await this.applyChanges(task, { assignedTo: dto.assigned_to, deadline }, userId);
    await this.log(userId, AuditAction.TASK_ASSIGNED, taskId, { action: 'update', reassigned, deadline: dto.deadline }, ipAddress, userAgent);
    return updated;
  }

  async cancel(taskId: string, userId: string, ipAddress?: string, userAgent?: string) {
    const task = await this.loadManageable(taskId, userId);
    const updated = await this.close(task, userId);
    await this.log(userId, AuditAction.TASK_ASSIGNED, taskId, { action: 'cancel' }, ipAddress, userAgent);
    return updated;
  }

  // ─── Keeping register tasks in line with their record ────────

  /** A register record changed its responsible person, due date or description. */
  async syncLinked(taskId: string | null, changes: { assignedTo?: string; deadline?: Date | null; notes?: string }, actorId: string) {
    if (!taskId) return;
    const task = await this.prisma.taskAssignment.findUnique({ where: { id: taskId } });
    if (task && OPEN.includes(task.status)) await this.applyChanges(task, changes, actorId);
  }

  /** The register record was removed: its open task is cancelled. */
  async cancelLinked(taskId: string | null, actorId: string) {
    if (!taskId) return;
    const task = await this.prisma.taskAssignment.findUnique({ where: { id: taskId } });
    if (task && OPEN.includes(task.status)) await this.close(task, actorId);
  }

  /**
   * Methodology 3.4: risk owners review the risks at least once a year. When
   * the register is completed, the project lead gets a "Review of risks" task
   * due in one year; completing it schedules the next one.
   */
  async scheduleRiskReview(projectId: string, stepId: string, completedBy: string) {
    const existing = await this.prisma.taskAssignment.findFirst({
      where: { step_id: stepId, type: TaskType.RISK_REVIEW, status: { in: OPEN } },
    });
    if (existing) return;

    const [project, lead] = await Promise.all([
      this.prisma.complianceProject.findUnique({ where: { id: projectId }, select: { organization_id: true } }),
      this.prisma.projectMember.findFirst({
        where: { project_id: projectId, privilege: ProjectRole.PROJECT_LEAD },
        orderBy: { joined_at: 'asc' },
        select: { user_id: true },
      }),
    ]);
    if (!project) return;

    const due = new Date();
    due.setFullYear(due.getFullYear() + 1);
    await this.create({
      projectId,
      organizationId: project.organization_id,
      stepId,
      assignedTo: lead?.user_id ?? completedBy,
      assignedBy: completedBy,
      type: TaskType.RISK_REVIEW,
      notes:
        'Annual review of risks (Risk Assessment and Treatment Methodology, section 3.4): with the risk owners, ' +
        'review existing risks, add newly identified ones, update the risk register and refresh the Risk Assessment ' +
        'and Treatment Report. Review earlier after significant organizational, technology or business changes.',
      deadline: due,
    });
  }

  /** Every morning: one reminder per open task whose deadline is within the next days (or already passed). */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendDueReminders() {
    const tasks = await this.prisma.taskAssignment.findMany({
      where: { status: { in: OPEN }, reminded_at: null, deadline: { lte: new Date(Date.now() + REMINDER_DAYS * DAY) } },
      select: { id: true, assigned_to: true, project_id: true },
    });
    for (const t of tasks) {
      await this.notifications.notify({ userId: t.assigned_to, type: NotificationType.TASK_DUE_SOON, projectId: t.project_id, taskId: t.id });
      await this.prisma.taskAssignment.update({ where: { id: t.id }, data: { reminded_at: new Date() } });
    }
    if (tasks.length) this.logger.log(`Sent ${tasks.length} task reminder(s)`);
    return tasks.length;
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private async applyChanges(
    task: { id: string; project_id: string; assigned_to: string },
    changes: { assignedTo?: string; deadline?: Date | null; notes?: string },
    actorId: string,
  ) {
    const reassigned = !!changes.assignedTo && changes.assignedTo !== task.assigned_to;
    const updated = await this.prisma.taskAssignment.update({
      where: { id: task.id },
      data: {
        ...(reassigned && { assigned_to: changes.assignedTo }),
        ...(changes.deadline !== undefined && { deadline: changes.deadline }),
        ...(changes.notes !== undefined && { notes: changes.notes }),
        // A new person or a new date deserves a new reminder.
        ...((reassigned || changes.deadline !== undefined) && { reminded_at: null }),
      },
      include: TASK_INCLUDE,
    });
    if (reassigned) {
      await this.notifications.notify({ userId: task.assigned_to, actorId, type: NotificationType.TASK_CANCELLED, projectId: task.project_id, taskId: task.id });
      await this.notifications.notify({ userId: changes.assignedTo!, actorId, type: NotificationType.TASK_ASSIGNED, projectId: task.project_id, taskId: task.id });
    }
    return updated;
  }

  private async close(task: { id: string; project_id: string; assigned_to: string }, actorId: string) {
    const updated = await this.prisma.taskAssignment.update({
      where: { id: task.id },
      data: { status: TaskStatus.CANCELLED },
      include: TASK_INCLUDE,
    });
    await this.notifications.notify({ userId: task.assigned_to, actorId, type: NotificationType.TASK_CANCELLED, projectId: task.project_id, taskId: task.id });
    return updated;
  }

  private async load(taskId: string) {
    const task = await this.prisma.taskAssignment.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private async loadManageable(taskId: string, userId: string) {
    const task = await this.load(taskId);
    if (!OPEN.includes(task.status)) throw new BadRequestException('This task is already closed');
    if (!MANUAL_TASK_TYPES.includes(task.type)) {
      throw new BadRequestException('This task belongs to a register record; change it from that register');
    }
    if (task.assigned_by !== userId) {
      const lead = await this.prisma.projectMember.count({ where: { project_id: task.project_id, user_id: userId, privilege: ProjectRole.PROJECT_LEAD } });
      if (!lead) throw new ForbiddenException('Only the person who assigned the task or the project lead can change it');
    }
    return task;
  }

  private async stepOf(projectId: string, stepId: string) {
    const step = await this.prisma.projectStep.findUnique({
      where: { id: stepId },
      include: {
        phase: { select: { project_id: true, project: { select: { organization_id: true } } } },
        document_instance: { select: { id: true, deadline: true } },
      },
    });
    if (!step || step.phase.project_id !== projectId) throw new NotFoundException('Step not found');
    return step;
  }

  private async assertMember(projectId: string, userId: string) {
    const member = await this.prisma.projectMember.count({ where: { project_id: projectId, user_id: userId } });
    if (!member) throw new BadRequestException('The assignee must be a member of this project');
  }

  private log(userId: string, action: AuditAction, taskId: string, details: Record<string, unknown>, ipAddress?: string, userAgent?: string) {
    return this.auditLog.log({ userId, action, entityType: 'task_assignment', entityId: taskId, details: details as Prisma.JsonObject, ipAddress, userAgent });
  }
}
