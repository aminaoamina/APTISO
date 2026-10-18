import { Controller, Delete, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRoles } from '../common/decorators/org-role.decorator';
import { Public } from '../common/decorators/public.decorator';
import { OrganizationRoleGuard } from '../common/guards/organization-role.guard';
import { DriveSyncService } from './drive-sync.service';

@ApiTags('Connectors')
@ApiBearerAuth()
@Controller()
export class ConnectorsController {
  constructor(
    private readonly drive: DriveSyncService,
    private readonly config: ConfigService,
  ) {}

  @Get('organizations/:orgId/connectors')
  @ApiOperation({ summary: 'Drive connection of the organization and its sync status' })
  @UseGuards(OrganizationRoleGuard)
  @OrgRoles(OrganizationRole.ORG_OWNER, OrganizationRole.ORG_ADMIN)
  status(@Param('orgId') orgId: string) {
    return this.drive.status(orgId);
  }

  @Post('organizations/:orgId/connectors/google')
  @ApiOperation({ summary: 'Start connecting Google Drive: returns the Google sign-in address' })
  @UseGuards(OrganizationRoleGuard)
  @OrgRoles(OrganizationRole.ORG_OWNER, OrganizationRole.ORG_ADMIN)
  connectGoogle(@Param('orgId') orgId: string, @CurrentUser('id') userId: string) {
    return this.drive.startGoogle(orgId, userId);
  }

  /** Google sends the browser back here; the signed state says which organization and who started it. */
  @Public()
  @Get('connectors/google/callback')
  @ApiOperation({ summary: 'Google sign-in callback' })
  async googleCallback(@Query('code') code: string | undefined, @Query('state') state: string | undefined, @Query('error') error: string | undefined, @Res() res: Response) {
    const frontend = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const orgId = this.drive.stateOrganization(state);
    const back = (query: string) => res.redirect(`${frontend}/dashboard/organizations${orgId ? `/${orgId}` : ''}?${query}`);
    if (error || !code || !state) return back('drive=cancelled');
    try {
      await this.drive.finishGoogle(code, state);
      return back('drive=connected');
    } catch (e) {
      return back(`drive=error&reason=${encodeURIComponent((e as Error).message.slice(0, 200))}`);
    }
  }

  @Post('organizations/:orgId/connectors/sync')
  @ApiOperation({ summary: 'Copy now everything not yet in the drive' })
  @UseGuards(OrganizationRoleGuard)
  @OrgRoles(OrganizationRole.ORG_OWNER, OrganizationRole.ORG_ADMIN)
  sync(@Param('orgId') orgId: string) {
    return this.drive.syncOrganization(orgId);
  }

  @Delete('organizations/:orgId/connectors')
  @ApiOperation({ summary: 'Disconnect the drive (files already copied stay there)' })
  @UseGuards(OrganizationRoleGuard)
  @OrgRoles(OrganizationRole.ORG_OWNER, OrganizationRole.ORG_ADMIN)
  disconnect(@Param('orgId') orgId: string, @CurrentUser('id') userId: string) {
    return this.drive.disconnect(orgId, userId);
  }
}
