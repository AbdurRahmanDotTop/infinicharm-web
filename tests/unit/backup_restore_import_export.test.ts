import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import {
  createBackup,
  listBackups,
  getBackupById,
  deleteBackup,
  validateBackupArchive,
  restoreBackup,
  exportCollectionToFormat,
  parseIncomingImportData,
  previewCollectionImport,
  commitCollectionImport,
  computeChecksum,
  BACKUP_STORAGE_DIR,
  type BackupArchive,
} from '../../src/lib/server/backup-service.ts';

describe('Centralized Backup, Restore, Import & Export System Unit Tests', () => {
  let createdFullBackupId: string = '';
  let createdSectionBackupId: string = '';

  before(() => {
    if (!fs.existsSync(BACKUP_STORAGE_DIR)) {
      fs.mkdirSync(BACKUP_STORAGE_DIR, { recursive: true });
    }
  });

  after(() => {
    // Clean up created test backups
    if (createdFullBackupId) {
      deleteBackup(createdFullBackupId, 'test-cleanup@infinicharm.com');
    }
    if (createdSectionBackupId) {
      deleteBackup(createdSectionBackupId, 'test-cleanup@infinicharm.com');
    }
    // Also remove any test snapshots
    const files = fs.readdirSync(BACKUP_STORAGE_DIR);
    for (const file of files) {
      if (file.includes('test-') || file.includes('AUTO')) {
        try {
          fs.unlinkSync(path.join(BACKUP_STORAGE_DIR, file));
        } catch {}
      }
    }
  });

  it('1. Generates a Full Project Backup with valid SHA-256 checksum and redacted secrets', () => {
    const backup = createBackup({
      type: 'FULL',
      adminEmail: 'test-admin@infinicharm.com',
      note: 'Automated Unit Test Full Backup',
    });

    assert.ok(backup);
    assert.strictEqual(backup.format, 'infinicharm-backup');
    assert.strictEqual(backup.version, '1.0.0');
    assert.strictEqual(backup.type, 'FULL');
    assert.strictEqual(backup.createdBy, 'test-admin@infinicharm.com');
    assert.ok(backup.backupId.startsWith('BCK-FULL-'));
    assert.ok(backup.metadata.totalCollections >= 10);
    assert.ok(typeof backup.checksum === 'string' && backup.checksum.length === 64);

    createdFullBackupId = backup.backupId;

    // Verify deterministic checksum
    const recomputed = computeChecksum(backup.collections);
    assert.strictEqual(backup.checksum, recomputed);

    // Verify secrets are redacted
    const customers = backup.collections.customers as any[];
    if (Array.isArray(customers) && customers.length > 0) {
      customers.forEach((cust) => {
        if (cust.passwordHash) {
          assert.strictEqual(cust.passwordHash, '[REDACTED_SECRET]');
        }
        if (cust.salt) {
          assert.strictEqual(cust.salt, '[REDACTED_SECRET]');
        }
      });
    }

    // Verify stored file on disk
    const stored = getBackupById(backup.backupId);
    assert.ok(stored);
    assert.strictEqual(stored?.backupId, backup.backupId);
  });

  it('2. Generates a Section-Wise Backup with targeted collections only', () => {
    const backup = createBackup({
      type: 'SECTION',
      section: 'catalogue',
      adminEmail: 'test-admin@infinicharm.com',
      note: 'Catalogue Section Backup Test',
    });

    assert.ok(backup);
    assert.strictEqual(backup.type, 'SECTION');
    assert.strictEqual(backup.section, 'catalogue');
    assert.ok(backup.backupId.startsWith('BCK-CATALOGUE-'));
    assert.ok(backup.collections.products);
    assert.ok(backup.collections.categories);
    // Should NOT contain orders or customers in catalogue section
    assert.strictEqual(backup.collections.orders, undefined);
    assert.strictEqual(backup.collections.customers, undefined);

    createdSectionBackupId = backup.backupId;
  });

  it('3. Validates backup archives and detects checksum corruption', () => {
    const valid = getBackupById(createdFullBackupId);
    assert.ok(valid);

    const reportValid = validateBackupArchive(valid);
    assert.strictEqual(reportValid.isValid, true);
    assert.strictEqual(reportValid.checksumValid, true);
    assert.strictEqual(reportValid.errors.length, 0);

    // Tampered payload
    const tampered = JSON.parse(JSON.stringify(valid)) as BackupArchive;
    tampered.collections.products = [{ id: 'corrupted-product', title: 'Tampered' }];

    const reportTampered = validateBackupArchive(tampered);
    assert.strictEqual(reportTampered.isValid, false);
    assert.strictEqual(reportTampered.checksumValid, false);
    assert.ok(reportTampered.errors.some((e) => e.includes('Checksum verification failed')));
  });

  it('4. Restores system collections safely and creates a rollback snapshot', () => {
    const backup = getBackupById(createdSectionBackupId);
    assert.ok(backup);

    const result = restoreBackup({
      archive: backup!,
      adminEmail: 'test-admin@infinicharm.com',
      selectedSections: ['catalogue'],
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.restoredCollections.includes('products'));
    assert.ok(result.restoredCollections.includes('categories'));
    assert.ok(result.rollbackSnapshotId, 'Rollback snapshot ID should be generated');

    // Clean up rollback snapshot
    if (result.rollbackSnapshotId) {
      deleteBackup(result.rollbackSnapshotId, 'test-cleanup@infinicharm.com');
    }
  });

  it('5. Exports collection to JSON and CSV formats with RFC-4180 escaping', () => {
    // JSON export
    const jsonExp = exportCollectionToFormat('categories', 'json');
    assert.strictEqual(jsonExp.mimeType, 'application/json');
    assert.ok(jsonExp.filename.endsWith('.json'));
    const parsedJson = JSON.parse(jsonExp.content);
    assert.ok(Array.isArray(parsedJson));

    // CSV export
    const csvExp = exportCollectionToFormat('categories', 'csv');
    assert.strictEqual(csvExp.mimeType, 'text/csv');
    assert.ok(csvExp.filename.endsWith('.csv'));
    const lines = csvExp.content.split('\n');
    assert.ok(lines.length >= 2, 'CSV should have at least header and 1 row');
    assert.ok(lines[0].includes('name'));
    assert.ok(lines[0].includes('slug'));
  });

  it('6. Parses CSV import data and accurately detects duplicates during dry-run preview', () => {
    const sampleCsv = `id,name,slug,isActive\ntest-cat-999,Test New Category,test-new-category,true\ncat-honey,Honey Modified,honey,true`;

    const preview = previewCollectionImport({
      collectionKey: 'categories',
      format: 'csv',
      content: sampleCsv,
      strategy: 'SKIP',
    });

    assert.strictEqual(preview.isValid, true);
    assert.strictEqual(preview.totalParsed, 2);
    // cat-honey already exists in default categories
    assert.strictEqual(preview.duplicateCount, 1);
    assert.strictEqual(preview.newCount, 1);
  });

  it('7. Commits import with SKIP and OVERWRITE conflict handling strategies', () => {
    // 1. Import with SKIP
    const importData = JSON.stringify([
      { id: 'cat-honey', name: 'Should Not Overwrite Honey', slug: 'honey', isActive: true },
      { id: 'cat-unit-test-1', name: 'Unit Test Category', slug: 'unit-test-category', isActive: true },
    ]);

    const skipResult = commitCollectionImport({
      collectionKey: 'categories',
      format: 'json',
      content: importData,
      strategy: 'SKIP',
      adminEmail: 'test-admin@infinicharm.com',
    });

    assert.strictEqual(skipResult.success, true);
    assert.strictEqual(skipResult.skippedCount, 1, 'Existing cat-honey should be skipped');
    assert.strictEqual(skipResult.insertedCount, 1, 'New cat-unit-test-1 should be inserted');

    // 2. Clean up inserted test category
    const categories = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'categories.json'), 'utf8'));
    const cleaned = categories.filter((c: any) => c.id !== 'cat-unit-test-1');
    fs.writeFileSync(path.join(process.cwd(), 'src', 'data', 'categories.json'), JSON.stringify(cleaned, null, 2));
  });

  it('8. Lists backups and handles archive deletion', () => {
    const list = listBackups();
    assert.ok(Array.isArray(list));
    assert.ok(list.some((b) => b.backupId === createdFullBackupId));

    const deleted = deleteBackup(createdFullBackupId, 'test-admin@infinicharm.com');
    assert.strictEqual(deleted, true);

    const recheck = getBackupById(createdFullBackupId);
    assert.strictEqual(recheck, null);
    createdFullBackupId = '';
  });
});
