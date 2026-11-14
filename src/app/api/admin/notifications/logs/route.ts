import { NextRequest, NextResponse } from 'next/server';
import { requireAdminResponse } from '@/lib/server/admin-session';
import { queryNotificationLogs } from '@/lib/server/notifications-store';
import type { EmailRecipientRole, NotificationDeliveryLog } from '@/types';

export async function GET(req: NextRequest) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const status = (sp.get('status') || 'ALL') as NotificationDeliveryLog['status'] | 'ALL';
  const recipientRole = (sp.get('recipientRole') || 'ALL') as EmailRecipientRole | 'ALL';
  const eventKey = sp.get('eventKey') || undefined;
  const q = sp.get('q') || undefined;
  const page = Number(sp.get('page') || 1);
  const limit = Number(sp.get('limit') || 25);

  const result = queryNotificationLogs({
    status,
    recipientRole,
    eventKey,
    q,
    page,
    limit,
  });

  return NextResponse.json(result);
}

