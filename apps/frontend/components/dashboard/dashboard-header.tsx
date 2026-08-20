'use client';

import { Search, Bell } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuthStore } from '@/store/auth-store';

export function DashboardHeader() {
  const { user } = useAuthStore();

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName) return '??';
    return ((firstName?.[0] || '') + (lastName?.[0] || '')).toUpperCase();
  };

  return (
    <header className="flex items-center justify-between gap-5 mb-7 fade-up" style={{ animationDelay: '0.05s' }}>
      {/* Search bar */}
      <div className="search-glass">
        <Search
          className="h-4 w-4 shrink-0"
          style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}
        />
        <input placeholder="Search projects, controls, evidence..." />
      </div>

      {/* Right side: theme, notifications, user */}
      <div className="flex items-center gap-3.5">
        <ThemeToggle glass />

        {/* Notifications */}
        <button className="theme-toggle relative" aria-label="Notifications">
          <Bell className="h-[19px] w-[19px]" />
          <span
            className="absolute top-2.5 right-2.5 w-[7px] h-[7px] rounded-full"
            style={{ background: 'var(--danger)' }}
          />
        </button>

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
            <div className="text-[11px] text-dim">
              Member
            </div>
          </div>
        </Link>
      </div>
    </header>
  );
}
