import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, getAdminActorEmail } from '@/lib/server/admin-auth';
import {
  getBackupById,
  restoreBackup,
  BackupSectionKey,
} from '@/lib/server/backup-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    let archive = body.archive;

    if (!archive && body.backupId) {
      archive = getBackupById(body.backupId);
      if (!archive) {
        return NextResponse.json(
          { success: false, error: `Stored backup "${body.backupId}" not found.` },
          { status: 404 }
        );
      }
    }

    if (!archive) {
      return NextResponse.json(
        { success: false, error: 'Backup archive data or backupId is required for restoration.' },
        { status: 400 }
      );
    }

    const adminEmail = getAdminActorEmail(req);
    const selectedSections: BackupSectionKey[] | undefined = body.selectedSections;

    const result = restoreBackup({
      archive,
      adminEmail,
      selectedSections,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.message, result }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      result,
    });
  } catch (err: any) {
    console.error('[api/admin/backup/restore POST error]:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Restoration failed.' }, { status: 500 });
  }
}

