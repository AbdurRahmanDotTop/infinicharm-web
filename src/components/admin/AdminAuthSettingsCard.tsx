'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  KeyRound,
  MailCheck,
  Save,
  Check,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import type { AuthSettings } from '@/types';

export function AdminAuthSettingsCard() {
  const [settings, setSettings] = useState<AuthSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/settings');
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Unable to load authentication policy.');
      }
      setSettings(data.settings);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Failed to load authentication policy settings.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleToggle = (key: keyof AuthSettings) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: !settings[key] });
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/auth/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to update authentication settings.');
      }
      setSettings(data.settings);
      setFeedback({
        type: 'success',
        text: data.message || 'Authentication policy updated and persisted.',
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Unable to save authentication policy.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      id="authentication"
      data-testid="admin-auth-settings-card"
      className="bg-surface rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-primary">
              Customer Authentication, Verification &amp; Security Policy
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Centralized control for storefront registration, WooCommerce checkout login/signup, mandatory email verification, password rules, and token expiry.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadSettings}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-dim border border-border text-xs font-semibold text-primary hover:border-accent transition-colors self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {feedback && (
        <div
          data-testid="auth-settings-feedback"
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {loading && !settings ? (
        <div className="py-8 text-center text-xs text-muted">Loading authentication policy...</div>
      ) : settings ? (
        <div className="space-y-6 text-xs">
          {/* 1. Entry Points & Verification Gate Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              {
                key: 'registrationEnabled' as const,
                title: 'Customer Registration',
                desc: 'Allow new customers to sign up on /register.',
              },
              {
                key: 'loginEnabled' as const,
                title: 'Customer Sign-In',
                desc: 'Allow verified customers to sign in on /login.',
              },
              {
                key: 'checkoutRegistrationEnabled' as const,
                title: 'Checkout Account Creation',
                desc: 'Show WooCommerce-style Create Account option at checkout.',
              },
              {
                key: 'checkoutInlineLoginEnabled' as const,
                title: 'Checkout Inline Login',
                desc: 'Show Returning Customer inline sign-in at checkout.',
              },
              {
                key: 'guestCheckoutEnabled' as const,
                title: 'Guest Checkout',
                desc: 'Allow checkout orders without an authenticated customer account.',
              },
              {
                key: 'requireEmailVerification' as const,
                title: 'Mandatory Email Verification',
                desc: 'Require single-use verification before customer login succeeds.',
              },
            ].map((item) => {
              const enabled = Boolean(settings[item.key]);
              return (
                <div
                  key={item.key}
                  className="p-3.5 rounded-2xl border border-border bg-surface-dim/50 flex items-start justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <span className="font-bold text-primary block">{item.title}</span>
                    <span className="text-[11px] text-muted leading-snug block">{item.desc}</span>
                  </div>
                  <button
                    type="button"
                    data-testid={`auth-toggle-${item.key}`}
                    onClick={() => handleToggle(item.key)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase shrink-0 transition-colors ${
                      enabled
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-zinc-200 text-zinc-700 border border-zinc-300'
                    }`}
                  >
                    {enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* 2. Password Complexity Rules */}
          <div className="p-4 sm:p-5 rounded-2xl border border-border bg-surface-dim/30 space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-accent" />
              <h3 className="font-bold text-primary text-sm">
                Password Policy &amp; Complexity Requirements
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
              <div>
                <label className="block font-semibold text-primary mb-1">
                  Minimum Length
                </label>
                <input
                  type="number"
                  min={6}
                  max={64}
                  data-testid="auth-min-password-length"
                  value={settings.minPasswordLength}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      minPasswordLength: Math.max(6, Math.min(64, Number(e.target.value) || 8)),
                    })
                  }
                  className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                />
              </div>

              {[
                { key: 'requireUppercase' as const, label: 'Require Uppercase (A-Z)' },
                { key: 'requireLowercase' as const, label: 'Require Lowercase (a-z)' },
                { key: 'requireNumber' as const, label: 'Require Number (0-9)' },
                { key: 'requireSpecialChar' as const, label: 'Require Symbol (!@#$)' },
              ].map((rule) => (
                <label
                  key={rule.key}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-surface border border-border cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    data-testid={`auth-rule-${rule.key}`}
                    checked={Boolean(settings[rule.key])}
                    onChange={() => handleToggle(rule.key)}
                    className="h-4 w-4 accent-accent rounded"
                  />
                  <span className="font-medium text-primary text-[11px]">{rule.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 3. Token Expiry, Rate Limits & Recovery Behavior */}
          <div className="p-4 sm:p-5 rounded-2xl border border-border bg-surface-dim/30 space-y-4">
            <div className="flex items-center gap-2">
              <MailCheck className="w-4 h-4 text-accent" />
              <h3 className="font-bold text-primary text-sm">
                Verification Tokens, Resend Limits &amp; Password Reset Flows
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-primary mb-1">
                  Verification Token TTL (Minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  max={10080}
                  value={settings.verificationTokenTtlMinutes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      verificationTokenTtlMinutes: Number(e.target.value) || 1440,
                    })
                  }
                  className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">
                  Resend Cooldown (Seconds)
                </label>
                <input
                  type="number"
                  min={10}
                  max={3600}
                  value={settings.verificationResendCooldownSeconds}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      verificationResendCooldownSeconds: Number(e.target.value) || 30,
                    })
                  }
                  className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">
                  Max Resend Requests / Hour
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.verificationResendMaxPerHour}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      verificationResendMaxPerHour: Number(e.target.value) || 5,
                    })
                  }
                  className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">
                  Password Reset Token TTL (Minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  value={settings.resetTokenTtlMinutes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      resetTokenTtlMinutes: Number(e.target.value) || 30,
                    })
                  }
                  className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">
                  Max Reset Requests / Hour
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.resetRequestMaxPerHour}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      resetRequestMaxPerHour: Number(e.target.value) || 5,
                    })
                  }
                  className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">
                  Password Reset Mode
                </label>
                <select
                  value={settings.passwordResetMode}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      passwordResetMode: e.target.value as AuthSettings['passwordResetMode'],
                    })
                  }
                  className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                >
                  <option value="LINK_AND_OTP">Secure Reset Link + 6-Digit OTP</option>
                  <option value="LINK_ONLY">Secure Reset Link Only</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">
                  Default Post-Verification Redirect
                </label>
                <select
                  value={settings.verificationRedirectPath}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      verificationRedirectPath: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                >
                  <option value="/account">Customer Account (/account)</option>
                  <option value="/checkout">Checkout Page (/checkout)</option>
                  <option value="/login">Sign-In Page (/login)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 4. Quick Links & Save CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-border">
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              <Link
                href="/admin/customers"
                className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
              >
                <span>Verify / Manage Customers</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              <Link
                href="/admin/email-templates"
                className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
              >
                <span>Auth Email Templates</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              <Link
                href="/admin/email-notifications"
                className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
              >
                <span>Email Delivery Logs</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              <Link
                href="/admin/audit-logs"
                className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
              >
                <span>Auth Audit Logs</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            <button
              type="button"
              data-testid="save-auth-settings-btn"
              disabled={saving}
              onClick={handleSave}
              className="px-6 py-2.5 bg-primary hover:bg-neutral-800 text-white font-bold rounded-xl shadow-xs transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-accent" />
              <span>{saving ? 'Saving Policy...' : 'Save Authentication Policy'}</span>
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
