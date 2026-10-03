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
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ProjectRole } from '@prisma/client';
import { DocumentsService } from './documents.service';
import { DocxExportService } from './docx-export.service';
import { LibraryService } from './library.service';
import {
  CreateDocumentDto,
  ExportDocxDto,
  PublishDocumentDto,
  RequestChangesDto,
  UpdateDocumentAssignmentsDto,
  UpdateDocumentContentDto,
} from './dto/document.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectRoles } from '../common/decorators/project-role.decorator';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { OrganizationRoleGuard } from '../common/guards/organization-role.guard';

/** Sends a file; the UTF-8 name keeps accents and other characters of document titles. */
function sendFile(res: Response, buffer: Buffer, filename: string, type: string, disposition: 'inline' | 'attachment') {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  res.set({
    'Content-Type': type,
    'Content-Disposition': `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    'Access-Control-Expose-Headers': 'Content-Disposition',
  });
  res.end(buffer);
}

/**
 * Every route that names a document runs through ProjectRoleGuard, which
 * resolves the document's project and rejects users who are not members.
 */
@ApiTags('Documents')
@ApiBearerAuth()
@Controller()
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly docxExportService: DocxExportService,
    private readonly libraryService: LibraryService,
  ) {}

  @Get('document-templates/:code')
  @ApiOperation({ summary: 'Get a document template with its wizard questions' })
  async getTemplate(@Param('code') code: string) {
    return this.documentsService.getTemplate(code);
  }

  @Post('projects/:projectId/steps/:stepId/document')
  @ApiOperation({ summary: 'Generate a document from wizard answers' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  async createFromWizard(
    @Param('projectId') projectId: string,
    @Param('stepId') stepId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('projectRole') userRole: ProjectRole,
    @Body() dto: CreateDocumentDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.documentsService.createFromWizard(
      projectId, stepId, dto, userId, userRole, ipAddress, userAgent,
    );
  }

  @Get('documents/:documentId')
  @ApiOperation({ summary: 'Get a document instance with its published versions' })
  @UseGuards(ProjectRoleGuard)
  async findOne(@Param('documentId') documentId: string) {
    return this.documentsService.findOne(documentId);
  }

  @Patch('documents/:documentId/content')
  @ApiOperation({ summary: 'Save the editable structured content of a document' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  async updateContent(
    @Param('documentId') documentId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateDocumentContentDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.documentsService.updateContent(documentId, dto, userId, ipAddress, userAgent);
  }

  @Patch('documents/:documentId/assignments')
  @ApiOperation({ summary: 'Set document owner, reviewer, approver, and update interval' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  async updateAssignments(
    @Param('documentId') documentId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateDocumentAssignmentsDto,
  ) {
    return this.documentsService.updateAssignments(documentId, dto, userId);
  }

  @Post('documents/:documentId/export-docx')
  @ApiOperation({ summary: 'Export document as a Word .docx file' })
  @UseGuards(ProjectRoleGuard)
  async exportDocx(@Param('documentId') documentId: string, @Body() dto: ExportDocxDto, @Res() res: Response) {
    const { buffer, filename } = await this.docxExportService.exportDocument(documentId, dto.content as never);
    sendFile(res, buffer, filename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'attachment');
  }

  @Post('documents/:documentId/publish')
  @ApiOperation({ summary: 'Submit to the library: published, or sent to the document approver first' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  async publishDocument(
    @Param('documentId') documentId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: PublishDocumentDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.libraryService.submit(documentId, userId, dto.notes, ipAddress, userAgent);
  }

  @Post('documents/:documentId/approve')
  @ApiOperation({ summary: 'Approve the document (its approver): it is published' })
  @UseGuards(ProjectRoleGuard)
  async approveDocument(
    @Param('documentId') documentId: string,
    @CurrentUser('id') userId: string,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.libraryService.approve(documentId, userId, ipAddress, userAgent);
  }

  @Post('documents/:documentId/request-changes')
  @ApiOperation({ summary: 'Send the document back to draft with the changes to make (its approver)' })
  @UseGuards(ProjectRoleGuard)
  async requestChanges(
    @Param('documentId') documentId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RequestChangesDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.libraryService.requestChanges(documentId, userId, dto.comment, ipAddress, userAgent);
  }

  @Post('documents/:documentId/withdraw')
  @ApiOperation({ summary: 'Take back a document sent for approval' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  async withdraw(
    @Param('documentId') documentId: string,
    @CurrentUser('id') userId: string,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.libraryService.withdraw(documentId, userId, ipAddress, userAgent);
  }

  @Delete('documents/:documentId')
  @ApiOperation({ summary: 'Delete a document that was never published' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  async deleteDocument(
    @Param('documentId') documentId: string,
    @CurrentUser('id') userId: string,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.documentsService.deleteDocument(documentId, userId, ipAddress, userAgent);
  }

  @Get('documents/:documentId/library/:version/pdf')
  @ApiOperation({ summary: 'Open a published PDF version' })
  @UseGuards(ProjectRoleGuard)
  async getPdf(@Param('documentId') documentId: string, @Param('version') version: string, @Res() res: Response) {
    const { buffer, filename } = await this.libraryService.getPdf(documentId, version);
    sendFile(res, buffer, filename, 'application/pdf', 'inline');
  }

  @Get('organizations/:orgId/library')
  @ApiOperation({ summary: 'Published documents of the projects the user belongs to' })
  @UseGuards(OrganizationRoleGuard)
  async getLibrary(@Param('orgId') orgId: string, @CurrentUser('id') userId: string) {
    return this.libraryService.getLibrary(orgId, userId);
  }
}
