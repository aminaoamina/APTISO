'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { AppNotification, organizationsApi } from '@/lib/api';
import { TASK_TYPE_LABELS, taskHref, taskSubject, fullName, formatDay } from '@/lib/tasks';
import { playPopupSound } from '@/lib/notification-sounds';
import { REQUEST_KIND_LABELS, requestsHref } from '@/lib/requests';
import { useInboxStore } from '@/store/inbox-store';
import { useOrgStore } from '@/store/org-store';
import { getErrorMessage } from '@/lib/utils';

/** The sentence shown for each notification type. */
function message(n: AppNotification) {
  const actor = fullName(n.actor) || 'Someone';
  const task = n.task_assignment;
  const what = task ? `${TASK_TYPE_LABELS[task.type]}: ${taskSubject(task)}` : '';
  const request = n.resource_request;
  const asked = request ? `${REQUEST_KIND_LABELS[request.kind].toLowerCase()} for "${request.step.title}"` : '';
  switch (n.type) {
    case 'ORGANIZATION_JOIN_REQUEST':
      return `${actor} invited you to join ${n.organization?.name ?? 'an organization'}.`;
    case 'TASK_ASSIGNED':
      return `${actor} assigned you a task. ${what}${task?.deadline ? ` (due ${formatDay(task.deadline)})` : ''}`;
    case 'TASK_COMPLETED':
      return `${actor} completed ${what}.`;
    case 'TASK_DUE_SOON':
      return `Due ${task?.deadline ? formatDay(task.deadline) : 'soon'}: ${what}.`;
    case 'TASK_CANCELLED':
      return `${actor} removed this task from your list: ${what}.`;
    case 'REQUEST_RECEIVED':
      return `${actor} requests ${asked}. Approve or reject it.`;
    case 'REQUEST_DECIDED':
      return `${actor} ${request?.status === 'APPROVED' ? 'approved' : 'rejected'} your request for ${asked}${request?.decision_comment ? `: ${request.decision_comment}` : '.'}`;
  }
}

/** Where a notification leads; null when there is nothing to open. */
function href(n: AppNotification) {
  if (n.task_assignment && n.type !== 'TASK_CANCELLED') return taskHref(n.task_assignment);
  const request = n.resource_request;
  if (request && n.type === 'REQUEST_RECEIVED') return requestsHref(request);
  if (request) return `/dashboard/organizations/${request.project.organization_id}/projects/${request.project_id}/steps/${request.step_id}`;
  return null;
}

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return formatDay(iso);
}

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
    const target = href(n);
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
              const clickable = !!href(n);
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
                    <p className="text-sm">{message(n)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {n.task_assignment?.project.name ?? n.resource_request?.project.name ?? n.organization?.name} · {timeAgo(n.created_at)}
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
