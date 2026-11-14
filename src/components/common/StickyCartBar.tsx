'use client';

// ==============================================================================
// InfiniCharm — Global Sticky Cart Bar
// Design Reference: All_Docs/Designs/InfiniCharm Product Search Results - organic honey (code.html line 1149)
// Behaviour:
//   - Displays dynamically whenever items exist in the cart (totalItemsCount > 0).
//   - Synchronized live with CartContext (item count, formatted subtotal).
//   - Excluded on /cart, /checkout, /admin/*, /login, /register, and order confirmation.
//   - Zero overlap: Centered with high elevation, leaving clearance for BackToTop (left) and LiveCare (right).
// ==============================================================================

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/lib/context/CartContext';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import { ArrowRight, ShoppingBag } from 'lucide-react';

export function StickyCartBar({ docked = false }: { docked?: boolean } = {}) {
  const pathname = usePathname();
  const { totalItemsCount, subtotalInPaise, openDrawer } = useCart();

  // Excluded routes where sticky cart bar is irrelevant or interferes with actions
  if (!pathname) return null;
  if (
    pathname.startsWith('/admin') ||
    pathname === '/cart' ||
    pathname === '/checkout' ||
    pathname.startsWith('/checkout/') ||
    pathname === '/pay' ||
    pathname.startsWith('/pay/') ||
    pathname === '/login' ||
    pathname === '/register'
  ) {
    return null;
  }

  // Only render if cart contains items
  if (totalItemsCount <= 0) {
    return null;
  }

  const wrapperClass = docked
    ? 'pointer-events-auto max-w-full transition-all duration-300 animate-in fade-in slide-in-from-bottom-4'
    : 'fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-30 pointer-events-auto max-w-[calc(100vw-1rem)] sm:max-w-none transition-all duration-300 animate-in fade-in slide-in-from-bottom-4';

  return (
    <aside
      data-testid="sticky-cart-bar"
      aria-label="Sticky shopping bag status"
      className={wrapperClass}
    >
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-x-2 gap-y-1.5 sm:gap-4 bg-primary text-white pl-3 sm:pl-5 pr-2 py-1.5 sm:py-2 rounded-2xl sm:rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.24)] border border-white/10 backdrop-blur-md">
        {/* Pulsing Dot & Live Cart Info */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 text-[11px] sm:text-sm font-medium">
          <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-accent" />
          </span>

          <span className="text-white/85 whitespace-nowrap">
            <strong className="font-bold text-white font-mono">{totalItemsCount}</strong>{' '}
            {totalItemsCount === 1 ? 'Item' : 'Items'}
          </span>

          <span className="text-white/30">•</span>

          <span className="font-mono text-[11px] sm:text-sm font-bold text-white whitespace-nowrap">
            {formatPaiseToRupees(subtotalInPaise)}
          </span>
        </div>

        {/* View Cart Drawer Trigger — Visible Across Mobile & Desktop */}
        <button
          type="button"
          onClick={openDrawer}
          className="inline-flex items-center gap-1 text-[11px] sm:text-xs text-white/85 hover:text-white font-medium px-2 py-1 rounded-full hover:bg-white/10 transition-colors whitespace-nowrap"
        >
          <ShoppingBag className="w-3.5 h-3.5 text-accent shrink-0" />
          <span>View Bag</span>
        </button>

        {/* Instant Checkout CTA Button */}
        <Link
          href="/checkout"
          className="flex items-center gap-1 sm:gap-1.5 bg-accent hover:bg-accent-hover text-white px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-bold transition-all shadow-xs whitespace-nowrap"
        >
          <span>Instant Checkout</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </aside>
  );
}

export default StickyCartBar;

