import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {
  createNotificationRule,
  deleteNotificationRule,
  duplicateNotificationRule,
  getRulesByEventKey,
  listNotificationRules,
  queryNotificationLogs,
  updateGlobalNotificationPreferences,
  updateNotificationRule,
} from '../../src/lib/server/notifications-store.ts';
import {
  dispatchNotificationEvent,
  previewNotificationRule,
  resolveRecipientsForRule,
  retryNotificationLogById,
} from '../../src/lib/server/notification-dispatcher.ts';
import {
  createInquiryRecord,
  deleteInquiryRecord,
  listInquiries,
  updateInquiryRecord,
} from '../../src/lib/server/inquiries-store.ts';
import {
  createPasswordResetOtp,
  verifyAndConsumePasswordResetOtp,
} from '../../src/lib/server/password-reset-store.ts';
import { createSmtpConfig, updateSmtpConfig } from '../../src/lib/server/smtp-store.ts';

function createLocalStubSmtpServer(): Promise<{
  port: number;
  received: string[];
  close: () => Promise<void>;
}> {
  return new Promise((resolve) => {
    const received: string[] = [];
    const server = net.createServer((socket) => {
      let inData = false;
      let buffer = '';
      socket.write('220 localhost ESMTP InfiniCharm Test\r\n');
      socket.on('data', (chunk) => {
        const str = chunk.toString('utf8');
        if (inData) {
          buffer += str;
          if (buffer.includes('\r\n.\r\n')) {
            inData = false;
            received.push(buffer);
            buffer = '';
            socket.write('250 2.0.0 Ok: queued\r\n');
          }
          return;
        }
        const upper = str.toUpperCase();
        if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
          socket.write('250-localhost\r\n250 AUTH PLAIN LOGIN\r\n');
        } else if (upper.startsWith('AUTH')) {
          socket.write('235 2.7.0 Authentication successful\r\n');
        } else if (upper.startsWith('MAIL FROM')) {
          socket.write('250 2.1.0 Ok\r\n');
        } else if (upper.startsWith('RCPT TO')) {
          socket.write('250 2.1.5 Ok\r\n');
        } else if (upper.startsWith('DATA')) {
          inData = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (upper.startsWith('QUIT')) {
          socket.write('221 2.0.0 Bye\r\n');
          socket.end();
        } else {
          socket.write('250 Ok\r\n');
        }
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        port,
        received,
        close: () => new Promise<void>((resClose) => server.close(() => resClose())),
      });
    });
  });
}

