import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SecurityUtil } from '../utils/security.util';
import { UAParser } from 'ua-parser-js';

export interface CreateSessionOptions {
  userId: string;
  refreshToken: string;
  ipAddress?: string;
  userAgent?: string;
  expiresIn?: number; // milliseconds
}

export interface SessionInfo {
  id: string;
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  lastActivity: Date;
  isCurrentSession: boolean;
  createdAt: Date;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new session with device tracking
   */
  async createSession(options: CreateSessionOptions) {
    const {
      userId,
      refreshToken,
      ipAddress,
      userAgent,
      expiresIn = 7 * 24 * 60 * 60 * 1000, // 7 days default
    } = options;

    const deviceInfo = this.parseDeviceInfo(userAgent);
    const refreshTokenHash = SecurityUtil.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + expiresIn);

    const session = await this.prisma.session.create({
      data: {
        user_id: userId,
        refresh_token_hash: refreshTokenHash,
        device_name: deviceInfo.deviceName,
        device_type: deviceInfo.deviceType,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        expires_at: expiresAt,
        last_activity: new Date(),
      },
    });

    this.logger.log(
      `Session created for user ${userId} on ${deviceInfo.deviceName}`,
    );

    return session;
  }

  /**
   * Validate refresh token and get session
   */
  async validateRefreshToken(
    refreshToken: string,
  ): Promise<{ userId: string; sessionId: string } | null> {
    try {
      const tokenHash = SecurityUtil.hashToken(refreshToken);

      const session = await this.prisma.session.findFirst({
        where: {
          refresh_token_hash: tokenHash,
          is_active: true,
          expires_at: {
            gte: new Date(),
          },
        },
      });

      if (!session) {
        return null;
      }

      await this.prisma.session.update({
        where: { id: session.id },
        data: { last_activity: new Date() },
      });

      return {
        userId: session.user_id,
        sessionId: session.id,
      };
    } catch (error) {
      this.logger.error('Failed to validate refresh token:', error);
      return null;
    }
  }

  /**
   * Rotate refresh token (invalidate old, create new)
   */
  async rotateRefreshToken(
    oldSessionId: string,
    newRefreshToken: string,
  ): Promise<void> {
    const newTokenHash = SecurityUtil.hashToken(newRefreshToken);

    await this.prisma.session.update({
      where: { id: oldSessionId },
      data: {
        refresh_token_hash: newTokenHash,
        last_activity: new Date(),
      },
    });

    this.logger.log(`Refresh token rotated for session ${oldSessionId}`);
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    try {
      const session = await this.prisma.session.findFirst({
        where: {
          id: sessionId,
          user_id: userId,
        },
      });

      if (!session) {
        return false;
      }

      await this.prisma.session.update({
        where: { id: sessionId },
        data: { is_active: false },
      });

      this.logger.log(`Session ${sessionId} revoked for user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to revoke session:', error);
      return false;
    }
  }

  /**
   * Revoke the session matching a refresh token (used on logout)
   */
  async revokeByRefreshToken(refreshToken: string): Promise<boolean> {
    try {
      const tokenHash = SecurityUtil.hashToken(refreshToken);

      const session = await this.prisma.session.findFirst({
        where: {
          refresh_token_hash: tokenHash,
          is_active: true,
          expires_at: {
            gte: new Date(),
          },
        },
      });

      if (!session) {
        return false;
      }

      await this.prisma.session.update({
        where: { id: session.id },
        data: { is_active: false },
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to revoke session by refresh token:', error);
      return false;
    }
  }

  /**
   * Revoke all sessions for a user (logout from all devices)
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    try {
      const result = await this.prisma.session.updateMany({
        where: {
          user_id: userId,
          is_active: true,
        },
        data: {
          is_active: false,
        },
      });

      this.logger.log(`All sessions revoked for user ${userId}`);
      return result.count;
    } catch (error) {
      this.logger.error('Failed to revoke all sessions:', error);
      return 0;
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<SessionInfo[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        user_id: userId,
        is_active: true,
        expires_at: {
          gte: new Date(),
        },
      },
      orderBy: {
        last_activity: 'desc',
      },
    });

    return sessions.map((session) => ({
      id: session.id,
      deviceName: session.device_name || 'Unknown Device',
      deviceType: session.device_type || 'unknown',
      ipAddress: session.ip_address || 'Unknown',
      lastActivity: session.last_activity,
      isCurrentSession: session.id === currentSessionId,
      createdAt: session.created_at,
    }));
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await this.prisma.session.deleteMany({
        where: {
          expires_at: {
            lt: new Date(),
          },
        },
      });

      this.logger.log(`Cleaned up ${result.count} expired sessions`);
      return result.count;
    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions:', error);
      return 0;
    }
  }

  /**
   * Parse device information from user agent
   */
  private parseDeviceInfo(userAgent?: string): {
    deviceName: string;
    deviceType: string;
  } {
    if (!userAgent) {
      return {
        deviceName: 'Unknown Device',
        deviceType: 'unknown',
      };
    }

    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    const browser = result.browser.name || 'Unknown Browser';
    const os = result.os.name || 'Unknown OS';
    const device = result.device.type || 'desktop';

    return {
      deviceName: `${browser} on ${os}`,
      deviceType: device,
    };
  }
}
