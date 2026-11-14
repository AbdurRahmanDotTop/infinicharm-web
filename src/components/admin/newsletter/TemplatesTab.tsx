'use client';

import React, { useState } from 'react';
import { EmailTemplate, EmailTemplatePurpose } from '@/types';
import {
  Plus,
  Edit3,
  Copy,
  Trash2,
  Eye,
  Star,
  X,
  Loader2,
  Monitor,
  Smartphone,
  Send,
  Mail,
  Check,
} from 'lucide-react';
import { getAppOrigin, getUnsubscribeUrl } from '@/lib/utils/env-urls';

interface TemplatesTabProps {
  templates: EmailTemplate[];
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error', msg: string) => void;
}

const PURPOSES: EmailTemplatePurpose[] = [
  'TRANSACTIONAL',
  'ADMIN',
  'CUSTOMER',
  'VENDOR',
  'WELCOME',
  'MARKETING',
  'ANNOUNCEMENT',
  'GENERAL',
];

const VARIABLES = [
  '{{customer_name}}',
  '{{customer_email}}',
  '{{otp_code}}',
  '{{verification_link}}',
  '{{otp_expires_in}}',
  '{{link_expires_in}}',
  '{{order_number}}',
  '{{order_total}}',
  '{{order_status}}',
  '{{tracking_number}}',
  '{{courier_name}}',
  '{{enquiry_subject}}',
  '{{enquiry_message}}',
  '{{subscriber_name}}',
  '{{subscriber_email}}',
  '{{campaign_title}}',
  '{{store_url}}',
  '{{site_url}}',
  '{{site_name}}',
  '{{brand_name}}',
  '{{support_email}}',
  '{{current_year}}',
];

