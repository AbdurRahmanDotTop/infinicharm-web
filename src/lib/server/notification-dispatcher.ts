import type {
  EmailRecipientRole,
  EmailTemplate,
  EmailTemplatePurpose,
  GlobalNotificationPreferences,
  NotificationDeliveryLog,
  NotificationEventKey,
  NotificationEventRule,
} from '../../types/index.ts';
import {
  getDefaultTemplateForPurpose,
  getEmailTemplateById,
} from './email-marketing-store.ts';
import {
  renderEmailVariables,
  sendEmailViaConfiguredProvider,
} from './mailer.ts';
import {
  appendNotificationLog,
  getGlobalNotificationPreferences,
  getNotificationLogById,
  getNotificationRuleById,
  getRulesByEventKey,
  updateNotificationLogById,
} from './notifications-store.ts';
import {
  getAppOrigin,
  getAdminUrl,
  buildAbsoluteUrl,
} from '../utils/env-urls.ts';

export interface NotificationStorePaths {
  smtpFilePath?: string;
  templatesFilePath?: string;
  rulesFilePath?: string;
  prefsFilePath?: string;
  logsFilePath?: string;
}

export interface DispatchNotificationInput {
  eventKey: NotificationEventKey;
  customerEmail?: string | null;
  customerName?: string | null;
  vendorEmails?: string[];
  overrideAdminEmails?: string[];
  entityType?: string;
  entityId?: string;
  extraVars?: Record<string, string | number | null | undefined>;
  paths?: NotificationStorePaths;
}

export interface DispatchNotificationResult {
  eventKey: NotificationEventKey;
  matchedRules: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  logs: NotificationDeliveryLog[];
}

interface ResolvedRecipient {
  email: string;
  name?: string;
  role: EmailRecipientRole;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmailList(emails?: string[]): string[] {
  if (!Array.isArray(emails)) return [];
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const raw of emails) {
    const clean = String(raw || '').trim();
    const lower = clean.toLowerCase();
    if (!EMAIL_PATTERN.test(clean) || seen.has(lower)) continue;
    seen.add(lower);
    valid.push(clean);
  }
  return valid;
}

function getPrimaryRole(rule: NotificationEventRule): EmailRecipientRole {
  if (rule.sendToAdmin) return 'ADMIN';
  if (rule.sendToCustomer) return 'CUSTOMER';
  if (rule.sendToVendor) return 'VENDOR';
  return 'CUSTOM';
}

function getFallbackTemplate(rule: NotificationEventRule): EmailTemplate {
  const now = new Date().toISOString();
  const purpose: EmailTemplatePurpose = rule.sendToCustomer
    ? 'CUSTOMER'
    : rule.sendToVendor
      ? 'VENDOR'
      : 'ADMIN';
  return {
    id: `fallback-${String(rule.eventKey).toLowerCase()}`,
    name: rule.name,
    slug: `fallback-${String(rule.eventKey).toLowerCase()}`,
    purpose,
    subject: rule.subjectOverride || '{{event_label}} — {{brand_name}}',
    previewText: rule.description,
    htmlContent: `<div style="background:#f9f6f1;padding:28px 16px;font-family:Inter,Arial,sans-serif;color:#1e1a17;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e7e1da;border-radius:16px;overflow:hidden;">
    <div style="background:#181512;padding:20px 26px;color:#ffffff;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#f5a38e;font-weight:700;">INFINICHARM NOTIFICATION</p>
      <h1 style="margin:0;font-size:19px;font-weight:700;">{{event_label}}</h1>
    </div>
    <div style="padding:24px 26px;font-size:14px;line-height:1.65;color:#3d352e;">
      <p style="margin-top:0;">{{activity_summary}}</p>
      <p style="font-size:12px;color:#6f645b;">Reference: {{order_number}} {{enquiry_id}} &bull; Support: {{support_email}}</p>
    </div>
  </div>
</div>`,
    textContent: `{{event_label}}\n{{activity_summary}}\nSupport: {{support_email}}`,
    isDefaultForPurpose: false,
    createdAt: now,
    updatedAt: now,
  };
}

function resolveTemplateForRule(
  rule: NotificationEventRule,
  templatesFilePath?: string
): EmailTemplate {
  if (rule.templateId) {
    const byId = getEmailTemplateById(rule.templateId, templatesFilePath);
    if (byId) return byId;
  }
  const preferredPurpose: EmailTemplatePurpose = rule.sendToCustomer
    ? 'CUSTOMER'
    : rule.sendToVendor
      ? 'VENDOR'
      : 'ADMIN';
  return (
    getDefaultTemplateForPurpose(preferredPurpose, templatesFilePath) ||
    getFallbackTemplate(rule)
  );
}

