'use client';

import React, { useEffect, useState } from 'react';
import { Mail, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface ResendVerificationBoxProps {
  initialEmail?: string;
  redirectPath?: string;
  allowEditEmail?: boolean;
  className?: string;
  compact?: boolean;
}

export function ResendVerificationBox({
  initialEmail = '',
  redirectPath = '/account',
  allowEditEmail = false,
  className = '',
  compact = false,
}: ResendVerificationBoxProps) {
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleResend = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean) {
      setStatusMsg({ type: 'error', text: 'Please enter your email address first.' });
      return;
    }

    setSending(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/auth/customer/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean, redirectPath }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (typeof data?.retryAfterSeconds === 'number' && data.retryAfterSeconds > 0) {
          setCooldown(data.retryAfterSeconds);
        }
        setStatusMsg({
          type: 'error',
          text: data?.error || 'Unable to resend verification email right now.',
        });
      } else {
        setCooldown(30);
        setStatusMsg({
          type: 'success',
          text:
            data?.message ||
            'A fresh single-use verification link has been sent to your inbox.',
        });
      }
    } catch {
      setStatusMsg({
        type: 'error',
        text: 'Network error while requesting verification email.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      data-testid="resend-verification-box"
      className={`rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs space-y-2.5 ${className}`}
    >
      <div className="flex items-start gap-2 text-amber-900">
        <Mail className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
        <div className="space-y-0.5 min-w-0 flex-1">
          <p className="font-bold">Didn&apos;t receive the verification email?</p>
          {!compact && (
            <p className="text-[11px] text-amber-800/90">
              Check your spam folder or request a fresh single-use link (previous links are invalidated).
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        {allowEditEmail ? (
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Verification email address"
            className="flex-1 min-w-0 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-primary focus:outline-none focus:border-accent"
          />
        ) : (
          <div className="flex-1 min-w-0 rounded-lg border border-amber-200 bg-white/80 px-3 py-2 text-xs font-mono text-primary truncate">
            {email || 'No email specified'}
          </div>
        )}

        <button
          type="button"
          onClick={handleResend}
          disabled={sending || cooldown > 0}
          data-testid="resend-verification-btn"
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-surface font-semibold text-xs hover:bg-primary/90 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${sending ? 'animate-spin' : ''}`} />
          <span>
            {sending
              ? 'Sending...'
              : cooldown > 0
                ? `Resend in ${cooldown}s`
                : 'Resend Verification Email'}
          </span>
        </button>
      </div>

      {statusMsg && (
        <div
          role={statusMsg.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-1.5 text-[11px] font-medium p-2 rounded-lg ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}
    </div>
  );
}

