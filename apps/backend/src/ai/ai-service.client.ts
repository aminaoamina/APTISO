import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const UNAVAILABLE = 'The AI assistant is not available right now';

export interface CallOptions {
  timeoutMs?: number;
}

/**
 * HTTP client of the AI service (apps/ai). The backend is its only caller: it
 * sends the service token, never the user's login. The AI service being down
 * or misconfigured surfaces as 503 "AI unavailable" and never breaks the rest
 * of the app.
 */
@Injectable()
export class AiServiceClient {
  private readonly logger = new Logger(AiServiceClient.name);
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('AI_SERVICE_URL') || 'http://127.0.0.1:8000').replace(/\/$/, '');
    this.token = config.get<string>('AI_SERVICE_TOKEN') || '';
  }

  get configured() {
    return this.token.length >= 32;
  }

  /** The response whatever its status (health checks read the 503 body too). Throws only when the service cannot be reached. */
  async call<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown, opts: CallOptions = {}): Promise<{ status: number; data: T }> {
    if (!this.configured) throw new ServiceUnavailableException('The AI assistant is not configured (AI_SERVICE_TOKEN)');
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { 'X-Service-Token': this.token, ...(body !== undefined && { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      });
    } catch (e) {
      this.logger.warn(`AI service unreachable: ${method} ${path}: ${(e as Error).name}`);
      throw new ServiceUnavailableException(UNAVAILABLE);
    }
    const data = (await res.json().catch(() => null)) as T;
    if (res.status === 401) this.logger.error('The AI service refused the service token: check AI_SERVICE_TOKEN in both .env files');
    return { status: res.status, data };
  }

  /** The response body of a successful call; errors become 400 (bad request from us) or 503 (AI side). */
  async request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown, opts: CallOptions = {}): Promise<T> {
    const { status, data } = await this.call<T>(method, path, body, opts);
    if (status < 400) return data;
    if (status === 413 || status === 422) {
      throw new BadRequestException(status === 413 ? 'The text is too long for the AI assistant' : 'The AI assistant could not process this request');
    }
    this.logger.warn(`AI service answered ${status} to ${method} ${path}`);
    throw new ServiceUnavailableException(UNAVAILABLE);
  }
}
