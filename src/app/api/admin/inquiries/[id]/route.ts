import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminResponse } from '@/lib/server/admin-session';
import {
  deleteInquiryRecord,
  getInquiryById,
  updateInquiryRecord,
} from '@/lib/server/inquiries-store';
import { dispatchNotificationEvent } from '@/lib/server/notification-dispatcher';

const UpdateInquirySchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED']).optional(),
  adminResponse: z.string().trim().max(4000).optional(),
  sendReplyEmail: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const { id } = await context.params;
  const existing = getInquiryById(id);
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Enquiry not found.' }, { status: 404 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = UpdateInquirySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || 'Invalid update payload.' },
      { status: 400 }
    );
  }

  const { status, adminResponse, sendReplyEmail } = parsed.data;
  const trimmedReply = typeof adminResponse === 'string' ? adminResponse.trim() : undefined;
  const nextStatus = status || (trimmedReply ? 'RESOLVED' : existing.status);

  let updated = updateInquiryRecord(id, {
    status: nextStatus,
    ...(trimmedReply !== undefined ? { adminResponse: trimmedReply } : {}),
  });

  if (!updated) {
    return NextResponse.json({ success: false, error: 'Failed to update enquiry.' }, { status: 500 });
  }

  let emailResult: { sentCount: number; failedCount: number; skippedCount: number } | null = null;
  if (trimmedReply && sendReplyEmail !== false) {
    try {
      const dispatch = await dispatchNotificationEvent({
        eventKey: 'ENQUIRY_ADMIN_REPLY',
        customerEmail: updated.email,
        customerName: updated.name,
        entityType: 'ENQUIRY',
        entityId: updated.id,
        extraVars: {
          enquiry_id: updated.id,
          enquiry_subject: updated.subject,
          enquiry_message: updated.message,
          admin_reply: trimmedReply,
          customer_name: updated.name,
          customer_email: updated.email,
          customer_phone: updated.phone,
        },
      });
      emailResult = {
        sentCount: dispatch.sentCount,
        failedCount: dispatch.failedCount,
        skippedCount: dispatch.skippedCount,
      };
      const notificationStatus =
        dispatch.sentCount > 0 ? 'SENT' : dispatch.failedCount > 0 ? 'FAILED' : 'DISABLED';
      updated = updateInquiryRecord(id, { notificationStatus }) || updated;
    } catch (err) {
      console.error('[api/admin/inquiries/[id]] reply email error:', err);
    }
  }

  return NextResponse.json({ success: true, inquiry: updated, emailResult });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const { id } = await context.params;
  const deleted = deleteInquiryRecord(id);
  if (!deleted) {
    return NextResponse.json({ success: false, error: 'Enquiry not found.' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
