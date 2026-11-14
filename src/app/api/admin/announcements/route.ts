import { NextRequest, NextResponse } from 'next/server';
import {
  getAnnouncementConfig,
  setMasterAnnouncementBar,
  reorderAnnouncements,
} from '@/lib/server/announcements-store';

export async function GET() {
  try {
    const config = getAnnouncementConfig();
    return NextResponse.json({
      success: true,
      config,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to load announcements config.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { isMasterEnabled, orderedIds } = body;

    if (isMasterEnabled !== undefined) {
      setMasterAnnouncementBar(Boolean(isMasterEnabled));
    }

    if (Array.isArray(orderedIds)) {
      reorderAnnouncements(orderedIds);
    }

    const updated = getAnnouncementConfig();
    return NextResponse.json({
      success: true,
      config: updated,
      message: 'Announcement bar updated successfully.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update announcements.' },
      { status: 500 }
    );
  }
}

