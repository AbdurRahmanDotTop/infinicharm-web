import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminResponse } from '@/lib/server/admin-session';
import {
  deleteEmailTemplate,
  updateEmailTemplate,
} from '@/lib/server/email-marketing-store';
import { appendServerAuditLog } from '@/lib/server/server-audit-store';

const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(140).optional(),
  slug: z.string().trim().max(160).optional(),
  purpose: z
    .enum([
      'WELCOME',
      'MARKETING',
      'ANNOUNCEMENT',
      'TRANSACTIONAL',
      'ADMIN',
      'CUSTOMER',
      'VENDOR',
      'GENERAL',
    ])
    .optional(),
  subject: z.string().trim().min(1).max(220).optional(),
  previewText: z.string().trim().max(240).optional(),
  htmlContent: z.string().min(1).optional(),
  textContent: z.string().optional(),
  isDefaultForPurpose: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const { id } = await context.params;
  const body = await req.json().catch(() => null);
  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || 'Invalid template update.' },
      { status: 400 }
    );
  }

  const res = updateEmailTemplate(id, parsed.data);
  if (!res.success) {
    return NextResponse.json({ success: false, error: res.error }, { status: 404 });
  }

  appendServerAuditLog({
    actorId: 'admin',
    actorEmail: 'admin@infinicharm.com',
    action: 'EMAIL_TEMPLATE_UPDATED',
    resourceType: 'email_template',
    resourceId: id,
    diff: parsed.data,
  });

  return NextResponse.json({ success: true, template: res.template });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const { id } = await context.params;
  const res = deleteEmailTemplate(id);
  if (!res.success) {
    const status = res.error?.includes('not found') ? 404 : 400;
    return NextResponse.json({ success: false, error: res.error }, { status });
  }

  appendServerAuditLog({
    actorId: 'admin',
    actorEmail: 'admin@infinicharm.com',
    action: 'EMAIL_TEMPLATE_DELETED',
    resourceType: 'email_template',
    resourceId: id,
  });

  return NextResponse.json({ success: true });
}

