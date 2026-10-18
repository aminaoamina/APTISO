import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectRoles } from '../common/decorators/project-role.decorator';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { MaintenanceService } from './maintenance.service';
import { UpdateMaintenanceDto } from './maintenance.dto';

const EDITORS = [ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER];

@ApiTags('ISMS Maintenance')
@ApiBearerAuth()
@Controller('projects/:projectId/maintenance')
@UseGuards(ProjectRoleGuard)
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get()
  @ApiOperation({ summary: 'Certification cycle and recurring activities (creates the tasks that are due)' })
  get(@Param('projectId', ParseUUIDPipe) projectId: string, @CurrentUser('id') userId: string) {
    return this.maintenance.get(projectId, userId);
  }

  @Put()
  @ProjectRoles(...EDITORS)
  @ApiOperation({ summary: 'Update the certification dates and review frequencies' })
  update(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: UpdateMaintenanceDto, @CurrentUser('id') userId: string) {
    return this.maintenance.update(projectId, dto, userId);
  }

  @Post('run')
  @ProjectRoles(...EDITORS)
  @ApiOperation({ summary: 'Check the recurring activities now and create the tasks that are due' })
  run(@Param('projectId', ParseUUIDPipe) projectId: string, @CurrentUser('id') userId: string) {
    return this.maintenance.runNow(projectId, userId);
  }
}
