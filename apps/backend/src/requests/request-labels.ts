import { ResourceRequestKind } from '@prisma/client';

export const REQUEST_KIND_LABELS: Record<ResourceRequestKind, string> = {
  HR: 'Human resources',
  FINANCE: 'Budget',
  TECHNOLOGY: 'Technology',
};
