import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  UpdatePhaseDto,
} from './dto/project.dto';
import {
  ProjectRole,
  OrganizationRole,
  AuditAction,
  FrameworkStatus,
} from '@prisma/client';

const FRAMEWORK_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  version: true,
  status: true,
} as const;

const DEFAULT_PHASES = [
  { name: 'Gap Assessment', description: 'Identify gaps between current state and ISO 27001 requirements', order: 1 },
  { name: 'Risk Assessment', description: 'Identify and evaluate information security risks', order: 2 },
  { name: 'Control Selection', description: 'Select appropriate security controls from Annex A', order: 3 },
  { name: 'Implementation', description: 'Implement selected controls and document policies', order: 4 },
  { name: 'Internal Audit', description: 'Conduct internal audit of the ISMS', order: 5 },
  { name: 'Management Review', description: 'Management review of ISMS performance', order: 6 },
  { name: 'Certification Readiness', description: 'Prepare for external certification audit', order: 7 },
];

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(
    orgId: string,
    dto: CreateProjectDto,
    userId: string,
    userRole: OrganizationRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (
      userRole !== OrganizationRole.ORG_OWNER &&
      userRole !== OrganizationRole.ORG_ADMIN
    ) {
      throw new ForbiddenException('Only owners and admins can create projects');
    }

    this.validateDateRange(dto.start_date, dto.target_date);

    const framework = await this.prisma.complianceFramework.findUnique({
      where: { id: dto.framework_id },
    });

    if (!framework || framework.status !== FrameworkStatus.AVAILABLE) {
      throw new BadRequestException('Selected compliance framework is not available');
    }

    const project = await this.prisma.complianceProject.create({
      data: {
        organization_id: orgId,
        name: dto.name,
        description: dto.description,
        status: dto.status,
        start_date: dto.start_date ? new Date(dto.start_date) : undefined,
        target_date: dto.target_date ? new Date(dto.target_date) : undefined,
        compliance_framework_id: framework.id,
        created_by: userId,
        members: {
          create: {
            user_id: userId,
            privilege: ProjectRole.PROJECT_LEAD,
          },
        },
        phases: {
          createMany: {
            data: DEFAULT_PHASES,
          },
        },
      },
      include: {
        compliance_framework: { select: FRAMEWORK_SELECT },
        members: {
          include: {
            user: {
              select: { id: true, email: true, first_name: true, last_name: true },
            },
            iso_roles: true,
          },
        },
        phases: { orderBy: { order: 'asc' } },
      },
    });

    await this.auditLog.log({
      userId,
      action: AuditAction.PROJECT_CREATED,
      entityType: 'compliance_project',
      entityId: project.id,
      details: { organizationId: orgId, name: project.name },
      ipAddress,
      userAgent,
    });

    return project;
  }

  /**
   * Ensures target date is not before start date. Date-only ISO strings are
   * parsed as UTC midnight on both sides, so comparison stays timezone-safe.
   */
  private validateDateRange(
    startDate?: string | null,
    targetDate?: string | null,
  ): void {
    if (!startDate || !targetDate) return;
    if (new Date(targetDate) < new Date(startDate)) {
      throw new BadRequestException('Target date must be on or after the start date.');
    }
  }

  async findAllForOrg(orgId: string, userId: string) {
    const isMember = await this.prisma.organizationMember.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: orgId,
          user_id: userId,
        },
      },
    });

    if (!isMember) {
      throw new NotFoundException('Organization not found');
    }

    return this.prisma.complianceProject.findMany({
      where: { organization_id: orgId },
      include: {
        compliance_framework: { select: FRAMEWORK_SELECT },
        _count: {
          select: { members: true, phases: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(projectId: string, userId: string) {
    const project = await this.prisma.complianceProject.findUnique({
      where: { id: projectId },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        compliance_framework: { select: FRAMEWORK_SELECT },
        members: {
          include: {
            user: {
              select: { id: true, email: true, first_name: true, last_name: true },
            },
            iso_roles: true,
          },
        },
        phases: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { members: true, phases: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const isOrgMember = await this.prisma.organizationMember.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: project.organization_id,
          user_id: userId,
        },
      },
    });

    if (!isOrgMember) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async update(
    projectId: string,
    dto: UpdateProjectDto,
    userId: string,
    userRole: ProjectRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (userRole !== ProjectRole.PROJECT_LEAD) {
      throw new ForbiddenException('Only the project lead can update the project');
    }

    const project = await this.prisma.complianceProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const effectiveStartDate =
      dto.start_date !== undefined ? dto.start_date : project.start_date?.toISOString();
    const effectiveTargetDate =
      dto.target_date !== undefined ? dto.target_date : project.target_date?.toISOString();
    this.validateDateRange(effectiveStartDate, effectiveTargetDate);

    const updated = await this.prisma.complianceProject.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.start_date !== undefined && { start_date: new Date(dto.start_date) }),
        ...(dto.target_date !== undefined && { target_date: new Date(dto.target_date) }),
      },
      include: {
        compliance_framework: { select: FRAMEWORK_SELECT },
      },
    });

    await this.auditLog.log({
      userId,
      action: AuditAction.PROJECT_UPDATED,
      entityType: 'compliance_project',
      entityId: projectId,
      details: { changes: dto as any },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  async remove(
    projectId: string,
    userId: string,
    userRole: ProjectRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (userRole !== ProjectRole.PROJECT_LEAD) {
      throw new ForbiddenException('Only the project lead can delete the project');
    }

    const project = await this.prisma.complianceProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.prisma.complianceProject.delete({ where: { id: projectId } });

    await this.auditLog.log({
      userId,
      action: AuditAction.PROJECT_DELETED,
      entityType: 'compliance_project',
      entityId: projectId,
      details: { name: project.name, organizationId: project.organization_id },
      ipAddress,
      userAgent,
    });

    return { message: 'Project deleted successfully' };
  }

  async updatePhase(
    projectId: string,
    phaseId: string,
    dto: UpdatePhaseDto,
    userId: string,
    userRole: ProjectRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (
      userRole !== ProjectRole.PROJECT_LEAD &&
      userRole !== ProjectRole.PROJECT_AUDITOR
    ) {
      throw new ForbiddenException('Only leads and auditors can update phases');
    }

    const phase = await this.prisma.projectPhase.findUnique({
      where: { id: phaseId },
    });

    if (!phase || phase.project_id !== projectId) {
      throw new NotFoundException('Phase not found');
    }

    const updateData: any = { status: dto.status };

    if (dto.status === 'IN_PROGRESS' && !phase.started_at) {
      updateData.started_at = new Date();
    }

    if (dto.status === 'COMPLETED' && !phase.completed_at) {
      updateData.completed_at = new Date();
    }

    const updated = await this.prisma.projectPhase.update({
      where: { id: phaseId },
      data: updateData,
    });

    await this.auditLog.log({
      userId,
      action: AuditAction.PHASE_UPDATED,
      entityType: 'project_phase',
      entityId: phaseId,
      details: { projectId, phaseName: phase.name, oldStatus: phase.status, newStatus: dto.status },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  async addProjectMember(
    projectId: string,
    email: string,
    privilege: ProjectRole,
    customRole: string | undefined,
    userId: string,
    userRole: ProjectRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (userRole !== ProjectRole.PROJECT_LEAD) {
      throw new ForbiddenException('Only the project lead can add members');
    }

    const userToAdd = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!userToAdd) {
      throw new NotFoundException('User not found');
    }

    const project = await this.prisma.complianceProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const isOrgMember = await this.prisma.organizationMember.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: project.organization_id,
          user_id: userToAdd.id,
        },
      },
    });

    if (!isOrgMember) {
      throw new ForbiddenException('User must be a member of the organization first');
    }

    const existing = await this.prisma.projectMember.findUnique({
      where: {
        project_id_user_id: {
          project_id: projectId,
          user_id: userToAdd.id,
        },
      },
    });

    if (existing) {
      throw new ForbiddenException('User is already a member of this project');
    }

    const member = await this.prisma.projectMember.create({
      data: {
        project_id: projectId,
        user_id: userToAdd.id,
        privilege,
        custom_role: customRole,
      },
      include: {
        user: {
          select: { id: true, email: true, first_name: true, last_name: true },
        },
        iso_roles: true,
      },
    });

    await this.auditLog.log({
      userId,
      action: AuditAction.PROJECT_MEMBER_ADDED,
      entityType: 'project_member',
      entityId: member.id,
      details: { projectId, addedUserId: userToAdd.id, privilege },
      ipAddress,
      userAgent,
    });

    return member;
  }

  async removeProjectMember(
    projectId: string,
    memberId: string,
    userId: string,
    userRole: ProjectRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (userRole !== ProjectRole.PROJECT_LEAD) {
      throw new ForbiddenException('Only the project lead can remove members');
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!membership || membership.project_id !== projectId) {
      throw new NotFoundException('Member not found');
    }

    await this.prisma.projectMember.delete({ where: { id: memberId } });

    await this.auditLog.log({
      userId,
      action: AuditAction.PROJECT_MEMBER_REMOVED,
      entityType: 'project_member',
      entityId: memberId,
      details: { projectId, removedUserId: membership.user_id },
      ipAddress,
      userAgent,
    });

    return { message: 'Member removed successfully' };
  }

  async assignIsoRoles(
    projectId: string,
    memberId: string,
    isoRoles: string[],
    userId: string,
    userRole: ProjectRole,
  ) {
    if (userRole !== ProjectRole.PROJECT_LEAD) {
      throw new ForbiddenException('Only the project lead can assign ISO roles');
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!membership || membership.project_id !== projectId) {
      throw new NotFoundException('Member not found');
    }

    await this.prisma.projectMemberIsoRole.deleteMany({
      where: { project_member_id: memberId },
    });

    if (isoRoles.length > 0) {
      await this.prisma.projectMemberIsoRole.createMany({
        data: isoRoles.map((role) => ({
          project_member_id: memberId,
          iso_role: role as any,
        })),
      });
    }

    return this.prisma.projectMember.findUnique({
      where: { id: memberId },
      include: { iso_roles: true },
    });
  }
}
