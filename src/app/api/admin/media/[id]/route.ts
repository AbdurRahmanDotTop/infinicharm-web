import { NextRequest, NextResponse } from 'next/server';
import {
  getMediaAssetById,
  updateMediaAsset,
  deleteMediaAsset,
} from '@/lib/server/media-store';
import { verifyAdminSession, getAdminActorEmail } from '@/lib/server/admin-auth';
import { appendServerAuditLog } from '@/lib/server/server-audit-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminSession(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;
  const asset = getMediaAssetById(id);

  if (!asset) {
    return NextResponse.json({ success: false, error: 'Media asset not found.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, asset });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminSession(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid payload.' }, { status: 400 });
    }

    const result = updateMediaAsset(id, body);
    if (!result.success || !result.asset) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to update media asset.' },
        { status: 400 }
      );
    }

    const actorEmail = getAdminActorEmail(req);
    appendServerAuditLog({
      actorId: 'usr-admin-01',
      actorEmail,
      action: 'UPDATE_EXTERNAL_MEDIA',
      resourceType: 'media_asset',
      resourceId: id,
      diff: body,
    });

    return NextResponse.json({ success: true, asset: result.asset });
  } catch (error: any) {
    console.error('[AdminMediaAPI] Error updating media:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Server error updating media asset' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminSession(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;
  const existing = getMediaAssetById(id);

  if (!existing) {
    return NextResponse.json({ success: false, error: 'Media asset not found.' }, { status: 404 });
  }

  const result = deleteMediaAsset(id);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error || 'Failed to delete media asset.' },
      { status: 400 }
    );
  }

  const actorEmail = getAdminActorEmail(req);
  appendServerAuditLog({
    actorId: 'usr-admin-01',
    actorEmail,
    action: 'DELETE_EXTERNAL_MEDIA',
    resourceType: 'media_asset',
    resourceId: id,
    diff: {
      deletedUrl: existing.externalUrl,
      provider: existing.provider,
      notice: 'External binary on provider remains untouched',
    },
  });

  return NextResponse.json({
    success: true,
    message: 'Media reference removed. External host asset remains unaffected.',
  });
}
