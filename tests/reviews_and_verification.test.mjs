// ==============================================================================
// InfiniCharm — Product Reviews & Ratings Verification Suite
// Standards: Purchase Verification, Real Data, Server Authority, 10 Viewports
// ==============================================================================

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const VIEWPORTS = [
  { name: 'Compact Mobile', width: 320, height: 600 },
  { name: 'Standard Mobile', width: 375, height: 667 },
  { name: 'Modern iPhone', width: 390, height: 844 },
  { name: 'Large Mobile', width: 480, height: 854 },
  { name: 'Tablet Portrait', width: 768, height: 1024 },
  { name: 'Tablet Landscape', width: 1024, height: 768 },
  { name: 'Standard Desktop', width: 1280, height: 800 },
  { name: 'Widescreen Desktop', width: 1440, height: 900 },
  { name: 'Full HD Desktop', width: 1920, height: 1080 },
  { name: '2K QHD Display', width: 2560, height: 1440 },
];

const REVIEWS_FILE = path.join(process.cwd(), 'src', 'data', 'reviews.json');
const ORDERS_FILE = path.join(process.cwd(), 'src', 'data', 'orders.json');

async function runReviewVerificationSuite() {
  console.log('🚀 Starting InfiniCharm Product Reviews & Ratings Verification Suite...\n');

  let passedTests = 0;
  let failedTests = 0;
  const failureDetails = [];

  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  // Backup original files
  const originalReviews = fs.existsSync(REVIEWS_FILE) ? fs.readFileSync(REVIEWS_FILE, 'utf8') : '[]';
  const originalOrders = fs.existsSync(ORDERS_FILE) ? fs.readFileSync(ORDERS_FILE, 'utf8') : '[]';

  try {
    // Clean reviews initially
    fs.writeFileSync(REVIEWS_FILE, '[]', 'utf8');

    // ==============================================================================
    // 1. Unauthenticated / Guest Protection
    // ==============================================================================
    console.log('--- 1. Guest & Unauthenticated Access Protection ---');
    try {
      const guestContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const guestPage = await guestContext.newPage();

      // Go to PDP
      await guestPage.goto(`${BASE_URL}/product/100-kashmiri-honey`, { waitUntil: 'domcontentloaded' });
      await guestPage.waitForTimeout(600);

      // Switch to reviews tab
      const reviewsTab = guestPage.locator('button:has-text("Customer Reviews")');
      await reviewsTab.click();
      await guestPage.waitForTimeout(400);

      // Verify "Sign In to Review" button is presented
      const signInBtn = guestPage.locator('a:has-text("Sign In to Review")');
      if ((await signInBtn.count()) === 0) {
        throw new Error('Guest page did not render "Sign In to Review" call to action!');
      }

      // Verify Direct API Submission without auth returns HTTP 401
      const directApiRes = await guestPage.request.post(`${BASE_URL}/api/reviews`, {
        data: {
          productId: 'S-01-P-01',
          rating: 5,
          comment: 'Hacked review attempt from unauthenticated guest.',
        },
      });

      if (directApiRes.status() !== 401) {
        throw new Error(`Expected HTTP 401 from unauthenticated POST /api/reviews, got: ${directApiRes.status()}`);
      }
      const apiJson = await directApiRes.json();
      if (!apiJson.error || !apiJson.error.includes('Authentication required')) {
        throw new Error(`Unexpected 401 message: ${JSON.stringify(apiJson)}`);
      }

      await guestContext.close();
      passedTests++;
      console.log('  ✓ Guest protection verified: "Sign In to Review" rendered & direct API rejects with HTTP 401.');
    } catch (err) {
      failedTests++;
      failureDetails.push({ test: 'Guest Protection', error: err.message });
      console.error('  ✗ Guest protection failed:', err.message);
    }

    // ==============================================================================
    // 2. Logged-in Customer WITHOUT Verified Purchase
    // ==============================================================================
    console.log('\n--- 2. Logged-in Customer Without Purchase Protection ---');
    try {
      const custContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await custContext.addCookies([
        { name: 'infinicharm_customer_session', value: 'active', domain: 'localhost', path: '/' },
        { name: 'infinicharm_customer_id', value: 'cust-02', domain: 'localhost', path: '/' }, // Ramesh Kumar (0 orders)
      ]);
      const custPage = await custContext.newPage();

      await custPage.goto(`${BASE_URL}/product/100-kashmiri-honey`, { waitUntil: 'domcontentloaded' });
      await custPage.waitForTimeout(600);

      // Switch to reviews tab
      await custPage.click('button:has-text("Customer Reviews")');
      await custPage.waitForTimeout(500);

      // Verify "Purchase Required to Review" badge
      const purchaseReqBadge = custPage.locator('text=Purchase Required to Review');
      if ((await purchaseReqBadge.count()) === 0) {
        throw new Error('Logged-in non-purchaser did not see "Purchase Required to Review" indicator!');
      }

      // Verify Direct API Submission without verified purchase returns HTTP 403
      const directApiRes = await custPage.request.post(`${BASE_URL}/api/reviews`, {
        data: {
          productId: 'S-01-P-01',
          rating: 5,
          comment: 'Attempting to review product without purchasing it first.',
        },
      });

      if (directApiRes.status() !== 403) {
        throw new Error(`Expected HTTP 403 for unpurchased item, got: ${directApiRes.status()}`);
      }
      const apiJson = await directApiRes.json();
      if (!apiJson.error || (!apiJson.error.includes('purchased') && !apiJson.error.includes('verification'))) {
        throw new Error(`Unexpected 403 message: ${JSON.stringify(apiJson)}`);
      }

      await custContext.close();
      passedTests++;
      console.log('  ✓ Non-purchaser protection verified: "Purchase Required" badge displayed & direct API rejects with HTTP 403.');
    } catch (err) {
      failedTests++;
      failureDetails.push({ test: 'Non-Purchaser Protection', error: err.message });
      console.error('  ✗ Non-purchaser protection failed:', err.message);
    }

    // ==============================================================================
    // 3. Verified Purchaser Review Submission
    // ==============================================================================
    console.log('\n--- 3. Verified Purchaser Review Submission & Dynamic Rating ---');
    const testOrderId = 'ord-test-verified-review';
    const testOrderNumber = 'INF-202611-8844';
    const testCustomerId = 'cust-01'; // AbdurRahman Ibn Ghufran (customer@infinicharm.com)

    try {
      // Seed a DELIVERED order for cust-01 containing Kashmiri Honey
      const orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
      const verifiedDeliveredOrder = {
        id: testOrderId,
        orderNumber: testOrderNumber,
        customerId: testCustomerId,
        customerEmail: 'customer@infinicharm.com',
        customerPhone: '8825164657',
        status: 'DELIVERED',
        subtotalInPaise: 240000,
        discountInPaise: 0,
        shippingInPaise: 0,
        taxInPaise: 0,
        totalInPaise: 240000,
        paymentMethod: 'CUSTOM_UPI',
        paymentStatus: 'PAID',
        manualApprovalStatus: 'APPROVED',
        utrNumber: '982134567890',
        shippingAddress: {
          id: 'addr-test',
          fullName: 'AbdurRahman Ibn Ghufran',
          phone: '8825164657',
          addressLine1: 'Patahi, East Champaran',
          city: 'Motihari',
          state: 'Bihar',
          postalCode: '845427',
          country: 'India',
        },
        billingAddress: {
          id: 'addr-test',
          fullName: 'AbdurRahman Ibn Ghufran',
          phone: '8825164657',
          addressLine1: 'Patahi, East Champaran',
          city: 'Motihari',
          state: 'Bihar',
          postalCode: '845427',
          country: 'India',
        },
        items: [
          {
            id: 'item-test-honey',
            orderId: testOrderNumber,
            productId: 'S-01-P-01',
            variantId: 'var-S-01-P-01-01',
            productTitle: '100% Kashmiri Honey – Pure Taste & Natural Sweetness',
            variantTitle: 'Standard Pack',
            sku: 'S-01-P-01',
            priceInPaise: 240000,
            quantity: 1,
            totalInPaise: 240000,
          },
        ],
        timeline: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      orders.unshift(verifiedDeliveredOrder);
      fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');

      // Authenticate as cust-01
      const purchaserContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await purchaserContext.addCookies([
        { name: 'infinicharm_customer_session', value: 'active', domain: 'localhost', path: '/' },
        { name: 'infinicharm_customer_id', value: testCustomerId, domain: 'localhost', path: '/' },
      ]);
      const purchaserPage = await purchaserContext.newPage();

      await purchaserPage.goto(`${BASE_URL}/product/100-kashmiri-honey`, { waitUntil: 'domcontentloaded' });
      await purchaserPage.waitForTimeout(600);

      // Switch to reviews tab
      await purchaserPage.click('button:has-text("Customer Reviews")');
      await purchaserPage.waitForTimeout(500);

      // Verify "Verified Purchaser" banner with Order number
      await purchaserPage.waitForSelector(`text=Verified Purchaser • Order #${testOrderNumber}`, { timeout: 6000 });

      // Click "Write a Review"
      const writeReviewBtn = purchaserPage.locator('button:has-text("Write a Review")');
      await writeReviewBtn.click();
      await purchaserPage.waitForSelector('[role="dialog"], form:has-text("Your Rating")', { timeout: 5000 });

      // Fill in rating (5 stars), title, and comment
      await purchaserPage.fill(
        'input[placeholder*="Pure wild raw honey"]',
        'Exceptional Kashmiri Honey with Pristine Floral Aroma'
      );
      await purchaserPage.fill(
        'textarea[placeholder*="Describe the aroma"]',
        'Delivered promptly in sturdy food-grade packaging. Truly single-origin harvest with zero synthetic crystallization.'
      );

      // Click Submit Review
      await purchaserPage.click('button:has-text("Submit Review")');
      await purchaserPage.waitForTimeout(1000);

      // Verify success message / review rendered on PDP
      await purchaserPage.waitForSelector('text=Verified Buyer', { timeout: 6000 });
      await purchaserPage.waitForSelector('text=Exceptional Kashmiri Honey with Pristine Floral Aroma', {
        timeout: 6000,
      });

      // Verify header rating calculation
      const headerRating = purchaserPage.locator('text=5.0 • 1 review');
      if ((await headerRating.count()) === 0) {
        throw new Error('PDP header rating did not dynamically update to 5.0 • 1 review!');
      }

      await purchaserContext.close();
      passedTests++;
      console.log('  ✓ Verified purchase review submitted: Order linkage confirmed, rendered with Verified Buyer badge, and rating updated to 5.0 (1 review).');
    } catch (err) {
      failedTests++;
      failureDetails.push({ test: 'Verified Review Submission', error: err.message });
      console.error('  ✗ Verified review submission failed:', err.message);
    }

    // ==============================================================================
    // 4. Admin Panel Management (/admin/reviews)
    // ==============================================================================
    console.log('\n--- 4. Admin Panel Management & Moderation Lifecycle ---');
    try {
      const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await adminContext.addCookies([
        { name: 'infinicharm_admin_session', value: 'active', domain: 'localhost', path: '/' },
      ]);
      const adminPage = await adminContext.newPage();

      await adminPage.goto(`${BASE_URL}/admin/reviews`, { waitUntil: 'domcontentloaded' });
      await adminPage.waitForTimeout(600);

      // Verify Metrics Cards
      await adminPage.waitForSelector('h1:has-text("Review Moderation Queue")', { timeout: 6000 });
      const approvedMetric = adminPage.locator('span:has-text("1")');
      if ((await approvedMetric.count()) === 0) {
        throw new Error('Admin reviews metrics did not show approved count 1');
      }

      // Verify Order Link in review card
      await adminPage.waitForSelector(`text=#${testOrderNumber}`, { timeout: 6000 });

      // Add Official Brand Reply
      await adminPage.click('button:has-text("Add Official Reply")');
      await adminPage.waitForTimeout(300);
      await adminPage.fill(
        'textarea[placeholder*="Type response displayed publicly"]',
        'Thank you AbdurRahman! Harvested directly from our alpine apiaries in Kashmir.'
      );
      await adminPage.click('button:has-text("Publish Reply")');
      await adminPage.waitForTimeout(800);

      // Verify reply appears in Admin
      await adminPage.waitForSelector('text=Official Brand Response:', { timeout: 5000 });
      await adminPage.waitForSelector('text=Harvested directly from our alpine apiaries in Kashmir.', {
        timeout: 5000,
      });

      // Test Hide Action
      await adminPage.click('button:has-text("Hide")');
      await adminPage.waitForTimeout(800);

      // Verify review marked as HIDDEN
      await adminPage.waitForSelector('span:has-text("HIDDEN")', { timeout: 5000 });

      // Check Storefront PDP to confirm hidden review is omitted from public display
      const checkPage = await adminContext.newPage();
      await checkPage.goto(`${BASE_URL}/product/100-kashmiri-honey`, { waitUntil: 'domcontentloaded' });
      await checkPage.waitForTimeout(600);
      await checkPage.click('button:has-text("Customer Reviews")');
      await checkPage.waitForTimeout(400);

      // Since the review was hidden, storefront must show "No Customer Reviews Yet"
      const emptyCheck = checkPage.locator('text=No Customer Reviews Yet');
      if ((await emptyCheck.count()) === 0) {
        throw new Error('Storefront still displayed review after Admin marked it HIDDEN!');
      }
      await checkPage.close();

      // In Admin, Unhide & Publish
      await adminPage.bringToFront();
      await adminPage.click('button:has-text("Unhide & Publish")');
      await adminPage.waitForTimeout(800);
      await adminPage.waitForSelector('span:has-text("APPROVED")', { timeout: 5000 });

      // In Admin, Delete Review
      adminPage.on('dialog', async (dialog) => {
        await dialog.accept();
      });
      await adminPage.click('button[aria-label="Delete review"]');
      await adminPage.waitForTimeout(800);

      // Verify empty queue
      await adminPage.waitForSelector('text=No Customer Reviews Yet', { timeout: 5000 });

      await adminContext.close();
      passedTests++;
      console.log('  ✓ Admin moderation lifecycle verified: Brand reply published, Hide toggle synchronized with storefront, and permanent deletion executed.');
    } catch (err) {
      failedTests++;
      failureDetails.push({ test: 'Admin Review Management', error: err.message });
      console.error('  ✗ Admin review management failed:', err.message);
    }

    // ==============================================================================
    // 5. 10-Viewport Responsiveness (320px to 2560px)
    // ==============================================================================
    console.log('\n--- 5. 10-Viewport Responsiveness & 0px Overflow ---');
    for (const vp of VIEWPORTS) {
      try {
        const vpContext = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
        });
        await vpContext.addCookies([
          { name: 'infinicharm_admin_session', value: 'active', domain: 'localhost', path: '/' },
        ]);
        const vpPage = await vpContext.newPage();

        // 1. Check PDP
        await vpPage.goto(`${BASE_URL}/product/100-kashmiri-honey`, { waitUntil: 'domcontentloaded' });
        await vpPage.waitForTimeout(300);
        const pdpOverflow = await vpPage.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        if (pdpOverflow) {
          throw new Error(`Horizontal overflow on PDP at ${vp.width}x${vp.height}`);
        }

        // 2. Check Admin Reviews
        await vpPage.goto(`${BASE_URL}/admin/reviews`, { waitUntil: 'domcontentloaded' });
        await vpPage.waitForTimeout(300);
        const adminOverflow = await vpPage.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        if (adminOverflow) {
          throw new Error(`Horizontal overflow on /admin/reviews at ${vp.width}x${vp.height}`);
        }

        await vpContext.close();
        passedTests++;
        console.log(`  ✓ ${vp.name.padEnd(20)} (${vp.width}x${vp.height}): Zero overflow.`);
      } catch (err) {
        failedTests++;
        failureDetails.push({ test: `Viewport ${vp.name}`, error: err.message });
        console.error(`  ✗ Viewport ${vp.name} failed:`, err.message);
      }
    }
  } finally {
    // Restore original orders and clean reviews
    fs.writeFileSync(REVIEWS_FILE, '[]', 'utf8');
    fs.writeFileSync(ORDERS_FILE, originalOrders, 'utf8');
    await browser.close();
  }

  console.log('\n======================================================');
  console.log(`TOTAL TESTS:   ${passedTests + failedTests}`);
  console.log(`PASSED:        ${passedTests}`);
  console.log(`FAILED:        ${failedTests}`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    console.error('Failures encountered:');
    failureDetails.forEach((f) => console.error(` - [${f.test}]: ${f.error}`));
    process.exit(1);
  }
}

runReviewVerificationSuite().catch((err) => {
  console.error('Fatal suite error:', err);
  process.exit(1);
});
