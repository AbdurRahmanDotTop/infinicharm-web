'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { AdminHeader } from '@/components/admin/AdminHeader';
import {
  Star,
  Check,
  X,
  MessageSquare,
  ShieldCheck,
  Trash2,
  CornerDownRight,
  Search,
  SlidersHorizontal,
  Eye,
  EyeOff,
  ExternalLink,
  ShoppingBag,
  Clock,
  Sparkles,
  AlertCircle,
  Settings,
} from 'lucide-react';
import { Review, ReviewSettings } from '@/types';
import { logAdminAction } from '@/lib/services/audit';

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [metrics, setMetrics] = useState({
    totalReviews: 0,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    hiddenCount: 0,
    averageRating: 0,
  });
  const [products, setProducts] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [settings, setSettings] = useState<ReviewSettings>({
    autoApproveVerifiedPurchases: true,
    requireDeliveredStatus: true,
    minCommentLength: 10,
  });

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN'>('ALL');
  const [selectedProduct, setSelectedProduct] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const broadcastReviewsUpdated = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('infinicharm_reviews_updated'));
      localStorage.setItem('infinicharm_reviews_sync', Date.now().toString());
    }
  };

  const fetchReviews = async () => {
    try {
      const res = await fetch('/api/admin/reviews');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setReviews(data.reviews || []);
          if (data.metrics) setMetrics(data.metrics);
          if (data.products) setProducts(data.products);
          if (data.settings) setSettings(data.settings);
        }
      }
    } catch (err) {
      console.error('Failed fetching admin reviews:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleUpdateStatus = async (
    id: string,
    newStatus: 'APPROVED' | 'REJECTED' | 'PENDING' | 'HIDDEN'
  ) => {
    const updated = reviews.map((r) => (r.id === id ? { ...r, status: newStatus } : r));
    setReviews(updated);
    logAdminAction('MODERATE_REVIEW', 'reviews', id, { status: newStatus });

    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        showToast(`Review marked as ${newStatus}.`);
        broadcastReviewsUpdated();
        fetchReviews();
      }
    } catch (err) {
      console.error('Failed to update review status:', err);
    }
  };

  const handleSaveReply = async (id: string) => {
    if (!replyText.trim()) return;
    const text = replyText.trim();
    const updated = reviews.map((r) => (r.id === id ? { ...r, adminReply: text } : r));
    setReviews(updated);
    logAdminAction('REPLY_TO_REVIEW', 'reviews', id, { reply: text });
    setReplyingReviewId(null);
    setReplyText('');

    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, adminReply: text }),
      });
      if (res.ok) {
        showToast('Official response published.');
        broadcastReviewsUpdated();
        fetchReviews();
      }
    } catch (err) {
      console.error('Failed to save reply:', err);
    }
  };

  const handleDeleteReview = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this customer review? This cannot be undone.')) {
      return;
    }
    const updated = reviews.filter((r) => r.id !== id);
    setReviews(updated);
    logAdminAction('DELETE_REVIEW', 'reviews', id, {});

    try {
      const res = await fetch(`/api/admin/reviews?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Review permanently deleted.');
        broadcastReviewsUpdated();
        fetchReviews();
      }
    } catch (err) {
      console.error('Failed to delete review:', err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      if (res.ok) {
        showToast('Review moderation settings saved.');
        setShowSettingsModal(false);
      }
    } catch (err) {
      console.error('Failed to save review settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Filter reviews
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) {
        return false;
      }
      if (selectedProduct !== 'ALL') {
        const cleanProd = selectedProduct.toLowerCase();
        const matchesProd =
          r.productId.toLowerCase() === cleanProd ||
          (r.productSlug && r.productSlug.toLowerCase() === cleanProd);
        if (!matchesProd) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const searchable = `${r.customerName} ${r.customerEmail || ''} ${r.productTitle || ''} ${r.productId} ${r.orderNumber || ''} ${r.title || ''} ${r.comment}`.toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [reviews, statusFilter, selectedProduct, searchQuery]);

  return (
    <div className="min-h-screen bg-canvas flex flex-col font-sans">
      <AdminHeader />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-primary text-white text-xs px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-white/10 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Page Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/10 text-accent">
                <Sparkles className="w-3 h-3" />
                Verified Reviews Hub
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary tracking-tight mt-1">
              Review Moderation Queue
            </h1>
            <p className="text-xs text-muted mt-1 max-w-2xl leading-relaxed">
              Verify customer experiences, manage moderation statuses, filter spam, and attach official brand responses.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface hover:bg-surface-dim border border-border text-primary text-xs font-bold rounded-2xl transition-all shadow-xs shrink-0 self-start sm:self-center"
          >
            <Settings className="w-4 h-4 text-accent" />
            <span>Moderation Settings</span>
          </button>
        </div>

        {/* Top 4 KPI Metrics Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-surface p-4 sm:p-5 rounded-3xl border border-border shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                Total Reviews
              </span>
              <span className="font-display text-2xl font-extrabold text-primary block mt-1">
                {metrics.totalReviews}
              </span>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-surface-dim flex items-center justify-center text-primary border border-border">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-surface p-4 sm:p-5 rounded-3xl border border-border shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                Approved & Public
              </span>
              <span className="font-display text-2xl font-extrabold text-emerald-600 block mt-1">
                {metrics.approvedCount}
              </span>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-surface p-4 sm:p-5 rounded-3xl border border-border shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                Pending Moderation
              </span>
              <span className="font-display text-2xl font-extrabold text-amber-600 block mt-1">
                {metrics.pendingCount}
              </span>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-surface p-4 sm:p-5 rounded-3xl border border-border shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                Average Rating
              </span>
              <span className="font-display text-2xl font-extrabold text-primary block mt-1">
                {metrics.averageRating > 0 ? `${metrics.averageRating} ★` : '—'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
              <Star className="w-5 h-5 fill-current" />
            </div>
          </div>
        </div>

        {/* Toolbar & Filter Bar */}
        <div className="bg-surface rounded-3xl border border-border p-4 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by customer, email, product, or order #..."
                className="w-full pl-9 pr-4 py-2 bg-surface-dim border border-border rounded-2xl text-xs text-primary focus:outline-none focus:border-accent"
              />
            </div>

            {/* Product Filter & Status Select */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full lg:w-auto min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-muted min-w-0 w-full sm:w-auto sm:max-w-xs">
                <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full min-w-0 px-3 py-2 bg-surface-dim border border-border rounded-2xl text-xs text-primary font-medium focus:outline-none truncate"
                >
                  <option value="ALL">All Products</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full sm:w-auto min-w-0 px-3 py-2 bg-surface-dim border border-border rounded-2xl text-xs text-primary font-bold focus:outline-none"
              >
                <option value="ALL">All Reviews ({reviews.length})</option>
                <option value="PENDING">Pending Moderation ({metrics.pendingCount})</option>
                <option value="APPROVED">Approved Public ({metrics.approvedCount})</option>
                <option value="REJECTED">Rejected ({metrics.rejectedCount})</option>
                <option value="HIDDEN">Hidden ({metrics.hiddenCount})</option>
              </select>
            </div>
          </div>

          {/* Quick Filter Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-border/60">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'HIDDEN'] as const).map((st) => {
              const active = statusFilter === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all ${
                    active
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-surface-dim text-muted hover:text-primary hover:bg-border/60'
                  }`}
                >
                  {st === 'ALL'
                    ? `All (${reviews.length})`
                    : st === 'PENDING'
                    ? `Pending (${metrics.pendingCount})`
                    : st === 'APPROVED'
                    ? `Approved (${metrics.approvedCount})`
                    : st === 'REJECTED'
                    ? `Rejected (${metrics.rejectedCount})`
                    : `Hidden (${metrics.hiddenCount})`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Reviews List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-surface rounded-3xl border border-border p-12 text-center text-muted text-xs space-y-2">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p>Loading customer reviews...</p>
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="bg-surface rounded-3xl border border-border p-12 text-center text-muted text-xs space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto text-muted/40 mb-2" />
              <p className="font-semibold text-primary">No Customer Reviews Yet</p>
              <p className="text-[11px] text-muted max-w-sm mx-auto leading-relaxed">
                Customer experiences submitted on storefront product pages will appear here for verification and moderation.
              </p>
            </div>
          ) : (
            filteredReviews.map((rev) => (
              <div
                key={rev.id}
                className="bg-surface rounded-3xl border border-border p-5 sm:p-6 shadow-xs space-y-4 transition-all hover:border-accent/30"
              >
                {/* Review Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Customer Avatar & Name */}
                    <div className="w-8 h-8 rounded-full bg-accent/10 text-accent font-bold text-xs flex items-center justify-center shrink-0">
                      {rev.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-bold text-sm text-primary block leading-none">
                        {rev.customerName}
                      </span>
                      {rev.customerEmail && (
                        <span className="text-[10px] text-muted block mt-0.5 font-mono">
                          {rev.customerEmail}
                        </span>
                      )}
                    </div>

                    {/* Verified Purchase & Order Number */}
                    {rev.isVerifiedPurchase && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>Verified Purchase</span>
                        {rev.orderNumber && (
                          <Link
                            href={`/admin/orders?search=${encodeURIComponent(rev.orderNumber)}`}
                            className="text-emerald-700 underline underline-offset-2 hover:text-emerald-900 ml-0.5"
                            title="Inspect order in Fulfillment Hub"
                          >
                            #{rev.orderNumber}
                          </Link>
                        )}
                      </span>
                    )}

                    {/* Product Name */}
                    <Link
                      href={`/product/${rev.productSlug || rev.productId}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline bg-accent/5 px-2.5 py-0.5 rounded-full border border-accent/20"
                    >
                      <ShoppingBag className="w-3 h-3" />
                      <span>{rev.productTitle || rev.productId}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </Link>
                  </div>

                  {/* Status & Timestamp */}
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                        rev.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : rev.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : rev.status === 'HIDDEN'
                          ? 'bg-slate-100 text-slate-700 border-slate-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {rev.status}
                    </span>
                    <span className="text-[11px] text-muted">
                      {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {/* Rating & Content */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1 text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.round(rev.rating)
                            ? 'fill-current text-amber-500'
                            : 'text-border fill-border'
                        }`}
                      />
                    ))}
                    <span className="text-xs font-bold text-primary ml-1.5">
                      {rev.rating}.0 / 5.0
                    </span>
                  </div>

                  {rev.title && (
                    <h4 className="font-bold text-xs sm:text-sm text-primary">
                      {rev.title}
                    </h4>
                  )}
                  <p className="text-xs text-muted leading-relaxed whitespace-pre-line">
                    {rev.comment}
                  </p>
                </div>

                {/* Existing Official Brand Reply */}
                {rev.adminReply && (
                  <div className="p-3.5 rounded-2xl bg-surface-dim border border-border text-xs flex items-start gap-2.5">
                    <CornerDownRight className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <strong className="block text-primary font-bold">
                          Official Brand Response:
                        </strong>
                        {rev.adminReplyAt && (
                          <span className="text-[10px] text-muted">
                            {new Date(rev.adminReplyAt).toLocaleDateString('en-IN')}
                          </span>
                        )}
                      </div>
                      <p className="text-muted text-[11px] leading-relaxed">
                        {rev.adminReply}
                      </p>
                    </div>
                  </div>
                )}

                {/* Reply Editor Box */}
                {replyingReviewId === rev.id && (
                  <div className="p-4 rounded-2xl bg-surface-dim border border-border space-y-2.5 text-xs animate-fade-in">
                    <label className="block font-semibold text-primary">
                      Official Brand Response (Publicly Visible):
                    </label>
                    <textarea
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type response displayed publicly beneath the review on storefront product pages..."
                      className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-primary text-xs focus:outline-none focus:border-accent"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingReviewId(null);
                          setReplyText('');
                        }}
                        className="px-3.5 py-1.5 bg-surface hover:bg-surface-dim text-primary border border-border rounded-xl text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveReply(rev.id)}
                        className="px-4 py-1.5 bg-accent hover:bg-accent/90 text-white font-bold rounded-xl text-xs shadow-xs"
                      >
                        Publish Reply
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Controls Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Approve Action */}
                    {rev.status !== 'APPROVED' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(rev.id, 'APPROVED')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve & Publish</span>
                      </button>
                    )}

                    {/* Hide Action */}
                    {rev.status === 'APPROVED' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(rev.id, 'HIDDEN')}
                        className="px-3 py-1.5 bg-surface-dim hover:bg-border text-slate-700 font-bold rounded-xl border border-border transition-colors flex items-center gap-1.5"
                        title="Hide review from public storefront"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Hide</span>
                      </button>
                    )}

                    {/* Unhide / Republish Action */}
                    {rev.status === 'HIDDEN' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(rev.id, 'APPROVED')}
                        className="px-3 py-1.5 bg-surface-dim hover:bg-border text-primary font-bold rounded-xl border border-border transition-colors flex items-center gap-1.5"
                        title="Unhide and publish review to storefront"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Unhide & Publish</span>
                      </button>
                    )}

                    {/* Reject Action */}
                    {rev.status !== 'REJECTED' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(rev.id, 'REJECTED')}
                        className="px-3 py-1.5 bg-surface-dim hover:bg-rose-50 text-rose-700 font-bold rounded-xl border border-border transition-colors flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    )}

                    {/* Add / Edit Official Reply Action */}
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingReviewId(rev.id);
                        setReplyText(rev.adminReply || '');
                      }}
                      className="px-3 py-1.5 bg-surface-dim hover:bg-border text-primary font-bold rounded-xl border border-border transition-colors flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-accent" />
                      <span>{rev.adminReply ? 'Edit Reply' : 'Add Official Reply'}</span>
                    </button>
                  </div>

                  {/* Permanent Delete Action */}
                  <button
                    type="button"
                    onClick={() => handleDeleteReview(rev.id)}
                    className="p-2 text-muted hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-200"
                    title="Permanently delete review"
                    aria-label="Delete review"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Review Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface rounded-3xl border border-border max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-accent" />
                <h3 className="font-display font-bold text-lg text-primary">
                  Review Moderation Settings
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 text-muted hover:text-primary rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              {/* Setting 1: Auto-Approve */}
              <div className="flex items-start justify-between gap-4 p-3.5 rounded-2xl bg-surface-dim border border-border">
                <div>
                  <span className="font-bold text-primary block">
                    Auto-Approve Verified Purchases
                  </span>
                  <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                    Automatically publish customer reviews submitted with verified purchase orders without holding for manual queue approval.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoApproveVerifiedPurchases}
                  onChange={(e) =>
                    setSettings({ ...settings, autoApproveVerifiedPurchases: e.target.checked })
                  }
                  className="w-4 h-4 accent-accent mt-1 cursor-pointer"
                />
              </div>

              {/* Setting 2: Require Delivered Status */}
              <div className="flex items-start justify-between gap-4 p-3.5 rounded-2xl bg-surface-dim border border-border">
                <div>
                  <span className="font-bold text-primary block">
                    Strict Delivered Order Verification
                  </span>
                  <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                    Strictly require the customer order to reach DELIVERED status before allowing review submission. If unchecked, any confirmed/paid order allows review.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.requireDeliveredStatus}
                  onChange={(e) =>
                    setSettings({ ...settings, requireDeliveredStatus: e.target.checked })
                  }
                  className="w-4 h-4 accent-accent mt-1 cursor-pointer"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 bg-surface hover:bg-surface-dim border border-border text-primary rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="px-5 py-2 bg-accent hover:bg-accent/90 text-white font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5"
                >
                  {isSavingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
