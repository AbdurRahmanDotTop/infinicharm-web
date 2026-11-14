import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  Customer,
  HomepageSection,
  NewsletterSubscriber,
  NewsletterSubscriberStatus,
  NewsletterWidgetSettings,
} from '../../types/index.ts';

const SUBSCRIBERS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'newsletter_subscribers.json');
const SETTINGS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'newsletter_settings.json');
const HOMEPAGE_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'homepage_sections.json');
const CUSTOMERS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'customers.json');

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;

export const DEFAULT_NEWSLETTER_SETTINGS: NewsletterWidgetSettings = {
  isEnabled: true,
  badge: 'COMMUNITY DISPATCH',
  heading: 'Join the InfiniCharm Circle',
  description:
    'Receive monthly harvest reports, new batch releases, and exclusive community discounts directly to your inbox.',
  emailPlaceholder: 'Enter your email address...',
  buttonText: 'Subscribe',
  loadingText: 'Subscribing...',
  successMessage: 'Welcome to the InfiniCharm Circle! Your subscription is confirmed and a welcome email is on its way.',
  alreadySubscribedMessage: 'You are already an active member of the InfiniCharm Circle.',
  invalidEmailMessage: 'Please enter a valid email address.',
  errorMessage: 'Unable to process your subscription right now. Please try again in a moment.',
  privacyFootnote: 'No spam, ever. Unsubscribe anytime with a single click.',
  sendWelcomeEmail: true,
  welcomeTemplateId: 'tpl-welcome-circle',
  updatedAt: new Date().toISOString(),
};

function readJsonArray<T>(filePath: string): T[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf-8').trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      if (parsed[0] && Array.isArray((parsed[0] as any).value)) {
        return (parsed[0] as any).value as T[];
      }
      return parsed.filter(Boolean) as T[];
    }
    if (parsed && Array.isArray((parsed as any).value)) {
      return (parsed as any).value as T[];
    }
    return [];
  } catch {
    return [];
  }
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, filePath);
}

export function isValidEmailAddress(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

export function generateUnsubscribeToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

function readSubscribersRaw(filePath = SUBSCRIBERS_FILE_PATH): NewsletterSubscriber[] {
  return readJsonArray<NewsletterSubscriber>(filePath);
}

function writeSubscribersRaw(list: NewsletterSubscriber[], filePath = SUBSCRIBERS_FILE_PATH): void {
  writeJsonAtomic(filePath, list);
}

/**
 * Synchronize matching customer's newsletterSubscribed preference cleanly
 */
export function syncCustomerNewsletterPreference(email: string, subscribed: boolean): void {
  try {
    if (!fs.existsSync(CUSTOMERS_FILE_PATH)) return;
    const customers = readJsonArray<Customer>(CUSTOMERS_FILE_PATH);
    const normalized = email.trim().toLowerCase();
    let changed = false;
    const updated = customers.map((cust) => {
      if (cust.email.trim().toLowerCase() === normalized) {
        changed = true;
        return {
          ...cust,
          preferences: {
            smsAlerts: cust.preferences?.smsAlerts ?? true,
            orderUpdatesWhatsapp: cust.preferences?.orderUpdatesWhatsapp ?? true,
            preferredCurrency: cust.preferences?.preferredCurrency ?? 'INR',
            language: cust.preferences?.language ?? 'en',
            newsletterSubscribed: subscribed,
          },
          updatedAt: new Date().toISOString(),
        };
      }
      return cust;
    });
    if (changed) {
      writeJsonAtomic(CUSTOMERS_FILE_PATH, updated);
    }
  } catch (err) {
    console.warn('Could not sync customer newsletter preference:', err);
  }
}

/**
 * Sync Homepage CMS section `sec-newsletter` with NewsletterWidgetSettings
 */
function syncHomepageNewsletterSection(settings: NewsletterWidgetSettings): void {
  try {
    if (!fs.existsSync(HOMEPAGE_FILE_PATH)) return;
    const sections = readJsonArray<HomepageSection>(HOMEPAGE_FILE_PATH);
    let found = false;
    const updated = sections.map((sec) => {
      if (sec.type === 'newsletter' || sec.id === 'sec-newsletter') {
        found = true;
        return {
          ...sec,
          badge: settings.badge,
          title: settings.heading,
          subtitle: settings.description,
          ctaText: settings.buttonText,
          isEnabled: settings.isEnabled,
          updatedAt: settings.updatedAt,
        };
      }
      return sec;
    });
    if (found) {
      writeJsonAtomic(HOMEPAGE_FILE_PATH, updated);
    }
  } catch (err) {
    console.warn('Could not sync homepage newsletter section:', err);
  }
}

export function getNewsletterWidgetSettings(): NewsletterWidgetSettings {
  try {
    if (!fs.existsSync(SETTINGS_FILE_PATH)) {
      writeJsonAtomic(SETTINGS_FILE_PATH, DEFAULT_NEWSLETTER_SETTINGS);
      return { ...DEFAULT_NEWSLETTER_SETTINGS };
    }
    const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE_PATH, 'utf-8'));
    return {
      ...DEFAULT_NEWSLETTER_SETTINGS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_NEWSLETTER_SETTINGS };
  }
}

