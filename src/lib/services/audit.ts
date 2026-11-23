export interface AuditLogEntry {
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

const STORAGE_KEY = 'infinicharm_audit_logs';

const DEFAULT_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'aud-init-001',
    actorId: 'usr-admin-01',
    actorEmail: 'admin@infinicharm.com',
    action: 'SYSTEM_INITIALIZATION',
    resourceType: 'platform',
    resourceId: 'infinicharm-core',
    diff: {
      version: '2.0.0',
      dispatchOrigin: 'East Champaran, Bihar - 845427',
      model: 'Single-Owner Direct-to-Consumer',
    },
    ipAddress: '127.0.0.1',
    userAgent: 'Edge Middleware RBAC Guard',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'aud-init-002',
    actorId: 'usr-admin-01',
    actorEmail: 'admin@infinicharm.com',
    action: 'VERIFY_COMPLIANCE_DISCLOSURES',
    resourceType: 'settings',
    resourceId: 'legal-metrology-fssai',
    diff: {
      packer: 'Techily Fly',
      founder: 'AbdurRahman Ibn Ghufran',
      status: 'VERIFIED',
    },
    ipAddress: '127.0.0.1',
    userAgent: 'System Configuration Module',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export function getAuditLogs(): AuditLogEntry[] {
  if (typeof window === 'undefined') {
    return DEFAULT_AUDIT_LOGS;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_AUDIT_LOGS));
      return DEFAULT_AUDIT_LOGS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse audit logs from storage:', err);
    return DEFAULT_AUDIT_LOGS;
  }
}

export function logAdminAction(
  action: string,
  resourceType: string,
  resourceId: string,
  diff?: Record<string, unknown>,
  actorEmail: string = 'admin@infinicharm.com'
): AuditLogEntry {
  const newEntry: AuditLogEntry = {
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    actorId: 'usr-admin-01',
    actorEmail,
    action,
    resourceType,
    resourceId,
    diff,
    ipAddress: typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server / Admin Action',
    createdAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      const logs = getAuditLogs();
      const updated = [newEntry, ...logs];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 100))); // Keep last 100 entries
    } catch (err) {
      console.error('Failed to persist audit log:', err);
    }
  }

  return newEntry;
}

