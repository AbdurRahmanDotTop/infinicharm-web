import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/server/admin-auth';
import { exportCollectionToFormat, CollectionKey } from '@/lib/server/backup-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const collection = (searchParams.get('collection') || 'products') as CollectionKey;
    const format = (searchParams.get('format') === 'csv' ? 'csv' : 'json') as 'json' | 'csv';

    const exported = exportCollectionToFormat(collection, format);

    return new NextResponse(exported.content, {
      status: 200,
      headers: {
        'Content-Type': exported.mimeType,
        'Content-Disposition': `attachment; filename="${exported.filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('[api/admin/backup/export GET error]:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Export failed.' }, { status: 500 });
  }
}

