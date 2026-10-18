import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectRoles } from '../common/decorators/project-role.decorator';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { EvidenceAnalysisService } from './evidence-analysis.service';

@ApiTags('Evidence')
@ApiBearerAuth()
@Controller('projects/:projectId/evidence/:evidenceId/analysis')
@UseGuards(ProjectRoleGuard)
export class EvidenceAnalysisController {
  constructor(private readonly analyses: EvidenceAnalysisService) {}

  @Get()
  @ApiOperation({ summary: 'What the AI read in the evidence file: summary, suggested controls and clauses, expiry date (proposals)' })
  view(@Param('projectId', ParseUUIDPipe) projectId: string, @Param('evidenceId', ParseUUIDPipe) evidenceId: string, @CurrentUser('id') userId: string) {
    return this.analyses.view(projectId, userId, evidenceId);
  }

  @Post()
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  @ApiOperation({ summary: 'Analyse the evidence file again (after a failure)' })
  retry(@Param('projectId', ParseUUIDPipe) projectId: string, @Param('evidenceId', ParseUUIDPipe) evidenceId: string, @CurrentUser('id') userId: string) {
    return this.analyses.retry(projectId, userId, evidenceId);
  }
}
