import { NextRequest, NextResponse } from 'next/server';
import {
  updateAnnouncementItem,
  deleteAnnouncementItem,
} from '@/lib/server/announcements-store';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updated = updateAnnouncementItem(id, body);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Announcement item not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      item: updated,
      message: 'Announcement item updated.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update item.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ok = deleteAnnouncementItem(id);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Announcement item not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Announcement item deleted.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to delete item.' },
      { status: 500 }
    );
  }
}

