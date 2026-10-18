import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectRoles } from '../common/decorators/project-role.decorator';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { AssistService } from './assist.service';
import { ChatService } from './chat.service';
import { KnowledgeService } from './knowledge.service';
import { NextActionsService } from './next-actions.service';
import { ChatDto, DecisionDto, ImproveDto, SuggestDto } from './assist.dto';

const EDITORS = [ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER];
const STOPPED = 'event: error\ndata: {"code":"ai_unavailable","message":"The AI assistant stopped unexpectedly"}\n\n';

/** Forwards an AI service SSE stream to the browser; closing the page stops the AI call. */
async function forward(req: Request, res: Response, open: (signal: AbortSignal) => Promise<ReadableStream<Uint8Array>>) {
  const abort = new AbortController();
  res.on('close', () => abort.abort());
  const stream = await open(abort.signal);
  res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  try {
    for await (const chunk of stream) res.write(chunk);
  } catch {
    if (!abort.signal.aborted && !req.destroyed) res.write(STOPPED);
  }
  res.end();
}

@ApiTags('AI')
@ApiBearerAuth()
@Controller('projects/:projectId/ai')
@UseGuards(ProjectRoleGuard)
export class AssistController {
  constructor(
    private readonly assist: AssistService,
    private readonly chats: ChatService,
    private readonly knowledge: KnowledgeService,
    private readonly nextActions: NextActionsService,
  ) {}

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
    await forward(req, res, signal => this.assist.improve(projectId, userId, dto, signal));
  }

  @Post('chat')
  @ApiOperation({ summary: 'Companion chat: answer from the project documents and records the person may see (SSE: delta, citations, done, error)' })
  async chat(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: ChatDto,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await forward(req, res, signal => this.chats.chat(projectId, userId, dto, signal));
  }

  @Get('next-actions')
  @ApiOperation({ summary: 'What the person should do next: their tasks, approvals, decisions and expiring evidence, ranked by the AI' })
  next(@Param('projectId', ParseUUIDPipe) projectId: string, @CurrentUser('id') userId: string) {
    return this.nextActions.forUser(projectId, userId);
  }

  @Post('reindex')
  @ProjectRoles(ProjectRole.PROJECT_LEAD)
  @ApiOperation({ summary: 'Index every document of the project again for the companion chat' })
  reindex(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.knowledge.reindexProject(projectId);
  }

  @Post('decisions')
  @ApiOperation({ summary: 'Record the decision on an AI proposal (accepted or dismissed)' })
  decide(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: DecisionDto, @CurrentUser('id') userId: string) {
    return this.assist.decide(projectId, userId, dto);
  }
}
