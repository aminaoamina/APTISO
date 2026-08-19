'use client';

import * as React from 'react';
import { Sparkles } from 'lucide-react';
import { Logo } from '@/components/logo';
import { PulseSlow, Rotate, Bounce } from '@/components/animations';

interface AnimatedBackgroundProps {
  children: React.ReactNode;
}

export function AnimatedBackground({ children }: AnimatedBackgroundProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, var(--background) 0%, color-mix(in srgb, var(--muted) 30%, transparent) 50%, color-mix(in srgb, var(--accent) 20%, transparent) 100%)`,
      }}
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <PulseSlow>
          <div
            className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full blur-3xl opacity-30"
            style={{
              background: `radial-gradient(circle, var(--primary), transparent)`,
            }}
          />
        </PulseSlow>
        <PulseSlow delay={0.2}>
          <div
            className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
            style={{
              background: `radial-gradient(circle, var(--secondary-blue), transparent)`,
            }}
          />
        </PulseSlow>
        <Rotate>
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-15"
            style={{
              background: `linear-gradient(45deg, var(--primary), var(--accent), var(--secondary-blue))`,
            }}
          />
        </Rotate>

        {/* Floating icons */}
        <Bounce delay={0}>
          <Sparkles
            className="absolute top-20 left-20 h-8 w-8 opacity-40"
            style={{ color: 'var(--primary)' }}
          />
        </Bounce>
        <Bounce delay={0.2}>
          <Sparkles
            className="absolute bottom-32 right-32 h-6 w-6 opacity-30"
            style={{ color: 'var(--secondary-blue)' }}
          />
        </Bounce>
        <PulseSlow delay={0}>
          <div className="absolute top-1/3 right-20">
            <Logo variant="icon" className="h-8 w-auto opacity-30" />
          </div>
        </PulseSlow>
      </div>

      {children}
    </div>
  );
}
