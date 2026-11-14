'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import {
  Tag,
  Plus,
  Trash2,
  Pencil,
  Eye,
  Search,
  Calendar,
  Users,
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  X,
  RefreshCw,
} from 'lucide-react';
import type {
  Category,
  Coupon,
  CouponApplicabilityType,
  CouponStatus,
  CouponUserEligibility,
  Customer,
  Product,
} from '@/types';
import { logAdminAction } from '@/lib/services/audit';

function toDateTimeLocalInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getDefaultEndDateLocal(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return toDateTimeLocalInput(d.toISOString());
}

function formatDateShort(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getStatusBadgeClass(status: CouponStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'EXPIRED':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'INACTIVE':
    default:
      return 'bg-neutral-100 text-neutral-600 border-neutral-200';
  }
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CouponStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PERCENTAGE' | 'FIXED_AMOUNT'>('ALL');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [viewingCoupon, setViewingCoupon] = useState<Coupon | null>(null);
  const [deletingCoupon, setDeletingCoupon] = useState<Coupon | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('10');
  const [minOrderRupees, setMinOrderRupees] = useState('0');
  const [maxDiscountRupees, setMaxDiscountRupees] = useState('');
  const [usageLimitTotal, setUsageLimitTotal] = useState('');
  const [usageLimitPerCustomer, setUsageLimitPerCustomer] = useState('1');
  const [validFrom, setValidFrom] = useState(() => toDateTimeLocalInput(new Date().toISOString()));
  const [validUntil, setValidUntil] = useState(() => getDefaultEndDateLocal());
  const [applicabilityType, setApplicabilityType] = useState<CouponApplicabilityType>('ALL');
  const [applicableCategoryIds, setApplicableCategoryIds] = useState<string[]>([]);
  const [applicableProductIds, setApplicableProductIds] = useState<string[]>([]);
  const [userEligibility, setUserEligibility] = useState<CouponUserEligibility>('ALL');
  const [eligibleCustomerIds, setEligibleCustomerIds] = useState<string[]>([]);
  const [couponStatus, setCouponStatus] = useState<CouponStatus>('ACTIVE');

  const loadCoupons = useCallback(async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const res = await fetch('/api/admin/coupons', { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = `/admin/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPageError(data.error || 'Failed to load coupons from database.');
        return;
      }
      setCoupons(Array.isArray(data.coupons) ? data.coupons : []);
    } catch {
      setPageError('Unable to reach server coupons endpoint.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadReferenceData = useCallback(async () => {
    try {
      const [catRes, prodRes, custRes] = await Promise.all([
        fetch('/api/categories', { cache: 'no-store' }),
        fetch('/api/products?admin=true', { cache: 'no-store' }),
        fetch('/api/admin/customers', { cache: 'no-store' }),
      ]);
      if (custRes.status === 401) {
        window.location.href = `/admin/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      const [catData, prodData, custData] = await Promise.all([
        catRes.json().catch(() => ({})),
        prodRes.json().catch(() => ({})),
        custRes.json().catch(() => ({})),
      ]);
      if (Array.isArray(catData.categories)) setCategories(catData.categories);
      if (Array.isArray(prodData.products)) setProducts(prodData.products);
      if (Array.isArray(custData.customers)) setCustomers(custData.customers);
    } catch {
      // Non-fatal reference metadata
    }
  }, []);

  useEffect(() => {
    loadCoupons();
    loadReferenceData();
  }, [loadCoupons, loadReferenceData]);

  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      const matchesSearch =
        !searchQuery.trim() ||
        c.code.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchQuery.trim().toLowerCase()));
      const effectiveStatus = c.status || (c.isActive ? 'ACTIVE' : 'INACTIVE');
      const matchesStatus = statusFilter === 'ALL' || effectiveStatus === statusFilter;
      const matchesType = typeFilter === 'ALL' || c.discountType === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [coupons, searchQuery, statusFilter, typeFilter]);

  const kpis = useMemo(() => {
    let activeCount = 0;
    let inactiveCount = 0;
    let expiredCount = 0;
    let totalRedemptions = 0;
    for (const c of coupons) {
      const st = c.status || (c.isActive ? 'ACTIVE' : 'INACTIVE');
      if (st === 'ACTIVE') activeCount += 1;
      else if (st === 'EXPIRED') expiredCount += 1;
      else inactiveCount += 1;
      totalRedemptions += c.usageCount || 0;
    }
    return {
      total: coupons.length,
      activeCount,
      inactiveCount,
      expiredCount,
      totalRedemptions,
    };
  }, [coupons]);

  const categoryNameMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );
  const productNameMap = useMemo(
    () => new Map(products.map((p) => [p.id, p.title])),
    [products]
  );

  const openCreateModal = () => {
    setEditingCoupon(null);
    setFormError(null);
    setCode('');
    setDescription('');
    setDiscountType('PERCENTAGE');
    setDiscountValue('10');
    setMinOrderRupees('499');
    setMaxDiscountRupees('250');
    setUsageLimitTotal('');
    setUsageLimitPerCustomer('1');
    setValidFrom(toDateTimeLocalInput(new Date().toISOString()));
    setValidUntil(getDefaultEndDateLocal());
    setApplicabilityType('ALL');
    setApplicableCategoryIds([]);
    setApplicableProductIds([]);
    setUserEligibility('ALL');
    setEligibleCustomerIds([]);
    setCouponStatus('ACTIVE');
    setShowFormModal(true);
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormError(null);
    setCode(coupon.code);
    setDescription(coupon.description || '');
    setDiscountType(coupon.discountType);
    setDiscountValue(
      coupon.discountType === 'PERCENTAGE'
        ? String(coupon.discountValue)
        : String(coupon.discountValue / 100)
    );
    setMinOrderRupees(String((coupon.minOrderInPaise || 0) / 100));
    setMaxDiscountRupees(
      coupon.maxDiscountInPaise ? String(coupon.maxDiscountInPaise / 100) : ''
    );
    setUsageLimitTotal(coupon.usageLimitTotal ? String(coupon.usageLimitTotal) : '');
    setUsageLimitPerCustomer(String(coupon.usageLimitPerCustomer ?? 1));
    setValidFrom(toDateTimeLocalInput(coupon.validFrom));
    setValidUntil(toDateTimeLocalInput(coupon.validUntil));
    setApplicabilityType(coupon.applicabilityType || 'ALL');
    setApplicableCategoryIds(coupon.applicableCategoryIds || []);
    setApplicableProductIds(coupon.applicableProductIds || []);
    setUserEligibility(coupon.userEligibility || 'ALL');
    setEligibleCustomerIds(coupon.eligibleCustomerIds || []);
    setCouponStatus(coupon.status || (coupon.isActive ? 'ACTIVE' : 'INACTIVE'));
    setShowFormModal(true);
  };

  const toggleIdSelection = (
    id: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!code.trim()) {
      setFormError('Coupon code is required.');
      return;
    }

    const parsedDiscount = parseFloat(discountValue || '0');
    if (Number.isNaN(parsedDiscount) || parsedDiscount <= 0) {
      setFormError('Discount value must be greater than zero.');
      return;
    }

    if (discountType === 'PERCENTAGE' && parsedDiscount > 100) {
      setFormError('Percentage discount cannot exceed 100%.');
      return;
    }

    if (applicabilityType === 'CATEGORIES' && applicableCategoryIds.length === 0) {
      setFormError('Select at least one category or switch applicability to All Products.');
      return;
    }

    if (applicabilityType === 'PRODUCTS' && applicableProductIds.length === 0) {
      setFormError('Select at least one product or switch applicability to All Products.');
      return;
    }

    if (userEligibility === 'SPECIFIC_CUSTOMERS' && eligibleCustomerIds.length === 0) {
      setFormError('Select at least one eligible customer or choose a broader eligibility rule.');
      return;
    }

    if (!validFrom || !validUntil) {
      setFormError('Start date and end date are both required.');
      return;
    }

    const fromIso = new Date(validFrom).toISOString();
    const untilIso = new Date(validUntil).toISOString();

    if (new Date(untilIso).getTime() < new Date(fromIso).getTime()) {
      setFormError('Validity end date must be on or after the start date.');
      return;
    }

    const payload = {
      code: code.trim().toUpperCase(),
      description: description.trim(),
      discountType,
      discountValue:
        discountType === 'PERCENTAGE'
          ? parsedDiscount
          : Math.round(parsedDiscount * 100),
      minOrderInPaise: Math.round(parseFloat(minOrderRupees || '0') * 100),
      maxDiscountInPaise:
        maxDiscountRupees.trim() !== ''
          ? Math.round(parseFloat(maxDiscountRupees) * 100)
          : null,
      usageLimitTotal:
        usageLimitTotal.trim() !== '' ? Math.round(parseFloat(usageLimitTotal)) : null,
      usageLimitPerCustomer:
        usageLimitPerCustomer.trim() !== '' ? Math.round(parseFloat(usageLimitPerCustomer)) : 0,
      validFrom: fromIso,
      validUntil: untilIso,
      applicabilityType,
      applicableCategoryIds: applicabilityType === 'CATEGORIES' ? applicableCategoryIds : [],
      applicableProductIds: applicabilityType === 'PRODUCTS' ? applicableProductIds : [],
      userEligibility,
      eligibleCustomerIds: userEligibility === 'SPECIFIC_CUSTOMERS' ? eligibleCustomerIds : [],
      status: couponStatus,
      isActive: couponStatus === 'ACTIVE',
    };

    setIsSubmitting(true);
    try {
      const url = editingCoupon
        ? `/api/admin/coupons/${editingCoupon.id}`
        : '/api/admin/coupons';
      const method = editingCoupon ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.error || 'Failed to save coupon.');
        return;
      }

      logAdminAction(
        editingCoupon ? 'UPDATE_COUPON' : 'CREATE_COUPON',
        'coupons',
        data.coupon.id,
        {
          code: data.coupon.code,
          discountType: data.coupon.discountType,
          discountValue: data.coupon.discountValue,
          status: data.coupon.status,
        }
      );

      setShowFormModal(false);
      setActionBanner({
        type: 'success',
        text: data.message || `Coupon ${data.coupon.code} saved.`,
      });
      await loadCoupons();
    } catch {
      setFormError('Network error saving coupon.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (coupon: Coupon) => {
    const currentStatus = coupon.status || (coupon.isActive ? 'ACTIVE' : 'INACTIVE');
    if (currentStatus === 'EXPIRED') {
      openEditModal(coupon);
      setFormError('Extend the End Date and set Status to Active to re-enable this expired coupon.');
      return;
    }

    const nextStatus: CouponStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          isActive: nextStatus === 'ACTIVE',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionBanner({ type: 'error', text: data.error || 'Failed to update status.' });
        return;
      }

      logAdminAction('TOGGLE_COUPON', 'coupons', coupon.id, {
        code: coupon.code,
        before: currentStatus,
        after: nextStatus,
      });

      setActionBanner({
        type: 'success',
        text: `Coupon ${coupon.code} marked ${nextStatus}.`,
      });
      await loadCoupons();
    } catch {
      setActionBanner({ type: 'error', text: 'Failed to update coupon status.' });
    }
  };

  const confirmDeleteCoupon = async () => {
    if (!deletingCoupon) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/coupons/${deletingCoupon.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionBanner({ type: 'error', text: data.error || 'Failed to delete coupon.' });
        return;
      }

      logAdminAction('DELETE_COUPON', 'coupons', deletingCoupon.id, {
        code: deletingCoupon.code,
      });

      setActionBanner({
        type: 'success',
        text: `Coupon ${deletingCoupon.code} permanently deleted.`,
      });
      setDeletingCoupon(null);
      await loadCoupons();
    } catch {
      setActionBanner({ type: 'error', text: 'Network error deleting coupon.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <AdminHeader />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-primary tracking-tight">
              Coupons & Promotions Management
            </h1>
            <p className="text-xs text-muted mt-1">
              Full database-backed coupon control — create, edit, schedule validity windows, target products or customers, and track genuine redemptions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={loadCoupons}
              className="px-3.5 py-2.5 bg-surface border border-border hover:bg-surface-dim text-primary text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
              title="Refresh coupons"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              data-testid="create-coupon-btn"
              className="px-4 sm:px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors uppercase tracking-wider shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Coupon</span>
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {actionBanner && (
          <div
            className={`px-4 py-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
              actionBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <span className="font-medium">{actionBanner.text}</span>
            <button
              type="button"
              onClick={() => setActionBanner(null)}
              className="p-1 hover:bg-black/5 rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {pageError && (
          <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
            {pageError}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-surface rounded-2xl border border-border p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Total Coupons</p>
            <p className="font-display text-2xl font-bold text-primary mt-1">{kpis.total}</p>
            <p className="text-[11px] text-muted mt-0.5">Configured in database</p>
          </div>
          <div className="bg-surface rounded-2xl border border-border p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Active</p>
            <p className="font-display text-2xl font-bold text-emerald-700 mt-1">{kpis.activeCount}</p>
            <p className="text-[11px] text-muted mt-0.5">Live on storefront</p>
          </div>
          <div className="bg-surface rounded-2xl border border-border p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Inactive / Expired</p>
            <p className="font-display text-2xl font-bold text-primary mt-1">
              {kpis.inactiveCount + kpis.expiredCount}
            </p>
            <p className="text-[11px] text-muted mt-0.5">
              {kpis.inactiveCount} paused · {kpis.expiredCount} expired
            </p>
          </div>
          <div className="bg-surface rounded-2xl border border-border p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Verified Redemptions</p>
            <p className="font-display text-2xl font-bold text-primary mt-1">{kpis.totalRedemptions}</p>
            <p className="text-[11px] text-muted mt-0.5">Tracked across placed orders</p>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-surface rounded-2xl border border-border p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search coupon code or description..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-2.5">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="flex-1 sm:flex-none px-3 py-2 text-xs bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
              aria-label="Filter by status"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="EXPIRED">Expired</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="flex-1 sm:flex-none px-3 py-2 text-xs bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
              aria-label="Filter by discount type"
            >
              <option value="ALL">All Discount Types</option>
              <option value="PERCENTAGE">Percentage (%)</option>
              <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
            </select>
          </div>
        </div>

        {/* Coupons List / Empty State */}
        {isLoading ? (
          <div className="bg-surface rounded-2xl border border-border p-10 text-center text-xs text-muted">
            Loading coupons from database...
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-8 sm:p-12 text-center shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-dim border border-border flex items-center justify-center mx-auto text-muted">
              <Tag className="w-6 h-6" />
            </div>
            <h2 className="font-display text-base sm:text-lg font-bold text-primary">
              {coupons.length === 0 ? 'No Promotional Coupons Configured Yet' : 'No Matching Coupons Found'}
            </h2>
            <p className="text-xs text-muted max-w-md mx-auto">
              {coupons.length === 0
                ? 'All demo/static coupons have been removed. Create your first database-backed coupon to enable checkout promotions.'
                : 'Try adjusting your search query or clearing the active status/type filters.'}
            </p>
            {coupons.length === 0 ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Coupon</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setTypeFilter('ALL');
                }}
                className="px-4 py-2 bg-surface-dim hover:bg-border text-primary text-xs font-semibold rounded-xl"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-border bg-surface-dim/40 text-muted uppercase text-[10px] tracking-wider">
                      <th className="py-3.5 px-4">Code & Scope</th>
                      <th className="py-3.5 px-4">Discount Benefit</th>
                      <th className="py-3.5 px-4">Min. Order</th>
                      <th className="py-3.5 px-4">Validity Window</th>
                      <th className="py-3.5 px-4">Usage & Limits</th>
                      <th className="py-3.5 px-4">Eligibility</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredCoupons.map((c) => {
                      const effectiveStatus = c.status || (c.isActive ? 'ACTIVE' : 'INACTIVE');
                      return (
                        <tr key={c.id} className="hover:bg-surface-dim/30 transition-colors" data-testid={`coupon-row-${c.code}`}>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <Tag className="w-3.5 h-3.5 text-accent shrink-0" />
                              <span className="font-mono font-bold text-sm text-primary">{c.code}</span>
                            </div>
                            {c.description && (
                              <p className="text-[11px] text-muted mt-0.5 line-clamp-1">{c.description}</p>
                            )}
                            <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-surface-dim text-muted">
                              {c.applicabilityType === 'CATEGORIES'
                                ? `${c.applicableCategoryIds?.length || 0} Categories`
                                : c.applicabilityType === 'PRODUCTS'
                                  ? `${c.applicableProductIds?.length || 0} Products`
                                  : 'All Products'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-bold text-primary">
                            {c.discountType === 'PERCENTAGE'
                              ? `${c.discountValue}% OFF`
                              : `Flat ${formatPaiseToRupees(c.discountValue)} OFF`}
                            {c.maxDiscountInPaise && (
                              <span className="block text-[10px] text-muted font-normal mt-0.5">
                                Max Cap: {formatPaiseToRupees(c.maxDiscountInPaise)}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-primary font-medium">
                            {formatPaiseToRupees(c.minOrderInPaise)}
                          </td>

                          <td className="py-3.5 px-4 text-muted">
                            <div className="text-[11px] text-primary font-medium">
                              {formatDateShort(c.validFrom)} → {formatDateShort(c.validUntil)}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-primary">
                              {c.usageCount} {c.usageLimitTotal ? `/ ${c.usageLimitTotal}` : 'used'}
                            </div>
                            <span className="text-[10px] text-muted">
                              {c.usageLimitPerCustomer > 0
                                ? `${c.usageLimitPerCustomer} per user`
                                : 'Unlimited / user'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-[11px] text-muted">
                            {c.userEligibility === 'NEW_CUSTOMERS'
                              ? 'New Customers'
                              : c.userEligibility === 'LOGGED_IN'
                                ? 'Signed-in Users'
                                : c.userEligibility === 'SPECIFIC_CUSTOMERS'
                                  ? `${c.eligibleCustomerIds?.length || 0} Selected Users`
                                  : 'All Customers'}
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(effectiveStatus)}`}
                            >
                              {effectiveStatus}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setViewingCoupon(c)}
                                className="p-1.5 hover:bg-surface-dim text-muted hover:text-primary rounded-lg transition-colors"
                                title="View coupon details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(c)}
                                className="p-1.5 hover:bg-surface-dim text-muted hover:text-accent rounded-lg transition-colors"
                                title="Edit coupon"
                                data-testid={`edit-coupon-${c.code}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(c)}
                                className="px-2 py-1 text-[11px] font-semibold text-accent hover:underline"
                              >
                                {effectiveStatus === 'ACTIVE'
                                  ? 'Disable'
                                  : effectiveStatus === 'EXPIRED'
                                    ? 'Renew'
                                    : 'Activate'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingCoupon(c)}
                                className="p-1.5 hover:bg-rose-50 text-muted hover:text-rose-600 rounded-lg transition-colors"
                                title="Permanently delete coupon"
                                data-testid={`delete-coupon-${c.code}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

            {/* Mobile / Tablet Responsive Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-3.5">
              {filteredCoupons.map((c) => {
                const effectiveStatus = c.status || (c.isActive ? 'ACTIVE' : 'INACTIVE');
                return (
                  <div
                    key={c.id}
                    className="bg-surface rounded-2xl border border-border p-4 shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-accent shrink-0" />
                          <span className="font-mono font-bold text-sm text-primary break-all">
                            {c.code}
                          </span>
                        </div>
                        {c.description && (
                          <p className="text-[11px] text-muted mt-0.5">{c.description}</p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(effectiveStatus)}`}
                      >
                        {effectiveStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-surface-dim/50 rounded-xl p-3">
                      <div>
                        <span className="text-[10px] text-muted uppercase block">Benefit</span>
                        <span className="font-bold text-primary">
                          {c.discountType === 'PERCENTAGE'
                            ? `${c.discountValue}% OFF`
                            : `Flat ${formatPaiseToRupees(c.discountValue)}`}
                        </span>
                        {c.maxDiscountInPaise && (
                          <span className="block text-[10px] text-muted">
                            Cap: {formatPaiseToRupees(c.maxDiscountInPaise)}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] text-muted uppercase block">Min. Order</span>
                        <span className="font-semibold text-primary">
                          {formatPaiseToRupees(c.minOrderInPaise)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted uppercase block">Usage</span>
                        <span className="font-semibold text-primary">
                          {c.usageCount} {c.usageLimitTotal ? `/ ${c.usageLimitTotal}` : 'used'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted uppercase block">Validity</span>
                        <span className="text-[11px] text-primary">
                          {formatDateShort(c.validUntil)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(c)}
                        className="text-xs font-semibold text-accent hover:underline"
                      >
                        {effectiveStatus === 'ACTIVE'
                          ? 'Disable'
                          : effectiveStatus === 'EXPIRED'
                            ? 'Renew Dates'
                            : 'Activate'}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingCoupon(c)}
                          className="px-2.5 py-1.5 text-[11px] font-medium bg-surface-dim hover:bg-border rounded-lg text-primary flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          className="px-2.5 py-1.5 text-[11px] font-medium bg-surface-dim hover:bg-border rounded-lg text-primary flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCoupon(c)}
                          className="px-2.5 py-1.5 text-[11px] font-medium bg-rose-50 hover:bg-rose-100 rounded-lg text-rose-700 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Create / Edit Coupon Modal */}
        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-900/60 backdrop-blur-sm">
            <div className="bg-surface rounded-3xl border border-border p-5 sm:p-7 max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-primary">
                    {editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : 'Create Promotional Coupon'}
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Configure discount math, usage caps, validity window, product scope, and customer eligibility.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="p-1.5 hover:bg-surface-dim rounded-xl text-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSaveCoupon} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Coupon Code *</label>
                    <input
                      type="text"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                      placeholder="e.g. HARVEST15"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl uppercase font-mono text-primary focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">Coupon Status *</label>
                    <select
                      value={couponStatus}
                      onChange={(e) => setCouponStatus(e.target.value as CouponStatus)}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    >
                      <option value="ACTIVE">Active (Usable if within dates)</option>
                      <option value="INACTIVE">Inactive (Paused)</option>
                      <option value="EXPIRED">Expired (Disabled)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">Internal / Promotional Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Seasonal harvest offer on orders above ₹999"
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Discount Type *</label>
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    >
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FIXED_AMOUNT">Fixed Amount (INR ₹)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">
                      Discount Value ({discountType === 'PERCENTAGE' ? '%' : '₹'}) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={discountType === 'PERCENTAGE' ? '100' : undefined}
                      required
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder={discountType === 'PERCENTAGE' ? '15' : '150'}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Minimum Order Value (INR ₹) *</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={minOrderRupees}
                      onChange={(e) => setMinOrderRupees(e.target.value)}
                      placeholder="499"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">Maximum Discount Limit (INR ₹)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={maxDiscountRupees}
                      onChange={(e) => setMaxDiscountRupees(e.target.value)}
                      placeholder="Leave blank for no cap"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Global Total Usage Limit</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={usageLimitTotal}
                      onChange={(e) => setUsageLimitTotal(e.target.value)}
                      placeholder="Blank = unlimited total uses"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">Usage Limit Per Customer *</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={usageLimitPerCustomer}
                      onChange={(e) => setUsageLimitPerCustomer(e.target.value)}
                      placeholder="1 (0 = unlimited)"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Valid From (Start Date) *</label>
                    <input
                      type="datetime-local"
                      required
                      value={validFrom}
                      onChange={(e) => setValidFrom(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">Valid Until (End Date) *</label>
                    <input
                      type="datetime-local"
                      required
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                {/* Applicability Scope */}
                <div className="pt-2 border-t border-border/60 space-y-2.5">
                  <label className="block font-semibold text-primary">
                    Applicable Products / Categories
                  </label>
                  <select
                    value={applicabilityType}
                    onChange={(e) => setApplicabilityType(e.target.value as CouponApplicabilityType)}
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  >
                    <option value="ALL">All Storefront Products</option>
                    <option value="CATEGORIES">Specific Categories Only</option>
                    <option value="PRODUCTS">Specific Products Only</option>
                  </select>

                  {applicabilityType === 'CATEGORIES' && (
                    <div className="max-h-36 overflow-y-auto p-3 rounded-xl border border-border bg-surface-dim/50 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {categories.length === 0 ? (
                        <p className="text-muted col-span-2">No categories loaded.</p>
                      ) : (
                        categories.map((cat) => (
                          <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={applicableCategoryIds.includes(cat.id)}
                              onChange={() => toggleIdSelection(cat.id, setApplicableCategoryIds)}
                              className="rounded border-border text-accent focus:ring-accent"
                            />
                            <span className="text-primary truncate">{cat.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  )}

                  {applicabilityType === 'PRODUCTS' && (
                    <div className="max-h-40 overflow-y-auto p-3 rounded-xl border border-border bg-surface-dim/50 space-y-1.5">
                      {products.length === 0 ? (
                        <p className="text-muted">No products loaded.</p>
                      ) : (
                        products.map((prod) => (
                          <label key={prod.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={applicableProductIds.includes(prod.id)}
                              onChange={() => toggleIdSelection(prod.id, setApplicableProductIds)}
                              className="rounded border-border text-accent focus:ring-accent"
                            />
                            <span className="text-primary truncate">{prod.title}</span>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* User Eligibility */}
                <div className="pt-2 border-t border-border/60 space-y-2.5">
                  <label className="block font-semibold text-primary">Customer Eligibility</label>
                  <select
                    value={userEligibility}
                    onChange={(e) => setUserEligibility(e.target.value as CouponUserEligibility)}
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  >
                    <option value="ALL">All Customers (Guests & Registered)</option>
                    <option value="LOGGED_IN">Signed-In Customers Only</option>
                    <option value="NEW_CUSTOMERS">New Customers (First Order Only)</option>
                    <option value="SPECIFIC_CUSTOMERS">Specific Customer Accounts Only</option>
                  </select>

                  {userEligibility === 'SPECIFIC_CUSTOMERS' && (
                    <div className="max-h-36 overflow-y-auto p-3 rounded-xl border border-border bg-surface-dim/50 space-y-1.5">
                      {customers.length === 0 ? (
                        <p className="text-muted">No registered customers found.</p>
                      ) : (
                        customers.map((cust) => (
                          <label key={cust.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={eligibleCustomerIds.includes(cust.id)}
                              onChange={() => toggleIdSelection(cust.id, setEligibleCustomerIds)}
                              className="rounded border-border text-accent focus:ring-accent"
                            />
                            <span className="text-primary truncate">
                              {cust.fullName} ({cust.email})
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2.5 pt-4 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="px-5 py-2.5 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    data-testid="submit-coupon-btn"
                    className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl disabled:opacity-60"
                  >
                    {isSubmitting
                      ? 'Saving...'
                      : editingCoupon
                        ? 'Save Changes'
                        : 'Create Coupon'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Coupon Details Modal */}
        {viewingCoupon && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm">
            <div className="bg-surface rounded-3xl border border-border p-6 max-w-lg w-full max-h-[88vh] overflow-y-auto shadow-2xl space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-accent" />
                    <h3 className="font-mono text-lg font-bold text-primary">{viewingCoupon.code}</h3>
                  </div>
                  {viewingCoupon.description && (
                    <p className="text-xs text-muted mt-1">{viewingCoupon.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setViewingCoupon(null)}
                  className="p-1.5 hover:bg-surface-dim rounded-xl text-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-surface-dim/50">
                  <span className="text-[10px] uppercase text-muted block">Discount</span>
                  <span className="font-bold text-primary">
                    {viewingCoupon.discountType === 'PERCENTAGE'
                      ? `${viewingCoupon.discountValue}% OFF`
                      : `Flat ${formatPaiseToRupees(viewingCoupon.discountValue)}`}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-surface-dim/50">
                  <span className="text-[10px] uppercase text-muted block">Min. Order / Cap</span>
                  <span className="font-semibold text-primary">
                    Min {formatPaiseToRupees(viewingCoupon.minOrderInPaise)}
                    {viewingCoupon.maxDiscountInPaise
                      ? ` · Cap ${formatPaiseToRupees(viewingCoupon.maxDiscountInPaise)}`
                      : ''}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-surface-dim/50">
                  <span className="text-[10px] uppercase text-muted block">Validity</span>
                  <span className="text-primary">
                    {formatDateShort(viewingCoupon.validFrom)} → {formatDateShort(viewingCoupon.validUntil)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-surface-dim/50">
                  <span className="text-[10px] uppercase text-muted block">Usage Count</span>
                  <span className="font-semibold text-primary">
                    {viewingCoupon.usageCount}
                    {viewingCoupon.usageLimitTotal ? ` / ${viewingCoupon.usageLimitTotal}` : ' (No global cap)'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <p className="font-semibold text-primary flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-accent" />
                  <span>Product Scope:</span>
                  <span className="font-normal text-muted">
                    {viewingCoupon.applicabilityType === 'CATEGORIES'
                      ? (viewingCoupon.applicableCategoryIds || [])
                          .map((id) => categoryNameMap.get(id) || id)
                          .join(', ') || 'None'
                      : viewingCoupon.applicabilityType === 'PRODUCTS'
                        ? (viewingCoupon.applicableProductIds || [])
                            .map((id) => productNameMap.get(id) || id)
                            .join(', ') || 'None'
                        : 'All Products'}
                  </span>
                </p>
                <p className="font-semibold text-primary flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-accent" />
                  <span>Customer Eligibility:</span>
                  <span className="font-normal text-muted">
                    {viewingCoupon.userEligibility || 'ALL'}
                  </span>
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <h4 className="text-xs font-bold text-primary">
                  Recent Verified Redemptions ({viewingCoupon.redeemedBy?.length || 0})
                </h4>
                {!viewingCoupon.redeemedBy || viewingCoupon.redeemedBy.length === 0 ? (
                  <p className="text-xs text-muted">No redemptions recorded yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {viewingCoupon.redeemedBy.map((rec, i) => (
                      <div
                        key={`${rec.orderNumber}-${i}`}
                        className="flex items-center justify-between text-xs p-2 rounded-lg bg-surface-dim/50"
                      >
                        <div>
                          <span className="font-mono font-bold text-primary">{rec.orderNumber}</span>
                          <span className="block text-[10px] text-muted">
                            {rec.customerEmail || rec.customerId || rec.customerPhone || 'Customer'}
                          </span>
                        </div>
                        <span className="font-semibold text-emerald-700">
                          -{formatPaiseToRupees(rec.discountInPaise)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingCoupon;
                    setViewingCoupon(null);
                    openEditModal(target);
                  }}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl"
                >
                  Edit Coupon
                </button>
                <button
                  type="button"
                  onClick={() => setViewingCoupon(null)}
                  className="px-4 py-2 bg-surface-dim hover:bg-border text-primary text-xs font-semibold rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Permanent Delete Confirmation Modal */}
        {deletingCoupon && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm">
            <div className="bg-surface rounded-3xl border border-border p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-primary">
                    Permanently Delete Coupon?
                  </h3>
                  <p className="text-xs text-muted mt-1">
                    Are you sure you want to permanently remove coupon{' '}
                    <span className="font-mono font-bold text-primary">{deletingCoupon.code}</span>? Customers will no longer be able to redeem it at checkout. This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingCoupon(null)}
                  className="px-4 py-2 bg-surface-dim hover:bg-border text-primary text-xs font-medium rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={confirmDeleteCoupon}
                  data-testid="confirm-delete-coupon-btn"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl disabled:opacity-60"
                >
                  {isSubmitting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
