'use client';

// ==============================================================================
// InfiniCharm — Dedicated Customer Order Details & Lifecycle Console
// Governing PRD: PRD 10 (Order Management, Fulfillment Lifecycle & Logistics)
// Features: Itemized Consignment Breakdown, Real-Time Financial Authority,
//           Payment Retry / Pay Now, Logistics Tracking, Print Invoice,
//           Strict Server-Side Customer Ownership Verification
// ==============================================================================

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import {
  ORDER_STATUS_LABELS,
  isOrderEligibleForPaymentRetry,
  getCourierTrackingUrl,
} from '@/lib/services/orders';
import { Order, OrderPrivacyMeta } from '@/types';
import {
  Package,
  Truck,
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Printer,
  Copy,
  Check,
  Phone,
  Mail,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface OrderDetailClientProps {
  orderId: string;
}

export default function OrderDetailClient({ orderId: initialOrderId }: OrderDetailClientProps) {
  const [orderIdentifier, setOrderIdentifier] = useState<string>(initialOrderId);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/account\/orders\/([^/?#]+)/i);
      if (match && match[1] && match[1] !== initialOrderId) {
        setOrderIdentifier(decodeURIComponent(match[1].trim()));
      }
    }
  }, [initialOrderId]);
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [privacyMeta, setPrivacyMeta] = useState<OrderPrivacyMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function loadOrder() {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const clean = encodeURIComponent(orderIdentifier.trim());
        const res = await fetch(`/api/orders/${clean}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const data = await res.json().catch(() => ({}));

        if (!isMounted) return;

        if (res.ok && data.success && data.order) {
          setOrder(data.order);
          setPrivacyMeta(data.privacy || null);
          setIsLoading(false);
          return;
        }

        // Check local storage fallback if network/server failed
        if (typeof window !== 'undefined') {
          const raw = localStorage.getItem('infinicharm_orders');
          if (raw) {
            const list: Order[] = JSON.parse(raw);
            const found = list.find(
              (o) =>
                o.orderNumber?.toUpperCase() === orderIdentifier.toUpperCase() ||
                o.id?.toUpperCase() === orderIdentifier.toUpperCase()
            );
            if (found && isMounted) {
              setOrder(found);
              setIsLoading(false);
              return;
            }
          }
        }

        setErrorMsg(data.error || `Order "${orderIdentifier}" could not be retrieved.`);
        setIsLoading(false);
      } catch {
        if (!isMounted) return;
        setErrorMsg('Network error while loading consignment details.');
        setIsLoading(false);
      }
    }

    loadOrder();

    return () => {
      isMounted = false;
    };
  }, [orderIdentifier]);

  // Loading Skeleton
  if (isLoading) {
    return (
      <div className="py-12 bg-canvas min-h-screen">
        <Container className="max-w-5xl space-y-6">
          <div className="h-6 w-48 bg-surface-dim animate-pulse rounded-lg" />
          <div className="h-40 bg-surface animate-pulse rounded-2xl border border-border" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 h-80 bg-surface animate-pulse rounded-2xl border border-border" />
            <div className="lg:col-span-4 h-80 bg-surface animate-pulse rounded-2xl border border-border" />
          </div>
        </Container>
      </div>
    );
  }

  // Not Found / Error State
  if (errorMsg || !order) {
    return (
      <div className="py-16 bg-canvas min-h-screen">
        <Container className="max-w-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-primary">Consignment Not Found</h1>
            <p className="text-xs sm:text-sm text-muted max-w-md mx-auto leading-relaxed">
              {errorMsg || `We couldn't locate any order matching reference "${orderIdentifier}". Please verify your order number or log in with the account used at checkout.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/account/orders"
              className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
            >
              View Order History
            </Link>
            <Link
              href="/account"
              className="px-5 py-2.5 bg-surface hover:bg-surface-dim border border-border text-primary text-xs font-semibold rounded-xl transition-colors"
            >
              Return to Account
            </Link>
          </div>
        </Container>
      </div>
    );
  }

  const statusMeta = ORDER_STATUS_LABELS[order.status] || {
    label: order.status,
    badgeClass: 'bg-zinc-100 text-zinc-800 border-zinc-300',
    description: '',
  };

  const isRetryEligible = isOrderEligibleForPaymentRetry(order);
  const trackingUrl = getCourierTrackingUrl(order.courierName, order.trackingNumber);

  return (
    <div className="py-8 sm:py-12 bg-canvas min-h-screen">
      <Container className="max-w-5xl space-y-6 sm:space-y-8">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted">
          <Link href="/account" className="hover:text-primary transition-colors">
            Account
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/account/orders" className="hover:text-primary transition-colors">
            Orders
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="font-mono text-primary font-semibold">{order.orderNumber}</span>
        </nav>

        {/* Hero Banner Header */}
        <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-lg sm:text-2xl font-bold text-primary">
                {order.orderNumber}
              </span>
              <span
                className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${statusMeta.badgeClass}`}
              >
                {statusMeta.label}
              </span>
              <span className="text-[10px] sm:text-xs font-semibold text-muted bg-surface-dim border border-border px-2.5 py-1 rounded-full uppercase">
                {order.paymentMethod} • {order.paymentStatus}
              </span>
            </div>

            <p className="text-xs text-muted flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-accent" />
              <span>
                Placed on{' '}
                {new Date(order.createdAt).toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <span>•</span>
              <span>
                Total Items:{' '}
                <strong className="text-primary">
                  {order.items?.reduce((s, it) => s + it.quantity, 0) || 1}
                </strong>
              </span>
            </p>
          </div>

          {/* Contextual Action CTAs */}
          <div className="flex flex-wrap items-center gap-2.5">
            {isRetryEligible && (
              <Link
                href={`/pay/${order.orderNumber}`}
                className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl uppercase tracking-wider transition-all shadow-sm flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>Retry Payment / Pay Now</span>
              </Link>
            )}
            <Link
              href={`/track-order?id=${order.orderNumber}`}
              className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Truck className="w-4 h-4" />
              <span>Track Consignment</span>
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2.5 bg-surface hover:bg-surface-dim border border-border text-primary text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print Summary</span>
            </button>
          </div>
        </div>

        {/* Notice for Payment Not Received */}
        {order.status === 'PAYMENT_NOT_RECEIVED' && (
          <div className="bg-rose-50 border border-rose-300 rounded-2xl p-5 text-rose-900 flex items-start gap-3.5 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <h3 className="font-bold text-sm text-rose-950 uppercase tracking-wide">
                Payment Not Received — Action Required
              </h3>
              <p className="text-xs text-rose-800 leading-relaxed">
                Our banking desk was unable to reconcile your previous payment reference with our IndusInd Bank account. Your order is safely preserved and will NOT be cancelled. Please click <strong>"Retry Payment / Pay Now"</strong> above to complete your UPI payment or update your 12-digit UTR number.
              </p>
            </div>
          </div>
        )}

        {/* Two-Column Grid: Left 8 cols = Items & Timeline; Right 4 cols = Financials & Delivery */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-8 space-y-6">
            {/* Items in Consignment */}
            <div className="bg-surface rounded-2xl border border-border p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="font-display text-sm sm:text-base font-bold text-primary flex items-center gap-2">
                  <Package className="w-4 h-4 text-accent" />
                  <span>Items in this Consignment</span>
                </h2>
                <span className="text-xs font-semibold text-muted">
                  {order.items?.length || 0} product(s)
                </span>
              </div>

              <div className="divide-y divide-border/60">
                {order.items && order.items.length > 0 ? (
                  order.items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4 text-xs"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-14 h-14 rounded-xl bg-surface-dim border border-border flex items-center justify-center shrink-0 overflow-hidden">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.productTitle}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-muted/40" />
                          )}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="font-bold text-primary text-sm leading-snug">
                            {item.productTitle}
                          </p>
                          <p className="text-[11px] text-muted">
                            {item.variantTitle} × <strong className="text-primary">{item.quantity}</strong>
                            {item.sku && (
                              <span className="ml-2 font-mono text-[10px] px-1.5 py-0.5 bg-surface-dim rounded border border-border">
                                SKU: {item.sku}
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-muted">
                            Unit Price: {formatPaiseToRupees(item.priceInPaise)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-bold text-primary text-sm">
                          {formatPaiseToRupees(item.totalInPaise)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted py-4">No itemized lines available.</p>
                )}
              </div>
            </div>

            {/* Payment & Settlement Card */}
            <div className="bg-surface rounded-2xl border border-border p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-display text-sm sm:text-base font-bold text-primary flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-accent" />
                  <span>Payment & Verification Information</span>
                </h3>
                <span className="text-xs font-mono font-bold uppercase text-primary">
                  {order.paymentMethod}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 bg-surface-dim/60 rounded-xl border border-border space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                    Payment Method
                  </span>
                  <p className="font-semibold text-primary">
                    {order.paymentMethod === 'CUSTOM_UPI'
                      ? 'Custom UPI Direct (Dynamic QR / App)'
                      : order.paymentMethod === 'PAYGLOCAL'
                      ? 'PayGlocal Global Multi-Currency Gateway'
                      : order.paymentMethod === 'COD'
                      ? 'Cash on Delivery (Pay at Doorstep)'
                      : order.paymentMethod}
                  </p>
                </div>

                <div className="p-3.5 bg-surface-dim/60 rounded-xl border border-border space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                    Reconciliation Status
                  </span>
                  <p
                    className={`font-bold ${
                      order.paymentStatus === 'PAID'
                        ? 'text-emerald-700'
                        : order.status === 'PAYMENT_NOT_RECEIVED'
                        ? 'text-rose-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {order.paymentStatus === 'PAID'
                      ? '✓ Verified & Reconciled'
                      : order.status === 'PAYMENT_NOT_RECEIVED'
                      ? '✕ Payment Not Received (Retry Available)'
                      : '⏳ Under Bank Statement Verification'}
                  </p>
                </div>

                {order.utrNumber && (
                  <div className="p-3.5 bg-surface-dim/60 rounded-xl border border-border sm:col-span-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                        Submitted UPI Transaction Reference (UTR)
                      </span>
                      <strong className="font-mono text-sm text-primary">{order.utrNumber}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(order.utrNumber!, 'utr_details')}
                      className="text-xs font-semibold text-primary hover:underline px-2.5 py-1 bg-surface rounded-lg border border-border"
                    >
                      {copiedKey === 'utr_details' ? '✓ Copied' : 'Copy UTR'}
                    </button>
                  </div>
                )}
              </div>

              {/* Official Payee Reference */}
              <div className="p-3.5 rounded-xl bg-accent/5 border border-accent/20 text-xs space-y-1">
                <span className="font-bold text-primary flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                  <span>Official Merchant Settlement Account</span>
                </span>
                <p className="text-muted leading-relaxed text-[11px]">
                  Beneficiary: <strong>TechilyFly - InfiniCharm</strong> • Current A/C: <strong>258825164657</strong> • IFSC: <strong>INDB0001548</strong> • IndusInd Bank
                </p>
              </div>
            </div>

            {/* Consignment Timeline / Events */}
            {order.timeline && order.timeline.length > 0 && (
              <div className="bg-surface rounded-2xl border border-border p-5 sm:p-6 shadow-sm space-y-4">
                <h3 className="font-display text-sm sm:text-base font-bold text-primary flex items-center gap-2 border-b border-border pb-3">
                  <Clock className="w-4 h-4 text-accent" />
                  <span>Fulfillment & Consignment Timeline</span>
                </h3>

                <div className="space-y-4">
                  {order.timeline
                    .filter((ev) => ev.isCustomerVisible !== false)
                    .map((ev, idx) => (
                      <div key={ev.id || idx} className="flex items-start gap-3 text-xs">
                        <div className="w-7 h-7 rounded-full bg-surface-dim border border-border flex items-center justify-center shrink-0 mt-0.5 text-accent font-bold">
                          {idx + 1}
                        </div>
                        <div className="space-y-0.5 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <strong className="text-primary font-semibold">{ev.title}</strong>
                            <span className="text-[10px] text-muted">
                              {new Date(ev.timestamp).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-muted text-[11px] leading-relaxed">{ev.description}</p>
                          {ev.location && (
                            <span className="text-[10px] text-muted/80 block">
                              Location: {ev.location}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-4 space-y-6">
            {/* Financial Breakdown */}
            <div className="bg-surface rounded-2xl border border-border p-5 sm:p-6 shadow-sm space-y-4">
              <h3 className="font-display text-sm font-bold text-primary border-b border-border pb-3">
                Financial Summary
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-muted">
                  <span>Items Subtotal</span>
                  <span className="font-medium text-primary">
                    {formatPaiseToRupees(order.subtotalInPaise)}
                  </span>
                </div>

                <div className="flex justify-between text-muted">
                  <span>Shipping & Delivery</span>
                  <span className="font-medium text-primary">
                    {order.shippingInPaise === 0 ? 'FREE' : formatPaiseToRupees(order.shippingInPaise)}
                  </span>
                </div>

                {order.discountInPaise > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Coupon / Discount</span>
                    <span>-{formatPaiseToRupees(order.discountInPaise)}</span>
                  </div>
                )}

                <div className="flex justify-between text-muted">
                  <span>Statutory GST (Included)</span>
                  <span className="font-medium text-primary">
                    {formatPaiseToRupees(order.taxInPaise || 0)}
                  </span>
                </div>

                <div className="pt-3 border-t border-border flex justify-between items-baseline">
                  <span className="text-sm font-bold text-primary">Grand Total</span>
                  <span className="text-xl font-display font-extrabold text-accent">
                    {formatPaiseToRupees(order.totalInPaise)}
                  </span>
                </div>
              </div>
            </div>

            {/* Delivery Destination Address */}
            <div className="bg-surface rounded-2xl border border-border p-5 sm:p-6 shadow-sm space-y-4">
              <h3 className="font-display text-sm font-bold text-primary border-b border-border pb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-accent" />
                <span>Delivery Destination</span>
              </h3>

              {order.shippingAddress ? (
                <div className="space-y-2 text-xs text-muted leading-relaxed">
                  <p className="font-bold text-primary text-sm">
                    {order.shippingAddress.fullName}
                  </p>
                  <p>{order.shippingAddress.addressLine1}</p>
                  {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                  <p className="text-primary font-medium">
                    {order.shippingAddress.city}, {order.shippingAddress.state} —{' '}
                    <strong className="font-mono">{order.shippingAddress.postalCode}</strong>
                  </p>
                  <p className="text-muted">{order.shippingAddress.country || 'India'}</p>

                  <div className="pt-2">
                    <a
                      href={`tel:${order.shippingAddress.phone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-dim border border-border text-primary font-medium text-xs hover:text-accent transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-accent" />
                      <span>{order.shippingAddress.phone}</span>
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">No shipping address recorded.</p>
              )}
            </div>

            {/* Courier Tracking Partner (if assigned) */}
            {order.trackingNumber && (
              <div className="bg-surface rounded-2xl border border-border p-5 sm:p-6 shadow-sm space-y-3">
                <h3 className="font-display text-sm font-bold text-primary border-b border-border pb-3 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-accent" />
                  <span>Logistics Carrier</span>
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">Courier:</span>
                    <strong className="text-primary">{order.courierName || 'Delhivery'}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted">AWB:</span>
                    <strong className="font-mono text-primary">{order.trackingNumber}</strong>
                  </div>
                  {order.estimatedDeliveryDate && (
                    <div className="flex justify-between">
                      <span className="text-muted">Estimated Delivery:</span>
                      <strong className="text-primary">
                        {new Date(order.estimatedDeliveryDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </strong>
                    </div>
                  )}

                  {trackingUrl && (
                    <div className="pt-2">
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 px-3 bg-surface-dim hover:bg-surface border border-border text-primary text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span>Open Carrier Tracking</span>
                        <ExternalLink className="w-3.5 h-3.5 text-muted" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Customer Care Desk Assistance */}
            <div className="p-5 rounded-2xl bg-surface-dim/60 border border-border text-xs space-y-3">
              <span className="font-bold text-primary block">Questions Regarding this Consignment?</span>
              <p className="text-muted text-[11px] leading-relaxed">
                Our support team is available Mon – Sat (9:00 AM – 7:00 PM IST) to assist with order tracking, invoice copies, and batch provenance.
              </p>
              <div className="space-y-1.5 pt-1 text-xs">
                <a
                  href="tel:+918825164657"
                  className="flex items-center gap-2 text-primary hover:text-accent font-semibold"
                >
                  <Phone className="w-3.5 h-3.5 text-accent" />
                  <span>+91 8825164657</span>
                </a>
                <a
                  href="mailto:support@infinicharm.com"
                  className="flex items-center gap-2 text-primary hover:text-accent font-semibold"
                >
                  <Mail className="w-3.5 h-3.5 text-accent" />
                  <span>support@infinicharm.com</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
