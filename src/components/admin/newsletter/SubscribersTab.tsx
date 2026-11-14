'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  NewsletterSubscriber,
  NewsletterSubscriberStatus,
} from '@/types';
import {
  Search,
  UserPlus,
  Download,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  Ban,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface SubscribersStats {
  total: number;
  active: number;
  unsubscribed: number;
  bounced: number;
  suppressed: number;
}

interface SubscribersTabProps {
  onNotify: (type: 'success' | 'error', msg: string) => void;
  onDataChanged: () => void;
}

const STATUS_BADGE: Record<NewsletterSubscriberStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PENDING: 'bg-blue-50 text-blue-700 border-blue-200',
  UNSUBSCRIBED: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  BOUNCED: 'bg-amber-50 text-amber-800 border-amber-200',
  SUPPRESSED: 'bg-red-50 text-red-700 border-red-200',
};

export function SubscribersTab({ onNotify, onDataChanged }: SubscribersTabProps) {
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [stats, setStats] = useState<SubscribersStats>({
    total: 0,
    active: 0,
    unsubscribed: 0,
    bounced: 0,
    suppressed: 0,
  });
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<NewsletterSubscriberStatus | 'ALL'>('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'email_asc' | 'email_desc'>('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NewsletterSubscriber | null>(null);
  const [saving, setSaving] = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formStatus, setFormStatus] = useState<NewsletterSubscriberStatus>('ACTIVE');
  const [formSource, setFormSource] = useState('admin_manual');
  const [formTags, setFormTags] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const fetchSubscribers = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (search.trim()) sp.set('search', search.trim());
      if (statusFilter !== 'ALL') sp.set('status', statusFilter);
      if (sourceFilter !== 'ALL') sp.set('source', sourceFilter);
      sp.set('sortBy', sortBy);
      sp.set('page', String(page));
      sp.set('limit', '15');

      const res = await fetch(`/api/admin/newsletter/subscribers?${sp.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (data?.success) {
        setSubscribers(data.subscribers || []);
        setStats(
          data.stats || { total: 0, active: 0, unsubscribed: 0, bounced: 0, suppressed: 0 }
        );
        setSources(data.sources || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.totalCount || 0);
      }
    } catch {
      onNotify('error', 'Failed to load newsletter subscribers.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sourceFilter, sortBy, page, onNotify]);

  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  const openAddModal = () => {
    setEditing(null);
    setFormEmail('');
    setFormName('');
    setFormStatus('ACTIVE');
    setFormSource('admin_manual');
    setFormTags('');
    setFormNotes('');
    setModalOpen(true);
  };

  const openEditModal = (sub: NewsletterSubscriber) => {
    setEditing(sub);
    setFormEmail(sub.email);
    setFormName(sub.fullName || '');
    setFormStatus(sub.status);
    setFormSource(sub.source || 'homepage_circle');
    setFormTags((sub.tags || []).join(', '));
    setFormNotes(sub.notes || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const tags = formTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const url = editing
        ? `/api/admin/newsletter/subscribers/${editing.id}`
        : '/api/admin/newsletter/subscribers';
      const method = editing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formEmail.trim(),
          fullName: formName.trim(),
          status: formStatus,
          source: formSource.trim() || 'admin_manual',
          tags,
          notes: formNotes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify('error', data?.error || 'Could not save subscriber.');
        return;
      }
      setModalOpen(false);
      onNotify('success', editing ? 'Subscriber updated.' : 'Subscriber added to Circle.');
      await fetchSubscribers();
      onDataChanged();
    } catch {
      onNotify('error', 'Network error saving subscriber.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatus = async (
    sub: NewsletterSubscriber,
    nextStatus: NewsletterSubscriberStatus
  ) => {
    try {
      const res = await fetch(`/api/admin/newsletter/subscribers/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify('error', data?.error || 'Status update failed.');
        return;
      }
      onNotify('success', `${sub.email} marked ${nextStatus}.`);
      await fetchSubscribers();
      onDataChanged();
    } catch {
      onNotify('error', 'Failed to update status.');
    }
  };

  const handleDelete = async (sub: NewsletterSubscriber) => {
    try {
      const res = await fetch(`/api/admin/newsletter/subscribers/${sub.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify('error', data?.error || 'Delete failed.');
        return;
      }
      onNotify('success', `${sub.email} permanently removed.`);
      await fetchSubscribers();
      onDataChanged();
    } catch {
      onNotify('error', 'Failed to delete subscriber.');
    }
  };

  const handleExportCsv = () => {
    const sp = new URLSearchParams();
    if (search.trim()) sp.set('search', search.trim());
    if (statusFilter !== 'ALL') sp.set('status', statusFilter);
    if (sourceFilter !== 'ALL') sp.set('source', sourceFilter);
    sp.set('sortBy', sortBy);
    sp.set('format', 'csv');
    window.location.href = `/api/admin/newsletter/subscribers?${sp.toString()}`;
  };

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Records', value: stats.total, tone: 'text-primary' },
          { label: 'Active Subscribers', value: stats.active, tone: 'text-emerald-700' },
          { label: 'Unsubscribed', value: stats.unsubscribed, tone: 'text-neutral-700' },
          { label: 'Bounced', value: stats.bounced, tone: 'text-amber-700' },
          { label: 'Suppressed', value: stats.suppressed, tone: 'text-red-700' },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-surface border border-border rounded-2xl p-4 shadow-xs"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {card.label}
            </div>
            <div className={`text-2xl font-display font-bold mt-1 ${card.tone}`}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Controls Bar */}
      <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search subscriber email, name, or tag..."
              className="w-full bg-canvas border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-primary outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by subscriber status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as NewsletterSubscriberStatus | 'ALL');
                setPage(1);
              }}
              className="bg-canvas border border-border rounded-xl px-3 py-2.5 text-xs font-semibold text-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="UNSUBSCRIBED">Unsubscribed</option>
              <option value="BOUNCED">Bounced</option>
              <option value="SUPPRESSED">Suppressed</option>
            </select>

            <select
              aria-label="Filter by subscriber source"
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="bg-canvas border border-border rounded-xl px-3 py-2.5 text-xs font-semibold text-primary"
            >
              <option value="ALL">All Sources</option>
              {sources.map((src, srcIdx) => (
                <option key={src || `src-${srcIdx}`} value={src}>
                  {src}
                </option>
              ))}
            </select>

            <select
              aria-label="Sort subscribers"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'newest' | 'oldest' | 'email_asc' | 'email_desc')
              }
              className="bg-canvas border border-border rounded-xl px-3 py-2.5 text-xs font-semibold text-primary"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="email_asc">Email A-Z</option>
              <option value="email_desc">Email Z-A</option>
            </select>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-border bg-canvas hover:bg-surface text-xs font-semibold text-primary cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>

            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Subscriber
            </button>
          </div>
        </div>
      </div>

      {/* Subscribers List */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 flex items-center justify-center gap-2 text-sm text-secondary">
            <Loader2 className="w-4 h-4 animate-spin text-accent" />
            Loading subscriber directory...
          </div>
        ) : subscribers.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-semibold text-primary">No subscribers recorded yet</p>
            <p className="text-xs text-muted max-w-md mx-auto">
              Real opt-in subscribers from Join the InfiniCharm Circle or manual admin entries will
              appear here with zero fake or mock records.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-border">
              {subscribers.map((sub, sIdx) => (
                <div key={sub.id || `mobile-sub-${sIdx}`} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-primary break-all">{sub.email}</div>
                      {sub.fullName && (
                        <div className="text-xs text-secondary">{sub.fullName}</div>
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                        STATUS_BADGE[sub.status]
                      }`}
                    >
                      {sub.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-muted">
                    <span>Source: {sub.source}</span>
                    <span>•</span>
                    <span>Subscribed: {new Date(sub.subscribedAt).toLocaleDateString()}</span>
                    {sub.lastCampaignSentAt ? (
                      <span key="dispatch-time">
                        • Last Dispatch: {new Date(sub.lastCampaignSentAt).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(sub)}
                      className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-primary inline-flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                    {sub.status !== 'ACTIVE' ? (
                      <button
                        type="button"
                        onClick={() => handleQuickStatus(sub, 'ACTIVE')}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Activate
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleQuickStatus(sub, 'UNSUBSCRIBED')}
                        className="px-2.5 py-1.5 rounded-lg bg-neutral-100 text-neutral-700 border border-neutral-200 text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <XCircle className="w-3 h-3" /> Unsubscribe
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(sub)}
                      className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-canvas/70 text-[11px] font-bold uppercase tracking-wider text-muted">
                    <th className="py-3 px-4">Subscriber</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Source & Tags</th>
                    <th className="py-3 px-4">Joined</th>
                    <th className="py-3 px-4">Deliveries</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {subscribers.map((sub, sIdx) => (
                    <tr key={sub.id || `table-sub-${sIdx}`} className="hover:bg-canvas/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-primary">{sub.email}</div>
                        {sub.fullName && <div className="text-secondary">{sub.fullName}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            STATUS_BADGE[sub.status]
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-primary">{sub.source}</div>
                        {sub.tags && sub.tags.length > 0 && (
                          <div className="text-[11px] text-muted">{sub.tags.join(', ')}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-secondary">
                        <div>{new Date(sub.subscribedAt).toLocaleDateString()}</div>
                        <div className="text-[11px] text-muted">
                          {new Date(sub.subscribedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-secondary">
                        <div>
                          {sub.lastCampaignSentAt
                            ? `Sent ${new Date(sub.lastCampaignSentAt).toLocaleDateString()}`
                            : 'Awaiting first dispatch'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(sub)}
                            title="Edit subscriber"
                            className="p-1.5 rounded-lg border border-border hover:bg-canvas text-primary cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {sub.status !== 'ACTIVE' ? (
                            <button
                              type="button"
                              onClick={() => handleQuickStatus(sub, 'ACTIVE')}
                              title="Mark Active"
                              className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleQuickStatus(sub, 'UNSUBSCRIBED')}
                              title="Mark Unsubscribed"
                              className="p-1.5 rounded-lg border border-border hover:bg-neutral-100 text-secondary cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(sub)}
                            title="Permanently Delete"
                            className="p-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-secondary">
              <span>
                Showing page {page} of {totalPages} ({totalCount} matching records)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-border disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-border disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Subscriber Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-level-2 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-lg font-bold text-primary">
                {editing ? 'Edit Subscriber' : 'Add Subscriber'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-muted hover:text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-primary mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full bg-canvas border border-border rounded-xl px-3 py-2.5 text-sm text-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">Full Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Optional subscriber name"
                  className="w-full bg-canvas border border-border rounded-xl px-3 py-2.5 text-sm text-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-primary mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as NewsletterSubscriberStatus)}
                    className="w-full bg-canvas border border-border rounded-xl px-3 py-2.5 text-xs font-semibold text-primary"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="UNSUBSCRIBED">UNSUBSCRIBED</option>
                    <option value="BOUNCED">BOUNCED</option>
                    <option value="SUPPRESSED">SUPPRESSED</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-primary mb-1">Source</label>
                  <input
                    type="text"
                    value={formSource}
                    onChange={(e) => setFormSource(e.target.value)}
                    className="w-full bg-canvas border border-border rounded-xl px-3 py-2.5 text-xs text-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="vip, wholesale, festive"
                  className="w-full bg-canvas border border-border rounded-xl px-3 py-2.5 text-xs text-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs text-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Subscriber
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
