import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, ProjectRole, TaskStatus, TaskType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { sameContent } from '../common/services/step-document.service';
import { TasksService } from '../tasks/tasks.service';
import type { ProseMirrorNode } from './templates/doc-control.template';
import { renderPdf } from './pdf-renderer';
import { controlBlock, loadControlData } from './control-block';

/** First publication is version 1.0; each later one raises the minor number. */
const nextVersion = (previous: string | undefined) => {
  if (!previous) return '1.0';
  const [major, minor] = previous.split('.').map(Number);
  return `${major || 0}.${(minor || 0) + 1}`;
};

/** File name safe for every operating system, keeping the document title readable. */
export const fileName = (title: string, version: string, ext: string) =>
  `${title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()} v${version}.${ext}`;

const PERSON = { select: { id: true, first_name: true, last_name: true } } as const;
const fullName = (u: { first_name: string; last_name: string; email?: string } | null) =>
  u ? `${u.first_name} ${u.last_name}`.trim() || u.email || '' : '';

/**
 * The document library (clauses 7.5.2 and 7.5.3). A document reaches the
 * library through its approver: when the document has an approver other than
 * the person submitting it, submitting sends it for approval and the approver
 * publishes it; otherwise the person submitting approves it. Every published
 * version is kept with its PDF.
 */
