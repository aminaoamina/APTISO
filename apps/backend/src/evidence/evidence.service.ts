import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EvidenceKind, EvidenceTargetType, Prisma, TaskType } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { ISO_REQUIREMENTS } from '../audit-prep/iso-requirements';
import { FileStorage } from './file-storage';
import { CreateEvidenceDto, EvidenceTargetDto, UpdateEvidenceDto } from './evidence.dto';
import { TASK_TYPE_LABELS } from '../tasks/task-labels';

export const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;

/** Accepted file types, decided by extension; the stored type never comes from the browser. */
const FILE_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.eml': 'message/rfc822',
  '.zip': 'application/zip',
};
export const EVIDENCE_EXTENSIONS = Object.keys(FILE_TYPES);

const CLAUSES = new Set(ISO_REQUIREMENTS.map(r => r.ref));
const PERSON = { select: { id: true, first_name: true, last_name: true } } as const;

const EVIDENCE_INCLUDE = {
  creator: PERSON,
  files: {
    orderBy: { uploaded_at: 'desc' },
    select: { id: true, file_name: true, mime_type: true, size_bytes: true, sha256: true, uploaded_at: true, uploader: PERSON },
  },
  links: { select: { id: true, target_type: true, target_id: true } },
} satisfies Prisma.EvidenceInclude;

type UploadedFile = { originalname: string; buffer: Buffer; size: number };

/**
 * Evidence: files, links and notes that prove a clause, a control or a task
 * is done. It is a record (clause 7.5.3): files are kept unchanged and
 * identified by their SHA-256.
 */
