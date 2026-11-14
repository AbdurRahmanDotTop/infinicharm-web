import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminResponse } from '@/lib/server/admin-session';
import { getSanitizedSmtpConfigById } from '@/lib/server/smtp-store';
import {
  sendEmailViaConfiguredProvider,
  verifySmtpConnection,
} from '@/lib/server/mailer';

const testSchema = z.object({
  testEmail: z.string().trim().email('Please provide a valid test email address.').optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminResponse(req);
  if (denied) return denied;

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || 'Invalid test request.' },
      { status: 400 }
    );
  }

  const verifyResult = await verifySmtpConnection(id);
  if (!verifyResult.ok) {
    return NextResponse.json(
      {
        success: false,
        verified: false,
        mode: verifyResult.mode,
        error: verifyResult.message,
        config: getSanitizedSmtpConfigById(id),
      },
      { status: 400 }
    );
  }

  let deliveryResult: {
    sent: boolean;
    messageId?: string;
    error?: string;
  } | null = null;

  if (parsed.data.testEmail) {
    const sent = await sendEmailViaConfiguredProvider({
      toEmail: parsed.data.testEmail,
      toName: 'InfiniCharm Admin Diagnostic',
      subject: 'InfiniCharm Email System — Live Delivery Test',
      htmlContent: `<div style="font-family:Inter,Arial,sans-serif;padding:24px;color:#1e1a17;">
  <h2 style="margin-top:0;color:#181512;">Email Provider Verification Successful</h2>
  <p>This test dispatch was delivered through your configured InfiniCharm email provider (${verifyResult.mode}).</p>
  <p style="font-size:12px;color:#6f645b;">Timestamp: ${new Date().toISOString()}</p>
</div>`,
      textContent: `Email provider verification successful (${verifyResult.mode}) at ${new Date().toISOString()}.`,
      type: 'TEST',
      smtpConfigId: id,
    });
    deliveryResult = {
      sent: sent.success,
      messageId: sent.messageId,
      error: sent.error,
    };
  }

  return NextResponse.json({
    success: deliveryResult ? deliveryResult.sent : verifyResult.ok,
    verified: verifyResult.ok,
    mode: verifyResult.mode,
    message: deliveryResult
      ? deliveryResult.sent
        ? `${verifyResult.message}. Test email sent to ${parsed.data.testEmail}.`
        : `${verifyResult.message}, but test delivery failed: ${deliveryResult.error}`
      : verifyResult.message,
    delivery: deliveryResult,
    config: getSanitizedSmtpConfigById(id),
  });
}

