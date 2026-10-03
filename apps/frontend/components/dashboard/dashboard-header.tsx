'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import { useProjectStore } from '@/store/project-store';
import { NotificationBell } from './notification-bell';

const PROJECT_ROLE_LABELS = { PROJECT_LEAD: 'Project lead', PROJECT_MEMBER: 'Project member', PROJECT_AUDITOR: 'Auditor' } as const;
const ORG_ROLE_LABELS = { ORG_OWNER: 'Owner', ORG_ADMIN: 'Admin', ORG_MEMBER: 'Member' } as const;

export function DashboardHeader() {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const currentProject = useProjectStore((s) => s.currentProject);
  // The role that applies to the page being viewed: in a project, then in the organization.
  const inProject = !!currentProject && pathname.includes(`/projects/${currentProject.id}`);
  const inOrg = !!currentOrg && pathname.includes(`/organizations/${currentOrg.id}`);
  const projectRole = inProject && currentProject.members?.find((m) => m.user_id === user?.id)?.privilege;
  const orgRole = inOrg && currentOrg.members?.find((m) => m.user_id === user?.id)?.role;
  const roleLabel = projectRole ? PROJECT_ROLE_LABELS[projectRole] : orgRole ? ORG_ROLE_LABELS[orgRole] : null;

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName) return '??';
    return ((firstName?.[0] || '') + (lastName?.[0] || '')).toUpperCase();
  };

  return (
    <header className="flex items-center justify-end gap-5 mb-7 fade-up" style={{ animationDelay: '0.05s' }}>
      {/* Right side: theme, notifications, user */}
      <div className="flex items-center gap-3.5">
        <ThemeToggle glass />

        <NotificationBell />

        {/* User avatar + name → navigates to profile */}
        <Link
          href="/dashboard/profile"
          className="flex items-center gap-2.5 group"
        >
          <div
            className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center font-display text-[13px] font-semibold text-white shrink-0 transition-shadow duration-200 group-hover:shadow-[0_0_12px_rgba(255,145,0,0.3)]"
            style={{ background: 'linear-gradient(135deg, var(--brand-orange), #FFB347)' }}
          >
            {getInitials(user?.first_name, user?.last_name)}
          </div>
          <div className="leading-tight">
            <div className="text-[13.5px] font-semibold transition-colors duration-200 group-hover:text-[var(--brand-orange)]">
              {user?.first_name} {user?.last_name}
            </div>
            {roleLabel && <div className="text-[11px] text-dim">{roleLabel}</div>}
          </div>
        </Link>
      </div>
    </header>
  );
}
