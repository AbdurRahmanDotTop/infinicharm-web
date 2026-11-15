'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import { isOrderEligibleForPaymentRetry, ORDER_STATUS_LABELS } from '@/lib/services/orders';
import {
  User,
  Package,
  MapPin,
  Heart,
  Shield,
  Truck,
  LogOut,
  ChevronRight,
  Clock,
  CheckCircle2,
  Calendar,
  Phone,
  Mail,
  ExternalLink,
  Settings,
  AlertCircle,
  CreditCard,
} from 'lucide-react';
import { Customer, CustomerAddress, Order } from '@/types';
import { useWishlist } from '@/lib/context/WishlistContext';
import { clearClientCustomerSession } from '@/lib/auth/client-session';

export default function AccountPage() {
  const router = useRouter();
  const { wishlistCount } = useWishlist();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchCustomerData = async () => {
    try {
      const res = await fetch('/api/customers/me');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.customer) {
          setCustomer(data.customer);
          setOrders(data.orders || []);
          // Sync localStorage
          localStorage.setItem('infinicharm_customer_user', JSON.stringify(data.customer));
          if (data.customer.addresses) {
            localStorage.setItem(
              'infinicharm_customer_addresses',
              JSON.stringify(data.customer.addresses)
            );
          }
        }
      } else {
        // Try fallback to localStorage
        const stored = localStorage.getItem('infinicharm_customer_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          setCustomer(parsed);
        }
        const storedOrders = localStorage.getItem('infinicharm_orders');
        if (storedOrders) {
          setOrders(JSON.parse(storedOrders));
        }
      }
    } catch (err) {
      console.error('Failed to load customer profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerData();

    const handleSync = () => fetchCustomerData();
    window.addEventListener('infinicharm_customer_updated', handleSync);
    window.addEventListener('infinicharm_orders_updated', handleSync);
    return () => {
      window.removeEventListener('infinicharm_customer_updated', handleSync);
      window.removeEventListener('infinicharm_orders_updated', handleSync);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/customer/logout', { method: 'POST' });
    } catch {}
    clearClientCustomerSession();
    window.location.href = '/login';
  };

  const defaultShipping =
    customer?.addresses?.find((a) => a.isDefaultShipping) ||
    customer?.addresses?.[0];
  const defaultBilling =
    customer?.addresses?.find((a) => a.isDefaultBilling) || defaultShipping;

  const activeOrdersCount = orders.filter(
    (o) => !['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(o.status)
  ).length;

  return (
    <div className="py-10 bg-surface-dim/40 min-h-screen">
      <Container>
        {/* Profile Header */}
        <div className="bg-surface rounded-3xl border border-border p-4 sm:p-8 shadow-sm mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-3 sm:gap-4 w-full min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-accent text-white flex items-center justify-center font-bold text-xl sm:text-2xl shadow-md shrink-0">
              {customer?.fullName?.charAt(0) || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <h1 className="font-display text-xl sm:text-2xl font-bold text-primary break-words min-w-0">
                  {customer?.fullName || 'Valued Patron'}
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Verified Customer</span>
                </span>
                {customer?.status === 'ACTIVE' && (
                  <span className="text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                    Active Member
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted mt-1.5 min-w-0">
                <span className="flex items-center gap-1 min-w-0 break-all">
                  <Mail className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="truncate max-w-full">{customer?.email || '—'}</span>
                </span>
                {customer?.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-accent" />
                    <span>{customer.phone}</span>
                  </span>
                )}
                <span className="text-[11px] text-muted">
                  • Dispatched from East Champaran, Bihar - 845427
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs w-full md:w-auto">
            <Link
              href="/account/orders"
              className="px-4 py-2 bg-surface-dim hover:bg-border text-primary font-semibold rounded-xl border border-border transition-colors text-center flex-1 md:flex-initial"
            >
              Order History
            </Link>
            <Link
              href="/account/profile"
              className="px-4 py-2 bg-surface-dim hover:bg-border text-primary font-semibold rounded-xl border border-border transition-colors text-center flex-1 md:flex-initial"
            >
              Profile & Security
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-xl border border-rose-200 transition-colors flex items-center justify-center gap-1.5 text-center flex-1 md:flex-initial"
              title="Sign out of account"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* Account Sub-navigation & Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <Link
            href="/account/orders"
            className="p-4 sm:p-5 bg-surface rounded-2xl border border-border hover:border-accent shadow-sm transition-all flex items-center gap-3 sm:gap-4 group min-w-0"
          >
            <div className="p-3 rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted font-medium uppercase tracking-wider">Total Orders</p>
              <h3 className="font-display text-xl font-bold text-primary">{orders.length}</h3>
            </div>
          </Link>

          <Link
            href="/account/orders"
            className="p-4 sm:p-5 bg-surface rounded-2xl border border-border hover:border-accent shadow-sm transition-all flex items-center gap-3 sm:gap-4 group min-w-0"
          >
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted font-medium uppercase tracking-wider">In Transit</p>
              <h3 className="font-display text-xl font-bold text-primary">
                {activeOrdersCount} Active
              </h3>
            </div>
          </Link>

          <Link
            href="/account/addresses"
            className="p-4 sm:p-5 bg-surface rounded-2xl border border-border hover:border-accent shadow-sm transition-all flex items-center gap-3 sm:gap-4 group min-w-0"
          >
            <div className="p-3 rounded-xl bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted font-medium uppercase tracking-wider">Address Book</p>
              <h3 className="font-display text-xl font-bold text-primary">
                {customer?.addresses?.length ?? 0} Saved
              </h3>
            </div>
          </Link>

          <Link
            href="/account/wishlist"
            className="p-4 sm:p-5 bg-surface rounded-2xl border border-border hover:border-accent shadow-sm transition-all flex items-center gap-3 sm:gap-4 group min-w-0"
          >
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition-colors shrink-0">
              <Heart className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted font-medium uppercase tracking-wider">Saved Wishlist</p>
              <h3 className="font-display text-xl font-bold text-primary">
                {wishlistCount} {wishlistCount === 1 ? 'Item' : 'Items'}
              </h3>
            </div>
          </Link>
        </div>

        {/* Central Overview Grid: Default Address & Preferences */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Default Delivery Address Card */}
          <div className="lg:col-span-2 bg-surface rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-accent" />
                <h2 className="font-display text-base font-bold text-primary">
                  Default Delivery Address
                </h2>
              </div>
              <Link
                href="/account/addresses"
                className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
              >
                <span>Manage Address Book</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {defaultShipping ? (
              <div className="bg-surface-dim/60 p-5 rounded-2xl border border-border/80 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary text-sm">
                    {defaultShipping.fullName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Default Shipping
                    </span>
                    {defaultBilling?.id === defaultShipping.id && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                        Default Billing
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-muted leading-relaxed">
                  {defaultShipping.addressLine1}
                  {defaultShipping.addressLine2 ? `, ${defaultShipping.addressLine2}` : ''}
                </p>
                <p className="text-muted">
                  {defaultShipping.city}, {defaultShipping.state} -{' '}
                  <strong className="text-primary">{defaultShipping.postalCode}</strong>
                </p>
                <p className="text-muted flex items-center gap-1.5 pt-1">
                  <Phone className="w-3.5 h-3.5 text-accent" />
                  <span>{defaultShipping.phone}</span>
                </p>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-muted">
                <p>No default address saved yet.</p>
                <Link
                  href="/account/addresses"
                  className="mt-2 inline-flex px-4 py-2 bg-accent text-white font-semibold rounded-xl"
                >
                  Add Shipping Address
                </Link>
              </div>
            )}
          </div>

          {/* Account Security & Preferences Snapshot */}
          <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-accent" />
                <h2 className="font-display text-base font-bold text-primary">
                  Preferences & Security
                </h2>
              </div>
              <Link
                href="/account/profile"
                className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
              >
                <span>Edit</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted">WhatsApp Dispatch Updates</span>
                <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                  {customer?.preferences?.orderUpdatesWhatsapp !== false ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted">SMS Delivery Alerts</span>
                <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                  {customer?.preferences?.smsAlerts !== false ? 'Active' : 'Muted'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted">Harvest Newsletter</span>
                <span className="font-semibold text-primary">
                  {customer?.preferences?.newsletterSubscribed !== false ? 'Subscribed' : 'Unsubscribed'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted">Password Security</span>
                <span className="text-emerald-700 font-medium">Protected (Lax Token)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Orders Section */}
        <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-border">
            <div>
              <h2 className="font-display text-lg font-bold text-primary">Recent Consignments</h2>
              <p className="text-xs text-muted">
                Track live delivery progress or review your previous single-origin harvests.
              </p>
            </div>
            <Link
              href="/account/orders"
              className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
            >
              <span>View All Orders</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-border/80">
            {orders.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted space-y-3">
                <Package className="w-10 h-10 text-muted/40 mx-auto" />
                <p className="text-sm font-semibold text-primary">No orders found on this account.</p>
                <p>Explore 100% Kashmiri Honey, Zamzam Water, Takmeeli Talbeena, and Premium Dates.</p>
                <Link
                  href="/shop"
                  className="inline-flex px-6 py-2.5 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl shadow-xs transition-colors"
                >
                  Start Shopping
                </Link>
              </div>
            ) : (
              orders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-sm text-primary">
                        {order.orderNumber}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                          ORDER_STATUS_LABELS[order.status]?.badgeClass ||
                          (order.status === 'PAYMENT_NOT_RECEIVED' || order.status === 'CANCELLED'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300')
                        }`}
                      >
                        {ORDER_STATUS_LABELS[order.status]?.label || order.status}
                      </span>
                      <span className="text-[10px] font-semibold text-muted bg-surface-dim px-2 py-0.5 rounded-full uppercase">
                        {order.paymentMethod} • {order.paymentStatus}
                      </span>
                    </div>

                    <p className="text-xs text-muted">
                      {order.items?.length || 1} {order.items?.length === 1 ? 'item' : 'items'} • Total:{' '}
                      <strong className="text-primary font-bold">
                        {formatPaiseToRupees(order.totalInPaise)}
                      </strong>
                    </p>

                    <p className="text-[11px] text-muted flex items-center gap-2">
                      <span>
                        Placed on{' '}
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      {order.trackingNumber && (
                        <span>
                          • Courier: <strong>{order.courierName || 'Delhivery'}</strong> ({order.trackingNumber})
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs w-full sm:w-auto">
                    {isOrderEligibleForPaymentRetry(order) && (
                      <Link
                        href={`/pay/${order.orderNumber}`}
                        className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl transition-all text-center flex-1 sm:flex-initial shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Retry Payment / Pay Now</span>
                      </Link>
                    )}
                    <Link
                      href={`/account/orders/${order.orderNumber}`}
                      className="px-3.5 py-2 bg-surface hover:bg-surface-dim border border-border text-primary font-semibold rounded-xl transition-colors text-center flex-1 sm:flex-initial"
                    >
                      View Details
                    </Link>
                    <Link
                      href={`/track-order?id=${order.orderNumber}`}
                      className="px-3.5 py-2 bg-surface-dim hover:bg-surface text-muted hover:text-primary border border-border font-medium rounded-xl transition-colors text-center flex-1 sm:flex-initial"
                    >
                      Track Package
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}
