import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, getAdminActorEmail } from '@/lib/server/admin-auth';
import {
  previewCollectionImport,
  commitCollectionImport,
  CollectionKey,
} from '@/lib/server/backup-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const collectionKey = (body.collectionKey || 'products') as CollectionKey;
    const format = (body.format === 'csv' ? 'csv' : 'json') as 'json' | 'csv';
    const content = body.content as string;
    const strategy = (['SKIP', 'OVERWRITE', 'MERGE'].includes(body.strategy)
      ? body.strategy
      : 'SKIP') as 'SKIP' | 'OVERWRITE' | 'MERGE';
    const isDryRun = body.dryRun === true;
    const adminEmail = getAdminActorEmail(req);

    if (!content || !content.trim()) {
      return NextResponse.json({ success: false, error: 'Content is required for import.' }, { status: 400 });
    }

    if (isDryRun) {
      const preview = previewCollectionImport({
        collectionKey,
        format,
        content,
        strategy,
      });

      return NextResponse.json({
        success: preview.isValid,
        preview,
      });
    }

    // Commit import
    const result = commitCollectionImport({
      collectionKey,
      format,
      content,
      strategy,
      adminEmail,
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
    console.error('[api/admin/backup/import POST error]:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Import operation failed.' }, { status: 500 });
  }
}

