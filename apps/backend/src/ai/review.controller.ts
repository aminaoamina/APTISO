import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { AiFindingState, ProjectRole } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectRoles } from '../common/decorators/project-role.decorator';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { DocumentReviewService } from './review.service';

const EDITORS = [ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER];

class FindingDecisionDto {
  @ApiProperty({ enum: AiFindingState }) @IsEnum(AiFindingState) state!: AiFindingState;
}

@ApiTags('AI')
@ApiBearerAuth()
@Controller('projects/:projectId')
@UseGuards(ProjectRoleGuard)
export class DocumentReviewController {
  constructor(private readonly reviews: DocumentReviewService) {}

  @Post('documents/:documentId/ai-review')
  @ProjectRoles(...EDITORS)
  @ApiOperation({ summary: 'Start an AI review of the document (background job; the same content is not reviewed twice)' })
  request(@Param('projectId', ParseUUIDPipe) projectId: string, @Param('documentId', ParseUUIDPipe) documentId: string, @CurrentUser('id') userId: string) {
    return this.reviews.request(projectId, userId, documentId);
  }

  @Get('documents/:documentId/ai-review')
  @ApiOperation({ summary: 'The latest AI review of the document and its findings' })
  latest(@Param('projectId', ParseUUIDPipe) projectId: string, @Param('documentId', ParseUUIDPipe) documentId: string, @CurrentUser('id') userId: string) {
    return this.reviews.latest(projectId, userId, documentId);
  }

  @Patch('ai-review/findings/:findingId')
  @ProjectRoles(...EDITORS)
  @ApiOperation({ summary: 'Accept or dismiss an AI review finding' })
  decide(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('findingId', ParseUUIDPipe) findingId: string,
    @Body() dto: FindingDecisionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.reviews.decide(projectId, userId, findingId, dto.state);
  }
}
