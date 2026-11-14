import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  SanitizedSmtpConfig,
  SmtpConfig,
  SmtpEncryptionType,
  SmtpProviderType,
} from '../../types/index.ts';

const SMTP_CONFIGS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'smtp_configs.json');

function getCipherKey(): Buffer {
  const raw =
    process.env.SMTP_ENCRYPTION_SECRET ||
    process.env.PAYMENT_GATEWAY_KEY_SECRET ||
    'infinicharm-local-smtp-cipher-default-key';
  return crypto.scryptSync(raw, 'infinicharm-smtp-salt-v1', 32);
}

export function encryptSmtpSecret(plain: string): string {
  if (!plain) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSmtpSecret(payload?: string): string {
  if (!payload || !payload.includes(':')) return '';
  try {
    const parts = payload.split(':');
    if (parts.length !== 3) return '';
    const [ivHex, tagHex, encHex] = parts;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getCipherKey(),
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}

export function maskSecretValue(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 8) return '••••••••';
  return `${secret.slice(0, 4)}••••••••${secret.slice(-4)}`;
}

function getDefaultSeedConfigs(): SmtpConfig[] {
  const now = new Date().toISOString();
  const hasEnvKey = Boolean(
    process.env.BREVO_SMTP_PASSWORD || process.env.BREVO_API_KEY
  );
  return [
    {
      id: 'smtp-brevo-primary',
      name: 'Brevo Primary Transactional Relay',
      providerType: 'BREVO',
      host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
      port: Number(process.env.BREVO_SMTP_PORT || 587),
      encryption: 'STARTTLS',
      username: process.env.BREVO_SMTP_USER || 'c2b822001@smtp-brevo.com',
      useEnvCredentials: hasEnvKey,
      senderName: process.env.BREVO_DEFAULT_SENDER_NAME || 'InfiniCharm',
      senderEmail: process.env.BREVO_DEFAULT_SENDER_EMAIL || 'support@infinicharm.com',
      replyToEmail: process.env.BREVO_DEFAULT_SENDER_EMAIL || 'support@infinicharm.com',
      isDefault: true,
      isEnabled: true,
      lastTestedAt: null,
      lastTestStatus: 'UNTESTED',
      lastTestMessage: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function readRawConfigs(filePath = SMTP_CONFIGS_FILE_PATH): SmtpConfig[] {
  try {
    if (!fs.existsSync(filePath)) {
      const seeds = getDefaultSeedConfigs();
      writeRawConfigs(seeds, filePath);
      return seeds;
    }
    const raw = fs.readFileSync(filePath, 'utf-8').trim();
    if (!raw) {
      const seeds = getDefaultSeedConfigs();
      writeRawConfigs(seeds, filePath);
      return seeds;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SmtpConfig[]) : getDefaultSeedConfigs();
  } catch {
    return getDefaultSeedConfigs();
  }
}

function writeRawConfigs(configs: SmtpConfig[], filePath = SMTP_CONFIGS_FILE_PATH): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(configs, null, 2), 'utf-8');
  fs.renameSync(tmp, filePath);
}

/**
 * Resolves the plaintext secret strictly on the server runtime. Never sent to browser.
 */
export function resolveConfigPlainSecret(cfg: SmtpConfig): string {
  if (cfg.encryptedSecret) {
    const dec = decryptSmtpSecret(cfg.encryptedSecret);
    if (dec) return dec;
  }
  if (cfg.providerType === 'BREVO' && cfg.useEnvCredentials) {
    return process.env.BREVO_SMTP_PASSWORD || process.env.BREVO_API_KEY || '';
  }
  return '';
}

export function sanitizeSmtpConfig(cfg: SmtpConfig): SanitizedSmtpConfig {
  const { encryptedSecret, ...rest } = cfg;
  const runtimeSecret = resolveConfigPlainSecret(cfg);
  return {
    ...rest,
    hasSecret: Boolean(runtimeSecret),
    maskedSecret: runtimeSecret ? maskSecretValue(runtimeSecret) : '',
  };
}

export function listSanitizedSmtpConfigs(filePath?: string): SanitizedSmtpConfig[] {
  return readRawConfigs(filePath).map(sanitizeSmtpConfig);
}

export function getSanitizedSmtpConfigById(
  id: string,
  filePath?: string
): SanitizedSmtpConfig | null {
  const found = readRawConfigs(filePath).find((c) => c.id === id);
  return found ? sanitizeSmtpConfig(found) : null;
}

export function getRuntimeSmtpConfig(
  explicitId?: string | null,
  filePath?: string
): { config: SmtpConfig; plainSecret: string } | null {
  const all = readRawConfigs(filePath);
  let target: SmtpConfig | undefined;

  if (explicitId) {
    target = all.find((c) => c.id === explicitId && c.isEnabled);
  }
  if (!target) {
    target = all.find((c) => c.isDefault && c.isEnabled);
  }
  if (!target) {
    target = all.find((c) => c.isEnabled);
  }
  if (!target) return null;

  return {
    config: target,
    plainSecret: resolveConfigPlainSecret(target),
  };
}

export function getRuntimeSmtpConfigById(
  id: string,
  filePath?: string
): { config: SmtpConfig; plainSecret: string } | null {
  const target = readRawConfigs(filePath).find((c) => c.id === id);
  if (!target) return null;
  return {
    config: target,
    plainSecret: resolveConfigPlainSecret(target),
  };
}

export interface UpsertSmtpConfigInput {
  name: string;
  providerType: SmtpProviderType;
  host: string;
  port: number;
  encryption: SmtpEncryptionType;
  username?: string;
  secret?: string;
  useEnvCredentials?: boolean;
  senderName: string;
  senderEmail: string;
  replyToEmail?: string;
  isDefault?: boolean;
  isEnabled?: boolean;
}

export function createSmtpConfig(
  input: UpsertSmtpConfigInput,
  filePath?: string
): SanitizedSmtpConfig {
  const all = readRawConfigs(filePath);
  const now = new Date().toISOString();
  const isDefault = Boolean(input.isDefault) || all.length === 0;

  const updatedAll = isDefault ? all.map((c) => ({ ...c, isDefault: false })) : [...all];

  const created: SmtpConfig = {
    id: `smtp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: input.name.trim(),
    providerType: input.providerType,
    host: input.host.trim(),
    port: Number(input.port) || 587,
    encryption: input.encryption || 'STARTTLS',
    username: (input.username || '').trim(),
    encryptedSecret: input.secret?.trim() ? encryptSmtpSecret(input.secret.trim()) : undefined,
    useEnvCredentials: Boolean(input.useEnvCredentials),
    senderName: input.senderName.trim(),
    senderEmail: input.senderEmail.trim(),
    replyToEmail: input.replyToEmail?.trim() || input.senderEmail.trim(),
    isDefault,
    isEnabled: input.isEnabled !== undefined ? Boolean(input.isEnabled) : true,
    lastTestedAt: null,
    lastTestStatus: 'UNTESTED',
    lastTestMessage: null,
    createdAt: now,
    updatedAt: now,
  };

  writeRawConfigs([created, ...updatedAll], filePath);
  return sanitizeSmtpConfig(created);
}

export function updateSmtpConfig(
  id: string,
  updates: Partial<UpsertSmtpConfigInput>,
  filePath?: string
): { success: boolean; config?: SanitizedSmtpConfig; error?: string } {
  const all = readRawConfigs(filePath);
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) {
    return { success: false, error: 'SMTP configuration not found.' };
  }

  const current = all[idx];
  const now = new Date().toISOString();
  const nextIsDefault = updates.isDefault !== undefined ? Boolean(updates.isDefault) : current.isDefault;

  let nextEncryptedSecret = current.encryptedSecret;
  let nextUseEnv =
    updates.useEnvCredentials !== undefined
      ? Boolean(updates.useEnvCredentials)
      : current.useEnvCredentials;

  // Preserve existing secret if secret field left blank during update; overwrite only when explicitly supplied
  if (updates.secret && updates.secret.trim()) {
    nextEncryptedSecret = encryptSmtpSecret(updates.secret.trim());
    if (updates.useEnvCredentials === undefined) {
      nextUseEnv = false;
    }
  } else if (updates.useEnvCredentials === true) {
    nextEncryptedSecret = undefined;
  }

  const updated: SmtpConfig = {
    ...current,
    name: updates.name !== undefined ? updates.name.trim() || current.name : current.name,
    providerType: updates.providerType || current.providerType,
    host: updates.host !== undefined ? updates.host.trim() || current.host : current.host,
    port: updates.port !== undefined ? Number(updates.port) || current.port : current.port,
    encryption: updates.encryption || current.encryption,
    username: updates.username !== undefined ? updates.username.trim() : current.username,
    encryptedSecret: nextEncryptedSecret,
    useEnvCredentials: nextUseEnv,
    senderName:
      updates.senderName !== undefined ? updates.senderName.trim() || current.senderName : current.senderName,
    senderEmail:
      updates.senderEmail !== undefined
        ? updates.senderEmail.trim() || current.senderEmail
        : current.senderEmail,
    replyToEmail:
      updates.replyToEmail !== undefined
        ? updates.replyToEmail.trim() || current.senderEmail
        : current.replyToEmail,
    isDefault: nextIsDefault,
    isEnabled: updates.isEnabled !== undefined ? Boolean(updates.isEnabled) : current.isEnabled,
    updatedAt: now,
  };

  // Ensure default config is enabled if set to default
  if (updated.isDefault && !updated.isEnabled) {
    updated.isEnabled = true;
  }

  const nextAll = all.map((c, i) => {
    if (i === idx) return updated;
    return updated.isDefault ? { ...c, isDefault: false } : c;
  });

  writeRawConfigs(nextAll, filePath);
  return { success: true, config: sanitizeSmtpConfig(updated) };
}

export function deleteSmtpConfig(
  id: string,
  filePath?: string
): { success: boolean; error?: string } {
  const all = readRawConfigs(filePath);
  const target = all.find((c) => c.id === id);
  if (!target) {
    return { success: false, error: 'SMTP configuration not found.' };
  }
  if (all.length <= 1) {
    return {
      success: false,
      error: 'At least one SMTP configuration must remain in the system.',
    };
  }

  const remaining = all.filter((c) => c.id !== id);
  if (target.isDefault && remaining.length > 0) {
    const firstEnabledIdx = remaining.findIndex((c) => c.isEnabled);
    const promoteIdx = firstEnabledIdx !== -1 ? firstEnabledIdx : 0;
    remaining[promoteIdx] = { ...remaining[promoteIdx], isDefault: true, isEnabled: true };
  }

  writeRawConfigs(remaining, filePath);
  return { success: true };
}

export function recordSmtpTestResult(
  id: string,
  status: 'SUCCESS' | 'FAILED',
  message: string,
  filePath?: string
): void {
  const all = readRawConfigs(filePath);
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return;
  const now = new Date().toISOString();
  all[idx] = {
    ...all[idx],
    lastTestedAt: now,
    lastTestStatus: status,
    lastTestMessage: message,
    updatedAt: now,
  };
  writeRawConfigs(all, filePath);
}

