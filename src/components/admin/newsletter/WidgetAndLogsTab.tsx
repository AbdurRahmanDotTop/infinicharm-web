'use client';

import React, { useEffect, useState } from 'react';
import {
  EmailDeliveryLog,
  EmailTemplate,
  NewsletterWidgetSettings,
} from '@/types';
import { Save, Loader2, RefreshCw } from 'lucide-react';

interface WidgetAndLogsTabProps {
  settings: NewsletterWidgetSettings | null;
  templates: EmailTemplate[];
  logs: EmailDeliveryLog[];
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error', msg: string) => void;
}

export function WidgetAndLogsTab({
  settings,
  templates,
  logs,
  onRefresh,
  onNotify,
}: WidgetAndLogsTabProps) {
  const [form, setForm] = useState<NewsletterWidgetSettings | null>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/newsletter/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify('error', data?.error || 'Could not save widget settings.');
        return;
      }
      onNotify('success', 'Storefront newsletter widget & welcome settings saved.');
      await onRefresh();
    } catch {
      onNotify('error', 'Failed to update widget settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Widget Settings Form */}
      {form && (
        <form
          onSubmit={handleSave}
          className="bg-surface border border-border rounded-2xl p-6 space-y-5 shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-primary">
                Storefront &ldquo;Join the InfiniCharm Circle&rdquo; Settings
              </h2>
              <p className="text-xs text-secondary">
                Changes sync live with the storefront widget and welcome-email automation.
              </p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold cursor-pointer disabled:opacity-60 shrink-0"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Widget Settings
            </button>
          </div>

          <div className="flex flex-wrap gap-6 text-xs">
            <label className="inline-flex items-center gap-2 font-semibold text-primary cursor-pointer">
              <input
                type="checkbox"
                checked={form.isEnabled}
                onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
              />
              Display Newsletter Widget on Storefront
            </label>
            <label className="inline-flex items-center gap-2 font-semibold text-primary cursor-pointer">
              <input
                type="checkbox"
                checked={form.sendWelcomeEmail}
                onChange={(e) => setForm({ ...form, sendWelcomeEmail: e.target.checked })}
              />
              Automatically Send Welcome Email via Active SMTP Provider
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-primary mb-1">Badge Label</label>
              <input
                type="text"
                value={form.badge}
                onChange={(e) => setForm({ ...form, badge: e.target.value })}
                className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-sm text-primary"
              />
            </div>
            <div>
              <label className="block font-semibold text-primary mb-1">Heading *</label>
              <input
                type="text"
                required
                value={form.heading}
                onChange={(e) => setForm({ ...form, heading: e.target.value })}
                className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-sm text-primary"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-semibold text-primary mb-1">Description *</label>
              <textarea
                rows={2}
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-sm text-primary"
              />
            </div>
            <div>
              <label className="block font-semibold text-primary mb-1">Email Placeholder</label>
              <input
                type="text"
                value={form.emailPlaceholder}
                onChange={(e) => setForm({ ...form, emailPlaceholder: e.target.value })}
                className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs text-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-primary mb-1">Button Text</label>
                <input
                  type="text"
                  value={form.buttonText}
                  onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
                  className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs text-primary"
                />
              </div>
              <div>
                <label className="block font-semibold text-primary mb-1">Loading Text</label>
                <input
                  type="text"
                  value={form.loadingText}
                  onChange={(e) => setForm({ ...form, loadingText: e.target.value })}
                  className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs text-primary"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-primary mb-1">Success Message</label>
              <input
                type="text"
                value={form.successMessage}
                onChange={(e) => setForm({ ...form, successMessage: e.target.value })}
                className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs text-primary"
              />
            </div>
            <div>
              <label className="block font-semibold text-primary mb-1">
                Already Subscribed Message
              </label>
              <input
                type="text"
                value={form.alreadySubscribedMessage}
                onChange={(e) => setForm({ ...form, alreadySubscribedMessage: e.target.value })}
                className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs text-primary"
              />
            </div>
            <div>
              <label className="block font-semibold text-primary mb-1">
                Invalid Email Validation Message
              </label>
              <input
                type="text"
                value={form.invalidEmailMessage}
                onChange={(e) => setForm({ ...form, invalidEmailMessage: e.target.value })}
                className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs text-primary"
              />
            </div>
            <div>
              <label className="block font-semibold text-primary mb-1">
                Welcome Email Template
              </label>
              <select
                value={form.welcomeTemplateId || ''}
                onChange={(e) =>
                  setForm({ ...form, welcomeTemplateId: e.target.value || null })
                }
                className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs font-semibold text-primary"
              >
                <option value="">Default WELCOME Purpose Template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.purpose})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block font-semibold text-primary mb-1">Privacy Footnote</label>
              <input
                type="text"
                value={form.privacyFootnote}
                onChange={(e) => setForm({ ...form, privacyFootnote: e.target.value })}
                className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs text-primary"
              />
            </div>
          </div>
        </form>
      )}

      {/* Email Delivery Logs */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-xs">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-display text-base font-bold text-primary">
              Real-Time Email Delivery & Dispatch Logs
            </h3>
            <p className="text-xs text-secondary">
              Auditable log of welcome emails, test dispatches, and marketing campaign deliveries.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRefresh()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-primary cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted">
            No email deliveries logged yet. Trigger a subscription welcome email, SMTP test, or
            campaign dispatch to inspect real delivery outcomes here.
          </div>
        ) : (
          <>
            <div className="lg:hidden divide-y divide-border">
              {logs.map((log) => (
                <div key={log.id} className="p-4 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-primary break-all">{log.recipientEmail}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        log.status === 'SENT'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                  <div className="text-secondary">{log.subject}</div>
                  <div className="text-[11px] text-muted">
                    {log.type} • {log.providerName} • {new Date(log.sentAt).toLocaleString()}
                  </div>
                  {log.errorMessage && <div className="text-red-600">{log.errorMessage}</div>}
                </div>
              ))}
            </div>

            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-canvas/70 text-[11px] font-bold uppercase tracking-wider text-muted">
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Subject / Campaign</th>
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Status / Message ID</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-3 px-4 font-semibold text-primary">{log.type}</td>
                      <td className="py-3 px-4 text-primary">{log.recipientEmail}</td>
                      <td className="py-3 px-4 text-secondary">
                        <div className="text-primary font-medium">{log.subject}</div>
                        {log.campaignName && (
                          <div className="text-[11px] text-muted">Campaign: {log.campaignName}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-secondary">{log.providerName}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            log.status === 'SENT'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {log.status}
                        </span>
                        {log.messageId && (
                          <div className="text-[10px] font-mono text-muted mt-0.5 truncate max-w-[180px]">
                            {log.messageId}
                          </div>
                        )}
                        {log.errorMessage && (
                          <div className="text-[11px] text-red-600 mt-0.5">{log.errorMessage}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted">
                        {new Date(log.sentAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
