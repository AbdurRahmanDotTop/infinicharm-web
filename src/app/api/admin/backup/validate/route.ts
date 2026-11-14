import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/server/admin-auth';
import { validateBackupArchive, getBackupById } from '@/lib/server/backup-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    let payload = body.archive;

    // If backupId is passed instead of direct archive, lookup from storage
    if (!payload && body.backupId) {
      payload = getBackupById(body.backupId);
      if (!payload) {
        return NextResponse.json(
          { success: false, error: `Stored backup "${body.backupId}" not found.` },
          { status: 404 }
        );
      }
    }

    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Backup archive data or backupId is required.' },
        { status: 400 }
      );
    }

    const report = validateBackupArchive(payload);
    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    console.error('[api/admin/backup/validate POST error]:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Validation failed.' }, { status: 500 });
  }
}

