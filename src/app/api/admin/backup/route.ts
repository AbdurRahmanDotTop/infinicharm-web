import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, getAdminActorEmail } from '@/lib/server/admin-auth';
import {
  listBackups,
  createBackup,
  BACKUP_SECTIONS,
  BackupSectionKey,
} from '@/lib/server/backup-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const backups = listBackups();
    const totalStorageBytes = backups.reduce((sum, b) => sum + (b.fileSizeBytes || 0), 0);
    const lastBackup = backups.length > 0 ? backups[0] : null;

    return NextResponse.json({
      success: true,
      backups,
      sections: Object.values(BACKUP_SECTIONS),
      summary: {
        totalBackups: backups.length,
        totalStorageBytes,
        lastBackupAt: lastBackup?.createdAt || null,
        lastBackupType: lastBackup?.type || null,
      },
    });
  } catch (err: any) {
    console.error('[api/admin/backup GET error]:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to list backups.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const type: 'FULL' | 'SECTION' = body.type === 'SECTION' ? 'SECTION' : 'FULL';
    const section: BackupSectionKey | undefined = body.section;
    const note: string | undefined = body.note;
    const adminEmail = getAdminActorEmail(req);

    if (type === 'SECTION' && (!section || !BACKUP_SECTIONS[section])) {
      return NextResponse.json(
        { success: false, error: 'Valid section is required for section backup.' },
        { status: 400 }
      );
    }

    const archive = createBackup({
      type,
      section,
      adminEmail,
      note,
    });

    return NextResponse.json({
      success: true,
      message: `Backup ${archive.backupId} generated successfully.`,
      backup: archive,
    });
  } catch (err: any) {
    console.error('[api/admin/backup POST error]:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to generate backup.' }, { status: 500 });
  }
}

