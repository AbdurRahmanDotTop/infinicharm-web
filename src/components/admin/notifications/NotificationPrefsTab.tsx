'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { GlobalNotificationPreferences, SanitizedSmtpConfig } from '@/types';
import { Loader2, Save, Server } from 'lucide-react';

interface NotificationPrefsTabProps {
  preferences: GlobalNotificationPreferences | null;
  smtpConfigs: SanitizedSmtpConfig[];
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error', msg: string) => void;
}

export function NotificationPrefsTab({
  preferences,
  smtpConfigs,
  onRefresh,
  onNotify,
}: NotificationPrefsTabProps) {
  const [saving, setSaving] = useState(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [adminEmailsText, setAdminEmailsText] = useState('admin@infinicharm.com');
  const [defaultSmtpConfigId, setDefaultSmtpConfigId] = useState<string>('');
  const [supportReplyToEmail, setSupportReplyToEmail] = useState('support@infinicharm.com');
  const [defaultVendorFallbackEmail, setDefaultVendorFallbackEmail] = useState('');
  const [deduplicateOverlappingRecipients, setDeduplicateOverlappingRecipients] = useState(true);
  const [maxAutoRetries, setMaxAutoRetries] = useState(1);

  useEffect(() => {
    if (!preferences) return;
    setNotificationsEnabled(preferences.notificationsEnabled);
    setAdminEmailsText((preferences.defaultAdminEmails || []).join(', '));
    setDefaultSmtpConfigId(preferences.defaultSmtpConfigId || '');
    setSupportReplyToEmail(preferences.supportReplyToEmail || 'support@infinicharm.com');
    setDefaultVendorFallbackEmail(preferences.defaultVendorFallbackEmail || '');
    setDeduplicateOverlappingRecipients(preferences.deduplicateOverlappingRecipients);
    setMaxAutoRetries(preferences.maxAutoRetries ?? 1);
  }, [preferences]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const defaultAdminEmails = adminEmailsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (defaultAdminEmails.length === 0) {
      onNotify('error', 'Please specify at least one Admin recipient email address.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationsEnabled,
          defaultAdminEmails,
          defaultSmtpConfigId: defaultSmtpConfigId || null,
          supportReplyToEmail: supportReplyToEmail.trim(),
          defaultVendorFallbackEmail: defaultVendorFallbackEmail.trim(),
          deduplicateOverlappingRecipients,
          maxAutoRetries,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.preferences) {
        onNotify('error', data?.error || 'Could not update notification preferences.');
        return;
      }
      onNotify('success', 'Global notification preferences updated cleanly.');
      await onRefresh();
    } catch {
      onNotify('error', 'Network error updating notification preferences.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
          <div>
            <h2 className="font-display text-lg font-bold text-primary">
              Global Dispatch Controls &amp; Admin Recipients
            </h2>
            <p className="text-xs text-secondary">
              Central controls governing every enquiry, order, customer, and vendor email notification.
            </p>
          </div>
          <Link
            href="/admin/settings/email-smtp"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-canvas border border-border text-xs font-bold text-primary hover:border-accent/60 shrink-0"
          >
            <Server className="w-3.5 h-3.5 text-accent" />
            Manage SMTP Relays
          </Link>
        </div>

        <label className="flex items-start gap-3 p-4 rounded-2xl bg-surface-dim border border-border cursor-pointer">
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(e) => setNotificationsEnabled(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <span className="text-xs font-bold text-primary block">
              Enable All Automated Email Notifications (Master Switch)
            </span>
            <span className="text-[11px] text-muted">
              Turning this off pauses outgoing transactional &amp; alert dispatches while keeping storefront checkout &amp; enquiry forms 100% operational.
            </span>
          </div>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-primary mb-1">
              Default Admin Alert Recipients (comma or newline separated) *
            </label>
            <textarea
              rows={3}
              required
              value={adminEmailsText}
              onChange={(e) => setAdminEmailsText(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-primary mb-1">
              Default Vendor Fallback Email (optional)
            </label>
            <input
              type="email"
              value={defaultVendorFallbackEmail}
              onChange={(e) => setDefaultVendorFallbackEmail(e.target.value)}
              placeholder="partners@infinicharm.com"
              className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary"
            />
            <p className="text-[11px] text-muted mt-1.5">
              Used when a vendor event rule is enabled without product-level vendor emails.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-bold text-primary mb-1">Default SMTP Relay</label>
            <select
              value={defaultSmtpConfigId}
              onChange={(e) => setDefaultSmtpConfigId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-semibold"
            >
              <option value="">Active Default SMTP Config</option>
              {smtpConfigs.map((cfg) => (
                <option key={cfg.id} value={cfg.id}>
                  {cfg.name} ({cfg.senderEmail})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-primary mb-1">Support Reply-To Email</label>
            <input
              type="email"
              value={supportReplyToEmail}
              onChange={(e) => setSupportReplyToEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary"
            />
          </div>

          <div>
            <label className="block font-bold text-primary mb-1">Max Auto-Retries (0-5)</label>
            <input
              type="number"
              min={0}
              max={5}
              value={maxAutoRetries}
              onChange={(e) => setMaxAutoRetries(Number(e.target.value || 0))}
              className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl font-bold text-primary"
            />
          </div>
        </div>

        <label className="flex items-center gap-2.5 p-3.5 rounded-xl bg-surface-dim border border-border cursor-pointer text-xs font-semibold text-primary">
          <input
            type="checkbox"
            checked={deduplicateOverlappingRecipients}
            onChange={(e) => setDeduplicateOverlappingRecipients(e.target.checked)}
          />
          Suppress Duplicate Emails When Overlapping Roles Resolve to the Same Address
        </label>

        <div className="flex justify-end pt-3 border-t border-border">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Global Preferences
          </button>
        </div>
      </div>
    </form>
  );
}