export function updateNewsletterWidgetSettings(
  updates: Partial<NewsletterWidgetSettings>
): NewsletterWidgetSettings {
  const current = getNewsletterWidgetSettings();
  const next: NewsletterWidgetSettings = {
    ...current,
    ...updates,
    badge: updates.badge !== undefined ? updates.badge.trim() : current.badge,
    heading: updates.heading !== undefined ? updates.heading.trim() || current.heading : current.heading,
    description:
      updates.description !== undefined ? updates.description.trim() : current.description,
    emailPlaceholder:
      updates.emailPlaceholder !== undefined
        ? updates.emailPlaceholder.trim() || current.emailPlaceholder
        : current.emailPlaceholder,
    buttonText:
      updates.buttonText !== undefined ? updates.buttonText.trim() || current.buttonText : current.buttonText,
    loadingText:
      updates.loadingText !== undefined ? updates.loadingText.trim() || current.loadingText : current.loadingText,
    successMessage:
      updates.successMessage !== undefined
        ? updates.successMessage.trim() || current.successMessage
        : current.successMessage,
    alreadySubscribedMessage:
      updates.alreadySubscribedMessage !== undefined
        ? updates.alreadySubscribedMessage.trim() || current.alreadySubscribedMessage
        : current.alreadySubscribedMessage,
    invalidEmailMessage:
      updates.invalidEmailMessage !== undefined
        ? updates.invalidEmailMessage.trim() || current.invalidEmailMessage
        : current.invalidEmailMessage,
    errorMessage:
      updates.errorMessage !== undefined
        ? updates.errorMessage.trim() || current.errorMessage
        : current.errorMessage,
    privacyFootnote:
      updates.privacyFootnote !== undefined ? updates.privacyFootnote.trim() : current.privacyFootnote,
    updatedAt: new Date().toISOString(),
  };

  writeJsonAtomic(SETTINGS_FILE_PATH, next);
  syncHomepageNewsletterSection(next);
  return next;
}

export interface SubscriberQueryOptions {
  q?: string;
  status?: string;
  source?: string;
  sortBy?: 'createdAt' | 'subscribedAt' | 'email' | 'status';
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  filePath?: string;
}

export function queryNewsletterSubscribers(opts: SubscriberQueryOptions = {}) {
  const all = readSubscribersRaw(opts.filePath);

  const stats = {
    total: all.length,
    active: all.filter((s) => s.status === 'ACTIVE').length,
    unsubscribed: all.filter((s) => s.status === 'UNSUBSCRIBED').length,
    pending: all.filter((s) => s.status === 'PENDING').length,
    bounced: all.filter((s) => s.status === 'BOUNCED').length,
    suppressed: all.filter((s) => s.status === 'SUPPRESSED').length,
  };

  const sources = Array.from(new Set(all.map((s) => s.source).filter(Boolean))).sort();

  let filtered = [...all];

  if (opts.status && opts.status !== 'ALL') {
    filtered = filtered.filter((s) => s.status === opts.status);
  }

  if (opts.source && opts.source !== 'ALL') {
    filtered = filtered.filter((s) => s.source === opts.source);
  }

  if (opts.q && opts.q.trim()) {
    const term = opts.q.trim().toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.email.toLowerCase().includes(term) ||
        (s.fullName && s.fullName.toLowerCase().includes(term)) ||
        s.source.toLowerCase().includes(term) ||
        (s.tags || []).some((t) => t.toLowerCase().includes(term))
    );
  }

  const sortBy = opts.sortBy || 'createdAt';
  const dir = opts.sortDir === 'asc' ? 1 : -1;

  filtered.sort((a, b) => {
    const valA = String((a as any)[sortBy] || a.createdAt || '');
    const valB = String((b as any)[sortBy] || b.createdAt || '');
    return valA.localeCompare(valB) * dir;
  });

  const limit = Math.max(1, Math.min(200, opts.limit || 25));
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const page = Math.max(1, Math.min(totalPages, opts.page || 1));
  const start = (page - 1) * limit;
  const paginated = filtered.slice(start, start + limit);

  return {
    subscribers: paginated,
    allFiltered: filtered,
    totalCount,
    page,
    limit,
    totalPages,
    stats,
    sources,
  };
}

