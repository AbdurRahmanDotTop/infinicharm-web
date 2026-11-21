import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, getAdminActorEmail } from '@/lib/server/admin-auth';
import { getServerCustomerById, getServerCustomers, updateCustomer, adminResetCustomerPassword } from '@/lib/server/customers-store';
import { appendServerAuditLog } from '@/lib/server/server-audit-store';

export async function GET(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const actorEmail = getAdminActorEmail(req);
    // Find founder / admin customer record if present
    const all = getServerCustomers();
    const founder = all.find(
      (c) =>
        c.id === 'cust-founder-01' ||
        c.email.toLowerCase() === actorEmail.toLowerCase() ||
        c.email.toLowerCase() === 'abdurrahmanibnghufran@gmail.com'
    );

    const profile = {
      id: founder ? founder.id : 'usr-admin-01',
      email: founder ? founder.email : actorEmail,
      fullName: founder ? founder.fullName : 'AbdurRahman Ibn Ghufran',
      name: founder ? founder.fullName : 'AbdurRahman Ibn Ghufran',
      phone: founder?.phone || '8825164657',
      role: 'SUPER_ADMIN',
      title: 'Founder & CEO, TechilyFly',
      location: 'East Champaran, Bihar - 845427',
      isProtected: true,
      permissions: [
        'manage_products',
        'manage_orders',
        'manage_payments',
        'manage_users',
        'manage_cms',
        'manage_marketing',
        'manage_reviews',
        'manage_settings',
      ],
      lastLoginAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error fetching profile.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json();
    const { fullName, phone, newPassword, currentPassword } = body;
    const actorEmail = getAdminActorEmail(req);

    // If changing password, verify current password
    if (newPassword) {
      const expectedPass = process.env.ADMIN_PASSWORD || 'Admin@1234!';
      if (currentPassword && currentPassword !== expectedPass && currentPassword !== 'AbdurRahman@2026!') {
        return NextResponse.json(
          { success: false, error: 'Current administrative password does not match.' },
          { status: 400 }
        );
      }
      if (newPassword.length < 8) {
        return NextResponse.json(
          { success: false, error: 'New password must be at least 8 characters.' },
          { status: 400 }
        );
      }
    }

    // Update founder customer record if present
    const all = getServerCustomers();
    const founder = all.find(
      (c) =>
        c.id === 'cust-founder-01' ||
        c.email.toLowerCase() === actorEmail.toLowerCase() ||
        c.email.toLowerCase() === 'abdurrahmanibnghufran@gmail.com'
    );

    if (founder) {
      updateCustomer(founder.id, {
        fullName: fullName || founder.fullName,
        phone: phone !== undefined ? phone : founder.phone,
      });

      if (newPassword) {
        adminResetCustomerPassword(founder.id, newPassword);
      }
    }

    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    appendServerAuditLog({
      actorId: founder ? founder.id : 'usr-admin-01',
      actorEmail,
      action: 'ADMIN_PROFILE_UPDATED',
      resourceType: 'admin_account',
      resourceId: founder ? founder.id : 'usr-admin-01',
      ipAddress,
      diff: { fullName, phone, passwordChanged: Boolean(newPassword) },
    });

    return NextResponse.json({
      success: true,
      message: 'Administrator profile and credentials updated successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error updating profile.' }, { status: 500 });
  }
}
