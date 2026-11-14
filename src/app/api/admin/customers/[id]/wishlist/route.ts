import { NextRequest, NextResponse } from 'next/server';
import { manageCustomerWishlist, getServerCustomerById } from '@/lib/server/customers-store';

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
    const { action, productId } = body; // action: 'ADD' | 'REMOVE' | 'TOGGLE'

    if (!productId) {
      return NextResponse.json({ success: false, error: 'Product ID is required.' }, { status: 400 });
    }

    const customer = getServerCustomerById(id);
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer not found.' }, { status: 404 });
    }

    const updatedWishlist = manageCustomerWishlist(id, productId, action || 'REMOVE');

    return NextResponse.json({
      success: true,
      wishlistProductIds: updatedWishlist,
      message: 'Customer wishlist updated successfully.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Error managing customer wishlist.' },
      { status: 500 }
    );
  }
}

