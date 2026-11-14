import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, getAdminActorEmail } from '@/lib/server/admin-auth';
import { getBackupById, deleteBackup } from '@/lib/server/backup-service';

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

    return NextResponse.json({ success: true, backup });
  } catch (err: any) {
    console.error('[api/admin/backup/[id] GET error]:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to fetch backup.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const { id } = await params;
    const adminEmail = getAdminActorEmail(req);
    const success = deleteBackup(id, adminEmail);

    if (!success) {
      return NextResponse.json({ success: false, error: `Backup "${id}" could not be deleted.` }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `Backup "${id}" deleted.` });
  } catch (err: any) {
    console.error('[api/admin/backup/[id] DELETE error]:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to delete backup.' }, { status: 500 });
  }
}

