import { ConflictException, Injectable } from '@nestjs/common';
import { isDeepStrictEqual } from 'util';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';
import type { ProseMirrorNode } from '../../documents/templates/doc-control.template';

/** Compares document contents as stored (JSON), ignoring key order. */
export const sameContent = (stored: unknown, next: unknown) =>
  isDeepStrictEqual(JSON.parse(JSON.stringify(stored ?? null)), JSON.parse(JSON.stringify(next ?? null)));

/**
 * Output documents of register steps (requirements register, risk report,
 * SoA, training plan, objectives, audit report, review minutes). A step has at
 * most one document (document_instances.step_id is unique); regenerating
 * refreshes its content and, when the content changed, makes it a draft again
 * so the next library submission publishes a new version.
 */
@Injectable()
export class StepDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async upsert(d: {
    stepId: string;
    templateCode: string;
    templateName: string;
    templateDescription: string;
    title: string;
    content: ProseMirrorNode;
    userId: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const template = await this.prisma.documentTemplate.upsert({
      where: { code: d.templateCode },
      update: {},
      create: { code: d.templateCode, name: d.templateName, description: d.templateDescription },
    });
    const existing = await this.prisma.documentInstance.findUnique({ where: { step_id: d.stepId } });
    if (existing?.status === 'IN_REVIEW' && !sameContent(existing.content, d.content)) {
      throw new ConflictException('This document is waiting for approval: withdraw it first to update it');
    }
    const doc = existing
      ? await this.prisma.documentInstance.update({
          where: { id: existing.id },
          data: {
            content: d.content as unknown as Prisma.InputJsonValue,
            last_edited_by: d.userId,
            ...(!sameContent(existing.content, d.content) && { status: 'DRAFT' as const }),
          },
        })
      : await this.prisma.documentInstance.create({
          data: {
            template_id: template.id,
            step_id: d.stepId,
            title: d.title,
            status: 'DRAFT',
            version: '0.1',
            content: d.content as unknown as Prisma.InputJsonValue,
            created_by: d.userId,
            last_edited_by: d.userId,
          },
        });
    await this.auditLog.log({
      userId: d.userId,
      action: existing ? AuditAction.DOCUMENT_UPDATED : AuditAction.DOCUMENT_CREATED,
      entityType: 'document_instance',
      entityId: doc.id,
      details: { action: 'generate_step_document', template: d.templateCode, ...d.details },
      ipAddress: d.ipAddress,
      userAgent: d.userAgent,
    });
    return doc;
  }

  async list(stepId: string) {
    return this.prisma.documentInstance.findMany({ where: { step_id: stepId } });
  }

  /** Whether the step's document exists and was generated after the last change of its data. */
  async status(stepId: string, lastChange: Date | null) {
    const doc = await this.prisma.documentInstance.findUnique({ where: { step_id: stepId }, select: { updated_at: true } });
    return { exists: !!doc, upToDate: !!doc && (!lastChange || doc.updated_at >= lastChange) };
  }
}

export const latest = (dates: (Date | null | undefined)[]) =>
  dates.filter((d): d is Date => !!d).reduce<Date | null>((max, d) => (!max || d > max ? d : max), null);

export const formatDate = (d: Date | null | undefined) =>
  d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : '—';
