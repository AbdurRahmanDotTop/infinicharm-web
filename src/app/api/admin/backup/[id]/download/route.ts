import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/server/admin-auth';
import { getBackupById } from '@/lib/server/backup-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const { id } = await params;
    const backup = getBackupById(id);
    if (!backup) {
      return NextResponse.json({ success: false, error: `Backup "${id}" not found.` }, { status: 404 });
    }

    const filename = `${backup.backupId}.json`;
    const jsonStr = JSON.stringify(backup, null, 2);

    return new NextResponse(jsonStr, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('[api/admin/backup/[id]/download GET error]:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Download failed.' }, { status: 500 });
  }
}

