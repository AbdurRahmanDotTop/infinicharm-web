import { NextRequest, NextResponse } from 'next/server';
import {
  filterMediaAssets,
  createMediaAsset,
  getMediaStatistics,
} from '@/lib/server/media-store';
import { validateAndNormalizeMediaUrl } from '@/lib/media/providers';
import { verifyAdminSession, getAdminActorEmail } from '@/lib/server/admin-auth';
import { appendServerAuditLog } from '@/lib/server/server-audit-store';
import type { MediaProvider, MediaType } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const provider = (searchParams.get('provider') || 'ALL') as MediaProvider | 'ALL';
  const mediaType = (searchParams.get('mediaType') || 'ALL') as MediaType | 'ALL';
  const status = searchParams.get('status') || 'ALL';
  const search = searchParams.get('search') || '';
  const productId = searchParams.get('productId') || undefined;

  const assets = filterMediaAssets({
    provider,
    mediaType,
    status,
    search,
    productId,
  });

  const stats = getMediaStatistics();

  return NextResponse.json({
    success: true,
    assets,
    stats,
  });
}

export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid media payload.' },
        { status: 400 }
      );
    }

    // Support validate-only mode for live UI previews
    if (body.validate_only && body.url) {
      const val = validateAndNormalizeMediaUrl(body.url);
      return NextResponse.json({
        success: val.isValid,
        validation: val,
      });
    }

    const { url, altText, title, caption, role, provider, mediaType, productId } = body;

    if (!url || !altText) {
      return NextResponse.json(
        { success: false, error: 'URL and alt text are required.' },
        { status: 400 }
      );
    }

    const result = createMediaAsset({
      url: String(url).trim(),
      altText: String(altText).trim(),
      title: title ? String(title).trim() : undefined,
      caption: caption ? String(caption).trim() : undefined,
      role,
      provider,
      mediaType,
      productId: productId ? String(productId).trim() : undefined,
    });

    if (!result.success || !result.asset) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to register external media' },
        { status: 400 }
      );
    }

    const actorEmail = getAdminActorEmail(req);
    appendServerAuditLog({
      actorId: 'usr-admin-01',
      actorEmail,
      action: 'REGISTER_EXTERNAL_MEDIA',
      resourceType: 'media_asset',
      resourceId: result.asset.id,
      diff: {
        externalUrl: result.asset.externalUrl,
        provider: result.asset.provider,
        mediaType: result.asset.mediaType,
      },
    });

    return NextResponse.json({
      success: true,
      asset: result.asset,
    });
  } catch (error: any) {
    console.error('[AdminMediaAPI] Error registering media:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Server error registering media asset' },
      { status: 500 }
    );
  }
}
