import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import { OrganizationRole, AuditAction } from '@prisma/client';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(
    dto: CreateOrganizationDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name,
        description: dto.description,
        industry: dto.industry,
        created_by: userId,
        members: {
          create: {
            user_id: userId,
            role: OrganizationRole.ORG_OWNER,
          },
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, first_name: true, last_name: true } } },
        },
      },
    });

    await this.auditLog.log({
      userId,
      action: AuditAction.ORGANIZATION_CREATED,
      entityType: 'organization',
      entityId: organization.id,
      details: { name: organization.name },
      ipAddress,
      userAgent,
    });

    return organization;
  }

  async findAllForUser(userId: string) {
    return this.prisma.organization.findMany({
      where: {
        members: {
          some: { user_id: userId },
        },
      },
      include: {
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(orgId: string, userId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
                is_active: true,
              },
            },
          },
        },
        _count: {
          select: {
            projects: true,
            invitations: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const isMember = organization.members.some((m) => m.user_id === userId);
    if (!isMember) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async update(
    orgId: string,
    dto: UpdateOrganizationDto,
    userId: string,
    userRole: OrganizationRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (
      userRole !== OrganizationRole.ORG_OWNER &&
      userRole !== OrganizationRole.ORG_ADMIN
    ) {
      throw new ForbiddenException('Only owners and admins can update organizations');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.industry !== undefined && { industry: dto.industry }),
      },
    });

    await this.auditLog.log({
      userId,
      action: AuditAction.ORGANIZATION_UPDATED,
      entityType: 'organization',
      entityId: orgId,
      details: { changes: dto as any },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  async remove(
    orgId: string,
    userId: string,
    userRole: OrganizationRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (userRole !== OrganizationRole.ORG_OWNER) {
      throw new ForbiddenException('Only the owner can delete an organization');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    await this.prisma.organization.delete({ where: { id: orgId } });

    await this.auditLog.log({
      userId,
      action: AuditAction.ORGANIZATION_DELETED,
      entityType: 'organization',
      entityId: orgId,
      details: { name: organization.name },
      ipAddress,
      userAgent,
    });

    return { message: 'Organization deleted successfully' };
  }

  async addMember(
    orgId: string,
    email: string,
    role: OrganizationRole,
    inviterId: string,
    inviterRole: OrganizationRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (
      inviterRole !== OrganizationRole.ORG_OWNER &&
      inviterRole !== OrganizationRole.ORG_ADMIN
    ) {
      throw new ForbiddenException('Only owners and admins can add members');
    }

    const userToAdd = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!userToAdd) {
      throw new NotFoundException('User not found. They must register first.');
    }

    const existing = await this.prisma.organizationMember.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: orgId,
          user_id: userToAdd.id,
        },
      },
    });

    if (existing) {
      throw new ConflictException('User is already a member of this organization');
    }

    const member = await this.prisma.organizationMember.create({
      data: {
        organization_id: orgId,
        user_id: userToAdd.id,
        role,
      },
      include: {
        user: {
          select: { id: true, email: true, first_name: true, last_name: true },
        },
      },
    });

    await this.auditLog.log({
      userId: inviterId,
      action: AuditAction.MEMBER_ADDED,
      entityType: 'organization_member',
      entityId: member.id,
      details: { organizationId: orgId, addedUserId: userToAdd.id, role },
      ipAddress,
      userAgent,
    });

    return member;
  }

  async removeMember(
    orgId: string,
    memberId: string,
    userId: string,
    userRole: OrganizationRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (
      userRole !== OrganizationRole.ORG_OWNER &&
      userRole !== OrganizationRole.ORG_ADMIN
    ) {
      throw new ForbiddenException('Only owners and admins can remove members');
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!membership || membership.organization_id !== orgId) {
      throw new NotFoundException('Member not found');
    }

    if (membership.role === OrganizationRole.ORG_OWNER) {
      throw new ForbiddenException('Cannot remove the organization owner');
    }

    if (membership.user_id === userId) {
      throw new ForbiddenException('Cannot remove yourself. Use leave instead.');
    }

    await this.prisma.organizationMember.delete({
      where: { id: memberId },
    });

    await this.auditLog.log({
      userId,
      action: AuditAction.MEMBER_REMOVED,
      entityType: 'organization_member',
      entityId: memberId,
      details: { organizationId: orgId, removedUserId: membership.user_id },
      ipAddress,
      userAgent,
    });

    return { message: 'Member removed successfully' };
  }

  async updateMemberRole(
    orgId: string,
    memberId: string,
    newRole: OrganizationRole,
    userId: string,
    userRole: OrganizationRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (userRole !== OrganizationRole.ORG_OWNER) {
      throw new ForbiddenException('Only the owner can change member roles');
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!membership || membership.organization_id !== orgId) {
      throw new NotFoundException('Member not found');
    }

    if (membership.role === OrganizationRole.ORG_OWNER) {
      throw new ForbiddenException('Cannot change the owner role');
    }

    const updated = await this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { role: newRole },
      include: {
        user: {
          select: { id: true, email: true, first_name: true, last_name: true },
        },
      },
    });

    await this.auditLog.log({
      userId,
      action: AuditAction.MEMBER_ROLE_CHANGED,
      entityType: 'organization_member',
      entityId: memberId,
      details: { organizationId: orgId, targetUserId: membership.user_id, oldRole: membership.role, newRole },
      ipAddress,
      userAgent,
    });

    return updated;
  }
}
