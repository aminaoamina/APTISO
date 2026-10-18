'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { AppNotification, organizationsApi } from '@/lib/api';
import { playPopupSound } from '@/lib/notification-sounds';
import { notificationContext, notificationHref, notificationMessage, timeAgo } from '@/lib/notifications';
import { useInboxStore } from '@/store/inbox-store';
import { useOrgStore } from '@/store/org-store';
import { getErrorMessage } from '@/lib/utils';

export function NotificationBell() {
  const router = useRouter();
  const { notifications, unreadCount, markRead, refresh } = useInboxStore();
  const loadOrganizations = useOrgStore((s) => s.loadOrganizations);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside the panel.
  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [isOpen]);

  const open = (n: AppNotification) => {
    if (!n.read_at) void markRead([n.id]);
    const target = notificationHref(n);
    if (target) {
      setIsOpen(false);
      router.push(target);
    }
  };

  const respond = async (requestId: string, accept: boolean) => {
    try {
      await organizationsApi.respondToJoinRequest(requestId, accept);
      playPopupSound();
      toast.success(accept ? 'You joined the organization' : 'Invitation declined');
      await Promise.all([refresh(), loadOrganizations()]);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to answer the invitation'));
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        className="theme-toggle relative"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        onClick={() => setIsOpen((v) => !v)}
      >
        <Bell className="h-[19px] w-[19px]" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold leading-[18px] text-white text-center"
            style={{ background: 'var(--danger)' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-96 max-h-[70vh] overflow-y-auto rounded-lg border bg-background p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Notifications</h2>
            {unreadCount > 0 && (
              <button className="text-xs text-primary hover:underline" onClick={() => void markRead()}>
                Mark all as read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No notifications</p>
          ) : (
            notifications.map((n) => {
              const request = n.join_request;
              const clickable = !!notificationHref(n);
              return (
                <div
                  key={n.id}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={() => open(n)}
                  onKeyDown={(e) => e.key === 'Enter' && open(n)}
                  className={`flex gap-2 border-b py-3 last:border-0 ${clickable ? 'cursor-pointer hover:bg-accent/40' : ''} rounded-sm px-1`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? 'bg-transparent' : 'bg-primary'}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{notificationMessage(n)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {notificationContext(n)} · {timeAgo(n.created_at)}
                    </p>
                    {request?.status === 'PENDING' && (
                      <div className="mt-2 flex gap-3">
                        <button className="flex items-center gap-1 text-sm text-primary" onClick={(e) => { e.stopPropagation(); void respond(request.id, true); }}>
                          <Check className="h-3.5 w-3.5" /> Accept
                        </button>
                        <button className="flex items-center gap-1 text-sm text-destructive" onClick={(e) => { e.stopPropagation(); void respond(request.id, false); }}>
                          <X className="h-3.5 w-3.5" /> Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
