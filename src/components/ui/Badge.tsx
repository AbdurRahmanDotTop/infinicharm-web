import React from 'react';
import { cn } from '@/lib/utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'outline';
  size?: 'sm' | 'md';
}

export function Badge({
  className,
  variant = 'default',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    'inline-flex items-center font-medium rounded-sm tracking-wide select-none';

  const variants = {
    default: 'bg-surface-dim text-primary border border-border',
    accent: 'bg-accent/10 text-accent font-semibold',
    success: 'bg-state-success/10 text-state-success',
    warning: 'bg-amber-500/10 text-amber-700',
    outline: 'bg-transparent text-muted border border-border',
  };

  const sizes = {
    sm: 'text-[10px] px-1.5 py-0.5 leading-tight',
    md: 'text-xs px-2.5 py-1 leading-normal',
  };

  return (
    <span
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </span>
  );
}

