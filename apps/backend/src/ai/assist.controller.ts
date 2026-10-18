import { Body, Controller, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectRoles } from '../common/decorators/project-role.decorator';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { AssistService } from './assist.service';
import { DecisionDto, ImproveDto, SuggestDto } from './assist.dto';

const EDITORS = [ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER];

@ApiTags('AI')
@ApiBearerAuth()
@Controller('projects/:projectId/ai')
@UseGuards(ProjectRoleGuard)
export class AssistController {
  constructor(private readonly assist: AssistService) {}

  @Post('wizard/suggest')
  @ProjectRoles(...EDITORS)
  @ApiOperation({ summary: '✨ Suggest an answer for a wizard question, from the project data' })
  suggest(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: SuggestDto, @CurrentUser('id') userId: string) {
    return this.assist.suggest(projectId, userId, dto);
  }

  @Post('improve')
  @ProjectRoles(...EDITORS)
  @ApiOperation({ summary: 'Improve a passage of a document (SSE stream: delta, done, error)' })
  async improve(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: ImproveDto,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Closing the page stops the AI call.
    const abort = new AbortController();
    res.on('close', () => abort.abort());
    const stream = await this.assist.improve(projectId, userId, dto, abort.signal);
    res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    try {
      for await (const chunk of stream) res.write(chunk);
    } catch {
      if (!abort.signal.aborted && !req.destroyed) res.write('event: error\ndata: {"code":"ai_unavailable","message":"The AI assistant stopped unexpectedly"}\n\n');
    }
    res.end();
  }

  @Post('decisions')
  @ApiOperation({ summary: 'Record the decision on an AI proposal (accepted or dismissed)' })
  decide(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: DecisionDto, @CurrentUser('id') userId: string) {
    return this.assist.decide(projectId, userId, dto);
  }
}
