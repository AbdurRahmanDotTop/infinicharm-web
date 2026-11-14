import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminResponse } from '@/lib/server/admin-session';
import {
  deleteSmtpConfig,
  updateSmtpConfig,
} from '@/lib/server/smtp-store';

const updateSmtpSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  providerType: z.enum(['BREVO', 'CUSTOM_SMTP']).optional(),
  host: z.string().trim().min(1).max(200).optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  encryption: z.enum(['NONE', 'STARTTLS', 'SSL']).optional(),
  username: z.string().trim().max(200).optional(),
  secret: z.string().trim().max(500).optional(),
  useEnvCredentials: z.boolean().optional(),
  senderName: z.string().trim().min(1).max(120).optional(),
  senderEmail: z.string().trim().email().optional(),
  replyToEmail: z.string().trim().email().optional().or(z.literal('')),
  isDefault: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const { id } = await context.params;
  const body = await req.json().catch(() => null);
  const parsed = updateSmtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || 'Invalid SMTP update payload.' },
      { status: 400 }
    );
  }

  const res = updateSmtpConfig(id, parsed.data);
  if (!res.success) {
    return NextResponse.json({ success: false, error: res.error }, { status: 404 });
  }
  return NextResponse.json({ success: true, config: res.config });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const { id } = await context.params;
  const res = deleteSmtpConfig(id);
  if (!res.success) {
    const status = res.error?.includes('not found') ? 404 : 400;
    return NextResponse.json({ success: false, error: res.error }, { status });
  }
  return NextResponse.json({ success: true });
}