export function getSubscriberById(id: string, filePath?: string): NewsletterSubscriber | null {
  return readSubscribersRaw(filePath).find((s) => s.id === id) || null;
}

export function getSubscriberByToken(token: string, filePath?: string): NewsletterSubscriber | null {
  if (!token.trim()) return null;
  return readSubscribersRaw(filePath).find((s) => s.unsubscribeToken === token.trim()) || null;
}

export function getSubscriberByEmail(email: string, filePath?: string): NewsletterSubscriber | null {
  const normalized = email.trim().toLowerCase();
  return readSubscribersRaw(filePath).find((s) => s.email.toLowerCase() === normalized) || null;
}

export interface SubscribeResult {
  outcome: 'SUBSCRIBED' | 'RESUBSCRIBED' | 'ALREADY_ACTIVE' | 'SUPPRESSED' | 'INVALID_EMAIL';
  subscriber?: NewsletterSubscriber;
  message: string;
}

export function subscribeToNewsletter(
  input: {
    email: string;
    fullName?: string;
    source?: string;
    tags?: string[];
    consentIp?: string;
  },
  filePath?: string
): SubscribeResult {
  const settings = getNewsletterWidgetSettings();
  const normalizedEmail = (input.email || '').trim().toLowerCase();

  if (!isValidEmailAddress(normalizedEmail)) {
    return {
      outcome: 'INVALID_EMAIL',
      message: settings.invalidEmailMessage,
    };
  }

  const all = readSubscribersRaw(filePath);
  const existingIdx = all.findIndex((s) => s?.email && s.email.toLowerCase() === normalizedEmail);
  const now = new Date().toISOString();

  if (existingIdx !== -1) {
    const existing = all[existingIdx];
    if (existing.status === 'ACTIVE') {
      return {
        outcome: 'ALREADY_ACTIVE',
        subscriber: existing,
        message: settings.alreadySubscribedMessage,
      };
    }

    if (existing.status === 'BOUNCED' || existing.status === 'SUPPRESSED') {
      return {
        outcome: 'SUPPRESSED',
        subscriber: existing,
        message:
          'This email address has previously bounced or been suppressed. Please contact support@infinicharm.com to restore delivery.',
      };
    }

    // UNSUBSCRIBED or PENDING -> Reactivate cleanly upon explicit re-subscription
    const updated: NewsletterSubscriber = {
      ...existing,
      fullName: input.fullName?.trim() || existing.fullName,
      status: 'ACTIVE',
      source: input.source?.trim() || existing.source || 'Homepage Circle Subscription',
      tags: input.tags && input.tags.length > 0 ? Array.from(new Set([...(existing.tags || []), ...input.tags])) : existing.tags,
      unsubscribeToken: existing.unsubscribeToken || generateUnsubscribeToken(),
      resubscribedAt: now,
      unsubscribedAt: null,
      updatedAt: now,
    };

    all[existingIdx] = updated;
    writeSubscribersRaw(all, filePath);
    syncCustomerNewsletterPreference(normalizedEmail, true);

    return {
      outcome: 'RESUBSCRIBED',
      subscriber: updated,
      message: settings.successMessage,
    };
  }

  const created: NewsletterSubscriber = {
    id: `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    email: normalizedEmail,
    fullName: input.fullName?.trim() || undefined,
    status: 'ACTIVE',
    source: input.source?.trim() || 'Homepage Circle Subscription',
    tags: input.tags || ['Infinicharm Circle'],
    unsubscribeToken: generateUnsubscribeToken(),
    consentIp: input.consentIp,
    subscribedAt: now,
    unsubscribedAt: null,
    resubscribedAt: null,
    lastCampaignSentAt: null,
    createdAt: now,
    updatedAt: now,
  };

  writeSubscribersRaw([created, ...all], filePath);
  syncCustomerNewsletterPreference(normalizedEmail, true);

  return {
    outcome: 'SUBSCRIBED',
    subscriber: created,
    message: settings.successMessage,
  };
}

export function unsubscribeFromNewsletter(
  params: { token?: string; email?: string },
  filePath?: string
): { success: boolean; subscriber?: NewsletterSubscriber; message: string } {
  const all = readSubscribersRaw(filePath);
  let idx = -1;

  if (params.token && params.token.trim()) {
    idx = all.findIndex((s) => s.unsubscribeToken === params.token!.trim());
  } else if (params.email && params.email.trim()) {
    const normalized = params.email.trim().toLowerCase();
    idx = all.findIndex((s) => s.email.toLowerCase() === normalized);
  }

  if (idx === -1) {
    return {
      success: false,
      message: 'We could not find a matching newsletter subscription record for that unsubscribe link.',
    };
  }

  const now = new Date().toISOString();
  const updated: NewsletterSubscriber = {
    ...all[idx],
    status: 'UNSUBSCRIBED',
    unsubscribedAt: now,
    updatedAt: now,
  };

  all[idx] = updated;
  writeSubscribersRaw(all, filePath);
  syncCustomerNewsletterPreference(updated.email, false);

  return {
    success: true,
    subscriber: updated,
    message: `${updated.email} has been unsubscribed from InfiniCharm marketing emails.`,
  };
}

export function adminCreateSubscriber(
  input: {
    email: string;
    fullName?: string;
    status?: NewsletterSubscriberStatus;
    source?: string;
    tags?: string[];
    notes?: string;
  },
  filePath?: string
): { success: boolean; subscriber?: NewsletterSubscriber; error?: string } {
  const normalized = (input.email || '').trim().toLowerCase();
  if (!isValidEmailAddress(normalized)) {
    return { success: false, error: 'Please provide a valid email address.' };
  }

  const all = readSubscribersRaw(filePath);
  if (all.some((s) => s.email.toLowerCase() === normalized)) {
    return { success: false, error: `A subscriber record already exists for ${normalized}.` };
  }

  const now = new Date().toISOString();
  const status: NewsletterSubscriberStatus = input.status || 'ACTIVE';
  const created: NewsletterSubscriber = {
    id: `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    email: normalized,
    fullName: input.fullName?.trim() || undefined,
    status,
    source: input.source?.trim() || 'Admin Manual Entry',
    tags: input.tags || [],
    unsubscribeToken: generateUnsubscribeToken(),
    notes: input.notes?.trim() || undefined,
    subscribedAt: now,
    unsubscribedAt: status === 'UNSUBSCRIBED' ? now : null,
    resubscribedAt: null,
    lastCampaignSentAt: null,
    createdAt: now,
    updatedAt: now,
  };

  writeSubscribersRaw([created, ...all], filePath);
  syncCustomerNewsletterPreference(normalized, status === 'ACTIVE');
  return { success: true, subscriber: created };
}

