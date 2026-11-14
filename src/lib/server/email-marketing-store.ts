import fs from 'fs';
import path from 'path';
import type {
  CampaignRecipientSegment,
  EmailCampaign,
  EmailTemplate,
  EmailTemplatePurpose,
  NewsletterSubscriber,
} from '../../types/index.ts';
import {
  buildUnsubscribeUrl,
  renderEmailVariables,
  sendEmailViaConfiguredProvider,
} from './mailer.ts';
import {
  getNewsletterWidgetSettings,
  markSubscriberCampaignDelivered,
  resolveCampaignRecipients,
} from './newsletter-store.ts';

const TEMPLATES_DATA_PATH = path.join(process.cwd(), 'src', 'data', 'email_templates.json');
const CAMPAIGNS_DATA_PATH = path.join(process.cwd(), 'src', 'data', 'email_campaigns.json');

function ensureJsonFile<T>(filePath: string, fallback: T): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf8');
  }
}

function writeAtomicJson(filePath: string, data: unknown): void {
  ensureJsonFile(filePath, []);
  const tmp = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `template-${Date.now()}`;
}

export function buildDefaultEmailTemplates(): EmailTemplate[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'tpl-welcome-circle',
      name: 'InfiniCharm Circle Welcome',
      slug: 'infinicharm-circle-welcome',
      purpose: 'WELCOME',
      subject: 'Welcome to the InfiniCharm Circle — Pure Living Starts Here',
      previewText: 'Thank you for joining direct-from-origin harvest dispatches.',
      htmlContent: `<div style="background:#f9f6f1;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#1e1a17;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e7e1da;border-radius:16px;overflow:hidden;">
    <div style="background:#181512;padding:28px 32px;color:#ffffff;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#e67658;font-weight:700;">INFINICHARM CIRCLE</p>
      <h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:700;">Welcome to the Circle, {{subscriber_name}}</h1>
    </div>
    <div style="padding:28px 32px;font-size:15px;line-height:1.65;color:#3d352e;">
      <p style="margin-top:0;">Thank you for subscribing to InfiniCharm by TechilyFly India. You will receive honest updates on fresh stock releases of 100% Kashmiri Honey, Zamzam Water, Takmeeli Talbeena, Barliva, and Premium Dates directly in your inbox.</p>
      <p>Every dispatch shares transparent sourcing origins — delivered with care from Bairgania, Sitamarhi, Bihar.</p>
      <div style="margin:26px 0;">
        <a href="{{store_url}}/shop" style="display:inline-block;background:#e67658;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;">Explore Approved Catalogue</a>
      </div>
      <p style="margin-bottom:0;font-size:13px;color:#6f645b;">Questions? Reply directly or write to {{support_email}}.</p>
    </div>
    <div style="background:#f9f6f1;padding:16px 32px;border-top:1px solid #e7e1da;font-size:12px;color:#6f645b;text-align:center;">
      {{brand_name}} &bull; East Champaran, Bihar - 845427<br/>
      <a href="{{unsubscribe_url}}" style="color:#c2593f;text-decoration:underline;">Unsubscribe in one click</a>
    </div>
  </div>
</div>`,
      textContent: `Welcome to the InfiniCharm Circle, {{subscriber_name}}!\n\nThank you for joining InfiniCharm by TechilyFly India. Explore direct-from-origin harvests at {{store_url}}/shop.\n\nUnsubscribe anytime: {{unsubscribe_url}}`,
      isDefaultForPurpose: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl-harvest-dispatch',
      name: 'Direct Harvest Newsletter Dispatch',
      slug: 'direct-harvest-newsletter-dispatch',
      purpose: 'MARKETING',
      subject: '{{campaign_title}} — Fresh Batch Dispatch from InfiniCharm',
      previewText: 'Small-batch provenance highlights and limited harvest arrivals.',
      htmlContent: `<div style="background:#f9f6f1;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#1e1a17;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e7e1da;border-radius:16px;overflow:hidden;">
    <div style="background:#181512;padding:28px 32px;color:#ffffff;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#e67658;font-weight:700;">COMMUNITY DISPATCH</p>
      <h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:700;">{{campaign_title}}</h1>
    </div>
    <div style="padding:28px 32px;font-size:15px;line-height:1.65;color:#3d352e;">
      <p style="margin-top:0;">Namaste {{subscriber_name}},</p>
      <p>Our latest verified harvest lot is now sealed and ready for dispatch directly from our regional sourcing partners.</p>
      <div style="margin:24px 0;">
        <a href="{{store_url}}/shop" style="display:inline-block;background:#181512;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;">Shop the Batch</a>
      </div>
    </div>
    <div style="background:#f9f6f1;padding:16px 32px;border-top:1px solid #e7e1da;font-size:12px;color:#6f645b;text-align:center;">
      Sent to {{subscriber_email}} by {{brand_name}}.<br/>
      <a href="{{unsubscribe_url}}" style="color:#c2593f;text-decoration:underline;">Unsubscribe from marketing dispatches</a>
    </div>
  </div>
</div>`,
      textContent: `Namaste {{subscriber_name}},\n\n{{campaign_title}}\nExplore the latest InfiniCharm batch at {{store_url}}/shop.\n\nUnsubscribe: {{unsubscribe_url}}`,
      isDefaultForPurpose: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl-seasonal-offer',
      name: 'Seasonal Reserve Announcement',
      slug: 'seasonal-reserve-announcement',
      purpose: 'ANNOUNCEMENT',
      subject: 'InfiniCharm Reserve Notice: {{campaign_title}}',
      previewText: 'Early community access to seasonal pure batches.',
      htmlContent: `<div style="background:#f9f6f1;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#1e1a17;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e7e1da;border-radius:16px;overflow:hidden;">
    <div style="background:#c2593f;padding:24px 32px;color:#ffffff;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#fff4ef;font-weight:700;">RESERVE ANNOUNCEMENT</p>
      <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:700;">{{campaign_title}}</h1>
    </div>
    <div style="padding:28px 32px;font-size:15px;line-height:1.65;color:#3d352e;">
      <p style="margin-top:0;">Hello {{subscriber_name}},</p>
      <p>We are announcing an exclusive InfiniCharm Circle update tailored for members who value lab-tested, unadulterated staples and crafts.</p>
      <div style="margin:24px 0;">
        <a href="{{store_url}}/shop" style="display:inline-block;background:#e67658;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;">Visit Storefront</a>
      </div>
    </div>
    <div style="background:#f9f6f1;padding:16px 32px;border-top:1px solid #e7e1da;font-size:12px;color:#6f645b;text-align:center;">
      {{brand_name}} &bull; Support: {{support_email}}<br/>
      <a href="{{unsubscribe_url}}" style="color:#c2593f;text-decoration:underline;">Unsubscribe</a>
    </div>
  </div>
</div>`,
      textContent: `Hello {{subscriber_name}},\n\n{{campaign_title}}\nVisit {{store_url}}/shop.\n\nUnsubscribe: {{unsubscribe_url}}`,
      isDefaultForPurpose: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl-enquiry-admin-alert',
      name: 'New Customer Enquiry — Admin Alert',
      slug: 'enquiry-admin-alert',
      purpose: 'ADMIN',
      subject: 'New Customer Enquiry: {{enquiry_subject}} — {{customer_name}}',
      previewText: 'A new customer enquiry was submitted on InfiniCharm.',
      htmlContent: `<div style="background:#f9f6f1;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#1e1a17;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e7e1da;border-radius:16px;overflow:hidden;">
    <div style="background:#181512;padding:22px 28px;color:#ffffff;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#f5a38e;font-weight:700;">ADMIN ENQUIRY ALERT</p>
      <h1 style="margin:0;font-size:20px;line-height:1.3;font-weight:700;">{{enquiry_subject}}</h1>
    </div>
    <div style="padding:26px 28px;font-size:14px;line-height:1.65;color:#3d352e;">
      <p style="margin-top:0;">A visitor has submitted an enquiry via the storefront:</p>
      <table style="width:100%;border-collapse:collapse;background:#fbf9f6;border:1px solid #e7e1da;border-radius:10px;margin:14px 0;">
        <tr><td style="padding:8px 12px;font-weight:700;width:140px;">Customer Name</td><td style="padding:8px 12px;">{{customer_name}}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:700;">Email</td><td style="padding:8px 12px;">{{customer_email}}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:700;">Phone</td><td style="padding:8px 12px;">{{customer_phone}}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:700;">Submitted At</td><td style="padding:8px 12px;">{{submitted_at}}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:700;">Source</td><td style="padding:8px 12px;">{{enquiry_source}}</td></tr>
      </table>
      <div style="background:#f9f6f1;border-left:3px solid #c2593f;padding:12px 16px;border-radius:8px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;color:#6f645b;">Customer Message</p>
        <p style="margin:0;white-space:pre-line;">{{enquiry_message}}</p>
      </div>
      <div style="margin:22px 0 0;">
        <a href="{{action_url}}" style="display:inline-block;background:#c2593f;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:700;font-size:13px;">Open Admin Inquiries</a>
      </div>
    </div>
  </div>
</div>`,
      textContent: `New Enquiry: {{enquiry_subject}}\nFrom: {{customer_name}} ({{customer_email}} / {{customer_phone}})\nSubmitted: {{submitted_at}}\n\nMessage:\n{{enquiry_message}}\n\nReview: {{action_url}}`,
      isDefaultForPurpose: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl-enquiry-admin-reply',
      name: 'Enquiry Support Reply — Customer',
      slug: 'enquiry-admin-reply',
      purpose: 'CUSTOMER',
      subject: 'Re: {{enquiry_subject}} — InfiniCharm Support',
      previewText: 'Our support team has responded to your enquiry.',
      htmlContent: `<div style="background:#f9f6f1;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#1e1a17;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e7e1da;border-radius:16px;overflow:hidden;">
    <div style="background:#181512;padding:22px 28px;color:#ffffff;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#f5a38e;font-weight:700;">INFINICHARM SUPPORT CARE</p>
      <h1 style="margin:0;font-size:20px;font-weight:700;">Response to Your Enquiry</h1>
    </div>
    <div style="padding:26px 28px;font-size:14px;line-height:1.65;color:#3d352e;">
      <p style="margin-top:0;">Namaste {{customer_name}},</p>
      <p>Thank you for reaching out regarding <strong>{{enquiry_subject}}</strong>. Here is the update from our team:</p>
      <div style="background:#f9f6f1;border:1px solid #e7e1da;padding:14px 16px;border-radius:10px;margin:16px 0;white-space:pre-line;">{{admin_reply}}</div>
      <p style="font-size:13px;color:#6f645b;">Reference ID: {{enquiry_id}} &bull; Need further assistance? Reply directly or write to {{support_email}}.</p>
    </div>
  </div>
</div>`,
      textContent: `Namaste {{customer_name}},\n\nUpdate on "{{enquiry_subject}}":\n{{admin_reply}}\n\nRef: {{enquiry_id}}`,
      isDefaultForPurpose: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl-order-placed',
      name: 'Order Placed Confirmation',
      slug: 'order-placed-confirmation',
      purpose: 'TRANSACTIONAL',
      subject: 'Order {{order_number}} Confirmed — {{brand_name}}',
      previewText: 'Thank you! We have received your InfiniCharm order.',
      htmlContent: `<div style="background:#f9f6f1;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#1e1a17;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e7e1da;border-radius:16px;overflow:hidden;">
    <div style="background:#181512;padding:24px 28px;color:#ffffff;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#f5a38e;font-weight:700;">ORDER CONFIRMATION</p>
      <h1 style="margin:0;font-size:21px;font-weight:700;">Order {{order_number}} Received</h1>
    </div>
    <div style="padding:26px 28px;font-size:14px;line-height:1.65;color:#3d352e;">
      <p style="margin-top:0;">Namaste {{customer_name}},</p>
      <p>We have recorded order <strong>{{order_number}}</strong>. Our fulfillment team will verify payment and dispatch your consignment shortly.</p>
      <table style="width:100%;border-collapse:collapse;background:#fbf9f6;border:1px solid #e7e1da;border-radius:10px;margin:14px 0;">
        <tr><td style="padding:8px 12px;font-weight:700;">Order Reference</td><td style="padding:8px 12px;">{{order_number}}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:700;">Order Total</td><td style="padding:8px 12px;font-weight:700;color:#c2593f;">{{order_total}}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:700;">Payment Method</td><td style="padding:8px 12px;">{{payment_method}} ({{payment_status}})</td></tr>
        <tr><td style="padding:8px 12px;font-weight:700;">Items</td><td style="padding:8px 12px;">{{order_items_summary}}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:700;">Delivery Destination</td><td style="padding:8px 12px;">{{shipping_address}}</td></tr>
      </table>
      <div style="margin:20px 0 0;">
        <a href="{{tracking_url}}" style="display:inline-block;background:#e67658;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;font-size:13px;">Track Consignment</a>
      </div>
    </div>
  </div>
</div>`,
      textContent: `Order {{order_number}} Confirmed\nCustomer: {{customer_name}}\nTotal: {{order_total}}\nPayment: {{payment_method}} ({{payment_status}})\nItems: {{order_items_summary}}\nTrack: {{tracking_url}}`,
      isDefaultForPurpose: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl-order-status-update',
      name: 'Order Lifecycle & Payment Update',
      slug: 'order-status-update',
      purpose: 'TRANSACTIONAL',
      subject: 'Order {{order_number}} Update: {{event_label}}',
      previewText: 'Status update for your InfiniCharm consignment.',
      htmlContent: `<div style="background:#f9f6f1;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#1e1a17;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e7e1da;border-radius:16px;overflow:hidden;">
    <div style="background:#181512;padding:22px 28px;color:#ffffff;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#f5a38e;font-weight:700;">CONSIGNMENT STATUS</p>
      <h1 style="margin:0;font-size:20px;font-weight:700;">{{order_number}} — {{event_label}}</h1>
    </div>
    <div style="padding:26px 28px;font-size:14px;line-height:1.65;color:#3d352e;">
      <p style="margin-top:0;">Hello {{customer_name}},</p>
      <p>{{status_message}}</p>
      <table style="width:100%;border-collapse:collapse;background:#fbf9f6;border:1px solid #e7e1da;border-radius:10px;margin:14px 0;">
        <tr><td style="padding:8px 12px;font-weight:700;">Order</td><td style="padding:8px 12px;">{{order_number}}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:700;">Order Status</td><td style="padding:8px 12px;">{{order_status}}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:700;">Payment Status</td><td style="padding:8px 12px;">{{payment_status}}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:700;">Total</td><td style="padding:8px 12px;">{{order_total}}</td></tr>
      </table>
      <a href="{{tracking_url}}" style="display:inline-block;background:#181512;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:700;font-size:13px;">View Order Details</a>
    </div>
  </div>
</div>`,
      textContent: `Order {{order_number}} Update: {{event_label}}\n{{status_message}}\nStatus: {{order_status}} | Payment: {{payment_status}}\nTrack: {{tracking_url}}`,
      isDefaultForPurpose: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl-order-shipped',
      name: 'Shipment Dispatched & AWB Tracking',
      slug: 'order-shipped-tracking',
      purpose: 'TRANSACTIONAL',
      subject: 'Dispatched! Order {{order_number}} via {{courier_name}}',
      previewText: 'Your InfiniCharm consignment has been handed to the courier.',
      htmlContent: `<div style="background:#f9f6f1;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#1e1a17;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e7e1da;border-radius:16px;overflow:hidden;">
    <div style="background:#c2593f;padding:22px 28px;color:#ffffff;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#fff4ef;font-weight:700;">CONSIGNMENT DISPATCHED</p>
      <h1 style="margin:0;font-size:20px;font-weight:700;">Order {{order_number}} Is On Its Way</h1>
    </div>
    <div style="padding:26px 28px;font-size:14px;line-height:1.65;color:#3d352e;">
      <p style="margin-top:0;">Namaste {{customer_name}},</p>
      <p>Your consignment has been dispatched. Track live courier milestones below:</p>
      <table style="width:100%;border-collapse:collapse;background:#fbf9f6;border:1px solid #e7e1da;border-radius:10px;margin:14px 0;">
        <tr><td style="padding:8px 12px;font-weight:700;">Courier Partner</td><td style="padding:8px 12px;">{{courier_name}}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:700;">AWB / Tracking ID</td><td style="padding:8px 12px;font-family:monospace;">{{tracking_number}}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:700;">Order Total</td><td style="padding:8px 12px;">{{order_total}}</td></tr>
      </table>
      <a href="{{tracking_url}}" style="display:inline-block;background:#181512;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:10px;font-weight:700;font-size:13px;">Track Live Consignment</a>
    </div>
  </div>
</div>`,
      textContent: `Order {{order_number}} Dispatched via {{courier_name}} (AWB: {{tracking_number}}).\nTrack: {{tracking_url}}`,
      isDefaultForPurpose: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl-account-welcome',
      name: 'Customer Account Welcome',
      slug: 'customer-account-welcome',
      purpose: 'CUSTOMER',
      subject: 'Welcome to {{brand_name}}, {{customer_name}}',
      previewText: 'Your InfiniCharm customer account is active.',
      htmlContent: `<div style="background:#f9f6f1;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#1e1a17;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e7e1da;border-radius:16px;overflow:hidden;">
    <div style="background:#181512;padding:24px 28px;color:#ffffff;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#f5a38e;font-weight:700;">ACCOUNT CREATED</p>
      <h1 style="margin:0;font-size:21px;font-weight:700;">Welcome to InfiniCharm</h1>
    </div>
    <div style="padding:26px 28px;font-size:14px;line-height:1.65;color:#3d352e;">
      <p style="margin-top:0;">Namaste {{customer_name}},</p>
      <p>Your account (<strong>{{customer_email}}</strong>) is now ready. You can manage saved delivery addresses, track consignments in real time, and post verified purchase reviews.</p>
      <a href="{{store_url}}/shop" style="display:inline-block;background:#e67658;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;font-size:13px;">Explore Marketplace</a>
    </div>
  </div>
</div>`,
      textContent: `Namaste {{customer_name}}, your InfiniCharm account ({{customer_email}}) is now active at {{store_url}}/shop.`,
      isDefaultForPurpose: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl-password-reset-otp',
      name: 'Password Reset Verification PIN',
      slug: 'password-reset-otp',
      purpose: 'CUSTOMER',
      subject: '{{otp_code}} is your {{brand_name}} Password Reset PIN',
      previewText: 'Use this 6-digit PIN within 15 minutes to reset your password.',
      htmlContent: `<div style="background:#f9f6f1;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#1e1a17;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e1da;border-radius:16px;overflow:hidden;">
    <div style="background:#181512;padding:22px 28px;color:#ffffff;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#f5a38e;font-weight:700;">SECURITY VERIFICATION</p>
      <h1 style="margin:0;font-size:20px;font-weight:700;">Password Reset PIN</h1>
    </div>
    <div style="padding:26px 28px;font-size:14px;line-height:1.65;color:#3d352e;">
      <p style="margin-top:0;">Hello {{customer_name}},</p>
      <p>Use the single-use verification PIN below within <strong>15 minutes</strong> to complete your password reset:</p>
      <div style="background:#fff5f1;border:1px dashed #e67658;border-radius:12px;padding:16px;text-align:center;margin:18px 0;">
        <span style="font-family:monospace;font-size:28px;font-weight:800;letter-spacing:0.25em;color:#c2593f;">{{otp_code}}</span>
      </div>
      <p style="font-size:12px;color:#6f645b;">If you did not request a password reset, you can safely ignore this message.</p>
    </div>
  </div>
</div>`,
      textContent: `Your InfiniCharm Password Reset PIN is {{otp_code}} (valid for 15 minutes).`,
      isDefaultForPurpose: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl-account-activity',
      name: 'Account Security & Profile Alert',
      slug: 'account-activity-alert',
      purpose: 'CUSTOMER',
      subject: 'Account Update: {{event_label}} — {{brand_name}}',
      previewText: 'Notice of an update to your InfiniCharm account.',
      htmlContent: `<div style="background:#f9f6f1;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#1e1a17;">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e7e1da;border-radius:16px;overflow:hidden;">
    <div style="background:#181512;padding:20px 28px;color:#ffffff;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#f5a38e;font-weight:700;">ACCOUNT NOTICE</p>
      <h1 style="margin:0;font-size:19px;font-weight:700;">{{event_label}}</h1>
    </div>
    <div style="padding:24px 28px;font-size:14px;line-height:1.65;color:#3d352e;">
      <p style="margin-top:0;">Hello {{customer_name}},</p>
      <p>{{activity_summary}}</p>
      <p style="font-size:12px;color:#6f645b;">Account: {{customer_email}} &bull; Support: {{support_email}}</p>
    </div>
  </div>
</div>`,
      textContent: `Hello {{customer_name}}, {{event_label}}: {{activity_summary}} ({{customer_email}})`,
      isDefaultForPurpose: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl-review-alert',
      name: 'Product Review Notification',
      slug: 'product-review-notification',
      purpose: 'ADMIN',
      subject: 'Review Alert ({{review_rating}}/5): {{product_title}}',
      previewText: 'Customer review event recorded on InfiniCharm.',
      htmlContent: `<div style="background:#f9f6f1;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#1e1a17;">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e7e1da;border-radius:16px;overflow:hidden;">
    <div style="background:#181512;padding:20px 28px;color:#ffffff;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#f5a38e;font-weight:700;">PRODUCT REVIEW</p>
      <h1 style="margin:0;font-size:19px;font-weight:700;">{{product_title}} — {{review_rating}} / 5 Stars</h1>
    </div>
    <div style="padding:24px 28px;font-size:14px;line-height:1.65;color:#3d352e;">
      <p><strong>Customer:</strong> {{customer_name}} ({{customer_email}})</p>
      <p><strong>Status:</strong> {{review_status}}</p>
      <p><strong>Comment:</strong> {{review_comment}}</p>
      <a href="{{action_url}}" style="display:inline-block;background:#c2593f;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:700;font-size:13px;">Manage Reviews</a>
    </div>
  </div>
</div>`,
      textContent: `Review ({{review_rating}}/5) on {{product_title}} by {{customer_name}}: {{review_comment}} [{{review_status}}]`,
      isDefaultForPurpose: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl-inventory-alert',
      name: 'Inventory & Catalog Alert — Admin',
      slug: 'inventory-catalog-alert',
      purpose: 'ADMIN',
      subject: 'Catalog Alert: {{event_label}} — {{product_title}}',
      previewText: 'Stock or visibility status changed in your catalog.',
      htmlContent: `<div style="background:#f9f6f1;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#1e1a17;">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e7e1da;border-radius:16px;overflow:hidden;">
    <div style="background:#181512;padding:20px 28px;color:#ffffff;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#f5a38e;font-weight:700;">CATALOG & STOCK ALERT</p>
      <h1 style="margin:0;font-size:19px;font-weight:700;">{{product_title}}</h1>
    </div>
    <div style="padding:24px 28px;font-size:14px;line-height:1.65;color:#3d352e;">
      <p><strong>Event:</strong> {{event_label}}</p>
      <p><strong>Current Stock:</strong> {{stock_quantity}} units</p>
      <p><strong>Catalog Status:</strong> {{product_status}}</p>
      <a href="{{action_url}}" style="display:inline-block;background:#181512;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:700;font-size:13px;">Review Inventory</a>
    </div>
  </div>
</div>`,
      textContent: `Catalog Alert ({{event_label}}): {{product_title}} | Stock: {{stock_quantity}} | Status: {{product_status}}`,
      isDefaultForPurpose: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl-vendor-dispatch',
      name: 'Vendor Operations & Payout Alert',
      slug: 'vendor-operations-alert',
      purpose: 'VENDOR',
      subject: 'Vendor Notice: {{event_label}} — {{brand_name}}',
      previewText: 'Operational notification for InfiniCharm vendor operations.',
      htmlContent: `<div style="background:#f9f6f1;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#1e1a17;">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e7e1da;border-radius:16px;overflow:hidden;">
    <div style="background:#181512;padding:20px 28px;color:#ffffff;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#f5a38e;font-weight:700;">VENDOR DISPATCH</p>
      <h1 style="margin:0;font-size:19px;font-weight:700;">{{event_label}}</h1>
    </div>
    <div style="padding:24px 28px;font-size:14px;line-height:1.65;color:#3d352e;">
      <p>{{activity_summary}}</p>
      <p style="font-size:13px;color:#6f645b;">Reference: {{order_number}} &bull; Contact {{support_email}} for partner assistance.</p>
    </div>
  </div>
</div>`,
      textContent: `Vendor Notice — {{event_label}}: {{activity_summary}} (Ref: {{order_number}})`,
      isDefaultForPurpose: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function readRawTemplates(filePath: string = TEMPLATES_DATA_PATH): EmailTemplate[] {
  const defaults = buildDefaultEmailTemplates();
  try {
    if (!fs.existsSync(filePath)) {
      writeAtomicJson(filePath, defaults);
      return defaults;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      writeAtomicJson(filePath, defaults);
      return defaults;
    }
    const existing = parsed as EmailTemplate[];
    const existingIds = new Set(existing.map((t) => t.id));
    const missingDefaults = defaults.filter((d) => !existingIds.has(d.id));
    if (missingDefaults.length > 0) {
      const merged = [...existing, ...missingDefaults];
      writeAtomicJson(filePath, merged);
      return merged;
    }
    return existing;
  } catch {
    return defaults;
  }
}

export function listEmailTemplates(filePath: string = TEMPLATES_DATA_PATH): EmailTemplate[] {
  return readRawTemplates(filePath).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getEmailTemplateById(
  id: string,
  filePath: string = TEMPLATES_DATA_PATH
): EmailTemplate | null {
  return readRawTemplates(filePath).find((t) => t.id === id) || null;
}

export function getDefaultTemplateForPurpose(
  purpose: EmailTemplatePurpose,
  filePath: string = TEMPLATES_DATA_PATH
): EmailTemplate | null {
  const all = readRawTemplates(filePath);
  return (
    all.find((t) => t.purpose === purpose && t.isDefaultForPurpose) ||
    all.find((t) => t.purpose === purpose) ||
    all[0] ||
    null
  );
}

export interface UpsertEmailTemplateInput {
  name: string;
  slug?: string;
  purpose: EmailTemplatePurpose;
  subject: string;
  previewText?: string;
  htmlContent: string;
  textContent?: string;
  isDefaultForPurpose?: boolean;
}

export function createEmailTemplate(
  input: UpsertEmailTemplateInput,
  filePath: string = TEMPLATES_DATA_PATH
): EmailTemplate {
  const all = readRawTemplates(filePath);
  const now = new Date().toISOString();
  const isDefault = Boolean(input.isDefaultForPurpose);
  const updatedAll = isDefault
    ? all.map((t) => (t.purpose === input.purpose ? { ...t, isDefaultForPurpose: false } : t))
    : [...all];

  const created: EmailTemplate = {
    id: `tpl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: input.name.trim(),
    slug: slugify(input.slug || input.name),
    purpose: input.purpose,
    subject: input.subject.trim(),
    previewText: input.previewText?.trim() || '',
    htmlContent: input.htmlContent,
    textContent: input.textContent || '',
    isDefaultForPurpose: isDefault,
    createdAt: now,
    updatedAt: now,
  };

  writeAtomicJson(filePath, [created, ...updatedAll]);
  return created;
}

export function updateEmailTemplate(
  id: string,
  updates: Partial<UpsertEmailTemplateInput>,
  filePath: string = TEMPLATES_DATA_PATH
): { success: boolean; template?: EmailTemplate; error?: string } {
  const all = readRawTemplates(filePath);
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return { success: false, error: 'Email template not found.' };

  const current = all[idx];
  const nextPurpose = updates.purpose || current.purpose;
  const makeDefault = updates.isDefaultForPurpose === true;

  const updatedList = all.map((t, i) => {
    if (makeDefault && i !== idx && t.purpose === nextPurpose) {
      return { ...t, isDefaultForPurpose: false };
    }
    return t;
  });

  const next: EmailTemplate = {
    ...current,
    name: updates.name !== undefined ? updates.name.trim() : current.name,
    slug: updates.slug !== undefined ? slugify(updates.slug) : current.slug,
    purpose: nextPurpose,
    subject: updates.subject !== undefined ? updates.subject.trim() : current.subject,
    previewText: updates.previewText !== undefined ? updates.previewText.trim() : current.previewText,
    htmlContent: updates.htmlContent !== undefined ? updates.htmlContent : current.htmlContent,
    textContent: updates.textContent !== undefined ? updates.textContent : current.textContent,
    isDefaultForPurpose:
      updates.isDefaultForPurpose !== undefined
        ? Boolean(updates.isDefaultForPurpose)
        : current.isDefaultForPurpose,
    updatedAt: new Date().toISOString(),
  };

  updatedList[idx] = next;
  writeAtomicJson(filePath, updatedList);
  return { success: true, template: next };
}

export function duplicateEmailTemplate(
  id: string,
  filePath: string = TEMPLATES_DATA_PATH
): { success: boolean; template?: EmailTemplate; error?: string } {
  const original = getEmailTemplateById(id, filePath);
  if (!original) return { success: false, error: 'Email template not found.' };
  const copy = createEmailTemplate(
    {
      name: `${original.name} (Copy)`,
      slug: `${original.slug}-copy-${Date.now().toString().slice(-4)}`,
      purpose: original.purpose,
      subject: original.subject,
      previewText: original.previewText,
      htmlContent: original.htmlContent,
      textContent: original.textContent,
      isDefaultForPurpose: false,
    },
    filePath
  );
  return { success: true, template: copy };
}

export function deleteEmailTemplate(
  id: string,
  filePath: string = TEMPLATES_DATA_PATH
): { success: boolean; error?: string } {
  const all = readRawTemplates(filePath);
  if (all.length <= 1) {
    return { success: false, error: 'At least one email template must remain in the system.' };
  }
  const filtered = all.filter((t) => t.id !== id);
  if (filtered.length === all.length) {
    return { success: false, error: 'Email template not found.' };
  }
  writeAtomicJson(filePath, filtered);
  return { success: true };
}

// ==============================================================================
// Email Campaigns CRUD & Real Dispatch
// ==============================================================================

function readRawCampaigns(filePath: string = CAMPAIGNS_DATA_PATH): EmailCampaign[] {
  try {
    ensureJsonFile(filePath, []);
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EmailCampaign[]) : [];
  } catch {
    return [];
  }
}

export function listEmailCampaigns(filePath: string = CAMPAIGNS_DATA_PATH): EmailCampaign[] {
  return readRawCampaigns(filePath).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getEmailCampaignById(
  id: string,
  filePath: string = CAMPAIGNS_DATA_PATH
): EmailCampaign | null {
  return readRawCampaigns(filePath).find((c) => c.id === id) || null;
}

export interface UpsertCampaignInput {
  name: string;
  subject: string;
  previewText?: string;
  templateId?: string | null;
  smtpConfigId?: string | null;
  senderName: string;
  senderEmail: string;
  replyToEmail?: string;
  htmlContent: string;
  textContent?: string;
  segment: CampaignRecipientSegment;
  selectedSubscriberIds?: string[];
  sourceFilter?: string;
}

export function createEmailCampaign(
  input: UpsertCampaignInput,
  opts?: { campaignsFilePath?: string; subscribersFilePath?: string }
): EmailCampaign {
  const cPath = opts?.campaignsFilePath || CAMPAIGNS_DATA_PATH;
  const all = readRawCampaigns(cPath);
  const now = new Date().toISOString();
  const { eligible, excludedCount } = resolveCampaignRecipients(
    {
      segment: input.segment,
      selectedSubscriberIds: input.selectedSubscriberIds,
      sourceFilter: input.sourceFilter,
    },
    opts?.subscribersFilePath
  );

  const created: EmailCampaign = {
    id: `cmp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: input.name.trim(),
    subject: input.subject.trim(),
    previewText: input.previewText?.trim() || '',
    templateId: input.templateId || null,
    smtpConfigId: input.smtpConfigId || null,
    senderName: input.senderName.trim(),
    senderEmail: input.senderEmail.trim(),
    replyToEmail: input.replyToEmail?.trim() || input.senderEmail.trim(),
    htmlContent: input.htmlContent,
    textContent: input.textContent || '',
    segment: input.segment,
    selectedSubscriberIds: input.selectedSubscriberIds || [],
    sourceFilter: input.sourceFilter || '',
    status: 'DRAFT',
    eligibleCount: eligible.length,
    sentCount: 0,
    failedCount: 0,
    skippedCount: excludedCount,
    lastError: null,
    sentAt: null,
    createdAt: now,
    updatedAt: now,
  };

  writeAtomicJson(cPath, [created, ...all]);
  return created;
}

export function updateEmailCampaign(
  id: string,
  updates: Partial<UpsertCampaignInput>,
  opts?: { campaignsFilePath?: string; subscribersFilePath?: string }
): { success: boolean; campaign?: EmailCampaign; error?: string } {
  const cPath = opts?.campaignsFilePath || CAMPAIGNS_DATA_PATH;
  const all = readRawCampaigns(cPath);
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return { success: false, error: 'Campaign not found.' };

  const current = all[idx];
  const segment = updates.segment || current.segment;
  const selectedSubscriberIds =
    updates.selectedSubscriberIds !== undefined
      ? updates.selectedSubscriberIds
      : current.selectedSubscriberIds;
  const sourceFilter =
    updates.sourceFilter !== undefined ? updates.sourceFilter : current.sourceFilter;

  const { eligible, excludedCount } = resolveCampaignRecipients(
    { segment, selectedSubscriberIds, sourceFilter },
    opts?.subscribersFilePath
  );

  const next: EmailCampaign = {
    ...current,
    name: updates.name !== undefined ? updates.name.trim() : current.name,
    subject: updates.subject !== undefined ? updates.subject.trim() : current.subject,
    previewText: updates.previewText !== undefined ? updates.previewText.trim() : current.previewText,
    templateId: updates.templateId !== undefined ? updates.templateId : current.templateId,
    smtpConfigId: updates.smtpConfigId !== undefined ? updates.smtpConfigId : current.smtpConfigId,
    senderName: updates.senderName !== undefined ? updates.senderName.trim() : current.senderName,
    senderEmail: updates.senderEmail !== undefined ? updates.senderEmail.trim() : current.senderEmail,
    replyToEmail: updates.replyToEmail !== undefined ? updates.replyToEmail.trim() : current.replyToEmail,
    htmlContent: updates.htmlContent !== undefined ? updates.htmlContent : current.htmlContent,
    textContent: updates.textContent !== undefined ? updates.textContent : current.textContent,
    segment,
    selectedSubscriberIds,
    sourceFilter,
    eligibleCount: current.status === 'DRAFT' ? eligible.length : current.eligibleCount,
    skippedCount: current.status === 'DRAFT' ? excludedCount : current.skippedCount,
    updatedAt: new Date().toISOString(),
  };

  all[idx] = next;
  writeAtomicJson(cPath, all);
  return { success: true, campaign: next };
}

export function duplicateEmailCampaign(
  id: string,
  opts?: { campaignsFilePath?: string; subscribersFilePath?: string }
): { success: boolean; campaign?: EmailCampaign; error?: string } {
  const cPath = opts?.campaignsFilePath || CAMPAIGNS_DATA_PATH;
  const original = getEmailCampaignById(id, cPath);
  if (!original) return { success: false, error: 'Campaign not found.' };
  const copy = createEmailCampaign(
    {
      name: `${original.name} (Copy)`,
      subject: original.subject,
      previewText: original.previewText,
      templateId: original.templateId,
      smtpConfigId: original.smtpConfigId,
      senderName: original.senderName,
      senderEmail: original.senderEmail,
      replyToEmail: original.replyToEmail,
      htmlContent: original.htmlContent,
      textContent: original.textContent,
      segment: original.segment,
      selectedSubscriberIds: original.selectedSubscriberIds,
      sourceFilter: original.sourceFilter,
    },
    opts
  );
  return { success: true, campaign: copy };
}

export function deleteEmailCampaign(
  id: string,
  filePath: string = CAMPAIGNS_DATA_PATH
): { success: boolean; error?: string } {
  const all = readRawCampaigns(filePath);
  const filtered = all.filter((c) => c.id !== id);
  if (filtered.length === all.length) {
    return { success: false, error: 'Campaign not found.' };
  }
  writeAtomicJson(filePath, filtered);
  return { success: true };
}

export async function dispatchEmailCampaign(params: {
  campaignId: string;
  mode: 'test' | 'send';
  testEmail?: string;
  campaignsFilePath?: string;
  subscribersFilePath?: string;
  smtpFilePath?: string;
  logsFilePath?: string;
}): Promise<{
  success: boolean;
  campaign?: EmailCampaign;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  error?: string;
}> {
  const cPath = params.campaignsFilePath || CAMPAIGNS_DATA_PATH;
  const all = readRawCampaigns(cPath);
  const idx = all.findIndex((c) => c.id === params.campaignId);
  if (idx === -1) {
    return { success: false, sentCount: 0, failedCount: 0, skippedCount: 0, error: 'Campaign not found.' };
  }
  const campaign = all[idx];

  if (params.mode === 'test') {
    const targetEmail = (params.testEmail || '').trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      return { success: false, sentCount: 0, failedCount: 0, skippedCount: 0, error: 'Valid test email is required.' };
    }
    const rendered = renderEmailVariables(
      {
        subject: `[TEST] ${campaign.subject}`,
        htmlContent: campaign.htmlContent,
        textContent: campaign.textContent,
      },
      {
        subscriberName: 'InfiniCharm Admin Preview',
        subscriberEmail: targetEmail,
        campaignTitle: campaign.name,
        unsubscribeToken: 'preview-token',
      },
      { requireUnsubscribeLink: true }
    );
    const res = await sendEmailViaConfiguredProvider({
      toEmail: targetEmail,
      toName: 'Admin Test Recipient',
      subject: rendered.subject,
      htmlContent: rendered.htmlContent,
      textContent: rendered.textContent,
      type: 'TEST',
      smtpConfigId: campaign.smtpConfigId,
      senderNameOverride: campaign.senderName,
      senderEmailOverride: campaign.senderEmail,
      replyToOverride: campaign.replyToEmail,
      campaignId: campaign.id,
      campaignName: campaign.name,
      smtpFilePath: params.smtpFilePath,
      logsFilePath: params.logsFilePath,
    });
    return {
      success: res.success,
      campaign,
      sentCount: res.success ? 1 : 0,
      failedCount: res.success ? 0 : 1,
      skippedCount: 0,
      error: res.error,
    };
  }

  // Real marketing dispatch — strictly resolves ACTIVE subscribers only
  const { eligible, excludedCount } = resolveCampaignRecipients(
    {
      segment: campaign.segment,
      selectedSubscriberIds: campaign.selectedSubscriberIds,
      sourceFilter: campaign.sourceFilter,
    },
    params.subscribersFilePath
  );

  if (eligible.length === 0) {
    return {
      success: false,
      campaign,
      sentCount: 0,
      failedCount: 0,
      skippedCount: excludedCount,
      error: 'No eligible ACTIVE subscribers match this segment. Unsubscribed, bounced, and suppressed contacts are automatically excluded.',
    };
  }

  let sentCount = 0;
  let failedCount = 0;
  let lastError: string | null = null;
  const deliveredAt = new Date().toISOString();

  for (const sub of eligible) {
    const unsubUrl = buildUnsubscribeUrl(sub.unsubscribeToken);
    const rendered = renderEmailVariables(
      {
        subject: campaign.subject,
        htmlContent: campaign.htmlContent,
        textContent: campaign.textContent,
      },
      {
        subscriberName: sub.fullName,
        subscriberEmail: sub.email,
        campaignTitle: campaign.name,
        unsubscribeToken: sub.unsubscribeToken,
        unsubscribeUrl: unsubUrl,
      },
      { requireUnsubscribeLink: true }
    );

    const res = await sendEmailViaConfiguredProvider({
      toEmail: sub.email,
      toName: sub.fullName,
      subject: rendered.subject,
      htmlContent: rendered.htmlContent,
      textContent: rendered.textContent,
      type: 'CAMPAIGN',
      smtpConfigId: campaign.smtpConfigId,
      senderNameOverride: campaign.senderName,
      senderEmailOverride: campaign.senderEmail,
      replyToOverride: campaign.replyToEmail,
      campaignId: campaign.id,
      campaignName: campaign.name,
      subscriberId: sub.id,
      unsubscribeUrl: unsubUrl,
      smtpFilePath: params.smtpFilePath,
      logsFilePath: params.logsFilePath,
    });

    if (res.success) {
      sentCount += 1;
      markSubscriberCampaignDelivered(sub.id, deliveredAt, params.subscribersFilePath);
    } else {
      failedCount += 1;
      lastError = res.error || 'Delivery error';
    }
  }

  const finalStatus: EmailCampaign['status'] =
    failedCount === 0 ? 'SENT' : sentCount === 0 ? 'FAILED' : 'PARTIAL';

  const updated: EmailCampaign = {
    ...campaign,
    status: finalStatus,
    eligibleCount: eligible.length,
    sentCount,
    failedCount,
    skippedCount: excludedCount,
    lastError,
    sentAt: sentCount > 0 ? deliveredAt : campaign.sentAt,
    updatedAt: new Date().toISOString(),
  };

  all[idx] = updated;
  writeAtomicJson(cPath, all);

  return {
    success: sentCount > 0,
    campaign: updated,
    sentCount,
    failedCount,
    skippedCount: excludedCount,
    error: sentCount === 0 ? lastError || 'All deliveries failed.' : undefined,
  };
}

export async function sendWelcomeEmailToSubscriber(
  subscriber: NewsletterSubscriber,
  opts?: {
    templatesFilePath?: string;
    smtpFilePath?: string;
    logsFilePath?: string;
  }
): Promise<{ attempted: boolean; sent: boolean; error?: string }> {
  const widgetSettings = getNewsletterWidgetSettings();
  if (!widgetSettings.sendWelcomeEmail) {
    return { attempted: false, sent: false };
  }

  const template =
    (widgetSettings.welcomeTemplateId
      ? getEmailTemplateById(widgetSettings.welcomeTemplateId, opts?.templatesFilePath)
      : null) || getDefaultTemplateForPurpose('WELCOME', opts?.templatesFilePath);

  if (!template) {
    return { attempted: false, sent: false };
  }

  const unsubUrl = buildUnsubscribeUrl(subscriber.unsubscribeToken);
  const rendered = renderEmailVariables(
    {
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent,
    },
    {
      subscriberName: subscriber.fullName,
      subscriberEmail: subscriber.email,
      campaignTitle: 'Welcome to the InfiniCharm Circle',
      unsubscribeToken: subscriber.unsubscribeToken,
      unsubscribeUrl: unsubUrl,
    },
    { requireUnsubscribeLink: true }
  );

  const res = await sendEmailViaConfiguredProvider({
    toEmail: subscriber.email,
    toName: subscriber.fullName,
    subject: rendered.subject,
    htmlContent: rendered.htmlContent,
    textContent: rendered.textContent,
    type: 'WELCOME',
    subscriberId: subscriber.id,
    unsubscribeUrl: unsubUrl,
    smtpFilePath: opts?.smtpFilePath,
    logsFilePath: opts?.logsFilePath,
  });

  return { attempted: true, sent: res.success, error: res.error };
}
