export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface UserPayload {
  sub: string;
  email: string;
}

export interface RegisterResponse {
  message: string;
}

export interface LoginResponse {
  user: PublicUser;
  sessionId: string;
  tokens: AuthTokens;
}

export interface PublicUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  bio: string | null;
  job_title: string | null;
  timezone: string | null;
  is_active: boolean;
  is_email_verified: boolean;
  created_at: string;
}
