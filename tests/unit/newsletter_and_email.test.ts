import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {
  adminCreateSubscriber,
  adminDeleteSubscriber,
  adminUpdateSubscriber,
  exportSubscribersToCsv,
  queryNewsletterSubscribers,
  resolveCampaignRecipients,
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
} from '../../src/lib/server/newsletter-store.ts';
import {
  createSmtpConfig,
  getRuntimeSmtpConfigById,
  listSanitizedSmtpConfigs,
  updateSmtpConfig,
} from '../../src/lib/server/smtp-store.ts';
import { renderEmailVariables } from '../../src/lib/server/mailer.ts';
import {
  createEmailCampaign,
  createEmailTemplate,
  dispatchEmailCampaign,
  duplicateEmailTemplate,
} from '../../src/lib/server/email-marketing-store.ts';

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
      const port = typeof addr === 'object' && addr ? addr.port : 2525;
      resolve({
        port,
        received,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}

describe('InfiniCharm Newsletter, SMTP Security & Email Campaign Engine', () => {
  let tempDir: string;
  let subscribersFile: string;
  let smtpFile: string;
  let templatesFile: string;
  let campaignsFile: string;
  let logsFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'infinicharm-newsletter-test-'));
    subscribersFile = path.join(tempDir, 'newsletter_subscribers.json');
    smtpFile = path.join(tempDir, 'smtp_configs.json');
    templatesFile = path.join(tempDir, 'email_templates.json');
    campaignsFile = path.join(tempDir, 'email_campaigns.json');
    logsFile = path.join(tempDir, 'email_delivery_logs.json');

    fs.writeFileSync(subscribersFile, '[]', 'utf8');
    fs.writeFileSync(campaignsFile, '[]', 'utf8');
    fs.writeFileSync(logsFile, '[]', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('validates email, prevents duplicates, and handles token unsubscribe + resubscribe', () => {
    const bad = subscribeToNewsletter({ email: 'not-an-email' }, subscribersFile);
    assert.strictEqual(bad.outcome, 'INVALID_EMAIL');

    const first = subscribeToNewsletter(
      { email: 'Patron@Example.com', fullName: 'Aarav', source: 'homepage_circle' },
      subscribersFile
    );
    assert.strictEqual(first.outcome, 'SUBSCRIBED');
    assert.ok(first.subscriber);
    assert.strictEqual(first.subscriber.email, 'patron@example.com');
    assert.strictEqual(first.subscriber.status, 'ACTIVE');
    assert.ok(first.subscriber.unsubscribeToken.length >= 24);

    const dup = subscribeToNewsletter({ email: 'patron@example.com' }, subscribersFile);
    assert.strictEqual(dup.outcome, 'ALREADY_ACTIVE');

    const unsub = unsubscribeFromNewsletter(
      { token: first.subscriber.unsubscribeToken },
      subscribersFile
    );
    assert.strictEqual(unsub.success, true);
    assert.strictEqual(unsub.subscriber?.status, 'UNSUBSCRIBED');

    // Re-subscribing later via storefront reactivates cleanly
    const resub = subscribeToNewsletter({ email: 'patron@example.com' }, subscribersFile);
    assert.strictEqual(resub.outcome, 'RESUBSCRIBED');
    assert.strictEqual(resub.subscriber?.status, 'ACTIVE');
  });

  it('never allows SUPPRESSED contacts to self-subscribe or enter campaign segments', () => {
    const s1 = adminCreateSubscriber(
      { email: 'active@example.com', status: 'ACTIVE', source: 'homepage_circle' },
      subscribersFile
    );
    const s2 = adminCreateSubscriber(
      { email: 'unsub@example.com', status: 'UNSUBSCRIBED', source: 'homepage_circle' },
      subscribersFile
    );
    const s3 = adminCreateSubscriber(
      { email: 'suppressed@example.com', status: 'SUPPRESSED', source: 'homepage_circle' },
      subscribersFile
    );
    assert.ok(s1.success && s2.success && s3.success);

    const blocked = subscribeToNewsletter({ email: 'suppressed@example.com' }, subscribersFile);
    assert.strictEqual(blocked.outcome, 'SUPPRESSED');

    const segmentRes = resolveCampaignRecipients({ segment: 'ALL_ACTIVE' }, subscribersFile);
    assert.strictEqual(segmentRes.eligible.length, 1);
    assert.strictEqual(segmentRes.eligible[0].email, 'active@example.com');
    assert.strictEqual(segmentRes.excludedCount, 2);

    const updated = adminUpdateSubscriber(
      s1.subscriber!.id,
      { fullName: 'Updated Name', tags: ['vip'] },
      subscribersFile
    );
    assert.strictEqual(updated.subscriber?.fullName, 'Updated Name');

    const deleted = adminDeleteSubscriber(s3.subscriber!.id, subscribersFile);
    assert.strictEqual(deleted, true);

    const queried = queryNewsletterSubscribers({ q: 'active', filePath: subscribersFile });
    assert.strictEqual(queried.totalCount, 1);
  });

  it('encrypts SMTP secrets at rest, masks responses, and preserves blank updates', () => {
    const created = createSmtpConfig(
      {
        name: 'Custom Relay',
        providerType: 'CUSTOM_SMTP',
        host: 'smtp.example.com',
        port: 587,
        encryption: 'STARTTLS',
        username: 'mailer@example.com',
        secret: 'SuperSecretPassword!99',
        senderName: 'InfiniCharm',
        senderEmail: 'support@infinicharm.com',
        isDefault: true,
        isEnabled: true,
      },
      smtpFile
    );

    // Ensure secret never appears in sanitized payload or plaintext on disk
    assert.strictEqual((created as unknown as Record<string, unknown>).encryptedSecret, undefined);
    assert.strictEqual(created.hasSecret, true);
    assert.ok(!created.maskedSecret.includes('SuperSecretPassword!99'));

    const rawOnDisk = fs.readFileSync(smtpFile, 'utf8');
    assert.ok(!rawOnDisk.includes('SuperSecretPassword!99'));

    // Updating without secret preserves encrypted password
    const upd = updateSmtpConfig(created.id, { name: 'Renamed Relay' }, smtpFile);
    assert.strictEqual(upd.success, true);

    const runtime = getRuntimeSmtpConfigById(created.id, smtpFile);
    assert.strictEqual(runtime?.plainSecret, 'SuperSecretPassword!99');

    const listed = listSanitizedSmtpConfigs(smtpFile);
    assert.ok(listed.length >= 1);
  });

  it('injects dynamic variables and enforces unsubscribe footer on marketing templates', () => {
    const rendered = renderEmailVariables(
      {
        subject: 'Hello {{subscriber_name}} — {{campaign_title}}',
        htmlContent: '<p>Hi {{subscriber_name}} from {{brand_name}}</p>',
      },
      {
        subscriberName: 'Zaid <Admin>',
        subscriberEmail: 'zaid@example.com',
        campaignTitle: 'Winter Honey',
        unsubscribeToken: 'tok-abc-123',
      },
      { requireUnsubscribeLink: true }
    );

    assert.strictEqual(rendered.subject, 'Hello Zaid <Admin> — Winter Honey');
    assert.ok(rendered.htmlContent.includes('Zaid &lt;Admin&gt;'));
    assert.ok(rendered.htmlContent.includes('/unsubscribe?token=tok-abc-123'));
    assert.ok(rendered.textContent.includes('/unsubscribe?token=tok-abc-123'));
  });

  it('escapes formula injection characters in CSV exports', () => {
    const sub = adminCreateSubscriber(
      { email: 'safe@example.com', fullName: '=CMD()', source: '+test' },
      subscribersFile
    );
    assert.ok(sub.subscriber);
    const csv = exportSubscribersToCsv([sub.subscriber]);
    assert.ok(csv.includes("'=CMD()"));
    assert.ok(csv.includes("'+test"));
  });

  it('dispatches campaign only to ACTIVE subscribers over Custom SMTP and records logs', async () => {
    const stubSmtp = await createLocalStubSmtpServer();
    try {
      const smtpCfg = createSmtpConfig(
        {
          name: 'Local Test SMTP',
          providerType: 'CUSTOM_SMTP',
          host: '127.0.0.1',
          port: stubSmtp.port,
          encryption: 'NONE',
          username: 'tester',
          secret: 'pass123',
          senderName: 'InfiniCharm Dispatch',
          senderEmail: 'support@infinicharm.com',
          isDefault: true,
          isEnabled: true,
        },
        smtpFile
      );

      const tpl = createEmailTemplate(
        {
          name: 'Harvest Dispatch Test',
          purpose: 'MARKETING',
          subject: 'Fresh Batch: {{campaign_title}}',
          htmlContent: '<p>Hello {{subscriber_name}}, fresh batch out now! <a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
        },
        templatesFile
      );
      const dupTpl = duplicateEmailTemplate(tpl.id, templatesFile);
      assert.strictEqual(dupTpl.success, true);

      subscribeToNewsletter(
        { email: 'active.member@example.com', fullName: 'Active Member' },
        subscribersFile
      );
      const willUnsub = subscribeToNewsletter(
        { email: 'opted.out@example.com', fullName: 'Opted Out' },
        subscribersFile
      );
      unsubscribeFromNewsletter(
        { token: willUnsub.subscriber!.unsubscribeToken },
        subscribersFile
      );

      const campaign = createEmailCampaign(
        {
          name: 'Autumn Saffron Release',
          subject: tpl.subject,
          templateId: tpl.id,
          smtpConfigId: smtpCfg.id,
          senderName: 'InfiniCharm',
          senderEmail: 'support@infinicharm.com',
          htmlContent: tpl.htmlContent,
          segment: 'ALL_ACTIVE',
        },
        { campaignsFilePath: campaignsFile, subscribersFilePath: subscribersFile }
      );

      assert.strictEqual(campaign.eligibleCount, 1);
      assert.strictEqual(campaign.skippedCount, 1);

      const dispatchRes = await dispatchEmailCampaign({
        campaignId: campaign.id,
        mode: 'send',
        campaignsFilePath: campaignsFile,
        subscribersFilePath: subscribersFile,
        smtpFilePath: smtpFile,
        logsFilePath: logsFile,
      });

      assert.strictEqual(dispatchRes.success, true);
      assert.strictEqual(dispatchRes.sentCount, 1);
      assert.strictEqual(dispatchRes.failedCount, 0);
      assert.strictEqual(dispatchRes.skippedCount, 1);
      assert.strictEqual(stubSmtp.received.length, 1);
      assert.ok(stubSmtp.received[0].includes('active.member@example.com'));
      assert.ok(!stubSmtp.received[0].includes('opted.out@example.com'));

      const savedLogs = JSON.parse(fs.readFileSync(logsFile, 'utf8'));
      assert.strictEqual(savedLogs.length, 1);
      assert.strictEqual(savedLogs[0].status, 'SENT');
      assert.strictEqual(savedLogs[0].recipientEmail, 'active.member@example.com');
    } finally {
      await stubSmtp.close();
    }
  });
});
