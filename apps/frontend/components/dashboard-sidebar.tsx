'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Check,
  ChevronDown,
  FolderOpen,
  Users,
  LogOut,
  ArrowLeft,
  Home,
  ListChecks,
  Files,
  ListTodo,
  Settings2,
  RefreshCcw,
  Presentation,
  UserCog,
  BookOpen,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import { useProjectStore } from '@/store/project-store';
import { useInboxStore } from '@/store/inbox-store';
import { isOpen, isOverdue } from '@/lib/tasks';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavItem {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
  /** Counter shown on the right, red when something is late. */
  badge?: { count: number; alert?: boolean };
}

function NavSectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="nav-section-title">{children}</div>;
}

function NavRow({
  item,
  isActive,
}: {
  item: NavItem;
  isActive?: boolean;
}) {
  const Icon = item.icon;

  if (!item.href || item.soon) {
    return (
      <div className="nav-item nav-item-disabled" aria-disabled="true">
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span>{item.label}</span>
        {item.soon && <span className="soon-badge">Soon</span>}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn('nav-item', isActive && 'active')}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span>{item.label}</span>
      {!!item.badge?.count && (
        <span
          className="ml-auto min-w-[20px] rounded-full px-1.5 text-center text-[11px] font-semibold leading-5 text-white"
          style={{ background: item.badge.alert ? 'var(--danger)' : 'var(--brand-orange)' }}
        >
          {item.badge.count}
        </span>
      )}
    </Link>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuthStore();
  const { organizations, currentOrg, loadOrganizations, selectOrg } = useOrgStore();
  const {
    currentProject,
    selectProject,
    projects: orgProjects,
    loadProjects,
  } = useProjectStore();
  const orgMatch = pathname.match(/^\/dashboard\/organizations\/([^/]+)(?:\/|$)/);
  const projectMatch = pathname.match(
    /^\/dashboard\/organizations\/[^/]+\/projects\/([^/]+)(?:\/|$)/,
  );
  const orgId = orgMatch?.[1];
  const projectId = projectMatch?.[1];
  const inProjectContext = Boolean(projectId);
  const myTasks = useInboxStore((s) => s.myTasks);
  const openTasks = myTasks.filter(isOpen);
  const tasksBadge = { count: openTasks.length, alert: openTasks.some(isOverdue) };
  const isLead =
    currentProject?.members?.some(
      (m) => m.user_id === user?.id && m.privilege === 'PROJECT_LEAD',
    ) ?? false;

  React.useEffect(() => {
    if (organizations.length === 0) {
      loadOrganizations();
    }
  }, [organizations.length, loadOrganizations]);

  React.useEffect(() => {
    if (projectId && currentProject?.id !== projectId) {
      selectProject(projectId);
    }
  }, [projectId, currentProject?.id, selectProject]);

  React.useEffect(() => {
    if (inProjectContext && orgId && orgProjects.length === 0) {
      loadProjects(orgId);
    }
  }, [inProjectContext, orgId, orgProjects.length, loadProjects]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const projectsHref = orgId ? `/dashboard/organizations/${orgId}/projects` : '/dashboard';

  return (
    <aside
      className="glass-edgeless flex flex-col h-full"
      style={{
        width: '260px',
        minWidth: '260px',
        borderRadius: 0,
        borderTop: 'none',
        borderBottom: 'none',
        borderLeft: 'none',
        borderRight: '1px solid rgba(var(--glass-border), var(--glass-border-alpha))',
      }}
    >
      {/* Brand + organization switcher */}
      <div className="px-4 pt-7 pb-4">
        <div className="flex items-center gap-3 px-1 pb-5">
          <Logo variant="icon" className="h-9 w-auto" />
          <div className="font-display text-[15px] font-bold tracking-tight">APTISO</div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]">
              <Building2 className="h-4 w-4 shrink-0 text-[var(--brand-orange)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] uppercase tracking-[0.12em] text-dim">Workspace</span>
                <span className="block truncate text-[13px] font-semibold">
                  {currentOrg?.name || 'Select organization'}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-dim" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {organizations.map((organization) => (
              <DropdownMenuItem
                key={organization.id}
                onSelect={() => {
                  selectOrg(organization.id);
                  router.push(`/dashboard/organizations/${organization.id}`);
                }}
              >
                <Building2 className="h-4 w-4" />
                <span className="min-w-0 flex-1 truncate">{organization.name}</span>
                {currentOrg?.id === organization.id && <Check className="h-4 w-4 text-[var(--brand-orange)]" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Contextual navigation */}
      <nav className="flex-1 overflow-y-auto pb-2">
        {inProjectContext ? (
          <>
            <NavSectionTitle>Project</NavSectionTitle>
            <div className="flex flex-col gap-1 px-3">
              <NavRow item={{ label: 'All projects', href: projectsHref, icon: ArrowLeft }} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="nav-item w-full text-left" aria-current="location">
                    <FolderOpen className="h-[18px] w-[18px] shrink-0 text-[var(--brand-orange)]" />
                    <span className="min-w-0 flex-1 truncate">
                      {currentProject?.name || 'Loading project…'}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-dim" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-60 max-h-72 overflow-y-auto">
                  {orgProjects.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-dim">No other projects</div>
                  )}
                  {orgProjects.map((project) => (
                    <DropdownMenuItem
                      key={project.id}
                      onSelect={() =>
                        orgId &&
                        router.push(`/dashboard/organizations/${orgId}/projects/${project.id}`)
                      }
                    >
                      <FolderOpen className="h-4 w-4 shrink-0 opacity-70" />
                      <span className="min-w-0 flex-1 truncate">{project.name}</span>
                      {currentProject?.id === project.id && (
                        <Check className="h-4 w-4 shrink-0 text-[var(--brand-orange)]" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <NavSectionTitle>Overview</NavSectionTitle>
            <div className="flex flex-col gap-1 px-3">
              <NavRow
                item={{
                  label: 'Dashboard',
                  href: projectId ? `/dashboard/organizations/${orgId}/projects/${projectId}` : undefined,
                  icon: LayoutDashboard,
                }}
                isActive={Boolean(projectId) && pathname === `/dashboard/organizations/${orgId}/projects/${projectId}`}
              />
            </div>

            <NavSectionTitle>Compliance</NavSectionTitle>
            <div className="flex flex-col gap-1 px-3">
              <NavRow
                item={{
                  label: 'Implementation Steps',
                  href: projectId ? `/dashboard/organizations/${orgId}/projects/${projectId}/steps` : undefined,
                  icon: ListChecks,
                }}
                isActive={Boolean(projectId) && pathname.startsWith(`/dashboard/organizations/${orgId}/projects/${projectId}/steps`)}
              />
              <NavRow item={{ label: 'Audit & Evidence', icon: Files, soon: true }} />
              <NavRow
                item={{
                  label: 'Maintenance',
                  href: projectId ? `/dashboard/organizations/${orgId}/projects/${projectId}/maintenance` : undefined,
                  icon: RefreshCcw,
                }}
                isActive={Boolean(projectId) && pathname.startsWith(`/dashboard/organizations/${orgId}/projects/${projectId}/maintenance`)}
              />
            </div>

            <NavSectionTitle>Collaboration</NavSectionTitle>
            <div className="flex flex-col gap-1 px-3">
              <NavRow
                item={{
                  label: 'Document Library',
                  href: `/dashboard/organizations/${orgId}/library`,
                  icon: BookOpen,
                }}
                isActive={pathname.startsWith(`/dashboard/organizations/${orgId}/library`)}
              />
              <NavRow item={{ label: 'Whiteboard', icon: Presentation, soon: true }} />
            </div>

            <NavSectionTitle>People & Tasks</NavSectionTitle>
            <div className="flex flex-col gap-1 px-3">
              <NavRow
                item={{
                  label: 'My tasks',
                  href: '/dashboard/tasks',
                  icon: ListTodo,
                  badge: tasksBadge,
                }}
                isActive={pathname === '/dashboard/tasks'}
              />
              {isLead && (
                <NavRow item={{ label: 'Team Management', icon: UserCog, soon: true }} />
              )}
              <NavRow
                item={{
                  label: 'Project members',
                  href: projectId ? `/dashboard/organizations/${orgId}/projects/${projectId}/members` : undefined,
                  icon: Users,
                }}
                isActive={Boolean(projectId) && pathname.startsWith(`/dashboard/organizations/${orgId}/projects/${projectId}/members`)}
              />
            </div>
          </>
        ) : (
          currentOrg && (
            <>
              <NavSectionTitle>Overview</NavSectionTitle>
              <div className="flex flex-col gap-1 px-3">
                <NavRow
                  item={{
                    label: 'Organization dashboard',
                    href: `/dashboard/organizations/${currentOrg.id}`,
                    icon: Building2,
                  }}
                  isActive={pathname === `/dashboard/organizations/${currentOrg.id}`}
                />
              </div>

              <NavSectionTitle>Workspace</NavSectionTitle>
              <div className="flex flex-col gap-1 px-3">
                <NavRow
                  item={{ label: 'Projects', href: `/dashboard/organizations/${currentOrg.id}/projects`, icon: FolderOpen }}
                  isActive={pathname.startsWith(`/dashboard/organizations/${currentOrg.id}/projects`)}
                />
              <NavRow
                item={{ label: 'Members', href: `/dashboard/organizations/${currentOrg.id}/members`, icon: Users }}
                isActive={pathname.startsWith(`/dashboard/organizations/${currentOrg.id}/members`)}
              />
              <NavRow
                item={{ label: 'Document Library', href: `/dashboard/organizations/${currentOrg.id}/library`, icon: BookOpen }}
                isActive={pathname.startsWith(`/dashboard/organizations/${currentOrg.id}/library`)}
              />
            </div>
            </>
          )
        )}

        {/* Personal section - always visible */}
        <NavSectionTitle>Personal</NavSectionTitle>
        <div className="flex flex-col gap-1 px-3">
          <NavRow item={{ label: 'My dashboard', href: '/dashboard', icon: Home }} isActive={pathname === '/dashboard'} />
          {!inProjectContext && (
            <NavRow item={{ label: 'My tasks', href: '/dashboard/tasks', icon: ListTodo, badge: tasksBadge }} isActive={pathname === '/dashboard/tasks'} />
          )}
          <NavRow
            item={{ label: 'Manage organizations', href: '/dashboard/organizations', icon: Settings2 }}
            isActive={pathname === '/dashboard/organizations'}
          />
        </div>
      </nav>

      {/* Logout */}
      <div className="flex flex-col gap-3 px-3 pb-5 mt-auto">
        <button
          onClick={handleLogout}
          className="nav-item w-full text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
