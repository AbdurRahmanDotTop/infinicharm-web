import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { appendServerAuditLog } from './server-audit-store.ts';

// ==============================================================================
// InfiniCharm — Centralized Backup, Restore, Import & Export Engine
// Authoritative Single Source of Truth, Zero Secrets Exposure, DRY Architecture
// ==============================================================================

export type BackupSectionKey =
  | 'catalogue'
  | 'orders'
  | 'customers'
  | 'marketing'
  | 'content'
  | 'settings';

export type CollectionKey =
  | 'products'
  | 'categories'
  | 'media_assets'
  | 'storefront_badges'
  | 'orders'
  | 'customers'
  | 'coupons'
  | 'announcements'
  | 'newsletter_subscribers'
  | 'email_campaigns'
  | 'newsletter_settings'
  | 'homepage_sections'
  | 'reviews'
  | 'review_settings'
  | 'email_templates'
  | 'inquiries'
  | 'payment_gateways'
  | 'social_and_share_settings'
  | 'auth_settings'
  | 'smtp_configs'
  | 'notification_rules'
  | 'notification_preferences';

export interface SectionDefinition {
  key: BackupSectionKey;
  label: string;
  description: string;
  collections: CollectionKey[];
}

export const BACKUP_SECTIONS: Record<BackupSectionKey, SectionDefinition> = {
  catalogue: {
    key: 'catalogue',
    label: 'Catalogue & Products',
    description: 'Products, Categories, Media Asset URLs & Storefront Badges',
    collections: ['products', 'categories', 'media_assets', 'storefront_badges'],
  },
  orders: {
    key: 'orders',
    label: 'Orders & Fulfillment',
    description: 'Orders, Consignments & Tracking History',
    collections: ['orders'],
  },
  customers: {
    key: 'customers',
    label: 'Customers & Accounts',
    description: 'Customer profiles, addresses, wishlists (password hashes redacted)',
    collections: ['customers'],
  },
  marketing: {
    key: 'marketing',
    label: 'Marketing & Promotions',
    description: 'Coupons, Announcement Bars, Subscribers & Campaigns',
    collections: ['coupons', 'announcements', 'newsletter_subscribers', 'email_campaigns', 'newsletter_settings'],
  },
  content: {
    key: 'content',
    label: 'Content, CMS & Reviews',
    description: 'Homepage CMS Sections, Customer Reviews, Email Templates & Inquiries',
    collections: ['homepage_sections', 'reviews', 'review_settings', 'email_templates', 'inquiries'],
  },
  settings: {
    key: 'settings',
    label: 'System & Payment Settings',
    description: 'Payment Gateways, Social Share, Auth Settings & SMTP (secrets redacted)',
    collections: ['payment_gateways', 'social_and_share_settings', 'auth_settings', 'smtp_configs', 'notification_rules', 'notification_preferences'],
  },
};

const COLLECTION_FILE_MAP: Record<CollectionKey, string> = {
  products: 'products.json',
  categories: 'categories.json',
  media_assets: 'media_assets.json',
  storefront_badges: 'storefront_badges.json',
  orders: 'orders.json',
  customers: 'customers.json',
  coupons: 'coupons.json',
  announcements: 'announcements.json',
  newsletter_subscribers: 'newsletter_subscribers.json',
  email_campaigns: 'email_campaigns.json',
  newsletter_settings: 'newsletter_settings.json',
  homepage_sections: 'homepage_sections.json',
  reviews: 'reviews.json',
  review_settings: 'review_settings.json',
  email_templates: 'email_templates.json',
  inquiries: 'inquiries.json',
  payment_gateways: 'payment_gateways.json',
  social_and_share_settings: 'social_and_share_settings.json',
  auth_settings: 'auth_settings.json',
  smtp_configs: 'smtp_configs.json',
  notification_rules: 'notification_rules.json',
  notification_preferences: 'notification_preferences.json',
};

export const BACKUP_STORAGE_DIR = path.join(process.cwd(), 'src', 'data', 'backups');

export interface BackupArchiveMeta {
  backupId: string;
  type: 'FULL' | 'SECTION';
  section?: BackupSectionKey | null;
  createdAt: string;
  createdBy: string;
  environment: string;
  totalRecords: number;
  totalCollections: number;
  collectionRecordCounts: Record<string, number>;
  fileSizeBytes: number;
  checksum: string;
  note?: string;
}

