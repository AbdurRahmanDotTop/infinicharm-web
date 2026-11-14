import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminResponse } from '@/lib/server/admin-session';
import {
  adminDeleteSubscriber,
  adminUpdateSubscriber,
} from '@/lib/server/newsletter-store';

const updateSchema = z.object({
  email: z.string().trim().email().optional(),
  fullName: z.string().trim().max(120).optional(),
  status: z.enum(['ACTIVE', 'UNSUBSCRIBED', 'BOUNCED', 'SUPPRESSED']).optional(),
  source: z.string().trim().max(80).optional(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const { id } = await context.params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || 'Invalid update payload.' },
      { status: 400 }
    );
  }

  const res = adminUpdateSubscriber(id, parsed.data);
  if (!res.success) {
    const status = res.error?.includes('not found') ? 404 : 400;
    return NextResponse.json({ success: false, error: res.error }, { status });
  }

  return NextResponse.json({ success: true, subscriber: res.subscriber });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const { id } = await context.params;
  const deleted = adminDeleteSubscriber(id);
  if (!deleted) {
    return NextResponse.json(
      { success: false, error: 'Subscriber not found.' },
      { status: 404 }
    );
  }
  return NextResponse.json({ success: true });
}
