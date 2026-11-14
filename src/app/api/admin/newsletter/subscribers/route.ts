import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminResponse } from '@/lib/server/admin-session';
import {
  adminCreateSubscriber,
  exportSubscribersToCsv,
  queryNewsletterSubscribers,
} from '@/lib/server/newsletter-store';
import { NewsletterSubscriberStatus } from '@/types';

const createSchema = z.object({
  email: z.string().trim().email('Please provide a valid email address.'),
  fullName: z.string().trim().max(120).optional(),
  status: z.enum(['ACTIVE', 'UNSUBSCRIBED', 'BOUNCED', 'SUPPRESSED']).optional(),
  source: z.string().trim().max(80).optional(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function GET(req: NextRequest) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const search = sp.get('search') || undefined;
  const status = (sp.get('status') || 'ALL') as NewsletterSubscriberStatus | 'ALL';
  const source = sp.get('source') || 'ALL';
  const sortPreset = sp.get('sortBy') || 'newest';
  let sortBy: 'email' | 'status' | 'createdAt' | 'subscribedAt' = 'createdAt';
  let sortDir: 'asc' | 'desc' = 'desc';
  if (sortPreset === 'oldest') {
    sortBy = 'createdAt';
    sortDir = 'asc';
  } else if (sortPreset === 'email_asc') {
    sortBy = 'email';
    sortDir = 'asc';
  } else if (sortPreset === 'email_desc') {
    sortBy = 'email';
    sortDir = 'desc';
  }

  const page = Number(sp.get('page') || 1);
  const limit = Number(sp.get('limit') || 25);
  const format = sp.get('format');

  const result = queryNewsletterSubscribers({
    q: search,
    status,
    source,
    sortBy,
    sortDir,
    page,
    limit,
  });

  if (format === 'csv') {
    const csv = exportSubscribersToCsv(result.allFiltered);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="infinicharm-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({
    success: true,
    subscribers: result.subscribers,
    totalCount: result.totalCount,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
    stats: result.stats,
    sources: result.sources,
  });
}

export async function POST(req: NextRequest) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || 'Invalid subscriber payload.' },
      { status: 400 }
    );
  }

  const created = adminCreateSubscriber(parsed.data);
  if (!created.success) {
    return NextResponse.json({ success: false, error: created.error }, { status: 409 });
  }
  return NextResponse.json({ success: true, subscriber: created.subscriber }, { status: 201 });
}
