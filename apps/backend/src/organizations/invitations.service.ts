import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { SecurityUtil } from '../common/utils/security.util';
import {
  InvitationStatus,
  OrganizationRole,
  AuditAction,
} from '@prisma/client';

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly auditLog: AuditLogService,
  ) {}

  async sendInvitation(
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
      throw new ForbiddenException('Only owners and admins can send invitations');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      const existingMember = await this.prisma.organizationMember.findUnique({
        where: {
          organization_id_user_id: {
            organization_id: orgId,
            user_id: existingUser.id,
          },
        },
      });
      if (existingMember) {
        throw new ConflictException('User is already a member of this organization');
      }
    }

    const pendingInvite = await this.prisma.invitation.findFirst({
      where: {
        organization_id: orgId,
        invited_email: email,
        status: InvitationStatus.PENDING,
      },
    });

    if (pendingInvite) {
      throw new ConflictException('A pending invitation already exists for this email');
    }

    const inviteCode = SecurityUtil.generateAlphanumericCode(32);
    const rawToken = SecurityUtil.generateSecureToken(32);
    const hashedToken = await SecurityUtil.hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await this.prisma.invitation.create({
      data: {
        organization_id: orgId,
        invited_by: inviterId,
        invited_email: email,
        role: role === OrganizationRole.ORG_OWNER
          ? 'PROJECT_MEMBER' as any
          : 'PROJECT_MEMBER' as any,
        invite_code: inviteCode,
        hashed_token: hashedToken,
        expires_at: expiresAt,
      },
    });

    const inviter = await this.prisma.user.findUnique({
      where: { id: inviterId },
      select: { first_name: true, last_name: true },
    });

    const inviterName = `${inviter?.first_name} ${inviter?.last_name}`;

    try {
      await this.mailService.sendInvitationEmail(
        email,
        inviterName,
        organization.name,
        role,
        rawToken,
      );
    } catch (error) {
      this.logger.error('Failed to send invitation email:', error);
    }

    await this.auditLog.log({
      userId: inviterId,
      action: AuditAction.MEMBER_INVITED,
      entityType: 'invitation',
      entityId: invitation.id,
      details: { organizationId: orgId, invitedEmail: email, role },
      ipAddress,
      userAgent,
    });

    return {
      invitation: {
        id: invitation.id,
        email: invitation.invited_email,
        role,
        expires_at: invitation.expires_at,
        created_at: invitation.created_at,
      },
      invitation_link: rawToken,
    };
  }

  async validateInvitation(token: string) {
    const hashedToken = await SecurityUtil.hashToken(token);

    const invitation = await this.prisma.invitation.findUnique({
      where: { hashed_token: hashedToken },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invalid invitation');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is no longer pending');
    }

    if (new Date() > invitation.expires_at) {
      throw new BadRequestException('Invitation has expired');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.invited_email },
    });

    return {
      valid: true,
      email: invitation.invited_email,
      organization: invitation.organization,
      role: invitation.role,
      user_exists: !!existingUser,
    };
  }

  async acceptInvitation(token: string, userId: string) {
    const hashedToken = await SecurityUtil.hashToken(token);

    const invitation = await this.prisma.invitation.findUnique({
      where: { hashed_token: hashedToken },
    });

    if (!invitation) {
      throw new NotFoundException('Invalid invitation');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is no longer pending');
    }

    if (new Date() > invitation.expires_at) {
      throw new BadRequestException('Invitation has expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.email !== invitation.invited_email) {
      throw new ForbiddenException('This invitation is for a different email address');
    }

    const existingMember = await this.prisma.organizationMember.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: invitation.organization_id,
          user_id: userId,
        },
      },
    });

    if (existingMember) {
      throw new ConflictException('You are already a member of this organization');
    }

    await this.prisma.$transaction([
      this.prisma.organizationMember.create({
        data: {
          organization_id: invitation.organization_id,
          user_id: userId,
          role: OrganizationRole.ORG_MEMBER,
        },
      }),
      this.prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          accepted_by: userId,
          accepted_at: new Date(),
        },
      }),
    ]);

    await this.auditLog.log({
      userId,
      action: AuditAction.INVITATION_ACCEPTED,
      entityType: 'invitation',
      entityId: invitation.id,
      details: { organizationId: invitation.organization_id },
    });

    return { message: 'Invitation accepted successfully' };
  }

  async listInvitations(orgId: string, _userId: string) {
    return this.prisma.invitation.findMany({
      where: { organization_id: orgId },
      include: {
        inviter: {
          select: { id: true, email: true, first_name: true, last_name: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async revokeInvitation(
    orgId: string,
    invitationId: string,
    userId: string,
    userRole: OrganizationRole,
  ) {
    if (
      userRole !== OrganizationRole.ORG_OWNER &&
      userRole !== OrganizationRole.ORG_ADMIN
    ) {
      throw new ForbiddenException('Only owners and admins can revoke invitations');
    }

    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.organization_id !== orgId) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is not pending');
    }

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.REVOKED },
    });

    await this.auditLog.log({
      userId,
      action: AuditAction.INVITATION_REVOKED,
      entityType: 'invitation',
      entityId: invitationId,
      details: { organizationId: orgId, email: invitation.invited_email },
    });

    return { message: 'Invitation revoked successfully' };
  }
}
