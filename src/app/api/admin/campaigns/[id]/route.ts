import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminResponse } from '@/lib/server/admin-session';
import {
  deleteEmailCampaign,
  updateEmailCampaign,
} from '@/lib/server/email-marketing-store';

const updateCampaignSchema = z.object({
  name: z.string().trim().min(1).max(140).optional(),
  subject: z.string().trim().min(1).max(220).optional(),
  previewText: z.string().trim().max(240).optional(),
  templateId: z.string().nullable().optional(),
  smtpConfigId: z.string().nullable().optional(),
  senderName: z.string().trim().min(1).max(120).optional(),
  senderEmail: z.string().trim().email().optional(),
  replyToEmail: z.string().trim().email().optional().or(z.literal('')),
  htmlContent: z.string().min(1).optional(),
  textContent: z.string().optional(),
  segment: z.enum(['ALL_ACTIVE', 'CUSTOM_SELECTION', 'SOURCE_FILTER']).optional(),
  selectedSubscriberIds: z.array(z.string()).optional(),
  sourceFilter: z.string().trim().max(80).optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const { id } = await context.params;
  const body = await req.json().catch(() => null);
  const parsed = updateCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || 'Invalid campaign update.' },
      { status: 400 }
    );
  }

  const res = updateEmailCampaign(id, parsed.data);
  if (!res.success) {
    return NextResponse.json({ success: false, error: res.error }, { status: 404 });
  }
  return NextResponse.json({ success: true, campaign: res.campaign });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const { id } = await context.params;
  const res = deleteEmailCampaign(id);
  if (!res.success) {
    return NextResponse.json({ success: false, error: res.error }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

