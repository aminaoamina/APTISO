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
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
    is_email_verified: boolean;
  };
  sessionId: string;
  tokens: AuthTokens;
}

export interface PublicUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_email_verified: boolean;
}
