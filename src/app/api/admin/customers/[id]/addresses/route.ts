import { NextRequest, NextResponse } from 'next/server';
import { manageCustomerAddress } from '@/lib/server/customers-store';

function verifyAdminSession(req: NextRequest) {
  const adminCookie = req.cookies.get('infinicharm_admin_session')?.value;
  return adminCookie === 'active';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action, addressData } = body; // action: 'ADD' | 'UPDATE' | 'DELETE' | 'SET_DEFAULT_SHIPPING'

    const updatedAddresses = manageCustomerAddress(id, action, addressData);
    if (!updatedAddresses) {
      return NextResponse.json({ success: false, error: 'Customer not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      addresses: updatedAddresses,
      message: 'Address operation completed successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Address management error.' }, { status: 500 });
  }
}

