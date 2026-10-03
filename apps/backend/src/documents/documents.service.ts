import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma, ProjectRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { sameContent } from '../common/services/step-document.service';
import { CreateDocumentDto, UpdateDocumentContentDto, UpdateDocumentAssignmentsDto } from './dto/document.dto';
import {
  DOC_CONTROL_TEMPLATE_CODE,
  WizardAnswers,
  generateDocControlContent,
  tidyPunctuation,
} from './templates/doc-control.template';
import {
  PROJECT_PLAN_TEMPLATE_CODE,
  generateProjectPlanContent,
} from './templates/project-plan.template';
import {
  REQ_IDENTIFICATION_TEMPLATE_CODE,
  generateReqIdentificationContent,
} from './templates/req-identification.template';
import {
  ISMS_SCOPE_TEMPLATE_CODE,
  generateIsmsScopeContent,
} from './templates/isms-scope.template';
import {
  SECURITY_POLICY_TEMPLATE_CODE,
  generateSecurityPolicyContent,
} from './templates/security-policy.template';
import {
  RISK_METHODOLOGY_TEMPLATE_CODE,
  generateRiskMethodologyContent,
} from './templates/risk-methodology.template';

const PERSON = { id: true, email: true, first_name: true, last_name: true } as const;
export const WAITING_FOR_APPROVAL = 'This document is waiting for approval: withdraw it first to change it';

