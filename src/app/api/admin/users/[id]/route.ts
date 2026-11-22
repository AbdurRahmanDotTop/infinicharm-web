import { NextRequest, NextResponse } from 'next/server';
import {
  getServerCustomerById,
  updateCustomer,
  deleteCustomer,
  adminResetCustomerPassword,
  isSuperAdminAccount,
} from '@/lib/server/customers-store';
import { getServerOrders } from '@/lib/server/orders-store';
import { verifyAdminSession, getAdminActorEmail } from '@/lib/server/admin-auth';
import { appendServerAuditLog } from '@/lib/server/server-audit-store';
import { dispatchNotificationEvent } from '@/lib/server/notification-dispatcher';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const { id } = await params;
    const user = getServerCustomerById(id);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    const allOrders = getServerOrders();
    const userOrders = allOrders.filter(
      (o) =>
        (o.customerId && o.customerId === user.id) ||
        (o.customerEmail && o.customerEmail.toLowerCase() === user.email.toLowerCase()) ||
        (o.customerPhone && o.customerPhone === user.phone)
    );

    const isProtected = isSuperAdminAccount(user);

    const { passwordHash, ...safe } = user;

    return NextResponse.json({
      success: true,
      user: { ...safe, isProtected },
      orders: userOrders,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error fetching user.' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const existing = getServerCustomerById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    // Protect Super Administrator from suspension or role demotion
    if (isSuperAdminAccount(existing)) {
      if (body.status && body.status !== 'ACTIVE') {
        return NextResponse.json(
          { success: false, error: 'Protected Super Administrator account cannot be suspended or deactivated.' },
          { status: 403 }
        );
      }
      if (body.role && body.role !== 'SUPER_ADMIN') {
        return NextResponse.json(
          { success: false, error: 'Protected Super Administrator account role cannot be modified.' },
          { status: 403 }
        );
      }
    }

    // Prevent unauthorized escalation to SUPER_ADMIN
    if (body.role === 'SUPER_ADMIN' && !isSuperAdminAccount(existing)) {
      return NextResponse.json(
        { success: false, error: 'SUPER_ADMIN role is reserved exclusively for the primary system administrator account.' },
        { status: 403 }
      );
    }

    // Direct password reset if provided
    if (body.password && typeof body.password === 'string' && body.password.trim()) {
      const resetResult = adminResetCustomerPassword(id, body.password.trim());
      if (!resetResult.success) {
        return NextResponse.json({ success: false, error: resetResult.error }, { status: 400 });
      }
    }

    const updated = updateCustomer(id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    const actorEmail = getAdminActorEmail(req);
    appendServerAuditLog({
      actorId: 'admin',
      actorEmail,
      action: 'USER_UPDATED',
      resourceType: 'user_management',
      resourceId: updated.id,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      diff: { before: { status: existing.status, role: existing.role }, after: { status: updated.status, role: updated.role } },
    });

    try {
      if (body.status && existing.status !== updated.status) {
        await dispatchNotificationEvent({
          eventKey: 'CUSTOMER_STATUS_CHANGED',
          customerEmail: updated.email,
          customerName: updated.fullName,
          entityType: 'CUSTOMER',
          entityId: updated.id,
          extraVars: {
            customer_name: updated.fullName,
            customer_email: updated.email,
            activity_summary: `Your account status has changed from ${existing.status} to ${updated.status}.`,
          },
        });
      }
    } catch {}

    const isProtected = isSuperAdminAccount(updated);

    const { passwordHash, ...safe } = updated;
    return NextResponse.json({
      success: true,
      user: { ...safe, isProtected },
      message: 'User account updated successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error updating user.' }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const { id } = await params;
    const targetCust = getServerCustomerById(id);
    if (!targetCust) {
      return NextResponse.json({ success: true, message: 'User account already deleted.' });
    }

    if (isSuperAdminAccount(targetCust)) {
      return NextResponse.json(
        { success: false, error: 'Protected Super Administrator account cannot be deleted.' },
        { status: 403 }
      );
    }

    const success = deleteCustomer(id);
    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to delete user.' }, { status: 500 });
    }

    const actorEmail = getAdminActorEmail(req);
    appendServerAuditLog({
      actorId: 'admin',
      actorEmail,
      action: 'USER_DELETED',
      resourceType: 'user_management',
      resourceId: id,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      diff: { deletedEmail: targetCust.email },
    });

    return NextResponse.json({
      success: true,
      message: 'User account permanently deleted and linked PII sanitized per statutory compliance.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error deleting user.' }, { status: 500 });
  }
}
