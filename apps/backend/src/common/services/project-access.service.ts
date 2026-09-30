import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { IsoRole, ProjectRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface ProjectAccess {
  userId: string;
  projectId: string;
  organizationId: string;
  role: ProjectRole;
  isTopManagement: boolean;
  /** Leads and members can change records; auditors are read-only. */
  canEdit: boolean;
  /** Top management decisions (approvals): members with the Top management role, or the project lead. */
  canDecide: boolean;
}

/**
 * Membership and role checks shared by the project-level registers. Roles
 * are resolved from the database, never trusted from the request.
 */
@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async forProject(projectId: string, userId: string): Promise<ProjectAccess> {
    const project = await this.prisma.complianceProject.findUnique({
      where: { id: projectId },
      select: {
        organization_id: true,
        members: {
          where: { user_id: userId },
          select: { privilege: true, iso_roles: { select: { iso_role: true } } },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    const member = project.members[0];
    if (!member) throw new ForbiddenException('You are not a member of this project');
    const isTopManagement = member.iso_roles.some(r => r.iso_role === IsoRole.TOP_MANAGEMENT);
    return {
      userId,
      projectId,
      organizationId: project.organization_id,
      role: member.privilege,
      isTopManagement,
      canEdit: member.privilege !== ProjectRole.PROJECT_AUDITOR,
      canDecide: member.privilege === ProjectRole.PROJECT_LEAD || isTopManagement,
    };
  }

  async forStep(stepId: string, userId: string, expectedKey?: string) {
    const step = await this.prisma.projectStep.findUnique({
      where: { id: stepId },
      select: { id: true, key: true, phase: { select: { project_id: true } } },
    });
    if (!step || (expectedKey && step.key !== expectedKey)) throw new NotFoundException('Step not found');
    return { ...(await this.forProject(step.phase.project_id, userId)), stepId: step.id };
  }

  assertEdit(access: ProjectAccess) {
    if (!access.canEdit) throw new ForbiddenException('Auditors have read-only access');
  }

  assertDecide(access: ProjectAccess) {
    if (!access.canDecide) {
      throw new ForbiddenException('Only top management (or the project lead on its behalf) can take this decision');
    }
  }

  /** Every id must belong to a member of the project. */
  async assertMembers(projectId: string, userIds: (string | null | undefined)[]) {
    const ids = [...new Set(userIds.filter((id): id is string => !!id))];
    if (ids.length === 0) return;
    const count = await this.prisma.projectMember.count({ where: { project_id: projectId, user_id: { in: ids } } });
    if (count !== ids.length) throw new BadRequestException('Everyone selected must be a member of this project');
  }

  async members(projectId: string) {
    const members = await this.prisma.projectMember.findMany({
      where: { project_id: projectId },
      include: {
        user: { select: { id: true, first_name: true, last_name: true, email: true } },
        iso_roles: { select: { iso_role: true } },
      },
    });
    return members.map(m => ({
      id: m.user.id,
      first_name: m.user.first_name,
      last_name: m.user.last_name,
      email: m.user.email,
      privilege: m.privilege,
      is_top_management: m.iso_roles.some(r => r.iso_role === IsoRole.TOP_MANAGEMENT),
      label: `${m.user.first_name} ${m.user.last_name}`.trim() || m.user.email,
    }));
  }

  /** Step of a project by key (e.g. to link a register to its step). */
  async stepByKey(projectId: string, key: string) {
    return this.prisma.projectStep.findFirst({
      where: { key, phase: { project_id: projectId } },
      select: { id: true, status: true },
    });
  }
}
