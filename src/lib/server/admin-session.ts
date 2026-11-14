import { NextRequest, NextResponse } from 'next/server';

export function isAdminAuthenticated(req: NextRequest): boolean {
  return req.cookies.get('infinicharm_admin_session')?.value === 'active';
}

export function requireAdminResponse(req: NextRequest): NextResponse | null {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized Admin Access' },
      { status: 401 }
    );
  }
  return null;
}

