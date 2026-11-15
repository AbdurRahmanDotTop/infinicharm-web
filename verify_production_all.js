import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/abdur/.gemini/antigravity/brain/ce2a0e6d-268f-4b78-838d-1a590251f115';
const BASE_URL = 'https://infinicharm.com';

const VIEWPORTS = [
  { name: 'Mobile Mini', width: 320, height: 600 },
  { name: 'Mobile Standard', width: 375, height: 667 },
  { name: 'Mobile Large', width: 414, height: 896 },
  { name: 'Tablet Portrait', width: 768, height: 1024 },
  { name: 'Tablet Landscape', width: 1024, height: 768 },
  { name: 'Desktop HD', width: 1280, height: 800 },
  { name: 'Desktop WXGA', width: 1366, height: 768 },
  { name: 'Desktop FHD', width: 1440, height: 900 },
  { name: 'Desktop 1080p', width: 1920, height: 1080 },
  { name: 'Desktop QHD / 4K', width: 2560, height: 1440 },
];

async function run() {
  console.log('--- Starting Comprehensive Production Verification on https://infinicharm.com ---');
  const browser = await chromium.launch({ headless: true });

  const results = {
    contactPage: false,
    contactApi: false,
    loginActiveSession: false,
    registerActiveSession: false,
    trackOrderOwner: false,
    accountOverview: false,
    accountOrders: false,
    orderDetailsPage: false,
    paymentPage: false,
    adminOrdersPaymentNotReceived: false,
    adminCmsContact: false,
    viewportAudits: [],
  };

  try {
    const context = await browser.newContext();

    // 1. Verify Public Contact Page & API
    console.log('\n1. Checking Public Contact Page & API...');
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/contact`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    
    // Check official phone number in DOM
    const contactText = await page.content();
    const hasPhone = contactText.includes('8825164657');
    const telLink = await page.$('a[href^="tel:"]');
    const telHref = telLink ? await telLink.getAttribute('href') : null;

    console.log(`Contact page phone visible: ${hasPhone}, tel link: ${telHref}`);
    if (hasPhone && (telHref === 'tel:+918825164657' || telHref === 'tel:+91 8825164657')) {
      results.contactPage = true;
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'prod_contact_page.png'), fullPage: false });

    // Check contact settings API
    const apiRes = await context.request.get(`${BASE_URL}/api/contact/settings`);
    if (apiRes.ok()) {
      const data = await apiRes.json();
      console.log('Contact API response:', data.success, data.settings?.primaryPhone);
      if (data.success && data.settings?.primaryPhone === '+91 8825164657') {
        results.contactApi = true;
      }
    }

    // 2. Setup Authenticated Customer Session
    console.log('\n2. Testing Authenticated Customer Session & Login Interceptor...');
    const customerCookie = {
      name: 'infinicharm_customer_session',
      value: 'active',
      domain: 'infinicharm.com',
      path: '/',
    };
    const customerIdCookie = {
      name: 'infinicharm_customer_id',
      value: 'cust-abdur',
      domain: 'infinicharm.com',
      path: '/',
    };
    const customerDataCookie = {
      name: 'infinicharm_customer_data',
      value: encodeURIComponent(JSON.stringify({
        id: 'cust-abdur',
        email: 'abdurrahmanibnghufran@gmail.com',
        fullName: 'AbdurRahman',
        name: 'AbdurRahman',
        phone: '8825164657',
        status: 'ACTIVE',
        emailVerified: true,
      })),
      domain: 'infinicharm.com',
      path: '/',
    };
    await context.addCookies([customerCookie, customerIdCookie, customerDataCookie]);

    // Test /login with redirect
    await page.goto(`${BASE_URL}/login?redirect=%2Ftrack-order%3Fid%3DINF-202611-2527`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const loginContent = await page.content();
    const hasActiveCard = loginContent.includes('Already Signed In') || loginContent.includes('Signed in as') || loginContent.includes('Continue to');
    console.log(`Login active session banner displayed: ${hasActiveCard}`);
    if (hasActiveCard) {
      results.loginActiveSession = true;
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'prod_login_active_session.png'), fullPage: false });

    // Test /register while authenticated
    await page.goto(`${BASE_URL}/register`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const regContent = await page.content();
    const hasRegActiveCard = regContent.includes('Already Signed In') || regContent.includes('Signed in as');
    console.log(`Register active session banner displayed: ${hasRegActiveCard}`);
    if (hasRegActiveCard) {
      results.registerActiveSession = true;
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'prod_register_active_session.png'), fullPage: false });

    // 3. Test Track Order as authenticated owner
    console.log('\n3. Testing Track Order with Authenticated Owner...');
    await page.goto(`${BASE_URL}/track-order?id=INF-202611-2527`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const trackContent = await page.content();
    const hasOrderRef = trackContent.includes('INF-202611-2527');
    console.log(`Track order displays order reference INF-202611-2527: ${hasOrderRef}`);
    if (hasOrderRef) {
      results.trackOrderOwner = true;
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'prod_track_order_owner.png'), fullPage: false });

    // 4. Test Customer Account Overview
    console.log('\n4. Testing Account Overview (/account)...');
    await page.goto(`${BASE_URL}/account`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const accountContent = await page.content();
    const hasAccOrder = accountContent.includes('INF-202611-2527');
    const hasRetryButton = accountContent.includes('Retry Payment') || accountContent.includes('Pay Now') || accountContent.includes('Track Package');
    console.log(`Account overview order found: ${hasAccOrder}, retry/track available: ${hasRetryButton}`);
    if (hasAccOrder) {
      results.accountOverview = true;
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'prod_account_overview.png'), fullPage: false });

    // 5. Test Customer Order History (/account/orders)
    console.log('\n5. Testing Account Orders History (/account/orders)...');
    await page.goto(`${BASE_URL}/account/orders`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const ordersHistoryContent = await page.content();
    const hasOrdersHistoryOrder = ordersHistoryContent.includes('INF-202611-2527');
    const hasHistoryRetry = ordersHistoryContent.includes('Retry Payment') || ordersHistoryContent.includes('Pay Now') || ordersHistoryContent.includes('Track Consignment');
    console.log(`Order history order found: ${hasOrdersHistoryOrder}, retry button/link: ${hasHistoryRetry}`);
    if (hasOrdersHistoryOrder) {
      results.accountOrders = true;
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'prod_account_orders.png'), fullPage: false });

    // 6. Test Dedicated Customer Order Details Page (/account/orders/INF-202611-2527)
    console.log('\n6. Testing Dedicated Order Details (/account/orders/INF-202611-2527)...');
    await page.goto(`${BASE_URL}/account/orders/INF-202611-2527`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const detailsContent = await page.content();
    const hasDetailsOrder = detailsContent.includes('INF-202611-2527');
    const hasItems = detailsContent.includes('360.00') || detailsContent.includes('300.00') || detailsContent.includes('Takmeeli Talbeena');
    console.log(`Order details page loaded with order INF-202611-2527: ${hasDetailsOrder}, content/items visible: ${hasItems}`);
    if (hasDetailsOrder) {
      results.orderDetailsPage = true;
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'prod_order_details.png'), fullPage: false });

    // 7. Test Payment Page (/pay/INF-202611-2527)
    console.log('\n7. Testing Payment Page (/pay/INF-202611-2527)...');
    await page.goto(`${BASE_URL}/pay/INF-202611-2527`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const payContent = await page.content();
    const hasPayOrder = payContent.includes('INF-202611-2527');
    const hasPayAmount = payContent.includes('360.00');
    console.log(`Payment page loaded with order INF-202611-2527: ${hasPayOrder}, amount ₹360: ${hasPayAmount}`);
    if (hasPayOrder && hasPayAmount) {
      results.paymentPage = true;
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'prod_pay_page.png'), fullPage: false });

    // 8. Test Admin Orders & PAYMENT_NOT_RECEIVED Status
    console.log('\n8. Testing Admin Orders & PAYMENT_NOT_RECEIVED Status...');
    const adminCookie = {
      name: 'infinicharm_admin_session',
      value: 'active',
      domain: 'infinicharm.com',
      path: '/',
    };
    await context.addCookies([adminCookie]);

    await page.goto(`${BASE_URL}/admin/orders`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const adminContent = await page.content();
    const hasPaymentNotReceivedOption = adminContent.includes('PAYMENT_NOT_RECEIVED');
    console.log(`Admin orders page includes PAYMENT_NOT_RECEIVED status option: ${hasPaymentNotReceivedOption}`);
    if (hasPaymentNotReceivedOption) {
      results.adminOrdersPaymentNotReceived = true;
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'prod_admin_orders.png'), fullPage: false });

    // 9. Test Admin CMS Contact Page Management
    console.log('\n9. Testing Admin CMS Contact Settings Tab...');
    await page.goto(`${BASE_URL}/admin/cms`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    // Click on Contact tab if available
    const contactTab = await page.$('button:has-text("Public Contact Page")');
    if (contactTab) {
      await contactTab.click();
      await page.waitForTimeout(1000);
    }
    const cmsContent = await page.content();
    const hasCmsPhone = cmsContent.includes('8825164657');
    console.log(`Admin CMS contact tab loaded with phone 8825164657: ${hasCmsPhone}`);
    if (hasCmsPhone) {
      results.adminCmsContact = true;
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'prod_admin_cms_contact.png'), fullPage: false });

    // 10. Perform 10-Viewport Responsive & Horizontal Overflow Audit
    console.log('\n10. Auditing 10 Viewports for 0px Horizontal Overflow...');
    const auditPages = [
      { name: 'Contact Page', path: '/contact' },
      { name: 'Order Details Page', path: '/account/orders/INF-202611-2527' },
      { name: 'Account Orders History', path: '/account/orders' },
      { name: 'Pay Page', path: '/pay/INF-202611-2527' },
      { name: 'Login Page', path: '/login?redirect=%2Faccount' },
    ];

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      let vpPassed = true;
      for (const ap of auditPages) {
        await page.goto(`${BASE_URL}${ap.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(500);
        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          const body = document.body;
          const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
          const innerWidth = window.innerWidth;
          return {
            scrollWidth,
            innerWidth,
            hasOverflow: scrollWidth > innerWidth + 1, // 1px tolerance for subpixel antialiasing
          };
        });

        if (overflow.hasOverflow) {
          console.warn(`[OVERFLOW] ${vp.name} (${vp.width}x${vp.height}) on ${ap.name}: scrollWidth=${overflow.scrollWidth}, innerWidth=${overflow.innerWidth}`);
          vpPassed = false;
        }
      }
      results.viewportAudits.push({ viewport: vp.name, width: vp.width, passed: vpPassed });
      console.log(`Viewport ${vp.name} (${vp.width}px): ${vpPassed ? 'PASSED (0px overflow)' : 'FAILED'}`);
    }

    console.log('\n--- Production Verification Summary ---');
    console.log(JSON.stringify(results, null, 2));

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await browser.close();
  }
}

run();