@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(projectId: string, dto: CreateEvidenceDto, file: UploadedFile | undefined, userId: string, ipAddress?: string, userAgent?: string) {
    if (dto.kind === EvidenceKind.FILE && !file) throw new BadRequestException('Choose the file to upload');
    if (dto.kind !== EvidenceKind.FILE && file) throw new BadRequestException('Only file evidence carries a file');
    if (dto.kind === EvidenceKind.NOTE && !dto.description?.trim()) throw new BadRequestException('Write the note');
    if (dto.valid_until && dto.valid_until < dto.collected_on) throw new BadRequestException('"Valid until" cannot be before the collection date');
    const targets = await this.resolveTargets(projectId, dto.links);
    const stored = file ? await this.store(projectId, file) : null;

    const evidence = await this.prisma.evidence.create({
      data: {
        project_id: projectId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        kind: dto.kind,
        url: dto.kind === EvidenceKind.LINK ? dto.url : null,
        collected_on: new Date(dto.collected_on),
        valid_until: dto.valid_until ? new Date(dto.valid_until) : null,
        created_by: userId,
        links: { create: targets.map(t => ({ target_type: t.type, target_id: t.id })) },
        ...(stored && { files: { create: { ...stored, uploaded_by: userId } } }),
      },
      include: EVIDENCE_INCLUDE,
    });
    await this.log(userId, evidence.id, { action: 'evidence_added', kind: dto.kind, links: targets.length, sha256: stored?.sha256 }, ipAddress, userAgent);
    return evidence;
  }

  /** The project's evidence, optionally only what is linked to one target, with readable link labels. */
  async list(projectId: string, target?: { type: EvidenceTargetType; id: string }) {
    const items = await this.prisma.evidence.findMany({
      where: {
        project_id: projectId,
        deleted_at: null,
        ...(target && { links: { some: { target_type: target.type, target_id: target.id } } }),
      },
      include: EVIDENCE_INCLUDE,
      orderBy: { collected_on: 'desc' },
    });
    const labels = await this.linkLabels(items.flatMap(e => e.links));
    return items.map(e => ({ ...e, links: e.links.map(l => ({ ...l, label: labels.get(`${l.target_type}:${l.target_id}`) ?? l.target_id })) }));
  }

  async update(evidenceId: string, dto: UpdateEvidenceDto, userId: string) {
    const evidence = await this.load(evidenceId);
    const collected = dto.collected_on ?? evidence.collected_on.toISOString().slice(0, 10);
    const validUntil = dto.valid_until === undefined ? evidence.valid_until?.toISOString().slice(0, 10) : dto.valid_until;
    if (validUntil && validUntil < collected) throw new BadRequestException('"Valid until" cannot be before the collection date');
    await this.prisma.evidence.update({
      where: { id: evidenceId },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.description !== undefined && { description: dto.description.trim() || null }),
        ...(dto.collected_on !== undefined && { collected_on: new Date(dto.collected_on) }),
        ...(dto.valid_until !== undefined && { valid_until: dto.valid_until ? new Date(dto.valid_until) : null }),
      },
    });
    await this.log(userId, evidenceId, { action: 'evidence_updated', fields: Object.keys(dto) });
    return { message: 'Updated' };
  }

  /** A new file becomes the current one; the earlier file stays available as a version. */
  async replaceFile(evidenceId: string, file: UploadedFile | undefined, userId: string, ipAddress?: string, userAgent?: string) {
    const evidence = await this.load(evidenceId);
    if (evidence.kind !== EvidenceKind.FILE) throw new BadRequestException('Only file evidence has a file');
    if (!file) throw new BadRequestException('Choose the new file');
    const stored = await this.store(evidence.project_id, file);
    await this.prisma.evidenceFile.create({ data: { ...stored, evidence_id: evidenceId, uploaded_by: userId } });
    await this.log(userId, evidenceId, { action: 'evidence_file_replaced', sha256: stored.sha256 }, ipAddress, userAgent);
    return { message: 'File replaced' };
  }

  /** Withdrawn evidence leaves every list but its record (and files) are kept. */
  async withdraw(evidenceId: string, reason: string, userId: string, ipAddress?: string, userAgent?: string) {
    await this.load(evidenceId);
    await this.prisma.evidence.update({
      where: { id: evidenceId },
      data: { deleted_at: new Date(), deleted_by: userId, delete_reason: reason.trim() },
    });
    await this.log(userId, evidenceId, { action: 'evidence_withdrawn', reason }, ipAddress, userAgent);
    return { message: 'Withdrawn' };
  }

  /** Links existing evidence to one more requirement (the same proof often covers several). */
  async link(evidenceId: string, target: EvidenceTargetDto, userId: string) {
    const evidence = await this.load(evidenceId);
    const targets = await this.resolveTargets(evidence.project_id, [target]);
    await this.prisma.evidenceLink.createMany({
      data: targets.map(t => ({ evidence_id: evidenceId, target_type: t.type, target_id: t.id })),
      skipDuplicates: true,
    });
    await this.log(userId, evidenceId, { action: 'evidence_linked', target_type: target.type, target_id: target.id });
    return this.prisma.evidence.findUniqueOrThrow({ where: { id: evidenceId }, include: EVIDENCE_INCLUDE });
  }

  async unlink(evidenceId: string, linkId: string, userId: string) {
    const link = await this.prisma.evidenceLink.findFirst({ where: { id: linkId, evidence_id: evidenceId } });
    if (!link) throw new NotFoundException('Link not found');
    await this.prisma.evidenceLink.delete({ where: { id: linkId } });
    await this.log(userId, evidenceId, { action: 'evidence_unlinked', target_type: link.target_type, target_id: link.target_id });
    return { message: 'Unlinked' };
  }

  /** The current file, or an earlier version. */
  async download(evidenceId: string, fileId?: string) {
    await this.load(evidenceId);
    const file = await this.prisma.evidenceFile.findFirst({
      where: { evidence_id: evidenceId, ...(fileId && { id: fileId }) },
      orderBy: { uploaded_at: 'desc' },
    });
    if (!file) throw new NotFoundException('File not found');
    return { buffer: await this.storage.read(file.storage_key), filename: file.file_name, mimeType: file.mime_type };
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private async store(projectId: string, file: UploadedFile) {
    const ext = extname(file.originalname).toLowerCase();
    const mime = FILE_TYPES[ext];
    if (!mime) throw new BadRequestException(`This file type is not accepted. Allowed: ${EVIDENCE_EXTENSIONS.join(' ')}`);
    if (file.size > MAX_EVIDENCE_BYTES) throw new BadRequestException('The file is larger than 25 MB');
    const key = `${projectId}/${randomUUID()}${ext}`;
    await this.storage.put(key, file.buffer);
    return {
      storage_key: key,
      file_name: file.originalname.slice(0, 255),
      mime_type: mime,
      size_bytes: file.size,
      sha256: createHash('sha256').update(file.buffer).digest('hex'),
    };
  }

  /**
   * Every target must belong to the project. Evidence for an "Implement
   * control" task also proves the control itself, so it is linked to both.
   */
  private async resolveTargets(projectId: string, targets: EvidenceTargetDto[]) {
    const resolved = new Map<string, EvidenceTargetDto>();
    const add = (t: EvidenceTargetDto) => resolved.set(`${t.type}:${t.id}`, t);
    for (const t of targets) {
      if (t.type === EvidenceTargetType.CLAUSE) {
        if (!CLAUSES.has(t.id)) throw new BadRequestException(`Unknown ISO 27001 clause "${t.id}"`);
      } else if (t.type === EvidenceTargetType.SOA_CONTROL) {
        const row = await this.prisma.soaControl.findFirst({ where: { id: t.id, step: { phase: { project_id: projectId } } }, select: { id: true } });
        if (!row) throw new BadRequestException('This control is not in the project\'s Statement of Applicability');
      } else {
        const task = await this.prisma.taskAssignment.findFirst({ where: { id: t.id, project_id: projectId }, select: { id: true, type: true } });
        if (!task) throw new BadRequestException('This task is not in the project');
        if (task.type === TaskType.IMPLEMENT_CONTROL) {
          const row = await this.prisma.soaControl.findFirst({ where: { task_id: task.id }, select: { id: true } });
          if (row) add({ type: EvidenceTargetType.SOA_CONTROL, id: row.id });
        }
      }
      add(t);
    }
    return [...resolved.values()];
  }

  private async linkLabels(links: { target_type: EvidenceTargetType; target_id: string }[]) {
    const ids = (type: EvidenceTargetType) => [...new Set(links.filter(l => l.target_type === type).map(l => l.target_id))];
    const [rows, tasks] = await Promise.all([
      this.prisma.soaControl.findMany({ where: { id: { in: ids(EvidenceTargetType.SOA_CONTROL) } }, select: { id: true, control: { select: { code: true, title: true } } } }),
      this.prisma.taskAssignment.findMany({ where: { id: { in: ids(EvidenceTargetType.TASK) } }, select: { id: true, type: true, notes: true, step: { select: { title: true } } } }),
    ]);
    const labels = new Map<string, string>();
    for (const r of ISO_REQUIREMENTS) labels.set(`${EvidenceTargetType.CLAUSE}:${r.ref}`, `Clause ${r.ref} ${r.requirement}`);
    for (const r of rows) labels.set(`${EvidenceTargetType.SOA_CONTROL}:${r.id}`, `${r.control.code} ${r.control.title}`);
    for (const t of tasks) {
      labels.set(`${EvidenceTargetType.TASK}:${t.id}`, `Task: ${TASK_TYPE_LABELS[t.type]} – ${t.step?.title ?? t.notes?.split('\n')[0] ?? ''}`);
    }
    return labels;
  }

  private async load(evidenceId: string) {
    const evidence = await this.prisma.evidence.findFirst({ where: { id: evidenceId, deleted_at: null } });
    if (!evidence) throw new NotFoundException('Evidence not found');
    return evidence;
  }

  private log(userId: string, evidenceId: string, details: Prisma.JsonObject, ipAddress?: string, userAgent?: string) {
    return this.auditLog.log({ userId, action: AuditAction.PROJECT_UPDATED, entityType: 'evidence', entityId: evidenceId, details, ipAddress, userAgent });
  }
}
