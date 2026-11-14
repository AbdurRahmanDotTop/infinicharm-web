'use client';

import React from 'react';
import { BackToTop } from '@/components/common/BackToTop';
import { TawkToChat } from '@/components/common/TawkToChat';
import { StickyCartBar } from '@/components/common/StickyCartBar';

/**
 * FloatingControlsDock orchestrates the global bottom viewport controls:
 *   Row 1 (top): BackToTop (bottom-left) & Live Care Chat (bottom-right)
 *   Row 2 (bottom): StickyCartBar (centered pill, only rendered when eligible)
 *
 * By stacking Row 1 above Row 2 in a shared flex-col container with pointer-events-none
 * on wrappers and safe-area padding on the dock, Back to Top and Live Care automatically
 * sit cleanly above the Sticky Cart Bar whenever it is visible (at any height or viewport)
 * and drop cleanly into the bottom corners whenever the Sticky Cart Bar is hidden.
 */
export function FloatingControlsDock() {
  return (
    <div
      data-testid="floating-controls-dock"
      className="fixed inset-x-0 bottom-0 z-30 pointer-events-none px-3 sm:px-6 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex flex-col items-center gap-2.5 sm:gap-3"
    >
      <div className="w-full flex items-end justify-between gap-3 pointer-events-none">
        <div className="shrink-0">
          <BackToTop docked />
        </div>
        <div className="shrink-0 ml-auto">
          <TawkToChat docked />
        </div>
      </div>

      <StickyCartBar docked />
    </div>
  );
}

export default FloatingControlsDock;

