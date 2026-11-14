'use client';

import React, { useState } from 'react';
import { EmailRecipientRole, NotificationDeliveryLog } from '@/types';
import {
  Search,
  RefreshCw,
  RotateCcw,
  Eye,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Slash,
} from 'lucide-react';

interface NotificationLogsTabProps {
  logs: NotificationDeliveryLog[];
  stats: {
    total: number;
    sent: number;
    failed: number;
    pending: number;
    disabledOrSkipped: number;
  };
  onFilterChange: (filters: {
    q: string;
    status: NotificationDeliveryLog['status'] | 'ALL';
    recipientRole: EmailRecipientRole | 'ALL';
  }) => Promise<void>;
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error', msg: string) => void;
}

export function NotificationLogsTab({
  logs,
  stats,
  onFilterChange,
  onRefresh,
  onNotify,
}: NotificationLogsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<NotificationDeliveryLog['status'] | 'ALL'>('ALL');
  const [roleFilter, setRoleFilter] = useState<EmailRecipientRole | 'ALL'>('ALL');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [inspectLog, setInspectLog] = useState<NotificationDeliveryLog | null>(null);

  const applyFilters = async (
    nextQ = searchQuery,
    nextStatus = statusFilter,
    nextRole = roleFilter
  ) => {
    await onFilterChange({
      q: nextQ,
      status: nextStatus,
      recipientRole: nextRole,
    });
  };

  const handleRetry = async (log: NotificationDeliveryLog) => {
    setRetryingId(log.id);
    try {
      const res = await fetch(`/api/admin/notifications/logs/${log.id}/retry`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify('error', data?.error || 'Retry delivery failed.');
      } else {
        onNotify('success', `Re-sent "${log.eventName}" to ${log.recipientEmail}.`);
      }
      await onRefresh();
    } catch {
      onNotify('error', 'Network error retrying delivery log.');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Delivery Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-surface border border-border rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Total Logged</p>
          <p className="font-display text-2xl font-bold text-primary mt-1">{stats.total}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Sent</p>
          <p className="font-display text-2xl font-bold text-emerald-700 mt-1">{stats.sent}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Failed</p>
          <p className="font-display text-2xl font-bold text-rose-700 mt-1">{stats.failed}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Pending</p>
          <p className="font-display text-2xl font-bold text-amber-700 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-4 col-span-2 sm:col-span-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Disabled / Skipped
          </p>
          <p className="font-display text-2xl font-bold text-primary mt-1">
            {stats.disabledOrSkipped}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              applyFilters(val, statusFilter, roleFilter);
            }}
            placeholder="Search recipient email, subject, or event..."
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-surface-dim border border-border rounded-xl text-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter logs by status"
            value={statusFilter}
            onChange={(e) => {
              const s = e.target.value as NotificationDeliveryLog['status'] | 'ALL';
              setStatusFilter(s);
              applyFilters(searchQuery, s, roleFilter);
            }}
            className="px-3 py-2 text-xs bg-surface-dim border border-border rounded-xl text-primary font-semibold"
          >
            <option value="ALL">All Statuses</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
            <option value="SKIPPED">Skipped</option>
            <option value="DISABLED">Disabled</option>
          </select>

          <select
            aria-label="Filter logs by role"
            value={roleFilter}
            onChange={(e) => {
              const r = e.target.value as EmailRecipientRole | 'ALL';
              setRoleFilter(r);
              applyFilters(searchQuery, statusFilter, r);
            }}
            className="px-3 py-2 text-xs bg-surface-dim border border-border rounded-xl text-primary font-semibold"
          >
            <option value="ALL">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="CUSTOMER">Customer</option>
            <option value="VENDOR">Vendor</option>
            <option value="CUSTOM">Custom</option>
          </select>

          <button
            type="button"
            onClick={onRefresh}
            className="p-2 rounded-xl border border-border bg-canvas hover:bg-surface-dim text-primary cursor-pointer"
            title="Refresh Logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Log Rows */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-xs">
        {logs.length === 0 ? (
          <div className="p-10 text-center space-y-1.5">
            <p className="font-display text-base font-bold text-primary">
              No Notification Delivery Logs Recorded Yet
            </p>
            <p className="text-xs text-muted">
              Real-time enquiry, order, customer, review, and test notifications will be logged here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-surface-dim/30 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        log.status === 'SENT'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : log.status === 'FAILED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : log.status === 'DISABLED'
                              ? 'bg-neutral-200/80 text-neutral-700'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {log.status === 'SENT' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : log.status === 'FAILED' ? (
                        <AlertCircle className="w-3 h-3" />
                      ) : (
                        <Slash className="w-3 h-3" />
                      )}
                      {log.status}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-canvas border border-border text-[10px] font-bold text-primary">
                      {log.recipientRole}
                    </span>
                    <span className="font-mono text-[11px] text-accent font-semibold">
                      {log.eventKey}
                    </span>
                    <span className="text-[11px] text-muted">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-primary truncate">{log.subject}</p>
                  <p className="text-[11px] text-secondary truncate">
                    To: <strong>{log.recipientEmail}</strong> &bull; Provider:{' '}
                    <strong>{log.providerName}</strong>
                    {log.errorMessage ? ` • Note: ${log.errorMessage}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {log.contextPayload?.htmlContent && (
                    <button
                      type="button"
                      onClick={() => setInspectLog(log)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-primary hover:bg-surface-dim cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Inspect
                    </button>
                  )}

                  {(log.status === 'FAILED' || log.status === 'SKIPPED') &&
                    log.recipientEmail.includes('@') &&
                    !log.recipientEmail.endsWith('@local') && (
                      <button
                        type="button"
                        disabled={retryingId === log.id}
                        onClick={() => handleRetry(log)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        {retryingId === log.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        Retry
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {inspectLog && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase text-accent">
                  {inspectLog.eventKey} &bull; {inspectLog.recipientEmail}
                </p>
                <h3 className="font-display text-base font-bold text-primary">
                  {inspectLog.subject}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="p-2 rounded-lg border border-border text-muted hover:text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="border border-border rounded-2xl overflow-hidden bg-white">
              <iframe
                title="Logged Email Content"
                srcDoc={inspectLog.contextPayload?.htmlContent || '<p>No HTML payload logged.</p>'}
                className="w-full h-80 border-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
