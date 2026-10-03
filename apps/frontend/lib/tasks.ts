import type { NotificationTask, TaskAssignment, TaskType } from '@/lib/api';

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  WORK_ON_DOCUMENT: 'Work on document',
  REVIEW_DOCUMENT: 'Review document',
  APPROVE_DOCUMENT: 'Approve document',
  AWARENESS_TASK: 'Awareness',
  TRAINING_TASK: 'Training',
  HR_REQUEST: 'HR request',
  FINANCE_REQUEST: 'Finance request',
  TECHNOLOGY_REQUEST: 'Technology request',
  RISK_REVIEW: 'Review of risks',
  IMPLEMENT_CONTROL: 'Implement control',
  CORRECTIVE_ACTION: 'Corrective action',
  INTERNAL_AUDIT: 'Internal audit',
  MANAGEMENT_REVIEW_ACTION: 'Management review action',
  MANAGEMENT_REVIEW_DUE: 'Management review due',
  OBJECTIVES_REVIEW: 'Review of objectives',
  DOCUMENT_REVIEW: 'Review of document',
  INCIDENTS_REVIEW: 'Review of incidents',
  TRAININGS_REVIEW: 'Review of trainings',
};

export const TASK_TYPE_COLORS: Record<TaskType, string> = {
  WORK_ON_DOCUMENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  REVIEW_DOCUMENT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  APPROVE_DOCUMENT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  AWARENESS_TASK: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  TRAINING_TASK: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  HR_REQUEST: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
  FINANCE_REQUEST: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  TECHNOLOGY_REQUEST: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  RISK_REVIEW: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  IMPLEMENT_CONTROL: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  CORRECTIVE_ACTION: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
  INTERNAL_AUDIT: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  MANAGEMENT_REVIEW_ACTION: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  MANAGEMENT_REVIEW_DUE: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  OBJECTIVES_REVIEW: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400',
  DOCUMENT_REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  INCIDENTS_REVIEW: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  TRAININGS_REVIEW: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
};

/** Tasks people assign by hand from a step; all others are managed from their register (same list as the server). */
export const MANUAL_TASK_TYPES: TaskType[] = [
  'WORK_ON_DOCUMENT', 'REVIEW_DOCUMENT', 'APPROVE_DOCUMENT', 'AWARENESS_TASK', 'TRAINING_TASK',
  'HR_REQUEST', 'FINANCE_REQUEST', 'TECHNOLOGY_REQUEST',
];

/** Recurring maintenance activities without a step of their own. */
const MAINTENANCE_TYPES: TaskType[] = ['MANAGEMENT_REVIEW_DUE', 'OBJECTIVES_REVIEW', 'INCIDENTS_REVIEW', 'TRAININGS_REVIEW', 'RISK_REVIEW', 'DOCUMENT_REVIEW'];

/** Where the task is done: its document, its register, its step or the maintenance page. */
export function taskHref(task: NotificationTask) {
  const project = `/dashboard/organizations/${task.project.organization_id}/projects/${task.project_id}`;
  if (task.document_instance_id) return `${project}/documents/${task.document_instance_id}`;
  if (task.type === 'CORRECTIVE_ACTION') return `${project}/registers`;
  if (task.step_id) return `${project}/steps/${task.step_id}`;
  if (MAINTENANCE_TYPES.includes(task.type)) return `${project}/maintenance`;
  return project;
}

/** What the task is about: the document, the step, or the first line of its instructions. */
export function taskSubject(task: NotificationTask) {
  return task.document?.title ?? task.step?.title ?? task.notes?.split('\n')[0] ?? task.project.name;
}

export const isOpen = (task: Pick<TaskAssignment, 'status'>) => task.status === 'PENDING' || task.status === 'IN_PROGRESS';

export const isOverdue = (task: Pick<TaskAssignment, 'status' | 'deadline'>) =>
  isOpen(task) && !!task.deadline && new Date(task.deadline) < new Date(new Date().toDateString());

export const formatDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const fullName = (p: { first_name: string; last_name: string } | null | undefined) =>
  p ? `${p.first_name} ${p.last_name}`.trim() : '';
