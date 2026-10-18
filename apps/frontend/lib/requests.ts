import type { ResourceRequest, ResourceRequestKind } from '@/lib/api';

export const REQUEST_KIND_LABELS: Record<ResourceRequestKind, string> = {
  HR: 'Human resources',
  FINANCE: 'Budget',
  TECHNOLOGY: 'Technology',
};

export const REQUEST_STATUS: Record<ResourceRequest['status'], { label: string; className: string }> = {
  PENDING: { label: 'Waiting for decision', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

export const requestsHref = (r: { project_id: string; project: { organization_id: string } }) =>
  `/dashboard/organizations/${r.project.organization_id}/projects/${r.project_id}/requests`;
