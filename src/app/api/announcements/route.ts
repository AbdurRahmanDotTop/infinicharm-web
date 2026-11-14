import { NextRequest, NextResponse } from 'next/server';
import { getActiveAnnouncements } from '@/lib/server/announcements-store';

export async function GET() {
  try {
    const data = getActiveAnnouncements();
    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to load announcements.' },
      { status: 500 }
    );
  }
}

