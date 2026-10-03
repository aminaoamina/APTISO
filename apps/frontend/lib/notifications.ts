import type { AppNotification } from '@/lib/api';
import { REQUEST_KIND_LABELS, requestsHref } from '@/lib/requests';
import { TASK_TYPE_LABELS, formatDay, fullName, taskHref, taskSubject } from '@/lib/tasks';

/** The sentence shown for each notification type (bell and dashboard). */
export function notificationMessage(n: AppNotification) {
  const actor = fullName(n.actor) || 'Someone';
  const task = n.task_assignment;
  const what = task ? `${TASK_TYPE_LABELS[task.type]}: ${taskSubject(task)}` : '';
  const request = n.resource_request;
  const asked = request ? `${REQUEST_KIND_LABELS[request.kind].toLowerCase()} for "${request.step.title}"` : '';
  switch (n.type) {
    case 'ORGANIZATION_JOIN_REQUEST':
      return `${actor} invited you to join ${n.organization?.name ?? 'an organization'}.`;
    case 'TASK_ASSIGNED':
      return `${actor} assigned you a task. ${what}${task?.deadline ? ` (due ${formatDay(task.deadline)})` : ''}`;
    case 'TASK_COMPLETED':
      return `${actor} completed ${what}${task?.completion_notes ? `: ${task.completion_notes}` : '.'}`;
    case 'TASK_DUE_SOON':
      return `Due ${task?.deadline ? formatDay(task.deadline) : 'soon'}: ${what}.`;
    case 'TASK_CANCELLED':
      return `${actor} removed this task from your list: ${what}.`;
    case 'REQUEST_RECEIVED':
      return `${actor} requests ${asked}. Approve or reject it.`;
    case 'REQUEST_DECIDED':
      return `${actor} ${request?.status === 'APPROVED' ? 'approved' : 'rejected'} your request for ${asked}${request?.decision_comment ? `: ${request.decision_comment}` : '.'}`;
  }
}

/** Where a notification leads; null when there is nothing to open. */
export function notificationHref(n: AppNotification) {
  if (n.task_assignment && n.type !== 'TASK_CANCELLED') return taskHref(n.task_assignment);
  const request = n.resource_request;
  if (request && n.type === 'REQUEST_RECEIVED') return requestsHref(request);
  if (request) return `/dashboard/organizations/${request.project.organization_id}/projects/${request.project_id}/steps/${request.step_id}`;
  return null;
}

export const notificationContext = (n: AppNotification) =>
  n.task_assignment?.project.name ?? n.resource_request?.project.name ?? n.organization?.name ?? '';

export function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return formatDay(iso);
}
