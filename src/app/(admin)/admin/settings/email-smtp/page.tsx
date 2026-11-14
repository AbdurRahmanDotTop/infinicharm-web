'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { SmtpTab } from '@/components/admin/newsletter/SmtpTab';
import { SanitizedSmtpConfig } from '@/types';
import {
  Server,
  Bell,
  FileCode2,
  Mail,
  Settings,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function AdminEmailSmtpSettingsPage() {
  const [configs, setConfigs] = useState<SanitizedSmtpConfig[]>([]);
  const [envBrevoConfigured, setEnvBrevoConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const handleNotify = useCallback((type: 'success' | 'error', msg: string) => {
    setBanner({ type, msg });
    setTimeout(() => {
      setBanner((current) => (current?.msg === msg ? null : current));
    }, 5500);
  }, []);

  const refreshSmtp = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/smtp', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        setConfigs(data.configs || []);
        setEnvBrevoConfigured(Boolean(data.envBrevoConfigured));
      } else {
        handleNotify('error', data?.error || 'Unable to load SMTP configurations.');
      }
    } catch {
      handleNotify('error', 'Failed to reach SMTP settings API.');
    } finally {
      setLoading(false);
    }
  }, [handleNotify]);

  useEffect(() => {
    refreshSmtp();
  }, [refreshSmtp]);

  return (
    <div className="min-h-screen bg-canvas text-primary flex flex-col">
      <AdminHeader />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Link
                href="/admin/settings"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Platform Settings
              </Link>
              <span className="text-border">/</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-accent bg-accent/10 px-2.5 py-0.5 rounded-full">
                <Server className="w-3 h-3" /> Centralized Relay Infrastructure
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary tracking-tight">
              Email &amp; SMTP Configuration
            </h1>
            <p className="text-xs sm:text-sm text-secondary mt-1 max-w-2xl">
              Configure Brevo and custom SMTP relays used centrally by transactional order emails,
              enquiry alerts, customer security PINs, notifications, and newsletter campaigns.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/email-notifications"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-primary hover:border-accent/50 transition-colors"
            >
              <Bell className="w-3.5 h-3.5 text-accent" />
              Notifications
            </Link>
            <Link
              href="/admin/email-templates"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-primary hover:border-accent/50 transition-colors"
            >
              <FileCode2 className="w-3.5 h-3.5 text-accent" />
              Templates
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

        {loading && configs.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-10 text-center text-xs text-muted">
            Loading central SMTP configurations...
          </div>
        ) : (
          <SmtpTab
            configs={configs}
            envBrevoConfigured={envBrevoConfigured}
            onRefresh={refreshSmtp}
            onNotify={handleNotify}
          />
        )}

        <div className="bg-surface-dim border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-secondary">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-muted shrink-0" />
            <span>
              Individual notification rules can use the system default SMTP relay configured here
              or assign a dedicated relay override in{' '}
              <Link href="/admin/email-notifications" className="text-accent font-bold underline">
                Email Notifications
              </Link>
              .
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

