import { Controller, Get, Headers, Ip, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { PoliciesService } from './policies.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectRoles } from '../common/decorators/project-role.decorator';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';

@ApiTags('Security Documentation')
@ApiBearerAuth()
@Controller()
@UseGuards(ProjectRoleGuard)
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Get('steps/:stepId/policy')
  @ApiOperation({ summary: 'Policy step: the controls it covers and their SoA decisions' })
  get(@Param('stepId', ParseUUIDPipe) stepId: string, @CurrentUser('id') userId: string) {
    return this.policies.getPolicy(stepId, userId);
  }

  @Post('steps/:stepId/policy/draft')
  @ApiOperation({ summary: 'Create the first draft of the policy from the Statement of Applicability' })
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  createDraft(
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @CurrentUser('id') userId: string,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.policies.createDraft(stepId, userId, ip, ua);
  }

  @Post('steps/:stepId/soa/sync-policies')
  @ApiOperation({ summary: 'Update the Phase 3 policy steps from the Statement of Applicability' })
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  sync(@Param('stepId', ParseUUIDPipe) stepId: string, @CurrentUser('id') userId: string) {
    return this.policies.syncFromSoa(stepId, userId);
  }
}
