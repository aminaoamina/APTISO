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

export interface ComplianceProject {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: 'PLANNING' | 'IN_PROGRESS' | 'CERTIFIED' | 'ON_HOLD';
  start_date: string | null;
  target_date: string | null;
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
}

export interface OrganizationNotification {
  id: string;
  type: 'ORGANIZATION_JOIN_REQUEST';
  created_at: string;
  organization: { id: string; name: string } | null;
  join_request: {
    id: string;
    role: string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
    created_at: string;
  } | null;
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

  notifications: async (): Promise<OrganizationNotification[]> => {
    const response = await apiClient.get('/organizations/notifications');
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

export const projectsApi = {
  create: async (orgId: string, data: {
    name: string;
    description?: string;
    start_date?: string;
    target_date?: string;
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
