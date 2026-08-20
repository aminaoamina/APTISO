'use client';

import { ShieldCheck } from 'lucide-react';

interface ProgressItem {
  label: string;
  value: number;
  display: string;
}

interface ComplianceProgressProps {
  items: ProgressItem[];
}

export function ComplianceProgress({ items }: ComplianceProgressProps) {
  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="h-5 w-5" style={{ color: 'var(--brand-orange)' }} />
        <span className="font-display text-[15px] font-semibold">Compliance Progress</span>
      </div>
      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <div key={item.label} className="space-y-2">
            <div className="flex items-center justify-between text-[13px]">
              <span>{item.label}</span>
              <span className="font-mono-numeric font-medium">{item.display}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(var(--glass-border), 0.1)' }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${item.value}%`,
                  background: 'linear-gradient(90deg, var(--brand-orange), #FFB347)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
