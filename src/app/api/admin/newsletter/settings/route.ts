import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminResponse } from '@/lib/server/admin-session';
import {
  getNewsletterWidgetSettings,
  updateNewsletterWidgetSettings,
} from '@/lib/server/newsletter-store';

const settingsSchema = z.object({
  isEnabled: z.boolean().optional(),
  badge: z.string().trim().min(1).max(80).optional(),
  heading: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().min(1).max(500).optional(),
  emailPlaceholder: z.string().trim().min(1).max(120).optional(),
  buttonText: z.string().trim().min(1).max(60).optional(),
  loadingText: z.string().trim().min(1).max(60).optional(),
  successMessage: z.string().trim().min(1).max(300).optional(),
  alreadySubscribedMessage: z.string().trim().min(1).max(300).optional(),
  invalidEmailMessage: z.string().trim().min(1).max(200).optional(),
  errorMessage: z.string().trim().min(1).max(300).optional(),
  privacyFootnote: z.string().trim().max(240).optional(),
  sendWelcomeEmail: z.boolean().optional(),
  welcomeTemplateId: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;
  return NextResponse.json({ success: true, settings: getNewsletterWidgetSettings() });
}

export async function PUT(req: NextRequest) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid newsletter settings payload.', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const settings = updateNewsletterWidgetSettings(parsed.data);
  return NextResponse.json({ success: true, settings });
}
