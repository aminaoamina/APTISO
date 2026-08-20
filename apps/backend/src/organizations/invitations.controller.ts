import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Ip,
  Headers,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InvitationsService } from './invitations.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRoles } from '../common/decorators/org-role.decorator';
import { OrganizationRoleGuard } from '../common/guards/organization-role.guard';
import { OrganizationRole } from '@prisma/client';

@ApiTags('Invitations')
@Controller('organizations/:orgId/invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send organization invitation' })
  @UseGuards(OrganizationRoleGuard)
  @OrgRoles(OrganizationRole.ORG_OWNER, OrganizationRole.ORG_ADMIN)
  async sendInvitation(
    @Param('orgId') orgId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationRole') userRole: OrganizationRole,
    @Body() body: { email: string; role: OrganizationRole },
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.invitationsService.sendInvitation(
      orgId, body.email, body.role, userId, userRole, ipAddress, userAgent,
    );
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List organization invitations' })
  @UseGuards(OrganizationRoleGuard)
  async listInvitations(
    @Param('orgId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.invitationsService.listInvitations(orgId, userId);
  }

  @Delete(':invitationId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke invitation' })
  @UseGuards(OrganizationRoleGuard)
  @OrgRoles(OrganizationRole.ORG_OWNER, OrganizationRole.ORG_ADMIN)
  async revokeInvitation(
    @Param('orgId') orgId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationRole') userRole: OrganizationRole,
  ) {
    return this.invitationsService.revokeInvitation(
      orgId, invitationId, userId, userRole,
    );
  }
}
