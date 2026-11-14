import React from 'react';
import { cn } from '@/lib/utils/cn';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  pill?: boolean;
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      pill = false,
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none';

    const variants = {
      // Primary: Deep Charcoal
      primary:
        'bg-primary text-white hover:bg-primary-hover focus-visible:outline-primary active:scale-[0.99]',
      // Accent: Radiant Coral (conversion priority: "Add to Bag", primary CTAs)
      accent:
        'bg-accent text-white hover:bg-accent-hover focus-visible:outline-accent active:scale-[0.99]',
      // Secondary: Crisp Surface with subtle contrast
      secondary:
        'bg-surface-dim text-primary hover:bg-surface-container focus-visible:outline-primary',
      // Outline: Hairline border
      outline:
        'bg-surface text-primary border border-border hover:border-border-hover hover:bg-surface-dim focus-visible:outline-primary',
      // Ghost: Transparent with hover wash
      ghost:
        'bg-transparent text-primary hover:bg-surface-dim focus-visible:outline-primary',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-11 px-5 text-sm gap-2',
      lg: 'h-13 px-7 text-base gap-2.5',
    };

    const radii = pill ? 'rounded-full' : 'rounded-md';

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], radii, className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

