import { Controller, Get, Param, ParseBoolPipe, Query, Res, UseGuards, DefaultValuePipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { sendFile } from '../common/utils/send-file';
import { ExportsService } from './exports.service';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Any project member, including the auditor, can export (read-only). */
@ApiTags('Exports')
@ApiBearerAuth()
@Controller('projects/:projectId/exports')
@UseGuards(ProjectRoleGuard)
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  @Get('registers/:register')
  @ApiOperation({ summary: 'A register as Excel ("all" for every register, one sheet each)' })
  async register(@Param('projectId') projectId: string, @Param('register') register: string, @CurrentUser('id') userId: string, @Res() res: Response) {
    const { buffer, filename } = await this.exports.registers(projectId, register, userId);
    sendFile(res, buffer, filename, XLSX, 'attachment');
  }

  @Get('library')
  @ApiOperation({ summary: 'The document library as a ZIP: PDF and Word of each approved document, master list and registers' })
  async library(
    @Param('projectId') projectId: string,
    @Query('earlier_versions', new DefaultValuePipe(false), ParseBoolPipe) earlierVersions: boolean,
    @Query('evidence', new DefaultValuePipe(false), ParseBoolPipe) evidence: boolean,
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ) {
    const filename = await this.exports.libraryFileName(projectId);
    const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    await this.exports.library(projectId, { earlierVersions, evidence }, userId, res);
  }
}
