import { NextResponse } from 'next/server';
import { getShippingSettings } from '@/lib/server/shipping-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = getShippingSettings();
    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching shipping settings.' },
      { status: 500 }
    );
  }
}
