/**
 * Phase 4 (Preparation for External Audit) API: nonconformity, corrective
 * action and incident registers, training plan, security objectives,
 * internal audit and management review.
 */
import apiClient from './api-client';
import type { DocumentInstance, RiskRegisterCompletion } from './api';

export type Frequency = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUALLY' | 'YEARLY';
export type ActionStatus = 'PLANNED' | 'IN_PROGRESS' | 'DONE';

export interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  privilege: 'PROJECT_LEAD' | 'PROJECT_MEMBER' | 'PROJECT_AUDITOR';
  is_top_management: boolean;
  label: string;
}

export interface Permissions {
  canEdit: boolean;
  /** Top management decisions: Top management role or project lead. */
  canDecide: boolean;
  userId: string;
}

// ─── Registers ─────────────────────────────────────────────────

export type NcStatus = 'UNASSIGNED' | 'ASSIGNED' | 'ACTIONS_DEFINED' | 'RESOLVED' | 'NOT_RELEVANT';
export type FindingSource = 'INTERNAL_AUDIT' | 'EXTERNAL_AUDIT' | 'INCIDENT' | 'MANAGEMENT_REVIEW' | 'EMPLOYEE' | 'SUPPLIER' | 'OTHER';
export type IncidentStatus = 'REPORTED' | 'ASSESSED' | 'RESOLVED' | 'CLOSED';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface CorrectiveAction {
  id: string;
  description: string;
  responsible_id: string;
  due_date: string | null;
  status: ActionStatus;
  completed_at: string | null;
}

export interface Nonconformity {
  id: string;
  number: number;
  title: string;
  description: string;
  source: FindingSource;
  detected_on: string;
  reported_by: string;
  responsible_id: string | null;
  status: NcStatus;
  correction: string | null;
  root_cause: string | null;
  effectiveness_review: string | null;
  effectiveness_verified_by: string | null;
  effectiveness_verified_at: string | null;
  not_relevant_reason: string | null;
  audit_item: { ref: string; audit: { title: string } } | null;
  incident: { number: number; title: string } | null;
  actions: CorrectiveAction[];
}

export interface Incident {
  id: string;
  number: number;
  title: string;
  description: string;
  occurred_at: string;
  reported_at: string;
  reported_by: string;
  responsible_id: string | null;
  affects_confidentiality: boolean;
  affects_integrity: boolean;
  affects_availability: boolean;
  severity: Severity;
  status: IncidentStatus;
  is_security_incident: boolean | null;
  assessment: string | null;
  response: string | null;
  lessons_learned: string | null;
  evidence: string | null;
  nonconformities: { id: string; number: number }[];
}

export interface RegistersState {
  nonconformities: Nonconformity[];
  incidents: Incident[];
  members: Member[];
  summary: {
    nonconformities: { total: number; open: number; resolved: number; notRelevant: number };
    correctiveActions: { total: number; done: number };
    incidents: { total: number; security: number; open: number };
  };
  permissions: Permissions;
}

// ─── Trainings ─────────────────────────────────────────────────

export type TrainingStatus = 'PROPOSED' | 'APPROVED' | 'SCHEDULED' | 'PERFORMED' | 'CANCELLED';

export interface Training {
  id: string;
  title: string;
  skills: string;
  method: string | null;
  provider: string | null;
  planned_date: string | null;
  performed_date: string | null;
  status: TrainingStatus;
  participant_ids: string[];
  evidence: string | null;
  effectiveness: string | null;
  source_step_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
}

export interface TrainingsState {
  trainings: Training[];
  members: Member[];
  pendingNeeds: { source_key: string; step_title: string; row: { user_id: string; skills: string; training?: string } }[];
  counters: { approved: number; scheduled: number; performed: number; proposed: number };
  documents: DocumentInstance[];
  completion: RiskRegisterCompletion;
  permissions: Permissions;
}

// ─── Objectives ────────────────────────────────────────────────

export interface Objective {
  id: string;
  order: number;
  title: string;
  type: 'TOP_LEVEL' | 'OPERATIONAL';
  action_plan: string | null;
  resources: string | null;
  responsible_id: string | null;
  due_date: string | null;
  measurement: string | null;
  frequency: Frequency;
  status: 'DRAFT' | 'APPROVED';
  approved_by: string | null;
  approved_at: string | null;
  measurements: { id: string; measured_on: string; result: string; achieved: boolean; comment: string | null }[];
}

export interface ObjectivesState {
  objectives: Objective[];
  members: Member[];
  counters: { approved: number; awaiting: number };
  documents: DocumentInstance[];
  completion: RiskRegisterCompletion;
  permissions: Permissions;
}