export function resolveRecipientsForRule(
  rule: NotificationEventRule,
  prefs: GlobalNotificationPreferences,
  input: Pick<
    DispatchNotificationInput,
    'customerEmail' | 'customerName' | 'vendorEmails' | 'overrideAdminEmails'
  >
): ResolvedRecipient[] {
  const candidates: ResolvedRecipient[] = [];

  if (rule.sendToAdmin) {
    const admins = normalizeEmailList(
      input.overrideAdminEmails && input.overrideAdminEmails.length > 0
        ? input.overrideAdminEmails
        : rule.adminEmails && rule.adminEmails.length > 0
          ? rule.adminEmails
          : prefs.defaultAdminEmails
    );
    for (const email of admins) {
      candidates.push({ email, name: 'InfiniCharm Admin', role: 'ADMIN' });
    }
  }

  if (
    rule.sendToCustomer &&
    input.customerEmail &&
    EMAIL_PATTERN.test(input.customerEmail.trim())
  ) {
    candidates.push({
      email: input.customerEmail.trim(),
      name: input.customerName?.trim() || undefined,
      role: 'CUSTOMER',
    });
  }

  if (rule.sendToVendor) {
    const vendors = normalizeEmailList([
      ...(input.vendorEmails || []),
      ...(rule.vendorEmails || []),
      ...(prefs.defaultVendorFallbackEmail ? [prefs.defaultVendorFallbackEmail] : []),
    ]);
    for (const email of vendors) {
      candidates.push({ email, name: 'Vendor Partner', role: 'VENDOR' });
    }
  }

  if (rule.customEmails && rule.customEmails.length > 0) {
    const customs = normalizeEmailList(rule.customEmails);
    for (const email of customs) {
      candidates.push({ email, role: 'CUSTOM' });
    }
  }

  if (prefs.deduplicateOverlappingRecipients === false) {
    return candidates;
  }

  const seenEmails = new Set<string>();
  return candidates.filter((recipient) => {
    const normalized = recipient.email.toLowerCase();
    if (seenEmails.has(normalized)) return false;
    seenEmails.add(normalized);
    return true;
  });
}

function buildRenderContext(
  rule: NotificationEventRule,
  recipient: { email: string; name?: string },
  input: Pick<DispatchNotificationInput, 'customerEmail' | 'customerName' | 'extraVars'>
) {
  const baseUrl = getAppOrigin();
  const mergedVars: Record<string, string | number | null | undefined> = {
    event_key: rule.eventKey,
    event_label: rule.name,
    customer_name: input.customerName || recipient.name || 'Customer',
    customer_email: input.customerEmail || recipient.email || '',
    customer_phone: 'Not provided',
    submitted_at: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    action_url: input.extraVars?.action_url ? String(input.extraVars.action_url) : getAdminUrl('email-notifications'),
    tracking_url: input.extraVars?.tracking_url ? String(input.extraVars.tracking_url) : buildAbsoluteUrl('/track-order'),
    activity_summary: rule.description,
    order_number: '',
    order_total: '',
    order_status: '',
    payment_method: '',
    payment_status: '',
    order_items_summary: '',
    shipping_address: '',
    courier_name: '',
    tracking_number: '',
    enquiry_id: input.extraVars?.enquiry_id || input.extraVars?.inquiry_id || '',
    inquiry_id: input.extraVars?.inquiry_id || input.extraVars?.enquiry_id || '',
    enquiry_subject: '',
    enquiry_message: '',
    enquiry_source: 'storefront',
    admin_reply: '',
    otp_code: '',
    verification_url: input.extraVars?.verification_url ? String(input.extraVars.verification_url) : buildAbsoluteUrl('/verify-email'),
    reset_url: input.extraVars?.reset_url ? String(input.extraVars.reset_url) : buildAbsoluteUrl('/reset-password'),
    expiry_minutes: '60',
    product_title: '',
    stock_quantity: '',
    product_status: '',
    review_rating: '',
    review_comment: '',
    review_status: '',
    status_message: rule.description,
    ...(input.extraVars || {}),
  };

  return {
    subscriberEmail: recipient.email,
    subscriberName: recipient.name || input.customerName || undefined,
    extraVars: mergedVars,
  };
}

