import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminResponse } from '@/lib/server/admin-session';
import {
  createNotificationRule,
  listNotificationRules,
} from '@/lib/server/notifications-store';
import type { EmailRecipientRole, NotificationCategory } from '@/types';

const CreateRuleSchema = z.object({
  eventKey: z.string().trim().min(2).max(80),
  category: z.enum([
    'ENQUIRY',
    'ORDER',
    'PAYMENT',
    'ACCOUNT',
    'REVIEW',
    'WISHLIST',
    'INVENTORY',
    'VENDOR',
    'SYSTEM',
  ]),
  name: z.string().trim().min(2, 'Rule name is required').max(140),
  description: z.string().trim().max(500).default(''),
  isEnabled: z.boolean().default(true),
  sendToAdmin: z.boolean().default(false),
  sendToCustomer: z.boolean().default(false),
  sendToVendor: z.boolean().default(false),
  adminEmails: z.array(z.string().trim().email('Invalid admin email')).default([]),
  vendorEmails: z.array(z.string().trim().email('Invalid vendor email')).default([]),
  customEmails: z.array(z.string().trim().email('Invalid custom email')).default([]),
  templateId: z.string().nullable().default(null),
  subjectOverride: z.string().trim().max(240).optional(),
  smtpConfigId: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const category = (req.nextUrl.searchParams.get('category') || 'ALL') as
    | NotificationCategory
    | 'ALL';
  const role = (req.nextUrl.searchParams.get('role') || 'ALL') as
    | EmailRecipientRole
    | 'ALL';
  const status = (req.nextUrl.searchParams.get('status') || 'ALL') as
    | 'ALL'
    | 'ENABLED'
    | 'DISABLED';
  const q = req.nextUrl.searchParams.get('q') || '';

  let rules = listNotificationRules({
    category,
    role: role === 'CUSTOM' ? 'ALL' : role,
    status,
    q,
  });

  if (role === 'CUSTOM') {
    rules = rules.filter((r) => (r.customEmails || []).length > 0);
  }

  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const raw = await req.json().catch(() => null);
  const parsed = CreateRuleSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid notification rule.' },
      { status: 400 }
    );
  }

  const rule = createNotificationRule(parsed.data);
  return NextResponse.json({ rule }, { status: 201 });
}
