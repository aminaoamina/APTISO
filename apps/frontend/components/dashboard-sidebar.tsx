'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  FolderOpen,
  Users,
  Mail,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresOrg?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Organizations', href: '/dashboard/organizations', icon: Building2 },
  { label: 'Projects', href: '/dashboard/organizations/{orgId}/projects', icon: FolderOpen, requiresOrg: true },
  { label: 'Members', href: '/dashboard/organizations/{orgId}/members', icon: Users, requiresOrg: true },
  { label: 'Invitations', href: '/dashboard/organizations/{orgId}/invitations', icon: Mail, requiresOrg: true },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthStore();
  const { currentOrg } = useOrgStore();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const resolvedItems = navItems
    .filter((item) => !item.requiresOrg || currentOrg)
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
      {/* Logo + Brand */}
      <div className="flex items-center gap-3 px-5 pt-7 pb-7">
        <Logo variant="icon" className="h-9 w-auto" />
        <div>
          <div className="font-display text-[15px] font-bold tracking-tight">
            APTISO
          </div>
          {currentOrg && (
            <div className="text-[11px] text-dim truncate max-w-[150px]">
              {currentOrg.name}
            </div>
          )}
        </div>
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
