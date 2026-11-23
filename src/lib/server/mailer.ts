import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import type { EmailDeliveryLog, SmtpConfig } from '../../types/index.ts';
import {
  getRuntimeSmtpConfig,
  getRuntimeSmtpConfigById,
  recordSmtpTestResult,
} from './smtp-store.ts';
import { getAppOrigin, getUnsubscribeUrl, type RequestContext } from '../utils/env-urls.ts';

const LOGS_DATA_PATH = path.join(process.cwd(), 'src', 'data', 'email_delivery_logs.json');
const MAX_DELIVERY_LOGS = 2000;

function ensureLogsFile(filePath: string = LOGS_DATA_PATH): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]\n', 'utf8');
  }
}

function readDeliveryLogs(filePath: string = LOGS_DATA_PATH): EmailDeliveryLog[] {
  try {
    ensureLogsFile(filePath);
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EmailDeliveryLog[]) : [];
  } catch {
    return [];
  }
}

export function appendDeliveryLog(
  entry: Omit<EmailDeliveryLog, 'id' | 'sentAt'> & { sentAt?: string },
  filePath: string = LOGS_DATA_PATH
): EmailDeliveryLog {
  const all = readDeliveryLogs(filePath);
  const created: EmailDeliveryLog = {
    ...entry,
    id: `log-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    sentAt: entry.sentAt || new Date().toISOString(),
  };
  const trimmed = [created, ...all].slice(0, MAX_DELIVERY_LOGS);
  ensureLogsFile(filePath);
  const tmpPath = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(trimmed, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
  return created;
}

export function listDeliveryLogs(
  opts?: {
    campaignId?: string;
    type?: EmailDeliveryLog['type'];
    status?: EmailDeliveryLog['status'];
    search?: string;
    limit?: number;
  },
  filePath: string = LOGS_DATA_PATH
): EmailDeliveryLog[] {
  let logs = readDeliveryLogs(filePath);
  if (opts?.campaignId) {
    logs = logs.filter((l) => l.campaignId === opts.campaignId);
  }
  if (opts?.type) {
    logs = logs.filter((l) => l.type === opts.type);
  }
  if (opts?.status) {
    logs = logs.filter((l) => l.status === opts.status);
  }
  if (opts?.search?.trim()) {
    const q = opts.search.trim().toLowerCase();
    logs = logs.filter(
      (l) =>
        l.recipientEmail.toLowerCase().includes(q) ||
        l.subject.toLowerCase().includes(q) ||
        (l.campaignName || '').toLowerCase().includes(q) ||
        l.providerName.toLowerCase().includes(q)
    );
  }
  const limit = opts?.limit && opts.limit > 0 ? Math.min(500, opts.limit) : 200;
  return logs.slice(0, limit);
}

export function getPublicSiteUrl(context?: RequestContext): string {
  return getAppOrigin(context);
}

export interface EmailVariableContext {
  subscriberName?: string | null;
  subscriberEmail: string;
  campaignTitle?: string | null;
  unsubscribeToken?: string | null;
  unsubscribeUrl?: string | null;
  storeUrl?: string;
  extraVars?: Record<string, string | number | null | undefined>;
}

export function buildUnsubscribeUrl(token?: string | null, context?: RequestContext): string {
  return getUnsubscribeUrl(token, context);
}

export function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderEmailVariables(
  template: {
    subject: string;
    htmlContent: string;
    textContent?: string;
    previewText?: string;
  },
  ctx: EmailVariableContext,
  opts?: { requireUnsubscribeLink?: boolean }
): {
  subject: string;
  htmlContent: string;
  textContent: string;
} {
  const storeUrl = (ctx.storeUrl || getPublicSiteUrl()).replace(/\/+$/, '');
  const unsubscribeUrl = ctx.unsubscribeUrl || buildUnsubscribeUrl(ctx.unsubscribeToken);
  const subscriberName = (ctx.subscriberName || '').trim() || 'Valued Patron';
  const supportEmail = process.env.BREVO_DEFAULT_SENDER_EMAIL || 'support@infinicharm.com';

  const replacements: Record<string, string> = {
    '{{subscriber_name}}': subscriberName,
    '{{subscriber_email}}': ctx.subscriberEmail,
    '{{campaign_title}}': ctx.campaignTitle || 'InfiniCharm Dispatch',
    '{{store_url}}': storeUrl,
    '{{site_url}}': storeUrl,
    '{{unsubscribe_url}}': unsubscribeUrl,
    '{{brand_name}}': 'InfiniCharm (Techily Fly)',
    '{{site_name}}': 'InfiniCharm (Techily Fly)',
    '{{support_email}}': supportEmail,
    '{{current_year}}': String(new Date().getFullYear()),
  };

  if (ctx.extraVars) {
    for (const [k, rawVal] of Object.entries(ctx.extraVars)) {
      const normalizedKey = k.startsWith('{{') && k.endsWith('}}') ? k : `{{${k}}}`;
      replacements[normalizedKey] = rawVal === null || rawVal === undefined ? '' : String(rawVal);
    }
  }

  const URL_TOKEN_KEYS = new Set([
    '{{unsubscribe_url}}',
    '{{store_url}}',
    '{{site_url}}',
    '{{action_url}}',
    '{{tracking_url}}',
    '{{verification_link}}',
    '{{verification_url}}',
  ]);

  const applyMap = (raw: string, escapeValues: boolean): string => {
    let out = raw || '';
    for (const [token, val] of Object.entries(replacements)) {
      const safeVal = escapeValues && !URL_TOKEN_KEYS.has(token) ? escapeHtmlText(val) : val;
      out = out.split(token).join(safeVal);
    }
    return out;
  };

  const subject = applyMap(template.subject, false);
  let htmlContent = applyMap(template.htmlContent, true);
  let textContent = applyMap(template.textContent || '', false);

  if (opts?.requireUnsubscribeLink && !htmlContent.includes('/unsubscribe')) {
    htmlContent += `\n<div style="margin-top:28px;padding-top:16px;border-top:1px solid #e7e1da;font-family:Inter,Arial,sans-serif;font-size:12px;color:#6f645b;text-align:center;">
  You received this email because you subscribed to the InfiniCharm Circle (<a href="${unsubscribeUrl}" style="color:#c2593f;text-decoration:underline;">Unsubscribe instantly</a>).<br/>
  InfiniCharm &bull; Techily Fly &bull; East Champaran, Bihar - 845427
</div>`;
  }

  if (!textContent.trim()) {
    textContent = htmlContent
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (opts?.requireUnsubscribeLink && !textContent.includes('/unsubscribe')) {
    textContent += `\n\nUnsubscribe: ${unsubscribeUrl}`;
  }

  return { subject, htmlContent, textContent };
}

function isBrevoRestApiKey(config: SmtpConfig, plainSecret: string): boolean {
  return config.providerType === 'BREVO' && plainSecret.trim().startsWith('xkeysib-');
}

function createNodemailerTransport(config: SmtpConfig, plainSecret: string) {
  const secure = config.encryption === 'SSL' || config.port === 465;
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure,
    requireTLS: config.encryption === 'STARTTLS',
    ignoreTLS: config.encryption === 'NONE',
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth:
      config.username || plainSecret
        ? {
            user: config.username || config.senderEmail,
            pass: plainSecret,
          }
        : undefined,
  });
}

function maskPossibleSecret(message: string, plainSecret?: string): string {
  if (!plainSecret || plainSecret.length < 6) return message;
  return message.split(plainSecret).join('********');
}

export async function verifySmtpConnection(
  smtpId?: string,
  smtpFilePath?: string
): Promise<{
  ok: boolean;
  mode: 'BREVO_REST_V3' | 'SMTP';
  message: string;
  accountSummary?: string;
}> {
  const runtime = smtpId
    ? getRuntimeSmtpConfigById(smtpId, smtpFilePath)
    : getRuntimeSmtpConfig(undefined, smtpFilePath);

  if (!runtime) {
    return {
      ok: false,
      mode: 'SMTP',
      message: 'SMTP configuration was not found or none is enabled.',
    };
  }

  const { config, plainSecret } = runtime;
  if (!plainSecret) {
    const msg = config.useEnvCredentials
      ? 'Server environment credential (BREVO_API_KEY) is not configured.'
      : 'SMTP password / API key is missing for this configuration.';
    recordSmtpTestResult(config.id, 'FAILED', msg, smtpFilePath);
    return { ok: false, mode: 'SMTP', message: msg };
  }

  if (isBrevoRestApiKey(config, plainSecret)) {
    try {
      const res = await fetch('https://api.brevo.com/v3/account', {
        method: 'GET',
        headers: {
          'api-key': plainSecret.trim(),
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = maskPossibleSecret(
          `Brevo verification failed (HTTP ${res.status}): ${data?.message || res.statusText}`,
          plainSecret
        );
        recordSmtpTestResult(config.id, 'FAILED', errMsg, smtpFilePath);
        return { ok: false, mode: 'BREVO_REST_V3', message: errMsg };
      }

      const planInfo = Array.isArray(data?.plan) && data.plan[0]
        ? `${data.plan[0].type} (${data.plan[0].credits ?? 'active'} credits)`
        : 'active';
      const summary = `${data?.companyName || 'Brevo Account'} <${data?.email || config.senderEmail}> — ${planInfo}`;
      const okMsg = `Verified live via Brevo API v3: ${summary}`;
      recordSmtpTestResult(config.id, 'SUCCESS', okMsg, smtpFilePath);
      return {
        ok: true,
        mode: 'BREVO_REST_V3',
        message: okMsg,
        accountSummary: summary,
      };
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'Brevo API network error';
      const safeMsg = maskPossibleSecret(`Brevo verification error: ${rawMsg}`, plainSecret);
      recordSmtpTestResult(config.id, 'FAILED', safeMsg, smtpFilePath);
      return { ok: false, mode: 'BREVO_REST_V3', message: safeMsg };
    }
  }

  try {
    const transporter = createNodemailerTransport(config, plainSecret);
    await transporter.verify();
    const okMsg = `Verified SMTP handshake with ${config.host}:${config.port} (${config.encryption})`;
    recordSmtpTestResult(config.id, 'SUCCESS', okMsg, smtpFilePath);
    return {
      ok: true,
      mode: 'SMTP',
      message: okMsg,
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : 'SMTP handshake failed';
    const safeMsg = maskPossibleSecret(`SMTP error: ${rawMsg}`, plainSecret);
    recordSmtpTestResult(config.id, 'FAILED', safeMsg, smtpFilePath);
    return { ok: false, mode: 'SMTP', message: safeMsg };
  }
}

export interface SendEmailInput {
  toEmail: string;
  toName?: string | null;
  subject: string;
  htmlContent: string;
  textContent?: string;
  type: EmailDeliveryLog['type'];
  smtpConfigId?: string | null;
  senderNameOverride?: string;
  senderEmailOverride?: string;
  replyToOverride?: string;
  campaignId?: string | null;
  campaignName?: string | null;
  subscriberId?: string | null;
  unsubscribeUrl?: string | null;
  smtpFilePath?: string;
  logsFilePath?: string;
  skipLog?: boolean;
}

export async function sendEmailViaConfiguredProvider(
  input: SendEmailInput
): Promise<{
  success: boolean;
  messageId?: string;
  providerName: string;
  error?: string;
}> {
  const runtime = input.smtpConfigId
    ? getRuntimeSmtpConfigById(input.smtpConfigId, input.smtpFilePath)
    : getRuntimeSmtpConfig(undefined, input.smtpFilePath);

  if (!runtime || !runtime.config.isEnabled) {
    const err = 'No enabled SMTP / email delivery configuration is active.';
    if (!input.skipLog) {
      appendDeliveryLog(
        {
          type: input.type,
          campaignId: input.campaignId || null,
          campaignName: input.campaignName || null,
          subscriberId: input.subscriberId || null,
          recipientEmail: input.toEmail,
          subject: input.subject,
          smtpConfigId: runtime?.config.id || input.smtpConfigId || null,
          providerName: runtime?.config.name || 'Unconfigured',
          status: 'FAILED',
          errorMessage: err,
        },
        input.logsFilePath
      );
    }
    return { success: false, providerName: runtime?.config.name || 'Unconfigured', error: err };
  }

  const { config, plainSecret } = runtime;
  if (!plainSecret) {
    const err = config.useEnvCredentials
      ? 'Server BREVO_API_KEY env credential is missing.'
      : 'SMTP secret credential is missing.';
    if (!input.skipLog) {
      appendDeliveryLog(
        {
          type: input.type,
          campaignId: input.campaignId || null,
          campaignName: input.campaignName || null,
          subscriberId: input.subscriberId || null,
          recipientEmail: input.toEmail,
          subject: input.subject,
          smtpConfigId: config.id,
          providerName: config.name,
          status: 'FAILED',
          errorMessage: err,
        },
        input.logsFilePath
      );
    }
    return { success: false, providerName: config.name, error: err };
  }

  const senderName = (input.senderNameOverride || config.senderName || 'InfiniCharm').trim();
  const senderEmail = (input.senderEmailOverride || config.senderEmail).trim();
  const replyTo = (input.replyToOverride || config.replyToEmail || senderEmail).trim();

  if (isBrevoRestApiKey(config, plainSecret)) {
    try {
      const headers: Record<string, string> = {};
      if (input.unsubscribeUrl) {
        headers['List-Unsubscribe'] = `<${input.unsubscribeUrl}>`;
        headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
      }

      const payload: Record<string, unknown> = {
        sender: { name: senderName, email: senderEmail },
        to: [
          input.toName?.trim()
            ? { email: input.toEmail.trim(), name: input.toName.trim() }
            : { email: input.toEmail.trim() },
        ],
        replyTo: { email: replyTo, name: senderName },
        subject: input.subject,
        htmlContent: input.htmlContent,
        textContent: input.textContent || undefined,
      };
      if (Object.keys(headers).length > 0) {
        payload.headers = headers;
      }

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': plainSecret.trim(),
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = maskPossibleSecret(
          `Brevo delivery error (${res.status}): ${data?.message || res.statusText}`,
          plainSecret
        );
        if (!input.skipLog) {
          appendDeliveryLog(
            {
              type: input.type,
              campaignId: input.campaignId || null,
              campaignName: input.campaignName || null,
              subscriberId: input.subscriberId || null,
              recipientEmail: input.toEmail,
              subject: input.subject,
              smtpConfigId: config.id,
              providerName: config.name,
              status: 'FAILED',
              errorMessage: errMsg,
            },
            input.logsFilePath
          );
        }
        return { success: false, providerName: config.name, error: errMsg };
      }

      const messageId = typeof data?.messageId === 'string' ? data.messageId : `brevo-${Date.now()}`;
      if (!input.skipLog) {
        appendDeliveryLog(
          {
            type: input.type,
            campaignId: input.campaignId || null,
            campaignName: input.campaignName || null,
            subscriberId: input.subscriberId || null,
            recipientEmail: input.toEmail,
            subject: input.subject,
            smtpConfigId: config.id,
            providerName: config.name,
            status: 'SENT',
            messageId,
          },
          input.logsFilePath
        );
      }
      return { success: true, messageId, providerName: config.name };
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'Brevo network send error';
      const safeMsg = maskPossibleSecret(rawMsg, plainSecret);
      if (!input.skipLog) {
        appendDeliveryLog(
          {
            type: input.type,
            campaignId: input.campaignId || null,
            campaignName: input.campaignName || null,
            subscriberId: input.subscriberId || null,
            recipientEmail: input.toEmail,
            subject: input.subject,
            smtpConfigId: config.id,
            providerName: config.name,
            status: 'FAILED',
            errorMessage: safeMsg,
          },
          input.logsFilePath
        );
      }
      return { success: false, providerName: config.name, error: safeMsg };
    }
  }

  // Standard SMTP via nodemailer (Brevo xsmtpsib- SMTP relay or Custom SMTP)
  try {
    const transporter = createNodemailerTransport(config, plainSecret);
    const headers: Record<string, string> = {};
    if (input.unsubscribeUrl) {
      headers['List-Unsubscribe'] = `<${input.unsubscribeUrl}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }

    const info = await transporter.sendMail({
      from: `"${senderName.replace(/"/g, '')}" <${senderEmail}>`,
      to: input.toName?.trim()
        ? `"${input.toName.trim().replace(/"/g, '')}" <${input.toEmail.trim()}>`
        : input.toEmail.trim(),
      replyTo,
      subject: input.subject,
      html: input.htmlContent,
      text: input.textContent || undefined,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });

    const messageId = info.messageId || `smtp-${Date.now()}`;
    if (!input.skipLog) {
      appendDeliveryLog(
        {
          type: input.type,
          campaignId: input.campaignId || null,
          campaignName: input.campaignName || null,
          subscriberId: input.subscriberId || null,
          recipientEmail: input.toEmail,
          subject: input.subject,
          smtpConfigId: config.id,
          providerName: config.name,
          status: 'SENT',
          messageId,
        },
        input.logsFilePath
      );
    }
    return { success: true, messageId, providerName: config.name };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : 'SMTP delivery failed';
    const safeMsg = maskPossibleSecret(rawMsg, plainSecret);
    if (!input.skipLog) {
      appendDeliveryLog(
        {
          type: input.type,
          campaignId: input.campaignId || null,
          campaignName: input.campaignName || null,
          subscriberId: input.subscriberId || null,
          recipientEmail: input.toEmail,
          subject: input.subject,
          smtpConfigId: config.id,
          providerName: config.name,
          status: 'FAILED',
          errorMessage: safeMsg,
        },
        input.logsFilePath
      );
    }
    return { success: false, providerName: config.name, error: safeMsg };
  }
}
