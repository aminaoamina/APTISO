import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { TASK_TYPE_LABELS } from '../tasks/task-labels';
import { REQUEST_KIND_LABELS } from '../requests/request-labels';

export interface NewNotification {
  userId: string;
  type: NotificationType;
  /** Who triggered it; people are not notified (nor e-mailed) about their own actions, except a task they assign themselves. */
  actorId?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  joinRequestId?: string | null;
  requestId?: string | null;
}

/** Notification types that ask the recipient to act, or answer them, are also sent by e-mail. */
const EMAILED = new Set<NotificationType>([
  NotificationType.TASK_ASSIGNED,
  NotificationType.TASK_DUE_SOON,
  NotificationType.REQUEST_RECEIVED,
  NotificationType.REQUEST_DECIDED,
]);

const PERSON = { select: { id: true, first_name: true, last_name: true } } as const;
const PROJECT = { select: { id: true, name: true, organization_id: true } } as const;
const LIST_LIMIT = 30;

const NOTIFICATION_INCLUDE = {
  actor: PERSON,
  user: { select: { email: true, first_name: true } },
  organization: { select: { id: true, name: true } },
  join_request: { select: { id: true, role: true, status: true } },
  task_assignment: {
    select: {
      id: true,
      type: true,
      status: true,
      deadline: true,
      completion_notes: true,
      notes: true,
      project_id: true,
      step_id: true,
      document_instance_id: true,
      project: PROJECT,
      step: { select: { id: true, title: true, key: true } },
      document: { select: { id: true, title: true } },
    },
  },
  resource_request: {
    select: {
      id: true,
      kind: true,
      status: true,
      description: true,
      decision_comment: true,
      project_id: true,
      step_id: true,
      project: PROJECT,
      step: { select: { id: true, title: true } },
    },
  },
} satisfies Prisma.NotificationInclude;

type FullNotification = Prisma.NotificationGetPayload<{ include: typeof NOTIFICATION_INCLUDE }>;

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
    const ownAction = !!n.actorId && n.actorId === n.userId;
    // A task in my list is always announced, even when I assigned it myself; other events about my own actions are not.
    if (ownAction && n.type !== NotificationType.TASK_ASSIGNED) return;
    const notification = await this.prisma.notification.create({
      data: {
        user_id: n.userId,
        type: n.type,
        actor_id: n.actorId ?? null,
        organization_id: n.organizationId ?? null,
        project_id: n.projectId ?? null,
        task_assignment_id: n.taskId ?? null,
        join_request_id: n.joinRequestId ?? null,
        resource_request_id: n.requestId ?? null,
      },
      include: NOTIFICATION_INCLUDE,
    });
    if (EMAILED.has(n.type) && !ownAction) {
      // E-mail is best effort: a mail server problem must never block the action that triggered it.
      this.email(notification).catch((e: Error) => this.logger.warn(`Notification e-mail not sent: ${e.message}`));
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
        include: NOTIFICATION_INCLUDE,
      }),
      this.prisma.notification.count({ where: { user_id: userId, read_at: null } }),
    ]);
    return { items: items.map(({ user: _user, ...n }) => n), unread_count };
  }

  /** Marks the given notifications (or all of them) as read. */
  async markRead(userId: string, ids?: string[]) {
    const where: Prisma.NotificationWhereInput = { user_id: userId, read_at: null, ...(ids?.length && { id: { in: ids } }) };
    await this.prisma.notification.updateMany({ where, data: { read_at: new Date() } });
    return { unread_count: await this.prisma.notification.count({ where: { user_id: userId, read_at: null } }) };
  }

  private async email(n: FullNotification) {
    const actor = n.actor ? `${n.actor.first_name} ${n.actor.last_name}`.trim() : 'Someone';
    const date = (d: Date) => d.toLocaleDateString('en-GB');
    const keep = (d: ({ label: string; value: string } | null | false | '' | undefined)[]) =>
      d.filter((x): x is { label: string; value: string } => !!x);

    const task = n.task_assignment;
    const request = n.resource_request;
    let mail: Omit<Parameters<MailService['sendNotificationEmail']>[1], 'recipientName'> | null = null;

    if (task && (n.type === NotificationType.TASK_ASSIGNED || n.type === NotificationType.TASK_DUE_SOON)) {
      const label = TASK_TYPE_LABELS[task.type];
      const dueSoon = n.type === NotificationType.TASK_DUE_SOON;
      mail = {
        subject: dueSoon ? `Reminder: "${label}" is due soon` : `New task: ${label}`,
        heading: dueSoon ? 'A task is due soon' : 'You have a new task',
        message: dueSoon ? 'this task assigned to you is due soon.' : `${actor} assigned you a task in APTISO.`,
        details: keep([
          { label: 'Task', value: label },
          { label: 'Project', value: task.project.name },
          task.document && { label: 'Document', value: task.document.title },
          !task.document && task.step && { label: 'Step', value: task.step.title },
          task.deadline && { label: 'Deadline', value: date(task.deadline) },
          task.notes && { label: 'Details', value: task.notes },
        ]),
        path: `/dashboard/tasks?task=${task.id}`,
        linkLabel: 'Open my tasks',
      };
    } else if (request && n.type === NotificationType.REQUEST_RECEIVED) {
      const label = REQUEST_KIND_LABELS[request.kind];
      mail = {
        subject: `Request for ${label.toLowerCase()}: ${request.step.title}`,
        heading: 'A request needs your decision',
        message: `${actor} asks for ${label.toLowerCase()} for a step of the ISMS project. Please approve or reject it.`,
        details: [
          { label: 'Project', value: request.project.name },
          { label: 'Step', value: request.step.title },
          { label: 'Request', value: request.description },
        ],
        path: `/dashboard/organizations/${request.project.organization_id}/projects/${request.project_id}/requests`,
        linkLabel: 'Open requests',
      };
    } else if (request && n.type === NotificationType.REQUEST_DECIDED) {
      const label = REQUEST_KIND_LABELS[request.kind];
      const approved = request.status === 'APPROVED';
      mail = {
        subject: `Your request for ${label.toLowerCase()} was ${approved ? 'approved' : 'rejected'}`,
        heading: approved ? 'Your request was approved' : 'Your request was rejected',
        message: `${actor} ${approved ? 'approved' : 'rejected'} your request for ${label.toLowerCase()}.`,
        details: keep([
          { label: 'Step', value: request.step.title },
          { label: 'Request', value: request.description },
          request.decision_comment && { label: 'Comment', value: request.decision_comment },
        ]),
        path: `/dashboard/organizations/${request.project.organization_id}/projects/${request.project_id}/steps/${request.step_id}`,
        linkLabel: 'Open the step',
      };
    }
    if (mail) await this.mail.sendNotificationEmail(n.user.email, { ...mail, recipientName: n.user.first_name });
  }
}
