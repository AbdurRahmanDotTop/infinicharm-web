import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createInquiryRecord, updateInquiryRecord } from '@/lib/server/inquiries-store';
import { dispatchNotificationEvent } from '@/lib/server/notification-dispatcher';
import { getAdminUrl } from '@/lib/utils/env-urls';

const CreateInquirySchema = z.object({
  name: z.string().trim().min(2, 'Full name is required').max(120).optional(),
  customerName: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email('Valid email address is required').max(180).optional(),
  customerEmail: z.string().trim().email().max(180).optional(),
  phone: z.string().trim().min(7, 'Valid phone number is required').max(30).optional(),
  customerPhone: z.string().trim().min(7).max(30).optional(),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(5, 'Message must be at least 5 characters').max(4000),
  source: z.string().trim().max(80).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => null);
    const parsed = CreateInquirySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid enquiry submission.' },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const name = d.name || d.customerName || '';
    const email = d.email || d.customerEmail || '';
    const phone = d.phone || d.customerPhone || '';

    if (!name || !email || !phone) {
      return NextResponse.json(
        { success: false, error: 'Name, email, and phone number are mandatory.' },
        { status: 400 }
      );
    }

    const inquiry = createInquiryRecord({
      name,
      email,
      phone,
      subject: d.subject?.trim() || 'General Customer Inquiry',
      message: d.message,
      source: d.source || 'contact_page',
    });

    let notificationStatus: 'SENT' | 'FAILED' | 'DISABLED' = 'DISABLED';

    try {
      const dispatch = await dispatchNotificationEvent({
        eventKey: 'ENQUIRY_SUBMITTED',
        customerEmail: inquiry.email,
        customerName: inquiry.name,
        entityType: 'ENQUIRY',
        entityId: inquiry.id,
        extraVars: {
          enquiry_id: inquiry.id,
          enquiry_subject: inquiry.subject,
          enquiry_message: inquiry.message,
          enquiry_source: inquiry.source || 'contact_page',
          customer_name: inquiry.name,
          customer_email: inquiry.email,
          customer_phone: inquiry.phone,
          submitted_at: new Date(inquiry.createdAt).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
          }),
          action_url: getAdminUrl('inquiries', req),
        },
      });
      if (dispatch.sentCount > 0) notificationStatus = 'SENT';
      else if (dispatch.failedCount > 0) notificationStatus = 'FAILED';
      else notificationStatus = 'DISABLED';
    } catch (err) {
      console.error('[api/inquiries] non-blocking notification dispatch failure:', err);
      notificationStatus = 'FAILED';
    }

    const updated =
      updateInquiryRecord(inquiry.id, { notificationStatus }) || {
        ...inquiry,
        notificationStatus,
      };

    return NextResponse.json({ success: true, inquiry: updated }, { status: 201 });
  } catch (err) {
    console.error('[api/inquiries] POST failed:', err);
    return NextResponse.json({ success: false, error: 'Unable to submit enquiry.' }, { status: 500 });
  }
}
