import React from 'react';
import { cn } from '@/lib/utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  level?: 1 | 2;
  interactive?: boolean;
}

export function Card({
  className,
  level = 1,
  interactive = false,
  children,
  ...props
}: CardProps) {
  const shadowClass = level === 1 ? 'shadow-level-1' : 'shadow-level-2';
  const interactiveClass = interactive
    ? 'transition-all duration-200 ease-out hover:border-border-hover hover:shadow-level-2 cursor-pointer'
    : '';

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface text-primary',
        shadowClass,
        interactiveClass,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

