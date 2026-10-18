import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { withProgress, type Progress } from '../projects/project-progress';
import { AiServiceClient } from './ai-service.client';
import { AiContextService } from './context.service';
import { KnowledgeService } from './knowledge.service';
import { ChatDto } from './assist.dto';
import { ConversationsService } from './conversations.service';

interface Search {
  chunks: { id: string; source_type: string; source_id: string; version: string | null; title: string; section: string | null; content: string }[];
  refs: string[];
}

const taskLabel = (type: string) => type.toLowerCase().replace(/_/g, ' ');
const PROGRESS_LABEL = { NOT_STARTED: 'not started', IN_PROGRESS: 'in progress', COMPLETED: 'done' } as const;

/**
 * The companion chat. The backend decides what the person may see (project,
 * role), finds the relevant passages with the AI service, adds the project's
 * records about the clauses and controls involved, then streams the answer.
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly ai: AiServiceClient,
    private readonly context: AiContextService,
    private readonly knowledge: KnowledgeService,
    private readonly conversations: ConversationsService,
    private readonly prisma: PrismaService,
  ) {}

  async chat(projectId: string, userId: string, dto: ChatDto, signal: AbortSignal) {
    const ctx = await this.context.build(projectId, userId);
    // The history comes from the saved conversation, not from the browser.
    const conversation = await this.conversations.open(projectId, userId, dto.message, dto.conversation_id);
    await this.conversations.add(conversation.id, 'user', dto.message);
    // Auditors (read-only) see only what is in the library; editors also see drafts.
    const visibilities = ctx.access.canEdit ? ['all', 'editors'] : ['all'];
    await this.knowledge.ensureIndexed(projectId);
    // A follow-up ("and how often?") is searched together with the question before it.
    const previous = [...conversation.history].reverse().find(t => t.role === 'user')?.content;
    const query = previous ? `${previous.slice(0, 500)}\n${dto.message}` : dto.message;
    const found = await this.ai.request<Search>('POST', '/v1/search', { project_id: projectId, user_id: userId, visibilities, query }, { timeoutMs: 30_000 });
    // Where the project stands comes first: questions such as "what is left?" need it whatever they mention.
    const facts = [await this.progressFact(projectId), ...(await this.knowledge.facts(projectId, found.refs, ctx.access.canEdit))];

    const user = [
      `Name: ${ctx.user.name}`,
      `Role in the project: ${ctx.user.role}${ctx.user.isTopManagement ? ', top management' : ''}`,
      `Organization: ${ctx.organization}, project "${ctx.project}"`,
      ctx.tasks.length
        ? `Open tasks:\n${ctx.tasks.map(t => `- ${taskLabel(t.type)}${t.deadline ? ` (due ${t.deadline.toISOString().slice(0, 10)})` : ''}${t.notes ? `: ${t.notes.slice(0, 200)}` : ''}`).join('\n')}`
        : 'Open tasks: none',
    ].join('\n');

    const answer = await this.ai.stream('/v1/chat', {
      project_id: projectId,
      user_id: userId,
      question: dto.message,
      user,
      history: conversation.history,
      chunks: found.chunks.map(c => ({ ...c, content: c.content.slice(0, 6000) })),
      facts,
    }, signal);
    return this.conversations.record(conversation.id, answer);
  }

  /** The phases and steps as the project page shows them, with what is not finished. */
  private async progressFact(projectId: string) {
    const project = await this.prisma.complianceProject.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        id: true,
        target_date: true,
        maintenance: { select: { certification_date: true } },
        phases: { orderBy: { order: 'asc' }, select: { order: true, name: true, steps: { orderBy: { order: 'asc' }, select: { id: true, key: true, title: true, status: true, completion_data: true } } } },
      },
    });
    const view = await withProgress(this.prisma, project);
    const lines = [`Project progress: ${view.progress.completed_steps} of ${view.progress.total_steps} steps done (${view.progress.percent}%)${project.target_date ? `, target date ${project.target_date.toISOString().slice(0, 10)}` : ''}.`];
    for (const phase of view.phases) {
      const steps = phase.steps as unknown as { title: string; progress: Progress }[];
      const open = steps.filter(st => st.progress !== 'COMPLETED');
      const done = steps.length - open.length;
      lines.push(`Phase ${phase.order} ${phase.name}: ${done}/${steps.length} steps done${open.length ? `. Not finished: ${open.slice(0, 12).map(st => `"${st.title}" (${PROGRESS_LABEL[st.progress]})`).join(', ')}` : ''}.`);
    }
    if (!project.maintenance?.certification_date) lines.push('Certification date: not recorded yet (Phase 5, Maintenance).');
    return { text: lines.join('\n').slice(0, 2000), source_type: 'project', source_id: projectId };
  }
}
