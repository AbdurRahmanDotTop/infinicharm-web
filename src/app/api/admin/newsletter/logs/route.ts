import { NextRequest, NextResponse } from 'next/server';
import { requireAdminResponse } from '@/lib/server/admin-session';
import { listDeliveryLogs } from '@/lib/server/mailer';
import { EmailDeliveryLog } from '@/types';

export async function GET(req: NextRequest) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const logs = listDeliveryLogs({
    campaignId: sp.get('campaignId') || undefined,
    type: (sp.get('type') as EmailDeliveryLog['type']) || undefined,
    status: (sp.get('status') as EmailDeliveryLog['status']) || undefined,
    search: sp.get('search') || undefined,
    limit: sp.get('limit') ? Number(sp.get('limit')) : 150,
  });

  return NextResponse.json({ success: true, logs });
}

