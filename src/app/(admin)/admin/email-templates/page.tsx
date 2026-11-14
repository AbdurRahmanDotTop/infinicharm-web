'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { TemplatesTab } from '@/components/admin/newsletter/TemplatesTab';
import { EmailTemplate } from '@/types';
import {
  FileCode2,
  Bell,
  Server,
  Mail,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function AdminEmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const handleNotify = useCallback((type: 'success' | 'error', msg: string) => {
    setBanner({ type, msg });
    setTimeout(() => {
      setBanner((current) => (current?.msg === msg ? null : current));
    }, 5500);
  }, []);

  const refreshTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/email-templates', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        setTemplates(data.templates || []);
      } else {
        handleNotify('error', data?.error || 'Unable to load email templates.');
      }
    } catch {
      handleNotify('error', 'Network error loading email templates.');
    } finally {
      setLoading(false);
    }
  }, [handleNotify]);

  useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates]);

  return (
    <div className="min-h-screen bg-canvas text-primary flex flex-col">
      <AdminHeader />

      <main className="flex-1 mx-auto w-full max-w-canvas px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-accent bg-accent/10 px-2.5 py-0.5 rounded-full">
              <FileCode2 className="w-3 h-3" /> Shared Template Registry
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary mt-1.5">
              Email Templates
            </h1>
            <p className="text-xs sm:text-sm text-secondary mt-1 max-w-2xl">
              Author, duplicate, preview, and organize HTML templates across Transactional Orders,
              Admin Alerts, Customer Notifications, Vendor Dispatches, and Marketing Campaigns.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/email-notifications"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-primary hover:border-accent/50 transition-colors"
            >
              <Bell className="w-3.5 h-3.5 text-accent" />
              Notification Rules
            </Link>
            <Link
              href="/admin/settings/email-smtp"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-primary hover:border-accent/50 transition-colors"
            >
              <Server className="w-3.5 h-3.5 text-accent" />
              Email &amp; SMTP Setup
            </Link>
            <Link
              href="/admin/newsletter"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-primary hover:border-accent/50 transition-colors"
            >
              <Mail className="w-3.5 h-3.5 text-accent" />
              Newsletter
            </Link>
          </div>
        </div>

        {banner && (
          <div
            role={banner.type === 'error' ? 'alert' : 'status'}
            className={`flex items-start gap-2.5 p-3.5 rounded-2xl border text-xs font-semibold ${
              banner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{banner.msg}</span>
          </div>
        )}

        {loading && templates.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-10 text-center text-xs text-muted">
            Loading email templates library...
          </div>
        ) : (
          <TemplatesTab
            templates={templates}
            onRefresh={refreshTemplates}
            onNotify={handleNotify}
          />
        )}
      </main>
    </div>
  );
}

