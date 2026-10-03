import apiClient from './api-client';

// ============================================================
// Types
// ============================================================

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  bio: string | null;
  job_title: string | null;
  timezone: string | null;
  is_active: boolean;
  is_email_verified?: boolean;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  members?: OrganizationMember[];
  _count?: { members: number; projects: number; invitations: number };
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'ORG_OWNER' | 'ORG_ADMIN' | 'ORG_MEMBER';
  created_at: string;
  user: { id: string; email: string; first_name: string; last_name: string; is_active?: boolean };
}

export interface ComplianceFramework {
  id: string;
  code: string;
  name: string;
  description: string | null;
  version: string | null;
  status: 'AVAILABLE' | 'COMING_SOON';
}

export interface ComplianceProject {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: 'PLANNING' | 'IN_PROGRESS' | 'CERTIFIED' | 'ON_HOLD';
  start_date: string | null;
  target_date: string | null;
  compliance_framework_id: string;
  compliance_framework?: ComplianceFramework;
  created_by: string;
  created_at: string;
  organization?: { id: string; name: string };
  members?: ProjectMember[];
  phases?: ProjectPhase[];
  _count?: { members: number; phases: number };
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  privilege: 'PROJECT_LEAD' | 'PROJECT_AUDITOR' | 'PROJECT_MEMBER';
  custom_role: string | null;
  joined_at: string;
  user: { id: string; email: string; first_name: string; last_name: string };
  iso_roles: { iso_role: string }[];
}

export interface ProjectPhase {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  order: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  started_at: string | null;
  completed_at: string | null;
  steps?: ProjectStep[];
}

export interface ProjectStep {
  id: string;
  phase_id: string;
  key: string;
  title: string;
  purpose: string | null;
  type: 'EDUCATIONAL' | 'DOCUMENT' | 'REGISTER';
  order: number;
  status: 'NOT_STARTED' | 'COMPLETED';
  completed_at: string | null;
  metadata_json?: {
    clause?: string | null;
    workload_hours?: number;
    estimated_days?: number;
    mandatory?: boolean;
    // Phase 3 policy steps generated from the Statement of Applicability
    policy_key?: string;
    controls?: string[];
    required?: boolean;
    why?: string;
    generated_from_soa?: boolean;
  } | null;
  completion_data?: {
    proceed?: boolean | null;
    needs_awareness?: boolean;
    awareness_people?: string[];
    needs_training?: boolean;
    training_name?: string;
    training_people?: string[];
    needs_technology?: boolean;
    technology_notes?: string;
    needs_hr?: boolean;
    hr_notes?: string;
    needs_finance?: boolean;
    finance_notes?: string;
  } | null;
  document_instance?: {
    id: string;
    status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED';
    version: string;
    updated_at: string;
    deadline?: string | null;
    update_interval?: number | null;
    owner_id?: string | null;
    reviewer_id?: string | null;
    approver_id?: string | null;
    owner?: { id: string; first_name: string; last_name: string; email: string } | null;
    reviewer?: { id: string; first_name: string; last_name: string; email: string } | null;
    approver?: { id: string; first_name: string; last_name: string; email: string } | null;
    /** How many versions are in the library. */
    _count?: { versions: number };
  } | null;
}

export interface DocumentTemplateQuestion {
  id: string;
  template_id: string;
  key: string;
  label: string;
  help_text: string | null;
  input_type: 'TEXT' | 'LONGTEXT' | 'PERSON' | 'SELECT' | 'DATE';
  required: boolean;
  options: string[] | null;
  wizard_page: number;
  order: number;
}

export interface DocumentTemplate {
  id: string;
  code: string;
  name: string;
  version: string;
  description: string | null;
  questions: DocumentTemplateQuestion[];
}

// ProseMirror/Tiptap structured document node
export interface ProseMirrorNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
}

export interface DocumentInstance {
  id: string;
  template_id: string;
  step_id: string | null;
  title: string;
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED';
  version: string;
  content: ProseMirrorNode;
  answers: Record<string, string> | null;
  created_by: string;
  last_edited_by?: string | null;
  owner_id?: string | null;
  reviewer_id?: string | null;
  approver_id?: string | null;
  update_interval?: number | null;
  deadline?: string | null;
  created_at: string;
  updated_at: string;
  template?: { code: string; name: string; version: string };
  creator?: { id: string; email: string; first_name: string; last_name: string };
  last_editor?: { id: string; first_name: string; last_name: string } | null;
  owner?: { id: string; email: string; first_name: string; last_name: string } | null;
  reviewer?: { id: string; email: string; first_name: string; last_name: string } | null;
  approver?: { id: string; email: string; first_name: string; last_name: string } | null;
  step?: {
    id: string;
    title: string;
    phase: { project_id: string; name: string };
  };
  /** Published versions, newest first. */
  versions?: DocumentVersion[];
}

