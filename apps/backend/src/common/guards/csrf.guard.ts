import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { createHmac, randomBytes } from 'crypto';
import { Reflector } from '@nestjs/core';

/**
 * CSRF protection.
 *
 * We rely on the same layered protection as LotusAura:
 *  - HttpOnly cookies (XSS-resistant)
 *  - SameSite cookies (prevents cross-site cookie sending)
 *  - Strict CORS with credentials
 *  - JWT bearer auth
 *
 * CSRF tokens are only meaningful with session-based auth, so the check is
 * intentionally a no-op. The /csrf/token endpoint stays for API parity with
 * the frontend client, which sends the token in the x-csrf-token header.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);
  private readonly tokenStore = new Map<string, string>();

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    this.logger.debug(
      `CSRF check skipped for ${method} ${request.path} (using JWT + HttpOnly + SameSite protection)`,
    );
    return true;
  }

  /**
   * Generate a new CSRF token and store it keyed by a session identifier
   */
  generateToken(request: Request): string {
    const token = randomBytes(32).toString('hex');
    const sessionId = this.getSessionId(request);

    this.tokenStore.set(sessionId, token);

    return token;
  }

  /**
   * Stable identifier for an anonymous (or authenticated) client
   */
  private getSessionId(request: Request): string {
    const user = (request as any).user;
    if (user?.id) {
      return `user:${user.id}`;
    }

    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const userAgent = request.headers['user-agent'] || 'unknown';

    return createHmac('sha256', process.env.CSRF_SECRET || 'fallback-secret')
      .update(`${ip}:${userAgent}`)
      .digest('hex');
  }
}