export function adminUpdateSubscriber(
  id: string,
  updates: {
    email?: string;
    fullName?: string;
    status?: NewsletterSubscriberStatus;
    source?: string;
    tags?: string[];
    bounceReason?: string;
    notes?: string;
  },
  filePath?: string
): { success: boolean; subscriber?: NewsletterSubscriber; error?: string } {
  const all = readSubscribersRaw(filePath);
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) {
    return { success: false, error: 'Subscriber not found.' };
  }

  const current = all[idx];
  const nextEmail = updates.email !== undefined ? updates.email.trim().toLowerCase() : current.email;
  if (!isValidEmailAddress(nextEmail)) {
    return { success: false, error: 'Please provide a valid email address.' };
  }
  if (all.some((s) => s.id !== id && s.email.toLowerCase() === nextEmail)) {
    return { success: false, error: `Another subscriber already uses ${nextEmail}.` };
  }

  const now = new Date().toISOString();
  const nextStatus = updates.status || current.status;
  const updated: NewsletterSubscriber = {
    ...current,
    email: nextEmail,
    fullName: updates.fullName !== undefined ? updates.fullName.trim() || undefined : current.fullName,
    status: nextStatus,
    source: updates.source !== undefined ? updates.source.trim() || current.source : current.source,
    tags: updates.tags !== undefined ? updates.tags : current.tags,
    bounceReason: updates.bounceReason !== undefined ? updates.bounceReason.trim() : current.bounceReason,
    notes: updates.notes !== undefined ? updates.notes.trim() : current.notes,
    unsubscribedAt:
      nextStatus === 'UNSUBSCRIBED'
        ? current.unsubscribedAt || now
        : nextStatus === 'ACTIVE'
        ? null
        : current.unsubscribedAt,
    resubscribedAt:
      nextStatus === 'ACTIVE' && current.status !== 'ACTIVE' ? now : current.resubscribedAt,
    updatedAt: now,
  };

  all[idx] = updated;
  writeSubscribersRaw(all, filePath);
  syncCustomerNewsletterPreference(updated.email, updated.status === 'ACTIVE');
  return { success: true, subscriber: updated };
}