export function previewNotificationRule(
  ruleId: string,
  overrideVars?: Record<string, string | number | null | undefined>,
  paths?: NotificationStorePaths
): {
  rule: NotificationEventRule;
  template: EmailTemplate;
  subject: string;
  htmlContent: string;
  textContent: string;
} | null {
  const rule = getNotificationRuleById(ruleId, paths?.rulesFilePath);
  if (!rule) return null;
  const template = resolveTemplateForRule(rule, paths?.templatesFilePath);
  const effectiveTemplate: EmailTemplate = {
    ...template,
    subject: rule.subjectOverride?.trim() ? rule.subjectOverride : template.subject,
  };
  const rendered = renderEmailVariables(
    effectiveTemplate,
    buildRenderContext(
      rule,
      { email: 'preview@infinicharm.com', name: 'AbdurRahman Ibn Ghufran' },
      {
        customerEmail: 'preview@infinicharm.com',
        customerName: 'AbdurRahman Ibn Ghufran',
        extraVars: {
          order_number: 'INF-202611-8801',
          order_total: '₹1,450.00',
          order_status: 'PROCESSING',
          payment_method: 'CUSTOM_UPI',
          payment_status: 'PAID',
          order_items_summary: '100% Kashmiri Honey (1 x 500g)',
          shipping_address: 'East Champaran, Bihar - 845427',
          courier_name: 'Blue Dart Express',
          tracking_number: 'BLU8825104657',
          enquiry_id: 'ENQ-PREVIEW-101',
          enquiry_subject: 'Batch Lab Report Enquiry',
          enquiry_message: 'Could you confirm harvest date for batch #KH-204?',
          admin_reply: 'Batch #KH-204 was harvested in October and lab verified.',
          otp_code: '649201',
          product_title: '100% Kashmiri Honey',
          stock_quantity: 4,
          product_status: 'ACTIVE',
          review_rating: 5,
          review_comment: 'Authentic texture and natural floral aroma.',
          review_status: 'APPROVED',
          ...(overrideVars || {}),
        },
      }
    )
  );
  return {
    rule,
    template: effectiveTemplate,
    ...rendered,
  };
}

async function sendWithRetry(
  rule: NotificationEventRule,
  prefs: GlobalNotificationPreferences,
  recipient: ResolvedRecipient,
  rendered: { subject: string; htmlContent: string; textContent: string },
  input: DispatchNotificationInput
): Promise<NotificationDeliveryLog> {
  const smtpConfigId = rule.smtpConfigId || prefs.defaultSmtpConfigId || null;
  const logsFilePath = input.paths?.logsFilePath;
  const smtpFilePath = input.paths?.smtpFilePath;

  const replyToOverride =
    prefs.supportReplyToEmail && EMAIL_PATTERN.test(prefs.supportReplyToEmail)
      ? prefs.supportReplyToEmail
      : undefined;

  let attempts = 0;
  const maxAttempts = 1 + Math.max(0, Math.min(3, Number(prefs.maxAutoRetries || 0)));

  let lastResult: {
    success: boolean;
    messageId?: string;
    providerName: string;
    error?: string;
  } = { success: false, providerName: 'Unconfigured', error: 'Not attempted' };

  while (attempts < maxAttempts) {
    attempts += 1;
    lastResult = await sendEmailViaConfiguredProvider({
      toEmail: recipient.email,
      toName: recipient.name,
      subject: rendered.subject,
      htmlContent: rendered.htmlContent,
      textContent: rendered.textContent,
      type: 'SYSTEM',
      smtpConfigId,
      replyToOverride,
      smtpFilePath,
      skipLog: true,
    });
    if (lastResult.success) break;
  }

  const contextPayload: Record<string, string> = {
    htmlContent: rendered.htmlContent,
    textContent: rendered.textContent,
    ...(input.entityType ? { entityType: input.entityType } : {}),
    ...(input.entityId ? { entityId: input.entityId } : {}),
  };

  return appendNotificationLog(
    {
      eventKey: String(rule.eventKey),
      eventName: rule.name,
      ruleId: rule.id,
      templateId: rule.templateId || null,
      smtpConfigId,
      recipientEmail: recipient.email,
      recipientRole: recipient.role,
      subject: rendered.subject,
      status: lastResult.success ? 'SENT' : 'FAILED',
      providerName: lastResult.providerName,
      messageId: lastResult.messageId || undefined,
      errorMessage: lastResult.success ? undefined : lastResult.error || 'Delivery failed',
      retryCount: Math.max(0, attempts - 1),
      contextPayload,
    },
    logsFilePath
  );
}