export interface DocumentVersion {
  version: string;
  published_at: string;
  notes?: string | null;
  publisher?: { id: string; first_name: string; last_name: string };
}

/** A library entry: a document with at least one published version. */
export interface LibraryDocument {
  id: string;
  title: string;
  status: DocumentInstance['status'];
  version: string;
  template: { code: string; name: string };
  owner: { id: string; first_name: string; last_name: string } | null;
  approver: { id: string; first_name: string; last_name: string } | null;
  step: {
    id: string;
    title: string;
    order: number;
    phase: { name: string; order: number; project: { id: string; name: string } };
  };
  versions: DocumentVersion[];
}

/** Saves a downloaded file under the name sent by the server. */
function saveBlob(data: BlobPart, type: string, disposition: string | undefined, fallback: string) {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/)?.[1];
  const plain = disposition?.match(/filename="([^"]+)"/)?.[1];
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = encoded ? decodeURIComponent(encoded) : plain ?? fallback;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface Requirement {
  id: string;
  step_id: string;
  requirement_type: 'CONTRACTUAL' | 'LEGAL_REGULATORY' | 'OTHER';
  status: 'NON_COMPLIANT' | 'COMPLIANT';
  interested_party: string;
  description: string;
  responsible_person_id: string;
  related_area?: string | null;
  deadline?: string | null;
  document_stipulating?: string | null;
  date_of_document?: string | null;
  valid_from?: string | null;
  country?: string | null;
  state?: string | null;
  link?: string | null;
  law_regulation_name?: string | null;
  created_at: string;
  updated_at: string;
  responsible_person?: { id: string; first_name: string; last_name: string; email: string };
}

export interface CreateRequirementData {
  requirement_type: 'CONTRACTUAL' | 'LEGAL_REGULATORY' | 'OTHER';
  status: 'NON_COMPLIANT' | 'COMPLIANT';
  interested_party: string;
  description: string;
  responsible_person_id: string;
  related_area?: string;
  deadline?: string;
  document_stipulating?: string;
  date_of_document?: string;
  valid_from?: string;
  country?: string;
  state?: string;
  link?: string;
  law_regulation_name?: string;
}

export type TaskType =
  | 'WORK_ON_DOCUMENT' | 'REVIEW_DOCUMENT' | 'APPROVE_DOCUMENT' | 'AWARENESS_TASK' | 'TRAINING_TASK'
  | 'HR_REQUEST' | 'FINANCE_REQUEST' | 'TECHNOLOGY_REQUEST' | 'RISK_REVIEW' | 'IMPLEMENT_CONTROL'
  | 'CORRECTIVE_ACTION' | 'INTERNAL_AUDIT' | 'MANAGEMENT_REVIEW_ACTION' | 'MANAGEMENT_REVIEW_DUE'
  | 'OBJECTIVES_REVIEW' | 'DOCUMENT_REVIEW' | 'INCIDENTS_REVIEW' | 'TRAININGS_REVIEW';

interface Person { id: string; first_name: string; last_name: string; email?: string }

export interface TaskAssignment {
  id: string;
  project_id: string;
  step_id: string | null;
  document_instance_id: string | null;
  assigned_to: string;
  assigned_by: string;
  type: TaskType;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  deadline: string | null;
  completed_at: string | null;
  notes: string | null;
  completion_notes: string | null;
  created_at: string;
  project: { id: string; name: string; organization_id: string };
  step: { id: string; title: string; key: string } | null;
  document: { id: string; title: string } | null;
  assignee: Person;
  assigner: Person;
}

/** The task fields a notification carries, enough to describe it and link to it. */
export type NotificationTask = Pick<TaskAssignment, 'id' | 'type' | 'status' | 'deadline' | 'notes' | 'project_id' | 'step_id' | 'document_instance_id' | 'project' | 'step' | 'document'>;

