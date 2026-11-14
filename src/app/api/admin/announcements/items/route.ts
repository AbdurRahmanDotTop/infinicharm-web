import { NextRequest, NextResponse } from 'next/server';
import { createAnnouncementItem } from '@/lib/server/announcements-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.text || !body.text.trim()) {
      return NextResponse.json(
        { success: false, error: 'Announcement text is required.' },
        { status: 400 }
      );
    }

    const created = createAnnouncementItem(body);
    return NextResponse.json({
      success: true,
      item: created,
      message: 'Announcement item created successfully.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create item.' },
      { status: 500 }
    );
  }
}

