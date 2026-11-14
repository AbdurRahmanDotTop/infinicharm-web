import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminResponse } from '@/lib/server/admin-session';
import { dispatchEmailCampaign } from '@/lib/server/email-marketing-store';

const sendSchema = z.object({
  mode: z.enum(['test', 'send']).default('send'),
  testEmail: z.string().trim().email().optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || 'Invalid dispatch payload.' },
      { status: 400 }
    );
  }

  const res = await dispatchEmailCampaign({
    campaignId: id,
    mode: parsed.data.mode,
    testEmail: parsed.data.testEmail,
  });

  if (!res.success) {
    return NextResponse.json(
      {
        success: false,
        error: res.error,
        campaign: res.campaign,
        sentCount: res.sentCount,
        failedCount: res.failedCount,
        skippedCount: res.skippedCount,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    campaign: res.campaign,
    sentCount: res.sentCount,
    failedCount: res.failedCount,
    skippedCount: res.skippedCount,
  });
}

