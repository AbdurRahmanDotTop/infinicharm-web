import React from 'react';
import { cn } from '@/lib/utils/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rectangular' | 'rounded' | 'circular';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'rounded',
  ...props
}) => {
  const variantClasses = {
    rectangular: 'rounded-none',
    rounded: 'rounded-md',
    circular: 'rounded-full',
  };

  return (
    <div
      className={cn(
        'animate-pulse bg-surface-dim border border-border/40',
        variantClasses[variant],
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
};