@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly tasks: TasksService,
  ) {}

  /** "Submit to library": publishes, or sends the document to its approver. */
  async submit(documentId: string, userId: string, notes?: string, ipAddress?: string, userAgent?: string) {
    const doc = await this.load(documentId);
    if (doc.status === 'IN_REVIEW') throw new BadRequestException('This document is already waiting for approval');
    this.assertChanged(doc);

    if (!doc.approver_id || doc.approver_id === userId) {
      return this.publish(doc, userId, userId, notes, ipAddress, userAgent);
    }

    await this.prisma.documentInstance.update({
      where: { id: documentId },
      data: { status: 'IN_REVIEW', review_requested_by: userId, review_notes: notes?.trim() || null },
    });
    await this.tasks.create({
      projectId: doc.projectId,
      organizationId: doc.organizationId,
      stepId: doc.step_id,
      documentId,
      assignedTo: doc.approver_id,
      assignedBy: userId,
      type: TaskType.APPROVE_DOCUMENT,
      notes: `Review "${doc.title}" and approve it for the library, or request changes.${notes?.trim() ? `\nWhat changed: ${notes.trim()}` : ''}`,
      deadline: null,
    }, ipAddress, userAgent);
    await this.log(userId, documentId, { action: 'sent_for_approval', approver: doc.approver_id }, ipAddress, userAgent);
    return { status: 'IN_REVIEW' as const };
  }

  /** The approver approves: the document is published under their name. */
  async approve(documentId: string, userId: string, ipAddress?: string, userAgent?: string) {
    const doc = await this.load(documentId);
    this.assertApprover(doc, userId);
    const task = await this.openApprovalTask(documentId);
    const result = await this.publish(doc, doc.review_requested_by ?? userId, userId, doc.review_notes ?? undefined, ipAddress, userAgent);
    if (task) await this.tasks.complete(task.id, userId, `Approved, published as version ${result.version}`);
    return result;
  }

  /** The approver sends the document back with what to change. */
  async requestChanges(documentId: string, userId: string, comment: string, ipAddress?: string, userAgent?: string) {
    const doc = await this.load(documentId);
    this.assertApprover(doc, userId);
    await this.backToDraft(documentId);
    const task = await this.openApprovalTask(documentId);
    if (task) await this.tasks.complete(task.id, userId, `Changes requested: ${comment.trim()}`);
    await this.log(userId, documentId, { action: 'changes_requested', comment }, ipAddress, userAgent);
    return { status: 'DRAFT' as const };
  }

  /** Whoever sent it (or the project lead) takes it back to edit it. */
  async withdraw(documentId: string, userId: string, ipAddress?: string, userAgent?: string) {
    const doc = await this.load(documentId);
    if (doc.status !== 'IN_REVIEW') throw new BadRequestException('This document is not waiting for approval');
    const lead = await this.prisma.projectMember.count({ where: { project_id: doc.projectId, user_id: userId, privilege: ProjectRole.PROJECT_LEAD } });
    if (doc.review_requested_by !== userId && !lead) {
      throw new ForbiddenException('Only the person who sent it, or the project lead, can withdraw it');
    }
    await this.backToDraft(documentId);
    const task = await this.openApprovalTask(documentId);
    if (task) await this.tasks.cancelLinked(task.id, userId);
    await this.log(userId, documentId, { action: 'approval_withdrawn' }, ipAddress, userAgent);
    return { status: 'DRAFT' as const };
  }

  async getPdf(documentId: string, version: string) {
    const v = await this.prisma.documentVersion.findFirst({
      where: { document_id: documentId, version },
      select: { pdf_data: true, document: { select: { title: true } } },
    });
    if (!v?.pdf_data) throw new NotFoundException('PDF not found');
    return { buffer: Buffer.from(v.pdf_data), filename: fileName(v.document.title, version, 'pdf') };
  }

  /** Documents with at least one published version, grouped by the client per project and phase. */
  async getLibrary(orgId: string, userId: string) {
    return this.prisma.documentInstance.findMany({
      where: {
        versions: { some: {} },
        step: { phase: { project: { organization_id: orgId, members: { some: { user_id: userId } } } } },
      },
      select: {
        id: true,
        title: true,
        status: true,
        version: true,
        template: { select: { name: true, code: true } },
        owner: PERSON,
        step: {
          select: {
            id: true,
            title: true,
            order: true,
            phase: { select: { name: true, order: true, project: { select: { id: true, name: true } } } },
          },
        },
        versions: {
          orderBy: { published_at: 'desc' },
          select: { version: true, published_at: true, notes: true, publisher: PERSON, approver: PERSON },
        },
      },
      orderBy: [{ step: { phase: { order: 'asc' } } }, { step: { order: 'asc' } }],
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private async publish(
    doc: Awaited<ReturnType<LibraryService['load']>>,
    publishedBy: string,
    approvedBy: string,
    notes?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    this.assertChanged(doc);
    const approver = await this.prisma.user.findUnique({ where: { id: approvedBy }, select: { first_name: true, last_name: true, email: true } });
    const version = nextVersion(doc.versions[0]?.version);
    const publishedAt = new Date();
    // The PDF opens with the live document control data, including this new version.
    const control = await loadControlData(this.prisma, doc.id);
    control!.history.unshift({ version, date: publishedAt, approvedBy: fullName(approver), notes: notes?.trim() || null });
    const body = doc.content as unknown as ProseMirrorNode;
    const pdf = await renderPdf({ type: 'doc', content: [...controlBlock(control!), ...(body.content ?? [])] }, {
      title: doc.title,
      organization: doc.organizationName,
      version,
      publishedAt,
      approvedBy: fullName(approver),
    });

    await this.prisma.$transaction([
      this.prisma.documentInstance.update({
        where: { id: doc.id },
        data: { status: 'PUBLISHED', version, review_requested_by: null, review_notes: null },
      }),
      this.prisma.documentVersion.create({
        data: {
          document_id: doc.id,
          version,
          content: doc.content as Prisma.InputJsonValue,
          pdf_data: new Uint8Array(pdf),
          published_at: publishedAt,
          published_by: publishedBy,
          approved_by: approvedBy,
          notes: notes?.trim() || null,
        },
      }),
    ]);

    await this.auditLog.log({
      userId: approvedBy,
      action: AuditAction.DOCUMENT_PUBLISHED,
      entityType: 'document_instance',
      entityId: doc.id,
      details: { version, notes, approved_by: approvedBy },
      ipAddress,
      userAgent,
    });
    return { status: 'PUBLISHED' as const, version };
  }

  private async load(documentId: string) {
    const doc = await this.prisma.documentInstance.findUnique({
      where: { id: documentId },
      include: {
        versions: { orderBy: { published_at: 'desc' }, take: 1, select: { version: true, content: true } },
        step: { select: { phase: { select: { project: { select: { id: true, organization_id: true, organization: { select: { name: true } } } } } } } },
      },
    });
    if (!doc?.step) throw new NotFoundException('Document not found');
    const project = doc.step.phase.project;
    return { ...doc, projectId: project.id, organizationId: project.organization_id, organizationName: project.organization.name };
  }

  private assertChanged(doc: { content: unknown; versions: { version: string; content: unknown }[] }) {
    const previous = doc.versions[0];
    if (previous && sameContent(previous.content, doc.content)) {
      throw new BadRequestException(`This content is already in the library as version ${previous.version}`);
    }
  }

  private assertApprover(doc: { status: string; approver_id: string | null }, userId: string) {
    if (doc.status !== 'IN_REVIEW') throw new BadRequestException('This document is not waiting for approval');
    if (doc.approver_id !== userId) throw new ForbiddenException('Only the approver of this document can decide');
  }

  private backToDraft(documentId: string) {
    return this.prisma.documentInstance.update({
      where: { id: documentId },
      data: { status: 'DRAFT', review_requested_by: null, review_notes: null },
    });
  }

  private openApprovalTask(documentId: string) {
    return this.prisma.taskAssignment.findFirst({
      where: { document_instance_id: documentId, type: TaskType.APPROVE_DOCUMENT, status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] } },
      orderBy: { created_at: 'desc' },
    });
  }

  private log(userId: string, documentId: string, details: Prisma.JsonObject, ipAddress?: string, userAgent?: string) {
    return this.auditLog.log({ userId, action: AuditAction.DOCUMENT_UPDATED, entityType: 'document_instance', entityId: documentId, details, ipAddress, userAgent });
  }
}
