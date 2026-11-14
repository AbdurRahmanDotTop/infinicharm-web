import { NextResponse } from 'next/server';
import {
  getHomepageSectionById,
  updateHomepageSection,
  toggleHomepageSection,
  deleteHomepageSection,
} from '@/lib/server/homepage-store';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const section = getHomepageSectionById(id);

    if (!section) {
      return NextResponse.json(
        { success: false, error: `Homepage section "${id}" not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, section });
  } catch (error: any) {
    console.error('Error fetching section:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (body.action === 'TOGGLE_ENABLE') {
      const result = toggleHomepageSection(id, body.isEnabled);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, section: result.section });
    }

    const result = updateHomepageSection(id, body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, section: result.section });
  } catch (error: any) {
    console.error('Error updating homepage section:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error updating section' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = deleteHomepageSection(id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: `Section "${id}" deleted.` });
  } catch (error: any) {
    console.error('Error deleting section:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error deleting section' },
      { status: 500 }
    );
  }
}

