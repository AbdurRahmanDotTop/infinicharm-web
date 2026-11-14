import type { NextRequest } from 'next/server';

export function verifyAdminSession(req: NextRequest): boolean {
  return req.cookies.get('infinicharm_admin_session')?.value === 'active';
}

export function getAdminActorEmail(req: NextRequest): string {
  return req.cookies.get('infinicharm_admin_email')?.value || 'admin@infinicharm.com';
}