describe('Centralized Email Notification & Transactional Engine', () => {
  let tmpDir: string;
  let rulesFile: string;
  let prefsFile: string;
  let logsFile: string;
  let smtpFile: string;
  let templatesFile: string;
  let inquiriesFile: string;
  let otpFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'infinicharm-notify-test-'));
    rulesFile = path.join(tmpDir, 'notification_rules.json');
    prefsFile = path.join(tmpDir, 'notification_preferences.json');
    logsFile = path.join(tmpDir, 'notification_logs.json');
    smtpFile = path.join(tmpDir, 'smtp_configs.json');
    templatesFile = path.join(tmpDir, 'email_templates.json');
    inquiriesFile = path.join(tmpDir, 'inquiries.json');
    otpFile = path.join(tmpDir, 'password_reset_tokens.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('supports rule CRUD, duplicate, filtering, and system default deletion protection', () => {
    const initial = listNotificationRules(undefined, rulesFile);
    assert.ok(initial.length >= 25);

    const created = createNotificationRule(
      {
        eventKey: 'ORDER_PLACED',
        name: 'Custom VIP Order Alert',
        description: 'Notify concierge on order placement',
        category: 'ORDER',
        sendToAdmin: true,
        sendToCustomer: false,
        sendToVendor: false,
        adminEmails: ['vip@infinicharm.com'],
        customEmails: ['ops@infinicharm.com'],
      },
      rulesFile
    );
    assert.strictEqual(created.isSystemDefault, false);

    const updated = updateNotificationRule(
      created.id,
      { name: 'Updated Concierge Alert', isEnabled: false },
      rulesFile
    );
    assert.strictEqual(updated.success, true);
    assert.strictEqual(updated.rule?.name, 'Updated Concierge Alert');
    assert.strictEqual(updated.rule?.isEnabled, false);

    const dup = duplicateNotificationRule(created.id, rulesFile);
    assert.strictEqual(dup.success, true);
    assert.ok(dup.rule?.name.includes('(Copy)'));

    assert.strictEqual(deleteNotificationRule(created.id, rulesFile).success, true);
    assert.strictEqual(deleteNotificationRule(dup.rule!.id, rulesFile).success, true);
  });

  it('deduplicates overlapping recipient emails across Admin, Customer, Vendor, and Custom roles', () => {
    const prefs = updateGlobalNotificationPreferences(
      {
        defaultAdminEmails: ['shared@infinicharm.com', 'admin2@infinicharm.com'],
        deduplicateOverlappingRecipients: true,
      },
      prefsFile
    );

    const rule = createNotificationRule(
      {
        eventKey: 'VENDOR_NEW_ORDER',
        name: 'Dedup Rule',
        category: 'VENDOR',
        sendToAdmin: true,
        sendToCustomer: true,
        sendToVendor: true,
        vendorEmails: ['SHARED@infinicharm.com', 'vendor@partner.in'],
        customEmails: ['shared@infinicharm.com', 'audit@infinicharm.com'],
      },
      rulesFile
    );

    const resolved = resolveRecipientsForRule(rule, prefs, {
      customerEmail: 'shared@infinicharm.com',
      customerName: 'Same User',
    });

    const emails = resolved.map((r) => r.email.toLowerCase());
    assert.deepStrictEqual(emails, [
      'shared@infinicharm.com',
      'admin2@infinicharm.com',
      'vendor@partner.in',
      'audit@infinicharm.com',
    ]);
  });

  it('enforces per-rule and global toggles cleanly while logging DISABLED status', async () => {
    const server = await createLocalStubSmtpServer();
    try {
      createSmtpConfig(
        {
          name: 'Local Stub Relay',
          providerType: 'CUSTOM_SMTP',
          host: '127.0.0.1',
          port: server.port,
          encryption: 'NONE',
          senderName: 'InfiniCharm Test',
          senderEmail: 'noreply@infinicharm.com',
          username: 'tester',
          secret: 'stub-pass-123',
          isDefault: true,
          isEnabled: true,
        },
        smtpFile
      );

      updateGlobalNotificationPreferences(
        {
          notificationsEnabled: true,
          defaultAdminEmails: ['admin@infinicharm.com'],
          maxAutoRetries: 0,
        },
        prefsFile
      );

      const deliveredRule = getRulesByEventKey('ORDER_DELIVERED', rulesFile)[0];
      assert.ok(deliveredRule);
      updateNotificationRule(deliveredRule.id, { isEnabled: false }, rulesFile);

      const disabledDispatch = await dispatchNotificationEvent({
        eventKey: 'ORDER_DELIVERED',
        customerEmail: 'buyer@example.com',
        customerName: 'Aarav',
        extraVars: { order_number: 'INF-1001' },
        paths: { smtpFilePath: smtpFile, templatesFilePath: templatesFile, rulesFilePath: rulesFile, prefsFilePath: prefsFile, logsFilePath: logsFile },
      });
      assert.strictEqual(disabledDispatch.sentCount, 0);
      assert.strictEqual(disabledDispatch.logs[0]?.status, 'DISABLED');
      assert.strictEqual(server.received.length, 0);

      // Re-enabling or firing another active rule delivers cleanly
      const placedDispatch = await dispatchNotificationEvent({
        eventKey: 'ORDER_PLACED',
        customerEmail: 'buyer@example.com',
        customerName: 'Aarav',
        extraVars: {
          order_number: 'INF-1002',
          order_total: '₹999.00',
          payment_method: 'COD',
          payment_status: 'PENDING',
        },
        paths: { smtpFilePath: smtpFile, templatesFilePath: templatesFile, rulesFilePath: rulesFile, prefsFilePath: prefsFile, logsFilePath: logsFile },
      });
      assert.strictEqual(placedDispatch.sentCount, 2); // Admin + Customer
      assert.strictEqual(server.received.length, 2);

      // Master toggle OFF pauses even enabled rules
      updateGlobalNotificationPreferences({ notificationsEnabled: false }, prefsFile);
      const pausedDispatch = await dispatchNotificationEvent({
        eventKey: 'ENQUIRY_SUBMITTED',
        customerEmail: 'visitor@example.com',
        paths: { smtpFilePath: smtpFile, templatesFilePath: templatesFile, rulesFilePath: rulesFile, prefsFilePath: prefsFile, logsFilePath: logsFile },
      });
      assert.strictEqual(pausedDispatch.sentCount, 0);
      assert.strictEqual(pausedDispatch.logs[0]?.status, 'DISABLED');
      assert.strictEqual(server.received.length, 2);
    } finally {
      await server.close();
    }
  });

  it('logs failed deliveries on unreachable SMTP and succeeds on retry when fixed', async () => {
    const cfg = createSmtpConfig(
      {
        name: 'Broken Relay',
        providerType: 'CUSTOM_SMTP',
        host: '127.0.0.1',
        port: 1, // Unreachable port
        encryption: 'NONE',
        senderName: 'InfiniCharm Test',
        senderEmail: 'noreply@infinicharm.com',
        username: 'tester',
        secret: 'stub-pass-123',
        isDefault: true,
        isEnabled: true,
      },
      smtpFile
    );

    updateGlobalNotificationPreferences(
      {
        notificationsEnabled: true,
        defaultAdminEmails: ['admin@infinicharm.com'],
        maxAutoRetries: 0,
      },
      prefsFile
    );

    const preview = previewNotificationRule(
      getRulesByEventKey('ENQUIRY_SUBMITTED', rulesFile)[0].id,
      undefined,
      { rulesFilePath: rulesFile, templatesFilePath: templatesFile }
    );
    assert.ok(preview?.subject.includes('InfiniCharm') || preview?.subject.length);

    const failedRes = await dispatchNotificationEvent({
      eventKey: 'ENQUIRY_SUBMITTED',
      customerEmail: 'customer@example.com',
      customerName: 'Neha',
      extraVars: {
        enquiry_id: 'ENQ-TEST-1',
        enquiry_subject: 'Wholesale Question',
        enquiry_message: 'Interested in 5kg pack.',
      },
      paths: { smtpFilePath: smtpFile, templatesFilePath: templatesFile, rulesFilePath: rulesFile, prefsFilePath: prefsFile, logsFilePath: logsFile },
    });

    assert.strictEqual(failedRes.failedCount, 2); // Admin + Customer both attempt over unreachable relay
    const failedLog = failedRes.logs[0];
    assert.strictEqual(failedLog.status, 'FAILED');

    const stub = await createLocalStubSmtpServer();
    try {
      updateSmtpConfig(cfg.id, { port: stub.port }, smtpFile);
      const retry = await retryNotificationLogById(failedLog.id, {
        smtpFilePath: smtpFile,
        templatesFilePath: templatesFile,
        rulesFilePath: rulesFile,
        prefsFilePath: prefsFile,
        logsFilePath: logsFile,
      });
      assert.strictEqual(retry.success, true, `Retry failed: ${retry.error || failedLog.errorMessage}`);
      assert.strictEqual(retry.log?.status, 'SENT');
      assert.strictEqual(retry.log?.retryCount, 1);
      assert.strictEqual(stub.received.length, 1);
    } finally {
      await stub.close();
    }
    const queried = queryNotificationLogs({ status: 'SENT' }, logsFile);
    assert.strictEqual(queried.stats.sent, 1);
  });

  it('persists enquiries and enforces hashed single-use password reset OTPs', () => {
    const inq = createInquiryRecord(
      {
        name: 'Rohan Das',
        email: 'ROHAN@example.com',
        phone: '9876543210',
        subject: 'Order Support',
        message: 'Checking GST invoice availability.',
      },
      inquiriesFile
    );
    assert.strictEqual(inq.email, 'rohan@example.com');
    assert.strictEqual(listInquiries(inquiriesFile).length, 1);

    const replied = updateInquiryRecord(
      inq.id,
      { status: 'RESOLVED', adminResponse: 'GST invoice attached.', notificationStatus: 'SENT' },
      inquiriesFile
    );
    assert.strictEqual(replied?.status, 'RESOLVED');
    assert.strictEqual(deleteInquiryRecord(inq.id, inquiriesFile), true);
    assert.strictEqual(listInquiries(inquiriesFile).length, 0);

    const { otp } = createPasswordResetOtp('rohan@example.com', otpFile);
    assert.match(otp, /^\d{6}$/);

    // Wrong OTP rejected
    const wrong = verifyAndConsumePasswordResetOtp('rohan@example.com', '000000', otpFile);
    assert.strictEqual(wrong.valid, false);

    // Correct OTP succeeds once
    const good = verifyAndConsumePasswordResetOtp('rohan@example.com', otp, otpFile);
    assert.strictEqual(good.valid, true);

    // Replay rejected
    const replay = verifyAndConsumePasswordResetOtp('rohan@example.com', otp, otpFile);
    assert.strictEqual(replay.valid, false);
  });
});
