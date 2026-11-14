import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminResponse } from '@/lib/server/admin-session';
import {
  deleteNotificationRule,
  updateNotificationRule,
} from '@/lib/server/notifications-store';

const UpdateRuleSchema = z.object({
  eventKey: z.string().trim().min(2).max(80).optional(),
  category: z
    .enum([
      'ENQUIRY',
      'ORDER',
      'PAYMENT',
      'ACCOUNT',
      'REVIEW',
      'WISHLIST',
      'INVENTORY',
      'VENDOR',
      'SYSTEM',
    ])
    .optional(),
  name: z.string().trim().min(2).max(140).optional(),
  description: z.string().trim().max(500).optional(),
  isEnabled: z.boolean().optional(),
  sendToAdmin: z.boolean().optional(),
  sendToCustomer: z.boolean().optional(),
  sendToVendor: z.boolean().optional(),
  adminEmails: z.array(z.string().trim().email('Invalid admin email')).optional(),
  vendorEmails: z.array(z.string().trim().email('Invalid vendor email')).optional(),
  customEmails: z.array(z.string().trim().email('Invalid custom email')).optional(),
  templateId: z.string().nullable().optional(),
  subjectOverride: z.string().trim().max(240).optional(),
  smtpConfigId: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const { id } = await context.params;
  const raw = await req.json().catch(() => null);
  const parsed = UpdateRuleSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid rule update.' },
      { status: 400 }
    );
  }

  const res = updateNotificationRule(id, parsed.data);
  if (!res.success || !res.rule) {
    return NextResponse.json(
      { error: res.error || 'Notification rule not found.' },
      { status: 404 }
    );
  }

  return NextResponse.json({ rule: res.rule });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const { id } = await context.params;
  const res = deleteNotificationRule(id);
  if (!res.success) {
    return NextResponse.json(
      { error: res.error || 'Unable to delete notification rule.' },
      { status: 400 }
    );
  }
  return NextResponse.json({ success: true });
}
