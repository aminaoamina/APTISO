import { Body, Controller, Delete, Get, Headers, Ip, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectRoles } from '../common/decorators/project-role.decorator';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { sendFile } from '../common/utils/send-file';
import { CreateEvidenceDto, EvidenceTargetDto, ListEvidenceQuery, UpdateEvidenceDto, WithdrawEvidenceDto } from './evidence.dto';
import { AuditMapService } from './audit-map.service';
import { EvidenceService, MAX_EVIDENCE_BYTES } from './evidence.service';

@ApiTags('Evidence')
@ApiBearerAuth()
@Controller()
@UseGuards(ProjectRoleGuard)
export class EvidenceController {
  constructor(
    private readonly evidence: EvidenceService,
    private readonly auditMap: AuditMapService,
  ) {}

  @Get('projects/:projectId/audit-map')
  @ApiOperation({ summary: 'Evidence map: documents, records and evidence for every clause and applicable control' })
  map(@Param('projectId') projectId: string) {
    return this.auditMap.build(projectId);
  }

  @Post('projects/:projectId/evidence')
  @ApiOperation({ summary: 'Add evidence (a file, a link or a note) and link it to what it proves' })
  @ApiConsumes('multipart/form-data')
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_EVIDENCE_BYTES, files: 1 } }))
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateEvidenceDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser('id') userId: string,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.evidence.create(projectId, dto, file, userId, ipAddress, userAgent);
  }

  @Get('projects/:projectId/evidence')
  @ApiOperation({ summary: 'Evidence of the project, or of one clause, control or task' })
  list(@Param('projectId') projectId: string, @Query() q: ListEvidenceQuery) {
    return this.evidence.list(projectId, q.target_type && q.target_id ? { type: q.target_type, id: q.target_id } : undefined);
  }

  @Post('evidence/:evidenceId/links')
  @ApiOperation({ summary: 'Link existing evidence to another clause, control or task' })
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  link(@Param('evidenceId') evidenceId: string, @Body() target: EvidenceTargetDto, @CurrentUser('id') userId: string) {
    return this.evidence.link(evidenceId, target, userId);
  }

  @Delete('evidence/:evidenceId/links/:linkId')
  @ApiOperation({ summary: 'Remove a link (the evidence itself is kept)' })
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  unlink(@Param('evidenceId') evidenceId: string, @Param('linkId') linkId: string, @CurrentUser('id') userId: string) {
    return this.evidence.unlink(evidenceId, linkId, userId);
  }

  @Patch('evidence/:evidenceId')
  @ApiOperation({ summary: 'Change the title, description or dates of evidence' })
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  update(@Param('evidenceId') evidenceId: string, @Body() dto: UpdateEvidenceDto, @CurrentUser('id') userId: string) {
    return this.evidence.update(evidenceId, dto, userId);
  }

  @Post('evidence/:evidenceId/file')
  @ApiOperation({ summary: 'Upload a new version of the file (the earlier one is kept)' })
  @ApiConsumes('multipart/form-data')
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_EVIDENCE_BYTES, files: 1 } }))
  replaceFile(
    @Param('evidenceId') evidenceId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser('id') userId: string,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.evidence.replaceFile(evidenceId, file, userId, ipAddress, userAgent);
  }

  @Delete('evidence/:evidenceId')
  @ApiOperation({ summary: 'Withdraw evidence with a reason (project lead); the record is kept' })
  @ProjectRoles(ProjectRole.PROJECT_LEAD)
  withdraw(
    @Param('evidenceId') evidenceId: string,
    @Body() dto: WithdrawEvidenceDto,
    @CurrentUser('id') userId: string,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.evidence.withdraw(evidenceId, dto.reason, userId, ipAddress, userAgent);
  }

  @Get('evidence/:evidenceId/file')
  @ApiOperation({ summary: 'Download the current file, or an earlier version with ?version=<file id>' })
  async download(@Param('evidenceId') evidenceId: string, @Query('version') fileId: string | undefined, @Res() res: Response) {
    const { buffer, filename, mimeType } = await this.evidence.download(evidenceId, fileId);
    sendFile(res, buffer, filename, mimeType, 'attachment');
  }
}
