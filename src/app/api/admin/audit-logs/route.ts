import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/server/admin-auth';
import { listServerAuditLogs } from '@/lib/server/server-audit-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }
  const logs = listServerAuditLogs();
  return NextResponse.json({ success: true, logs });
}