export interface AppNotification {
  id: string;
  type: 'ORGANIZATION_JOIN_REQUEST' | 'TASK_ASSIGNED' | 'TASK_COMPLETED' | 'TASK_DUE_SOON' | 'TASK_CANCELLED';
  read_at: string | null;
  created_at: string;
  actor: Person | null;
  organization: { id: string; name: string } | null;
  join_request: { id: string; role: string; status: 'PENDING' | 'ACCEPTED' | 'REJECTED' } | null;
  task_assignment: NotificationTask | null;
}

export interface OrganizationJoinRequest {
  id: string;
  invited_email: string;
  requested_user_id: string | null;
  role: 'ORG_OWNER' | 'ORG_ADMIN' | 'ORG_MEMBER';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  organization: { id: string; name: string };
}

// ============================================================
// Organizations API
// ============================================================

export const organizationsApi = {
  create: async (data: { name: string; description?: string; industry?: string }): Promise<Organization> => {
    const response = await apiClient.post('/organizations', data);
    return response.data;
  },

  list: async (): Promise<Organization[]> => {
    const response = await apiClient.get('/organizations');
    return response.data;
  },

  getOne: async (orgId: string): Promise<Organization> => {
    const response = await apiClient.get(`/organizations/${orgId}`);
    return response.data;
  },

  update: async (orgId: string, data: { name?: string; description?: string; industry?: string }): Promise<Organization> => {
    const response = await apiClient.put(`/organizations/${orgId}`, data);
    return response.data;
  },

  delete: async (orgId: string, data: {
    action: 'DELETE' | 'TRANSFER';
    transfer_to_user_id?: string;
    leave_organization: boolean;
  }): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/organizations/${orgId}`, { data });
    return response.data;
  },

  addMember: async (orgId: string, data: { email: string; role: string }): Promise<OrganizationJoinRequest> => {
    const response = await apiClient.post(`/organizations/${orgId}/members`, data);
    return response.data;
  },

  removeMember: async (orgId: string, memberId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/organizations/${orgId}/members/${memberId}`);
    return response.data;
  },

  leave: async (orgId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/organizations/${orgId}/members/me`);
    return response.data;
  },

  updateMemberRole: async (orgId: string, memberId: string, role: string): Promise<OrganizationMember> => {
    const response = await apiClient.put(`/organizations/${orgId}/members/${memberId}/role`, { role });
    return response.data;
  },

  respondToJoinRequest: async (requestId: string, accept: boolean): Promise<{ message: string }> => {
    const response = await apiClient.post(`/organizations/join-requests/${requestId}/respond`, { accept });
    return response.data;
  },
};

// ============================================================
// Projects API
// ============================================================

export const frameworksApi = {
  list: async (): Promise<ComplianceFramework[]> => {
    const response = await apiClient.get('/frameworks');
    return response.data;
  },
};

export const projectsApi = {
  create: async (orgId: string, data: {
    name: string;
    description?: string;
    start_date?: string;
    target_date?: string;
    framework_id: string;
  }): Promise<ComplianceProject> => {
    const response = await apiClient.post(`/organizations/${orgId}/projects`, data);
    return response.data;
  },

  list: async (orgId: string): Promise<ComplianceProject[]> => {
    const response = await apiClient.get(`/organizations/${orgId}/projects`);
    return response.data;
  },

  getOne: async (projectId: string): Promise<ComplianceProject> => {
    const response = await apiClient.get(`/projects/${projectId}`);
    return response.data;
  },

  update: async (projectId: string, data: {
    name?: string;
    description?: string;
    status?: string;
    start_date?: string;
    target_date?: string;
  }): Promise<ComplianceProject> => {
    const response = await apiClient.put(`/projects/${projectId}`, data);
    return response.data;
  },

  delete: async (projectId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/projects/${projectId}`);
    return response.data;
  },

  updatePhase: async (projectId: string, phaseId: string, status: string): Promise<ProjectPhase> => {
    const response = await apiClient.put(`/projects/${projectId}/phases/${phaseId}`, { status });
    return response.data;
  },

  addMember: async (projectId: string, data: {
    email: string;
    privilege: string;
    custom_role?: string;
  }): Promise<ProjectMember> => {
    const response = await apiClient.post(`/projects/${projectId}/members`, data);
    return response.data;
  },

  removeMember: async (projectId: string, memberId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/projects/${projectId}/members/${memberId}`);
    return response.data;
  },

  assignIsoRoles: async (projectId: string, memberId: string, isoRoles: string[]): Promise<ProjectMember> => {
    const response = await apiClient.put(`/projects/${projectId}/members/${memberId}/iso-roles`, { iso_roles: isoRoles });
    return response.data;
  },

  completeStep: async (
    projectId: string,
    stepId: string,
  ): Promise<{
    step: ProjectStep;
    phase?: Pick<ProjectPhase, 'id' | 'status' | 'started_at' | 'completed_at'> | null;
    project_status?: ComplianceProject['status'] | null;
  }> => {
    const response = await apiClient.put(`/projects/${projectId}/steps/${stepId}/complete`);
    return response.data;
  },

  updateStepCompletionData: async (
    projectId: string,
    stepId: string,
    completionData: Record<string, unknown>,
  ): Promise<ProjectStep> => {
    const response = await apiClient.patch(
      `/projects/${projectId}/steps/${stepId}/completion-data`,
      { completion_data: completionData },
    );
    return response.data;
  },

  updateStepMetadata: async (
    projectId: string,
    stepId: string,
    metadata: Record<string, unknown>,
  ): Promise<ProjectStep> => {
    const response = await apiClient.patch(
      `/projects/${projectId}/steps/${stepId}/metadata`,
      { metadata_json: metadata },
    );
    return response.data;
  },

  sendAwareness: async (
    projectId: string,
    stepId: string,
    data: { materials: { title: string; url?: string }[]; user_ids: string[] },
  ): Promise<ProjectStep> => {
    const response = await apiClient.post(`/projects/${projectId}/steps/${stepId}/awareness`, data);
    return response.data;
  },

  confirmTraining: async (
    projectId: string,
    stepId: string,
    data: { rows: { user_id: string; skills: string; training?: string }[] },
  ): Promise<ProjectStep> => {
    const response = await apiClient.post(`/projects/${projectId}/steps/${stepId}/training`, data);
    return response.data;
  },

  assignTask: async (
    projectId: string,
    stepId: string,
    data: { assigned_to: string; type: TaskType; notes?: string; deadline?: string },
  ): Promise<TaskAssignment> => {
    const response = await apiClient.post(
      `/projects/${projectId}/steps/${stepId}/assign`,
      data,
    );
    return response.data;
  },

  getProjectTasks: async (projectId: string): Promise<TaskAssignment[]> => {
    const response = await apiClient.get(`/projects/${projectId}/tasks`);
    return response.data;
  },

  sendRequest: async (
    projectId: string,
    stepId: string,
    data: { kind: 'hr' | 'finance' | 'technology'; notes: string },
  ): Promise<{ sent_to: number }> => {
    const response = await apiClient.post(`/projects/${projectId}/steps/${stepId}/requests`, data);
    return response.data;
  },
};

// ============================================================
// Documents API (guided document workflow)
// ============================================================

export const documentsApi = {
  getTemplate: async (code: string): Promise<DocumentTemplate> => {
    const response = await apiClient.get(`/document-templates/${code}`);
    return response.data;
  },

  createFromWizard: async (
    projectId: string,
    stepId: string,
    answers: Record<string, string>,
  ): Promise<DocumentInstance> => {
    const response = await apiClient.post(
      `/projects/${projectId}/steps/${stepId}/document`,
      { answers },
    );
    return response.data;
  },

  getOne: async (documentId: string): Promise<DocumentInstance> => {
    const response = await apiClient.get(`/documents/${documentId}`);
    return response.data;
  },

  updateContent: async (
    documentId: string,
    content: ProseMirrorNode,
  ): Promise<DocumentInstance> => {
    const response = await apiClient.patch(`/documents/${documentId}/content`, { content });
    return response.data;
  },

  updateAssignments: async (
    documentId: string,
    data: {
      owner_id?: string | null;
      reviewer_id?: string | null;
      approver_id?: string | null;
      update_interval?: number | null;
    },
  ): Promise<DocumentInstance> => {
    const response = await apiClient.patch(`/documents/${documentId}/assignments`, data);
    return response.data;
  },

  exportDocx: async (documentId: string, content?: ProseMirrorNode): Promise<void> => {
    const response = await apiClient.post(`/documents/${documentId}/export-docx`, {
      ...(content ? { content } : {}),
    }, {
      responseType: 'blob',
    });
    saveBlob(response.data, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      response.headers['content-disposition'], 'document.docx');
  },

  downloadPdf: async (documentId: string, version: string): Promise<void> => {
    const response = await apiClient.get(`/documents/${documentId}/library/${encodeURIComponent(version)}/pdf`, { responseType: 'blob' });
    saveBlob(response.data, 'application/pdf', response.headers['content-disposition'], 'document.pdf');
  },

  publish: async (documentId: string, notes?: string): Promise<{ version: string }> => {
    const response = await apiClient.post(`/documents/${documentId}/publish`, { notes });
    return response.data;
  },

  delete: async (documentId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/documents/${documentId}`);
    return response.data;
  },

  getLibrary: async (orgId: string): Promise<LibraryDocument[]> => {
    const response = await apiClient.get(`/organizations/${orgId}/library`);
    return response.data;
  },
};

