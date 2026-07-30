import { cn } from '@/lib/utils';
import React from 'react';

export function Made4UFoodsLogo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="Made4U Foods Logo"
      className={cn('h-16 w-auto object-contain', className)}
    />
  );
}
