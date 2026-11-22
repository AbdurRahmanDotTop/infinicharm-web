'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import {
  Search,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Lock,
  LogIn,
  RefreshCw,
  ArrowRight,
  Phone,
  Sparkles,
  FileText,
  X,
} from 'lucide-react';
import type { Order, OrderStatus } from '@/types';
import {
  getCourierTrackingUrl,
  ORDER_STATUS_LABELS,
  type OrderPrivacyMeta,
  type PublicTrackedOrder,
} from '@/lib/services/orders';
import { ShareButton } from '@/components/common/ShareButton';

type TrackedOrderPayload = Order | PublicTrackedOrder;

interface StepperStage {
  id: string;
  label: string;
  description: string;
  status: 'completed' | 'active' | 'upcoming' | 'failed';
}

function hasPrivateOrderDetails(
  order: TrackedOrderPayload | null,
  privacy: OrderPrivacyMeta | null
): order is Order {
  if (!order) return false;
  const hasItemsAndAddress =
    'items' in order &&
    Array.isArray((order as Order).items) &&
    (order as Order).items.length > 0 &&
    'shippingAddress' in order &&
    Boolean((order as Order).shippingAddress);

  if (privacy?.canViewPrivateDetails) {
    return hasItemsAndAddress;
  }
  if (hasItemsAndAddress && (!privacy || privacy.accessState === 'AUTHORIZED')) {
    return true;
  }
  return false;
}

