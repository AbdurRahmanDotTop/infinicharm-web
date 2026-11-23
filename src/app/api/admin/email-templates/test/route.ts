import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminResponse } from '@/lib/server/admin-session';
import { getEmailTemplateById } from '@/lib/server/email-marketing-store';
import {
  renderEmailVariables,
  sendEmailViaConfiguredProvider,
  getPublicSiteUrl,
} from '@/lib/server/mailer';
import { appendServerAuditLog } from '@/lib/server/server-audit-store';
import { isValidEmail } from '@/lib/validation/auth';

const testEmailSchema = z.object({
  recipientEmail: z.string().trim().email('Please enter a valid recipient email address.'),
  templateId: z.string().optional(),
  subject: z.string().optional(),
  htmlContent: z.string().optional(),
  textContent: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => null);
    const parsed = testEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid input.' },
        { status: 400 }
      );
    }

    const { recipientEmail, templateId, subject, htmlContent, textContent } = parsed.data;

    let targetSubject = subject || '';
    let targetHtml = htmlContent || '';
    let targetText = textContent || '';

    if (templateId) {
      const existing = getEmailTemplateById(templateId);
      if (existing) {
        targetSubject = targetSubject || existing.subject;
        targetHtml = targetHtml || existing.htmlContent;
        targetText = targetText || existing.textContent || '';
      }
    }

    if (!targetSubject || !targetHtml) {
      return NextResponse.json(
        { success: false, error: 'Both subject and HTML content are required to send a test email.' },
        { status: 400 }
      );
    }

    const appOrigin = getPublicSiteUrl();

    const sampleVars: Record<string, string> = {
      customer_name: 'AbdurRahman Ibn Ghufran',
      customer_email: recipientEmail,
      subscriber_name: 'AbdurRahman Ibn Ghufran',
      subscriber_email: recipientEmail,
      otp_code: '482910',
      verification_code: '482910',
      verification_link: `${appOrigin}/verify-email?token=sample_admin_test_token_123456`,
      verification_url: `${appOrigin}/verify-email?token=sample_admin_test_token_123456`,
      otp_expires_in: '60 minutes',
      link_expires_in: '60 minutes',
      expiry_minutes: '60',
      order_number: 'INF-202611-TEST',
      order_total: '₹1,249.00',
      order_status: 'CONFIRMED',
      tracking_number: 'DELHIVERY-99887766',
      courier_name: 'Delhivery Express',
      enquiry_subject: 'General Question',
      enquiry_message: 'This is a test notification message.',
      campaign_title: 'Template Test Dispatch',
      store_url: appOrigin,
      site_url: appOrigin,
      site_name: 'InfiniCharm (Techily Fly)',
      brand_name: 'InfiniCharm (Techily Fly)',
      support_email: 'support@infinicharm.com',
      current_year: String(new Date().getFullYear()),
    };

    const rendered = renderEmailVariables(
      {
        subject: targetSubject,
        htmlContent: targetHtml,
        textContent: targetText,
      },
      {
        subscriberName: 'AbdurRahman Ibn Ghufran',
        subscriberEmail: recipientEmail,
        extraVars: sampleVars,
      }
    );

    const sendRes = await sendEmailViaConfiguredProvider({
      toEmail: recipientEmail,
      toName: 'Admin Tester',
      subject: `[TEST] ${rendered.subject}`,
      htmlContent: rendered.htmlContent,
      textContent: rendered.textContent,
      type: 'TEST',
    });

    appendServerAuditLog({
      actorId: 'admin',
      actorEmail: recipientEmail,
      action: 'EMAIL_TEMPLATE_TEST_SENT',
      resourceType: 'email_template',
      resourceId: templateId || 'ad-hoc',
      diff: {
        recipientEmail,
        provider: sendRes.providerName,
        success: sendRes.success,
        error: sendRes.error,
      },
    });

    if (!sendRes.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to dispatch test email via ${sendRes.providerName}: ${sendRes.error || 'Check SMTP configuration.'}`,
          providerName: sendRes.providerName,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      providerName: sendRes.providerName,
      message: `Test email successfully sent to ${recipientEmail} via ${sendRes.providerName}.`,
    });
  } catch (err: any) {
    console.error('[api/admin/email-templates/test] POST error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Unexpected error sending test email.' },
      { status: 500 }
    );
  }
}