/** Map step keys to their template code and content generator. */
const STEP_TEMPLATE_MAP: Record<string, { code: string; generate: typeof generateDocControlContent }> = {
  'iso27001.p1s2.doc-control': { code: DOC_CONTROL_TEMPLATE_CODE, generate: generateDocControlContent },
  'iso27001.p1s3.project-plan': { code: PROJECT_PLAN_TEMPLATE_CODE, generate: generateProjectPlanContent },
  'iso27001.p1s4.req-identification': { code: REQ_IDENTIFICATION_TEMPLATE_CODE, generate: generateReqIdentificationContent },
  'iso27001.p1s6.isms-scope': { code: ISMS_SCOPE_TEMPLATE_CODE, generate: generateIsmsScopeContent },
  'iso27001.p1s7.security-policy': { code: SECURITY_POLICY_TEMPLATE_CODE, generate: generateSecurityPolicyContent },
  'iso27001.p2s1.risk-methodology': { code: RISK_METHODOLOGY_TEMPLATE_CODE, generate: generateRiskMethodologyContent },
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getTemplate(code: string) {
    const template = await this.prisma.documentTemplate.findUnique({
      where: { code },
      include: {
        questions: { orderBy: [{ wizard_page: 'asc' }, { order: 'asc' }] },
      },
    });

    if (!template) {
      throw new NotFoundException('Document template not found');
    }

    return template;
  }

  async createFromWizard(
    projectId: string,
    stepId: string,
    dto: CreateDocumentDto,
    userId: string,
    userRole: ProjectRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (
      userRole !== ProjectRole.PROJECT_LEAD &&
      userRole !== ProjectRole.PROJECT_MEMBER
    ) {
      throw new ForbiddenException('Only project members can create documents');
    }

    const step = await this.prisma.projectStep.findUnique({
      where: { id: stepId },
      include: {
        phase: { select: { project_id: true } },
        document_instance: true,
      },
    });

    if (!step || step.phase.project_id !== projectId) {
      throw new NotFoundException('Step not found');
    }
    if (step.type !== 'DOCUMENT') {
      throw new BadRequestException('This step does not produce a document');
    }
    if (step.document_instance) {
      throw new ConflictException('A document already exists for this step');
    }

    const stepMapping = STEP_TEMPLATE_MAP[step.key];
    if (!stepMapping) {
      throw new BadRequestException(`No document template configured for step "${step.key}"`);
    }

    const template = await this.getTemplate(stepMapping.code);

    const project = await this.prisma.complianceProject.findUnique({
      where: { id: projectId },
      select: { organization: { select: { name: true } } },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Resolve raw wizard answers (PERSON answers arrive as user ids) into
    // the strings that will be placed into the document.
    const members = await this.prisma.projectMember.findMany({
      where: { project_id: projectId },
      include: {
        user: { select: { first_name: true, last_name: true } },
      },
    });
    const resolvePerson = (id: string): string | undefined => {
      const member = members.find((m) => m.user_id === id);
      return member ? `${member.user.first_name} ${member.user.last_name}` : undefined;
    };

    const resolved: WizardAnswers = {};
    for (const question of template.questions) {
      const raw = dto.answers?.[question.key];
      if (typeof raw !== 'string' || !raw.trim()) continue;
      resolved[question.key] =
        question.input_type === 'PERSON'
          ? resolvePerson(raw.trim()) ?? ''
          : raw.trim();
    }
    // The organization name is real data provided by the user — safe to use
    // as a fallback for the company name.
    if (!resolved.company_name) {
      resolved.company_name = project.organization.name;
    }

    const content = tidyPunctuation(stepMapping.generate(resolved, {
      organizationName: project.organization.name,
    }));

    // Calculate deadline from step metadata if available
    let deadline: Date | undefined;
    const meta = step.metadata_json as Record<string, unknown> | null;
    if (meta && typeof meta.estimated_days === 'number') {
      deadline = new Date();
      deadline.setDate(deadline.getDate() + meta.estimated_days);
    }

    const instance = await this.prisma.documentInstance.create({
      data: {
        template_id: template.id,
        title: template.name,
        content: content as unknown as Prisma.InputJsonObject,
        answers: (dto.answers ?? {}) as Prisma.InputJsonObject,
        created_by: userId,
        step_id: stepId,
        ...(deadline && { deadline }),
        // The wizard's control answers become the document's control data.
        code: resolved.document_code?.slice(0, 50) || null,
        ...(resolved.confidentiality_level && { confidentiality: resolved.confidentiality_level.slice(0, 50) }),
        ...(members.some((m) => m.user_id === dto.answers?.approver) && { approver_id: dto.answers.approver }),
      },
    });

    await this.auditLog.log({
      userId,
      action: AuditAction.DOCUMENT_CREATED,
      entityType: 'document_instance',
      entityId: instance.id,
      details: { projectId, stepId, templateCode: template.code, title: instance.title },
      ipAddress,
      userAgent,
    });

    return instance;
  }

  /** Loads a document with its people and published versions; access is checked by ProjectRoleGuard. */
  private async loadDocument(documentId: string) {
    const instance = await this.prisma.documentInstance.findUnique({
      where: { id: documentId },
      include: {
        template: { select: { code: true, name: true, version: true } },
        creator: { select: PERSON },
        last_editor: { select: PERSON },
        owner: { select: PERSON },
        reviewer: { select: PERSON },
        approver: { select: PERSON },
        review_requester: { select: PERSON },
        step: { include: { phase: { select: { project_id: true, name: true } } } },
        versions: {
          orderBy: { published_at: 'desc' },
          select: { version: true, published_at: true, notes: true, publisher: { select: PERSON }, approver: { select: PERSON } },
        },
      },
    });
    if (!instance?.step) throw new NotFoundException('Document not found');
    return { ...instance, projectId: instance.step.phase.project_id };
  }

  async findOne(documentId: string) {
    const { projectId: _projectId, ...instance } = await this.loadDocument(documentId);
    return instance;
  }

  /** Saving changed content of a published document starts its next revision (status back to draft). */
  async updateContent(
    documentId: string,
    dto: UpdateDocumentContentDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const content = dto.content as unknown as { type?: string; content?: unknown };
    if (content.type !== 'doc' || !Array.isArray(content.content)) {
      throw new BadRequestException('Invalid document structure');
    }
    const existing = await this.prisma.documentInstance.findUnique({ where: { id: documentId } });
    if (!existing) throw new NotFoundException('Document not found');
    if (sameContent(existing.content, dto.content)) return existing;
    if (existing.status === 'IN_REVIEW') throw new ConflictException(WAITING_FOR_APPROVAL);

    const updated = await this.prisma.documentInstance.update({
      where: { id: documentId },
      data: { content: dto.content as Prisma.InputJsonObject, last_edited_by: userId, status: 'DRAFT' },
    });

    await this.auditLog.log({
      userId,
      action: AuditAction.DOCUMENT_UPDATED,
      entityType: 'document_instance',
      entityId: updated.id,
      details: { title: updated.title },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  async updateAssignments(documentId: string, dto: UpdateDocumentAssignmentsDto, userId: string) {
    const { projectId, status, approver_id } = await this.loadDocument(documentId);
    if (status === 'IN_REVIEW' && dto.approver_id !== undefined && dto.approver_id !== approver_id) {
      throw new ConflictException(WAITING_FOR_APPROVAL);
    }
    const people = [dto.owner_id, dto.reviewer_id, dto.approver_id].filter((id): id is string => !!id);
    if (people.length) {
      const members = await this.prisma.projectMember.count({ where: { project_id: projectId, user_id: { in: people } } });
      if (members !== new Set(people).size) throw new BadRequestException('Owner, reviewer and approver must be project members');
    }

    const updated = await this.prisma.documentInstance.update({
      where: { id: documentId },
      data: {
        owner_id: dto.owner_id,
        reviewer_id: dto.reviewer_id,
        approver_id: dto.approver_id,
        update_interval: dto.update_interval,
        ...(dto.code !== undefined && { code: dto.code.trim() || null }),
        ...(dto.confidentiality !== undefined && { confidentiality: dto.confidentiality.trim() }),
        last_edited_by: userId,
      },
      include: { owner: { select: PERSON }, reviewer: { select: PERSON }, approver: { select: PERSON } },
    });
    return updated;
  }

  /**
   * Only a document that never reached the library can be deleted: published
   * versions are records that must be retained (clause 7.5.3).
   */
  async deleteDocument(documentId: string, userId: string, ipAddress?: string, userAgent?: string) {
    const { projectId, title, versions } = await this.loadDocument(documentId);
    if (versions.length) {
      throw new ConflictException('This document has versions in the library and cannot be deleted. Edit it and submit a new version instead.');
    }

    await this.prisma.documentInstance.delete({ where: { id: documentId } });

    await this.auditLog.log({
      userId,
      action: AuditAction.DOCUMENT_UPDATED,
      entityType: 'document_instance',
      entityId: documentId,
      details: { projectId, title, action: 'deleted' },
      ipAddress,
      userAgent,
    });

    return { message: 'Document deleted' };
  }
}
