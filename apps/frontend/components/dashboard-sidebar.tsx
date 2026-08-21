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
  ShieldCheck,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresOrg?: boolean;
  requiresOrgAdmin?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Personal dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Organization dashboard', href: '/dashboard/organizations/{orgId}', icon: Building2, requiresOrg: true },
  { label: 'Projects', href: '/dashboard/organizations/{orgId}/projects', icon: FolderOpen, requiresOrg: true },
  { label: 'Members', href: '/dashboard/organizations/{orgId}/members', icon: Users, requiresOrg: true },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuthStore();
  const { organizations, currentOrg, loadOrganizations, selectOrg } = useOrgStore();
  const currentRole = currentOrg?.members?.find((member) => member.user_id === user?.id)?.role;
  const isOrgAdmin = currentRole === 'ORG_OWNER' || currentRole === 'ORG_ADMIN';

  React.useEffect(() => {
    if (organizations.length === 0) {
      loadOrganizations();
    }
  }, [organizations.length, loadOrganizations]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const resolvedItems = navItems
    .filter((item) => (!item.requiresOrg || currentOrg) && (!item.requiresOrgAdmin || isOrgAdmin))
    .map((item) => ({
      ...item,
      href: item.href.replace('{orgId}', currentOrg?.id || ''),
    }));

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
      <div className="px-4 pt-7 pb-6">
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
            {organizations.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={() => router.push('/dashboard/organizations')}>
              <Building2 className="h-4 w-4" />
              Manage organizations
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-3">
        {resolvedItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('nav-item', isActive && 'active')}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section: Audit CTA + Logout */}
      <div className="flex flex-col gap-3 px-3 pb-5 mt-auto">
        {/* Audit reminder card */}
        <div className="glass glass-hover p-4 text-center" style={{ borderRadius: 16 }}>
          <div className="font-display text-[13.5px] font-semibold mb-1">
            Audit due in 12 days
          </div>
          <div className="text-[11.5px] text-dim mb-3">
            Finish evidence collection to stay on track
          </div>
          <button className="btn-accent w-full justify-center text-[13px]">
            <ShieldCheck className="h-4 w-4" />
            Review checklist
          </button>
        </div>

        {/* Logout */}
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
