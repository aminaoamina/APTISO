import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EvidenceKind } from '@prisma/client';
import archiver from 'archiver';
import type { Writable } from 'stream';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { DocxExportService } from '../documents/docx-export.service';
import { fileName } from '../documents/file-name';
import { EvidenceService } from '../evidence/evidence.service';
import type { ProseMirrorNode } from '../documents/templates/doc-control.template';
import { buildWorkbook, Sheet } from './excel';
import { REGISTERS, RegisterKey, registerSheets } from './registers';

export interface LibraryExportOptions {
  /** Earlier library versions (PDF) in an "Earlier versions" folder of each document. */
  earlierVersions: boolean;
  /** Current files of the evidence, in Evidence/<what it proves>/. */
  evidence: boolean;
}

/** Characters that no operating system accepts in a folder or file name. */
const safe = (name: string) => name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Untitled';
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Exports for the auditor: registers as Excel (one workbook per register,
 * or all of them) and the whole library as a ZIP with the master list of
 * documents. Every export is recorded in the audit log.
 */
@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly docx: DocxExportService,
    private readonly evidence: EvidenceService,
    private readonly auditLog: AuditLogService,
  ) {}

  async registers(projectId: string, register: string, userId: string) {
    if (register !== 'all' && !REGISTERS.includes(register as RegisterKey)) throw new BadRequestException(`Unknown register "${register}"`);
    const project = await this.project(projectId);
    const keys = register === 'all' ? REGISTERS : [register as RegisterKey];
    const sheets = await this.sheets(projectId, keys);
    const buffer = await buildWorkbook(sheets, project.organization.name);
    await this.log(userId, projectId, { export: 'registers', register });
    const title = register === 'all' ? 'Registers' : sheets[0].name;
    return { buffer, filename: `${safe(project.name)} - ${title} ${today()}.xlsx` };
  }

  /** Streams the ZIP to `out` as it is built, so large libraries never sit in memory. */
  async library(projectId: string, options: LibraryExportOptions, userId: string, out: Writable) {
    const project = await this.project(projectId);
    const zip = archiver('zip', { zlib: { level: 6 } });
    zip.pipe(out);

    zip.append(await buildWorkbook(await this.sheets(projectId, ['documents']), project.organization.name), { name: 'Master list of documents.xlsx' });
    zip.append(await buildWorkbook(await this.sheets(projectId, REGISTERS), project.organization.name), { name: 'Registers.xlsx' });

    const docs = await this.prisma.documentInstance.findMany({
      where: { step: { phase: { project_id: projectId } }, versions: { some: {} } },
      select: {
        id: true, title: true,
        step: { select: { phase: { select: { order: true, name: true } } } },
        versions: { orderBy: { published_at: 'desc' }, select: { version: true, content: true, pdf_data: true } },
      },
      orderBy: [{ step: { phase: { order: 'asc' } } }, { step: { order: 'asc' } }],
    });
    for (const doc of docs) {
      const folder = `${safe(`${doc.step!.phase.order} ${doc.step!.phase.name}`)}/${safe(doc.title)}`;
      const [current, ...earlier] = doc.versions;
      if (current.pdf_data) zip.append(Buffer.from(current.pdf_data), { name: `${folder}/${fileName(doc.title, current.version, 'pdf')}` });
      // Word is the editable copy of the approved version (not of a newer draft).
      const word = await this.docx.exportDocument(doc.id, current.content as unknown as ProseMirrorNode);
      zip.append(word.buffer, { name: `${folder}/${fileName(doc.title, current.version, 'docx')}` });
      if (options.earlierVersions) {
        for (const v of earlier) {
          if (v.pdf_data) zip.append(Buffer.from(v.pdf_data), { name: `${folder}/Earlier versions/${fileName(doc.title, v.version, 'pdf')}` });
        }
      }
    }

    if (options.evidence) {
      for (const e of await this.evidence.list(projectId)) {
        if (e.kind !== EvidenceKind.FILE || !e.files[0]) continue;
        const proves = safe(e.links[0]?.label ?? 'Not linked');
        const { buffer } = await this.evidence.download(e.id);
        zip.append(buffer, { name: `Evidence/${proves}/${safe(e.title)} - ${safe(e.files[0].file_name)}` });
      }
    }

    await this.log(userId, projectId, { export: 'library', documents: docs.length, ...options });
    await zip.finalize();
  }

  async libraryFileName(projectId: string) {
    return `${safe((await this.project(projectId)).name)} - ISO 27001 library ${today()}.zip`;
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private sheets(projectId: string, keys: readonly RegisterKey[]) {
    return registerSheets(this.prisma, projectId, keys, { evidence: () => this.evidenceSheet(projectId) });
  }

  private async evidenceSheet(projectId: string): Promise<Sheet[]> {
    const items = await this.evidence.list(projectId);
    const name = (u: { first_name: string; last_name: string }) => `${u.first_name} ${u.last_name}`.trim();
    return [{
      name: 'Evidence',
      columns: [
        { header: 'Title', width: 34 }, { header: 'Type', width: 8 }, { header: 'What it proves', width: 50 }, { header: 'Collected on', width: 13 },
        { header: 'Valid until', width: 13 }, { header: 'Added by', width: 20 }, { header: 'File / link', width: 34 }, { header: 'SHA-256', width: 20 }, { header: 'Description', width: 40 },
      ],
      rows: items.map(e => [
        e.title, e.kind.charAt(0) + e.kind.slice(1).toLowerCase(), e.links.map(l => l.label).join('\n'), e.collected_on, e.valid_until, name(e.creator),
        e.url ?? e.files[0]?.file_name, e.files[0]?.sha256, e.description,
      ]),
    }];
  }

  private async project(projectId: string) {
    const project = await this.prisma.complianceProject.findUnique({ where: { id: projectId }, select: { name: true, organization: { select: { name: true } } } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private log(userId: string, projectId: string, details: Record<string, string | number | boolean>) {
    return this.auditLog.log({ userId, action: AuditAction.DATA_EXPORTED, entityType: 'compliance_project', entityId: projectId, details });
  }
}
