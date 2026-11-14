import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminResponse } from '@/lib/server/admin-session';
import {
  createEmailTemplate,
  listEmailTemplates,
} from '@/lib/server/email-marketing-store';
import { appendServerAuditLog } from '@/lib/server/server-audit-store';

const createTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required.').max(140),
  slug: z.string().trim().max(160).optional(),
  purpose: z.enum([
    'WELCOME',
    'MARKETING',
    'ANNOUNCEMENT',
    'TRANSACTIONAL',
    'ADMIN',
    'CUSTOMER',
    'VENDOR',
    'GENERAL',
  ]),
  subject: z.string().trim().min(1, 'Subject line is required.').max(220),
  previewText: z.string().trim().max(240).optional(),
  htmlContent: z.string().min(1, 'HTML email content is required.'),
  textContent: z.string().optional(),
  isDefaultForPurpose: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;
  return NextResponse.json({
    success: true,
    templates: listEmailTemplates(),
  });
}

export async function POST(req: NextRequest) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || 'Invalid template data.' },
      { status: 400 }
    );
  }

  const template = createEmailTemplate(parsed.data);

  appendServerAuditLog({
    actorId: 'admin',
    actorEmail: 'admin@infinicharm.com',
    action: 'EMAIL_TEMPLATE_CREATED',
    resourceType: 'email_template',
    resourceId: template.id,
    diff: { name: template.name, purpose: template.purpose, slug: template.slug },
  });

  return NextResponse.json({ success: true, template }, { status: 201 });
}

