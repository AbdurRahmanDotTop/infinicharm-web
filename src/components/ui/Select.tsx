import React from 'react';
import { cn } from '@/lib/utils/cn';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label?: string;
  helperText?: string;
  options?: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, label, helperText, id, options, children, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-medium text-primary tracking-wide"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              'flex h-11 w-full appearance-none rounded-md border border-border bg-surface px-3.5 pr-10 py-2 text-sm text-primary transition-colors duration-150',
              'focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
              'disabled:cursor-not-allowed disabled:bg-surface-dim disabled:text-muted',
              error && 'border-state-error focus-visible:border-state-error focus-visible:ring-state-error',
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
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

Select.displayName = 'Select';