export function TemplatesTab({ templates, onRefresh, onNotify }: TemplatesTabProps) {
  const [purposeFilter, setPurposeFilter] = useState<EmailTemplatePurpose | 'ALL'>('ALL');
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [testEmailRecipient, setTestEmailRecipient] = useState('admin@infinicharm.com');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [purpose, setPurpose] = useState<EmailTemplatePurpose>('MARKETING');
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  const [isDefaultForPurpose, setIsDefaultForPurpose] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setSlug('');
    setPurpose('MARKETING');
    setSubject('{{campaign_title}} — InfiniCharm Dispatch');
    setPreviewText('');
    setHtmlContent(
      `<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #e7e1da;border-radius:14px;">
  <h2 style="margin-top:0;color:#181512;">{{campaign_title}}</h2>
  <p>Namaste {{subscriber_name}},</p>
  <p>Write your custom dispatch message here.</p>
  <p><a href="{{store_url}}/shop" style="color:#c2593f;font-weight:700;">Shop Now</a></p>
  <hr style="border:none;border-top:1px solid #e7e1da;margin:20px 0;"/>
  <p style="font-size:12px;color:#6f645b;">{{brand_name}} &bull; <a href="{{unsubscribe_url}}">Unsubscribe</a></p>
</div>`
    );
    setTextContent('Namaste {{subscriber_name}}, {{campaign_title}}. Unsubscribe: {{unsubscribe_url}}');
    setIsDefaultForPurpose(false);
    setEditorOpen(true);
  };

  const openEdit = (tpl: EmailTemplate) => {
    setEditing(tpl);
    setName(tpl.name);
    setSlug(tpl.slug);
    setPurpose(tpl.purpose);
    setSubject(tpl.subject);
    setPreviewText(tpl.previewText || '');
    setHtmlContent(tpl.htmlContent);
    setTextContent(tpl.textContent || '');
    setIsDefaultForPurpose(tpl.isDefaultForPurpose);
    setEditorOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editing
        ? `/api/admin/email-templates/${editing.id}`
        : '/api/admin/email-templates';
      const method = editing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug: slug || undefined,
          purpose,
          subject,
          previewText,
          htmlContent,
          textContent,
          isDefaultForPurpose,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify('error', data?.error || 'Could not save template.');
        return;
      }
      setEditorOpen(false);
      onNotify('success', editing ? 'Template updated.' : 'Template created.');
      await onRefresh();
    } catch {
      onNotify('error', 'Network error saving template.');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (tpl: EmailTemplate) => {
    try {
      const res = await fetch(`/api/admin/email-templates/${tpl.id}/duplicate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify('error', data?.error || 'Duplicate failed.');
        return;
      }
      onNotify('success', `Duplicated "${tpl.name}".`);
      await onRefresh();
    } catch {
      onNotify('error', 'Failed to duplicate template.');
    }
  };

  const handleSetDefault = async (tpl: EmailTemplate) => {
    try {
      const res = await fetch(`/api/admin/email-templates/${tpl.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefaultForPurpose: true }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify('error', data?.error || 'Failed to set default template.');
        return;
      }
      onNotify('success', `"${tpl.name}" set as default for ${tpl.purpose}.`);
      await onRefresh();
    } catch {
      onNotify('error', 'Error updating default template.');
    }
  };

  const handleDelete = async (tpl: EmailTemplate) => {
    try {
      const res = await fetch(`/api/admin/email-templates/${tpl.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify('error', data?.error || 'Could not delete template.');
        return;
      }
      onNotify('success', `Deleted "${tpl.name}".`);
      await onRefresh();
    } catch {
      onNotify('error', 'Error deleting template.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface border border-border rounded-2xl p-4">
        <div>
          <h2 className="font-display text-lg font-bold text-primary">Email Templates Library</h2>
          <p className="text-xs text-secondary">
            Manage welcome emails, marketing dispatches, and HTML blueprints with dynamic
            subscriber placeholders.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setPurposeFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer border ${
            purposeFilter === 'ALL'
              ? 'bg-primary text-surface border-primary'
              : 'bg-surface text-secondary border-border hover:text-primary'
          }`}
        >
          All ({templates.length})
        </button>
        {PURPOSES.map((p) => {
          const count = templates.filter((t) => t.purpose === p).length;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPurposeFilter(p)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer border ${
                purposeFilter === p
                  ? 'bg-primary text-surface border-primary'
                  : 'bg-surface text-secondary border-border hover:text-primary'
              }`}
            >
              {p} ({count})
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates
          .filter((tpl) => purposeFilter === 'ALL' || tpl.purpose === purposeFilter)
          .map((tpl) => (
          <div
            key={tpl.id}
            className="bg-surface border border-border rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xs"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-canvas border border-border text-primary">
                  {tpl.purpose}
                </span>
                {tpl.isDefaultForPurpose && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Star className="w-3 h-3" /> Default
                  </span>
                )}
              </div>
              <h3 className="font-display text-base font-bold text-primary">{tpl.name}</h3>
              <p className="text-xs text-secondary line-clamp-2">Subject: {tpl.subject}</p>
              <p className="text-[11px] text-muted font-mono">/{tpl.slug}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
              <button
                type="button"
                title="Live HTML Preview"
                data-testid={`preview-template-${tpl.id}`}
                onClick={() => setPreviewTemplate(tpl)}
                className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-primary inline-flex items-center gap-1 cursor-pointer hover:border-accent/60 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
              <button
                type="button"
                onClick={() => openEdit(tpl)}
                className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-primary inline-flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                type="button"
                onClick={() => handleDuplicate(tpl)}
                className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-primary inline-flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
              {!tpl.isDefaultForPurpose && (
                <button
                  type="button"
                  onClick={() => handleSetDefault(tpl)}
                  className="px-2.5 py-1.5 rounded-lg bg-canvas border border-border text-xs font-semibold text-primary cursor-pointer"
                >
                  Set Default
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDelete(tpl)}
                aria-label={`Delete ${tpl.name}`}
                className="ml-auto p-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Template Editor Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-level-2 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-lg font-bold text-primary">
                {editing ? 'Edit Email Template' : 'Create Email Template'}
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-primary mb-1">Template Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-sm text-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-primary mb-1">Purpose *</label>
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value as EmailTemplatePurpose)}
                    className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs font-semibold text-primary"
                  >
                    {PURPOSES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-primary mb-1">Subject Line *</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-sm text-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-primary mb-1">Slug</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="auto-generated-from-name"
                    className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs font-mono text-primary"
                  />
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <label className="font-semibold text-primary">HTML Body *</label>
                  <div className="flex flex-wrap gap-1">
                    {VARIABLES.map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => setHtmlContent((prev) => `${prev}\n${token}`)}
                        className="px-2 py-0.5 rounded bg-canvas border border-border font-mono text-[10px] text-primary hover:border-accent cursor-pointer"
                      >
                        + {token}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={10}
                  required
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  className="w-full bg-canvas border border-border rounded-xl p-3 text-xs font-mono text-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">Plain Text Fallback</label>
                <textarea
                  rows={3}
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  className="w-full bg-canvas border border-border rounded-xl p-3 text-xs font-mono text-primary"
                />
              </div>

              <label className="inline-flex items-center gap-2 font-semibold text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefaultForPurpose}
                  onChange={(e) => setIsDefaultForPurpose(e.target.checked)}
                />
                Set as default template for {purpose} emails
              </label>

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
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template Live HTML Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
          <div className="bg-surface border border-border rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-level-2">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 border-b border-border bg-surface-dim/40">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-base font-bold text-primary truncate">
                    Preview: {previewTemplate.name}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent uppercase">
                    {previewTemplate.purpose}
                  </span>
                </div>
                <p className="text-xs text-secondary truncate mt-0.5">
                  Subject: <strong className="text-primary">{previewTemplate.subject}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {/* Viewport Switcher */}
                <div className="flex items-center bg-surface border border-border rounded-xl p-0.5 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('desktop')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      previewViewport === 'desktop'
                        ? 'bg-accent text-white shadow-xs'
                        : 'text-muted hover:text-primary'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('mobile')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      previewViewport === 'mobile'
                        ? 'bg-accent text-white shadow-xs'
                        : 'text-muted hover:text-primary'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Mobile (375px)</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewTemplate(null)}
                  className="p-1.5 text-muted hover:text-primary rounded-lg hover:bg-border/30 transition-colors"
                  aria-label="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Frame Container */}
            <div className="flex-1 bg-neutral-100/90 dark:bg-neutral-900/60 p-4 sm:p-6 overflow-y-auto flex items-center justify-center min-h-[460px]">
              <div
                className={`transition-all duration-200 ${
                  previewViewport === 'mobile'
                    ? 'w-[375px] h-[560px] bg-white border-[8px] border-neutral-800 rounded-[32px] shadow-2xl overflow-hidden'
                    : 'w-full h-[520px] bg-white border border-border rounded-xl shadow-xs overflow-hidden'
                }`}
              >
                <iframe
                  title={`Preview ${previewTemplate.name}`}
                  sandbox=""
                  srcDoc={previewTemplate.htmlContent
                    .replaceAll('{{customer_name}}', 'Aarav Sharma')
                    .replaceAll('{{customer_email}}', 'aarav.sharma@example.com')
                    .replaceAll('{{subscriber_name}}', 'Aarav Sharma')
                    .replaceAll('{{subscriber_email}}', 'aarav.sharma@example.com')
                    .replaceAll('{{otp_code}}', '482910')
                    .replaceAll('{{verification_code}}', '482910')
                    .replaceAll(
                      '{{verification_link}}',
                      `${getAppOrigin()}/verify-email?token=sample_verification_token_482910`
                    )
                    .replaceAll(
                      '{{verification_url}}',
                      `${getAppOrigin()}/verify-email?token=sample_verification_token_482910`
                    )
                    .replaceAll('{{otp_expires_in}}', '60 minutes')
                    .replaceAll('{{link_expires_in}}', '60 minutes')
                    .replaceAll('{{expiry_minutes}}', '60')
                    .replaceAll('{{order_number}}', 'INF-202611-TEST')
                    .replaceAll('{{order_total}}', '₹1,249.00')
                    .replaceAll('{{order_status}}', 'CONFIRMED')
                    .replaceAll('{{tracking_number}}', 'DELHIVERY-99887766')
                    .replaceAll('{{courier_name}}', 'Delhivery Express')
                    .replaceAll('{{enquiry_subject}}', 'General Product Query')
                    .replaceAll('{{enquiry_message}}', 'Hello, I have a question regarding my order.')
                    .replaceAll('{{campaign_title}}', previewTemplate.name)
                    .replaceAll('{{store_url}}', getAppOrigin())
                    .replaceAll('{{site_url}}', getAppOrigin())
                    .replaceAll('{{unsubscribe_url}}', getUnsubscribeUrl())
                    .replaceAll('{{brand_name}}', 'InfiniCharm (TechilyFly India)')
                    .replaceAll('{{site_name}}', 'InfiniCharm (TechilyFly India)')
                    .replaceAll('{{support_email}}', 'support@infinicharm.com')
                    .replaceAll('{{current_year}}', String(new Date().getFullYear()))}
                  className="w-full h-full bg-white"
                />
              </div>
            </div>

            {/* Test Email Dispatch Footer */}
            <div className="px-5 py-3 border-t border-border bg-surface flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-muted">
                <Mail className="w-4 h-4 text-accent shrink-0" />
                <span className="font-semibold text-primary">Send Test Email:</span>
                <span className="hidden md:inline text-[11px]">
                  Dispatch an actual test delivery using configured SMTP credentials.
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="email"
                  value={testEmailRecipient}
                  onChange={(e) => setTestEmailRecipient(e.target.value)}
                  placeholder="test-recipient@example.com"
                  aria-label="Test recipient email"
                  className="flex-1 sm:w-60 px-3 py-1.5 rounded-xl border border-border bg-surface text-primary text-xs focus:outline-none focus:border-accent"
                />
                <button
                  type="button"
                  disabled={sendingTestEmail || !testEmailRecipient.trim()}
                  onClick={async () => {
                    const recipient = testEmailRecipient.trim().toLowerCase();
                    if (!recipient) {
                      onNotify('error', 'Please enter a test recipient email.');
                      return;
                    }
                    setSendingTestEmail(true);
                    try {
                      const res = await fetch('/api/admin/email-templates/test', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          templateId: previewTemplate.id,
                          recipientEmail: recipient,
                          subject: previewTemplate.subject,
                          htmlContent: previewTemplate.htmlContent,
                          textContent: previewTemplate.textContent,
                        }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok && data?.success) {
                        onNotify(
                          'success',
                          data.message || `Test email dispatched to ${recipient}.`
                        );
                      } else {
                        onNotify(
                          'error',
                          data?.error || 'Failed to dispatch test email. Check SMTP settings.'
                        );
                      }
                    } catch {
                      onNotify('error', 'Network error while attempting test email dispatch.');
                    } finally {
                      setSendingTestEmail(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-white font-semibold text-xs hover:bg-neutral-800 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {sendingTestEmail ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-accent" />
                  )}
                  <span>{sendingTestEmail ? 'Sending...' : 'Send Test Email'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

