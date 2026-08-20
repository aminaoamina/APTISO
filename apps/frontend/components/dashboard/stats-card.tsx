'use client';

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  className?: string;
  iconBg?: string;
  iconColor?: string;
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  iconBg = 'rgba(255, 145, 0, 0.15)',
  iconColor = 'var(--brand-orange)',
}: StatsCardProps) {
  return (
    <div className={cn('glass glass-hover p-5', className)}>
      <div className="stat-icon" style={{ background: iconBg }}>
        <Icon className="h-[18px] w-[18px]" style={{ color: iconColor }} />
      </div>
      <div className="font-mono-numeric text-[26px] font-semibold tracking-tight">
        {value}
      </div>
      <div className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
        {title}
      </div>
      {description && (
        <div className="text-[12px] mt-1" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>
          {description}
        </div>
      )}
      {trend && (
        <div className="mt-3 flex items-center gap-2">
          <span
            className="badge-glass"
            style={{
              background: trend.isPositive ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 113, 133, 0.15)',
              color: trend.isPositive ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
          <span className="text-[12px]" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>
            {trend.label}
          </span>
        </div>
      )}
    </div>
  );
}