export function adminDeleteSubscriber(id: string, filePath?: string): boolean {
  const all = readSubscribersRaw(filePath);
  const existing = all.find((s) => s.id === id);
  if (!existing) return false;
  const remaining = all.filter((s) => s.id !== id);
  writeSubscribersRaw(remaining, filePath);
  syncCustomerNewsletterPreference(existing.email, false);
  return true;
}

export function markSubscriberCampaignDelivered(id: string, sentAt: string, filePath?: string): void {
  const all = readSubscribersRaw(filePath);
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], lastCampaignSentAt: sentAt, updatedAt: sentAt };
  writeSubscribersRaw(all, filePath);
}

/**
 * Strictly returns ONLY eligible ACTIVE subscribers for a campaign segment.
 * Unsubscribed, pending, bounced, and suppressed subscribers are ALWAYS excluded.
 */
export function resolveCampaignRecipients(
  opts: {
    segment: 'ALL_ACTIVE' | 'CUSTOM_SELECTION' | 'SOURCE_FILTER';
    selectedSubscriberIds?: string[];
    sourceFilter?: string;
  },
  filePath?: string
): { eligible: NewsletterSubscriber[]; excludedCount: number } {
  const all = readSubscribersRaw(filePath);

  if (opts.segment === 'CUSTOM_SELECTION') {
    const idSet = new Set(opts.selectedSubscriberIds || []);
    const matched = all.filter((s) => idSet.has(s.id));
    const eligible = matched.filter((s) => s.status === 'ACTIVE');
    return { eligible, excludedCount: matched.length - eligible.length };
  }

  if (opts.segment === 'SOURCE_FILTER' && opts.sourceFilter) {
    const matched = all.filter((s) => s.source === opts.sourceFilter);
    const eligible = matched.filter((s) => s.status === 'ACTIVE');
    return { eligible, excludedCount: matched.length - eligible.length };
  }

  const eligible = all.filter((s) => s.status === 'ACTIVE');
  return { eligible, excludedCount: all.length - eligible.length };
}

function escapeCsvCell(val: unknown): string {
  const s = String(val ?? '');
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function exportSubscribersToCsv(subscribers: NewsletterSubscriber[]): string {
  const headers = [
    'ID',
    'Email',
    'Full Name',
    'Status',
    'Source',
    'Tags',
    'Subscribed At',
    'Unsubscribed At',
    'Last Campaign Sent At',
  ];
  const rows = subscribers.map((s) =>
    [
      s.id,
      s.email,
      s.fullName || '',
      s.status,
      s.source,
      (s.tags || []).join('; '),
      s.subscribedAt,
      s.unsubscribedAt || '',
      s.lastCampaignSentAt || '',
    ]
      .map(escapeCsvCell)
      .join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}
