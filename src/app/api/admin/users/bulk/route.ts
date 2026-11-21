import { NextRequest, NextResponse } from 'next/server';
import {
  bulkDeleteCustomers,
  bulkUpdateCustomers,
} from '@/lib/server/customers-store';
import { verifyAdminSession, getAdminActorEmail } from '@/lib/server/admin-auth';
import { appendServerAuditLog } from '@/lib/server/server-audit-store';
import type { UserRole, CustomerStatus } from '@/types';

export async function POST(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json();
    const { action, userIds, role, status } = body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Please select at least one user account.' },
        { status: 400 }
      );
    }

    const actorEmail = getAdminActorEmail(req);
    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';

    if (action === 'DELETE') {
      const result = bulkDeleteCustomers(userIds);
      appendServerAuditLog({
        actorId: 'admin',
        actorEmail,
        action: 'USERS_BULK_DELETED',
        resourceType: 'user_management',
        resourceId: 'BULK',
        ipAddress,
        diff: { deletedCount: result.deletedCount, requestedIds: userIds },
      });

      return NextResponse.json({
        success: true,
        deletedCount: result.deletedCount,
        errors: result.errors,
        message: `Successfully deleted ${result.deletedCount} user account(s).`,
      });
    }

    if (action === 'SUSPEND' || action === 'ACTIVATE') {
      const newStatus: CustomerStatus = action === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE';
      const result = bulkUpdateCustomers(userIds, { status: newStatus });
      appendServerAuditLog({
        actorId: 'admin',
        actorEmail,
        action: `USERS_BULK_${action}`,
        resourceType: 'user_management',
        resourceId: 'BULK',
        ipAddress,
        diff: { updatedCount: result.updatedCount, status: newStatus },
      });

      return NextResponse.json({
        success: true,
        updatedCount: result.updatedCount,
        errors: result.errors,
        message: `Successfully updated ${result.updatedCount} user(s) to ${newStatus}.`,
      });
    }

    if (action === 'CHANGE_ROLE') {
      if (!role) {
        return NextResponse.json({ success: false, error: 'Role is required.' }, { status: 400 });
      }
      const result = bulkUpdateCustomers(userIds, { role: role as UserRole });
      appendServerAuditLog({
        actorId: 'admin',
        actorEmail,
        action: 'USERS_BULK_ROLE_CHANGED',
        resourceType: 'user_management',
        resourceId: 'BULK',
        ipAddress,
        diff: { updatedCount: result.updatedCount, role },
      });

      return NextResponse.json({
        success: true,
        updatedCount: result.updatedCount,
        errors: result.errors,
        message: `Successfully assigned role ${role} to ${result.updatedCount} user(s).`,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid bulk action.' }, { status: 400 });
  } catch (err: any) {
    console.error('Admin users bulk action error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Error executing bulk action.' },
      { status: 500 }
    );
  }
}
