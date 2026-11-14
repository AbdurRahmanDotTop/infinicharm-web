'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/context/CartContext';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import { Container } from '@/components/ui/Container';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  Truck,
  ShieldCheck,
  Tag,
  Check,
  ArrowLeft,
} from 'lucide-react';

export default function CartPage() {
  const {
    items,
    removeItem,
    updateQuantity,
    subtotalInPaise,
    discountInPaise,
    shippingInPaise,
    totalInPaise,
    appliedCoupon,
    isApplyingCoupon,
    couponInvalidationMessage,
    applyCoupon,
    removeCoupon,
    freeShippingThresholdPaise,
    amountNeededForFreeShippingPaise,
  } = useCart();

  const [couponInput, setCouponInput] = useState('');
  const [couponFeedback, setCouponFeedback] = useState<{ message: string; success: boolean } | null>(null);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim() || isApplyingCoupon) return;
    const res = await applyCoupon(couponInput.trim());
    setCouponFeedback({ message: res.message, success: res.success });
    if (res.success) {
      setCouponInput('');
    }
  };

  const freeShippingPercent = Math.min(
    100,
    Math.round((subtotalInPaise / freeShippingThresholdPaise) * 100)
  );

  if (items.length === 0) {
    return (
      <div className="py-20 bg-surface-dim/30 min-h-[60vh] flex items-center justify-center">
        <Container className="max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-surface-dim border border-border flex items-center justify-center text-muted mx-auto mb-4">
            <ShoppingBag className="w-10 h-10" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary">
            Your Shopping Bag is Empty
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-2 mb-6">
            Explore 100% Kashmiri Honey, Zamzam Water, Takmeeli Talbeena, and Premium Dates.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl uppercase tracking-wider transition-colors shadow-md"
          >
            <span>Explore Pantry Essentials</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Container>
      </div>
    );
  }

  return (
    <div className="py-10 bg-surface-dim/40 min-h-screen">
      <Container>
        {/* Breadcrumb / Back */}
        <Link
          href="/shop"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Continue Shopping</span>
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary tracking-tight">
              Shopping Bag
            </h1>
            <p className="text-xs text-muted mt-1">
              {items.reduce((s, i) => s + i.quantity, 0)} items in your cart
            </p>
          </div>
        </div>

        {/* Free Shipping Meter */}
        <div className="bg-surface rounded-2xl border border-border p-4 mb-8 text-xs shadow-sm">
          <div className="flex items-center justify-between mb-2 font-medium">
            <span className="flex items-center gap-2 text-primary">
              <Truck className="w-4 h-4 text-accent" />
              {amountNeededForFreeShippingPaise === 0 ? (
                <span className="text-emerald-700 font-bold">
                  🎉 Congratulations! You have unlocked FREE Standard Delivery!
                </span>
              ) : (
                <span>
                  Add <strong className="text-accent">{formatPaiseToRupees(amountNeededForFreeShippingPaise)}</strong> more to qualify for FREE Delivery
                </span>
              )}
            </span>
            <span className="text-muted font-bold">{freeShippingPercent}%</span>
          </div>
          <div className="w-full h-2 bg-surface-dim rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                amountNeededForFreeShippingPaise === 0 ? 'bg-emerald-600' : 'bg-accent'
              }`}
              style={{ width: `${freeShippingPercent}%` }}
            />
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 8 Cols: Item Table */}
          <div className="lg:col-span-8 min-w-0 bg-surface rounded-3xl border border-border p-4 sm:p-8 shadow-sm divide-y divide-border/80">
            {items.map((item) => (
              <div key={item.variantId} className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between min-w-0">
                <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto flex-1 min-w-0">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 rounded-2xl bg-surface-dim border border-border overflow-hidden shrink-0">
                    {item.product.media?.[0]?.externalUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.product.media[0].externalUrl}
                        alt={item.product.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted">
                        <ShoppingBag className="w-8 h-8" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="space-y-1 flex-1 min-w-0">
                    <h3 className="font-display text-sm sm:text-base font-bold text-primary truncate hover:text-accent">
                      <Link href={`/product/${item.product.slug}`}>{item.product.title}</Link>
                    </h3>
                    <p className="text-xs text-muted truncate">{item.variant.title}</p>
                    <p className="text-xs font-semibold text-primary">
                      {formatPaiseToRupees(item.variant.priceInPaise)} each
                    </p>
                  </div>
                </div>

                {/* Stepper & Total */}
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-0 border-border/60 shrink-0">
                  <div className="inline-flex items-center border border-border rounded-xl bg-surface-dim p-1">
                    <button
                      onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                      className="p-1.5 text-primary hover:bg-border/60 rounded-lg transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-primary">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                      className="p-1.5 text-primary hover:bg-border/60 rounded-lg transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right min-w-[5rem]">
                    <span className="font-display text-sm sm:text-base font-bold text-primary">
                      {formatPaiseToRupees(item.variant.priceInPaise * item.quantity)}
                    </span>
                  </div>

                  <button
                    onClick={() => removeItem(item.variantId)}
                    className="p-2 text-muted hover:text-rose-600 rounded-lg transition-colors"
                    title="Remove item"
                    aria-label={`Remove ${item.product.title}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Right 4 Cols: Order Summary & Checkout */}
          <div className="lg:col-span-4 bg-surface rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-5">
            <h2 className="font-display text-lg font-bold text-primary pb-3 border-b border-border">
              Order Summary
            </h2>

            {/* Coupon Section */}
            <div>
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 text-xs text-emerald-800">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>
                      Coupon <strong>{appliedCoupon.code}</strong> applied
                    </span>
                  </div>
                  <button
                    onClick={removeCoupon}
                    className="text-xs font-bold text-rose-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="Enter coupon code"
                      className="flex-1 text-xs px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl uppercase tracking-wider focus:outline-none focus:border-accent"
                    />
                    <button
                      type="submit"
                      disabled={isApplyingCoupon}
                      className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-60"
                    >
                      {isApplyingCoupon ? 'Checking...' : 'Apply'}
                    </button>
                  </div>
                  {(couponFeedback || couponInvalidationMessage) && (
                    <p
                      className={`text-[11px] ${
                        couponInvalidationMessage
                          ? 'text-rose-600'
                          : couponFeedback?.success
                            ? 'text-emerald-700'
                            : 'text-rose-600'
                      }`}
                    >
                      {couponInvalidationMessage || couponFeedback?.message}
                    </p>
                  )}
                </form>
              )}
            </div>

            {/* Price Calculations */}
            <div className="space-y-2 text-xs text-muted pt-3 border-t border-border">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-primary">{formatPaiseToRupees(subtotalInPaise)}</span>
              </div>

              {discountInPaise > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Promotional Discount</span>
                  <span>-{formatPaiseToRupees(discountInPaise)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Standard Delivery</span>
                <span className="font-semibold text-primary">
                  {shippingInPaise === 0 ? (
                    <span className="text-emerald-700 font-bold">FREE</span>
                  ) : (
                    formatPaiseToRupees(shippingInPaise)
                  )}
                </span>
              </div>

              <div className="flex justify-between border-t border-border pt-3 text-sm font-bold text-primary">
                <span>Grand Total</span>
                <span className="text-lg text-accent font-extrabold">
                  {formatPaiseToRupees(totalInPaise)}
                </span>
              </div>
            </div>

            {/* CTAs */}
            <div className="pt-2">
              <Link
                href="/checkout"
                className="w-full flex items-center justify-center gap-2 py-4 bg-accent hover:bg-accent-hover text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xl shadow-lg transition-colors"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Security Guarantee */}
            <div className="pt-3 border-t border-border flex items-center justify-center gap-2 text-[11px] text-muted">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span>Direct dispatch from East Champaran, Bihar</span>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
