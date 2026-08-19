import apiClient from './api-client';

// Types
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_email_verified: boolean;
}

export interface AuthResponse {
  user: User;
}

// Authentication API
export const authApi = {
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

  verifyEmail: async (token: string): Promise<{ message: string }> => {
    const response = await apiClient.get(`/auth/verify-email?token=${token}`);
    return response.data;
  },

  login: async (data: {
    email: string;
    password: string;
  }): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },

  logout: async (): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },

  refreshToken: async (): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/refresh');
    return response.data;
  },

  getCsrfToken: async (): Promise<{ csrfToken: string }> => {
    const response = await apiClient.get('/csrf/token');
    return response.data;
  },

  requestPasswordReset: async (email: string): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/password-reset-request', {
      email,
    });
    return response.data;
  },

  verifyResetCode: async (
    email: string,
    reset_code: string,
  ): Promise<{ message: string; valid: boolean }> => {
    const response = await apiClient.post('/auth/verify-reset-code', {
      email,
      reset_code,
    });
    return response.data;
  },

  resetPassword: async (
    email: string,
    reset_code: string,
    new_password: string,
  ): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/reset-password', {
      email,
      reset_code,
      new_password,
    });
    return response.data;
  },

  resendResetCode: async (email: string): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/resend-reset-code', { email });
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  resendVerificationEmail: async (): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/resend-verification');
    return response.data;
  },

  resendVerificationCode: async (email: string): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/resend-verification-code', {
      email,
    });
    return response.data;
  },

  getSessions: async (): Promise<
    Array<{
      id: string;
      deviceName: string;
      ipAddress: string;
      lastActivity: string;
      isCurrentSession: boolean;
      createdAt: string;
    }>
  > => {
    const response = await apiClient.get('/auth/sessions');
    return response.data;
  },

  revokeSession: async (sessionId: string): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/sessions/revoke', {
      sessionId,
    });
    return response.data;
  },

  logoutAll: async (): Promise<{ message: string; count: number }> => {
    const response = await apiClient.post('/auth/logout-all');
    return response.data;
  },
};
