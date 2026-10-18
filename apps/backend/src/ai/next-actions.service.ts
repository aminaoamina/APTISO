import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../common/services/project-access.service';
import { TASK_TYPE_LABELS } from '../tasks/task-labels';
import { AiServiceClient } from './ai-service.client';

interface Item {
  id: string;
  title: string;
  /** Lower comes first when the AI is not available. */
  rank: number;
  href: string;
  due: Date | null;
  overdue: boolean;
}

const DAY = 24 * 60 * 60 * 1000;
const SOON_DAYS = 7;
const EXPIRY_DAYS = 30;
const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * "What should I do next?": the facts are computed here from the person's
 * records (tasks, approvals, decisions, expiring evidence, open AI findings);
 * the AI service only ranks and phrases them. Without the AI the same items
 * are shown in a fixed order.
 */
@Injectable()
export class NextActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly ai: AiServiceClient,
  ) {}

  async forUser(projectId: string, userId: string) {
    const access = await this.access.forProject(projectId, userId);
    const items = await this.items(projectId, userId, access);
    if (items.length === 0) return { actions: [], ranked_by: 'rules' as const };
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { first_name: true } });
    try {
      const r = await this.ai.request<{ actions: { id: string; why: string }[] }>('POST', '/v1/next-actions', {
        project_id: projectId,
        user_id: userId,
        user: `${user?.first_name ?? ''}, ${access.role === 'PROJECT_LEAD' ? 'project lead' : access.canEdit ? 'implementer' : 'auditor'}${access.isTopManagement ? ', top management' : ''}`,
        items: items.map(i => ({ id: i.id, text: i.title })),
      }, { timeoutMs: 30_000 });
      const byId = new Map(items.map(i => [i.id, i]));
      return { actions: r.actions.filter(a => byId.has(a.id)).map(a => ({ ...this.view(byId.get(a.id)!), why: a.why })), ranked_by: 'ai' as const };
    } catch {
      return { actions: [...items].sort((a, b) => a.rank - b.rank).slice(0, 5).map(i => ({ ...this.view(i), why: null })), ranked_by: 'rules' as const };
    }
  }

  private view(i: Item) {
    return { id: i.id, title: i.title, href: i.href, due: i.due ? day(i.due) : null, overdue: i.overdue };
  }

  private async items(projectId: string, userId: string, access: { canEdit: boolean; canDecide: boolean; role: string }): Promise<Item[]> {
    const now = new Date();
    const project = await this.prisma.complianceProject.findUnique({ where: { id: projectId }, select: { organization_id: true } });
    const base = `/dashboard/organizations/${project?.organization_id}/projects/${projectId}`;
    const [tasks, requests, evidence, reviews] = await Promise.all([
      this.prisma.taskAssignment.findMany({
        where: { project_id: projectId, assigned_to: userId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
        select: { id: true, type: true, deadline: true, notes: true, step: { select: { id: true, title: true } }, document: { select: { id: true, title: true } } },
        orderBy: { deadline: 'asc' },
        take: 15,
      }),
      access.canDecide
        ? this.prisma.resourceRequest.findMany({ where: { project_id: projectId, status: 'PENDING' }, select: { id: true, kind: true, description: true, created_at: true }, take: 10 })
        : [],
      this.prisma.evidence.findMany({
        where: {
          project_id: projectId, deleted_at: null, valid_until: { not: null, lte: new Date(now.getTime() + EXPIRY_DAYS * DAY) },
          ...(access.role !== 'PROJECT_LEAD' && { created_by: userId }),
        },
        select: { id: true, title: true, valid_until: true },
        take: 10,
      }),
      access.canEdit
        ? this.prisma.documentAiReview.findMany({
            where: { project_id: projectId, status: 'DONE', findings: { some: { state: 'OPEN', severity: { in: ['high', 'medium'] } } } },
            select: { document_id: true, created_at: true, document: { select: { title: true } }, findings: { where: { state: 'OPEN' }, select: { severity: true } } },
            orderBy: { created_at: 'desc' },
          })
        : [],
    ]);

    const items: Item[] = [];
    for (const t of tasks) {
      const what = t.document?.title ?? t.step?.title ?? t.notes?.split('\n')[0]?.slice(0, 120) ?? '';
      const overdue = !!t.deadline && t.deadline < now;
      const soon = !!t.deadline && !overdue && t.deadline.getTime() - now.getTime() < SOON_DAYS * DAY;
      const late = overdue ? ` (overdue by ${Math.ceil((now.getTime() - t.deadline!.getTime()) / DAY)} days)` : '';
      items.push({
        id: `task:${t.id}`,
        title: `Task: ${TASK_TYPE_LABELS[t.type]}${what ? ` – ${what}` : ''}${t.deadline ? `, due ${day(t.deadline)}${late}` : ''}`,
        rank: overdue ? 0 : t.type === 'APPROVE_DOCUMENT' ? 1 : soon ? 3 : 5,
        href: t.document ? `${base}/documents/${t.document.id}` : t.step ? `${base}/steps/${t.step.id}` : '/dashboard/tasks',
        due: t.deadline,
        overdue,
      });
    }
    for (const r of requests) {
      items.push({
        id: `request:${r.id}`,
        title: `Request waiting for your decision (${r.kind.toLowerCase()}): ${r.description.slice(0, 150)}, sent ${day(r.created_at)}`,
        rank: 1, href: `${base}/requests`, due: null, overdue: false,
      });
    }
    for (const e of evidence) {
      const expired = e.valid_until! < now;
      items.push({
        id: `evidence:${e.id}`,
        title: `Evidence "${e.title}" ${expired ? 'expired on' : 'expires on'} ${day(e.valid_until!)}: renew it or upload a new version`,
        rank: expired ? 2 : 4, href: `${base}/audit`, due: e.valid_until, overdue: expired,
      });
    }
    const seen = new Set<string>();
    for (const r of reviews) {
      if (seen.has(r.document_id)) continue; // the latest review of each document
      seen.add(r.document_id);
      const high = r.findings.filter(f => f.severity === 'high').length;
      items.push({
        id: `review:${r.document_id}`,
        title: `Document "${r.document.title}" has ${r.findings.length} open AI review finding(s)${high ? `, ${high} high` : ''}: fix them or dismiss them`,
        rank: high ? 3 : 6, href: `${base}/documents/${r.document_id}`, due: null, overdue: false,
      });
    }
    return items.slice(0, 40);
  }
}
