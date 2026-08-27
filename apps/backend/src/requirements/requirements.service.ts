import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, ProjectRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { CreateRequirementDto, UpdateRequirementDto } from './dto/requirement.dto';
import {
  ProseMirrorNode,
  text,
  paragraph,
  heading,
  table,
} from '../documents/templates/doc-control.template';

interface RequirementRecord {
  id: string;
  requirement_type: string;
  description: string;
  interested_party: string;
  related_area: string | null;
  deadline: Date | null;
  document_stipulating: string | null;
  date_of_document: Date | null;
  valid_from: Date | null;
  country: string | null;
  state: string | null;
  link: string | null;
  law_regulation_name: string | null;
  status: string;
  responsible_person: { first_name: string; last_name: string } | null;
}

@Injectable()
export class RequirementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(stepId: string, userId: string) {
    await this.ensureAccess(stepId, userId);
    return this.prisma.requirement.findMany({
      where: { step_id: stepId },
      include: {
        responsible_person: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async create(
    stepId: string,
    dto: CreateRequirementDto,
    userId: string,
    userRole: ProjectRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (userRole === 'PROJECT_AUDITOR') {
      throw new ForbiddenException('Auditors cannot create requirements');
    }

    await this.ensureAccess(stepId, userId);

    const requirement = await this.prisma.requirement.create({
      data: {
        step_id: stepId,
        ...dto,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        date_of_document: dto.date_of_document ? new Date(dto.date_of_document) : undefined,
        valid_from: dto.valid_from ? new Date(dto.valid_from) : undefined,
      },
      include: {
        responsible_person: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
      },
    });

    await this.auditLog.log({
      userId,
      action: AuditAction.DOCUMENT_UPDATED,
      entityType: 'requirement',
      entityId: requirement.id,
      details: { action: 'created', step_id: stepId, requirement_type: dto.requirement_type },
      ipAddress,
      userAgent,
    });

    return requirement;
  }

  async update(
    requirementId: string,
    dto: UpdateRequirementDto,
    userId: string,
    userRole: ProjectRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (userRole === 'PROJECT_AUDITOR') {
      throw new ForbiddenException('Auditors cannot update requirements');
    }

    const existing = await this.prisma.requirement.findUnique({ where: { id: requirementId } });
    if (!existing) throw new NotFoundException('Requirement not found');

    await this.ensureAccess(existing.step_id, userId);

    const requirement = await this.prisma.requirement.update({
      where: { id: requirementId },
      data: {
        ...dto,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        date_of_document: dto.date_of_document ? new Date(dto.date_of_document) : undefined,
        valid_from: dto.valid_from ? new Date(dto.valid_from) : undefined,
      },
      include: {
        responsible_person: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
      },
    });

    await this.auditLog.log({
      userId,
      action: AuditAction.DOCUMENT_UPDATED,
      entityType: 'requirement',
      entityId: requirementId,
      details: { action: 'updated' },
      ipAddress,
      userAgent,
    });

    return requirement;
  }

  async remove(
    requirementId: string,
    userId: string,
    userRole: ProjectRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (userRole === 'PROJECT_AUDITOR') {
      throw new ForbiddenException('Auditors cannot delete requirements');
    }

    const existing = await this.prisma.requirement.findUnique({ where: { id: requirementId } });
    if (!existing) throw new NotFoundException('Requirement not found');

    await this.ensureAccess(existing.step_id, userId);

    await this.prisma.requirement.delete({ where: { id: requirementId } });

    await this.auditLog.log({
      userId,
      action: AuditAction.DOCUMENT_UPDATED,
      entityType: 'requirement',
      entityId: requirementId,
      details: { action: 'deleted', step_id: existing.step_id },
      ipAddress,
      userAgent,
    });

    return { message: 'Requirement deleted' };
  }

  async getDocumentForStep(stepId: string, userId: string) {
    await this.ensureAccess(stepId, userId);
    return this.prisma.documentInstance.findUnique({
      where: { step_id: stepId },
      include: {
        versions: { orderBy: { published_at: 'desc' }, take: 1 },
        creator: { select: { id: true, first_name: true, last_name: true } },
      },
    });
  }

  async createDocument(
    stepId: string,
    userId: string,
    userRole: ProjectRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (userRole === 'PROJECT_AUDITOR') {
      throw new ForbiddenException('Auditors cannot create documents');
    }

    await this.ensureAccess(stepId, userId);

    const requirements = await this.prisma.requirement.findMany({
      where: { step_id: stepId },
      include: {
        responsible_person: {
          select: { id: true, first_name: true, last_name: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    if (requirements.length === 0) {
      throw new ForbiddenException('Add at least one requirement before creating a report');
    }

    const template = await this.prisma.documentTemplate.findUnique({
      where: { code: 'LEGAL-REGISTER' },
    });
    if (!template) throw new NotFoundException('LEGAL-REGISTER template not found');

    const content = this.buildRegisterContent(requirements as RequirementRecord[]);

    const existing = await this.prisma.documentInstance.findUnique({
      where: { step_id: stepId },
    });

    let doc;

    if (existing) {
      doc = await this.prisma.documentInstance.update({
        where: { id: existing.id },
        data: {
          content: content as never,
          last_edited_by: userId,
        },
      });
    } else {
      doc = await this.prisma.documentInstance.create({
        data: {
          template_id: template.id,
          step_id: stepId,
          title: 'Register of Legal, Contractual, and Other Requirements',
          status: 'DRAFT',
          version: '0.1',
          content: content as never,
          created_by: userId,
          last_edited_by: userId,
        },
      });
    }

    await this.auditLog.log({
      userId,
      action: AuditAction.DOCUMENT_UPDATED,
      entityType: 'document_instance',
      entityId: doc.id,
      details: { requirement_count: requirements.length },
      ipAddress,
      userAgent,
    });

    return this.prisma.documentInstance.findUnique({
      where: { id: doc.id },
      include: {
        versions: { orderBy: { published_at: 'desc' }, take: 1 },
        creator: { select: { id: true, first_name: true, last_name: true } },
      },
    });
  }

  // ─── ProseMirror content builder ───────────────────────────────

  private buildRegisterContent(requirements: RequirementRecord[]): ProseMirrorNode {
    const now = new Date();
    const ds = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    const TYPE_LABELS: Record<string, string> = {
      CONTRACTUAL: 'Contractual',
      LEGAL_REGULATORY: 'Legal/Regulatory',
      OTHER: 'Other',
    };
    const TYPE_ORDER = ['CONTRACTUAL', 'LEGAL_REGULATORY', 'OTHER'] as const;

    const grouped: Record<string, RequirementRecord[]> = {};
    for (const t of TYPE_ORDER) grouped[t] = [];
    for (const r of requirements) grouped[r.requirement_type]?.push(r);

    const content: ProseMirrorNode[] = [
      heading(1, 'Register of Legal, Regulatory and Contractual Requirements'),
      paragraph({ ...text(`Total requirements: ${requirements.length}`), marks: [{ type: 'bold' }] }),
      paragraph(text(`Generated: ${ds}`)),
    ];

    let sectionNum = 1;
    for (const typeKey of TYPE_ORDER) {
      const items = grouped[typeKey];
      if (items.length === 0) continue;

      const label = TYPE_LABELS[typeKey] ?? typeKey;
      content.push(heading(2, `${sectionNum}. ${label} Requirements`));

      const headers = ['#', 'Description', 'Interested Party', 'Related Area', 'Document', 'Responsible', 'Status'];
      const tableRows: ProseMirrorNode[][][] = [
        headers.map(h => [text(h)]),
      ];

      items.forEach((r, i) => {
        const responsible = r.responsible_person
          ? `${r.responsible_person.first_name} ${r.responsible_person.last_name}`
          : '—';
        tableRows.push([
          [text(String(i + 1))],
          [text(r.description || '—')],
          [text(r.interested_party || '—')],
          [text(r.related_area || '—')],
          [text(r.document_stipulating || '—')],
          [text(responsible)],
          [text(r.status === 'COMPLIANT' ? 'Compliant' : 'Non-Compliant')],
        ]);
      });

      content.push(table(tableRows));
      sectionNum++;
    }

    return { type: 'doc', content };
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private async ensureAccess(stepId: string, userId: string) {
    const step = await this.prisma.projectStep.findUnique({
      where: { id: stepId },
      include: {
        phase: {
          include: {
            project: {
              include: {
                members: { where: { user_id: userId } },
              },
            },
          },
        },
      },
    });
    if (!step) throw new NotFoundException('Step not found');
    if (step.phase.project.members.length === 0) {
      throw new ForbiddenException('You are not a member of this project');
    }
    return step;
  }
}