// ============================================================
// Requirements API (register of legal/contractual requirements)
// ============================================================

export const requirementsApi = {
  list: async (stepId: string): Promise<Requirement[]> => {
    const response = await apiClient.get(`/steps/${stepId}/requirements`);
    return response.data;
  },

  create: async (stepId: string, data: CreateRequirementData): Promise<Requirement> => {
    const response = await apiClient.post(`/steps/${stepId}/requirements`, data);
    return response.data;
  },

  update: async (requirementId: string, data: Partial<CreateRequirementData>): Promise<Requirement> => {
    const response = await apiClient.patch(`/requirements/${requirementId}`, data);
    return response.data;
  },

  delete: async (requirementId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/requirements/${requirementId}`);
    return response.data;
  },

  getDocument: async (stepId: string): Promise<DocumentInstance | null> => {
    const response = await apiClient.get(`/steps/${stepId}/requirements/document`);
    return response.data;
  },

  createDocument: async (stepId: string): Promise<DocumentInstance> => {
    const response = await apiClient.post(`/steps/${stepId}/requirements/create-document`);
    return response.data;
  },
};

// ============================================================
// Risk Register API (ISO 27001 risk register - p2s2)
// ============================================================

export interface RiskCatalogCategory {
  value: string;
  label: string;
}

export interface UserBrief {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface RiskAsset {
  id: string;
  step_id: string;
  name: string;
  category: string;
  is_custom: boolean;
  order: number;
}

export interface RiskVulnerability {
  id: string;
  step_id: string;
  name: string;
  category: string;
  applicable_controls: string[] | null;
  is_custom: boolean;
}

export interface RiskThreat {
  id: string;
  step_id: string;
  name: string;
  threat_category: string;
  applicable_controls: string[] | null;
  is_custom: boolean;
}

export interface RiskAssetVulnLink {
  id: string;
  asset_id: string;
  vulnerability_id: string;
}

export interface RiskVulnThreatLink {
  id: string;
  asset_id: string;
  vulnerability_id: string;
  threat_id: string;
}

export interface ProjectUserBrief {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  label: string;
  privilege?: 'PROJECT_LEAD' | 'PROJECT_MEMBER' | 'PROJECT_AUDITOR';
}

export type TreatmentOption = 'DECREASE' | 'TRANSFER' | 'AVOID' | 'ACCEPT';

export interface RiskItem {
  id: string;
  step_id: string;
  asset_id: string;
  vulnerability_id: string;
  threat_id: string;
  impact: number | null;
  likelihood: number | null;
  level: number | null;
  acceptability: 'ACCEPTABLE' | 'NOT_ACCEPTABLE' | null;
  risk_owner_id: string | null;
  risk_owner: UserBrief | null;
  asset_owner_id: string | null;
  asset_owner: UserBrief | null;
  existing_controls: string | null;
  comment: string | null;
  department: string | null;
  discarding: boolean;
  status: 'NEW' | 'EDITED' | 'APPROVED';
  has_incidents: boolean;
  is_reviewed: boolean;
  is_evaluated: boolean;
  treatment_option: TreatmentOption | null;
  treatment_description: string | null;
  residual_impact: number | null;
  residual_likelihood: number | null;
  residual_risk: number | null;
  treatment_confirmed: boolean;
  approval_decision: 'PENDING' | 'APPROVED' | 'REJECTED';
  approval_by: string | null;
  approval_at: string | null;
  approval_comment: string | null;
  approval_user: UserBrief | null;
  asset: { id: string; name: string; category: string };
  vulnerability: { id: string; name: string };
  threat: { id: string; name: string; threat_category: string };
  treatment_controls_link: { control: { id: string; code: string; title: string } }[];
}

export interface RiskRegisterState {
  assets: RiskAsset[];
  vulnerabilities: RiskVulnerability[];
  threats: RiskThreat[];
  assetVulnLinks: RiskAssetVulnLink[];
  vulnThreatLinks: RiskVulnThreatLink[];
  risks: RiskItem[];
  projectUsers: ProjectUserBrief[];
  summary: RiskRegisterSummary;
  completion: RiskRegisterCompletion;
  permissions: {
    role: 'PROJECT_LEAD' | 'PROJECT_MEMBER' | 'PROJECT_AUDITOR';
    canEdit: boolean;
    canApproveAny: boolean;
    userId: string;
  };
}

export interface RiskRegisterCompletion {
  ready: boolean;
  items: { key: string; label: string; done: boolean; detail: string }[];
}

export interface RiskRegisterSummary {
  total: number;
  evaluated: number;
  reviewed: number;
  acceptable: number;
  unacceptable: number;
  treated: number;
  approved: number;
  rejected: number;
}

export interface RiskUpdate {
  impact?: number;
  likelihood?: number;
  risk_owner_id?: string | null;
  asset_owner_id?: string | null;
  department?: string;
  existing_controls?: string;
  comment?: string;
  has_incidents?: boolean;
  treatment_option?: TreatmentOption;
  treatment_controls?: string[];
  treatment_description?: string;
  residual_impact?: number | null;
  residual_likelihood?: number | null;
}

export interface RiskSeedData {
  assets: { name: string; category: string }[];
  vulnerabilities: { name: string; category: string }[];
  threats: { name: string; category: string }[];
  controls: { code: string; title: string }[];
  assetCategories: RiskCatalogCategory[];
  scale: { min: number; max: number; maxAcceptableLevel: number; labels: Record<number, string> };
  suggestions: {
    threatsByVulnerability: Record<string, string[]>;
    threatsByAssetCategory: Record<string, string[]>;
    controlsByVulnerability: Record<string, string[]>;
    controlsByThreat: Record<string, string[]>;
  };
}

export const riskApi = {
  getSeed: async (stepId: string): Promise<RiskSeedData> => {
    const response = await apiClient.get(`/steps/${stepId}/risk-register/seed`);
    return response.data;
  },

  getRegister: async (stepId: string): Promise<RiskRegisterState> => {
    const response = await apiClient.get(`/steps/${stepId}/risk-register`);
    return response.data;
  },

  saveAssets: async (stepId: string, data: {
    assetNames: string[];
    customAssets?: { name: string; category: string }[];
  }): Promise<RiskRegisterState> => {
    const response = await apiClient.post(`/steps/${stepId}/risk-register/assets`, data);
    return response.data;
  },

  saveVulnerabilities: async (stepId: string, data: {
    vulnerabilitiesByAsset: Record<string, string[]>;
    customVulnerabilities?: { name: string; category: string; applicable_controls?: string[] }[];
  }): Promise<RiskRegisterState> => {
    const response = await apiClient.post(`/steps/${stepId}/risk-register/vulnerabilities`, data);
    return response.data;
  },

  saveThreats: async (stepId: string, data: {
    threatsByAssetVulnerability: Record<string, string[]>;
    customThreats?: { name: string; threat_category: string; applicable_controls?: string[] }[];
  }): Promise<RiskRegisterState> => {
    const response = await apiClient.post(`/steps/${stepId}/risk-register/threats`, data);
    return response.data;
  },

  generateRisks: async (stepId: string): Promise<RiskRegisterState> => {
    const response = await apiClient.post(`/steps/${stepId}/risk-register/generate`);
    return response.data;
  },

  updateRisk: async (riskId: string, data: RiskUpdate): Promise<RiskRegisterState> => {
    const response = await apiClient.patch(`/risk-register/risks/${riskId}`, data);
    return response.data;
  },

  reviewRisks: async (stepId: string, data: { riskIds: string[]; reviewed?: boolean }): Promise<RiskRegisterState> => {
    const response = await apiClient.post(`/steps/${stepId}/risk-register/review`, data);
    return response.data;
  },

  confirmTreatment: async (riskId: string): Promise<RiskRegisterState> => {
    const response = await apiClient.post(`/risk-register/risks/${riskId}/confirm-treatment`);
    return response.data;
  },

  approveRisk: async (riskId: string, data: {
    approval_decision: 'APPROVED' | 'REJECTED';
    comment?: string;
  }): Promise<RiskRegisterState> => {
    const response = await apiClient.post(`/risk-register/risks/${riskId}/approval`, data);
    return response.data;
  },

  deleteRisk: async (riskId: string): Promise<RiskRegisterState> => {
    const response = await apiClient.delete(`/risk-register/risks/${riskId}`);
    return response.data;
  },

  discardRisk: async (riskId: string): Promise<RiskRegisterState> => {
    const response = await apiClient.post(`/risk-register/risks/${riskId}/discard`);
    return response.data;
  },

  getDocuments: async (stepId: string): Promise<DocumentInstance[]> => {
    const response = await apiClient.get(`/steps/${stepId}/risk-register/documents`);
    return response.data;
  },

  createDocuments: async (stepId: string): Promise<DocumentInstance[]> => {
    const response = await apiClient.post(`/steps/${stepId}/risk-register/create-documents`);
    return response.data;
  },
};

// ============================================================
// Statement of Applicability API (ISO 27001 p2s3)
// ============================================================

export type ControlStatus = 'IMPLEMENTED' | 'UNDERWAY' | 'PLANNED' | 'REVIEW_NEEDED';
export type Decision = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SoaRow {
  id: string;
  step_id: string;
  control_id: string;
  applicable: boolean | null;
  justification: string | null;
  implementation_method: string | null;
  status: ControlStatus | null;
  suggestion: {
    applicable: boolean;
    justification: string;
    method: string | null;
    sources: { risks: { ref: string; label: string }[]; requirements: string[]; setup: string | null };
  } | null;
  is_user_edited: boolean;
  responsible_id: string | null;
  responsible: UserBrief | null;
  deadline: string | null;
  resources: string | null;
  resources_decision: Decision | null;
  resources_comment: string | null;
  resources_decider: UserBrief | null;
  resources_decided_at: string | null;
  task_id: string | null;
  updated_at: string;
  control: { code: string; title: string };
  in_treatment_plan: boolean;
  treated_risks: { ref: string; label: string }[];
  documents: string[];
}

export interface SoaState {
  setup: {
    questions: { key: string; question: string; help: string; excludes: string[] }[];
    answers: Record<string, boolean> | null;
    completedAt: string | null;
  };
  rtpConfirmedAt: string | null;
  rows: SoaRow[];
  approvals: { user: UserBrief; decision: Decision; comment: string | null; decider: UserBrief | null; decided_at: string | null }[];
  projectUsers: ProjectUserBrief[];
  riskRegister: { completed: boolean; risks: number };
  summary: {
    total: number;
    undecided: number;
    unjustified: number;
    applicable: number;
    notApplicable: number;
    implemented: number;
    planned: number;
    applicableIncomplete: number;
    planIncomplete: number;
    resourcesPending: number;
    resourcesRejected: number;
  };
  completion: RiskRegisterCompletion;
  permissions: {
    role: 'PROJECT_LEAD' | 'PROJECT_MEMBER' | 'PROJECT_AUDITOR';
    canEdit: boolean;
    isLead: boolean;
    canApproveResources: boolean;
    userId: string;
  };
}

export interface SoaControlUpdate {
  applicable?: boolean;
  justification?: string;
  implementation_method?: string;
  status?: ControlStatus | null;
  responsible_id?: string | null;
  deadline?: string | null;
  resources?: string;
}

export const soaApi = {
  get: async (stepId: string): Promise<SoaState> =>
    (await apiClient.get(`/steps/${stepId}/soa`)).data,

  saveSetup: async (stepId: string, answers: Record<string, boolean>): Promise<SoaState> =>
    (await apiClient.put(`/steps/${stepId}/soa/setup`, { answers })).data,

  refreshSuggestions: async (stepId: string, overwrite = false): Promise<SoaState> =>
    (await apiClient.post(`/steps/${stepId}/soa/suggestions`, { overwrite })).data,

  updateControl: async (rowId: string, data: SoaControlUpdate): Promise<SoaState> =>
    (await apiClient.patch(`/soa/controls/${rowId}`, data)).data,

  confirmPlan: async (stepId: string): Promise<SoaState> =>
    (await apiClient.post(`/steps/${stepId}/soa/treatment-plan/confirm`)).data,

  decideResources: async (rowId: string, decision: 'APPROVED' | 'REJECTED', comment?: string): Promise<SoaState> =>
    (await apiClient.post(`/soa/controls/${rowId}/resources`, { decision, comment })).data,

  ownerApproval: async (
    stepId: string,
    data: { decision: 'APPROVED' | 'REJECTED'; comment?: string; on_behalf_of?: string },
  ): Promise<SoaState> =>
    (await apiClient.post(`/steps/${stepId}/soa/owner-approval`, data)).data,

  getDocuments: async (stepId: string): Promise<DocumentInstance[]> =>
    (await apiClient.get(`/steps/${stepId}/soa/documents`)).data,

  createDocument: async (stepId: string): Promise<DocumentInstance[]> =>
    (await apiClient.post(`/steps/${stepId}/soa/documents`)).data,
};

// ============================================================
// Security Documentation (Phase 3 policies)
// ============================================================

export interface PolicyInfo {
  policy: { key: string; title: string; purpose: string };
  required: boolean;
  why: string;
  controls: {
    code: string;
    title: string;
    applicable: boolean;
    method: string | null;
    status: ControlStatus | null;
  }[];
}

export const policiesApi = {
  get: async (stepId: string): Promise<PolicyInfo> =>
    (await apiClient.get(`/steps/${stepId}/policy`)).data,

  createDraft: async (stepId: string): Promise<DocumentInstance> =>
    (await apiClient.post(`/steps/${stepId}/policy/draft`)).data,
};

// ============================================================
// Tasks API
// ============================================================

export const tasksApi = {
  mine: async (): Promise<TaskAssignment[]> => (await apiClient.get('/tasks/mine')).data,

  team: async (): Promise<TaskAssignment[]> => (await apiClient.get('/tasks/team')).data,

  complete: async (taskId: string, notes?: string): Promise<TaskAssignment> =>
    (await apiClient.put(`/tasks/${taskId}/complete`, { notes })).data,

  update: async (taskId: string, data: { assigned_to?: string; deadline?: string | null }): Promise<TaskAssignment> =>
    (await apiClient.patch(`/tasks/${taskId}`, data)).data,

  cancel: async (taskId: string): Promise<TaskAssignment> => (await apiClient.post(`/tasks/${taskId}/cancel`)).data,
};

export const notificationsApi = {
  list: async (): Promise<{ items: AppNotification[]; unread_count: number }> => (await apiClient.get('/notifications')).data,

  markRead: async (ids?: string[]): Promise<{ unread_count: number }> =>
    (await apiClient.post('/notifications/read', { ids })).data,
};

// ============================================================
// Auth API
// ============================================================

export const authApi = {
  login: async (data: { email: string; password: string }): Promise<{ user: User }> => {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },

  register: async (data: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    invitation_token?: string;
  }): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  },

  logout: async (): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },

  deleteAccount: async (organizations: Array<{
    organization_id: string;
    action: 'TRANSFER' | 'DELETE';
    transfer_to_user_id?: string;
  }>): Promise<{ message: string }> => {
    const response = await apiClient.delete('/auth/account', {
      data: { organizations },
    });
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  resendVerificationCode: async (email: string): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/resend-verification-code', { email });
    return response.data;
  },

  updateProfile: async (data: {
    first_name?: string;
    last_name?: string;
    email?: string;
    job_title?: string;
    timezone?: string;
    bio?: string;
  }): Promise<User> => {
    const response = await apiClient.put('/auth/profile', data);
    return response.data.user ?? response.data;
  },

  uploadAvatar: async (file: File): Promise<{ avatar_url: string }> => {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await apiClient.post('/auth/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  removeAvatar: async (): Promise<{ message: string }> => {
    const response = await apiClient.delete('/auth/avatar');
    return response.data;
  },

  changePassword: async (data: { current_password: string; new_password: string }): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/change-password', data);
    return response.data;
  },

  getSessions: async (): Promise<Array<{
    id: string;
    deviceName: string;
    deviceType: string;
    ipAddress: string;
    lastActivity: string;
    isCurrentSession: boolean;
    createdAt: string;
  }>> => {
    const response = await apiClient.get('/auth/sessions');
    return response.data;
  },

  requestPasswordReset: async (email: string): Promise<{ message: string; user_exists: boolean }> => {
    const response = await apiClient.post('/auth/password-reset-request', { email });
    return response.data;
  },

  verifyResetCode: async (email: string, code: string): Promise<{ message: string; valid: boolean }> => {
    const response = await apiClient.post('/auth/verify-reset-code', { email, reset_code: code });
    return response.data;
  },

  resetPassword: async (email: string, code: string, new_password: string): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/reset-password', { email, reset_code: code, new_password });
    return response.data;
  },

  resendResetCode: async (email: string): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/resend-reset-code', { email });
    return response.data;
  },

  verifyEmail: async (token: string): Promise<{ message: string }> => {
    const response = await apiClient.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
    return response.data;
  },
};
