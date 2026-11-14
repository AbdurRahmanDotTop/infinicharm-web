// ==============================================================================
// InfiniCharm — Public Storefront Badges & Guarantees API (/api/settings/badges)
// Returns active badges for PDP display
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getStorefrontBadges } from '@/lib/server/storefront-badges-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';
    const badges = getStorefrontBadges(!all);

    return NextResponse.json(
      {
        success: true,
        count: badges.length,
        badges,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch badges' },
      { status: 500 }
    );
  }
}

