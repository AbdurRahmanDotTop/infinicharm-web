'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { SubscribersTab } from '@/components/admin/newsletter/SubscribersTab';
import { CampaignsTab } from '@/components/admin/newsletter/CampaignsTab';
import { TemplatesTab } from '@/components/admin/newsletter/TemplatesTab';
import { WidgetAndLogsTab } from '@/components/admin/newsletter/WidgetAndLogsTab';
import {
  EmailCampaign,
  EmailDeliveryLog,
  EmailTemplate,
  NewsletterWidgetSettings,
  SanitizedSmtpConfig,
} from '@/types';
import {
  Users,
  Send,
  FileCode2,
  Server,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  BellRing,
} from 'lucide-react';

type NewsletterAdminTab = 'subscribers' | 'campaigns' | 'templates' | 'settings';

export default function AdminNewsletterPage() {
  const [activeTab, setActiveTab] = useState<NewsletterAdminTab>('subscribers');
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [smtpConfigs, setSmtpConfigs] = useState<SanitizedSmtpConfig[]>([]);
  const [widgetSettings, setWidgetSettings] = useState<NewsletterWidgetSettings | null>(null);
  const [logs, setLogs] = useState<EmailDeliveryLog[]>([]);

  const handleNotify = useCallback((type: 'success' | 'error', msg: string) => {
    setBanner({ type, msg });
    setTimeout(() => {
      setBanner((current) => (current?.msg === msg ? null : current));
    }, 5500);
  }, []);

  const refreshMarketingState = useCallback(async () => {
    try {
      const [tplRes, cmpRes, smtpRes, setRes, logRes] = await Promise.all([
        fetch('/api/admin/email-templates', { cache: 'no-store' }),
        fetch('/api/admin/campaigns', { cache: 'no-store' }),
        fetch('/api/admin/smtp', { cache: 'no-store' }),
        fetch('/api/admin/newsletter/settings', { cache: 'no-store' }),
        fetch('/api/admin/newsletter/logs?limit=100', { cache: 'no-store' }),
      ]);

      const [tplData, cmpData, smtpData, setData, logData] = await Promise.all([
        tplRes.json().catch(() => ({})),
        cmpRes.json().catch(() => ({})),
        smtpRes.json().catch(() => ({})),
        setRes.json().catch(() => ({})),
        logRes.json().catch(() => ({})),
      ]);

      if (tplData?.success) setTemplates(tplData.templates || []);
      if (cmpData?.success) setCampaigns(cmpData.campaigns || []);
      if (smtpData?.success) {
        setSmtpConfigs(smtpData.configs || []);
      }
      if (setData?.success) setWidgetSettings(setData.settings || null);
      if (logData?.success) setLogs(logData.logs || []);
    } catch {
      handleNotify('error', 'Failed to refresh email marketing workspace.');
    }
  }, [handleNotify]);

  useEffect(() => {
    refreshMarketingState();
  }, [refreshMarketingState]);

  const tabs: {
    id: NewsletterAdminTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'subscribers', label: 'Subscribers', icon: Users },
    { id: 'campaigns', label: 'Campaigns', icon: Send },
    { id: 'templates', label: 'Marketing Templates', icon: FileCode2 },
    { id: 'settings', label: 'Widget & Logs', icon: SlidersHorizontal },
  ];

  return (
    <div className="min-h-screen bg-canvas text-primary">
      <AdminHeader />

      <main className="mx-auto max-w-canvas px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-accent">
              InfiniCharm Circle &amp; Dispatch Engine
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary mt-1">
              Newsletter &amp; Email Marketing
            </h1>
            <p className="text-xs sm:text-sm text-secondary mt-1 max-w-2xl">
              Manage database subscribers, segmented campaigns, marketing templates, and widget copy.
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
              href="/admin/email-notifications"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-primary hover:border-accent/50 transition-colors"
            >
              <BellRing className="w-3.5 h-3.5 text-accent" />
              Notifications Hub
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

        {/* Responsive Sub-Navigation Tabs */}
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

        {activeTab === 'subscribers' && (
          <SubscribersTab onNotify={handleNotify} onDataChanged={refreshMarketingState} />
        )}
        {activeTab === 'campaigns' && (
          <CampaignsTab
            campaigns={campaigns}
            templates={templates}
            smtpConfigs={smtpConfigs}
            onRefresh={refreshMarketingState}
            onNotify={handleNotify}
          />
        )}
        {activeTab === 'templates' && (
          <TemplatesTab
            templates={templates}
            onRefresh={refreshMarketingState}
            onNotify={handleNotify}
          />
        )}
        {activeTab === 'settings' && (
          <WidgetAndLogsTab
            settings={widgetSettings}
            templates={templates}
            logs={logs}
            onRefresh={refreshMarketingState}
            onNotify={handleNotify}
          />
        )}
      </main>
    </div>
  );
}

