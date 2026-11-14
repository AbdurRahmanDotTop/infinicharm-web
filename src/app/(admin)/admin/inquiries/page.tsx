'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { CustomerInquiry, NewsletterSubscriber } from '@/types';
import { logAdminAction } from '@/lib/services/audit';
import {
  MessageSquare,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Trash2,
  Send,
  Mail,
  Phone,
  Calendar,
  X,
  RefreshCw,
  UserCheck,
  ExternalLink,
  Users,
} from 'lucide-react';

export default function AdminInquiriesPage() {
  const [activeTab, setActiveTab] = useState<'inquiries' | 'subscribers'>('inquiries');
  const [inquiries, setInquiries] = useState<CustomerInquiry[]>([]);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEW' | 'IN_PROGRESS' | 'RESOLVED'>('ALL');
  const [selectedInquiry, setSelectedInquiry] = useState<CustomerInquiry | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      const inqRes = await fetch('/api/admin/inquiries', { cache: 'no-store' });
      const inqData = await inqRes.json();
      if (inqRes.ok && Array.isArray(inqData?.inquiries)) {
        setInquiries(inqData.inquiries);
      } else {
        setInquiries([]);
      }
    } catch {
      setInquiries([]);
    }

    try {
      const res = await fetch('/api/admin/newsletter/subscribers?limit=100', {
        cache: 'no-store',
      });
      const data = await res.json();
      if (data?.success && Array.isArray(data.subscribers)) {
        setSubscribers(data.subscribers);
      } else {
        setSubscribers([]);
      }
    } catch {
      setSubscribers([]);
    }
  };

  const showBanner = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  const handleUpdateStatus = async (
    id: string,
    newStatus: 'NEW' | 'IN_PROGRESS' | 'RESOLVED'
  ) => {
    try {
      const res = await fetch(`/api/admin/inquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data?.inquiry) {
        setInquiries((prev) => prev.map((inq) => (inq.id === id ? data.inquiry : inq)));
        if (selectedInquiry && selectedInquiry.id === id) {
          setSelectedInquiry(data.inquiry);
        }
        logAdminAction('UPDATE_INQUIRY_STATUS', 'customer_inquiries', id, { status: newStatus });
        showBanner(`Inquiry ticket ${id} marked as ${newStatus}.`);
      }
    } catch {
      showBanner(`Failed to update inquiry ${id}.`);
    }
  };

  const handleSendResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry || !replyText.trim() || isReplying) return;
    setIsReplying(true);
    try {
      const res = await fetch(`/api/admin/inquiries/${selectedInquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'RESOLVED',
          adminResponse: replyText.trim(),
          sendReplyEmail: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.inquiry) {
        setInquiries((prev) =>
          prev.map((inq) => (inq.id === selectedInquiry.id ? data.inquiry : inq))
        );
        logAdminAction('REPLY_INQUIRY', 'customer_inquiries', selectedInquiry.id, {
          reply: replyText.trim(),
        });
        const recipient = selectedInquiry.email;
        setSelectedInquiry(null);
        setReplyText('');
        showBanner(
          data.emailResult?.sentCount > 0
            ? `Reply saved & email sent to ${recipient}.`
            : `Reply saved for ${recipient} (check Notifications Delivery Logs for email status).`
        );
      }
    } finally {
      setIsReplying(false);
    }
  };

  const handleDeleteInquiry = async (id: string) => {
    if (!confirm(`Are you sure you want to delete inquiry ${id}?`)) return;
    const res = await fetch(`/api/admin/inquiries/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setInquiries((prev) => prev.filter((inq) => inq.id !== id));
      if (selectedInquiry && selectedInquiry.id === id) {
        setSelectedInquiry(null);
      }
      logAdminAction('DELETE_INQUIRY', 'customer_inquiries', id, {});
      showBanner(`Inquiry ${id} deleted.`);
    }
  };

  const filteredInquiries = inquiries.filter((inq) => {
    const matchesStatus = statusFilter === 'ALL' || inq.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      inq.id.toLowerCase().includes(q) ||
      inq.name.toLowerCase().includes(q) ||
      inq.email.toLowerCase().includes(q) ||
      inq.phone.includes(q) ||
      inq.subject.toLowerCase().includes(q) ||
      inq.message.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <AdminHeader />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Module Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                Customer Care & Inquiries Desk
              </span>
              <span className="text-xs text-muted">• Consumer Protection Rules Compliant</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary tracking-tight">
              Customer Support Inquiries & Newsletter Circle
            </h1>
            <p className="text-xs text-muted mt-1">
              Review and resolve messages submitted via the Contact Care portal and audit subscribed newsletter accounts.
            </p>
          </div>

          <button
            onClick={loadRecords}
            className="p-2 bg-surface hover:bg-surface-dim text-muted hover:text-primary border border-border rounded-xl transition-colors self-start sm:self-auto"
            title="Refresh Records"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-border text-xs font-semibold overflow-x-auto scrollbar-none pb-px">
          <button
            onClick={() => setActiveTab('inquiries')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'inquiries'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Customer Inquiries ({inquiries.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('subscribers')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'subscribers'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Newsletter Subscribers ({subscribers.length})</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: INQUIRIES MANAGEMENT */}
        {/* ========================================================================= */}
        {activeTab === 'inquiries' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-border">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search inquiries by ticket #, name, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3.5 py-2 text-xs bg-surface-dim border border-border rounded-xl text-primary font-medium focus:outline-none focus:border-accent"
                >
                  <option value="ALL">All Inquiries ({inquiries.length})</option>
                  <option value="NEW">New Unread</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
              </div>
            </div>

            {/* Inquiries Table */}
            <div className="bg-surface rounded-3xl border border-border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-dim/60 text-muted uppercase tracking-wider text-[10px] font-bold border-b border-border">
                    <tr>
                      <th className="py-3.5 px-4">Ticket Reference</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Subject</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Submitted</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredInquiries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-muted">
                          <MessageSquare className="w-8 h-8 mx-auto text-muted/60 mb-2" />
                          <p className="font-semibold text-primary">No Inquiries Found</p>
                          <p className="text-[11px] mt-0.5">Customer messages submitted via the Contact page will be catalogued here.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredInquiries.map((inq) => (
                        <tr key={inq.id} className="hover:bg-surface-dim/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-accent">
                            {inq.id}
                          </td>
                          <td className="py-3.5 px-4">
                            <strong className="block text-primary font-semibold">{inq.name}</strong>
                            <span className="text-[11px] text-muted">{inq.email} • {inq.phone}</span>
                          </td>
                          <td className="py-3.5 px-4 text-primary max-w-xs truncate">
                            <span className="font-semibold">{inq.subject}</span>
                            <p className="text-[11px] text-muted truncate">{inq.message}</p>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              inq.status === 'NEW'
                                ? 'bg-amber-100 text-amber-800'
                                : inq.status === 'IN_PROGRESS'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {inq.status === 'NEW' ? 'New' : inq.status === 'IN_PROGRESS' ? 'In Progress' : 'Resolved'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-muted whitespace-nowrap">
                            {new Date(inq.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedInquiry(inq);
                                setReplyText(inq.adminResponse || '');
                              }}
                              className="px-2.5 py-1 bg-surface-dim hover:bg-border text-primary font-medium rounded-lg text-[11px] transition-colors"
                            >
                              Review & Reply
                            </button>
                            <button
                              onClick={() => handleDeleteInquiry(inq.id)}
                              className="p-1 hover:bg-rose-50 text-muted hover:text-rose-600 rounded-lg transition-colors"
                              title="Delete inquiry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: NEWSLETTER SUBSCRIBERS */}
        {/* ========================================================================= */}
        {activeTab === 'subscribers' && (
          <div className="space-y-4">
            <div className="bg-surface rounded-3xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                  <h3 className="font-display text-base font-bold text-primary">
                    InfiniCharm Circle Newsletter Members
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Verified opt-in customer subscribers eligible for seasonal private reserves and launch vouchers.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold bg-surface-dim px-3 py-1 rounded-xl text-primary border border-border">
                    {subscribers.filter((s) => s.status === 'ACTIVE').length} Active / {subscribers.length} Total
                  </span>
                  <Link
                    href="/admin/newsletter"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-accent hover:bg-accent-hover text-white px-3.5 py-1.5 rounded-xl transition-colors"
                  >
                    Open Full Newsletter & Email Hub
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              <div className="mt-4 divide-y divide-border">
                {subscribers.length === 0 ? (
                  <p className="text-xs text-muted py-6 text-center">No subscribers registered yet.</p>
                ) : (
                  subscribers.map((sub) => (
                    <div key={sub.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-primary">{sub.email}</span>
                        <p className="text-[11px] text-muted">Source: {sub.source}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {sub.status}
                        </span>
                        <span className="text-muted text-[11px]">
                          {new Date(sub.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* REVIEW & REPLY MODAL */}
        {/* ========================================================================= */}
        {selectedInquiry && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <span className="text-accent font-mono font-bold text-xs">{selectedInquiry.id}</span>
                  <h3 className="font-display text-lg font-bold text-primary mt-0.5">
                    {selectedInquiry.subject}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedInquiry(null)}
                  className="p-1 text-muted hover:text-primary rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Inquiry Message Card */}
              <div className="bg-surface-dim p-4 rounded-2xl border border-border space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px] text-muted border-b border-border/60 pb-2">
                  <span>From: <strong className="text-primary">{selectedInquiry.name}</strong> ({selectedInquiry.email})</span>
                  <span>{new Date(selectedInquiry.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-primary leading-relaxed pt-1 whitespace-pre-wrap">
                  {selectedInquiry.message}
                </p>
              </div>

              {/* Status Update Quick Buttons */}
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-muted">Update Status:</span>
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(selectedInquiry.id, 'IN_PROGRESS')}
                  className={`px-3 py-1 rounded-xl font-bold transition-colors ${
                    selectedInquiry.status === 'IN_PROGRESS'
                      ? 'bg-blue-600 text-white'
                      : 'bg-surface-dim hover:bg-border text-primary'
                  }`}
                >
                  In Progress
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(selectedInquiry.id, 'RESOLVED')}
                  className={`px-3 py-1 rounded-xl font-bold transition-colors ${
                    selectedInquiry.status === 'RESOLVED'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-surface-dim hover:bg-border text-primary'
                  }`}
                >
                  Resolved
                </button>
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendResponse} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Official Admin Reply to Customer
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type official brand response to be dispatched to customer..."
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setSelectedInquiry(null)}
                    className="px-4 py-2 bg-surface-dim hover:bg-border text-primary font-medium rounded-xl"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send & Mark Resolved</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

