'use client';

import { useAuthStore } from '@/store/auth-store';
import { Plus } from 'lucide-react';

interface WelcomeHeaderProps {
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function WelcomeHeader({ actionLabel, onAction, className }: WelcomeHeaderProps) {
  const { user } = useAuthStore();

  return (
    <div className={className}>
      <h1 className="font-display text-[26px] font-bold mb-1">
        Welcome back, {user?.first_name || 'there'} <span role="img" aria-label="wave">&#128075;</span>
      </h1>
      <p className="text-[14.5px]" style={{ color: 'var(--muted-foreground)' }}>
        Here&apos;s where your ISO 27001 program stands today.
      </p>
      {actionLabel && onAction && (
        <button className="btn-accent mt-4" onClick={onAction}>
          <Plus className="h-4 w-4" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
