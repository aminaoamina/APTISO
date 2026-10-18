import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectRoles } from '../common/decorators/project-role.decorator';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { MaintenanceService } from './maintenance.service';
import { AuditProgramService } from './audit-program.service';
import { CreateProgramAuditDto, UpdateAuditProgramDto, UpdateMaintenanceDto, UpdateProgramAuditDto } from './maintenance.dto';

const EDITORS = [ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER];

@ApiTags('ISMS Maintenance')
@ApiBearerAuth()
@Controller('projects/:projectId/maintenance')
@UseGuards(ProjectRoleGuard)
export class MaintenanceController {
  constructor(
    private readonly maintenance: MaintenanceService,
    private readonly program: AuditProgramService,
  ) {}

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

  // ─── Internal audit program (clause 9.2.2) ─────────────────────

  @Put('program')
  @ProjectRoles(...EDITORS)
  @ApiOperation({ summary: 'Update the objectives, criteria and methods of the internal audit program' })
  async updateProgram(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: UpdateAuditProgramDto, @CurrentUser('id') userId: string) {
    await this.program.update(projectId, dto, userId);
    return this.maintenance.get(projectId, userId);
  }

  @Post('program/audits')
  @ProjectRoles(...EDITORS)
  @ApiOperation({ summary: 'Plan an internal audit' })
  async addAudit(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: CreateProgramAuditDto, @CurrentUser('id') userId: string) {
    await this.program.addAudit(projectId, dto, userId);
    return this.maintenance.get(projectId, userId);
  }

  @Patch('program/audits/:lineId')
  @ProjectRoles(...EDITORS)
  @ApiOperation({ summary: 'Change a planned internal audit that has not started' })
  async updateAudit(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: UpdateProgramAuditDto,
    @CurrentUser('id') userId: string,
  ) {
    await this.program.updateAudit(projectId, lineId, dto, userId);
    return this.maintenance.get(projectId, userId);
  }

  @Delete('program/audits/:lineId')
  @ProjectRoles(...EDITORS)
  @ApiOperation({ summary: 'Remove a planned internal audit that has not started' })
  async removeAudit(@Param('projectId', ParseUUIDPipe) projectId: string, @Param('lineId', ParseUUIDPipe) lineId: string, @CurrentUser('id') userId: string) {
    await this.program.removeAudit(projectId, lineId, userId);
    return this.maintenance.get(projectId, userId);
  }

  @Post('program/audits/:lineId/start')
  @ProjectRoles(...EDITORS)
  @ApiOperation({ summary: 'Schedule the planned audit in the Internal Audit module (checklist and auditor task)' })
  startAudit(@Param('projectId', ParseUUIDPipe) projectId: string, @Param('lineId', ParseUUIDPipe) lineId: string, @CurrentUser('id') userId: string) {
    return this.program.startAudit(projectId, lineId, userId);
  }

  @Post('program/document')
  @ProjectRoles(...EDITORS)
  @ApiOperation({ summary: 'Generate or refresh the Internal Audit Program document' })
  async programDocument(@Param('projectId', ParseUUIDPipe) projectId: string, @CurrentUser('id') userId: string) {
    await this.program.createDocument(projectId, userId);
    return this.maintenance.get(projectId, userId);
  }
}
