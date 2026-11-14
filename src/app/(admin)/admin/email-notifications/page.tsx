'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { NotificationRulesTab } from '@/components/admin/notifications/NotificationRulesTab';
import { NotificationPrefsTab } from '@/components/admin/notifications/NotificationPrefsTab';
import { NotificationLogsTab } from '@/components/admin/notifications/NotificationLogsTab';
import {
  EmailRecipientRole,
  EmailTemplate,
  GlobalNotificationPreferences,
  NotificationDeliveryLog,
  NotificationEventRule,
  SanitizedSmtpConfig,
} from '@/types';
import {
  BellRing,
  SlidersHorizontal,
  History,
  Server,
  FileCode2,
  Mail,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

type NotificationsTab = 'rules' | 'preferences' | 'logs';

export default function AdminEmailNotificationsPage() {
  const [activeTab, setActiveTab] = useState<NotificationsTab>('rules');
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [rules, setRules] = useState<NotificationEventRule[]>([]);
  const [preferences, setPreferences] = useState<GlobalNotificationPreferences | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [smtpConfigs, setSmtpConfigs] = useState<SanitizedSmtpConfig[]>([]);
  const [logs, setLogs] = useState<NotificationDeliveryLog[]>([]);
  const [logStats, setLogStats] = useState({
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
    disabledOrSkipped: 0,
  });
  const [logFilters, setLogFilters] = useState<{
    q: string;
    status: NotificationDeliveryLog['status'] | 'ALL';
    recipientRole: EmailRecipientRole | 'ALL';
  }>({
    q: '',
    status: 'ALL',
    recipientRole: 'ALL',
  });

  const handleNotify = useCallback((type: 'success' | 'error', msg: string) => {
    setBanner({ type, msg });
    setTimeout(() => {
      setBanner((current) => (current?.msg === msg ? null : current));
    }, 5500);
  }, []);

  const fetchLogs = useCallback(
    async (filters = logFilters) => {
      const qs = new URLSearchParams({
        limit: '50',
        status: filters.status,
        recipientRole: filters.recipientRole,
      });
      if (filters.q.trim()) qs.set('q', filters.q.trim());

      const res = await fetch(`/api/admin/notifications/logs?${qs.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data?.logs)) {
        setLogs(data.logs);
        if (data.stats) setLogStats(data.stats);
      }
    },
    [logFilters]
  );

  const refreshWorkspace = useCallback(async () => {
    try {
      const [rulesRes, prefsRes, tplRes, smtpRes] = await Promise.all([
        fetch('/api/admin/notifications/rules', { cache: 'no-store' }),
        fetch('/api/admin/notifications/preferences', { cache: 'no-store' }),
        fetch('/api/admin/email-templates', { cache: 'no-store' }),
        fetch('/api/admin/smtp', { cache: 'no-store' }),
      ]);

      const [rulesData, prefsData, tplData, smtpData] = await Promise.all([
        rulesRes.json().catch(() => ({})),
        prefsRes.json().catch(() => ({})),
        tplRes.json().catch(() => ({})),
        smtpRes.json().catch(() => ({})),
      ]);

      if (Array.isArray(rulesData?.rules)) setRules(rulesData.rules);
      if (prefsData?.preferences) setPreferences(prefsData.preferences);
      if (tplData?.success) setTemplates(tplData.templates || []);
      if (smtpData?.success) setSmtpConfigs(smtpData.configs || []);
      await fetchLogs();
    } catch {
      handleNotify('error', 'Failed to load email notification center.');
    }
  }, [fetchLogs, handleNotify]);

  useEffect(() => {
    refreshWorkspace();
  }, [refreshWorkspace]);

  const tabs: {
    id: NotificationsTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'rules', label: `Event Rules (${rules.length})`, icon: BellRing },
    { id: 'preferences', label: 'Global Preferences', icon: SlidersHorizontal },
    { id: 'logs', label: `Delivery Logs (${logStats.total})`, icon: History },
  ];

  return (
    <div className="min-h-screen bg-canvas text-primary flex flex-col">
      <AdminHeader />

      <main className="flex-1 mx-auto w-full max-w-canvas px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-accent bg-accent/10 px-2.5 py-0.5 rounded-full">
              <BellRing className="w-3 h-3" /> Centralized Event Dispatch Hub
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary mt-1.5">
              Email Notifications
            </h1>
            <p className="text-xs sm:text-sm text-secondary mt-1 max-w-2xl">
              Control every automated notification rule across Enquiries, Orders, Payments, Customer
              Accounts, Reviews, Inventory, and Vendor Operations with granular role toggles and live delivery logs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/settings/email-smtp"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-primary hover:border-accent/50 transition-colors"
            >
              <Server className="w-3.5 h-3.5 text-accent" />
              Email &amp; SMTP Setup
            </Link>
            <Link
              href="/admin/email-templates"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-primary hover:border-accent/50 transition-colors"
            >
              <FileCode2 className="w-3.5 h-3.5 text-accent" />
              Email Templates
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

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-primary text-surface shadow-xs'
                    : 'bg-surface border border-border text-secondary hover:text-primary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'rules' && (
          <NotificationRulesTab
            rules={rules}
            templates={templates}
            smtpConfigs={smtpConfigs}
            onRefresh={refreshWorkspace}
            onNotify={handleNotify}
          />
        )}

        {activeTab === 'preferences' && (
          <NotificationPrefsTab
            preferences={preferences}
            smtpConfigs={smtpConfigs}
            onRefresh={refreshWorkspace}
            onNotify={handleNotify}
          />
        )}

        {activeTab === 'logs' && (
          <NotificationLogsTab
            logs={logs}
            stats={logStats}
            onFilterChange={async (filters) => {
              setLogFilters(filters);
              await fetchLogs(filters);
            }}
            onRefresh={refreshWorkspace}
            onNotify={handleNotify}
          />
        )}
      </main>
    </div>
  );
}
