import React from 'react';
import { cn } from '@/lib/utils/cn';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, helperText, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-primary tracking-wide"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            'flex h-11 w-full rounded-md border border-border bg-surface px-3.5 py-2 text-sm text-primary placeholder:text-muted/60 transition-colors duration-150',
            'focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
            'disabled:cursor-not-allowed disabled:bg-surface-dim disabled:text-muted',
            error && 'border-state-error focus-visible:border-state-error focus-visible:ring-state-error',
            className
          )}
          {...props}
        />
        {helperText && !error && (
          <p className="text-[11px] text-muted">{helperText}</p>
        )}
        {error && (
          <p className="text-[11px] font-medium text-state-error">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

