import { NextRequest, NextResponse } from 'next/server';
import { requireAdminResponse } from '@/lib/server/admin-session';
import { duplicateNotificationRule } from '@/lib/server/notifications-store';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const { id } = await context.params;
  const res = duplicateNotificationRule(id);
  if (!res.success || !res.rule) {
    return NextResponse.json(
      { error: res.error || 'Notification rule not found.' },
      { status: 404 }
    );
  }

  return NextResponse.json({ rule: res.rule }, { status: 201 });
}

