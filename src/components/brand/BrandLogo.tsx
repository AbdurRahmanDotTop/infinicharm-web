'use client';

// ==============================================================================
// InfiniCharm — Centralized Brand Logo Component
// Source: All_Docs/Designs/BrandLogo.tsx
// Standards: Strict Theme Adaptation, WCAG AAA Contrast, Proportional Dimensions
// Single-Owner Architecture: Direct Brand Identity (TechilyFly India)
// ==============================================================================

import React from 'react';
import Link from 'next/link';

export interface BrandLogoProps {
  variant?: 'light' | 'dark' | 'auto';
  className?: string;
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg';
  href?: string;
}

export function BrandLogo({
  variant = 'auto',
  className = '',
  showTagline = true,
  size = 'md',
  href = '/',
}: BrandLogoProps) {
  // Determine styling with high-contrast text visibility
  const getContainerClasses = () => {
    switch (variant) {
      case 'dark':
        return 'bg-primary-hover text-white border border-white/20 shadow-xs';
      case 'light':
      case 'auto':
      default:
        return 'bg-surface text-primary border border-border shadow-xs';
    }
  };

  const getHeadingTextClasses = () => {
    switch (variant) {
      case 'dark':
        return 'text-white';
      case 'light':
      case 'auto':
      default:
        return 'text-primary';
    }
  };

  const getCharmClasses = () => {
    switch (variant) {
      case 'dark':
        return 'text-accent';
      case 'light':
      case 'auto':
      default:
        return 'text-accent';
    }
  };

  const getTaglineClasses = () => {
    switch (variant) {
      case 'dark':
        return 'text-white/80';
      case 'light':
      case 'auto':
      default:
        return 'text-muted';
    }
  };

  const sizeStyles = {
    sm: {
      box: 'w-7 h-7 rounded-md',
      svg: 'w-4 h-4',
      heading: 'text-sm sm:text-base',
      tagline: 'text-[8px]',
    },
    md: {
      box: 'w-7 h-7 sm:w-8 sm:h-8 rounded-lg',
      svg: 'w-4 h-4 sm:w-5 sm:h-5',
      heading: 'text-sm sm:text-lg',
      tagline: 'text-[8px] sm:text-[9px]',
    },
    lg: {
      box: 'w-10 h-10 rounded-xl',
      svg: 'w-6 h-6',
      heading: 'text-xl sm:text-2xl',
      tagline: 'text-[10px]',
    },
  }[size];

  const content = (
    <>
      {/* Handcrafted Infinity Logo Icon matching supplied specification */}
      <div
        className={`relative ${sizeStyles.box} flex items-center justify-center shrink-0 group-hover:scale-105 transition-all ${getContainerClasses()}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${sizeStyles.svg} text-accent shrink-0`}
          aria-hidden="true"
        >
          {/* Exact Brand Symbol Infinity Loop Specification */}
          <path d="M12 12c-2-2.5-4-4-6.5-4A4.5 4.5 0 0 0 1 12.5 4.5 4.5 0 0 0 5.5 17c2.5 0 4.5-1.5 6.5-4Z" />
          <path d="M12 12c2 2.5 4 4 6.5 4a4.5 4.5 0 0 0 4.5-4.5A4.5 4.5 0 0 0 17.5 7c-2.5 0-4.5 1.5-6.5 4Z" />
        </svg>
      </div>

      <div className="flex flex-col text-left">
        <span
          className={`font-display font-extrabold ${sizeStyles.heading} tracking-tight leading-none ${getHeadingTextClasses()}`}
        >
          Infini<span className={getCharmClasses()}>Charm</span>
        </span>
        {showTagline && (
          <span
            className={`font-mono ${sizeStyles.tagline} uppercase tracking-wider font-semibold mt-0.5 ${getTaglineClasses()}`}
          >
            TechilyFly India
          </span>
        )}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`inline-flex items-center gap-1.5 sm:gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl p-0.5 sm:p-1 transition-transform ${className}`}
        aria-label="InfiniCharm Home"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 sm:gap-2.5 ${className}`}>
      {content}
    </div>
  );
}

export default BrandLogo;
