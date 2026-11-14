import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminResponse } from '@/lib/server/admin-session';
import {
  createSmtpConfig,
  listSanitizedSmtpConfigs,
} from '@/lib/server/smtp-store';

const createSmtpSchema = z.object({
  name: z.string().trim().min(1, 'Provider label is required.').max(120),
  providerType: z.enum(['BREVO', 'CUSTOM_SMTP']),
  host: z.string().trim().min(1, 'SMTP host is required.').max(200),
  port: z.coerce.number().int().min(1).max(65535),
  encryption: z.enum(['NONE', 'STARTTLS', 'SSL']),
  username: z.string().trim().max(200).optional(),
  secret: z.string().trim().max(500).optional(),
  useEnvCredentials: z.boolean().optional(),
  senderName: z.string().trim().min(1, 'Sender name is required.').max(120),
  senderEmail: z.string().trim().email('Valid sender email is required.'),
  replyToEmail: z.string().trim().email().optional().or(z.literal('')),
  isDefault: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const configs = listSanitizedSmtpConfigs();
  return NextResponse.json({
    success: true,
    configs,
    envBrevoConfigured: Boolean(process.env.BREVO_API_KEY?.trim()),
  });
}

export async function POST(req: NextRequest) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = createSmtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || 'Invalid SMTP configuration.' },
      { status: 400 }
    );
  }

  const created = createSmtpConfig({
    ...parsed.data,
    replyToEmail: parsed.data.replyToEmail || parsed.data.senderEmail,
  });
  return NextResponse.json({ success: true, config: created }, { status: 201 });
}

