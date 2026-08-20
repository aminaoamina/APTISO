'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div
      className={cn('glass text-center', className)}
      style={{ border: '2px dashed rgba(var(--glass-border), 0.15)', padding: '48px 24px' }}
    >
      <Icon
        className="h-16 w-16 mx-auto mb-4"
        style={{ color: 'var(--brand-orange)', opacity: 0.4 }}
      />
      <h3 className="font-display text-xl font-semibold mb-2">{title}</h3>
      <p className="max-w-md mx-auto mb-6 text-[14px]" style={{ color: 'var(--muted-foreground)' }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button className="btn-accent" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
