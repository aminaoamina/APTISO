import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const HISTORY_TURNS = 6;
const encoder = new TextEncoder();

/**
 * Companion chat history: each person's conversations in a project, private
 * to them. The answer is saved once the AI service has finished streaming it.
 */
@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  list(projectId: string, userId: string) {
    return this.prisma.aiConversation.findMany({
      where: { project_id: projectId, user_id: userId },
      orderBy: { updated_at: 'desc' },
      select: { id: true, title: true, updated_at: true },
      take: 50,
    });
  }

  async get(projectId: string, userId: string, id: string) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id, project_id: projectId, user_id: userId },
      select: { id: true, title: true, messages: { orderBy: { created_at: 'asc' }, select: { role: true, content: true, citations: true } } },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async remove(projectId: string, userId: string, id: string) {
    const { count } = await this.prisma.aiConversation.deleteMany({ where: { id, project_id: projectId, user_id: userId } });
    if (!count) throw new NotFoundException('Conversation not found');
    return { deleted: true };
  }

  /** The conversation to continue (the person's own) or a new one titled by the question; with its last turns. */
  async open(projectId: string, userId: string, question: string, id?: string) {
    if (id) {
      const { messages } = await this.get(projectId, userId, id);
      return { id, history: messages.slice(-HISTORY_TURNS).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })) };
    }
    const title = question.replace(/\s+/g, ' ').trim();
    const created = await this.prisma.aiConversation.create({
      data: { project_id: projectId, user_id: userId, title: title.length > 80 ? `${title.slice(0, 79)}…` : title },
    });
    return { id: created.id, history: [] };
  }

  async add(conversationId: string, role: 'user' | 'assistant', content: string, citations?: unknown) {
    await this.prisma.$transaction([
      this.prisma.aiMessage.create({ data: { conversation_id: conversationId, role, content, ...(citations != null && { citations: citations as Prisma.InputJsonValue }) } }),
      this.prisma.aiConversation.update({ where: { id: conversationId }, data: { updated_at: new Date() } }),
    ]);
  }

  /**
   * Passes the answer stream through unchanged, first telling the browser
   * which conversation it belongs to, and saves the answer when it is done.
   */
  record(conversationId: string, upstream: ReadableStream<Uint8Array>) {
    const decoder = new TextDecoder();
    let buffer = '';
    let answer = '';
    let citations: unknown = null;
    const handle = async (block: string) => {
      const event = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (!event || !data) return;
      if (event === 'delta') answer += (JSON.parse(data) as { text: string }).text;
      else if (event === 'citations') citations = JSON.parse(data);
      else if (event === 'done' && answer) {
        await this.add(conversationId, 'assistant', answer, citations).catch((e: Error) => this.logger.warn(`Chat answer not saved: ${e.message}`));
      }
    };
    return upstream.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      start: controller => controller.enqueue(encoder.encode(`event: conversation\ndata: ${JSON.stringify({ id: conversationId })}\n\n`)),
      transform: async (chunk, controller) => {
        controller.enqueue(chunk);
        buffer += decoder.decode(chunk, { stream: true });
        let end: number;
        while ((end = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          await handle(block);
        }
      },
    }));
  }
}
