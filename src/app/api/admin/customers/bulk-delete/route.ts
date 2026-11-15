import { NextRequest, NextResponse } from 'next/server';
import { bulkDeleteCustomers } from '@/lib/server/customers-store';

function verifyAdminSession(req: NextRequest) {
  const adminCookie = req.cookies.get('infinicharm_admin_session')?.value;
  return adminCookie === 'active';
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.customerIds) || body.customerIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Customer IDs array is required for bulk deletion.' },
        { status: 400 }
      );
    }

    const result = bulkDeleteCustomers(body.customerIds);

    return NextResponse.json({
      success: result.success,
      deletedCount: result.deletedCount,
      failedCount: result.failedCount,
      errors: result.errors,
      message: `Successfully processed bulk deletion of ${result.deletedCount} account(s).`,
    });
  } catch (err: any) {
    console.error('[api/admin/customers/bulk-delete] POST error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Error processing bulk customer deletion.' },
      { status: 500 }
    );
  }
}
