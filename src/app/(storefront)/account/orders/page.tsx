'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import {
  Package,
  Truck,
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  FileText,
  CreditCard,
  Eye,
} from 'lucide-react';
import { Order, OrderStatus } from '@/types';
import { ORDER_STATUS_LABELS, isOrderEligibleForPaymentRetry } from '@/lib/services/orders';

export default function AccountOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    async function loadOrders() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/customers/me', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.orders)) {
            setOrders(data.orders);
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Could not fetch customer orders from /api/customers/me:', err);
      }

      setOrders([]);
      setIsLoading(false);
    }

    loadOrders();

    const handleSync = () => loadOrders();
    window.addEventListener('infinicharm_orders_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('infinicharm_orders_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const filteredOrders = orders.filter((order) => {
    const matchesStatus =
      statusFilter === 'ALL' ||
      order.status === statusFilter ||
      (statusFilter === 'ACTIVE' && !['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(order.status));

    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      order.orderNumber.toLowerCase().includes(q) ||
      (order.courierName && order.courierName.toLowerCase().includes(q)) ||
      (order.trackingNumber && order.trackingNumber.toLowerCase().includes(q)) ||
      order.items.some((item) => item.productTitle.toLowerCase().includes(q));

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="py-10 bg-surface-dim/40 min-h-screen">
      <Container className="max-w-4xl">
        {/* Back Link */}
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Account Overview</span>
        </Link>

        {/* Page Header */}
        <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 shadow-sm mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-primary">Order History & Invoices</h1>
            <p className="text-xs text-muted mt-1">
              Review all confirmed purchases, track active consignments, and inspect product details.
            </p>
          </div>
          <span className="text-xs bg-surface-dim border border-border px-3.5 py-1.5 rounded-xl font-bold text-primary">
            {orders.length} {orders.length === 1 ? 'Order' : 'Orders'} Recorded
          </span>
        </div>

        {/* Filters and Search Strip */}
        <div className="bg-surface rounded-2xl border border-border p-4 mb-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by order ID or item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto pb-1 sm:pb-0">
            {['ALL', 'ACTIVE', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors text-[11px] ${
                  statusFilter === st
                    ? 'bg-accent text-white'
                    : 'bg-surface-dim hover:bg-border text-muted hover:text-primary'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-6">
          {filteredOrders.length === 0 ? (
            <div className="bg-surface rounded-3xl border border-border p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-surface-dim mx-auto flex items-center justify-center text-muted">
                <Package className="w-8 h-8" />
              </div>
              <h3 className="font-display text-lg font-bold text-primary">
                {isLoading ? 'Loading your orders...' : 'No Matching Orders Found'}
              </h3>
              <p className="text-xs text-muted max-w-sm mx-auto">
                {orders.length === 0
                  ? 'Discover traditionally cold-pressed oils, pure honey, and handcrafted apparel.'
                  : 'Try clearing your search or changing status filter.'}
              </p>
              {orders.length === 0 ? (
                <Link
                  href="/shop"
                  className="inline-flex px-6 py-3 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl uppercase tracking-wider transition-colors"
                >
                  Browse Product Catalogue
                </Link>
              ) : (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                  }}
                  className="px-4 py-2 bg-surface-dim hover:bg-border text-primary text-xs font-semibold rounded-xl"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            filteredOrders.map((order) => {
              const statusMeta = ORDER_STATUS_LABELS[order.status] || {
                label: order.status,
                badgeClass: 'bg-zinc-100 text-zinc-800 border-zinc-300',
              };

              return (
                <div
                  key={order.id}
                  className="bg-surface rounded-3xl border border-border overflow-hidden shadow-sm"
                >
                  {/* Order Top Banner */}
                  <div className="p-5 sm:p-6 bg-surface-dim/70 border-b border-border flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        Order Reference
                      </span>
                      <p className="font-mono font-bold text-sm text-primary">{order.orderNumber}</p>
                      <p className="text-[11px] text-muted flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-accent" />
                        <span>
                          {new Date(order.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </p>
                    </div>

                    <div className="space-y-1 sm:text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        Total Amount
                      </span>
                      <p className="text-sm font-extrabold text-accent">
                        {formatPaiseToRupees(order.totalInPaise)}
                      </p>
                      <div className="flex items-center gap-1.5 justify-end flex-wrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.label}
                        </span>
                        {order.paymentMethod === 'CUSTOM_UPI' && order.paymentStatus === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-800 border border-amber-500/30 dark:text-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Payment Verifying</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Items in this order */}
                  <div className="p-5 sm:p-6 divide-y divide-border/60">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="py-3 first:pt-0 last:pb-0 flex justify-between items-center text-xs">
                        <div>
                          <h4 className="font-semibold text-primary">{item.productTitle}</h4>
                          <p className="text-[11px] text-muted">
                            {item.variantTitle} • Qty: {item.quantity} {item.sku && `• SKU: ${item.sku}`}
                          </p>
                        </div>
                        <span className="font-bold text-primary">
                          {formatPaiseToRupees(item.totalInPaise)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Footer Actions */}
                  <div className="p-4 sm:p-5 bg-surface-dim/40 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-muted text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-accent" />
                      <span>
                        Delivering to {order.shippingAddress.city}, {order.shippingAddress.state} -{' '}
                        {order.shippingAddress.postalCode}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isOrderEligibleForPaymentRetry(order) && (
                        <Link
                          href={`/pay/${order.orderNumber}`}
                          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Retry Payment / Pay Now</span>
                        </Link>
                      )}
                      <Link
                        href={`/account/orders/${order.orderNumber}`}
                        className="px-3.5 py-2 bg-surface hover:bg-surface-dim border border-border text-primary text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Details</span>
                      </Link>
                      <Link
                        href={`/track-order?id=${order.orderNumber}`}
                        className="px-3.5 py-2 bg-surface-dim hover:bg-surface border border-border text-muted hover:text-primary text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Track Consignment</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Container>
    </div>
  );
}