function buildStepperStages(order: TrackedOrderPayload): StepperStage[] {
  const isCustomUpi = order.paymentMethod === 'CUSTOM_UPI';
  const isPaymentPaid = order.paymentStatus === 'PAID';
  const status: OrderStatus = order.status;

  if (isCustomUpi) {
    const stage1: StepperStage = {
      id: 'placed',
      label: 'Order Placed',
      description: 'Order registered in system',
      status: 'completed',
    };

    let stage2Status: StepperStage['status'] = 'upcoming';
    let stage2Desc = 'Bank reconciliation';
    if (status === 'PAYMENT_NOT_RECEIVED' || order.paymentStatus === 'FAILED' || order.manualApprovalStatus === 'REJECTED') {
      stage2Status = 'failed';
      stage2Desc = status === 'PAYMENT_NOT_RECEIVED' ? 'Payment Not Received (Retry Payment)' : 'UTR Verification Failed';
    } else if (
      isPaymentPaid ||
      order.manualApprovalStatus === 'APPROVED' ||
      [
        'PAYMENT_RECEIVED',
        'CONFIRMED',
        'PROCESSING',
        'PACKED',
        'READY_FOR_DISPATCH',
        'SHIPPED',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
      ].includes(status)
    ) {
      stage2Status = 'completed';
      stage2Desc = 'UTR Verified & Paid';
    } else {
      stage2Status = 'active';
      stage2Desc = order.utrNumber ? `UTR ${order.utrNumber} under review` : 'Awaiting confirmation';
    }
    const stage2: StepperStage = {
      id: 'verification',
      label: 'Payment Verification',
      description: stage2Desc,
      status: stage2Status,
    };

    let stage3Status: StepperStage['status'] = 'upcoming';
    let stage3Desc = 'Awaiting verification';
    if (status === 'CANCELLED') {
      stage3Status = 'failed';
      stage3Desc = 'Order Cancelled';
    } else if (status === 'PAYMENT_NOT_RECEIVED') {
      stage3Status = 'upcoming';
      stage3Desc = 'Awaiting payment retry';
    } else if (stage2Status === 'failed') {
      stage3Status = 'failed';
      stage3Desc = 'Payment Failed';
    } else if (stage2Status === 'completed') {
      if (
        [
          'CONFIRMED',
          'PROCESSING',
          'PACKED',
          'READY_FOR_DISPATCH',
          'SHIPPED',
          'OUT_FOR_DELIVERY',
          'DELIVERED',
        ].includes(status)
      ) {
        stage3Status = 'completed';
        stage3Desc = 'Approved by Dispatch';
      } else if (status === 'PAYMENT_RECEIVED') {
        stage3Status = 'active';
        stage3Desc = 'Preparing confirmation';
      } else {
        stage3Status = 'active';
        stage3Desc = 'Awaiting approval';
      }
    }
    const stage3: StepperStage = {
      id: 'confirmed',
      label: 'Order Confirmed',
      description: stage3Desc,
      status: stage3Status,
    };

    let stage4Status: StepperStage['status'] = 'upcoming';
    if (stage3Status === 'completed') {
      if (['PACKED', 'READY_FOR_DISPATCH', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(status)) {
        stage4Status = 'completed';
      } else if (status === 'PROCESSING') {
        stage4Status = 'active';
      }
    }
    const stage4: StepperStage = {
      id: 'processing',
      label: 'Packed & Ready',
      description: stage4Status === 'completed' ? 'Tamper-proof seal applied' : 'Warehouse QC & packing',
      status: stage4Status,
    };

    let stage5Status: StepperStage['status'] = 'upcoming';
    if (stage4Status === 'completed') {
      if (['OUT_FOR_DELIVERY', 'DELIVERED'].includes(status)) {
        stage5Status = 'completed';
      } else if (['SHIPPED', 'READY_FOR_DISPATCH'].includes(status)) {
        stage5Status = 'active';
      }
    }
    const stage5: StepperStage = {
      id: 'dispatched',
      label: 'In Transit',
      description: order.courierName || 'Courier partner',
      status: stage5Status,
    };

    let stage6Status: StepperStage['status'] = 'upcoming';
    if (stage5Status === 'completed') {
      if (status === 'DELIVERED') {
        stage6Status = 'completed';
      } else if (status === 'OUT_FOR_DELIVERY') {
        stage6Status = 'active';
      }
    }
    const stage6: StepperStage = {
      id: 'out_for_delivery',
      label: 'Out for Delivery',
      description: 'Local delivery hub',
      status: stage6Status,
    };

    const stage7: StepperStage = {
      id: 'delivered',
      label: 'Delivered',
      description: 'Handed over safely',
      status: stage6Status === 'completed' && status === 'DELIVERED' ? 'completed' : 'upcoming',
    };

    return [stage1, stage2, stage3, stage4, stage5, stage6, stage7];
  }

  // Standard 6-stage flow
  const stage1: StepperStage = {
    id: 'placed',
    label: 'Order Placed',
    description: 'Order registered',
    status: 'completed',
  };

  let stage2Status: StepperStage['status'] = 'upcoming';
  if (
    ['CONFIRMED', 'PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(
      status
    ) ||
    status === 'PAYMENT_RECEIVED'
  ) {
    stage2Status = 'completed';
  } else if (status === 'CANCELLED') {
    stage2Status = 'failed';
  } else {
    stage2Status = 'active';
  }
  const stage2: StepperStage = {
    id: 'confirmed',
    label: order.paymentMethod === 'COD' ? 'COD Confirmed' : 'Payment Confirmed',
    description: order.paymentMethod === 'COD' ? 'Pay upon delivery' : 'Payment authorized',
    status: stage2Status,
  };

  let stage3Status: StepperStage['status'] = 'upcoming';
  if (stage2Status === 'completed') {
    if (['PACKED', 'READY_FOR_DISPATCH', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(status)) {
      stage3Status = 'completed';
    } else if (status === 'PROCESSING') {
      stage3Status = 'active';
    }
  }
  const stage3: StepperStage = {
    id: 'processing',
    label: 'Packed & Ready',
    description: 'East Champaran Hub',
    status: stage3Status,
  };

  let stage4Status: StepperStage['status'] = 'upcoming';
  if (stage3Status === 'completed') {
    if (['OUT_FOR_DELIVERY', 'DELIVERED'].includes(status)) {
      stage4Status = 'completed';
    } else if (['SHIPPED', 'READY_FOR_DISPATCH'].includes(status)) {
      stage4Status = 'active';
    }
  }
  const stage4: StepperStage = {
    id: 'dispatched',
    label: 'Dispatched',
    description: order.courierName || 'Courier partner',
    status: stage4Status,
  };

  let stage5Status: StepperStage['status'] = 'upcoming';
  if (stage4Status === 'completed') {
    if (status === 'DELIVERED') {
      stage5Status = 'completed';
    } else if (status === 'OUT_FOR_DELIVERY') {
      stage5Status = 'active';
    }
  }
  const stage5: StepperStage = {
    id: 'out_for_delivery',
    label: 'Out for Delivery',
    description: 'Destination hub',
    status: stage5Status,
  };

  const stage6: StepperStage = {
    id: 'delivered',
    label: 'Delivered',
    description: 'Direct to doorstep',
    status: stage5Status === 'completed' && status === 'DELIVERED' ? 'completed' : 'upcoming',
  };

  return [stage1, stage2, stage3, stage4, stage5, stage6];
}

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [queryInput, setQueryInput] = useState('');
  const [searchedOrder, setSearchedOrder] = useState<TrackedOrderPayload | null>(null);
  const [privacyMeta, setPrivacyMeta] = useState<OrderPrivacyMeta | null>(null);
  const [myRecentOrders, setMyRecentOrders] = useState<Array<{ orderNumber: string; status: OrderStatus; createdAt: string }>>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const performLookup = useCallback(async (identifier: string, isBackground = false) => {
    const raw = identifier.trim().toUpperCase();
    if (!raw) return;
    const clean = raw.includes(' ') && raw.startsWith('INF') ? raw.replace(/\s+/g, '-') : raw;

    if (!isBackground) {
      setErrorMsg(null);
      setHasSearched(true);
      setIsLoading(true);
    }

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(clean)}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.order) {
        setSearchedOrder(data.order);
        setPrivacyMeta(data.privacy || null);
        if (!isBackground) setIsLoading(false);
        return;
      }

      if (!isBackground) {
        setSearchedOrder(null);
        setPrivacyMeta(null);
        setErrorMsg(
          data.error ||
            `No consignment found matching "${clean}". Please verify your Order Number or registered 10-digit mobile number.`
        );
      }
    } catch {
      if (!isBackground) {
        setSearchedOrder(null);
        setPrivacyMeta(null);
        setErrorMsg('Unable to connect to the live consignment server right now. Please try again.');
      }
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, []);

  // Load authenticated user's quick-access order references (strictly server-verified via /api/customers/me)
  const loadAuthenticatedRecentOrders = useCallback(async () => {
    const hasSessionCookie =
      typeof document !== 'undefined' &&
      document.cookie.includes('infinicharm_customer_session=active');
    if (!hasSessionCookie) {
      setMyRecentOrders([]);
      return;
    }

    try {
      const res = await fetch('/api/customers/me', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        setMyRecentOrders([]);
        return;
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        setMyRecentOrders(
          data.orders.slice(0, 4).map((o: Order) => ({
            orderNumber: o.orderNumber,
            status: o.status,
            createdAt: o.createdAt,
          }))
        );
      } else {
        setMyRecentOrders([]);
      }
    } catch {
      setMyRecentOrders([]);
    }
  }, []);

  useEffect(() => {
    loadAuthenticatedRecentOrders();
  }, [loadAuthenticatedRecentOrders]);

  // Listen to real-time BroadcastChannel, cross-tab order, or account session changes
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel('infinicharm_orders_channel');
        channel.onmessage = (event) => {
          if (
            event.data?.type === 'ORDER_UPDATED' ||
            event.data?.type === 'ORDER_CREATED' ||
            event.data?.type === 'ORDER_DELETED'
          ) {
            loadAuthenticatedRecentOrders();
            if (queryInput) {
              performLookup(queryInput);
            }
          }
        };
      } catch {}
    }

    const handleOrderSync = () => {
      if (queryInput) {
        performLookup(queryInput);
      }
    };
    const handleAuthSync = () => {
      loadAuthenticatedRecentOrders();
      if (queryInput) {
        performLookup(queryInput);
      }
    };
    window.addEventListener('infinicharm_orders_updated', handleOrderSync);
    window.addEventListener('infinicharm_customer_updated', handleAuthSync);
    window.addEventListener('storage', handleAuthSync);

    // Gentle background polling only (never unmounting UI)
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && queryInput) {
        performLookup(queryInput, true);
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      try {
        channel?.close();
      } catch {}
      window.removeEventListener('infinicharm_orders_updated', handleOrderSync);
      window.removeEventListener('infinicharm_customer_updated', handleAuthSync);
      window.removeEventListener('storage', handleAuthSync);
    };
  }, [queryInput, performLookup, loadAuthenticatedRecentOrders]);

  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (idFromUrl) {
      setQueryInput(idFromUrl);
      performLookup(idFromUrl);
    }
  }, [searchParams, performLookup]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = queryInput.trim();
    if (!trimmed) return;
    performLookup(trimmed);
  };

  const handleSwitchAccountLogin = async (orderNumber: string) => {
    setIsSwitchingAccount(true);
    try {
      await fetch('/api/auth/customer/logout', { method: 'POST' });
      document.cookie = 'infinicharm_customer_session=; path=/; max-age=0';
      document.cookie = 'infinicharm_customer_id=; path=/; max-age=0';
      if (typeof window !== 'undefined') {
        localStorage.removeItem('infinicharm_customer_user');
        localStorage.removeItem('infinicharm_customer_addresses');
        window.dispatchEvent(new Event('infinicharm_customer_updated'));
      }
    } catch {
      // Proceed to login even if cookie clear request failed
    } finally {
      const target = `/login?redirect=${encodeURIComponent(`/track-order?id=${orderNumber}`)}`;
      router.push(target);
      setIsSwitchingAccount(false);
    }
  };

  const statusMeta = searchedOrder
    ? ORDER_STATUS_LABELS[searchedOrder.status] || {
        label: searchedOrder.status,
        badgeClass: 'bg-zinc-100 text-zinc-800 border-zinc-300',
        description: '',
      }
    : null;

  const stepperStages = searchedOrder ? buildStepperStages(searchedOrder) : [];
  const completedCount = stepperStages.filter((s) => s.status === 'completed').length;
  const progressPercent =
    stepperStages.length > 1
      ? Math.round(((Math.max(1, completedCount) - 1) / (stepperStages.length - 1)) * 100)
      : 0;

  const trackingUrl = searchedOrder
    ? getCourierTrackingUrl(searchedOrder.courierName, searchedOrder.trackingNumber)
    : null;

  const canShowPrivateDetails = hasPrivateOrderDetails(searchedOrder, privacyMeta);
  const authorizedOrder = canShowPrivateDetails ? searchedOrder : null;
  const loginRedirectUrl = searchedOrder
    ? `/login?redirect=${encodeURIComponent(`/track-order?id=${searchedOrder.orderNumber}`)}`
    : '/login?redirect=%2Ftrack-order';

  return (
    <div className="py-8 sm:py-12 bg-canvas">
      <Container className="max-w-5xl space-y-6 sm:space-y-8">
        {/* Hero Header */}
        <div className="relative rounded-3xl bg-gradient-to-br from-surface via-surface to-surface-dim border border-border p-6 sm:p-10 shadow-sm overflow-hidden">
          <div className="max-w-2xl mx-auto text-center space-y-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-accent uppercase tracking-widest bg-accent/10 px-3.5 py-1 rounded-full border border-accent/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Real-Time Logistics & Fulfillment</span>
            </span>
            <h1 className="font-display text-2xl sm:text-4xl font-bold text-primary tracking-tight">
              Track Your Consignment
            </h1>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              Monitor live warehouse verification, dispatch checkpoints, and courier milestones. Enter your InfiniCharm Order Reference or registered 10-digit mobile number below.
            </p>
          </div>

          {/* Search Form */}
          <div className="max-w-2xl mx-auto mt-6">
            <form
              onSubmit={handleSearchSubmit}
              className="flex flex-col sm:flex-row gap-2.5 bg-canvas p-2 rounded-2xl border border-border shadow-sm focus-within:border-accent transition-colors"
            >
              <div className="relative flex-1 flex items-center">
                <Search className="w-4 h-4 text-muted absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="Order Number (e.g. INF-202611-7655) or 10-digit Phone"
                  aria-label="Order Number or Registered Phone"
                  className="w-full text-xs sm:text-sm pl-10 pr-9 py-3 bg-transparent text-primary placeholder:text-muted focus:outline-none"
                />
                {queryInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setQueryInput('');
                      setErrorMsg(null);
                    }}
                    aria-label="Clear search query"
                    className="absolute right-2.5 p-1 text-muted hover:text-primary rounded-lg"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={isLoading || !queryInput.trim()}
                className="px-6 py-3 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl uppercase tracking-wider transition-all shrink-0 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5" />
                )}
                <span>{isLoading ? 'Tracking...' : 'Track Consignment'}</span>
              </button>
            </form>

            {/* Quick-pick strip exclusively for the logged-in user's own orders */}
            {myRecentOrders.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <span className="text-[11px] font-medium text-muted">Your recent orders:</span>
                {myRecentOrders.map((ord) => (
                  <button
                    key={ord.orderNumber}
                    type="button"
                    onClick={() => {
                      setQueryInput(ord.orderNumber);
                      performLookup(ord.orderNumber);
                    }}
                    className={`px-3 py-1 rounded-full text-[11px] font-mono font-semibold border transition-colors ${
                      searchedOrder?.orderNumber === ord.orderNumber
                        ? 'bg-accent text-white border-accent'
                        : 'bg-surface hover:bg-surface-dim text-primary border-border'
                    }`}
                  >
                    {ord.orderNumber}
                  </button>
                ))}
              </div>
            )}

            {errorMsg && (
              <div className="mt-4 flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Dedicated Consignment Not Found State */}
        {hasSearched && !isLoading && !searchedOrder && errorMsg && (
          <div className="bg-surface rounded-3xl border border-rose-200/80 p-8 sm:p-10 text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Package className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="font-display text-lg font-bold text-primary">
                Consignment Record Not Found
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                {errorMsg}
              </p>
              <p className="text-[11px] text-muted/80">
                Please verify that the order reference follows the format <code className="font-mono font-semibold text-primary">INF-YYYYMM-XXXX</code> or search using your registered 10-digit mobile number.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href="/account"
                className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-colors"
              >
                View Account Orders
              </Link>
              <Link
                href="/contact"
                className="px-4 py-2.5 rounded-xl bg-surface border border-border hover:bg-surface-dim text-primary text-xs font-semibold transition-colors"
              >
                Contact Customer Care
              </Link>
              <Link
                href="/shop"
                className="px-4 py-2.5 rounded-xl bg-surface border border-border hover:bg-surface-dim text-primary text-xs font-semibold transition-colors"
              >
                Explore Marketplace
              </Link>
            </div>
          </div>
        )}

        {/* Empty / First-Visit Educational State */}
        {!searchedOrder && !isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface rounded-2xl border border-border p-5 space-y-2 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
              <h2 className="font-display text-sm font-bold text-primary">1. Real-Time Milestones</h2>
              <p className="text-xs text-muted leading-relaxed">
                View live order progression from initial confirmation and bank UTR reconciliation to sealed dispatch and delivery.
              </p>
            </div>
            <div className="bg-surface rounded-2xl border border-border p-5 space-y-2 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <h2 className="font-display text-sm font-bold text-primary">2. Strict Privacy Control</h2>
              <p className="text-xs text-muted leading-relaxed">
                Consignment items, pricing breakdowns, and personal delivery addresses are encrypted behind account ownership verification.
              </p>
            </div>
            <div className="bg-surface rounded-2xl border border-border p-5 space-y-2 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
              <h2 className="font-display text-sm font-bold text-primary">3. Direct Courier Sync</h2>
              <p className="text-xs text-muted leading-relaxed">
                Access assigned AWB numbers, estimated arrival dates, and one-click partner carrier tracking links as soon as dispatched.
              </p>
            </div>
          </div>
        )}

        {/* Active Consignment Result */}
        {searchedOrder && (
          <div className="space-y-6">
            {/* Summary Status Banner Card */}
            <div className="bg-surface rounded-3xl border border-border overflow-hidden shadow-sm">
              <div className="p-5 sm:p-7 bg-gradient-to-r from-surface-dim/80 via-surface to-surface border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
                      Consignment Reference
                    </span>
                    {canShowPrivateDetails ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Verified Owner</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
                        <Lock className="w-3 h-3" />
                        <span>Protected Preview</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    <h2 className="font-mono text-xl sm:text-2xl font-bold text-primary tracking-tight">
                      {searchedOrder.orderNumber}
                    </h2>
                    <button
                      type="button"
                      onClick={() => handleCopy(searchedOrder.orderNumber, 'ordNum')}
                      title="Copy Order Reference"
                      className="p-1.5 rounded-lg bg-surface-dim border border-border text-muted hover:text-primary transition-colors"
                    >
                      {copiedKey === 'ordNum' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <ShareButton
                      title={`Consignment ${searchedOrder.orderNumber}`}
                      url={`/track-order?id=${searchedOrder.orderNumber}`}
                      text={`Track InfiniCharm consignment ${searchedOrder.orderNumber} in real time:`}
                      subtitle={`Status: ${statusMeta?.label || searchedOrder.status}`}
                      variant="subtle"
                    />
                  </div>

                  <p className="text-xs text-muted">
                    Placed on{' '}
                    <span className="text-primary font-medium">
                      {new Date(searchedOrder.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </p>
                </div>

                <div className="flex flex-col md:items-end gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 self-start md:self-auto px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide border ${statusMeta?.badgeClass}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current" />
                    <span>{statusMeta?.label}</span>
                  </span>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                    <span className="px-2.5 py-0.5 rounded-lg bg-surface-dim border border-border">
                      Method: <strong className="text-primary">{searchedOrder.paymentMethod}</strong>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-surface-dim border border-border">
                      Payment:{' '}
                      <strong
                        className={
                          searchedOrder.paymentStatus === 'PAID'
                            ? 'text-emerald-700'
                            : searchedOrder.paymentStatus === 'FAILED'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                        }
                      >
                        {searchedOrder.paymentStatus}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Alerts Section */}
              <div className="p-5 sm:p-7 space-y-6">
                {searchedOrder.status === 'PAYMENT_NOT_RECEIVED' && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 flex items-start gap-3.5 shadow-sm">
                    <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 shrink-0">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-sm font-bold text-rose-900">
                          Payment Not Received — Action Required
                        </h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-200 text-rose-900">
                          Reconciliation Pending
                        </span>
                      </div>
                      <p className="text-xs text-rose-800 leading-relaxed">
                        Our banking desk was unable to reconcile the previous payment reference for this order. Please retry payment via UPI or provide your updated 12-digit UTR number so our team can verify and dispatch your order.
                      </p>
                      <div className="pt-1 flex flex-wrap items-center gap-2.5">
                        <Link
                          href={`/pay/${searchedOrder.orderNumber}`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                        >
                          <span>⚡ Retry Payment / Pay Now</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            const payUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://infinicharm.com'}/pay/${searchedOrder.orderNumber}`;
                            navigator.clipboard.writeText(payUrl);
                            handleCopy(payUrl, 'payment_url');
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-primary border border-rose-200 text-xs font-semibold rounded-xl hover:bg-rose-50 transition-all"
                        >
                          <span>🔗</span>
                          <span>{copiedKey === 'payment_url' ? '✓ Copied Link' : 'Copy Payment Link'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {searchedOrder.paymentMethod === 'CUSTOM_UPI' &&
                  searchedOrder.paymentStatus === 'PENDING' && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900">
                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xs font-bold uppercase tracking-wide">
                              Payment Under Bank Verification
                            </h3>
                            <span className="text-[10px] bg-amber-200/80 text-amber-950 font-semibold px-2 py-0.5 rounded-md">
                              Pending Admin Review
                            </span>
                          </div>
                          <p className="text-xs text-amber-900/90 leading-relaxed">
                            Our finance team is reconciling your submitted UPI reference against our bank statement. Once verified, this consignment automatically advances to Confirmed.
                          </p>
                          {searchedOrder.utrNumber && (
                            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
                              <span className="text-muted">Submitted UTR:</span>
                              <strong className="text-primary bg-surface px-2.5 py-1 rounded-lg border border-border">
                                {searchedOrder.utrNumber}
                              </strong>
                              <button
                                type="button"
                                onClick={() => handleCopy(searchedOrder.utrNumber!, 'utr')}
                                className="p-1 text-muted hover:text-primary rounded"
                              >
                                {copiedKey === 'utr' ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          )}

                          <div className="pt-2 flex flex-wrap gap-2">
                            <Link
                              href={`/pay/${searchedOrder.orderNumber}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-[11px] font-bold rounded-lg hover:bg-primary/95 transition-all shadow-2xs"
                            >
                              <span>⚡ Open Payment Page / Pay Now</span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                const payUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://infinicharm.com'}/pay/${searchedOrder.orderNumber}`;
                                navigator.clipboard.writeText(payUrl);
                                handleCopy(payUrl, 'payment_url');
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-surface text-primary border border-border text-[11px] font-semibold rounded-lg hover:bg-surface-container transition-all"
                            >
                              <span>🔗</span>
                              <span>{copiedKey === 'payment_url' ? '✓ Copied Link' : 'Copy Payment Link'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {searchedOrder.status === 'CONFIRMED' && (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-0.5">
                      <h3 className="font-bold uppercase tracking-wide">Consignment Confirmed</h3>
                      <p className="text-muted">
                        Order confirmed and routed to our East Champaran fulfillment hub for batch inspection and secure dispatch.
                      </p>
                    </div>
                  </div>
                )}

                {searchedOrder.status === 'DELIVERED' && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-0.5">
                      <h3 className="font-bold uppercase tracking-wide">Delivered Successfully</h3>
                      <p className="text-emerald-800/90">
                        This consignment has been marked as delivered
                        {searchedOrder.actualDeliveryDate
                          ? ` on ${new Date(searchedOrder.actualDeliveryDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}.`
                          : '.'}
                      </p>
                    </div>
                  </div>
                )}

                {searchedOrder.status === 'CANCELLED' && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-0.5">
                      <h3 className="font-bold uppercase tracking-wide">Consignment Cancelled</h3>
                      <p className="text-rose-800/90">
                        {searchedOrder.rejectionReason || 'This order was cancelled and will not be dispatched.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Fixed Horizontal / Vertical Fulfillment Stepper */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-[11px] font-bold text-muted uppercase tracking-widest">
                      Live Fulfillment Stepper
                    </h3>
                    <span className="text-[11px] font-semibold text-primary">
                      {completedCount} of {stepperStages.length} stages completed
                    </span>
                  </div>

                  {/* Desktop Horizontal Stepper (md+) */}
                  <div className="hidden md:block relative pt-1 pb-2">
                    <div className="absolute left-8 right-8 top-6 h-1 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div
                      className={`relative grid gap-3 ${
                        stepperStages.length === 7 ? 'md:grid-cols-7' : 'md:grid-cols-6'
                      }`}
                    >
                      {stepperStages.map((stage, idx) => {
                        const isDone = stage.status === 'completed';
                        const isActive = stage.status === 'active';
                        const isFailed = stage.status === 'failed';

                        return (
                          <div key={stage.id} className="text-center flex flex-col items-center">
                            <div
                              className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold mb-2.5 transition-all ${
                                isDone
                                  ? 'bg-emerald-600 text-white shadow-sm ring-4 ring-surface'
                                  : isActive
                                    ? 'bg-accent text-white ring-4 ring-accent/25 shadow-sm'
                                    : isFailed
                                      ? 'bg-rose-600 text-white ring-4 ring-surface'
                                      : 'bg-surface-dim text-muted border-2 border-border ring-4 ring-surface'
                              }`}
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : isFailed ? (
                                <AlertCircle className="w-4 h-4" />
                              ) : isActive ? (
                                <Clock className="w-4 h-4" />
                              ) : (
                                idx + 1
                              )}
                            </div>

                            <p
                              className={`text-xs font-bold leading-snug ${
                                isActive
                                  ? 'text-accent'
                                  : isDone
                                    ? 'text-primary'
                                    : isFailed
                                      ? 'text-rose-600'
                                      : 'text-muted'
                              }`}
                            >
                              {stage.label}
                            </p>
                            <p className="text-[11px] text-muted mt-1 leading-tight line-clamp-2 px-1">
                              {stage.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mobile / Small Tablet Vertical Stepper (< md) */}
                  <div className="md:hidden relative pl-6 space-y-5 before:content-[''] before:absolute before:left-[15px] before:top-4 before:bottom-4 before:w-0.5 before:bg-border">
                    {stepperStages.map((stage, idx) => {
                      const isDone = stage.status === 'completed';
                      const isActive = stage.status === 'active';
                      const isFailed = stage.status === 'failed';

                      return (
                        <div key={stage.id} className="relative flex items-start gap-3">
                          <div
                            className={`absolute -left-6 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              isDone
                                ? 'bg-emerald-600 text-white'
                                : isActive
                                  ? 'bg-accent text-white ring-4 ring-accent/20'
                                  : isFailed
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-surface-dim text-muted border border-border'
                            }`}
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : isFailed ? (
                              <AlertCircle className="w-4 h-4" />
                            ) : isActive ? (
                              <Clock className="w-4 h-4" />
                            ) : (
                              idx + 1
                            )}
                          </div>
                          <div className="pl-4 pt-1">
                            <p
                              className={`text-xs font-bold ${
                                isActive
                                  ? 'text-accent'
                                  : isDone
                                    ? 'text-primary'
                                    : isFailed
                                      ? 'text-rose-600'
                                      : 'text-muted'
                              }`}
                            >
                              {stage.label}
                            </p>
                            <p className="text-[11px] text-muted mt-0.5">{stage.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Courier & Live AWB Card */}
                {searchedOrder.trackingNumber && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-surface-dim/80 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="p-3 rounded-2xl bg-accent/10 text-accent shrink-0">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xs sm:text-sm font-bold text-primary">
                          Consignment Shipped via {searchedOrder.courierName || 'Designated Courier'}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-muted">Air Waybill (AWB):</span>
                          <strong className="font-mono text-primary bg-surface px-2 py-0.5 rounded border border-border">
                            {searchedOrder.trackingNumber}
                          </strong>
                          <button
                            type="button"
                            onClick={() => handleCopy(searchedOrder.trackingNumber!, 'awb')}
                            title="Copy AWB Number"
                            className="p-1 rounded text-muted hover:text-primary hover:bg-surface"
                          >
                            {copiedKey === 'awb' ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        {searchedOrder.estimatedDeliveryDate && (
                          <p className="text-[11px] text-muted">
                            Estimated Delivery:{' '}
                            <strong className="text-primary">
                              {new Date(searchedOrder.estimatedDeliveryDate).toLocaleDateString('en-IN', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </strong>
                          </p>
                        )}
                      </div>
                    </div>

                    {trackingUrl && (
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl transition-colors shrink-0 shadow-sm"
                      >
                        <span>Track on Courier Portal</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                )}

                {/* Chronological Milestone Timeline */}
                {searchedOrder.timeline && searchedOrder.timeline.length > 0 && (
                  <div className="pt-2">
                    <h3 className="text-[11px] font-bold text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-accent" />
                      <span>Chronological Journey & Checkpoints</span>
                    </h3>

                    <div className="relative pl-6 space-y-3.5 before:content-[''] before:absolute before:left-[9px] before:top-3 before:bottom-3 before:w-0.5 before:bg-border">
                      {searchedOrder.timeline
                        .filter((ev) => ev.isCustomerVisible !== false)
                        .map((ev, i, arr) => {
                          const isLatest = i === arr.length - 1;
                          return (
                            <div key={ev.id || i} className="relative">
                              <div
                                className={`absolute -left-6 top-3 w-3 h-3 rounded-full ring-4 ring-surface ${
                                  isLatest ? 'bg-accent' : 'bg-emerald-500'
                                }`}
                              />

                              <div
                                className={`rounded-2xl p-3.5 sm:p-4 border transition-colors ${
                                  isLatest
                                    ? 'bg-surface-dim/70 border-accent/30'
                                    : 'bg-surface-dim/40 border-border/70'
                                }`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-primary">{ev.title}</span>
                                  <span className="text-[11px] text-muted font-mono">
                                    {new Date(ev.timestamp).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                <p className="text-xs text-muted mt-1 leading-relaxed">
                                  {ev.description}
                                </p>
                                {ev.location && (
                                  <div className="flex items-center gap-1.5 text-[11px] text-muted mt-2">
                                    <MapPin className="w-3 h-3 text-accent shrink-0" />
                                    <span>{ev.location}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Private Customer Section — Strictly Gated by Server-Verified Order Ownership */}
              {authorizedOrder ? (
                <div
                  data-testid="private-order-details"
                  className="px-5 sm:px-7 pb-7 pt-6 border-t border-border bg-surface-dim/25 grid grid-cols-1 lg:grid-cols-2 gap-6"
                >
                  {/* Items in Consignment */}
                  <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <h3 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                        <Package className="w-4 h-4 text-accent" />
                        <span>Items in Consignment</span>
                      </h3>
                      <span className="text-[11px] font-semibold text-muted">
                        {authorizedOrder.items.reduce((sum, item) => sum + item.quantity, 0)} item(s)
                      </span>
                    </div>

                    <div className="divide-y divide-border/60">
                      {authorizedOrder.items.map((item, idx) => (
                        <div key={item.id || idx} className="py-3 first:pt-0 flex justify-between items-start gap-3 text-xs">
                          <div className="min-w-0">
                            <p className="font-semibold text-primary leading-snug">{item.productTitle}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted">
                              <span>
                                {item.variantTitle} × {item.quantity}
                              </span>
                              {item.sku && (
                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-dim border border-border">
                                  {item.sku}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="font-bold text-primary shrink-0">
                            {formatPaiseToRupees(item.totalInPaise)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 border-t border-border space-y-2 text-xs">
                      <div className="flex justify-between text-muted">
                        <span>Subtotal</span>
                        <span className="font-medium text-primary">
                          {formatPaiseToRupees(authorizedOrder.subtotalInPaise)}
                        </span>
                      </div>
                      {authorizedOrder.discountInPaise > 0 && (
                        <div className="flex justify-between text-emerald-700 font-medium">
                          <span>
                            Discount {authorizedOrder.couponCode ? `(${authorizedOrder.couponCode})` : ''}
                          </span>
                          <span>-{formatPaiseToRupees(authorizedOrder.discountInPaise)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-muted">
                        <span>Shipping</span>
                        <span className="font-medium text-primary">
                          {authorizedOrder.shippingInPaise === 0
                            ? 'FREE'
                            : formatPaiseToRupees(authorizedOrder.shippingInPaise)}
                        </span>
                      </div>

                      <div className="pt-3 mt-1 border-t border-border flex justify-between items-center">
                        <div>
                          <span className="font-bold text-primary block">
                            {authorizedOrder.paymentStatus === 'PAID'
                              ? `Total Paid (${authorizedOrder.paymentMethod})`
                              : authorizedOrder.paymentMethod === 'COD'
                                ? 'Payable on Delivery (COD)'
                                : `Total Payable (${authorizedOrder.paymentMethod})`}
                          </span>
                          <span
                            className={`text-[11px] font-semibold ${
                              authorizedOrder.paymentStatus === 'PAID'
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {authorizedOrder.paymentStatus === 'PAID'
                              ? 'Payment Verified'
                              : 'Payment Pending'}
                          </span>
                        </div>
                        <span className="text-accent text-base font-display font-bold">
                          {formatPaiseToRupees(authorizedOrder.totalInPaise)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Destination */}
                  <div className="bg-surface rounded-2xl border border-border p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-border pb-3">
                        <h3 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-accent" />
                          <span>Delivery Destination</span>
                        </h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-surface-dim text-muted">
                          {authorizedOrder.shippingAddress.country || 'India'}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-muted leading-relaxed">
                        <p className="text-sm font-bold text-primary">
                          {authorizedOrder.shippingAddress.fullName}
                        </p>
                        <p>{authorizedOrder.shippingAddress.addressLine1}</p>
                        {authorizedOrder.shippingAddress.addressLine2 && (
                          <p>{authorizedOrder.shippingAddress.addressLine2}</p>
                        )}
                        <p className="text-primary font-medium">
                          {authorizedOrder.shippingAddress.city}, {authorizedOrder.shippingAddress.state} —{' '}
                          <span className="font-mono font-bold">
                            {authorizedOrder.shippingAddress.postalCode}
                          </span>
                        </p>
                      </div>

                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-dim border border-border text-xs text-primary font-medium">
                        <Phone className="w-3.5 h-3.5 text-accent" />
                        <span>{authorizedOrder.shippingAddress.phone}</span>
                      </div>

                      {authorizedOrder.customerNotes && (
                        <div className="p-3 rounded-xl bg-surface-dim/70 border border-border text-[11px] space-y-1">
                          <span className="font-bold text-primary flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-accent" />
                            <span>Delivery Instructions</span>
                          </span>
                          <p className="text-muted">{authorizedOrder.customerNotes}</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="text-muted flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Verified for your account</span>
                      </span>
                      <Link
                        href="/account/orders"
                        className="font-semibold text-accent hover:underline"
                      >
                        Manage in Order History →
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                /* Privacy & Login Warning Card for Unauthenticated or Wrong-Account Users */
                <div
                  data-testid="order-privacy-warning"
                  className="px-5 sm:px-7 pb-7 pt-6 border-t border-border bg-surface-dim/35"
                >
                  <div className="rounded-2xl border border-amber-300/80 bg-gradient-to-br from-amber-50/90 via-surface to-surface p-5 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-sm sm:text-base font-bold text-primary">
                            {privacyMeta?.accessState === 'WRONG_ACCOUNT'
                              ? 'Protected Consignment — Different Account Signed In'
                              : 'Protected Customer Order Details'}
                          </h3>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                            Privacy Lock Active
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm text-muted leading-relaxed max-w-2xl">
                          {privacyMeta?.accessState === 'WRONG_ACCOUNT'
                            ? 'This order is associated with a different account. Please log in using the account you used to place this order to view the consignment items and delivery destination.'
                            : 'Your order details are private and can only be accessed through the account used to place the order. Please log in to view your items and delivery destination.'}
                        </p>

                        <p className="text-[11px] text-muted">
                          Hidden for security: <strong className="text-primary">Items in Consignment</strong> &{' '}
                          <strong className="text-primary">Delivery Destination</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      {privacyMeta?.accessState === 'WRONG_ACCOUNT' ? (
                        <button
                          type="button"
                          disabled={isSwitchingAccount}
                          onClick={() => handleSwitchAccountLogin(searchedOrder.orderNumber)}
                          data-testid="track-order-switch-login-btn"
                          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl uppercase tracking-wider shadow-sm transition-colors disabled:opacity-60"
                        >
                          <LogIn className="w-4 h-4" />
                          <span>
                            {isSwitchingAccount ? 'Redirecting...' : 'Switch Account & Log In'}
                          </span>
                        </button>
                      ) : (
                        <Link
                          href={loginRedirectUrl}
                          data-testid="track-order-login-btn"
                          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl uppercase tracking-wider shadow-sm transition-colors"
                        >
                          <LogIn className="w-4 h-4" />
                          <span>Log In to View Details</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-xs text-muted">
          Loading consignment tracker...
        </div>
      }
    >
      <TrackOrderContent />
    </Suspense>
  );
}
