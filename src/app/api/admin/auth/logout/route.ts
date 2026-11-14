import { NextRequest, NextResponse } from 'next/server';
import { getAdminActorEmail, verifyAdminSession } from '@/lib/server/admin-auth';
import { appendServerAuditLog } from '@/lib/server/server-audit-store';

export async function POST(req: NextRequest) {
  if (verifyAdminSession(req)) {
    appendServerAuditLog({
      actorId: 'usr-admin-01',
      actorEmail: getAdminActorEmail(req),
      action: 'ADMIN_LOGOUT',
      resourceType: 'admin_auth',
      resourceId: 'usr-admin-01',
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });
  }
  const response = NextResponse.json({ success: true });
  response.cookies.delete('infinicharm_admin_session');
  response.cookies.delete('infinicharm_admin_email');
  return response;
}

