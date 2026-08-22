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
  OrganizationDeletionDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import {
  OrganizationRole,
  AuditAction,
  OrganizationJoinRequestStatus,
  NotificationType,
} from '@prisma/client';
import { MailService } from '../mail/mail.service';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly mailService: MailService,
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
        members: {
          where: { user_id: userId },
          select: {
            id: true,
            organization_id: true,
            user_id: true,
            role: true,
            created_at: true,
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
    dto: OrganizationDeletionDto,
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

    if (dto.action === 'TRANSFER') {
      if (!dto.transfer_to_user_id || dto.transfer_to_user_id === userId) {
        throw new ConflictException('Choose another member to receive ownership');
      }

      const recipient = await this.prisma.organizationMember.findUnique({
        where: {
          organization_id_user_id: {
            organization_id: orgId,
            user_id: dto.transfer_to_user_id,
          },
        },
      });

      if (!recipient) {
        throw new ConflictException('Ownership recipient must be a member of this organization');
      }

      const recipientId = dto.transfer_to_user_id;

      const projects = await this.prisma.complianceProject.findMany({
        where: { organization_id: orgId },
        include: { members: true },
      });

      await this.prisma.$transaction(async (transaction) => {
        await transaction.organization.update({
          where: { id: orgId },
          data: { created_by: recipientId },
        });
        await transaction.organizationMember.update({
          where: {
            organization_id_user_id: { organization_id: orgId, user_id: userId },
          },
          data: { role: OrganizationRole.ORG_MEMBER },
        });
        await transaction.organizationMember.update({
          where: {
            organization_id_user_id: {
              organization_id: orgId,
              user_id: recipientId,
            },
          },
          data: { role: OrganizationRole.ORG_OWNER },
        });

        for (const project of projects) {
          if (project.created_by === userId) {
            await transaction.complianceProject.update({
              where: { id: project.id },
              data: { created_by: recipientId },
            });
          }

          const recipientProjectMember = project.members.find(
            (member) => member.user_id === recipientId,
          );
          if (recipientProjectMember) {
            await transaction.projectMember.update({
              where: { id: recipientProjectMember.id },
              data: { privilege: 'PROJECT_LEAD' },
            });
          } else {
            await transaction.projectMember.create({
              data: {
                project_id: project.id,
                user_id: recipientId,
                privilege: 'PROJECT_LEAD',
              },
            });
          }
        }

        if (dto.leave_organization) {
          await transaction.organizationMember.delete({
            where: {
              organization_id_user_id: { organization_id: orgId, user_id: userId },
            },
          });
        }
      });

      const [recipientUser, transferringUser] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: recipientId },
          select: { email: true, first_name: true, last_name: true },
        }),
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { first_name: true, last_name: true },
        }),
      ]);
      if (recipientUser && transferringUser) {
        await this.mailService.sendOwnershipTransferEmail(
          recipientUser.email,
          `${recipientUser.first_name} ${recipientUser.last_name}`,
          organization.name,
          `${transferringUser.first_name} ${transferringUser.last_name}`,
        );
      }

      await this.auditLog.log({
        userId,
        action: AuditAction.ORGANIZATION_UPDATED,
        entityType: 'organization',
        entityId: orgId,
        details: { ownershipTransferredTo: recipientId },
        ipAddress,
        userAgent,
      });

      return { message: 'Ownership transferred successfully' };
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

    const existing = userToAdd
      ? await this.prisma.organizationMember.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: orgId,
          user_id: userToAdd.id,
        },
      },
    })
      : null;

    if (existing) {
      throw new ConflictException('User is already a member of this organization');
    }

    const pendingRequest = await this.prisma.organizationJoinRequest.findFirst({
      where: {
        organization_id: orgId,
        invited_email: email,
        status: OrganizationJoinRequestStatus.PENDING,
      },
    });
    if (pendingRequest) {
      throw new ConflictException('A pending request already exists for this email');
    }

    const request = await this.prisma.organizationJoinRequest.create({
      data: {
        organization_id: orgId,
        requested_by: inviterId,
        invited_email: email,
        requested_user_id: userToAdd?.id,
        role,
      },
      include: {
        organization: { select: { id: true, name: true } },
      },
    });

    if (userToAdd) {
      await this.prisma.notification.create({
        data: {
          user_id: userToAdd.id,
          organization_id: orgId,
          join_request_id: request.id,
          type: NotificationType.ORGANIZATION_JOIN_REQUEST,
        },
      });
    } else {
      const inviter = await this.prisma.user.findUnique({
        where: { id: inviterId },
        select: { first_name: true, last_name: true },
      });
      await this.mailService.sendOrganizationJoinRequestEmail(
        email,
        `${inviter?.first_name ?? ''} ${inviter?.last_name ?? ''}`.trim(),
        request.organization.name,
      );
    }

    await this.auditLog.log({
      userId: inviterId,
      action: AuditAction.MEMBER_ADDED,
      entityType: 'organization_join_request',
      entityId: request.id,
      details: { organizationId: orgId, invitedEmail: email, role },
      ipAddress,
      userAgent,
    });

    return request;
  }

  async listNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { user_id: userId },
      include: {
        organization: { select: { id: true, name: true } },
        join_request: {
          select: { id: true, role: true, status: true, created_at: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async respondToJoinRequest(
    requestId: string,
    userId: string,
    accept: boolean,
  ) {
    const request = await this.prisma.organizationJoinRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.requested_user_id !== userId) {
      throw new NotFoundException('Join request not found');
    }
    if (request.status !== OrganizationJoinRequestStatus.PENDING) {
      throw new ConflictException('This join request has already been resolved');
    }

    if (!accept) {
      await this.prisma.$transaction([
        this.prisma.organizationJoinRequest.update({
          where: { id: requestId },
          data: { status: OrganizationJoinRequestStatus.REJECTED },
        }),
        this.prisma.notification.deleteMany({ where: { join_request_id: requestId } }),
      ]);
      return { message: 'Join request rejected' };
    }

    await this.prisma.$transaction([
      this.prisma.organizationMember.create({
        data: { organization_id: request.organization_id, user_id: userId, role: request.role },
      }),
      this.prisma.organizationJoinRequest.update({
        where: { id: requestId },
        data: { status: OrganizationJoinRequestStatus.ACCEPTED },
      }),
      this.prisma.notification.deleteMany({ where: { join_request_id: requestId } }),
    ]);
    return { message: 'You joined the organization successfully' };
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

  async leave(
    orgId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organization_id_user_id: { organization_id: orgId, user_id: userId },
      },
      include: { organization: true },
    });

    if (!membership) {
      throw new NotFoundException('Organization membership not found');
    }
    if (membership.role === OrganizationRole.ORG_OWNER) {
      throw new ForbiddenException('Transfer ownership before leaving the organization');
    }

    await this.prisma.organizationMember.delete({ where: { id: membership.id } });
    await this.auditLog.log({
      userId,
      action: AuditAction.MEMBER_REMOVED,
      entityType: 'organization_member',
      entityId: membership.id,
      details: { organizationId: orgId, leftOrganization: true },
      ipAddress,
      userAgent,
    });

    return { message: 'You left the organization successfully' };
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