export interface BackupArchive {
  format: 'infinicharm-backup';
  version: '1.0.0';
  backupId: string;
  type: 'FULL' | 'SECTION';
  section?: BackupSectionKey | null;
  createdAt: string;
  createdBy: string;
  environment: string;
  note?: string;
  metadata: {
    totalCollections: number;
    totalRecords: number;
    collectionRecordCounts: Record<string, number>;
  };
  checksum: string;
  collections: Partial<Record<CollectionKey, unknown[]>>;
}

// Ensure backups directory exists
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_STORAGE_DIR)) {
    fs.mkdirSync(BACKUP_STORAGE_DIR, { recursive: true });
  }
}

// Compute deterministic SHA-256 of collections payload
export function computeChecksum(collections: unknown): string {
  const json = JSON.stringify(collections);
  return crypto.createHash('sha256').update(json, 'utf8').digest('hex');
}

// Read collection JSON from disk safely
export function readCollectionFromDisk<T = unknown[]>(key: CollectionKey): T {
  const fileName = COLLECTION_FILE_MAP[key];
  if (!fileName) return [] as unknown as T;
  const filePath = path.join(process.cwd(), 'src', 'data', fileName);
  try {
    if (!fs.existsSync(filePath)) return [] as unknown as T;
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return [] as unknown as T;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch (err) {
    console.error(`Error reading collection ${key} from ${filePath}:`, err);
    return [] as unknown as T;
  }
}

// Write collection JSON to disk safely
export function writeCollectionToDisk(key: CollectionKey, data: unknown): void {
  const fileName = COLLECTION_FILE_MAP[key];
  if (!fileName) return;
  const filePath = path.join(process.cwd(), 'src', 'data', fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Scrub sensitive credentials from export payload
const SENSITIVE_KEY_REGEX = /(passwordHash|salt|secretKey|keySecret|webhookSecret|smtpPass|password|token|authToken)/i;

function redactSensitiveData(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitiveData);
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEY_REGEX.test(k) && typeof v === 'string' && v.trim()) {
        out[k] = '[REDACTED_SECRET]';
      } else {
        out[k] = redactSensitiveData(v);
      }
    }
    return out;
  }
  return obj;
}

// Merge restored data over existing data, preserving existing secrets if incoming is [REDACTED_SECRET]
function mergePreservingSecrets(incoming: unknown, existing: unknown): unknown {
  if (incoming === '[REDACTED_SECRET]' && existing !== undefined && existing !== null) {
    return existing;
  }
  if (incoming === null || incoming === undefined) return incoming;
  if (Array.isArray(incoming)) {
    if (!Array.isArray(existing)) return incoming;
    return incoming.map((item, idx) => mergePreservingSecrets(item, existing[idx]));
  }
  if (typeof incoming === 'object' && typeof existing === 'object' && existing !== null) {
    const incObj = incoming as Record<string, unknown>;
    const exObj = existing as Record<string, unknown>;
    const result: Record<string, unknown> = { ...incObj };
    for (const [k, v] of Object.entries(incObj)) {
      result[k] = mergePreservingSecrets(v, exObj[k]);
    }
    return result;
  }
  return incoming;
}

// ==============================================================================
// 1. BACKUP CREATION & LISTING
// ==============================================================================

export function listBackups(): BackupArchiveMeta[] {
  ensureBackupDir();
  try {
    const files = fs.readdirSync(BACKUP_STORAGE_DIR).filter((f) => f.endsWith('.json'));
    const metas: BackupArchiveMeta[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(BACKUP_STORAGE_DIR, file);
        const stats = fs.statSync(filePath);
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed: BackupArchive = JSON.parse(raw);

        if (parsed.format === 'infinicharm-backup' && parsed.backupId) {
          metas.push({
            backupId: parsed.backupId,
            type: parsed.type,
            section: parsed.section,
            createdAt: parsed.createdAt || stats.birthtime.toISOString(),
            createdBy: parsed.createdBy || 'System',
            environment: parsed.environment || 'unknown',
            totalRecords: parsed.metadata?.totalRecords || 0,
            totalCollections: parsed.metadata?.totalCollections || 0,
            collectionRecordCounts: parsed.metadata?.collectionRecordCounts || {},
            fileSizeBytes: stats.size,
            checksum: parsed.checksum || '',
            note: parsed.note,
          });
        }
      } catch {
        // Skip unparseable files
      }
    }

    return metas.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error('Failed to list backups:', err);
    return [];
  }
}

