import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditAction } from '@prisma/client';
import { Prisma } from '@prisma/client';

export interface AuditLogData {
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  details?: Prisma.JsonValue | null;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an audit log entry
   */
  async log(data: AuditLogData): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          user_id: data.userId || null,
          action: data.action,
          entity_type: data.entityType,
          entity_id: data.entityId || null,
          details: data.details === null ? undefined : data.details,
          ip_address: data.ipAddress || null,
          user_agent: data.userAgent || null,
        },
      });

      this.logger.debug(
        `Audit log created: ${data.action} for ${data.entityType} by ${data.userId || 'anonymous'}`,
      );
    } catch (error) {
      this.logger.error('Failed to create audit log:', error);
      // Audit logging must never break the application
    }
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserLogs(userId: string, limit: number = 50) {
    return this.prisma.auditLog.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  /**
   * Get audit logs for a specific entity
   */
  async getEntityLogs(
    entityType: string,
    entityId: string,
    limit: number = 50,
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        entity_type: entityType,
        entity_id: entityId,
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }
}
