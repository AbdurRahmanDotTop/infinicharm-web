import { NextRequest, NextResponse } from 'next/server';
import {
  getServerCustomers,
  createCustomer,
  sanitizeCustomer,
} from '@/lib/server/customers-store';
import { verifyAdminSession, getAdminActorEmail } from '@/lib/server/admin-auth';
import { appendServerAuditLog } from '@/lib/server/server-audit-store';
import type { UserRole, CustomerStatus, UserPermission } from '@/types';

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
    const role = searchParams.get('role') || undefined;
    const verification = searchParams.get('verification') || undefined;

    let users = getServerCustomers(search, status, role);

    if (verification && verification !== 'ALL') {
      if (verification === 'VERIFIED') {
        users = users.filter((u) => u.emailVerified !== false);
      } else if (verification === 'UNVERIFIED') {
        users = users.filter((u) => u.emailVerified === false);
      }
    }

    // Dynamic aggregates from authentic database
    const allUsers = getServerCustomers();
    const stats = {
      total: allUsers.length,
      active: allUsers.filter((u) => u.status === 'ACTIVE').length,
      suspended: allUsers.filter((u) => u.status === 'SUSPENDED').length,
      inactive: allUsers.filter((u) => u.status === 'INACTIVE').length,
      superAdmins: allUsers.filter((u) => u.role === 'SUPER_ADMIN').length,
      admins: allUsers.filter((u) => u.role === 'ADMIN').length,
      vendors: allUsers.filter((u) => u.role === 'VENDOR').length,
      customers: allUsers.filter((u) => !u.role || u.role === 'CUSTOMER').length,
      staff: allUsers.filter((u) => ['PRODUCT_MANAGER', 'ORDER_MANAGER', 'CONTENT_MANAGER'].includes(u.role as string)).length,
    };

    return NextResponse.json({
      success: true,
      users,
      totalCount: users.length,
      stats,
    });
  } catch (err: any) {
    console.error('Admin users GET error:', err);
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
    const {
      email,
      fullName,
      phone,
      password,
      status,
      role = 'CUSTOMER',
      permissions,
      notes,
      address,
      emailVerified = true,
    } = body;

    if (!email || !fullName) {
      return NextResponse.json(
        { success: false, error: 'Full name and email are mandatory.' },
        { status: 400 }
      );
    }

    if (role === 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'SUPER_ADMIN role is reserved exclusively for the primary system administrator account.' },
        { status: 403 }
      );
    }

    const initialAddresses = address ? [address] : [];

    const newUser = createCustomer({
      email,
      fullName,
      phone: phone || '',
      password: password || undefined,
      emailVerified: Boolean(emailVerified),
      registrationSource: 'ADMIN',
      status: (status as CustomerStatus) || 'ACTIVE',
      role: (role as UserRole) || 'CUSTOMER',
      permissions: permissions as UserPermission[] | undefined,
      notes: notes || '',
      addresses: initialAddresses,
    });

    const actorEmail = getAdminActorEmail(req);
    appendServerAuditLog({
      actorId: 'admin',
      actorEmail,
      action: 'USER_CREATED',
      resourceType: 'user_management',
      resourceId: newUser.id,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      diff: { email: newUser.email, role: newUser.role, status: newUser.status },
    });

    return NextResponse.json({
      success: true,
      user: sanitizeCustomer(newUser),
      message: 'User account created successfully.',
    });
  } catch (err: any) {
    console.error('Admin users POST error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create user.' },
      { status: 500 }
    );
  }
}
