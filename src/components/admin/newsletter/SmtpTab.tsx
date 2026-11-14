'use client';

import React, { useState } from 'react';
import {
  SanitizedSmtpConfig,
  SmtpEncryptionType,
  SmtpProviderType,
} from '@/types';
import {
  Plus,
  Edit3,
  Trash2,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertCircle,
  Lock,
  X,
  Loader2,
  Star,
} from 'lucide-react';

interface SmtpTabProps {
  configs: SanitizedSmtpConfig[];
  envBrevoConfigured: boolean;
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error', msg: string) => void;
}

export function SmtpTab({
  configs,
  envBrevoConfigured,
  onRefresh,
  onNotify,
}: SmtpTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SanitizedSmtpConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const [testingId, setTestingId] = useState<string | null>(null);
  const [testEmailInputs, setTestEmailInputs] = useState<Record<string, string>>({});

  // Form fields
  const [name, setName] = useState('');
  const [providerType, setProviderType] = useState<SmtpProviderType>('CUSTOM_SMTP');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(587);
  const [encryption, setEncryption] = useState<SmtpEncryptionType>('STARTTLS');
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const [useEnvCredentials, setUseEnvCredentials] = useState(false);
  const [senderName, setSenderName] = useState('InfiniCharm');
  const [senderEmail, setSenderEmail] = useState('support@infinicharm.com');
  const [replyToEmail, setReplyToEmail] = useState('support@infinicharm.com');
  const [isDefault, setIsDefault] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setProviderType('CUSTOM_SMTP');
    setHost('smtp.gmail.com');
    setPort(587);
    setEncryption('STARTTLS');
    setUsername('');
    setSecret('');
    setUseEnvCredentials(false);
    setSenderName('InfiniCharm');
    setSenderEmail('support@infinicharm.com');
    setReplyToEmail('support@infinicharm.com');
    setIsDefault(false);
    setIsEnabled(true);
    setModalOpen(true);
  };

  const openEdit = (cfg: SanitizedSmtpConfig) => {
    setEditing(cfg);
    setName(cfg.name);
    setProviderType(cfg.providerType);
    setHost(cfg.host);
    setPort(cfg.port);
    setEncryption(cfg.encryption);
    setUsername(cfg.username);
    setSecret(''); // Never prefilled from backend; blank preserves existing encrypted secret
    setUseEnvCredentials(Boolean(cfg.useEnvCredentials));
    setSenderName(cfg.senderName);
    setSenderEmail(cfg.senderEmail);
    setReplyToEmail(cfg.replyToEmail || cfg.senderEmail);
    setIsDefault(cfg.isDefault);
    setIsEnabled(cfg.isEnabled);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        providerType,
        host,
        port: Number(port),
        encryption,
        username,
        useEnvCredentials,
        senderName,
        senderEmail,
        replyToEmail,
        isDefault,
        isEnabled,
      };
      if (secret.trim()) {
        payload.secret = secret.trim();
      }

      const url = editing ? `/api/admin/smtp/${editing.id}` : '/api/admin/smtp';
      const method = editing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify('error', data?.error || 'Could not save SMTP configuration.');
        return;
      }
      setModalOpen(false);
      onNotify(
        'success',
        editing ? 'SMTP configuration updated.' : 'New SMTP configuration saved.'
      );
      await onRefresh();
    } catch {
      onNotify('error', 'Network error saving SMTP configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (cfg: SanitizedSmtpConfig, sendTestEmail: boolean) => {
    const recipient = (testEmailInputs[cfg.id] || '').trim();
    if (sendTestEmail && !recipient) {
      onNotify('error', 'Enter a recipient email to send a live test email.');
      return;
    }

    setTestingId(cfg.id);
    try {
      const res = await fetch(`/api/admin/smtp/${cfg.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sendTestEmail ? { testEmail: recipient } : {}),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify('error', data?.error || data?.message || 'SMTP verification failed.');
      } else {
        onNotify('success', data.message || 'SMTP connection verified.');
      }
      await onRefresh();
    } catch {
      onNotify('error', 'Failed to contact SMTP verification endpoint.');
    } finally {
      setTestingId(null);
    }
  };

  const handleSetDefault = async (cfg: SanitizedSmtpConfig) => {
    try {
      const res = await fetch(`/api/admin/smtp/${cfg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true, isEnabled: true }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify('error', data?.error || 'Could not switch default provider.');
        return;
      }
      onNotify('success', `${cfg.name} is now the active default provider.`);
      await onRefresh();
    } catch {
      onNotify('error', 'Error updating default provider.');
    }
  };

  const handleToggleEnabled = async (cfg: SanitizedSmtpConfig) => {
    try {
      const res = await fetch(`/api/admin/smtp/${cfg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !cfg.isEnabled }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify('error', data?.error || 'Could not toggle provider state.');
        return;
      }
      onNotify('success', `${cfg.name} ${!cfg.isEnabled ? 'enabled' : 'disabled'}.`);
      await onRefresh();
    } catch {
      onNotify('error', 'Error toggling provider state.');
    }
  };

  const handleDelete = async (cfg: SanitizedSmtpConfig) => {
    try {
      const res = await fetch(`/api/admin/smtp/${cfg.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify('error', data?.error || 'Could not delete SMTP configuration.');
        return;
      }
      onNotify('success', `Removed "${cfg.name}".`);
      await onRefresh();
    } catch {
      onNotify('error', 'Failed to delete SMTP configuration.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface border border-border rounded-2xl p-4">
        <div>
          <h2 className="font-display text-lg font-bold text-primary">
            Brevo & Custom SMTP Providers
          </h2>
          <p className="text-xs text-secondary">
            Secrets are encrypted at rest with AES-256-GCM or loaded from server env variables —
            never exposed to client browsers. Brevo Server Env Status:{' '}
            <strong className={envBrevoConfigured ? 'text-emerald-700' : 'text-red-700'}>
              {envBrevoConfigured ? 'Configured (.env.local)' : 'Missing'}
            </strong>
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Custom SMTP / Brevo
        </button>
      </div>

      <div className="space-y-4">
        {configs.map((cfg) => (
          <div
            key={cfg.id}
            className="bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-xs"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-surface">
                    {cfg.providerType}
                  </span>
                  {cfg.isDefault && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Star className="w-3 h-3" /> Default Sender
                    </span>
                  )}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      cfg.isEnabled
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                    }`}
                  >
                    {cfg.isEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                  <h3 className="font-display text-base font-bold text-primary">{cfg.name}</h3>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-secondary">
                  <span>
                    Host: <strong className="font-mono">{cfg.host}:{cfg.port}</strong> ({cfg.encryption})
                  </span>
                  <span>
                    Sender: {cfg.senderName} &lt;{cfg.senderEmail}&gt;
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted">
                    <Lock className="w-3 h-3" />
                    Secret: {cfg.maskedSecret}
                  </span>
                </div>

                {cfg.lastTestMessage && (
                  <div
                    className={`inline-flex items-center gap-1.5 text-xs font-medium mt-1 ${
                      cfg.lastTestStatus === 'SUCCESS' ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {cfg.lastTestStatus === 'SUCCESS' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{cfg.lastTestMessage}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!cfg.isDefault && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(cfg)}
                    className="px-3 py-1.5 rounded-xl border border-border bg-canvas text-xs font-semibold text-primary cursor-pointer"
                  >
                    Set Default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleToggleEnabled(cfg)}
                  className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-primary cursor-pointer"
                >
                  {cfg.isEnabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(cfg)}
                  className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-primary inline-flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(cfg)}
                  aria-label={`Delete ${cfg.name}`}
                  className="p-2 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Live Connection Verification & Test Email Strip */}
            <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center gap-2.5">
              <button
                type="button"
                disabled={testingId === cfg.id}
                onClick={() => handleTest(cfg, false)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-surface text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {testingId === cfg.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                Verify Connection
              </button>

              <div className="flex flex-1 min-w-0 items-center gap-2">
                <input
                  type="email"
                  value={testEmailInputs[cfg.id] || ''}
                  onChange={(e) =>
                    setTestEmailInputs((prev) => ({ ...prev, [cfg.id]: e.target.value }))
                  }
                  placeholder="Enter email for live test send..."
                  className="flex-1 min-w-0 bg-canvas border border-border rounded-xl px-3 py-2 text-xs text-primary"
                />
                <button
                  type="button"
                  disabled={testingId === cfg.id}
                  onClick={() => handleTest(cfg, true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold whitespace-nowrap cursor-pointer disabled:opacity-60"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Send Test Email
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit SMTP Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-level-2 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-lg font-bold text-primary">
                {editing ? 'Edit SMTP Provider' : 'Add SMTP Provider'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-muted hover:text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-primary mb-1">Provider Label *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Brevo Primary / Zoho / Custom Relay"
                    className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-sm text-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-primary mb-1">Provider Type *</label>
                  <select
                    value={providerType}
                    onChange={(e) => {
                      const next = e.target.value as SmtpProviderType;
                      setProviderType(next);
                      if (next === 'BREVO') {
                        setHost('smtp-relay.brevo.com');
                        setPort(587);
                        setEncryption('STARTTLS');
                      }
                    }}
                    className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs font-semibold text-primary"
                  >
                    <option value="BREVO">BREVO</option>
                    <option value="CUSTOM_SMTP">CUSTOM_SMTP</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block font-semibold text-primary mb-1">Host *</label>
                  <input
                    type="text"
                    required
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs font-mono text-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-primary mb-1">Port *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={65535}
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs text-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-primary mb-1">Encryption *</label>
                  <select
                    value={encryption}
                    onChange={(e) => setEncryption(e.target.value as SmtpEncryptionType)}
                    className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs font-semibold text-primary"
                  >
                    <option value="STARTTLS">STARTTLS (587)</option>
                    <option value="SSL">SSL / TLS (465)</option>
                    <option value="NONE">NONE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-primary mb-1">SMTP Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs text-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-primary mb-1">
                    {editing
                      ? 'New Password / API Key (leave blank to keep existing)'
                      : 'Password / API Key'}
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder={editing?.hasSecret ? '•••••••• (saved securely)' : 'Enter SMTP secret'}
                    className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs text-primary"
                  />
                </div>
              </div>

              {providerType === 'BREVO' && (
                <label className="inline-flex items-center gap-2 font-semibold text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useEnvCredentials}
                    onChange={(e) => setUseEnvCredentials(e.target.checked)}
                  />
                  Read Brevo credential securely from server BREVO_API_KEY env var
                </label>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <div>
                  <label className="block font-semibold text-primary mb-1">Reply-To Email</label>
                  <input
                    type="email"
                    value={replyToEmail}
                    onChange={(e) => setReplyToEmail(e.target.value)}
                    className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs text-primary"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <label className="inline-flex items-center gap-2 font-semibold text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                  />
                  Set as default sending provider
                </label>
                <label className="inline-flex items-center gap-2 font-semibold text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                  />
                  Provider enabled
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
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
                  Save Provider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

