'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { validatePasswordAgainstPolicy } from '@/lib/validation/auth';
import type { PublicAuthSettings } from '@/types';
import { KeyRound, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams?.get('token') || '';
  const emailParam = searchParams?.get('email') || '';

  const [policy, setPolicy] = useState<PublicAuthSettings | null>(null);
  const [tokenCheck, setTokenCheck] = useState<{
    checked: boolean;
    valid: boolean;
    error?: string;
  }>({ checked: !tokenParam, valid: !tokenParam });

  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d.settings) setPolicy(d.settings);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!tokenParam) return;
    fetch(`/api/auth/customer/reset-password?token=${encodeURIComponent(tokenParam)}`, {
      cache: 'no-store',
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        setTokenCheck({
          checked: true,
          valid: Boolean(r.ok && data?.valid),
          error: data?.error || 'Password reset link is invalid, expired, or already used.',
        });
      })
      .catch(() => {
        setTokenCheck({
          checked: true,
          valid: false,
          error: 'Unable to validate reset link right now.',
        });
      });
  }, [tokenParam]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!tokenParam && otp.length !== 6) {
      setError('Please provide the 6-digit recovery PIN sent to your email.');
      return;
    }

    const pwCheck = validatePasswordAgainstPolicy(newPassword, policy || undefined);
    if (!pwCheck.valid) {
      setError(pwCheck.errors[0] || 'Password does not meet security policy requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/customer/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          tokenParam
            ? { token: tokenParam, newPassword }
            : { email: email.trim().toLowerCase(), otp: otp.trim(), newPassword }
        ),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error || 'Reset link or PIN is invalid or expired.');
        setIsSubmitting(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login?reset=1');
      }, 900);
    } catch {
      setError('Network error resetting password. Please retry.');
      setIsSubmitting(false);
    }
  };

  if (tokenParam && !tokenCheck.checked) {
    return (
      <Card level={1} className="p-8 text-center space-y-3">
        <Loader2 className="w-7 h-7 animate-spin text-accent mx-auto" />
        <p className="text-xs font-medium text-muted">Validating single-use reset link...</p>
      </Card>
    );
  }

  if (tokenParam && tokenCheck.checked && !tokenCheck.valid) {
    return (
      <Card level={1} data-testid="reset-token-invalid-card" className="p-6 sm:p-8 space-y-4 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="font-display text-lg font-bold text-primary">
          Password Reset Link Unavailable
        </h2>
        <p className="text-xs text-muted leading-relaxed">{tokenCheck.error}</p>
        <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold"
          >
            Request New Reset Link
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-surface-dim border border-border text-xs font-semibold text-primary"
          >
            Return to Login
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card level={1} className="p-6 sm:p-8 space-y-6">
      {success ? (
        <div data-testid="reset-password-success" className="text-center py-6 space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="font-display text-lg font-bold text-primary">Password Reset Successful</h3>
          <p className="text-xs text-muted leading-relaxed">
            Your new password has been saved and previous active sessions were closed. Redirecting to login...
          </p>
        </div>
      ) : (
        <form onSubmit={handleReset} className="space-y-4 text-xs">
          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!tokenParam && (
            <>
              <div>
                <label className="block font-semibold text-primary mb-1">
                  Account Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-primary">6-Digit Recovery PIN</label>
                  <span className="text-[10px] text-muted">Sent to your registered email</span>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono tracking-widest text-sm focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            </>
          )}

          <PasswordInput
            label="New Password"
            placeholder="Create a strong new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            showStrengthMeter={true}
            policy={policy}
          />

          <PasswordInput
            label="Confirm New Password"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            error={
              confirmPassword.length > 0 && confirmPassword !== newPassword
                ? 'Passwords do not match.'
                : undefined
            }
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Updating Credentials...' : 'Set New Password'}
          </button>
        </form>
      )}

      <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-muted hover:text-primary transition-colors font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Login</span>
        </Link>
        <Link href="/forgot-password" className="hover:text-accent underline">
          Request New Link
        </Link>
      </div>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="py-12 sm:py-16 bg-canvas min-h-[calc(100vh-200px)] flex items-center">
      <Container>
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <BrandLogo variant="light" size="md" href="/" showTagline={true} />
            </div>
            <h1 className="font-display text-2xl font-bold text-primary">
              Set New Account Password
            </h1>
            <p className="text-xs text-muted">
              Choose a strong, unique password to secure your personal data and dispatch orders.
            </p>
          </div>

          <Suspense fallback={<div className="p-8 text-center text-xs text-muted">Loading reset form...</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </Container>
    </div>
  );
}
