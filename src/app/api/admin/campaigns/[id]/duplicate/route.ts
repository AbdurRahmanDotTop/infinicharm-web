import { NextRequest, NextResponse } from 'next/server';
import { requireAdminResponse } from '@/lib/server/admin-session';
import { duplicateEmailCampaign } from '@/lib/server/email-marketing-store';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const { id } = await context.params;
  const res = duplicateEmailCampaign(id);
  if (!res.success) {
    return NextResponse.json({ success: false, error: res.error }, { status: 404 });
  }
  return NextResponse.json({ success: true, campaign: res.campaign }, { status: 201 });
}

