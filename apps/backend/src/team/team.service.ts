import { Injectable } from '@nestjs/common';
import { IsoRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../common/services/project-access.service';
import { TASK_TYPE_LABELS } from '../tasks/task-labels';

const DAY = 24 * 60 * 60 * 1000;
const OPEN = ['PENDING', 'IN_PROGRESS'] as const;

/** ISO roles an auditor expects someone to hold. */
const EXPECTED_ROLES: { role: IsoRole; label: string; why: string }[] = [
  { role: IsoRole.TOP_MANAGEMENT, label: 'Top management', why: 'approves the policy, the objectives and the resources (clauses 5.1, 5.2)' },
  { role: IsoRole.INFORMATION_SECURITY_MANAGER, label: 'Information security manager', why: 'runs the ISMS day to day (clause 5.3)' },
  { role: IsoRole.INTERNAL_AUDITOR, label: 'Internal auditor', why: 'performs the internal audits (clause 9.2)' },
];

/**
 * Members dashboard: every project member with their workload (open, overdue,
 * due this week, done in the last 30 days) and the ISO roles nobody holds yet.
 * Read-only: it only shows what the project already records.
 */
@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  async overview(projectId: string, userId: string) {
    await this.access.forProject(projectId, userId);
    const now = new Date();
    const [members, tasks] = await Promise.all([
      this.prisma.projectMember.findMany({
        where: { project_id: projectId },
        select: { user_id: true, privilege: true, custom_role: true, iso_roles: { select: { iso_role: true } },
          user: { select: { first_name: true, last_name: true, email: true } } },
        orderBy: { joined_at: 'asc' },
      }),
      this.prisma.taskAssignment.findMany({
        where: { project_id: projectId, OR: [{ status: { in: [...OPEN] } }, { status: 'COMPLETED', completed_at: { gte: new Date(now.getTime() - 30 * DAY) } }] },
        select: { id: true, assigned_to: true, type: true, status: true, deadline: true, notes: true,
          step: { select: { id: true, title: true } }, document: { select: { id: true, title: true } } },
        orderBy: { deadline: 'asc' },
      }),
    ]);

    const people = members.map(m => {
      const own = tasks.filter(t => t.assigned_to === m.user_id);
      const open = own.filter(t => t.status !== 'COMPLETED');
      return {
        user_id: m.user_id,
        name: `${m.user.first_name} ${m.user.last_name}`.trim() || m.user.email,
        email: m.user.email,
        privilege: m.privilege,
        job_title: m.custom_role,
        iso_roles: m.iso_roles.map(r => r.iso_role),
        open: open.length,
        overdue: open.filter(t => t.deadline && t.deadline < now).length,
        due_this_week: open.filter(t => t.deadline && t.deadline >= now && t.deadline.getTime() - now.getTime() <= 7 * DAY).length,
        done_30_days: own.length - open.length,
        tasks: open.slice(0, 10).map(t => ({
          id: t.id,
          title: `${TASK_TYPE_LABELS[t.type]}${t.document?.title ?? t.step?.title ? ` – ${t.document?.title ?? t.step?.title}` : ''}`,
          deadline: t.deadline,
          overdue: !!t.deadline && t.deadline < now,
          document_id: t.document?.id ?? null,
          step_id: t.step?.id ?? null,
        })),
      };
    });

    const held = new Set(members.flatMap(m => m.iso_roles.map(r => r.iso_role)));
    return {
      people,
      totals: {
        members: people.length,
        open: people.reduce((n, p) => n + p.open, 0),
        overdue: people.reduce((n, p) => n + p.overdue, 0),
        done_30_days: people.reduce((n, p) => n + p.done_30_days, 0),
      },
      gaps: EXPECTED_ROLES.filter(r => !held.has(r.role)).map(r => ({ role: r.role, label: r.label, why: r.why })),
    };
  }
}
