import { NextResponse } from 'next/server';
import { getPublicAuthSettings } from '@/lib/server/auth-settings-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const settings = getPublicAuthSettings();
    return NextResponse.json(
      { success: true, settings },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (err) {
    console.error('[api/auth/settings] GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Unable to load authentication policy settings.' },
      { status: 500 }
    );
  }
}

