import type { DocumentInstance } from '@/lib/api';

/** How a document moves to the library: draft → (approval) → published. */
export const DOC_STATUS: Record<DocumentInstance['status'], { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  IN_REVIEW: { label: 'Waiting for approval', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  PUBLISHED: { label: 'In the library', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
};
