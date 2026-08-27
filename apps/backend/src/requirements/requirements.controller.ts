import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Ip,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { RequirementsService } from './requirements.service';
import { CreateRequirementDto, UpdateRequirementDto } from './dto/requirement.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectRoles } from '../common/decorators/project-role.decorator';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';

@ApiTags('Requirements')
@ApiBearerAuth()
@Controller()
export class RequirementsController {
  constructor(private readonly requirementsService: RequirementsService) {}

  @Get('steps/:stepId/requirements')
  @ApiOperation({ summary: 'List requirements for a step' })
  async list(
    @Param('stepId') stepId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.requirementsService.list(stepId, userId);
  }

  @Post('steps/:stepId/requirements')
  @ApiOperation({ summary: 'Create a new requirement' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  async create(
    @Param('stepId') stepId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('projectRole') userRole: ProjectRole,
    @Body() dto: CreateRequirementDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.requirementsService.create(stepId, dto, userId, userRole, ipAddress, userAgent);
  }

  @Patch('requirements/:requirementId')
  @ApiOperation({ summary: 'Update a requirement' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  async update(
    @Param('requirementId') requirementId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('projectRole') userRole: ProjectRole,
    @Body() dto: UpdateRequirementDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.requirementsService.update(requirementId, dto, userId, userRole, ipAddress, userAgent);
  }

  @Delete('requirements/:requirementId')
  @ApiOperation({ summary: 'Delete a requirement' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  async remove(
    @Param('requirementId') requirementId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('projectRole') userRole: ProjectRole,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.requirementsService.remove(requirementId, userId, userRole, ipAddress, userAgent);
  }

  @Get('steps/:stepId/requirements/document')
  @ApiOperation({ summary: 'Get the published document for this step' })
  async getDocument(
    @Param('stepId') stepId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.requirementsService.getDocumentForStep(stepId, userId);
  }

  @Post('steps/:stepId/requirements/create-document')
  @ApiOperation({ summary: 'Create a Tiptap document from requirements (or return existing)' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  async createDocument(
    @Param('stepId') stepId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('projectRole') userRole: ProjectRole,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.requirementsService.createDocument(stepId, userId, userRole, ipAddress, userAgent);
  }
}
