import { NextResponse } from 'next/server';
import {
  getHomepageSections,
  createHomepageSection,
} from '@/lib/server/homepage-store';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const onlyEnabled = searchParams.get('onlyEnabled') === 'true';

    const sections = getHomepageSections(onlyEnabled);

    return NextResponse.json(
      {
        success: true,
        count: sections.length,
        sections,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching homepage sections:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error fetching homepage sections' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.title || !body.type) {
      return NextResponse.json(
        { success: false, error: 'Title and type are required for a homepage section.' },
        { status: 400 }
      );
    }

    const result = createHomepageSection({
      type: body.type,
      title: body.title.trim(),
      subtitle: body.subtitle?.trim() || '',
      badge: body.badge?.trim() || '',
      ctaText: body.ctaText?.trim() || '',
      ctaLink: body.ctaLink?.trim() || '',
      secondaryCtaText: body.secondaryCtaText?.trim() || '',
      secondaryCtaLink: body.secondaryCtaLink?.trim() || '',
      imageUrl: body.imageUrl?.trim() || '',
      isEnabled: body.isEnabled !== false,
      config: body.config || {},
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, section: result.section }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating homepage section:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error creating homepage section' },
      { status: 500 }
    );
  }
}

