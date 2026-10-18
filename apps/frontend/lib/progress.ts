import type { Progress } from '@/lib/api';

/** Labels and colors for step and phase progress, computed by the server from the work done. */
export const PROGRESS_LABELS: Record<Progress, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};

export const PROGRESS_BADGE: Record<Progress, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

export const PROGRESS_DOT: Record<Progress, string> = {
  NOT_STARTED: 'bg-muted-foreground/30',
  IN_PROGRESS: 'bg-blue-500',
  COMPLETED: 'bg-green-500',
};

/** "3 / 8 steps completed" for a phase. */
export const phaseCounts = (steps: { progress: Progress }[]) => ({
  completed: steps.filter((s) => s.progress === 'COMPLETED').length,
  total: steps.length,
});
