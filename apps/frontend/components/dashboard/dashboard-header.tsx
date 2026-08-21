'use client';

import { Search, Bell, Check, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import { organizationsApi, OrganizationNotification } from '@/lib/api';
import { toast } from 'sonner';
import { playNotificationSound, playPopupSound } from '@/lib/notification-sounds';

export function DashboardHeader() {
  const { user } = useAuthStore();
  const loadOrganizations = useOrgStore((state) => state.loadOrganizations);
  const [notifications, setNotifications] = useState<OrganizationNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const previousPendingCount = useRef<number | null>(null);

  const loadNotifications = async () => {
    try {
      const nextNotifications = await organizationsApi.notifications();
      const pendingCount = nextNotifications.filter(
        (notification) => notification.join_request?.status === 'PENDING',
      ).length;
      if (
        previousPendingCount.current !== null &&
        pendingCount > previousPendingCount.current
      ) {
        playNotificationSound();
      }
      previousPendingCount.current = pendingCount;
      setNotifications(nextNotifications);
    } catch {
      setNotifications([]);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 15000);
    const handleFocus = () => loadNotifications();
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.id]);

  const respond = async (requestId: string, accept: boolean) => {
    try {
      await organizationsApi.respondToJoinRequest(requestId, accept);
      playPopupSound();
      toast.success(accept ? 'You joined the organization' : 'Join request rejected');
      await Promise.all([loadNotifications(), loadOrganizations()]);
    } catch {
      playPopupSound();
      toast.error('Unable to respond to the join request');
    }
  };

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
        <div className="relative">
        <button className="theme-toggle relative" aria-label="Notifications" onClick={() => setIsOpen((open) => !open)}>
          <Bell className="h-[19px] w-[19px]" />
          {notifications.some((notification) => notification.join_request?.status === 'PENDING') && (
            <span className="absolute top-2.5 right-2.5 w-[7px] h-[7px] rounded-full" style={{ background: 'var(--danger)' }} />
          )}
        </button>
        {isOpen && (
          <div className="absolute right-0 top-12 z-50 w-80 rounded-lg border bg-background p-3 shadow-lg">
            <h2 className="mb-2 text-sm font-semibold">Notifications</h2>
            {notifications.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No notifications</p>
            ) : notifications.map((notification) => {
              const request = notification.join_request;
              return (
                <div key={notification.id} className="border-b py-3 last:border-0">
                  <p className="text-sm">You were invited to join <strong>{notification.organization?.name}</strong>.</p>
                  {request?.status === 'PENDING' && (
                    <div className="mt-2 flex gap-2">
                      <button className="flex items-center gap-1 text-sm text-primary" onClick={() => respond(request.id, true)}><Check className="h-3.5 w-3.5" /> Accept</button>
                      <button className="flex items-center gap-1 text-sm text-destructive" onClick={() => respond(request.id, false)}><X className="h-3.5 w-3.5" /> Reject</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>

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
