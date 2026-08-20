'use client';

import { useRouter } from 'next/navigation';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickActionCardProps {
  label: string;
  icon: LucideIcon;
  href: string;
  className?: string;
}

export function QuickActionCard({ label, icon: Icon, href, className }: QuickActionCardProps) {
  const router = useRouter();

  return (
    <div
      className={cn(
        'glass glass-hover p-4 cursor-pointer text-center',
        className
      )}
      onClick={() => router.push(href)}
    >
      <div className="flex flex-col items-center justify-center gap-2">
        <Icon className="h-6 w-6" style={{ color: 'var(--brand-orange)' }} />
        <span className="text-[13px] font-medium">{label}</span>
      </div>
    </div>
  );
}
