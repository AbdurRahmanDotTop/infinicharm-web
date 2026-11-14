'use client';

// ==============================================================================
// InfiniCharm — Global Reusable Back To Top Component
// Standard: DRY Architecture, Smooth Scroll, Responsive Bottom Clearance
// ==============================================================================

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowUp } from 'lucide-react';
import { useCart } from '@/lib/context/CartContext';

export function BackToTop({ docked = false }: { docked?: boolean } = {}) {
  const [isVisible, setIsVisible] = useState(false);
  const { totalItemsCount } = useCart();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const releaseFocusIfInside = useCallback(() => {
    const wrapper = wrapperRef.current;
    const active = document.activeElement;
    if (wrapper && active instanceof HTMLElement && wrapper.contains(active)) {
      active.blur();
      const mainTarget =
        (document.getElementById('main-content') as HTMLElement | null) ||
        (document.querySelector('main') as HTMLElement | null);
      if (mainTarget) {
        if (!mainTarget.hasAttribute('tabindex')) {
          mainTarget.setAttribute('tabindex', '-1');
        }
        mainTarget.focus({ preventScroll: true });
      }
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      // Show button after scrolling down 200px
      if (window.scrollY > 200) {
        setIsVisible(true);
      } else {
        // Move focus synchronously out of the wrapper before aria-hidden/inert toggles
        releaseFocusIfInside();
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Check initial position
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [releaseFocusIfInside]);

  const scrollToTop = () => {
    // Release focus before scrolling above the visibility threshold
    releaseFocusIfInside();
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  // When standalone (not inside FloatingControlsDock), clear mobile + desktop safe-area and sticky bar
  const bottomPositionClass =
    totalItemsCount > 0
      ? 'bottom-[calc(7.5rem+env(safe-area-inset-bottom))] sm:bottom-[calc(5.25rem+env(safe-area-inset-bottom))]'
      : 'bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]';

  const containerClass = docked
    ? `transition-all duration-300 ${
        isVisible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-3 pointer-events-none'
      }`
    : `fixed ${bottomPositionClass} left-4 sm:left-6 z-30 transition-all duration-300 ${
        isVisible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-3 pointer-events-none'
      }`;

  return (
    <div
      ref={wrapperRef}
      data-testid="back-to-top-wrapper"
      aria-hidden={!isVisible}
      inert={!isVisible ? true : undefined}
      className={containerClass}
    >
      <button
        type="button"
        data-testid="back-to-top-btn"
        onClick={scrollToTop}
        tabIndex={isVisible ? 0 : -1}
        className="group flex items-center gap-1.5 h-10 sm:h-11 px-3.5 rounded-full bg-surface text-primary shadow-level-2 hover:bg-surface-dim hover:shadow-level-3 border border-border transition-all text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent"
        aria-label="Back to top"
      >
        <ArrowUp className="w-4 h-4 text-accent group-hover:-translate-y-0.5 transition-transform" />
        <span className="text-[11px] sm:text-xs">Top</span>
      </button>
    </div>
  );
}

export default BackToTop;

