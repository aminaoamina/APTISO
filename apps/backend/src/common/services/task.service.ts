import { Injectable } from '@nestjs/common';
import { AuditAction, NotificationType, TaskType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';

export interface NewTask {
  projectId: string;
  organizationId: string;
  stepId: string | null;
  assignedTo: string;
  assignedBy: string;
  type: TaskType;
  notes: string | null;
  deadline: Date | null;
}

/** Creates a task, notifies the assignee and records it in the audit log. */
@Injectable()
export class TaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(t: NewTask, ipAddress?: string, userAgent?: string) {
    const task = await this.prisma.taskAssignment.create({
      data: {
        project_id: t.projectId,
        step_id: t.stepId,
        assigned_to: t.assignedTo,
        assigned_by: t.assignedBy,
        type: t.type,
        notes: t.notes,
        deadline: t.deadline,
      },
      include: {
        assignee: { select: { id: true, email: true, first_name: true, last_name: true } },
        assigner: { select: { id: true, email: true, first_name: true, last_name: true } },
      },
    });

    await this.prisma.notification.create({
      data: {
        user_id: t.assignedTo,
        organization_id: t.organizationId,
        project_id: t.projectId,
        task_assignment_id: task.id,
        type: NotificationType.TASK_ASSIGNED,
      },
    });

    await this.auditLog.log({
      userId: t.assignedBy,
      action: AuditAction.TASK_ASSIGNED,
      entityType: 'task_assignment',
      entityId: task.id,
      details: { projectId: t.projectId, stepId: t.stepId, assignedTo: t.assignedTo, type: t.type },
      ipAddress,
      userAgent,
    });

    return task;
  }
}
