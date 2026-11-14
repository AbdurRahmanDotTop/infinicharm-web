import { NextRequest, NextResponse } from 'next/server';
import { requireAdminResponse } from '@/lib/server/admin-session';
import { duplicateEmailTemplate } from '@/lib/server/email-marketing-store';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const { id } = await context.params;
  const res = duplicateEmailTemplate(id);
  if (!res.success) {
    return NextResponse.json({ success: false, error: res.error }, { status: 404 });
  }
  return NextResponse.json({ success: true, template: res.template }, { status: 201 });
}

