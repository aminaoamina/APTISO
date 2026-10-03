import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { TASK_TYPE_LABELS } from '../tasks/task-labels';

export interface NewNotification {
  userId: string;
  type: NotificationType;
  /** Who triggered it; nobody is notified about their own actions. */
  actorId?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  joinRequestId?: string | null;
}

/** Notification types that ask the recipient to act are also sent by email. */
const EMAILED: NotificationType[] = [NotificationType.TASK_ASSIGNED, NotificationType.TASK_DUE_SOON];

const PERSON = { select: { id: true, first_name: true, last_name: true } } as const;
const LIST_LIMIT = 30;

/**
 * The single entry point for notifications: every feature calls notify(), and
 * the bell reads list(). Adding a notification type means adding it here and
 * to the bell's message table on the client.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async notify(n: NewNotification) {
    if (n.actorId && n.actorId === n.userId) return;
    const notification = await this.prisma.notification.create({
      data: {
        user_id: n.userId,
        type: n.type,
        actor_id: n.actorId ?? null,
        organization_id: n.organizationId ?? null,
        project_id: n.projectId ?? null,
        task_assignment_id: n.taskId ?? null,
        join_request_id: n.joinRequestId ?? null,
      },
    });
    if (n.taskId && EMAILED.includes(n.type)) {
      // E-mail is best effort: a mail server problem must never block the action that triggered it.
      this.emailTask(n.taskId, n.type).catch((e: Error) => this.logger.warn(`Task e-mail not sent: ${e.message}`));
    }
    return notification;
  }

  /** The latest notifications with everything the bell needs to write the message and link to the item. */
  async list(userId: string) {
    const [items, unread_count] = await Promise.all([
      this.prisma.notification.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: LIST_LIMIT,
        include: {
          actor: PERSON,
          organization: { select: { id: true, name: true } },
          join_request: { select: { id: true, role: true, status: true } },
          task_assignment: {
            select: {
              id: true,
              type: true,
              status: true,
              deadline: true,
              notes: true,
              project_id: true,
              step_id: true,
              document_instance_id: true,
              project: { select: { id: true, name: true, organization_id: true } },
              step: { select: { id: true, title: true, key: true } },
              document: { select: { id: true, title: true } },
            },
          },
        },
      }),
      this.prisma.notification.count({ where: { user_id: userId, read_at: null } }),
    ]);
    return { items, unread_count };
  }

  /** Marks the given notifications (or all of them) as read. */
  async markRead(userId: string, ids?: string[]) {
    const where: Prisma.NotificationWhereInput = { user_id: userId, read_at: null, ...(ids?.length && { id: { in: ids } }) };
    await this.prisma.notification.updateMany({ where, data: { read_at: new Date() } });
    return { unread_count: await this.prisma.notification.count({ where: { user_id: userId, read_at: null } }) };
  }

  private async emailTask(taskId: string, type: NotificationType) {
    const task = await this.prisma.taskAssignment.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { email: true, first_name: true, last_name: true } },
        assigner: { select: { first_name: true, last_name: true } },
        project: { select: { name: true } },
        step: { select: { title: true } },
        document: { select: { title: true } },
      },
    });
    if (!task) return;
    const label = TASK_TYPE_LABELS[task.type];
    const dueSoon = type === NotificationType.TASK_DUE_SOON;
    const details = [
      { label: 'Task', value: label },
      { label: 'Project', value: task.project.name },
      task.document && { label: 'Document', value: task.document.title },
      !task.document && task.step && { label: 'Step', value: task.step.title },
      task.deadline && { label: 'Deadline', value: task.deadline.toLocaleDateString('en-GB') },
      task.notes && { label: 'Details', value: task.notes },
    ].filter((d): d is { label: string; value: string } => !!d);

    await this.mail.sendTaskEmail(task.assignee.email, {
      subject: dueSoon ? `Reminder: "${label}" is due soon` : `New task: ${label}`,
      heading: dueSoon ? 'A task is due soon' : 'You have a new task',
      recipientName: task.assignee.first_name,
      message: dueSoon
        ? 'this task assigned to you is due soon.'
        : `${task.assigner.first_name} ${task.assigner.last_name} assigned you a task in APTISO.`,
      details,
      taskId: task.id,
    });
  }
}
