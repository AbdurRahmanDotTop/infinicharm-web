import { NextRequest, NextResponse } from 'next/server';
import {
  getServerCoupons,
  createServerCoupon,
} from '@/lib/server/coupons-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function verifyAdminSession(req: NextRequest): boolean {
  const adminCookie = req.cookies.get('infinicharm_admin_session')?.value;
  return adminCookie === 'active';
}

export async function GET(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin session required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || undefined;
    const status = searchParams.get('status') || undefined;
    const discountType = searchParams.get('discountType') || undefined;

    const coupons = getServerCoupons({ search, status, discountType });

    return NextResponse.json(
      {
        success: true,
        coupons,
        totalCount: coupons.length,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('Admin coupons GET error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to load coupons.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin session required.' },
        { status: 401 }
      );
    }

    const body = await req.json();

    const created = createServerCoupon({
      code: body.code,
      description: body.description,
      discountType: body.discountType,
      discountValue: Number(body.discountValue),
      minOrderInPaise: Number(body.minOrderInPaise ?? 0),
      maxDiscountInPaise:
        body.maxDiscountInPaise !== undefined && body.maxDiscountInPaise !== '' && body.maxDiscountInPaise !== null
          ? Number(body.maxDiscountInPaise)
          : undefined,
      usageLimitTotal:
        body.usageLimitTotal !== undefined && body.usageLimitTotal !== '' && body.usageLimitTotal !== null
          ? Number(body.usageLimitTotal)
          : undefined,
      usageLimitPerCustomer:
        body.usageLimitPerCustomer !== undefined && body.usageLimitPerCustomer !== ''
          ? Number(body.usageLimitPerCustomer)
          : 1,
      validFrom: body.validFrom,
      validUntil: body.validUntil,
      applicabilityType: body.applicabilityType || 'ALL',
      applicableCategoryIds: Array.isArray(body.applicableCategoryIds) ? body.applicableCategoryIds : [],
      applicableProductIds: Array.isArray(body.applicableProductIds) ? body.applicableProductIds : [],
      userEligibility: body.userEligibility || 'ALL',
      eligibleCustomerIds: Array.isArray(body.eligibleCustomerIds) ? body.eligibleCustomerIds : [],
      isActive: body.isActive,
      status: body.status,
    });

    return NextResponse.json(
      {
        success: true,
        coupon: created,
        message: `Coupon "${created.code}" created successfully.`,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Admin coupons POST error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create coupon.' },
      { status: 400 }
    );
  }
}

