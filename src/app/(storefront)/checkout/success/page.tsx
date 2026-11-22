'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import { CheckCircle2, Package, MapPin, Truck, ArrowRight, ShoppingBag, ShieldCheck, Phone, User, Tag } from 'lucide-react';
import { Order } from '@/types';

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id') || 'INF-202611-1001';
  const [order, setOrder] = useState<Order | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      const stored = localStorage.getItem('infinicharm_orders');
      if (stored) {
        const parsed: Order[] = JSON.parse(stored);
        const match = parsed.find(
          (o) => o.orderNumber === orderId || o.id === orderId
        );
        if (match) {
          setOrder(match);
        }
      }
    } catch {
      // ignore localStorage read issues and fall back to server API
    }

    if (orderId) {
      fetch(`/api/orders/${encodeURIComponent(orderId)}?purpose=success`, {
        cache: 'no-store',
        credentials: 'same-origin',
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled && data?.success && data.order) {
            setOrder(data.order);
          }
        })
        .catch(() => {
          // keep fallback shell
        });
    }

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const recipientName = order?.shippingAddress?.fullName || order?.customerName || 'Valued Patron';
  const recipientPhone = order?.shippingAddress?.phone || order?.customerPhone || '';
  const isCustomUpi = order?.paymentMethod === 'CUSTOM_UPI';
  const isCod = order?.paymentMethod === 'COD';
  const isPending = order?.paymentStatus === 'PENDING' || order?.status === 'PENDING';

  return (
    <div className="py-16 sm:py-20 bg-surface-dim/40 min-h-[80vh] flex items-center">
      <Container className="max-w-2xl">
        <div className="bg-surface rounded-3xl border border-border p-6 sm:p-10 shadow-lg text-center space-y-6">
          {/* Celebratory Icon */}
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-inner ${
              isCustomUpi && isPending
                ? 'bg-amber-100 text-amber-700'
                : isCod
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-600'
            }`}
          >
            {isCustomUpi && isPending ? (
              <ShieldCheck className="w-10 h-10" />
            ) : isCod ? (
              <Package className="w-10 h-10" />
            ) : (
              <CheckCircle2 className="w-10 h-10" />
            )}
          </div>

          <div className="space-y-2">
            {isCustomUpi && isPending ? (
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-3.5 py-1.5 rounded-full border border-amber-200">
                UPI Payment Submitted • Awaiting Bank Verification
              </span>
            ) : isCod ? (
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-3.5 py-1.5 rounded-full border border-amber-200">
                COD Order Placed • Awaiting Confirmation
              </span>
            ) : (
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200">
                Order Confirmed &amp; Payment Verified
              </span>
            )}
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary tracking-tight">
              {isCustomUpi && isPending
                ? 'Payment Under Verification'
                : isCod
                  ? 'Order Received — Confirmation Pending'
                  : 'Thank You for Your Order!'}
            </h1>
            <p className="text-xs sm:text-sm text-muted max-w-md mx-auto">
              Your order <strong className="text-primary font-mono">{orderId}</strong> has been received
              {isCustomUpi && isPending
                ? ' and your 12-digit UTR reference is currently being reconciled with our IndusInd Bank account.'
                : isCod
                  ? ' via Cash on Delivery and is queued with our East Champaran operations desk for dispatch confirmation.'
                  : ' and scheduled for dispatch from our East Champaran hub.'}
            </p>
          </div>

          {/* Consignment & Recipient Destination Box */}
          <div className="bg-surface-dim/70 rounded-2xl p-5 border border-border text-left space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Consignment Details
              </span>
              <span className="font-mono text-primary font-bold">#{orderId}</span>
            </div>

            {order?.utrNumber && (
              <div className="flex justify-between items-center pb-2 border-b border-border bg-amber-500/10 p-2.5 rounded-xl">
                <span className="text-amber-900 font-semibold">Submitted UPI UTR:</span>
                <span className="font-mono font-bold text-amber-950">{order.utrNumber}</span>
              </div>
            )}

            <div className="flex justify-between items-center pb-2 border-b border-border">
              <span className="text-muted">Recipient / Contact:</span>
              <span className="font-medium text-primary text-right">
                {recipientName} {recipientPhone && `(${recipientPhone})`}
              </span>
            </div>

            <div className="flex justify-between items-center pb-2 border-b border-border">
              <span className="text-muted">Estimated Doorstep Delivery:</span>
              <strong className="text-emerald-700">3 - 5 Business Days</strong>
            </div>

            <div className="flex justify-between items-center pb-2 border-b border-border">
              <span className="text-muted">Dispatch Facility:</span>
              <span className="font-medium text-primary">East Champaran Hub (PIN: 845427)</span>
            </div>

            {order?.shippingAddress && (
              <div className="flex justify-between items-start pb-2 border-b border-border gap-4">
                <span className="text-muted shrink-0">Delivery Address:</span>
                <span className="font-medium text-primary text-right">
                  {order.shippingAddress.addressLine1}
                  {order.shippingAddress.addressLine2 ? `, ${order.shippingAddress.addressLine2}` : ''}, {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.postalCode}
                </span>
              </div>
            )}

            {/* Itemized Products Summary */}
            {order?.items && order.items.length > 0 && (
              <div className="pt-1 pb-2 border-b border-border">
                <span className="text-muted block mb-2 font-semibold">Items in Consignment ({order.items.length}):</span>
                <div className="space-y-2">
                  {order.items.map((it, idx) => (
                    <div key={it.id || idx} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-accent shrink-0" />
                        <span className="text-primary font-medium">
                          {it.productTitle} {it.variantTitle && it.variantTitle !== 'Default' ? `(${it.variantTitle})` : ''} × {it.quantity}
                        </span>
                      </div>
                      <span className="font-semibold text-primary">
                        {formatPaiseToRupees(it.totalInPaise || (it.priceInPaise * it.quantity))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Complete Checkout-Matched Price Breakdown */}
            {order && (
              <div className="space-y-2 pt-1 text-xs">
                <div className="flex justify-between items-center text-muted">
                  <span>Items Subtotal:</span>
                  <span className="font-medium text-primary">{formatPaiseToRupees(order.subtotalInPaise || order.totalInPaise)}</span>
                </div>

                {order.discountInPaise > 0 && (
                  <div className="flex justify-between items-center text-emerald-700">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      <span>Promotional Discount {order.couponCode ? `(${order.couponCode})` : ''}:</span>
                    </span>
                    <strong className="font-semibold">-{formatPaiseToRupees(order.discountInPaise)}</strong>
                  </div>
                )}

                <div className="flex justify-between items-center text-muted">
                  <span>Standard Express Delivery:</span>
                  <span className="font-medium text-primary">
                    {order.shippingInPaise === 0 ? (
                      <span className="text-emerald-700 font-bold">FREE</span>
                    ) : (
                      formatPaiseToRupees(order.shippingInPaise)
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[11px] text-muted">
                  <span>Statutory Indian GST:</span>
                  <span className="text-emerald-800 font-medium">Included in product price</span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-border text-sm">
                  <span className="font-bold text-primary">
                    {order.paymentStatus === 'PAID' ? 'Total Paid' : 'Payable Amount'} ({order.paymentMethod || 'UPI'}):
                  </span>
                  <strong className="text-accent text-base font-bold font-editorial">{formatPaiseToRupees(order.totalInPaise)}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Custom UPI Payment Link & Sharing Card */}
          {isCustomUpi && (
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Shareable Payment Link
                </span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                  Universal Web Link
                </span>
              </div>
              <p className="text-xs text-muted">
                Need someone else to pay or want to open on another device? Share the dedicated InfiniCharm payment link:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  href={`/pay/${orderId}`}
                  className="flex-1 min-w-[140px] py-2.5 px-3 bg-primary text-white text-xs font-bold rounded-xl text-center hover:bg-primary-hover transition-colors shadow-xs"
                >
                  ⚡ Open Payment Page
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    const payUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://infinicharm.com'}/pay/${orderId}`;
                    navigator.clipboard.writeText(payUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-slate text-xs font-semibold rounded-xl border border-stone-300 transition-colors cursor-pointer"
                >
                  {copiedLink ? '✓ Copied Link' : 'Copy Link'}
                </button>
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Hi! Please view the order details and pay for InfiniCharm Order #${orderId} here: ${typeof window !== 'undefined' ? window.location.origin : 'https://infinicharm.com'}/pay/${orderId}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>💬</span>
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          )}

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              href={`/track-order?id=${orderId}`}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transition-colors"
            >
              <Truck className="w-4 h-4" />
              <span>Track Consignment</span>
            </Link>

            <Link
              href="/account/orders"
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-surface-dim hover:bg-border text-primary text-xs font-bold uppercase tracking-wider rounded-xl transition-colors border border-border"
            >
              <Package className="w-4 h-4" />
              <span>View in Account</span>
            </Link>

            <Link
              href="/shop"
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-surface-dim hover:bg-border text-primary text-xs font-bold uppercase tracking-wider rounded-xl transition-colors border border-border"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Continue Shopping</span>
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-xs text-muted">Loading order confirmation...</div>}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
