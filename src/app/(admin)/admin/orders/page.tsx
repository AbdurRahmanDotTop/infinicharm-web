'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import { logAdminAction } from '@/lib/services/audit';
import {
  ShoppingBag,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Truck,
  MapPin,
  Calendar,
  AlertCircle,
  ExternalLink,
  Printer,
  X,
  FileText,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  Building,
  RefreshCw,
  PlusCircle,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { Order, OrderStatus, PaymentStatus } from '@/types';
import {
  SUPPORTED_COURIERS,
  ORDER_STATUS_LABELS,
  isValidOrderTransition,
  getCourierTrackingUrl,
} from '@/lib/services/orders';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modals
  const [reviewUtrOrder, setReviewUtrOrder] = useState<Order | null>(null);
  const [logisticsOrder, setLogisticsOrder] = useState<Order | null>(null);
  const [inspectorOrder, setInspectorOrder] = useState<Order | null>(null);

  // Logistics form state
  const [logisticsCourier, setLogisticsCourier] = useState('Delhivery Surface / Express');
  const [logisticsAwb, setLogisticsAwb] = useState('');
  const [logisticsEdd, setLogisticsEdd] = useState('');
  const [logisticsNotes, setLogisticsNotes] = useState('');

  // Rejection reason state
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Timeline note state
  const [newTimelineTitle, setNewTimelineTitle] = useState('');
  const [newTimelineDesc, setNewTimelineDesc] = useState('');
  const [newTimelineLocation, setNewTimelineLocation] = useState('East Champaran Operations');

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Fetch orders from server API with localStorage fallback
  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/orders', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          setOrders(data.orders);
          // Sync to localStorage
          try {
            localStorage.setItem('infinicharm_orders', JSON.stringify(data.orders));
          } catch {}
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Server orders fetch error, checking localStorage:', err);
    }

    // Fallback to localStorage
    try {
      const stored = localStorage.getItem('infinicharm_orders');
      if (stored) {
        setOrders(JSON.parse(stored));
      } else {
        setOrders([]);
      }
    } catch {
      setOrders([]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();

    const handleSync = () => fetchOrders();
    window.addEventListener('infinicharm_orders_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('infinicharm_orders_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [fetchOrders]);

  // Update Status Action
  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    const targetOrder = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (!targetOrder) return;

    if (!isValidOrderTransition(targetOrder.status, newStatus)) {
      alert(`Invalid Transition: Orders cannot be moved directly from ${targetOrder.status} to ${newStatus}.`);
      return;
    }

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_STATUS',
          status: newStatus,
          actor: 'Operations Admin',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          const updated = orders.map((o) => (o.id === orderId || o.orderNumber === orderId ? data.order : o));
          setOrders(updated);
          localStorage.setItem('infinicharm_orders', JSON.stringify(updated));
          window.dispatchEvent(new Event('infinicharm_orders_updated'));
          if (inspectorOrder && (inspectorOrder.id === orderId || inspectorOrder.orderNumber === orderId)) {
            setInspectorOrder(data.order);
          }
          logAdminAction('UPDATE_ORDER_STATUS', 'orders', orderId, {
            previousStatus: targetOrder.status,
            newStatus,
          });
          return;
        }
      }
    } catch (err) {
      console.error('Failed to update status on server:', err);
    }

    // Optimistic fallback
    const updated = orders.map((o) =>
      o.id === orderId || o.orderNumber === orderId ? { ...o, status: newStatus } : o
    );
    setOrders(updated);
    localStorage.setItem('infinicharm_orders', JSON.stringify(updated));
    window.dispatchEvent(new Event('infinicharm_orders_updated'));
  };

  // Approve Custom UPI Payment
  const handleApproveUtr = async (order: Order) => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.orderNumber)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APPROVE_UTR',
          adminName: 'Finance Admin',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          const updated = orders.map((o) =>
            o.id === order.id || o.orderNumber === order.orderNumber ? data.order : o
          );
          setOrders(updated);
          localStorage.setItem('infinicharm_orders', JSON.stringify(updated));
          window.dispatchEvent(new Event('infinicharm_orders_updated'));
          setReviewUtrOrder(null);
          logAdminAction('APPROVE_UPI_PAYMENT', 'payments', order.orderNumber, {
            utrNumber: order.utrNumber,
            amountInPaise: order.totalInPaise,
          });
          return;
        }
      }
    } catch (err) {
      console.error('Failed to approve UTR:', err);
    }
  };

  // Reject Custom UPI Payment
  const handleRejectUtr = async (order: Order) => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejecting this payment.');
      return;
    }

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.orderNumber)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REJECT_UTR',
          reason: rejectReason.trim(),
          adminName: 'Finance Admin',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          const updated = orders.map((o) =>
            o.id === order.id || o.orderNumber === order.orderNumber ? data.order : o
          );
          setOrders(updated);
          localStorage.setItem('infinicharm_orders', JSON.stringify(updated));
          window.dispatchEvent(new Event('infinicharm_orders_updated'));
          setReviewUtrOrder(null);
          setShowRejectInput(false);
          setRejectReason('');
          logAdminAction('REJECT_UPI_PAYMENT', 'payments', order.orderNumber, {
            utrNumber: order.utrNumber,
            reason: rejectReason.trim(),
          });
          return;
        }
      }
    } catch (err) {
      console.error('Failed to reject UTR:', err);
    }
  };

  // Save Logistics & Tracking Info
  const handleSaveLogistics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logisticsOrder || !logisticsCourier || !logisticsAwb.trim()) {
      alert('Please select a courier and enter the AWB tracking number.');
      return;
    }

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(logisticsOrder.orderNumber)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_TRACKING',
          courierName: logisticsCourier,
          trackingNumber: logisticsAwb.trim(),
          estimatedDeliveryDate: logisticsEdd || undefined,
          checkpointNotes: logisticsNotes.trim() || undefined,
          actor: 'Logistics Desk',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          const updated = orders.map((o) =>
            o.id === logisticsOrder.id || o.orderNumber === logisticsOrder.orderNumber ? data.order : o
          );
          setOrders(updated);
          localStorage.setItem('infinicharm_orders', JSON.stringify(updated));
          window.dispatchEvent(new Event('infinicharm_orders_updated'));
          setLogisticsOrder(null);
          logAdminAction('ASSIGN_COURIER_TRACKING', 'orders', logisticsOrder.orderNumber, {
            courierName: logisticsCourier,
            trackingNumber: logisticsAwb.trim(),
          });
          return;
        }
      }
    } catch (err) {
      console.error('Failed to update tracking:', err);
    }
  };

  // Add Custom Timeline Event
  const handleAddTimelineNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectorOrder || !newTimelineTitle.trim() || !newTimelineDesc.trim()) return;

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(inspectorOrder.orderNumber)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_TIMELINE_EVENT',
          title: newTimelineTitle.trim(),
          description: newTimelineDesc.trim(),
          location: newTimelineLocation.trim(),
          actor: 'Operations Desk',
          status: inspectorOrder.status,
          type: 'LOGISTICS',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          const updated = orders.map((o) =>
            o.id === inspectorOrder.id || o.orderNumber === inspectorOrder.orderNumber ? data.order : o
          );
          setOrders(updated);
          setInspectorOrder(data.order);
          localStorage.setItem('infinicharm_orders', JSON.stringify(updated));
          window.dispatchEvent(new Event('infinicharm_orders_updated'));
          setNewTimelineTitle('');
          setNewTimelineDesc('');
        }
      }
    } catch (err) {
      console.error('Failed to add timeline event:', err);
    }
  };

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    const matchesPayment =
      paymentFilter === 'ALL' ||
      (paymentFilter === 'PENDING' && o.paymentStatus === 'PENDING') ||
      (paymentFilter === 'PAID' && o.paymentStatus === 'PAID') ||
      (paymentFilter === 'FAILED' && o.paymentStatus === 'FAILED') ||
      (paymentFilter === 'REVIEW' && o.manualApprovalStatus === 'PENDING_REVIEW');

    const cleanQ = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !cleanQ ||
      o.orderNumber.toLowerCase().includes(cleanQ) ||
      o.customerPhone.includes(cleanQ) ||
      (o.utrNumber && o.utrNumber.toLowerCase().includes(cleanQ)) ||
      o.shippingAddress.fullName.toLowerCase().includes(cleanQ);

    return matchesStatus && matchesPayment && matchesQuery;
  });

  const pendingUtrCount = orders.filter(
    (o) => o.paymentMethod === 'CUSTOM_UPI' && o.manualApprovalStatus === 'PENDING_REVIEW'
  ).length;

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <AdminHeader />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Header & Stats Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-primary tracking-tight">
              Order Fulfillment & Shipments
            </h1>
            <p className="text-xs text-muted mt-1">
              Verify UPI payments, manage fulfillment state machines, assign courier AWB tracking, and print tax invoices.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {pendingUtrCount > 0 && (
              <button
                onClick={() => {
                  setPaymentFilter('REVIEW');
                  setStatusFilter('ALL');
                }}
                className="text-xs font-bold bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-200 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 animate-pulse"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>{pendingUtrCount} UTR Reviews Pending</span>
              </button>
            )}

            <span className="text-xs font-bold bg-surface-dim border border-border px-3.5 py-1.5 rounded-xl text-primary">
              {orders.length} Consignments Recorded
            </span>

            <button
              onClick={() => fetchOrders()}
              className="p-2 text-muted hover:text-primary rounded-xl hover:bg-surface border border-border"
              title="Refresh Orders"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order ID, customer name, phone, or 12-digit UTR..."
              className="w-full text-xs pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
            />
          </div>

          {/* Fulfillment Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3.5 py-2.5 bg-surface border border-border rounded-xl text-primary focus:outline-none focus:border-accent font-medium"
          >
            <option value="ALL">All Order States</option>
            <option value="PENDING">PENDING</option>
            <option value="PAYMENT_RECEIVED">PAYMENT_RECEIVED</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="PACKED">PACKED</option>
            <option value="READY_FOR_DISPATCH">READY_FOR_DISPATCH</option>
            <option value="SHIPPED">SHIPPED</option>
            <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="RETURNED">RETURNED</option>
          </select>

          {/* Payment Status Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="text-xs px-3.5 py-2.5 bg-surface border border-border rounded-xl text-primary focus:outline-none focus:border-accent font-medium"
          >
            <option value="ALL">All Payment States</option>
            <option value="REVIEW">Needs UTR Review</option>
            <option value="PENDING">Payment Pending</option>
            <option value="PAID">Paid / Verified</option>
            <option value="FAILED">Payment Failed</option>
          </select>
        </div>

        {/* Orders Table */}
        {filteredOrders.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
            <div className="w-14 h-14 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-lg font-bold text-primary">
                {orders.length === 0
                  ? 'No Customer Orders Recorded Yet'
                  : 'No Consignments Match Your Filters'}
              </h3>
              <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
                {orders.length === 0
                  ? 'Genuine customer orders placed via the storefront checkout appear here immediately with server authority.'
                  : 'Try selecting a different filter or clearing search keywords.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mobile & Tablet Order Fulfillment Cards (< lg) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:hidden">
              {filteredOrders.map((ord) => {
                const statusMeta = ORDER_STATUS_LABELS[ord.status];
                const isCustomUpi = ord.paymentMethod === 'CUSTOM_UPI';
                const needsReview = isCustomUpi && ord.manualApprovalStatus === 'PENDING_REVIEW';

                return (
                  <div
                    key={ord.id}
                    className="bg-surface rounded-2xl border border-border p-4 shadow-sm space-y-3 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <button
                          onClick={() => setInspectorOrder(ord)}
                          className="font-mono font-bold text-sm text-primary hover:text-accent flex items-center gap-1.5 text-left"
                        >
                          <span>{ord.orderNumber}</span>
                          <Eye className="w-3.5 h-3.5 text-muted" />
                        </button>
                        <span className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-accent" />
                          {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-accent text-sm block">
                          {formatPaiseToRupees(ord.totalInPaise)}
                        </span>
                        <span className="text-[10px] text-muted">
                          {ord.items.length} {ord.items.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-surface-dim/60 border border-border/60 space-y-0.5">
                      <span className="font-bold text-primary block">{ord.shippingAddress.fullName}</span>
                      <span className="text-[11px] text-muted block break-words">
                        {ord.shippingAddress.city}, {ord.shippingAddress.state} • {ord.shippingAddress.phone}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-primary">{ord.paymentMethod}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            ord.paymentStatus === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ord.paymentStatus === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {ord.paymentStatus}
                        </span>
                      </div>

                      {ord.utrNumber && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-mono bg-surface-dim border border-border px-1.5 py-0.5 rounded text-primary">
                            UTR: {ord.utrNumber}
                          </span>
                          <button
                            onClick={() => handleCopy(ord.utrNumber!, `utr-m-${ord.id}`)}
                            className="p-1 text-muted hover:text-primary rounded"
                            title="Copy UTR"
                          >
                            {copiedKey === `utr-m-${ord.id}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {needsReview && (
                      <button
                        onClick={() => {
                          setReviewUtrOrder(ord);
                          setShowRejectInput(false);
                          setRejectReason('');
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-xl shadow-sm transition-colors"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Review UTR Payment Proof</span>
                      </button>
                    )}

                    <div className="pt-2 border-t border-border/60 space-y-2">
                      <select
                        value={ord.status}
                        onChange={(e) => handleUpdateStatus(ord.id, e.target.value as OrderStatus)}
                        className={`w-full text-xs px-3 py-2 rounded-xl border font-bold uppercase tracking-wider ${
                          statusMeta?.badgeClass || 'bg-surface text-primary border-border'
                        }`}
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="PAYMENT_RECEIVED">PAYMENT_RECEIVED</option>
                        <option value="CONFIRMED">CONFIRMED</option>
                        <option value="PROCESSING">PROCESSING</option>
                        <option value="PACKED">PACKED</option>
                        <option value="READY_FOR_DISPATCH">READY_FOR_DISPATCH</option>
                        <option value="SHIPPED">SHIPPED</option>
                        <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                        <option value="DELIVERED">DELIVERED</option>
                        <option value="DELIVERY_ATTEMPTED">DELIVERY_ATTEMPTED</option>
                        <option value="RTO_INITIATED">RTO_INITIATED</option>
                        <option value="RTO_DELIVERED">RTO_DELIVERED</option>
                        <option value="CANCELLED">CANCELLED</option>
                        <option value="RETURN_REQUESTED">RETURN_REQUESTED</option>
                        <option value="RETURN_APPROVED">RETURN_APPROVED</option>
                        <option value="RETURNED">RETURNED</option>
                        <option value="REFUNDED">REFUNDED</option>
                      </select>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {ord.trackingNumber ? (
                          <button
                            onClick={() => {
                              setLogisticsOrder(ord);
                              setLogisticsCourier(ord.courierName || 'Delhivery Surface / Express');
                              setLogisticsAwb(ord.trackingNumber || '');
                              setLogisticsEdd(ord.estimatedDeliveryDate ? ord.estimatedDeliveryDate.slice(0, 10) : '');
                            }}
                            className="text-left hover:opacity-80"
                          >
                            <span className="font-semibold text-primary block text-[11px]">{ord.courierName}</span>
                            <span className="font-mono text-[10px] text-accent block">{ord.trackingNumber}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setLogisticsOrder(ord);
                              setLogisticsCourier('Delhivery Surface / Express');
                              setLogisticsAwb(`DLV${Math.floor(10000000000 + Math.random() * 90000000000)}`);
                              setLogisticsEdd('');
                            }}
                            className="px-2.5 py-1.5 bg-surface-dim hover:bg-border text-primary rounded-lg text-xs font-semibold border border-border"
                          >
                            + Assign AWB
                          </button>
                        )}

                        <div className="flex items-center gap-1.5 ml-auto">
                          {ord.trackingNumber && (
                            <a
                              href={getCourierTrackingUrl(ord.courierName, ord.trackingNumber) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-surface-dim hover:bg-border rounded-lg text-primary"
                              title="Open Live Courier Portal"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => {
                              setSelectedOrder(ord);
                              setShowInvoiceModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-surface-dim hover:bg-border rounded-lg text-primary font-semibold border border-border"
                            title="Generate GST Tax Invoice"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Invoice</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Order Fulfillment Table (lg+) */}
            <div className="hidden lg:block bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border bg-surface-dim/40 text-muted uppercase text-[10px] tracking-wider">
                    <th className="py-3.5 px-4">Order Reference</th>
                    <th className="py-3.5 px-4">Customer Details</th>
                    <th className="py-3.5 px-4">Items / Total</th>
                    <th className="py-3.5 px-4">Payment Method & UTR</th>
                    <th className="py-3.5 px-4">Status & Action</th>
                    <th className="py-3.5 px-4 text-right">Logistics & Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredOrders.map((ord) => {
                    const statusMeta = ORDER_STATUS_LABELS[ord.status];
                    const isCustomUpi = ord.paymentMethod === 'CUSTOM_UPI';
                    const needsReview = isCustomUpi && ord.manualApprovalStatus === 'PENDING_REVIEW';

                    return (
                      <tr key={ord.id} className="hover:bg-surface-dim/30 transition-colors">
                        {/* Reference */}
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => setInspectorOrder(ord)}
                            className="font-mono font-bold text-primary hover:text-accent transition-colors flex items-center gap-1.5 text-left"
                            title="Inspect Order Journey"
                          >
                            <span>{ord.orderNumber}</span>
                            <Eye className="w-3.5 h-3.5 text-muted hover:text-accent" />
                          </button>
                          <span className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-accent" />
                            {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-primary block">
                            {ord.shippingAddress.fullName}
                          </span>
                          <span className="text-[11px] text-muted">
                            {ord.shippingAddress.city}, {ord.shippingAddress.state} ({ord.shippingAddress.phone})
                          </span>
                        </td>

                        {/* Items / Total */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-accent block">
                            {formatPaiseToRupees(ord.totalInPaise)}
                          </span>
                          <span className="text-[10px] text-muted">
                            {ord.items.length} {ord.items.length === 1 ? 'item' : 'items'}
                          </span>
                        </td>

                        {/* Payment & UTR Review */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-primary">{ord.paymentMethod}</span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                ord.paymentStatus === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : ord.paymentStatus === 'PENDING'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                              }`}
                            >
                              {ord.paymentStatus}
                            </span>
                          </div>

                          {/* UTR chip & Review trigger */}
                          {ord.utrNumber && (
                            <div className="mt-1.5 space-y-1">
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-mono bg-surface-dim border border-border px-1.5 py-0.5 rounded text-primary">
                                  UTR: {ord.utrNumber}
                                </span>
                                <button
                                  onClick={() => handleCopy(ord.utrNumber!, `utr-${ord.id}`)}
                                  className="p-0.5 text-muted hover:text-primary rounded"
                                  title="Copy UTR"
                                >
                                  {copiedKey === `utr-${ord.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>

                              {needsReview ? (
                                <button
                                  onClick={() => {
                                    setReviewUtrOrder(ord);
                                    setShowRejectInput(false);
                                    setRejectReason('');
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded shadow-sm transition-colors"
                                >
                                  <Clock className="w-3 h-3" />
                                  <span>Review UTR</span>
                                </button>
                              ) : ord.manualApprovalStatus === 'APPROVED' ? (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-400">
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>UTR Reconciled</span>
                                </span>
                              ) : ord.manualApprovalStatus === 'REJECTED' ? (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-700 dark:text-rose-400">
                                  <ShieldAlert className="w-3 h-3" />
                                  <span>UTR Rejected</span>
                                </span>
                              ) : null}
                            </div>
                          )}
                        </td>

                        {/* Status Dropdown */}
                        <td className="py-3.5 px-4">
                          <select
                            value={ord.status}
                            onChange={(e) =>
                              handleUpdateStatus(ord.id, e.target.value as OrderStatus)
                            }
                            className={`text-xs px-2.5 py-1.5 rounded-lg border font-bold uppercase tracking-wider ${
                              statusMeta?.badgeClass || 'bg-surface text-primary border-border'
                            }`}
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="PAYMENT_RECEIVED">PAYMENT_RECEIVED</option>
                            <option value="CONFIRMED">CONFIRMED</option>
                            <option value="PROCESSING">PROCESSING</option>
                            <option value="PACKED">PACKED</option>
                            <option value="READY_FOR_DISPATCH">READY_FOR_DISPATCH</option>
                            <option value="SHIPPED">SHIPPED</option>
                            <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                            <option value="DELIVERED">DELIVERED</option>
                            <option value="DELIVERY_ATTEMPTED">DELIVERY_ATTEMPTED</option>
                            <option value="RTO_INITIATED">RTO_INITIATED</option>
                            <option value="RTO_DELIVERED">RTO_DELIVERED</option>
                            <option value="CANCELLED">CANCELLED</option>
                            <option value="RETURN_REQUESTED">RETURN_REQUESTED</option>
                            <option value="RETURN_APPROVED">RETURN_APPROVED</option>
                            <option value="RETURNED">RETURNED</option>
                            <option value="REFUNDED">REFUNDED</option>
                          </select>
                        </td>

                        {/* Logistics & Invoice Action */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {ord.trackingNumber ? (
                              <button
                                onClick={() => {
                                  setLogisticsOrder(ord);
                                  setLogisticsCourier(ord.courierName || 'Delhivery Surface / Express');
                                  setLogisticsAwb(ord.trackingNumber || '');
                                  setLogisticsEdd(ord.estimatedDeliveryDate ? ord.estimatedDeliveryDate.slice(0, 10) : '');
                                }}
                                className="text-right hover:opacity-80 transition-opacity"
                                title="Edit Tracking Details"
                              >
                                <span className="font-semibold text-primary block text-[11px]">
                                  {ord.courierName}
                                </span>
                                <span className="font-mono text-[10px] text-accent block">
                                  {ord.trackingNumber}
                                </span>
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setLogisticsOrder(ord);
                                  setLogisticsCourier('Delhivery Surface / Express');
                                  setLogisticsAwb(`DLV${Math.floor(10000000000 + Math.random() * 90000000000)}`);
                                  setLogisticsEdd('');
                                }}
                                className="px-2.5 py-1 bg-surface-dim hover:bg-border text-primary rounded-lg text-xs font-semibold border border-border"
                              >
                                + Assign AWB
                              </button>
                            )}

                            {ord.trackingNumber && (
                              <a
                                href={getCourierTrackingUrl(ord.courierName, ord.trackingNumber) || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 hover:bg-surface-dim rounded-lg text-muted hover:text-accent transition-colors"
                                title="Open Live Courier Portal"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}

                            <button
                              onClick={() => {
                                setSelectedOrder(ord);
                                setShowInvoiceModal(true);
                              }}
                              className="p-1.5 hover:bg-surface-dim rounded-lg text-muted hover:text-primary transition-colors"
                              title="Generate GST Tax Invoice"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        )}

        {/* UTR REVIEW & RECONCILIATION MODAL */}
        {reviewUtrOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-primary">
                      Reconcile UPI Payment UTR
                    </h3>
                    <p className="text-xs text-muted">
                      Order Reference: <strong>{reviewUtrOrder.orderNumber}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setReviewUtrOrder(null)}
                  className="p-1 text-muted hover:text-primary rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Bank Reconciliation Card */}
              <div className="p-4 rounded-xl bg-surface-dim border border-border text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Total Payable Amount:</span>
                  <span className="font-display font-bold text-base text-accent">
                    {formatPaiseToRupees(reviewUtrOrder.totalInPaise)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-2">
                  <span className="text-muted">Customer Submitted UTR:</span>
                  <div className="flex items-center gap-2">
                    <strong className="font-mono text-xs bg-surface px-2 py-0.5 rounded border border-border text-primary">
                      {reviewUtrOrder.utrNumber || 'N/A'}
                    </strong>
                    {reviewUtrOrder.utrNumber && (
                      <button
                        onClick={() => handleCopy(reviewUtrOrder.utrNumber!, 'modal-utr')}
                        className="p-1 rounded text-muted hover:text-primary"
                        title="Copy UTR"
                      >
                        {copiedKey === 'modal-utr' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="border-t border-border/60 pt-2 space-y-1">
                  <span className="font-semibold text-primary block">Merchant IndusInd Bank Statement to Check:</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted bg-surface p-2.5 rounded-lg border border-border/60">
                    <div>
                      <span>Account Number:</span>
                      <strong className="block text-primary font-mono">258825164657</strong>
                    </div>
                    <div>
                      <span>IFSC Code:</span>
                      <strong className="block text-primary font-mono">INDB0001548</strong>
                    </div>
                    <div>
                      <span>VPA:</span>
                      <strong className="block text-primary">AbdurRahmanIndusIndCurrent@ybl</strong>
                    </div>
                    <div>
                      <span>Account Holder:</span>
                      <strong className="block text-primary">TechilyFly - InfiniCharm</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reject Reason input if active */}
              {showRejectInput && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs space-y-2 dark:bg-rose-950/40 dark:border-rose-800">
                  <label className="font-bold text-rose-900 dark:text-rose-200 block">
                    Reason for Rejecting Payment:
                  </label>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. UTR not found on IndusInd Bank statement, amount mismatch..."
                    className="w-full text-xs px-3 py-2 bg-surface border border-rose-300 rounded-lg text-primary focus:outline-none"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                {!showRejectInput ? (
                  <button
                    onClick={() => setShowRejectInput(true)}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-colors"
                  >
                    Reject Payment...
                  </button>
                ) : (
                  <button
                    onClick={() => handleRejectUtr(reviewUtrOrder)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    Confirm Rejection & Cancel
                  </button>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setReviewUtrOrder(null)}
                    className="px-4 py-2 bg-surface border border-border text-xs font-bold text-muted hover:text-primary rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleApproveUtr(reviewUtrOrder)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Payment & Confirm Order</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LOGISTICS & COURIER ASSIGNMENT MODAL */}
        {logisticsOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-accent/15 text-accent">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-primary">
                      Logistics & Shipment Details
                    </h3>
                    <p className="text-xs text-muted">
                      Consignment: <strong>{logisticsOrder.orderNumber}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setLogisticsOrder(null)}
                  className="p-1 text-muted hover:text-primary rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveLogistics} className="space-y-4 text-xs">
                {/* Courier Selection */}
                <div>
                  <label className="font-semibold text-primary block mb-1.5">
                    Courier Partner
                  </label>
                  <select
                    value={logisticsCourier}
                    onChange={(e) => setLogisticsCourier(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-medium focus:outline-none focus:border-accent"
                  >
                    {SUPPORTED_COURIERS.map((c) => (
                      <option key={c.shortCode} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    <option value="Self-Operated Regional Fleet">Self-Operated Regional Fleet</option>
                  </select>
                </div>

                {/* AWB Tracking Number */}
                <div>
                  <label className="font-semibold text-primary block mb-1.5">
                    Air Waybill (AWB) Tracking Number
                  </label>
                  <input
                    type="text"
                    value={logisticsAwb}
                    onChange={(e) => setLogisticsAwb(e.target.value)}
                    placeholder="e.g. DLV21693550161, 89312019"
                    required
                    className="w-full text-xs px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                  />
                  {logisticsCourier && logisticsAwb && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
                      <ExternalLink className="w-3 h-3 text-accent" />
                      <span className="truncate">
                        Preview:{' '}
                        <code>{getCourierTrackingUrl(logisticsCourier, logisticsAwb)}</code>
                      </span>
                    </div>
                  )}
                </div>

                {/* Estimated Delivery Date */}
                <div>
                  <label className="font-semibold text-primary block mb-1.5">
                    Estimated Delivery Date (EDD)
                  </label>
                  <input
                    type="date"
                    value={logisticsEdd}
                    onChange={(e) => setLogisticsEdd(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Dispatch / Checkpoint Notes */}
                <div>
                  <label className="font-semibold text-primary block mb-1.5">
                    Operational Dispatch Notes (Optional)
                  </label>
                  <textarea
                    value={logisticsNotes}
                    onChange={(e) => setLogisticsNotes(e.target.value)}
                    rows={2}
                    placeholder="e.g. Handed over to Patna sorting facility, bag seal #91823"
                    className="w-full text-xs p-3 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setLogisticsOrder(null)}
                    className="px-4 py-2 bg-surface border border-border text-xs font-bold text-muted hover:text-primary rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                  >
                    Save & Mark In Transit
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ORDER INSPECTOR & TIMELINE DRAWER */}
        {inspectorOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-end">
            <div className="bg-surface border-l border-border w-full max-w-xl h-full p-6 sm:p-8 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right">
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted tracking-wider">
                      Consignment Inspector
                    </span>
                    <h3 className="font-mono text-xl font-bold text-primary">
                      {inspectorOrder.orderNumber}
                    </h3>
                    <p className="text-xs text-muted">
                      Placed: {new Date(inspectorOrder.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <button
                    onClick={() => setInspectorOrder(null)}
                    className="p-1 text-muted hover:text-primary rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className={`px-2.5 py-1 rounded-full font-bold border ${ORDER_STATUS_LABELS[inspectorOrder.status]?.badgeClass}`}>
                    Fulfillment: {inspectorOrder.status}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full font-bold ${
                    inspectorOrder.paymentStatus === 'PAID'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    Payment: {inspectorOrder.paymentStatus} ({inspectorOrder.paymentMethod})
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-2 border-b border-border pb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                    Order Items ({inspectorOrder.items.length})
                  </h4>
                  <div className="divide-y divide-border/60">
                    {inspectorOrder.items.map((it) => (
                      <div key={it.id} className="py-2 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-medium text-primary">{it.productTitle}</p>
                          <p className="text-[11px] text-muted">{it.variantTitle} × {it.quantity}</p>
                        </div>
                        <span className="font-bold text-primary">{formatPaiseToRupees(it.totalInPaise)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Full Chronological Timeline */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-accent" />
                    <span>Audit & Fulfillment Journey</span>
                  </h4>

                  <div className="relative pl-5 space-y-3.5 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                    {(inspectorOrder.timeline || []).map((ev, i) => (
                      <div key={ev.id || i} className="relative">
                        <div className="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-accent ring-4 ring-canvas" />
                        <div className="bg-surface-dim p-3 rounded-xl border border-border/60 text-xs">
                          <div className="flex justify-between items-center gap-2">
                            <strong className="text-primary">{ev.title}</strong>
                            <span className="text-[10px] font-mono text-muted">
                              {new Date(ev.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-muted mt-1 text-[11px]">{ev.description}</p>
                          <div className="flex items-center justify-between text-[10px] text-muted mt-1.5 border-t border-border/40 pt-1">
                            <span>Actor: {ev.actor || 'System'}</span>
                            {ev.location && <span>{ev.location}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add Custom Note Form */}
                <form onSubmit={handleAddTimelineNote} className="p-3.5 rounded-xl bg-surface-dim border border-border text-xs space-y-2.5">
                  <span className="font-bold text-primary block">Add Administrative Milestone / Checkpoint</span>
                  <input
                    type="text"
                    value={newTimelineTitle}
                    onChange={(e) => setNewTimelineTitle(e.target.value)}
                    placeholder="Milestone Title (e.g. Quality Inspection Passed)"
                    required
                    className="w-full text-xs px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newTimelineDesc}
                    onChange={(e) => setNewTimelineDesc(e.target.value)}
                    placeholder="Milestone Notes / Details"
                    required
                    className="w-full text-xs px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg font-bold text-xs"
                  >
                    + Append Checkpoint
                  </button>
                </form>
              </div>

              <div className="pt-6 border-t border-border flex justify-end">
                <button
                  onClick={() => setInspectorOrder(null)}
                  className="px-4 py-2 bg-surface border border-border rounded-xl text-xs font-bold text-primary"
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GST INVOICE MODAL (PRESERVED) */}
        {showInvoiceModal && selectedOrder && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-xl space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="font-display text-xl font-bold text-primary">
                    Tax Invoice / Consignment Memo
                  </h3>
                  <p className="text-xs text-muted">
                    Invoice No: INV-{selectedOrder.orderNumber}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Invoice</span>
                  </button>
                  <button
                    onClick={() => setShowInvoiceModal(false)}
                    className="p-1 text-muted hover:text-primary"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Seller and Buyer Information */}
              <div className="grid grid-cols-2 gap-6 text-xs bg-surface-dim p-4 rounded-xl border border-border">
                <div className="space-y-1">
                  <span className="font-bold text-primary block uppercase tracking-wider text-[10px] text-muted">
                    Seller (Supplier)
                  </span>
                  <div className="font-bold text-primary">TechilyFly India (InfiniCharm)</div>
                  <p className="text-muted leading-relaxed text-[11px]">
                    Ward No. 07, Lahsaniya, Khoripakar, Dewapur, Pachpakari, Patahi, Dhaka, Motihari,
                    East Champaran, Bihar - 845427
                  </p>
                  <p className="text-muted text-[11px]">Dispatch Center: East Champaran</p>
                </div>

                <div className="space-y-1">
                  <span className="font-bold text-primary block uppercase tracking-wider text-[10px] text-muted">
                    Billed & Shipped To
                  </span>
                  <div className="font-bold text-primary">
                    {selectedOrder.shippingAddress.fullName}
                  </div>
                  <p className="text-muted leading-relaxed text-[11px]">
                    {selectedOrder.shippingAddress.addressLine1}
                    {selectedOrder.shippingAddress.addressLine2
                      ? `, ${selectedOrder.shippingAddress.addressLine2}`
                      : ''}
                    , {selectedOrder.shippingAddress.city},{' '}
                    {selectedOrder.shippingAddress.state} -{' '}
                    {selectedOrder.shippingAddress.postalCode}
                  </p>
                  <p className="text-muted text-[11px]">
                    Contact: {selectedOrder.customerPhone}
                  </p>
                </div>
              </div>

              {/* Itemized Table */}
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface-dim border-b border-border text-muted uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Total (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedOrder.items.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2.5 px-3 font-medium text-primary">
                          {it.productTitle} — <span className="text-muted">{it.variantTitle}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-muted">{it.sku}</td>
                        <td className="py-2.5 px-3 font-semibold text-primary">{it.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-primary">
                          {formatPaiseToRupees(it.priceInPaise)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-primary">
                          {formatPaiseToRupees(it.totalInPaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Calculation */}
              <div className="flex justify-end text-xs">
                <div className="w-64 space-y-1.5 border-t border-border pt-3">
                  <div className="flex justify-between text-muted">
                    <span>Subtotal:</span>
                    <span>{formatPaiseToRupees(selectedOrder.subtotalInPaise)}</span>
                  </div>
                  {selectedOrder.discountInPaise > 0 && (
                    <div className="flex justify-between text-accent font-semibold">
                      <span>Discount ({selectedOrder.couponCode || 'PROMO'}):</span>
                      <span>-{formatPaiseToRupees(selectedOrder.discountInPaise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted">
                    <span>Shipping:</span>
                    <span>
                      {selectedOrder.shippingInPaise === 0
                        ? 'FREE'
                        : formatPaiseToRupees(selectedOrder.shippingInPaise)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-primary text-sm pt-2 border-t border-border">
                    <span>Grand Total:</span>
                    <span>{formatPaiseToRupees(selectedOrder.totalInPaise)}</span>
                  </div>
                </div>
              </div>

              {/* Footer Disclosures */}
              <div className="text-[10px] text-muted text-center pt-3 border-t border-border space-y-0.5">
                <p>This is a computer-generated tax invoice and requires no physical signature.</p>
                <p>Customer Support: support@infinicharm.com • East Champaran, Bihar - 845427</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
