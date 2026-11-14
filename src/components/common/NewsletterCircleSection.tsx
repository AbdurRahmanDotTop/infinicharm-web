'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertCircle, Loader2, Info } from 'lucide-react';
import { HomepageSection } from '@/types';

interface PublicNewsletterSettings {
  isEnabled: boolean;
  badge: string;
  heading: string;
  description: string;
  emailPlaceholder: string;
  buttonText: string;
  loadingText: string;
  successMessage: string;
  alreadySubscribedMessage: string;
  invalidEmailMessage: string;
  errorMessage: string;
  privacyFootnote: string;
}

interface NewsletterCircleSectionProps {
  section?: HomepageSection;
  source?: string;
}

const DEFAULT_PUBLIC_SETTINGS: PublicNewsletterSettings = {
  isEnabled: true,
  badge: 'Community Dispatch',
  heading: 'Join the InfiniCharm Circle',
  description:
    'Receive monthly harvest reports, new batch releases, and exclusive community updates directly to your inbox.',
  emailPlaceholder: 'Enter your email address...',
  buttonText: 'Subscribe',
  loadingText: 'Subscribing...',
  successMessage:
    'Thank you for joining the InfiniCharm Circle! Check your inbox for your welcome note.',
  alreadySubscribedMessage:
    'This email address is already subscribed to the InfiniCharm Circle.',
  invalidEmailMessage: 'Please enter a valid email address.',
  errorMessage: 'Unable to subscribe right now. Please try again in a moment.',
  privacyFootnote: 'No spam, ever. Unsubscribe anytime with a single click.',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function NewsletterCircleSection({
  section,
  source = 'homepage_circle',
}: NewsletterCircleSectionProps) {
  const [settings, setSettings] = useState<PublicNewsletterSettings>({
    ...DEFAULT_PUBLIC_SETTINGS,
    badge: section?.badge || DEFAULT_PUBLIC_SETTINGS.badge,
    heading: section?.title || DEFAULT_PUBLIC_SETTINGS.heading,
    description: section?.subtitle || DEFAULT_PUBLIC_SETTINGS.description,
    buttonText: section?.ctaText || DEFAULT_PUBLIC_SETTINGS.buttonText,
  });

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: 'success' | 'duplicate' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/newsletter', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (active && data?.success && data.settings) {
          setSettings(data.settings);
        }
      })
      .catch(() => {
        // Keep section defaults silently if endpoint temporarily unreachable
      });
    return () => {
      active = false;
    };
  }, []);

  if (section?.isEnabled === false || !settings.isEnabled) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();

    if (!EMAIL_PATTERN.test(trimmed)) {
      setFeedback({
        kind: 'error',
        message: settings.invalidEmailMessage || DEFAULT_PUBLIC_SETTINGS.invalidEmailMessage,
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          source,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        setFeedback({
          kind: 'error',
          message:
            data?.error || settings.errorMessage || DEFAULT_PUBLIC_SETTINGS.errorMessage,
        });
        return;
      }

      if (data.alreadySubscribed) {
        setFeedback({
          kind: 'duplicate',
          message:
            data.message ||
            settings.alreadySubscribedMessage ||
            DEFAULT_PUBLIC_SETTINGS.alreadySubscribedMessage,
        });
        return;
      }

      setEmail('');
      setFeedback({
        kind: 'success',
        message: data.message || settings.successMessage || DEFAULT_PUBLIC_SETTINGS.successMessage,
      });
    } catch {
      setFeedback({
        kind: 'error',
        message: settings.errorMessage || DEFAULT_PUBLIC_SETTINGS.errorMessage,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="infinicharm-circle-newsletter"
      className="w-full py-12 sm:py-16 bg-canvas"
      aria-labelledby="newsletter-circle-heading"
    >
      <div className="mx-auto w-full max-w-canvas px-4 sm:px-6 lg:px-8">
        <div className="bg-primary text-surface rounded-2xl p-6 sm:p-10 md:p-14 relative overflow-hidden shadow-level-2 border border-white/10">
          <div className="relative z-10 max-w-2xl">
            <span suppressHydrationWarning className="text-[11px] font-bold text-accent uppercase tracking-widest mb-2 block">
              {settings.badge}
            </span>
            <h2
              id="newsletter-circle-heading"
              suppressHydrationWarning
              className="font-display text-2xl sm:text-3xl font-bold text-surface mb-3 tracking-tight"
            >
              {settings.heading}
            </h2>
            <p suppressHydrationWarning className="font-body text-sm text-neutral-300 leading-relaxed mb-6">
              {settings.description}
            </p>

            <form
              onSubmit={handleSubmit}
              noValidate
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full max-w-lg mb-4"
            >
              <label htmlFor="circle-newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="circle-newsletter-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (feedback) setFeedback(null);
                }}
                disabled={submitting}
                placeholder={settings.emailPlaceholder}
                aria-invalid={feedback?.kind === 'error'}
                className="flex-1 min-w-0 bg-surface text-primary text-sm rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent placeholder:text-neutral-500 disabled:opacity-70"
              />
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-surface text-sm font-semibold px-6 py-3 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? settings.loadingText : settings.buttonText}
              </button>
            </form>

            {feedback && (
              <div
                role={feedback.kind === 'error' ? 'alert' : 'status'}
                aria-live="polite"
                className={`inline-flex items-center gap-2.5 text-xs font-medium px-4 py-2.5 rounded-xl border mb-3 max-w-full ${
                  feedback.kind === 'success'
                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                    : feedback.kind === 'duplicate'
                    ? 'bg-accent/15 border-accent/40 text-accent-soft'
                    : 'bg-red-500/15 border-red-400/40 text-red-200'
                }`}
              >
                {feedback.kind === 'success' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                )}
                {feedback.kind === 'duplicate' && (
                  <Info className="w-4 h-4 text-accent shrink-0" />
                )}
                {feedback.kind === 'error' && (
                  <AlertCircle className="w-4 h-4 text-red-300 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-400">
              <span>{settings.privacyFootnote}</span>
              <Link
                href="/unsubscribe"
                className="underline hover:text-neutral-200 transition-colors"
              >
                Manage preferences
              </Link>
            </div>
          </div>

          <div className="hidden lg:block absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-accent/15 to-transparent pointer-events-none" />
        </div>
      </div>
    </section>
  );
}
