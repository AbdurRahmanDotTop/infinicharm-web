import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getNewsletterWidgetSettings,
  subscribeToNewsletter,
} from '@/lib/server/newsletter-store';
import { sendWelcomeEmailToSubscriber } from '@/lib/server/email-marketing-store';

const subscribeSchema = z.object({
  email: z.string().trim().min(1, 'Email is required.').max(254),
  fullName: z.string().trim().max(120).optional(),
  source: z.string().trim().max(80).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = subscribeSchema.safeParse(body);
    const settings = getNewsletterWidgetSettings();

    if (!settings.isEnabled) {
      return NextResponse.json(
        {
          success: false,
          code: 'WIDGET_DISABLED',
          error: 'Newsletter subscriptions are currently paused by the administrator.',
        },
        { status: 403 }
      );
    }

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_EMAIL',
          error: settings.invalidEmailMessage || 'Please enter a valid email address.',
        },
        { status: 400 }
      );
    }

    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const consentIp = forwardedFor.split(',')[0]?.trim() || 'localhost';

    const result = subscribeToNewsletter({
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      source: parsed.data.source || 'homepage_circle',
      consentIp,
    });

    if (result.outcome === 'INVALID_EMAIL') {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_EMAIL',
          error: settings.invalidEmailMessage || result.message,
        },
        { status: 400 }
      );
    }

    if (result.outcome === 'SUPPRESSED') {
      return NextResponse.json(
        {
          success: false,
          code: 'SUPPRESSED',
          error: result.message,
        },
        { status: 403 }
      );
    }

    if (result.outcome === 'ALREADY_ACTIVE') {
      return NextResponse.json(
        {
          success: true,
          alreadySubscribed: true,
          code: 'ALREADY_ACTIVE',
          message: settings.alreadySubscribedMessage || result.message,
        },
        { status: 200 }
      );
    }

    // Trigger welcome email in background/gracefully without failing subscription persistence
    let welcomeEmailSent = false;
    if (result.subscriber) {
      const welcomeRes = await sendWelcomeEmailToSubscriber(result.subscriber).catch(() => ({
        attempted: true,
        sent: false,
      }));
      welcomeEmailSent = welcomeRes.sent;
    }

    return NextResponse.json(
      {
        success: true,
        alreadySubscribed: false,
        resubscribed: result.outcome === 'RESUBSCRIBED',
        code: result.outcome,
        welcomeEmailSent,
        message: settings.successMessage || result.message,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/newsletter/subscribe] error:', err);
    return NextResponse.json(
      {
        success: false,
        code: 'SERVER_ERROR',
        error: 'Unable to process subscription right now. Please try again shortly.',
      },
      { status: 500 }
    );
  }
}
