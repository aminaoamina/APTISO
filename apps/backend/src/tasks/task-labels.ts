import { TaskType } from '@prisma/client';

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

/**
 * Tasks people assign by hand from a step. All other tasks belong to a
 * register record (control, corrective action, audit, decision, recurring
 * activity) and are changed from that register so both stay consistent.
 */
export const MANUAL_TASK_TYPES: TaskType[] = [
  TaskType.WORK_ON_DOCUMENT,
  TaskType.REVIEW_DOCUMENT,
  TaskType.APPROVE_DOCUMENT,
  TaskType.AWARENESS_TASK,
  TaskType.TRAINING_TASK,
  TaskType.HR_REQUEST,
  TaskType.FINANCE_REQUEST,
  TaskType.TECHNOLOGY_REQUEST,
];

/** Task types about the step's document: the task links straight to it. */
export const DOCUMENT_TASK_TYPES: TaskType[] = [TaskType.WORK_ON_DOCUMENT, TaskType.REVIEW_DOCUMENT, TaskType.APPROVE_DOCUMENT];
