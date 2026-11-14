import fs from 'fs';
import path from 'path';

export interface ServerAuditLogEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  diff?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export const SERVER_AUDIT_LOG_PATH = path.join(process.cwd(), 'src', 'data', 'audit_logs.json');
const MAX_LOGS = 1000;
const SENSITIVE_KEY_PATTERN = /(password|token|otp|secret|hash|authorization|cookie)/i;

function scrubSensitive(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(scrubSensitive);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY_PATTERN.test(k) ? '[REDACTED]' : scrubSensitive(v);
    }
    return out;
  }
  return value;
}

export function listServerAuditLogs(
  filePath: string = SERVER_AUDIT_LOG_PATH
): ServerAuditLogEntry[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? (parsed as ServerAuditLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function appendServerAuditLog(
  entry: Omit<ServerAuditLogEntry, 'id' | 'createdAt'>,
  filePath: string = SERVER_AUDIT_LOG_PATH
): ServerAuditLogEntry {
  const existing = listServerAuditLogs(filePath);
  const created: ServerAuditLogEntry = {
    id: `saud-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    actorId: entry.actorId,
    actorEmail: entry.actorEmail,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    diff: entry.diff ? (scrubSensitive(entry.diff) as Record<string, unknown>) : undefined,
    ipAddress: entry.ipAddress || '127.0.0.1',
    userAgent: entry.userAgent || 'Server API',
    createdAt: new Date().toISOString(),
  };

  const next = [created, ...existing].slice(0, MAX_LOGS);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
  return created;
}

