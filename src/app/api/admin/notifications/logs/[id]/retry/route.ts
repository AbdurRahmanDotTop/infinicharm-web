import { NextRequest, NextResponse } from 'next/server';
import { requireAdminResponse } from '@/lib/server/admin-session';
import { retryNotificationLogById } from '@/lib/server/notification-dispatcher';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const { id } = await context.params;
  const result = await retryNotificationLogById(id);
  if (!result.log) {
    return NextResponse.json(
      { error: result.error || 'Log entry not found.' },
      { status: 404 }
    );
  }
  return NextResponse.json(result, { status: result.success ? 200 : 502 });
}

