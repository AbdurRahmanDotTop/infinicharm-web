import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminResponse } from '@/lib/server/admin-session';
import {
  createEmailCampaign,
  listEmailCampaigns,
} from '@/lib/server/email-marketing-store';

const createCampaignSchema = z.object({
  name: z.string().trim().min(1, 'Campaign name is required.').max(140),
  subject: z.string().trim().min(1, 'Email subject is required.').max(220),
  previewText: z.string().trim().max(240).optional(),
  templateId: z.string().nullable().optional(),
  smtpConfigId: z.string().nullable().optional(),
  senderName: z.string().trim().min(1, 'Sender name is required.').max(120),
  senderEmail: z.string().trim().email('Valid sender email is required.'),
  replyToEmail: z.string().trim().email().optional().or(z.literal('')),
  htmlContent: z.string().min(1, 'HTML content is required.'),
  textContent: z.string().optional(),
  segment: z.enum(['ALL_ACTIVE', 'CUSTOM_SELECTION', 'SOURCE_FILTER']).default('ALL_ACTIVE'),
  selectedSubscriberIds: z.array(z.string()).optional(),
  sourceFilter: z.string().trim().max(80).optional(),
});

export async function GET(req: NextRequest) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;
  return NextResponse.json({
    success: true,
    campaigns: listEmailCampaigns(),
  });
}

export async function POST(req: NextRequest) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || 'Invalid campaign payload.' },
      { status: 400 }
    );
  }

  const campaign = createEmailCampaign({
    ...parsed.data,
    replyToEmail: parsed.data.replyToEmail || parsed.data.senderEmail,
  });
  return NextResponse.json({ success: true, campaign }, { status: 201 });
}

