'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { getAllProducts } from '@/lib/data/products';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import {
  Package,
  ShoppingBag,
  Tag,
  Image as ImageIcon,
  MessageSquare,
  Settings,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Layers,
  Users,
  FileText,
  Lock,
  CreditCard,
  Inbox,
} from 'lucide-react';
import { Order } from '@/types';

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const products = getAllProducts();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch('/api/orders');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.orders)) {
            setOrders(data.orders);
            return;
          }
        }
      } catch {
        // ignore
      }

      try {
        const stored = localStorage.getItem('infinicharm_orders');
        if (stored) {
          setOrders(JSON.parse(stored));
        }
      } catch {
        // ignore
      }
    };

    fetchOrders();

    const handleSync = () => fetchOrders();
    window.addEventListener('infinicharm_orders_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('infinicharm_orders_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Compute metrics strictly from real data
  const totalRevenuePaise = orders.reduce((sum, ord) => sum + ord.totalInPaise, 0);
  const pendingFulfillment = orders.filter(
    (o) => o.status === 'PENDING' || o.status === 'CONFIRMED' || o.status === 'PROCESSING'
  ).length;

  const lowStockVariants = products.flatMap((p) =>
    p.variants.filter((v) => v.stockQuantity <= v.lowStockThreshold)
  );

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <AdminHeader />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary tracking-tight">
              Operations & Inventory Control
            </h1>
            <p className="text-xs text-muted mt-1">
              Live transactional metrics for East Champaran fulfillment center.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              Live Store Connected
            </span>
          </div>
        </div>

        {/* Real-Data Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Revenue */}
          <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-muted text-xs">
              <span className="font-semibold uppercase tracking-wider">Gross Sales (INR)</span>
              <TrendingUp className="w-4 h-4 text-accent" />
            </div>
            <div className="font-display text-2xl sm:text-3xl font-extrabold text-primary">
              {formatPaiseToRupees(totalRevenuePaise)}
            </div>
            <p className="text-[11px] text-muted">
              Computed from {orders.length} registered orders
            </p>
          </div>

          {/* Orders */}
          <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-muted text-xs">
              <span className="font-semibold uppercase tracking-wider">Orders Recorded</span>
              <ShoppingBag className="w-4 h-4 text-accent" />
            </div>
            <div className="font-display text-2xl sm:text-3xl font-extrabold text-primary">
              {orders.length}
            </div>
            <p className="text-[11px] text-muted">
              Total lifetime transactions
            </p>
          </div>

          {/* Pending Dispatch */}
          <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-muted text-xs">
              <span className="font-semibold uppercase tracking-wider">Pending Dispatch</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="font-display text-2xl sm:text-3xl font-extrabold text-amber-600">
              {pendingFulfillment}
            </div>
            <p className="text-[11px] text-muted">
              Parcels requiring packaging & AWB
            </p>
          </div>

          {/* Active SKUs & Stock */}
          <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-muted text-xs">
              <span className="font-semibold uppercase tracking-wider">Catalogue Status</span>
              <Package className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="font-display text-2xl sm:text-3xl font-extrabold text-primary">
              {products.length} Products
            </div>
            <p className="text-[11px] text-muted">
              {lowStockVariants.length > 0 ? (
                <span className="text-amber-600 font-semibold">{lowStockVariants.length} low stock SKUs</span>
              ) : (
                <span className="text-emerald-700 font-semibold">All inventory levels healthy</span>
              )}
            </p>
          </div>
        </div>

        {/* Centralized Modules Navigation Matrix */}
        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold text-primary">
            Centralized Management Modules
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <Link
              href="/admin/products"
              className="group bg-surface rounded-2xl border border-border hover:border-accent p-6 shadow-sm transition-all flex items-start gap-4"
            >
              <div className="p-3.5 rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                <Package className="w-6 h-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-primary group-hover:text-accent transition-colors">
                    Products & SKUs
                  </h3>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Manage product variants, integer paise pricing, and stock decrement thresholds.
                </p>
              </div>
            </Link>

            <Link
              href="/admin/orders"
              className="group bg-surface rounded-2xl border border-border hover:border-accent p-6 shadow-sm transition-all flex items-start gap-4"
            >
              <div className="p-3.5 rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-primary group-hover:text-accent transition-colors">
                    Orders & Shipments
                  </h3>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Update order lifecycles, assign courier AWB tracking, and inspect delivery addresses.
                </p>
              </div>
            </Link>

            <Link
              href="/admin/payments"
              className="group bg-surface rounded-2xl border border-border hover:border-accent p-6 shadow-sm transition-all flex items-start gap-4"
            >
              <div className="p-3.5 rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                <CreditCard className="w-6 h-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-primary group-hover:text-accent transition-colors">
                    Payment Gateways & Ledger
                  </h3>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Configure Razorpay, COD, PhonePe & Stripe, test connectivity, and audit transactions.
                </p>
              </div>
            </Link>

            <Link
              href="/admin/inquiries"
              className="group bg-surface rounded-2xl border border-border hover:border-accent p-6 shadow-sm transition-all flex items-start gap-4"
            >
              <div className="p-3.5 rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                <Inbox className="w-6 h-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-primary group-hover:text-accent transition-colors">
                    Customer Care & Inquiries
                  </h3>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Resolve incoming customer tickets, write official responses, and inspect newsletter subscribers.
                </p>
              </div>
            </Link>

            <Link
              href="/admin/coupons"
              className="group bg-surface rounded-2xl border border-border hover:border-accent p-6 shadow-sm transition-all flex items-start gap-4"
            >
              <div className="p-3.5 rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                <Tag className="w-6 h-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-primary group-hover:text-accent transition-colors">
                    Coupons & Pricing
                  </h3>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Create percentage and fixed discount coupons with minimum order constraints.
                </p>
              </div>
            </Link>

            <Link
              href="/admin/media"
              className="group bg-surface rounded-2xl border border-border hover:border-accent p-6 shadow-sm transition-all flex items-start gap-4"
            >
              <div className="p-3.5 rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-primary group-hover:text-accent transition-colors">
                    External Media Library
                  </h3>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Manage high-resolution external media URLs and role assignments without server bloat.
                </p>
              </div>
            </Link>

            <Link
              href="/admin/reviews"
              className="group bg-surface rounded-2xl border border-border hover:border-accent p-6 shadow-sm transition-all flex items-start gap-4"
            >
              <div className="p-3.5 rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-primary group-hover:text-accent transition-colors">
                    Review Moderation
                  </h3>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Approve, moderate, and publish verified customer reviews and provide official brand replies.
                </p>
              </div>
            </Link>

            <Link
              href="/admin/categories"
              className="group bg-surface rounded-2xl border border-border hover:border-accent p-6 shadow-sm transition-all flex items-start gap-4"
            >
              <div className="p-3.5 rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                <Layers className="w-6 h-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-primary group-hover:text-accent transition-colors">
                    Categories & Hierarchy
                  </h3>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Manage category taxonomy, compliance standards, and catalogue hierarchy.
                </p>
              </div>
            </Link>

            <Link
              href="/admin/customers"
              className="group bg-surface rounded-2xl border border-border hover:border-accent p-6 shadow-sm transition-all flex items-start gap-4"
            >
              <div className="p-3.5 rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                <Users className="w-6 h-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-primary group-hover:text-accent transition-colors">
                    Customer Directory
                  </h3>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  View aggregated customer accounts, lifetime GMV, order counts, and address histories.
                </p>
              </div>
            </Link>

            <Link
              href="/admin/cms"
              className="group bg-surface rounded-2xl border border-border hover:border-accent p-6 shadow-sm transition-all flex items-start gap-4"
            >
              <div className="p-3.5 rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-primary group-hover:text-accent transition-colors">
                    Content & Editorial CMS
                  </h3>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Compose journal articles, configure hero promotional banners, and policy parameters.
                </p>
              </div>
            </Link>

            <Link
              href="/admin/settings"
              className="group bg-surface rounded-2xl border border-border hover:border-accent p-6 shadow-sm transition-all flex items-start gap-4"
            >
              <div className="p-3.5 rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                <Settings className="w-6 h-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-primary group-hover:text-accent transition-colors">
                    Platform Settings
                  </h3>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Configure free shipping thresholds (₹999), legal compliance, and FSSAI credentials.
                </p>
              </div>
            </Link>

            <Link
              href="/admin/audit-logs"
              className="group bg-surface rounded-2xl border border-border hover:border-accent p-6 shadow-sm transition-all flex items-start gap-4"
            >
              <div className="p-3.5 rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-primary group-hover:text-accent transition-colors">
                    Security Audit Logs
                  </h3>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Immutable administrative audit trail recording all entity state mutations with cryptographic diffs.
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Orders Overview Table */}
        <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <h3 className="font-display text-base font-bold text-primary">
                Latest Customer Orders
              </h3>
              <p className="text-xs text-muted">Real-time orders queue awaiting processing</p>
            </div>
            <Link
              href="/admin/orders"
              className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
            >
              <span>Manage All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">
              No orders have been submitted yet. Test the checkout flow to see live orders here!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border text-muted uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-2">Order Ref</th>
                    <th className="py-3 px-2">Customer</th>
                    <th className="py-3 px-2">Destination</th>
                    <th className="py-3 px-2">Amount</th>
                    <th className="py-3 px-2">Payment</th>
                    <th className="py-3 px-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {orders.slice(0, 5).map((ord) => (
                    <tr key={ord.id} className="hover:bg-surface-dim/50">
                      <td className="py-3 px-2 font-mono font-bold text-primary">{ord.orderNumber}</td>
                      <td className="py-3 px-2 text-primary font-medium">{ord.shippingAddress.fullName}</td>
                      <td className="py-3 px-2 text-muted">{ord.shippingAddress.city}, {ord.shippingAddress.state}</td>
                      <td className="py-3 px-2 font-bold text-accent">{formatPaiseToRupees(ord.totalInPaise)}</td>
                      <td className="py-3 px-2 text-muted">{ord.paymentMethod}</td>
                      <td className="py-3 px-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                          {ord.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
