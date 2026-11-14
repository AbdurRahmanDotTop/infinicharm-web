import { NextRequest, NextResponse } from 'next/server';
import {
  getServerCouponById,
  updateServerCoupon,
  deleteServerCoupon,
} from '@/lib/server/coupons-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function verifyAdminSession(req: NextRequest): boolean {
  const adminCookie = req.cookies.get('infinicharm_admin_session')?.value;
  return adminCookie === 'active';
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin session required.' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const coupon = getServerCouponById(id);

    if (!coupon) {
      return NextResponse.json(
        { success: false, error: 'Coupon not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, coupon },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch coupon.' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin session required.' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = await req.json();

    const updated = updateServerCoupon(id, {
      code: body.code,
      description: body.description,
      discountType: body.discountType,
      discountValue: body.discountValue !== undefined ? Number(body.discountValue) : undefined,
      minOrderInPaise: body.minOrderInPaise !== undefined ? Number(body.minOrderInPaise) : undefined,
      maxDiscountInPaise:
        body.maxDiscountInPaise === null || body.maxDiscountInPaise === ''
          ? 0
          : body.maxDiscountInPaise !== undefined
            ? Number(body.maxDiscountInPaise)
            : undefined,
      usageLimitTotal:
        body.usageLimitTotal === null || body.usageLimitTotal === ''
          ? 0
          : body.usageLimitTotal !== undefined
            ? Number(body.usageLimitTotal)
            : undefined,
      usageLimitPerCustomer:
        body.usageLimitPerCustomer !== undefined ? Number(body.usageLimitPerCustomer) : undefined,
      validFrom: body.validFrom,
      validUntil: body.validUntil,
      applicabilityType: body.applicabilityType,
      applicableCategoryIds: body.applicableCategoryIds,
      applicableProductIds: body.applicableProductIds,
      userEligibility: body.userEligibility,
      eligibleCustomerIds: body.eligibleCustomerIds,
      isActive: body.isActive,
      status: body.status,
    });

    return NextResponse.json({
      success: true,
      coupon: updated,
      message: `Coupon "${updated.code}" updated successfully.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update coupon.' },
      { status: 400 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(req, context);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin session required.' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const deleted = deleteServerCoupon(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Coupon not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Coupon permanently deleted.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to delete coupon.' },
      { status: 500 }
    );
  }
}

