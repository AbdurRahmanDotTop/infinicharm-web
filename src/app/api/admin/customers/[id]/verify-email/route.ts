import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, getAdminActorEmail } from '@/lib/server/admin-auth';
import {
  getServerCustomerById,
  markCustomerEmailVerified,
  sanitizeCustomer,
  updateCustomer,
} from '@/lib/server/customers-store';
import {
  issueAndSendEmailVerification,
  resolvePublicOrigin,
} from '@/lib/server/auth-service';
import { appendServerAuditLog } from '@/lib/server/server-audit-store';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminSession(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const customer = getServerCustomerById(id);
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer not found.' }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const action = body?.action;
    const actorEmail = getAdminActorEmail(req);
    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';

    if (action === 'VERIFY') {
      const res = markCustomerEmailVerified(customer.id);
      appendServerAuditLog({
        actorId: 'usr-admin-01',
        actorEmail,
        action: 'ADMIN_VERIFY_CUSTOMER_EMAIL',
        resourceType: 'customer_auth',
        resourceId: customer.id,
        ipAddress,
        diff: { email: customer.email, emailVerified: true },
      });
      return NextResponse.json({
        success: true,
        customer: res.customer,
        message: `${customer.email} marked as email verified.`,
      });
    }

    if (action === 'UNVERIFY') {
      const updated = updateCustomer(customer.id, {
        emailVerified: false,
        emailVerifiedAt: null,
        sessionVersion: (customer.sessionVersion ?? 1) + 1,
      });
      appendServerAuditLog({
        actorId: 'usr-admin-01',
        actorEmail,
        action: 'ADMIN_REVOKE_CUSTOMER_VERIFICATION',
        resourceType: 'customer_auth',
        resourceId: customer.id,
        ipAddress,
        diff: { email: customer.email, emailVerified: false },
      });
      return NextResponse.json({
        success: true,
        customer: updated ? sanitizeCustomer(updated) : null,
        message: `Email verification revoked for ${customer.email}.`,
      });
    }

    if (action === 'RESEND') {
      const origin = resolvePublicOrigin(req);
      const sendRes = await issueAndSendEmailVerification({
        customer,
        purpose: 'ADMIN_RESEND',
        origin,
        bypassRateLimit: true,
      });
      appendServerAuditLog({
        actorId: 'usr-admin-01',
        actorEmail,
        action: 'ADMIN_RESEND_VERIFICATION_EMAIL',
        resourceType: 'customer_auth',
        resourceId: customer.id,
        ipAddress,
        diff: { email: customer.email, sent: sendRes.sent, expiresAt: sendRes.expiresAt },
      });
      return NextResponse.json({
        success: true,
        message: `Verification link dispatched to ${customer.email}.`,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported action. Use VERIFY, UNVERIFY, or RESEND.' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('[api/admin/customers/[id]/verify-email] POST error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Unable to execute verification action.' },
      { status: 500 }
    );
  }
}

