import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminResponse } from '@/lib/server/admin-session';
import {
  getGlobalNotificationPreferences,
  updateGlobalNotificationPreferences,
} from '@/lib/server/notifications-store';

const PreferencesSchema = z.object({
  notificationsEnabled: z.boolean().optional(),
  defaultAdminEmails: z
    .array(z.string().trim().email('Each admin email must be valid'))
    .optional(),
  supportReplyToEmail: z.string().trim().email('Valid reply-to email is required').optional(),
  defaultVendorFallbackEmail: z.string().trim().optional(),
  defaultSmtpConfigId: z.string().nullable().optional(),
  maxAutoRetries: z.number().int().min(0).max(5).optional(),
  deduplicateOverlappingRecipients: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  return NextResponse.json({ preferences: getGlobalNotificationPreferences() });
}

export async function PUT(req: NextRequest) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const raw = await req.json().catch(() => null);
  const parsed = PreferencesSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid preferences payload.' },
      { status: 400 }
    );
  }

  const preferences = updateGlobalNotificationPreferences(parsed.data);
  return NextResponse.json({ preferences });
}
