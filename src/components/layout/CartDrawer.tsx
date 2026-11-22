'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/context/CartContext';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import { X, ShoppingBag, Plus, Minus, Trash2, ArrowRight, Tag, Check, Truck } from 'lucide-react';
import { ProductRecommendations } from '@/components/shop/ProductRecommendations';

export function CartDrawer() {
  const {
    items,
    isDrawerOpen,
    closeDrawer,
    removeItem,
    updateQuantity,
    subtotalInPaise,
    discountInPaise,
    shippingInPaise,
    totalInPaise,
    totalItemsCount,
    appliedCoupon,
    isApplyingCoupon,
    couponInvalidationMessage,
    applyCoupon,
    removeCoupon,
    freeShippingThresholdPaise,
    amountNeededForFreeShippingPaise,
  } = useCart();

  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponFeedback, setCouponFeedback] = useState<{ message: string; success: boolean } | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isDrawerOpen) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDrawer();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (previousFocusRef.current && document.body.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus({ preventScroll: true });
      }
    };
  }, [isDrawerOpen, closeDrawer]);

  if (!isDrawerOpen) return null;

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCodeInput.trim() || isApplyingCoupon) return;
    const res = await applyCoupon(couponCodeInput);
    setCouponFeedback({ message: res.message, success: res.success });
    if (res.success) {
      setCouponCodeInput('');
    }
  };

  const freeShippingPercent = Math.min(
    100,
    Math.round((subtotalInPaise / freeShippingThresholdPaise) * 100)
  );

  const totalItemSavingsInPaise = items.reduce((acc, item) => {
    if (
      item.variant.compareAtPriceInPaise &&
      item.variant.compareAtPriceInPaise > item.variant.priceInPaise
    ) {
      return (
        acc +
        (item.variant.compareAtPriceInPaise - item.variant.priceInPaise) * item.quantity
      );
    }
    return acc;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm transition-opacity"
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Shopping Bag"
        className="relative z-10 w-full max-w-md bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-accent" />
            <h2 className="font-display text-lg font-bold text-primary">Your Bag</h2>
            <span className="text-xs bg-surface-dim text-primary px-2 py-0.5 rounded-full font-medium">
              {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <button
            ref={closeButtonRef}
            onClick={closeDrawer}
            className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors"
            aria-label="Close Shopping Bag"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free Shipping Meter */}
        <div className="bg-surface-dim px-5 py-3 border-b border-border text-xs">
          <div className="flex items-center justify-between mb-1.5 font-medium">
            <span className="flex items-center gap-1.5 text-primary">
              <Truck className="w-4 h-4 text-accent" />
              {amountNeededForFreeShippingPaise === 0 ? (
                <span className="text-emerald-700 font-semibold">🎉 You unlocked FREE Standard Delivery!</span>
              ) : (
                <span>
                  Add <strong className="text-accent">{formatPaiseToRupees(amountNeededForFreeShippingPaise)}</strong> more for FREE Delivery
                </span>
              )}
            </span>
            <span className="text-muted">{freeShippingPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                amountNeededForFreeShippingPaise === 0 ? 'bg-emerald-600' : 'bg-accent'
              }`}
              style={{ width: `${freeShippingPercent}%` }}
            />
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 divide-y divide-neutral-100">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mb-4">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="font-serif text-lg font-medium text-neutral-800 mb-1">Your bag is empty</h3>
              <p className="text-xs text-neutral-500 max-w-xs mb-6">
                Discover 100% Kashmiri Honey, Zamzam Water, Takmeeli Talbeena, and Premium Dates.
              </p>
              <button
                onClick={closeDrawer}
                className="inline-flex items-center justify-center px-5 py-2.5 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <Link href="/shop" onClick={closeDrawer}>
                  Explore Pantry Essentials
                </Link>
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.variantId} className="py-4 first:pt-0 last:pb-0 flex gap-3">
                {/* Thumbnail */}
                <div className="w-16 h-16 bg-neutral-100 rounded-lg overflow-hidden flex-shrink-0 border border-neutral-200">
                  {item.product.media?.[0]?.externalUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.product.media[0].externalUrl}
                      alt={item.product.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-300">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-1">
                    <h4 className="text-xs font-semibold text-primary line-clamp-1 hover:text-accent">
                      <Link href={`/product/${item.product.slug}`} onClick={closeDrawer}>
                        {item.product.title}
                      </Link>
                    </h4>
                    <button
                      onClick={() => removeItem(item.variantId)}
                      className="text-neutral-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                      title="Remove item"
                      aria-label={`Remove ${item.product.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-[11px] text-neutral-500 mt-0.5">{item.variant.title}</p>

                  <div className="flex items-center justify-between mt-2">
                    {/* Quantity Stepper */}
                    <div className="inline-flex items-center border border-neutral-200 rounded-md bg-neutral-50">
                      <button
                        onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                        className="p-1 hover:bg-neutral-200 text-neutral-600 rounded-l transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 text-xs font-medium text-neutral-800 min-w-[1.5rem] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                        className="p-1 hover:bg-neutral-200 text-neutral-600 rounded-r transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-neutral-900 block font-mono">
                        {formatPaiseToRupees(item.variant.priceInPaise * item.quantity)}
                      </span>
                      {item.variant.compareAtPriceInPaise &&
                        item.variant.compareAtPriceInPaise > item.variant.priceInPaise && (
                          <span className="text-[10px] text-muted line-through block font-mono">
                            {formatPaiseToRupees(item.variant.compareAtPriceInPaise * item.quantity)}
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Complementary Recommendations (Adil Qadri & Ajmal Inspired) */}
          {items.length > 0 && (
            <div className="pt-4 mt-2">
              <ProductRecommendations
                title="Limited Time Offers"
                subtitle="Frequently paired with your bag"
                badgeText="Up to 25% OFF"
                limit={3}
                layout="drawer"
              />
            </div>
          )}
        </div>

        {/* Footer with Calculations and Checkout */}
        {items.length > 0 && (
          <div className="border-t border-neutral-200 px-5 py-4 bg-white space-y-3">
            {/* Coupon Application */}
            {appliedCoupon ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>
                    Coupon <strong>{appliedCoupon.code}</strong> applied (-{formatPaiseToRupees(discountInPaise)})
                  </span>
                </div>
                <button
                  onClick={removeCoupon}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={couponCodeInput}
                    onChange={(e) => setCouponCodeInput(e.target.value)}
                    placeholder="Enter coupon code"
                    className="w-full text-xs pl-8 pr-3 py-2 border border-border rounded-lg uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isApplyingCoupon}
                  className="px-3.5 py-2 text-xs font-semibold bg-surface-dim hover:bg-surface-container text-primary rounded-lg transition-colors border border-border disabled:opacity-60"
                >
                  {isApplyingCoupon ? 'Checking...' : 'Apply'}
                </button>
              </form>
            )}

            {(couponFeedback || couponInvalidationMessage) && (
              <p
                className={`text-[11px] ${
                  couponInvalidationMessage
                    ? 'text-state-error'
                    : couponFeedback?.success
                      ? 'text-emerald-700'
                      : 'text-state-error'
                }`}
              >
                {couponInvalidationMessage || couponFeedback?.message}
              </p>
            )}

            {/* Calculations Breakdown */}
            <div className="space-y-1.5 text-xs text-muted pt-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium text-primary">{formatPaiseToRupees(subtotalInPaise)}</span>
              </div>

              {totalItemSavingsInPaise > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Catalogue Savings</span>
                  <span>-{formatPaiseToRupees(totalItemSavingsInPaise)}</span>
                </div>
              )}

              {discountInPaise > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Discount</span>
                  <span>-{formatPaiseToRupees(discountInPaise)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Standard Delivery</span>
                <span className="font-medium text-primary">
                  {shippingInPaise === 0 ? (
                    <span className="text-emerald-700 font-semibold">FREE</span>
                  ) : (
                    formatPaiseToRupees(shippingInPaise)
                  )}
                </span>
              </div>

              <div className="flex justify-between border-t border-border pt-2 text-sm font-bold text-primary">
                <span>Total Amount</span>
                <span className="text-base text-accent font-mono">{formatPaiseToRupees(totalInPaise)}</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="space-y-2 pt-1">
              <Link
                href="/checkout"
                onClick={closeDrawer}
                className="w-full flex items-center justify-center gap-2 py-3 bg-accent hover:bg-accent-hover text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs transition-colors"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/cart"
                onClick={closeDrawer}
                className="w-full flex items-center justify-center py-2 bg-surface-dim hover:bg-surface-container text-primary text-xs font-semibold rounded-xl border border-border transition-colors"
              >
                View Full Cart Details
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