export async function dispatchNotificationEvent(
  input: DispatchNotificationInput
): Promise<DispatchNotificationResult> {
  const result: DispatchNotificationResult = {
    eventKey: input.eventKey,
    matchedRules: 0,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    logs: [],
  };

  try {
    const prefs = getGlobalNotificationPreferences(input.paths?.prefsFilePath);
    const rules = getRulesByEventKey(input.eventKey, input.paths?.rulesFilePath);
    result.matchedRules = rules.length;

    if (rules.length === 0) {
      return result;
    }

    if (!prefs.notificationsEnabled) {
      for (const rule of rules) {
        const disabledLog = appendNotificationLog(
          {
            eventKey: String(rule.eventKey),
            eventName: rule.name,
            ruleId: rule.id,
            templateId: rule.templateId || null,
            smtpConfigId: rule.smtpConfigId || prefs.defaultSmtpConfigId || null,
            recipientEmail:
              input.customerEmail ||
              prefs.defaultAdminEmails[0] ||
              'notifications-disabled@local',
            recipientRole: getPrimaryRole(rule),
            subject: rule.subjectOverride || rule.name,
            status: 'DISABLED',
            providerName: 'System',
            errorMessage: 'Global notifications master toggle is turned OFF in preferences.',
            retryCount: 0,
          },
          input.paths?.logsFilePath
        );
        result.logs.push(disabledLog);
        result.skippedCount += 1;
      }
      return result;
    }

    for (const rule of rules) {
      if (!rule.isEnabled) {
        const disabledLog = appendNotificationLog(
          {
            eventKey: String(rule.eventKey),
            eventName: rule.name,
            ruleId: rule.id,
            templateId: rule.templateId || null,
            smtpConfigId: rule.smtpConfigId || prefs.defaultSmtpConfigId || null,
            recipientEmail:
              input.customerEmail ||
              prefs.defaultAdminEmails[0] ||
              'rule-disabled@local',
            recipientRole: getPrimaryRole(rule),
            subject: rule.subjectOverride || rule.name,
            status: 'DISABLED',
            providerName: 'System',
            errorMessage: `Notification rule "${rule.name}" is disabled by admin.`,
            retryCount: 0,
          },
          input.paths?.logsFilePath
        );
        result.logs.push(disabledLog);
        result.skippedCount += 1;
        continue;
      }

      const recipients = resolveRecipientsForRule(rule, prefs, input);
      if (recipients.length === 0) {
        const skippedLog = appendNotificationLog(
          {
            eventKey: String(rule.eventKey),
            eventName: rule.name,
            ruleId: rule.id,
            templateId: rule.templateId || null,
            smtpConfigId: rule.smtpConfigId || prefs.defaultSmtpConfigId || null,
            recipientEmail: 'no-eligible-recipient@local',
            recipientRole: getPrimaryRole(rule),
            subject: rule.subjectOverride || rule.name,
            status: 'SKIPPED',
            providerName: 'System',
            errorMessage:
              'No eligible recipient email resolved (recipient role toggled off or email missing).',
            retryCount: 0,
          },
          input.paths?.logsFilePath
        );
        result.logs.push(skippedLog);
        result.skippedCount += 1;
        continue;
      }

      const baseTemplate = resolveTemplateForRule(rule, input.paths?.templatesFilePath);
      const effectiveTemplate: EmailTemplate = {
        ...baseTemplate,
        subject: rule.subjectOverride?.trim() ? rule.subjectOverride : baseTemplate.subject,
      };

      for (const recipient of recipients) {
        const rendered = renderEmailVariables(
          effectiveTemplate,
          buildRenderContext(rule, recipient, input)
        );
        const log = await sendWithRetry(rule, prefs, recipient, rendered, input);
        result.logs.push(log);
        if (log.status === 'SENT') {
          result.sentCount += 1;
        } else {
          result.failedCount += 1;
        }
      }
    }
  } catch (err) {
    console.error('[notification-dispatcher] non-blocking dispatch error:', err);
  }

  return result;
}

