import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** The drive refused the stored access: the organization must reconnect. */
export class DriveAuthError extends Error {}

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
/** drive.file: APTISO only sees the files and folders it creates itself. */
const SCOPES = 'openid email https://www.googleapis.com/auth/drive.file';

/**
 * Google Drive over its REST API. Only what the mirror needs: sign-in,
 * folders and uploads. Nothing is ever deleted or overwritten in the drive.
 */
@Injectable()
export class GoogleDriveClient {
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  readonly redirectUri: string;

  constructor(config: ConfigService) {
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID');
    this.clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET');
    const backend = (config.get<string>('BACKEND_PUBLIC_URL') || 'http://localhost:4000').replace(/\/$/, '');
    this.redirectUri = `${backend}/${config.get<string>('API_PREFIX') || 'api/v1'}/connectors/google/callback`;
  }

  get configured() {
    return !!this.clientId && !!this.clientSecret;
  }

  authUrl(state: string) {
    const params = new URLSearchParams({
      client_id: this.clientId!,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent', // always returns a refresh token
      state,
    });
    return `${AUTH_URL}?${params}`;
  }

  async exchangeCode(code: string) {
    const tokens = await this.token({ grant_type: 'authorization_code', code, redirect_uri: this.redirectUri });
    if (!tokens.refresh_token) throw new Error('Google did not return a refresh token');
    const me = await this.json<{ email: string }>(USERINFO_URL, { headers: this.auth(tokens.access_token) });
    return { refreshToken: tokens.refresh_token, accessToken: tokens.access_token, email: me.email };
  }

  async accessToken(refreshToken: string) {
    return (await this.token({ grant_type: 'refresh_token', refresh_token: refreshToken })).access_token;
  }

  async createFolder(accessToken: string, name: string, parentId?: string) {
    const folder = await this.json<{ id: string }>(`${FILES_URL}?fields=id`, {
      method: 'POST',
      headers: { ...this.auth(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId && { parents: [parentId] }) }),
    });
    return folder.id;
  }

  async upload(accessToken: string, parentId: string, name: string, mimeType: string, data: Buffer) {
    const boundary = `aptiso${Date.now()}`;
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [parentId] })}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
      data,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const file = await this.json<{ id: string }>(UPLOAD_URL, {
      method: 'POST',
      headers: { ...this.auth(accessToken), 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    return file.id;
  }

  /** Best effort: the stored token is deleted on our side anyway. */
  async revoke(refreshToken: string) {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(refreshToken)}`, { method: 'POST' }).catch(() => undefined);
  }

  // ─── HTTP ────────────────────────────────────────────────────

  private auth(accessToken: string) {
    return { Authorization: `Bearer ${accessToken}` };
  }

  private async token(params: Record<string, string>) {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...params, client_id: this.clientId!, client_secret: this.clientSecret! }),
    });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; error?: string; error_description?: string };
    if (body.error === 'invalid_grant') throw new DriveAuthError('Google refused the stored access (it was revoked or expired)');
    if (!res.ok || !body.access_token) throw new Error(`Google sign-in failed: ${body.error_description ?? body.error ?? res.status}`);
    return body as { access_token: string; refresh_token?: string };
  }

  private async json<T>(url: string, init: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    if (res.status === 401) throw new DriveAuthError('Google refused the access token');
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(`Google Drive error ${res.status}: ${body.error?.message ?? res.statusText}`);
    }
    return res.json() as Promise<T>;
  }
}