// ─── Internal audit ────────────────────────────────────────────

export type AuditStatus = 'PLANNED' | 'IN_PROGRESS' | 'REPORTED' | 'APPROVED';
export type AuditResult = 'CONFORMING' | 'MINOR_NONCONFORMITY' | 'MAJOR_NONCONFORMITY' | 'OBSERVATION' | 'NOT_AUDITED';

export interface AuditItem {
  id: string;
  order: number;
  ref: string;
  requirement: string;
  question: string;
  result: AuditResult | null;
  evidence: string | null;
  nonconformity: { id: string; number: number; status: NcStatus } | null;
}

export interface Audit {
  id: string;
  title: string;
  scope: string;
  criteria: string;
  start_date: string;
  end_date: string;
  lead_auditor_id: string;
  auditees: string | null;
  status: AuditStatus;
  conclusion: string | null;
  approved_by: string | null;
  approved_at: string | null;
  items: AuditItem[];
}

export interface AuditsState {
  audits: Audit[];
  members: Member[];
  counters: { planned: number; inProgress: number; approved: number };
  documents: DocumentInstance[];
  completion: RiskRegisterCompletion;
  permissions: Permissions;
}

// ─── Management review ─────────────────────────────────────────

export interface ReviewItem { key: string; title: string; materials?: string; mandatory?: boolean }

export interface ReviewSetupState {
  setup: {
    frequency: Frequency;
    next_review_date: string | null;
    reviewer_ids: string[];
    items: ReviewItem[];
    configured_at: string | null;
  };
  isoInputs: ReviewItem[];
  members: Member[];
  completion: RiskRegisterCompletion;
  permissions: Permissions;
}

export type DecisionType = 'IMPROVEMENT' | 'ISMS_CHANGE' | 'RESOURCES' | 'OTHER';

export interface Review {
  id: string;
  title: string;
  review_date: string;
  participant_ids: string[];
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
  conclusions: string | null;
  completed_at: string | null;
  inputs: { id: string; item_key: string; title: string; summary: string; notes: string | null; discussed: boolean }[];
  decisions: { id: string; type: DecisionType; description: string; responsible_id: string | null; due_date: string | null; status: ActionStatus }[];
}

export interface ReviewsState {
  reviews: Review[];
  setup: ReviewSetupState['setup'] | null;
  members: Member[];
  counters: { planned: number; late: number; completed: number };
  documents: DocumentInstance[];
  completion: RiskRegisterCompletion;
  permissions: Permissions;
}

const get = async <T>(url: string) => (await apiClient.get(url)).data as T;
const post = async <T>(url: string, body?: unknown) => (await apiClient.post(url, body)).data as T;
const patch = async <T>(url: string, body: unknown) => (await apiClient.patch(url, body)).data as T;
const put = async <T>(url: string, body: unknown) => (await apiClient.put(url, body)).data as T;
const del = async <T>(url: string) => (await apiClient.delete(url)).data as T;

export const registersApi = {
  get: (p: string) => get<RegistersState>(`/projects/${p}/registers`),
  createNc: (p: string, d: Record<string, unknown>) => post<RegistersState>(`/projects/${p}/nonconformities`, d),
  updateNc: (p: string, id: string, d: Record<string, unknown>) => patch<RegistersState>(`/projects/${p}/nonconformities/${id}`, d),
  addAction: (p: string, id: string, d: Record<string, unknown>) => post<RegistersState>(`/projects/${p}/nonconformities/${id}/actions`, d),
  updateAction: (p: string, id: string, a: string, d: Record<string, unknown>) => patch<RegistersState>(`/projects/${p}/nonconformities/${id}/actions/${a}`, d),
  removeAction: (p: string, id: string, a: string) => del<RegistersState>(`/projects/${p}/nonconformities/${id}/actions/${a}`),
  resolve: (p: string, id: string, effectiveness_review: string) => post<RegistersState>(`/projects/${p}/nonconformities/${id}/resolve`, { effectiveness_review }),
  notRelevant: (p: string, id: string, reason: string) => post<RegistersState>(`/projects/${p}/nonconformities/${id}/not-relevant`, { reason }),
  reopen: (p: string, id: string) => post<RegistersState>(`/projects/${p}/nonconformities/${id}/reopen`),
  createIncident: (p: string, d: Record<string, unknown>) => post<RegistersState>(`/projects/${p}/incidents`, d),
  updateIncident: (p: string, id: string, d: Record<string, unknown>) => patch<RegistersState>(`/projects/${p}/incidents/${id}`, d),
  ncFromIncident: (p: string, id: string) => post<RegistersState>(`/projects/${p}/incidents/${id}/nonconformity`),
};