export async function sendTestNotificationForRule(
  ruleId: string,
  targetEmail: string,
  customVars?: Record<string, string | number | null | undefined>,
  paths?: NotificationStorePaths
): Promise<{
  success: boolean;
  log?: NotificationDeliveryLog;
  error?: string;
}> {
  const cleanEmail = targetEmail.trim();
  if (!EMAIL_PATTERN.test(cleanEmail)) {
    return { success: false, error: 'Valid target test email address is required.' };
  }

  const preview = previewNotificationRule(ruleId, customVars, paths);
  if (!preview) {
    return { success: false, error: 'Notification rule not found.' };
  }

  const prefs = getGlobalNotificationPreferences(paths?.prefsFilePath);
  const smtpConfigId = preview.rule.smtpConfigId || prefs.defaultSmtpConfigId || null;

  const sendResult = await sendEmailViaConfiguredProvider({
    toEmail: cleanEmail,
    toName: 'Admin Test Recipient',
    subject: `[TEST] ${preview.subject}`,
    htmlContent: preview.htmlContent,
    textContent: preview.textContent,
    type: 'TEST',
    smtpConfigId,
    replyToOverride:
      prefs.supportReplyToEmail && EMAIL_PATTERN.test(prefs.supportReplyToEmail)
        ? prefs.supportReplyToEmail
        : undefined,
    smtpFilePath: paths?.smtpFilePath,
    skipLog: true,
  });

  const log = appendNotificationLog(
    {
      eventKey: String(preview.rule.eventKey),
      eventName: `${preview.rule.name} (Test)`,
      ruleId: preview.rule.id,
      templateId: preview.template.id,
      smtpConfigId,
      recipientEmail: cleanEmail,
      recipientRole: getPrimaryRole(preview.rule),
      subject: `[TEST] ${preview.subject}`,
      status: sendResult.success ? 'SENT' : 'FAILED',
      providerName: sendResult.providerName,
      messageId: sendResult.messageId || undefined,
      errorMessage: sendResult.success ? undefined : sendResult.error || 'Test email failed',
      retryCount: 0,
      contextPayload: {
        htmlContent: preview.htmlContent,
        textContent: preview.textContent,
        entityType: 'TEST',
        entityId: preview.rule.id,
      },
    },
    paths?.logsFilePath
  );

  return {
    success: sendResult.success,
    log,
    error: sendResult.error,
  };
}

export async function retryNotificationLogById(
  logId: string,
  paths?: NotificationStorePaths
): Promise<{
  success: boolean;
  log?: NotificationDeliveryLog;
  error?: string;
}> {
  const existing = getNotificationLogById(logId, paths?.logsFilePath);
  if (!existing) {
    return { success: false, error: 'Notification delivery log not found.' };
  }

  if (!EMAIL_PATTERN.test(existing.recipientEmail)) {
    return {
      success: false,
      error: 'Log entry does not have a valid recipient email to retry.',
    };
  }

  const prefs = getGlobalNotificationPreferences(paths?.prefsFilePath);
  const rule = existing.ruleId
    ? getNotificationRuleById(existing.ruleId, paths?.rulesFilePath)
    : null;
  const smtpConfigId = rule?.smtpConfigId || prefs.defaultSmtpConfigId || null;

  const htmlContent =
    existing.contextPayload?.htmlContent ||
    `<p>${existing.eventName}: Retry dispatch for ${existing.subject}</p>`;
  const textContent = existing.contextPayload?.textContent || existing.subject;

  const sendResult = await sendEmailViaConfiguredProvider({
    toEmail: existing.recipientEmail,
    subject: existing.subject,
    htmlContent,
    textContent,
    type: 'SYSTEM',
    smtpConfigId,
    replyToOverride:
      prefs.supportReplyToEmail && EMAIL_PATTERN.test(prefs.supportReplyToEmail)
        ? prefs.supportReplyToEmail
        : undefined,
    smtpFilePath: paths?.smtpFilePath,
    skipLog: true,
  });

  const updated = updateNotificationLogById(
    logId,
    {
      status: sendResult.success ? 'SENT' : 'FAILED',
      providerName: sendResult.providerName,
      messageId: sendResult.messageId || existing.messageId || undefined,
      errorMessage: sendResult.success ? undefined : sendResult.error || 'Retry failed',
      retryCount: (existing.retryCount || 0) + 1,
    },
    paths?.logsFilePath
  );

  return {
    success: sendResult.success,
    log: updated || existing,
    error: sendResult.error,
  };
}