export function getBackupById(id: string): BackupArchive | null {
  ensureBackupDir();
  const safeId = path.basename(id).replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = path.join(BACKUP_STORAGE_DIR, `${safeId}.json`);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed: BackupArchive = JSON.parse(raw);
    if (parsed.format === 'infinicharm-backup') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function createBackup(options: {
  type: 'FULL' | 'SECTION';
  section?: BackupSectionKey;
  adminEmail: string;
  note?: string;
}): BackupArchive {
  ensureBackupDir();

  const timestamp = new Date();
  const dateStr = timestamp.toISOString().replace(/[-:T]/g, '').slice(0, 8);
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  const prefix = options.type === 'FULL' ? 'BCK-FULL' : `BCK-${(options.section || 'SEC').toUpperCase()}`;
  const backupId = `${prefix}-${dateStr}-${randomSuffix}`;

  const targetCollections: CollectionKey[] =
    options.type === 'SECTION' && options.section && BACKUP_SECTIONS[options.section]
      ? BACKUP_SECTIONS[options.section].collections
      : (Object.keys(COLLECTION_FILE_MAP) as CollectionKey[]);

  const collectionsData: Partial<Record<CollectionKey, unknown[]>> = {};
  const recordCounts: Record<string, number> = {};
  let totalRecords = 0;

  for (const collKey of targetCollections) {
    const rawData = readCollectionFromDisk(collKey);
    const sanitized = redactSensitiveData(rawData) as unknown[];
    collectionsData[collKey] = Array.isArray(sanitized) ? sanitized : [];
    const count = Array.isArray(sanitized) ? sanitized.length : 1;
    recordCounts[collKey] = count;
    totalRecords += count;
  }

  const checksum = computeChecksum(collectionsData);

  const archive: BackupArchive = {
    format: 'infinicharm-backup',
    version: '1.0.0',
    backupId,
    type: options.type,
    section: options.section || null,
    createdAt: timestamp.toISOString(),
    createdBy: options.adminEmail || 'admin@infinicharm.com',
    environment: process.env.NODE_ENV || 'development',
    note: options.note || (options.type === 'FULL' ? 'Complete Marketplace Backup' : `Section Backup: ${options.section}`),
    metadata: {
      totalCollections: targetCollections.length,
      totalRecords,
      collectionRecordCounts: recordCounts,
    },
    checksum,
    collections: collectionsData,
  };

  const filePath = path.join(BACKUP_STORAGE_DIR, `${backupId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(archive, null, 2), 'utf8');

  // Audit log
  appendServerAuditLog({
    actorId: 'admin-action',
    actorEmail: options.adminEmail || 'admin@infinicharm.com',
    action: 'BACKUP_CREATE',
    resourceType: 'backup',
    resourceId: backupId,
    diff: {
      type: options.type,
      section: options.section,
      totalRecords,
      totalCollections: targetCollections.length,
      checksum,
    },
  });

  return archive;
}

export function deleteBackup(backupId: string, adminEmail: string): boolean {
  ensureBackupDir();
  const safeId = path.basename(backupId).replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = path.join(BACKUP_STORAGE_DIR, `${safeId}.json`);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  try {
    fs.unlinkSync(filePath);

    appendServerAuditLog({
      actorId: 'admin-action',
      actorEmail: adminEmail || 'admin@infinicharm.com',
      action: 'BACKUP_DELETE',
      resourceType: 'backup',
      resourceId: safeId,
    });

    return true;
  } catch (err) {
    console.error(`Failed to delete backup ${backupId}:`, err);
    return false;
  }
}

// ==============================================================================
// 2. VALIDATION & RESTORATION
// ==============================================================================

export interface BackupValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  backupId?: string;
  type?: 'FULL' | 'SECTION';
  section?: string | null;
  createdAt?: string;
  totalRecords?: number;
  totalCollections?: number;
  collectionsPresent: string[];
  checksumValid: boolean;
}

export function validateBackupArchive(data: unknown): BackupValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: ['Invalid backup payload: expected a JSON object.'],
      warnings: [],
      collectionsPresent: [],
      checksumValid: false,
    };
  }

  const archive = data as Partial<BackupArchive>;

  if (archive.format !== 'infinicharm-backup') {
    errors.push('Unrecognized backup format. Expected "infinicharm-backup".');
  }

  if (archive.version !== '1.0.0') {
    warnings.push(`Backup version "${archive.version}" may have schema differences with current "1.0.0".`);
  }

  if (!archive.backupId || typeof archive.backupId !== 'string') {
    errors.push('Missing or invalid backupId.');
  }

  if (!archive.collections || typeof archive.collections !== 'object') {
    errors.push('Missing collections data payload.');
  }

  const collectionsPresent = archive.collections ? Object.keys(archive.collections) : [];
  if (collectionsPresent.length === 0) {
    errors.push('Backup contains zero collections.');
  }

  let checksumValid = false;
  if (archive.checksum && archive.collections) {
    const computed = computeChecksum(archive.collections);
    if (computed === archive.checksum) {
      checksumValid = true;
    } else {
      errors.push('Checksum verification failed! Data integrity could not be confirmed.');
    }
  } else {
    warnings.push('Checksum is missing in the backup archive.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    backupId: archive.backupId,
    type: archive.type,
    section: archive.section,
    createdAt: archive.createdAt,
    totalRecords: archive.metadata?.totalRecords,
    totalCollections: archive.metadata?.totalCollections,
    collectionsPresent,
    checksumValid,
  };
}

export interface RestoreResult {
  success: boolean;
  message: string;
  rollbackSnapshotId?: string;
  restoredCollections: string[];
  recordsRestored: Record<string, number>;
  errors: string[];
}

export function restoreBackup(options: {
  archive: BackupArchive;
  adminEmail: string;
  selectedSections?: BackupSectionKey[];
}): RestoreResult {
  const validation = validateBackupArchive(options.archive);
  if (!validation.isValid) {
    return {
      success: false,
      message: 'Validation failed before restoration.',
      restoredCollections: [],
      recordsRestored: {},
      errors: validation.errors,
    };
  }

  // 1. Create Pre-Restoration Automatic Rollback Snapshot
  let rollbackSnapshot: BackupArchive | null = null;
  try {
    rollbackSnapshot = createBackup({
      type: 'FULL',
      adminEmail: 'system-rollback@infinicharm.com',
      note: `Automatic pre-restoration rollback snapshot before restoring ${options.archive.backupId}`,
    });
  } catch (err) {
    console.error('Failed to create pre-restoration rollback snapshot:', err);
  }

  const incomingCollections = options.archive.collections;
  const restoredCollections: string[] = [];
  const recordsRestored: Record<string, number> = {};
  const errors: string[] = [];

  // Determine allowed collections if specific sections were chosen
  let allowedCollections: Set<CollectionKey> | null = null;
  if (options.selectedSections && options.selectedSections.length > 0) {
    allowedCollections = new Set<CollectionKey>();
    for (const secKey of options.selectedSections) {
      const def = BACKUP_SECTIONS[secKey];
      if (def) {
        def.collections.forEach((c) => allowedCollections!.add(c));
      }
    }
  }

  try {
    for (const [keyStr, incomingData] of Object.entries(incomingCollections)) {
      const collKey = keyStr as CollectionKey;
      if (!COLLECTION_FILE_MAP[collKey]) continue;

      if (allowedCollections && !allowedCollections.has(collKey)) {
        continue;
      }

      // Read existing data so we preserve secrets (passwords, salts, API keys)
      const existingData = readCollectionFromDisk(collKey);
      const mergedData = mergePreservingSecrets(incomingData, existingData);

      writeCollectionToDisk(collKey, mergedData);
      restoredCollections.push(collKey);
      recordsRestored[collKey] = Array.isArray(mergedData) ? mergedData.length : 1;
    }

    appendServerAuditLog({
      actorId: 'admin-action',
      actorEmail: options.adminEmail || 'admin@infinicharm.com',
      action: 'BACKUP_RESTORE',
      resourceType: 'backup',
      resourceId: options.archive.backupId,
      diff: {
        restoredCollections,
        recordsRestored,
        rollbackSnapshotId: rollbackSnapshot?.backupId,
      },
    });

    return {
      success: true,
      message: `Successfully restored ${restoredCollections.length} collections.`,
      rollbackSnapshotId: rollbackSnapshot?.backupId,
      restoredCollections,
      recordsRestored,
      errors: [],
    };
  } catch (err: any) {
    errors.push(err?.message || 'Unexpected error writing restored collections.');
    return {
      success: false,
      message: 'Restoration failed. Automatic rollback snapshot is available.',
      rollbackSnapshotId: rollbackSnapshot?.backupId,
      restoredCollections,
      recordsRestored,
      errors,
    };
  }
}

// ==============================================================================
// 3. SECTION-WISE IMPORT & EXPORT (CSV & JSON)
// ==============================================================================

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

export function exportCollectionToFormat(
  collectionKey: CollectionKey,
  format: 'json' | 'csv'
): { filename: string; mimeType: string; content: string } {
  const rawData = readCollectionFromDisk(collectionKey);
  const sanitized = redactSensitiveData(rawData);

  if (format === 'json') {
    return {
      filename: `infinicharm_${collectionKey}_export_${Date.now()}.json`,
      mimeType: 'application/json',
      content: JSON.stringify(sanitized, null, 2),
    };
  }

  // CSV formatting: Flatten items
  if (!Array.isArray(sanitized) || sanitized.length === 0) {
    return {
      filename: `infinicharm_${collectionKey}_export_${Date.now()}.csv`,
      mimeType: 'text/csv',
      content: 'id\n',
    };
  }

  // Extract common columns based on first item or collection specifics
  const first = sanitized[0] as Record<string, unknown>;
  const headers = Object.keys(first).filter((k) => typeof first[k] !== 'function');

  const rows: string[] = [];
  rows.push(headers.join(','));

  for (const item of sanitized) {
    if (typeof item === 'object' && item !== null) {
      const line = headers.map((h) => escapeCsvField((item as Record<string, unknown>)[h])).join(',');
      rows.push(line);
    }
  }

  return {
    filename: `infinicharm_${collectionKey}_export_${Date.now()}.csv`,
    mimeType: 'text/csv',
    content: rows.join('\n'),
  };
}

export interface ImportPreviewReport {
  isValid: boolean;
  collectionKey: CollectionKey;
  format: 'json' | 'csv';
  strategy: 'SKIP' | 'OVERWRITE' | 'MERGE';
  totalParsed: number;
  newCount: number;
  duplicateCount: number;
  previewRows: Array<{ id?: string; previewText: string; isDuplicate: boolean }>;
  errors: string[];
}

export interface ImportCommitResult {
  success: boolean;
  message: string;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  totalRecordsNow: number;
  errors: string[];
}

export function parseIncomingImportData(
  collectionKey: CollectionKey,
  format: 'json' | 'csv',
  content: string
): { items: Array<Record<string, unknown>>; errors: string[] } {
  const errors: string[] = [];
  const items: Array<Record<string, unknown>> = [];

  if (!content || !content.trim()) {
    errors.push('Empty file content.');
    return { items, errors };
  }

  if (format === 'json') {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        for (const it of parsed) {
          if (it && typeof it === 'object') {
            items.push(it as Record<string, unknown>);
          }
        }
      } else if (parsed && typeof parsed === 'object') {
        items.push(parsed as Record<string, unknown>);
      } else {
        errors.push('JSON payload must be an array or object.');
      }
    } catch (err: any) {
      errors.push(`JSON Syntax Error: ${err.message}`);
    }
  } else {
    // CSV
    try {
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        errors.push('CSV must contain a header line and at least one data row.');
        return { items, errors };
      }

      const headers = parseCsvLine(lines[0]).map((h) => h.trim());
      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        const obj: Record<string, unknown> = {};
        for (let j = 0; j < headers.length; j++) {
          let val: unknown = values[j] !== undefined ? values[j].trim() : '';
          // Simple JSON decode for bracketed fields
          if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
            try {
              val = JSON.parse(val);
            } catch {
              // keep as string
            }
          } else if (val === 'true') {
            val = true;
          } else if (val === 'false') {
            val = false;
          }
          obj[headers[j]] = val;
        }
        items.push(obj);
      }
    } catch (err: any) {
      errors.push(`CSV Parsing Error: ${err.message}`);
    }
  }

  return { items, errors };
}

function getItemIdentifier(item: Record<string, unknown>, collectionKey: CollectionKey): string {
  if (item.id && typeof item.id === 'string') return item.id;
  if (collectionKey === 'coupons' && item.code) return String(item.code).toUpperCase();
  if (collectionKey === 'products' && item.slug) return String(item.slug);
  if (collectionKey === 'categories' && item.slug) return String(item.slug);
  if (collectionKey === 'customers' && item.email) return String(item.email).toLowerCase();
  if (collectionKey === 'newsletter_subscribers' && item.email) return String(item.email).toLowerCase();
  return (item.id as string) || '';
}

export function previewCollectionImport(options: {
  collectionKey: CollectionKey;
  format: 'json' | 'csv';
  content: string;
  strategy: 'SKIP' | 'OVERWRITE' | 'MERGE';
}): ImportPreviewReport {
  const { items, errors } = parseIncomingImportData(options.collectionKey, options.format, options.content);

  const existingData = readCollectionFromDisk(options.collectionKey);
  const existingArr = Array.isArray(existingData) ? (existingData as Array<Record<string, unknown>>) : [];
  const existingIdSet = new Set<string>();

  for (const ex of existingArr) {
    const id = getItemIdentifier(ex, options.collectionKey);
    if (id) existingIdSet.add(id);
  }

  let duplicateCount = 0;
  let newCount = 0;
  const previewRows: ImportPreviewReport['previewRows'] = [];

  for (const item of items) {
    const id = getItemIdentifier(item, options.collectionKey);
    const isDuplicate = Boolean(id && existingIdSet.has(id));

    if (isDuplicate) {
      duplicateCount++;
    } else {
      newCount++;
    }

    if (previewRows.length < 10) {
      const summaryText =
        (item.title as string) ||
        (item.name as string) ||
        (item.code as string) ||
        (item.email as string) ||
        (item.orderNumber as string) ||
        (item.subject as string) ||
        id ||
        'Item';

      previewRows.push({
        id,
        previewText: summaryText,
        isDuplicate,
      });
    }
  }

  return {
    isValid: errors.length === 0 && items.length > 0,
    collectionKey: options.collectionKey,
    format: options.format,
    strategy: options.strategy,
    totalParsed: items.length,
    newCount,
    duplicateCount,
    previewRows,
    errors,
  };
}

export function commitCollectionImport(options: {
  collectionKey: CollectionKey;
  format: 'json' | 'csv';
  content: string;
  strategy: 'SKIP' | 'OVERWRITE' | 'MERGE';
  adminEmail: string;
}): ImportCommitResult {
  const { items, errors } = parseIncomingImportData(options.collectionKey, options.format, options.content);
  if (errors.length > 0 || items.length === 0) {
    return {
      success: false,
      message: errors.join('; ') || 'No valid items found to import.',
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      totalRecordsNow: 0,
      errors,
    };
  }

  const existingData = readCollectionFromDisk(options.collectionKey);
  const existingArr = Array.isArray(existingData) ? [...(existingData as Array<Record<string, unknown>>)] : [];

  const existingIndexMap = new Map<string, number>();
  for (let i = 0; i < existingArr.length; i++) {
    const id = getItemIdentifier(existingArr[i], options.collectionKey);
    if (id) existingIndexMap.set(id, i);
  }

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const incoming of items) {
    let id = getItemIdentifier(incoming, options.collectionKey);
    if (!id && !incoming.id) {
      // Generate ID if missing
      id = `imp-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      incoming.id = id;
    }

    const existingIndex = id ? existingIndexMap.get(id) : undefined;

    if (existingIndex !== undefined) {
      // Conflict
      if (options.strategy === 'SKIP') {
        skippedCount++;
      } else if (options.strategy === 'OVERWRITE') {
        // Retain secrets from existing if incoming is redacted
        const merged = mergePreservingSecrets(incoming, existingArr[existingIndex]) as Record<string, unknown>;
        existingArr[existingIndex] = merged;
        updatedCount++;
      } else if (options.strategy === 'MERGE') {
        const merged = { ...existingArr[existingIndex], ...incoming };
        existingArr[existingIndex] = mergePreservingSecrets(merged, existingArr[existingIndex]) as Record<string, unknown>;
        updatedCount++;
      }
    } else {
      // New Item
      existingArr.push(incoming);
      if (id) existingIndexMap.set(id, existingArr.length - 1);
      insertedCount++;
    }
  }

  writeCollectionToDisk(options.collectionKey, existingArr);

  appendServerAuditLog({
    actorId: 'admin-action',
    actorEmail: options.adminEmail || 'admin@infinicharm.com',
    action: 'COLLECTION_IMPORT',
    resourceType: options.collectionKey,
    resourceId: `import-${Date.now()}`,
    diff: {
      strategy: options.strategy,
      format: options.format,
      insertedCount,
      updatedCount,
      skippedCount,
      totalRecordsNow: existingArr.length,
    },
  });

  return {
    success: true,
    message: `Import complete. ${insertedCount} inserted, ${updatedCount} updated, ${skippedCount} skipped.`,
    insertedCount,
    updatedCount,
    skippedCount,
    totalRecordsNow: existingArr.length,
    errors: [],
  };
}
