import { NextRequest, NextResponse } from 'next/server';
import {
  getServerCustomers,
  createCustomer,
  sanitizeCustomer,
} from '@/lib/server/customers-store';
import { verifyAdminSession } from '@/lib/server/admin-auth';

export async function GET(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin session required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;

    const customers = getServerCustomers(search, status);

    return NextResponse.json({
      success: true,
      customers,
      totalCount: customers.length,
    });
  } catch (err: any) {
    console.error('Admin customers GET error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error.' },
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
    const { email, fullName, phone, password, status, notes, address } = body;

    if (!email || !fullName) {
      return NextResponse.json(
        { success: false, error: 'Full name and email are mandatory.' },
        { status: 400 }
      );
    }

    const initialAddresses = address ? [address] : [];

    const newCustomer = createCustomer({
      email,
      fullName,
      phone: phone || '',
      password: password || undefined,
      emailVerified: body.emailVerified !== false,
      registrationSource: 'ADMIN',
      status: status || 'ACTIVE',
      role: 'CUSTOMER',
      notes: notes || '',
      addresses: initialAddresses,
    });

    return NextResponse.json({
      success: true,
      customer: sanitizeCustomer(newCustomer),
      message: 'Customer account created successfully.',
    });
  } catch (err: any) {
    console.error('Admin customers POST error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create customer.' },
      { status: 500 }
    );
  }
}