export const trainingsApi = {
  get: (s: string) => get<TrainingsState>(`/steps/${s}/trainings`),
  create: (s: string, d: Record<string, unknown>) => post<TrainingsState>(`/steps/${s}/trainings`, d),
  importNeeds: (s: string) => post<TrainingsState>(`/steps/${s}/trainings/import`),
  update: (s: string, id: string, d: Record<string, unknown>) => patch<TrainingsState>(`/steps/${s}/trainings/${id}`, d),
  approve: (s: string, id: string) => post<TrainingsState>(`/steps/${s}/trainings/${id}/approve`),
  remove: (s: string, id: string) => del<TrainingsState>(`/steps/${s}/trainings/${id}`),
  document: (s: string) => post<TrainingsState>(`/steps/${s}/trainings/document`),
};

export const objectivesApi = {
  get: (s: string) => get<ObjectivesState>(`/steps/${s}/objectives`),
  create: (s: string, d: Record<string, unknown>) => post<ObjectivesState>(`/steps/${s}/objectives`, d),
  update: (s: string, id: string, d: Record<string, unknown>) => patch<ObjectivesState>(`/steps/${s}/objectives/${id}`, d),
  remove: (s: string, id: string) => del<ObjectivesState>(`/steps/${s}/objectives/${id}`),
  confirm: (s: string) => post<ObjectivesState>(`/steps/${s}/objectives/confirm`),
  measure: (s: string, id: string, d: Record<string, unknown>) => post<ObjectivesState>(`/steps/${s}/objectives/${id}/measurements`, d),
  document: (s: string) => post<ObjectivesState>(`/steps/${s}/objectives/document`),
};

export const auditsApi = {
  get: (s: string) => get<AuditsState>(`/steps/${s}/audits`),
  create: (s: string, d: Record<string, unknown>) => post<AuditsState>(`/steps/${s}/audits`, d),
  update: (s: string, id: string, d: Record<string, unknown>) => patch<AuditsState>(`/steps/${s}/audits/${id}`, d),
  remove: (s: string, id: string) => del<AuditsState>(`/steps/${s}/audits/${id}`),
  start: (s: string, id: string) => post<AuditsState>(`/steps/${s}/audits/${id}/start`),
  updateItem: (s: string, id: string, item: string, d: Record<string, unknown>) => patch<AuditsState>(`/steps/${s}/audits/${id}/items/${item}`, d),
  report: (s: string, id: string, conclusion: string) => post<AuditsState>(`/steps/${s}/audits/${id}/report`, { conclusion }),
  approve: (s: string, id: string) => post<AuditsState>(`/steps/${s}/audits/${id}/approve`),
  document: (s: string) => post<AuditsState>(`/steps/${s}/audits/document`),
};

export const reviewsApi = {
  getSetup: (s: string) => get<ReviewSetupState>(`/steps/${s}/review-setup`),
  saveSetup: (s: string, d: Record<string, unknown>) => put<ReviewSetupState>(`/steps/${s}/review-setup`, d),
  get: (s: string) => get<ReviewsState>(`/steps/${s}/reviews`),
  create: (s: string, d: Record<string, unknown>) => post<ReviewsState>(`/steps/${s}/reviews`, d),
  update: (s: string, id: string, d: Record<string, unknown>) => patch<ReviewsState>(`/steps/${s}/reviews/${id}`, d),
  refresh: (s: string, id: string) => post<ReviewsState>(`/steps/${s}/reviews/${id}/refresh`),
  updateInput: (s: string, id: string, input: string, d: Record<string, unknown>) => patch<ReviewsState>(`/steps/${s}/reviews/${id}/inputs/${input}`, d),
  addDecision: (s: string, id: string, d: Record<string, unknown>) => post<ReviewsState>(`/steps/${s}/reviews/${id}/decisions`, d),
  updateDecision: (s: string, id: string, dec: string, d: Record<string, unknown>) => patch<ReviewsState>(`/steps/${s}/reviews/${id}/decisions/${dec}`, d),
  removeDecision: (s: string, id: string, dec: string) => del<ReviewsState>(`/steps/${s}/reviews/${id}/decisions/${dec}`),
  complete: (s: string, id: string) => post<ReviewsState>(`/steps/${s}/reviews/${id}/complete`),
  document: (s: string) => post<ReviewsState>(`/steps/${s}/reviews/document`),
};
