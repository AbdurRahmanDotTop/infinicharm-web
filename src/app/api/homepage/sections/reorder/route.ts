import { NextResponse } from 'next/server';
import { reorderHomepageSections } from '@/lib/server/homepage-store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderedIds = body.orderedIds;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'orderedIds array is required.' },
        { status: 400 }
      );
    }

    const result = reorderHomepageSections(orderedIds);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, sections: result.sections });
  } catch (error: any) {
    console.error('Error reordering homepage sections:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error reordering sections' },
      { status: 500 }
    );
  }
}

