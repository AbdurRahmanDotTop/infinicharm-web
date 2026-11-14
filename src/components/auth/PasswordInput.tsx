'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { PublicAuthSettings } from '@/types';
import { validatePasswordAgainstPolicy } from '@/lib/validation/auth';

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
  showStrengthMeter?: boolean;
  policy?: Partial<PublicAuthSettings> | null;
  leadingIcon?: React.ReactNode;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      label,
      error,
      helperText,
      showStrengthMeter = false,
      policy,
      leadingIcon,
      className,
      id,
      value,
      ...props
    },
    ref
  ) => {
    const [visible, setVisible] = useState(false);
    const inputId =
      id || (label ? `pw-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : undefined);

    const strVal = typeof value === 'string' ? value : '';
    const validation = showStrengthMeter
      ? validatePasswordAgainstPolicy(strVal, policy || undefined)
      : null;

    const meterColor =
      validation?.strengthLabel === 'Strong'
        ? 'bg-emerald-600'
        : validation?.strengthLabel === 'Good'
          ? 'bg-emerald-500'
          : validation?.strengthLabel === 'Fair'
            ? 'bg-amber-500'
            : 'bg-rose-500';

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

        <div className="relative">
          {leadingIcon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              {leadingIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            type={visible ? 'text' : 'password'}
            value={value}
            className={cn(
              'flex h-11 w-full rounded-md border border-border bg-surface py-2 text-sm text-primary placeholder:text-muted/60 transition-colors duration-150',
              leadingIcon ? 'pl-9 pr-11' : 'px-3.5 pr-11',
              'focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
              'disabled:cursor-not-allowed disabled:bg-surface-dim disabled:text-muted',
              error && 'border-state-error focus-visible:border-state-error focus-visible:ring-state-error',
              className
            )}
            {...props}
          />

          <button
            type="button"
            onClick={() => setVisible((prev) => !prev)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {showStrengthMeter && strVal.length > 0 && validation && (
          <div className="pt-1 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted font-medium">Password strength</span>
              <span
                className={cn(
                  'font-bold',
                  validation.valid ? 'text-emerald-700' : 'text-amber-700'
                )}
              >
                {validation.strengthLabel}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-dim overflow-hidden border border-border/50">
              <div
                className={cn('h-full transition-all duration-200', meterColor)}
                style={{ width: `${Math.max(15, validation.score)}%` }}
              />
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] pt-0.5">
              {validation.checks
                .filter((c) => c.required)
                .map((c) => (
                  <li
                    key={c.key}
                    className={cn(
                      'flex items-center gap-1',
                      c.passed ? 'text-emerald-700' : 'text-muted'
                    )}
                  >
                    {c.passed ? (
                      <Check className="w-3 h-3 shrink-0 text-emerald-600" />
                    ) : (
                      <X className="w-3 h-3 shrink-0 text-muted/70" />
                    )}
                    <span>{c.label}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {helperText && !error && <p className="text-[11px] text-muted">{helperText}</p>}
        {error && <p className="text-[11px] font-medium text-state-error">{error}</p>}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

