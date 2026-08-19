'use client';

import * as React from 'react';
import Image from 'next/image';

type LogoVariant = 'icon' | 'vertical' | 'horizontal';

interface LogoAsset {
  color: string;
  white: string;
  alt: string;
  width: number;
  height: number;
}

const ASSETS: Record<LogoVariant, LogoAsset> = {
  icon: {
    color: '/icons/icon.png',
    white: '/icons/icon-white.png',
    alt: 'APTISO icon',
    width: 787,
    height: 572,
  },
  vertical: {
    color: '/logos/logo-vertical-color.png',
    white: '/logos/logo-vertical-white.png',
    alt: 'APTISO',
    width: 818,
    height: 774,
  },
  horizontal: {
    color: '/logos/logo-horizontal-color.png',
    white: '/logos/logo-horizontal-white.png',
    alt: 'APTISO',
    width: 1085,
    height: 168,
  },
};

interface LogoProps {
  variant?: LogoVariant;
  className?: string;
}

export function Logo({ variant = 'icon', className = 'h-8 w-auto' }: LogoProps) {
  const { color, white, alt, width, height } = ASSETS[variant];

  return (
    <span className={`inline-flex ${className}`}>
      <Image
        src={color}
        alt={alt}
        width={width}
        height={height}
        className="h-full w-auto object-contain dark:hidden"
        priority
      />
      <Image
        src={white}
        alt={alt}
        width={width}
        height={height}
        className="hidden h-full w-auto object-contain dark:block"
        priority
      />
    </span>
  );
}
