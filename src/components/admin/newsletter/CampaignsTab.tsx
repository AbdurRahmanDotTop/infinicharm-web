'use client';

import React, { useEffect, useState } from 'react';
import {
  CampaignRecipientSegment,
  EmailCampaign,
  EmailTemplate,
  NewsletterSubscriber,
  SanitizedSmtpConfig,
} from '@/types';
import {
  Plus,
  Edit3,
  Copy,
  Trash2,
  Send,
  Eye,
  MailCheck,
  X,
  Loader2,
  Users,
} from 'lucide-react';
import { getAppOrigin, getUnsubscribeUrl } from '@/lib/utils/env-urls';

interface CampaignsTabProps {
  campaigns: EmailCampaign[];
  templates: EmailTemplate[];
  smtpConfigs: SanitizedSmtpConfig[];
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error', msg: string) => void;
}

const CAMPAIGN_STATUS_BADGE: Record<EmailCampaign['status'], string> = {
  DRAFT: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  SENDING: 'bg-blue-50 text-blue-700 border-blue-200',
  SENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PARTIAL: 'bg-amber-50 text-amber-800 border-amber-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
};

export function CampaignsTab({
  campaigns,
  templates,
  smtpConfigs,
  onRefresh,
  onNotify,
}: CampaignsTabProps) {
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<EmailCampaign | null>(null);
  const [previewCampaign, setPreviewCampaign] = useState<EmailCampaign | null>(null);
  const [saving, setSaving] = useState(false);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  const [testModalCampaign, setTestModalCampaign] = useState<EmailCampaign | null>(null);
  const [testEmail, setTestEmail] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [templateId, setTemplateId] = useState<string>('');
  const [smtpConfigId, setSmtpConfigId] = useState<string>('');
  const [senderName, setSenderName] = useState('InfiniCharm');
  const [senderEmail, setSenderEmail] = useState('support@infinicharm.com');
  const [replyToEmail, setReplyToEmail] = useState('support@infinicharm.com');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  const [segment, setSegment] = useState<CampaignRecipientSegment>('ALL_ACTIVE');
  const [selectedSubscriberIds, setSelectedSubscriberIds] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState('');

  useEffect(() => {
    fetch('/api/admin/newsletter/subscribers?limit=500', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          setSubscribers(data.subscribers || []);
          setSources(data.sources || []);
        }
      })
      .catch(() => {});
  }, [campaigns]);

  const activeSubscribers = subscribers.filter((s) => s.status === 'ACTIVE');

  const computedEligibleCount = (() => {
    if (segment === 'ALL_ACTIVE') return activeSubscribers.length;
    if (segment === 'CUSTOM_SELECTION') {
      const ids = new Set(selectedSubscriberIds);
      return activeSubscribers.filter((s) => ids.has(s.id)).length;
    }
    return activeSubscribers.filter(
      (s) => !sourceFilter || s.source.toLowerCase() === sourceFilter.toLowerCase()
    ).length;
  })();

  const applyTemplateToForm = (tplId: string) => {
    setTemplateId(tplId);
    const tpl = templates.find((t) => t.id === tplId);
    if (tpl) {
      setSubject(tpl.subject);
      setHtmlContent(tpl.htmlContent);
      setTextContent(tpl.textContent || '');
    }
  };

  const applySmtpToForm = (id: string) => {
    setSmtpConfigId(id);
    const cfg = smtpConfigs.find((c) => c.id === id);
    if (cfg) {
      setSenderName(cfg.senderName);
      setSenderEmail(cfg.senderEmail);
      setReplyToEmail(cfg.replyToEmail || cfg.senderEmail);
    }
  };

  const openCreate = () => {
    const defaultSmtp = smtpConfigs.find((c) => c.isDefault && c.isEnabled) || smtpConfigs[0];
    const defaultTpl =
      templates.find((t) => t.purpose === 'MARKETING' && t.isDefaultForPurpose) || templates[0];

    setEditing(null);
    setName('');
    setTemplateId(defaultTpl?.id || '');
    setSubject(defaultTpl?.subject || 'InfiniCharm Community Harvest Update');
    setHtmlContent(
      defaultTpl?.htmlContent ||
        `<div style="font-family:Inter,Arial,sans-serif;padding:24px;">
  <h2>{{campaign_title}}</h2>
  <p>Namaste {{subscriber_name}},</p>
  <p>Share your update here.</p>
  <p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>
</div>`
    );
    setTextContent(defaultTpl?.textContent || '');
    setSmtpConfigId(defaultSmtp?.id || '');
    setSenderName(defaultSmtp?.senderName || 'InfiniCharm');
    setSenderEmail(defaultSmtp?.senderEmail || 'support@infinicharm.com');
    setReplyToEmail(defaultSmtp?.replyToEmail || defaultSmtp?.senderEmail || 'support@infinicharm.com');
    setSegment('ALL_ACTIVE');
    setSelectedSubscriberIds([]);
    setSourceFilter('');
    setEditorOpen(true);
  };

  const openEdit = (cmp: EmailCampaign) => {
    setEditing(cmp);
    setName(cmp.name);
    setSubject(cmp.subject);
    setTemplateId(cmp.templateId || '');
    setSmtpConfigId(cmp.smtpConfigId || '');
    setSenderName(cmp.senderName);
    setSenderEmail(cmp.senderEmail);
    setReplyToEmail(cmp.replyToEmail || cmp.senderEmail);
    setHtmlContent(cmp.htmlContent);
    setTextContent(cmp.textContent || '');
    setSegment(cmp.segment);
    setSelectedSubscriberIds(cmp.selectedSubscriberIds || []);
    setSourceFilter(cmp.sourceFilter || '');
    setEditorOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editing ? `/api/admin/campaigns/${editing.id}` : '/api/admin/campaigns';
      const method = editing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          subject,
          templateId: templateId || null,
          smtpConfigId: smtpConfigId || null,
          senderName,
          senderEmail,
          replyToEmail,
          htmlContent,
          textContent,
          segment,
          selectedSubscriberIds,
          sourceFilter,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify('error', data?.error || 'Failed to save campaign.');
        return;
      }
      setEditorOpen(false);
      onNotify('success', editing ? 'Campaign updated.' : 'Campaign draft saved.');
      await onRefresh();
    } catch {
      onNotify('error', 'Network error saving campaign.');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (cmp: EmailCampaign) => {
    try {
      const res = await fetch(`/api/admin/campaigns/${cmp.id}/duplicate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify('error', data?.error || 'Could not duplicate campaign.');
        return;
      }
      onNotify('success', `Duplicated "${cmp.name}".`);
      await onRefresh();
    } catch {
      onNotify('error', 'Failed to duplicate campaign.');
    }
  };

  const handleDelete = async (cmp: EmailCampaign) => {
    try {
      const res = await fetch(`/api/admin/campaigns/${cmp.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify('error', data?.error || 'Could not delete campaign.');
        return;
      }
      onNotify('success', `Deleted campaign "${cmp.name}".`);
      await onRefresh();
    } catch {
      onNotify('error', 'Failed to delete campaign.');
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testModalCampaign || !testEmail.trim()) return;
    setDispatchingId(testModalCampaign.id);
    try {
      const res = await fetch(`/api/admin/campaigns/${testModalCampaign.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'test', testEmail: testEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify('error', data?.error || 'Test delivery failed.');
        return;
      }
      setTestModalCampaign(null);
      setTestEmail('');
      onNotify('success', `Test campaign email sent to ${testEmail.trim()}.`);
      await onRefresh();
    } catch {
      onNotify('error', 'Failed to send test campaign.');
    } finally {
      setDispatchingId(null);
    }
  };

  const handleSendLiveCampaign = async (cmp: EmailCampaign) => {
    setDispatchingId(cmp.id);
    try {
      const res = await fetch(`/api/admin/campaigns/${cmp.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'send' }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify('error', data?.error || 'Campaign delivery failed.');
      } else {
        onNotify(
          'success',
          `Campaign sent: ${data.sentCount} delivered, ${data.failedCount} failed (${data.skippedCount} unsubscribed/suppressed excluded).`
        );
      }
      await onRefresh();
    } catch {
      onNotify('error', 'Network error dispatching campaign.');
    } finally {
      setDispatchingId(null);
    }
  };

  const toggleCustomSubscriber = (id: string) => {
    setSelectedSubscriberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface border border-border rounded-2xl p-4">
        <div>
          <h2 className="font-display text-lg font-bold text-primary">
            Email Marketing Campaigns
          </h2>
          <p className="text-xs text-secondary">
            Compose campaigns from templates, target active subscribers only, send live tests, and
            track real SMTP/Brevo dispatch counts.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center space-y-2">
          <p className="text-sm font-semibold text-primary">No email campaigns created yet</p>
          <p className="text-xs text-muted max-w-md mx-auto">
            Create your first campaign above. Unsubscribed, bounced, and suppressed contacts are
            automatically excluded at send time.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((cmp) => (
            <div
              key={cmp.id}
              className="bg-surface border border-border rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      CAMPAIGN_STATUS_BADGE[cmp.status]
                    }`}
                  >
                    {cmp.status}
                  </span>
                  <h3 className="font-display text-base font-bold text-primary">{cmp.name}</h3>
                </div>
                <p className="text-xs text-secondary truncate">Subject: {cmp.subject}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                  <span>Sender: {cmp.senderName} &lt;{cmp.senderEmail}&gt;</span>
                  <span>Segment: {cmp.segment}</span>
                  <span>Eligible Active: {cmp.eligibleCount}</span>
                  <span>Sent: {cmp.sentCount}</span>
                  <span>Failed: {cmp.failedCount}</span>
                  <span>Excluded: {cmp.skippedCount}</span>
                </div>
                {cmp.lastError && (
                  <p className="text-xs text-red-600 font-medium">{cmp.lastError}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewCampaign(cmp)}
                  className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-primary inline-flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(cmp)}
                  className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-primary inline-flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDuplicate(cmp)}
                  className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-primary inline-flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTestModalCampaign(cmp);
                    setTestEmail('');
                  }}
                  className="px-3 py-1.5 rounded-xl border border-border bg-canvas text-xs font-semibold text-primary inline-flex items-center gap-1 cursor-pointer"
                >
                  <MailCheck className="w-3.5 h-3.5" /> Test Email
                </button>
                <button
                  type="button"
                  disabled={dispatchingId === cmp.id}
                  onClick={() => handleSendLiveCampaign(cmp)}
                  className="px-3.5 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {dispatchingId === cmp.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Send Now
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(cmp)}
                  aria-label={`Delete campaign ${cmp.name}`}
                  className="p-2 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Campaign Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-level-2 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-lg font-bold text-primary">
                {editing ? 'Edit Email Campaign' : 'Create Email Campaign'}
              </h3>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="p-1 text-muted hover:text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-primary mb-1">Campaign Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="November Harvest Dispatch"
                    className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-sm text-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Load From Email Template
                  </label>
                  <select
                    value={templateId}
                    onChange={(e) => applyTemplateToForm(e.target.value)}
                    className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs font-semibold text-primary"
                  >
                    <option value="">-- Custom Content --</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.purpose})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">Email Subject *</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-sm text-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-primary mb-1">Delivery Provider</label>
                  <select
                    value={smtpConfigId}
                    onChange={(e) => applySmtpToForm(e.target.value)}
                    className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs font-semibold text-primary"
                  >
                    <option value="">Default Active SMTP</option>
                    {smtpConfigs.map((cfg) => (
                      <option key={cfg.id} value={cfg.id}>
                        {cfg.name} ({cfg.isEnabled ? 'Enabled' : 'Disabled'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-primary mb-1">Sender Name *</label>
                  <input
                    type="text"
                    required
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs text-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-primary mb-1">Sender Email *</label>
                  <input
                    type="email"
                    required
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs text-primary"
                  />
                </div>
              </div>

              {/* Recipient Segment Selector */}
              <div className="p-4 rounded-xl bg-canvas border border-border space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 font-bold text-primary">
                    <Users className="w-4 h-4 text-accent" />
                    Recipient Audience (Unsubscribed / Bounced Always Excluded)
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                    {computedEligibleCount} Eligible Active Recipients
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { value: 'ALL_ACTIVE', label: 'All Active Subscribers' },
                    { value: 'SOURCE_FILTER', label: 'Filter by Source' },
                    { value: 'CUSTOM_SELECTION', label: 'Select Subscribers Manually' },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2 font-semibold ${
                        segment === opt.value
                          ? 'border-accent bg-accent/10 text-primary'
                          : 'border-border bg-surface text-secondary'
                      }`}
                    >
                      <input
                        type="radio"
                        name="campaign-segment"
                        value={opt.value}
                        checked={segment === opt.value}
                        onChange={() => setSegment(opt.value as CampaignRecipientSegment)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>

                {segment === 'SOURCE_FILTER' && (
                  <div>
                    <label className="block font-semibold text-primary mb-1">Source</label>
                    <select
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                      className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-primary"
                    >
                      <option value="">All Sources</option>
                      {sources.map((src) => (
                        <option key={src} value={src}>
                          {src}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {segment === 'CUSTOM_SELECTION' && (
                  <div className="max-h-40 overflow-y-auto border border-border rounded-xl bg-surface p-2 space-y-1">
                    {activeSubscribers.length === 0 ? (
                      <p className="text-muted text-center py-3">No active subscribers available.</p>
                    ) : (
                      activeSubscribers.map((sub) => (
                        <label
                          key={sub.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-canvas cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSubscriberIds.includes(sub.id)}
                            onChange={() => toggleCustomSubscriber(sub.id)}
                          />
                          <span className="font-semibold text-primary">{sub.email}</span>
                          {sub.fullName && (
                            <span className="text-muted">({sub.fullName})</span>
                          )}
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">
                  Campaign HTML Body * (unsubscribe footer enforced automatically)
                </label>
                <textarea
                  rows={8}
                  required
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  className="w-full bg-canvas border border-border rounded-xl p-3 text-xs font-mono text-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">Plain Text Content</label>
                <textarea
                  rows={3}
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  className="w-full bg-canvas border border-border rounded-xl p-3 text-xs font-mono text-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
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
                  Save Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Email Modal */}
      {testModalCampaign && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-level-2 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-base font-bold text-primary">
                Send Test Email: {testModalCampaign.name}
              </h3>
              <button
                type="button"
                onClick={() => setTestModalCampaign(null)}
                className="p-1 text-muted hover:text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSendTest} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-primary mb-1">
                  Recipient Test Email *
                </label>
                <input
                  type="email"
                  required
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="admin@infinicharm.com"
                  className="w-full bg-canvas border border-border rounded-xl px-3 py-2.5 text-sm text-primary"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setTestModalCampaign(null)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dispatchingId === testModalCampaign.id}
                  className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  {dispatchingId === testModalCampaign.id && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  Send Test Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Campaign HTML Preview Modal */}
      {previewCampaign && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-level-2">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="font-display text-base font-bold text-primary">
                  Campaign Preview: {previewCampaign.name}
                </h3>
                <p className="text-xs text-secondary">Subject: {previewCampaign.subject}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewCampaign(null)}
                className="p-1 text-muted hover:text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe
              title={`Campaign Preview ${previewCampaign.name}`}
              sandbox=""
              srcDoc={previewCampaign.htmlContent
                .replaceAll('{{subscriber_name}}', 'Valued Patron')
                .replaceAll('{{subscriber_email}}', 'support@infinicharm.com')
                .replaceAll('{{campaign_title}}', previewCampaign.name)
                .replaceAll('{{store_url}}', getAppOrigin())
                .replaceAll('{{unsubscribe_url}}', getUnsubscribeUrl())
                .replaceAll('{{brand_name}}', 'InfiniCharm (Techily Fly)')
                .replaceAll('{{support_email}}', 'support@infinicharm.com')}
              className="w-full h-[520px] bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}

