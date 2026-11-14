import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getSubscriberByToken,
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
} from '@/lib/server/newsletter-store';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim();
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Missing unsubscribe token.' },
      { status: 400 }
    );
  }

  const sub = getSubscriberByToken(token);
  if (!sub) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired unsubscribe link.' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    subscriber: {
      email: sub.email,
      status: sub.status,
      unsubscribedAt: sub.unsubscribedAt || null,
    },
  });
}

const unsubSchema = z.object({
  token: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  action: z.enum(['unsubscribe', 'resubscribe']).default('unsubscribe'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = unsubSchema.safeParse(body);
    if (!parsed.success || (!parsed.data.token && !parsed.data.email)) {
      return NextResponse.json(
        { success: false, error: 'A valid unsubscribe token or email address is required.' },
        { status: 400 }
      );
    }

    if (parsed.data.action === 'resubscribe') {
      const targetEmail = parsed.data.token
        ? getSubscriberByToken(parsed.data.token)?.email
        : parsed.data.email;
      if (!targetEmail) {
        return NextResponse.json(
          { success: false, error: 'Subscriber record not found.' },
          { status: 404 }
        );
      }
      const res = subscribeToNewsletter({
        email: targetEmail,
        source: 'unsubscribe_page_resubscribe',
      });
      if (res.outcome === 'SUPPRESSED') {
        return NextResponse.json({ success: false, error: res.message }, { status: 403 });
      }
      return NextResponse.json({
        success: true,
        status: 'ACTIVE',
        email: targetEmail,
        message: 'Welcome back! You have been re-subscribed to the InfiniCharm Circle.',
      });
    }

    const res = unsubscribeFromNewsletter({
      token: parsed.data.token,
      email: parsed.data.email,
    });
    if (!res.success || !res.subscriber) {
      return NextResponse.json(
        { success: false, error: res.message },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      status: res.subscriber.status,
      email: res.subscriber.email,
      message: res.message,
    });
  } catch (err) {
    console.error('[POST /api/newsletter/unsubscribe] error:', err);
    return NextResponse.json(
      { success: false, error: 'Unable to update subscription preference.' },
      { status: 500 }
    );
  }
}

