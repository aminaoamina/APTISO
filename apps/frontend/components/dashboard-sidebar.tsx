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
  AlertTriangle,
  ClipboardList,
  BarChart3,
  ListTodo,
  Settings2,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import { useProjectStore } from '@/store/project-store';
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
    </Link>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthStore();
  const { organizations, currentOrg, loadOrganizations, selectOrg } = useOrgStore();
  const { currentProject, selectProject } = useProjectStore();

  const orgMatch = pathname.match(/^\/dashboard\/organizations\/([^/]+)(?:\/|$)/);
  const projectMatch = pathname.match(
    /^\/dashboard\/organizations\/[^/]+\/projects\/([^/]+)(?:\/|$)/,
  );
  const orgId = orgMatch?.[1];
  const projectId = projectMatch?.[1];
  const inProjectContext = Boolean(projectId);

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
              <div className="nav-item" aria-current="location">
                <FolderOpen className="h-[18px] w-[18px] shrink-0 text-[var(--brand-orange)]" />
                <span className="truncate">{currentProject?.name || 'Loading project…'}</span>
              </div>
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
              <NavRow item={{ label: 'Controls', icon: ListChecks, soon: true }} />
              <NavRow item={{ label: 'Evidence', icon: Files, soon: true }} />
              <NavRow item={{ label: 'Gaps', icon: AlertTriangle, soon: true }} />
            </div>

            <NavSectionTitle>Audit</NavSectionTitle>
            <div className="flex flex-col gap-1 px-3">
              <NavRow item={{ label: 'Audits', icon: ClipboardList, soon: true }} />
              <NavRow item={{ label: 'Reports', icon: BarChart3, soon: true }} />
            </div>

            <NavSectionTitle>Team</NavSectionTitle>
            <div className="flex flex-col gap-1 px-3">
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
              </div>
            </>
          )
        )}

        {/* Personal section - always visible */}
        <NavSectionTitle>Personal</NavSectionTitle>
        <div className="flex flex-col gap-1 px-3">
          <NavRow item={{ label: 'My dashboard', href: '/dashboard', icon: Home }} isActive={pathname === '/dashboard'} />
          <NavRow item={{ label: 'My tasks', icon: ListTodo, soon: true }} />
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
