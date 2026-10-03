import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Ip,
  Headers,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  UpdateStepCompletionDataDto,
  SendAwarenessDto,
  CompleteStepDto,
  ConfirmTrainingDto,
} from './dto/project.dto';
import { ProjectInviteMemberDto, AssignIsoRolesDto } from '../organizations/dto/member.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRoles } from '../common/decorators/org-role.decorator';
import { ProjectRoles } from '../common/decorators/project-role.decorator';
import { OrganizationRoleGuard } from '../common/guards/organization-role.guard';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { OrganizationRole, ProjectRole } from '@prisma/client';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('organizations/:orgId/projects')
@UseGuards(OrganizationRoleGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a compliance project' })
  @OrgRoles(OrganizationRole.ORG_OWNER, OrganizationRole.ORG_ADMIN)
  async create(
    @Param('orgId') orgId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationRole') userRole: OrganizationRole,
    @Body() dto: CreateProjectDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.projectsService.create(
      orgId, dto, userId, userRole, ipAddress, userAgent,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List projects in organization' })
  async findAll(
    @Param('orgId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.projectsService.findAllForOrg(orgId, userId);
  }
}

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectDetailController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get(':projectId')
  @ApiOperation({ summary: 'Get project details' })
  @UseGuards(ProjectRoleGuard)
  async findOne(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.projectsService.findOne(projectId, userId);
  }

  @Put(':projectId')
  @ApiOperation({ summary: 'Update project' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD)
  async update(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('projectRole') userRole: ProjectRole,
    @Body() dto: UpdateProjectDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.projectsService.update(
      projectId, dto, userId, userRole, ipAddress, userAgent,
    );
  }

  @Delete(':projectId')
  @ApiOperation({ summary: 'Delete project' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD)
  async remove(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('projectRole') userRole: ProjectRole,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.projectsService.remove(
      projectId, userId, userRole, ipAddress, userAgent,
    );
  }

  @Put(':projectId/steps/:stepId/complete')
  @ApiOperation({ summary: 'Mark an implementation step as completed' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  async completeStep(
    @Param('projectId') projectId: string,
    @Param('stepId') stepId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('projectRole') userRole: ProjectRole,
    @Body() dto: CompleteStepDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.projectsService.completeStep(
      projectId, stepId, userId, userRole, dto.skip ?? false, ipAddress, userAgent,
    );
  }

  @Put(':projectId/steps/:stepId/reopen')
  @ApiOperation({ summary: 'Reopen a completed step (project lead)' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD)
  async reopenStep(
    @Param('projectId') projectId: string,
    @Param('stepId') stepId: string,
    @CurrentUser('id') userId: string,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.projectsService.reopenStep(projectId, stepId, userId, ipAddress, userAgent);
  }

  @Post(':projectId/members')
  @ApiOperation({ summary: 'Add project member' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD)
  async addMember(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('projectRole') userRole: ProjectRole,
    @Body() dto: ProjectInviteMemberDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.projectsService.addProjectMember(
      projectId, dto.email, dto.privilege, dto.custom_role, userId, userRole, ipAddress, userAgent,
    );
  }

  @Delete(':projectId/members/:memberId')
  @ApiOperation({ summary: 'Remove project member' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD)
  async removeMember(
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('projectRole') userRole: ProjectRole,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.projectsService.removeProjectMember(
      projectId, memberId, userId, userRole, ipAddress, userAgent,
    );
  }

  @Put(':projectId/members/:memberId/iso-roles')
  @ApiOperation({ summary: 'Assign ISO roles to project member' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD)
  async assignIsoRoles(
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('projectRole') userRole: ProjectRole,
    @Body() dto: AssignIsoRolesDto,
  ) {
    return this.projectsService.assignIsoRoles(
      projectId, memberId, dto.iso_roles, userId, userRole,
    );
  }

  @Patch(':projectId/steps/:stepId/completion-data')
  @ApiOperation({ summary: 'Save step completion data (gate + question responses)' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  async updateStepCompletionData(
    @Param('projectId') projectId: string,
    @Param('stepId') stepId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('projectRole') userRole: ProjectRole,
    @Body() dto: UpdateStepCompletionDataDto,
  ) {
    return this.projectsService.updateStepCompletionData(
      projectId, stepId, dto.completion_data, userId, userRole,
    );
  }

  @Post(':projectId/steps/:stepId/awareness')
  @ApiOperation({ summary: 'Send awareness materials for a step (creates awareness tasks)' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  async sendAwareness(
    @Param('projectId') projectId: string,
    @Param('stepId') stepId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('projectRole') userRole: ProjectRole,
    @Body() dto: SendAwarenessDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.projectsService.sendAwareness(projectId, stepId, dto, userId, userRole, ipAddress, userAgent);
  }

  @Post(':projectId/steps/:stepId/training')
  @ApiOperation({ summary: 'Confirm training needs for a step (creates training tasks)' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  async confirmTraining(
    @Param('projectId') projectId: string,
    @Param('stepId') stepId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('projectRole') userRole: ProjectRole,
    @Body() dto: ConfirmTrainingDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.projectsService.confirmTraining(projectId, stepId, dto, userId, userRole, ipAddress, userAgent);
  }
}
