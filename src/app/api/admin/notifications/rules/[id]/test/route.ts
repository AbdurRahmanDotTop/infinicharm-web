import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminResponse } from '@/lib/server/admin-session';
import {
  dispatchNotificationEvent,
  previewNotificationRule,
  sendTestNotificationForRule,
} from '@/lib/server/notification-dispatcher';
import { getNotificationRuleById } from '@/lib/server/notifications-store';

const TestRuleSchema = z.object({
  mode: z.enum(['TEST_EMAIL', 'LIVE_EVENT']).default('TEST_EMAIL'),
  targetEmail: z.string().trim().email('Valid target email address is required').optional(),
  customVars: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
  customerEmail: z.string().trim().email().optional(),
  customerName: z.string().trim().optional(),
  vendorEmails: z.array(z.string().trim().email()).optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const { id } = await context.params;
  const preview = previewNotificationRule(id);
  if (!preview) {
    return NextResponse.json({ error: 'Notification rule not found.' }, { status: 404 });
  }

  return NextResponse.json({ preview });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const { id } = await context.params;
  const raw = await req.json().catch(() => null);
  const parsed = TestRuleSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid test request.' },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (data.mode === 'LIVE_EVENT') {
    const rule = getNotificationRuleById(id);
    if (!rule) {
      return NextResponse.json({ error: 'Notification rule not found.' }, { status: 404 });
    }
    const dispatch = await dispatchNotificationEvent({
      eventKey: rule.eventKey,
      customerEmail: data.customerEmail || data.targetEmail || undefined,
      customerName: data.customerName || 'Test Customer',
      vendorEmails: data.vendorEmails,
      entityType: 'MANUAL_TRIGGER',
      entityId: rule.id,
      extraVars: data.customVars,
    });
    return NextResponse.json({
      success: dispatch.failedCount === 0,
      dispatch,
    });
  }

  if (!data.targetEmail) {
    return NextResponse.json(
      { error: 'Target email address is required for TEST_EMAIL mode.' },
      { status: 400 }
    );
  }

  const res = await sendTestNotificationForRule(id, data.targetEmail, data.customVars);
  return NextResponse.json(res, { status: res.success ? 200 : 400 });
}

