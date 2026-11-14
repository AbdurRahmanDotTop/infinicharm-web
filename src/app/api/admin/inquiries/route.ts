import { NextRequest, NextResponse } from 'next/server';
import { requireAdminResponse } from '@/lib/server/admin-session';
import { listInquiries } from '@/lib/server/inquiries-store';

export async function GET(req: NextRequest) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase() || '';
  const status = req.nextUrl.searchParams.get('status')?.trim().toUpperCase() || '';

  let items = listInquiries();
  if (status && status !== 'ALL') {
    items = items.filter((item) => item.status === status);
  }
  if (q) {
    items = items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.phone.toLowerCase().includes(q) ||
        item.subject.toLowerCase().includes(q) ||
        item.message.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
    );
  }

  return NextResponse.json({ success: true, inquiries: items });
}
