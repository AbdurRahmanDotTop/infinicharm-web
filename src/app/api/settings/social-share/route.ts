import { NextResponse } from 'next/server';
import { getPublicSocialAndShareSettings } from '@/lib/server/social-share-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const data = getPublicSocialAndShareSettings();
    return NextResponse.json(
      {
        success: true,
        socialLinks: data.socialLinks,
        sharing: data.sharing,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to fetch public social and share settings.',
      },
      { status: 500 }
    );
  }
}

