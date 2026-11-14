'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  MailX,
  RotateCcw,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() || '';

  const [loading, setLoading] = useState(Boolean(token));
  const [submitting, setSubmitting] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [subscriberEmail, setSubscriberEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let active = true;
    fetch(`/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data?.success && data.subscriber) {
          setSubscriberEmail(data.subscriber.email);
          setStatus(data.subscriber.status);
        } else {
          setFeedback({
            kind: 'error',
            message:
              data?.error ||
              'This unsubscribe link is invalid or no longer associated with a subscriber.',
          });
        }
      })
      .catch(() => {
        if (active) {
          setFeedback({
            kind: 'error',
            message: 'Unable to load subscription details right now.',
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const handleAction = async (
    action: 'unsubscribe' | 'resubscribe',
    overrideEmail?: string
  ) => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const payload = token
        ? { token, action }
        : { email: (overrideEmail ?? manualEmail).trim(), action };

      const res = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        setFeedback({
          kind: 'error',
          message: data?.error || 'Could not update your email preferences.',
        });
        return;
      }

      setSubscriberEmail(data.email || subscriberEmail);
      setStatus(data.status || (action === 'unsubscribe' ? 'UNSUBSCRIBED' : 'ACTIVE'));
      setFeedback({
        kind: 'success',
        message: data.message,
      });
    } catch {
      setFeedback({
        kind: 'error',
        message: 'Network error while updating preferences. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[65vh] bg-canvas py-12 sm:py-16 px-4 sm:px-6">
      <div className="mx-auto max-w-xl bg-surface border border-border rounded-2xl p-6 sm:p-10 shadow-level-1">
        <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-accent mb-3">
          <MailX className="w-4 h-4" />
          InfiniCharm Circle Preferences
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary mb-2 tracking-tight">
          Manage Newsletter Subscription
        </h1>
        <p className="text-sm text-secondary mb-6 leading-relaxed">
          Control whether you receive harvest dispatches, batch updates, and community emails from
          InfiniCharm.
        </p>

        {loading ? (
          <div className="flex items-center gap-3 py-8 text-sm text-secondary">
            <Loader2 className="w-5 h-5 animate-spin text-accent" />
            Loading your subscription record...
          </div>
        ) : token && subscriberEmail ? (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-canvas border border-border">
              <div className="text-xs text-secondary uppercase font-semibold tracking-wider mb-1">
                Subscriber Email
              </div>
              <div className="text-base font-bold text-primary break-all">{subscriberEmail}</div>
              <div className="mt-2 inline-flex items-center gap-2 text-xs font-semibold">
                <span>Current Status:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full ${
                    status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                  }`}
                >
                  {status || 'ACTIVE'}
                </span>
              </div>
            </div>

            {status === 'ACTIVE' ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleAction('unsubscribe')}
                className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-neutral-800 text-surface text-sm font-semibold px-5 py-3 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MailX className="w-4 h-4" />
                )}
                Unsubscribe from All Marketing Emails
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleAction('resubscribe')}
                className="w-full inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-surface text-sm font-semibold px-5 py-3 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                Re-Subscribe to InfiniCharm Circle
              </button>
            )}
          </div>
        ) : !token ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAction('unsubscribe');
            }}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="unsub-email-input"
                className="block text-xs font-semibold text-primary uppercase tracking-wider mb-1.5"
              >
                Email Address
              </label>
              <input
                id="unsub-email-input"
                type="email"
                required
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-canvas border border-border rounded-xl px-4 py-3 text-sm text-primary outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={submitting || !manualEmail.trim()}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-primary hover:bg-neutral-800 text-surface text-sm font-semibold px-5 py-3 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailX className="w-4 h-4" />}
                Unsubscribe
              </button>
              <button
                type="button"
                disabled={submitting || !manualEmail.trim()}
                onClick={() => handleAction('resubscribe')}
                className="flex-1 inline-flex items-center justify-center gap-2 border border-border bg-canvas hover:bg-surface text-primary text-sm font-semibold px-5 py-3 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
              >
                <RotateCcw className="w-4 h-4" />
                Re-Subscribe
              </button>
            </div>
          </form>
        ) : null}

        {feedback && (
          <div
            role={feedback.kind === 'error' ? 'alert' : 'status'}
            className={`mt-5 flex items-start gap-2.5 p-4 rounded-xl border text-sm ${
              feedback.kind === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {feedback.kind === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-border flex items-center justify-between text-xs text-secondary">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-semibold text-primary hover:text-accent transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Storefront
          </Link>
          <span>InfiniCharm &bull; TechilyFly India</span>
        </div>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center text-sm text-secondary">
          Loading subscription preferences...
        </div>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  );
}

