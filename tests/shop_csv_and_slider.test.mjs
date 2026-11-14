import { chromium } from '@playwright/test';

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

async function runShopVerification() {
  console.log('🚀 Starting InfiniCharm Shop / All Products & CSV Sync Verification Suite...\n');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const failureDetails = [];

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    { name: 'infinicharm_admin_session', value: 'active', url: BASE_URL },
  ]);
  const page = await context.newPage();

  // =========================================================================
  // Test 1: Real CSV Product Presence & Attribute Integrity
  // =========================================================================
  console.log('--- 1. Real CSV Product Data Integrity on /shop ---');
  totalTests++;
  try {
    await page.goto(`${BASE_URL}/shop`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Verify CSV product title
    const productTitle = page.locator('text=100% Kashmiri Honey – Pure Taste & Natural Sweetness').first();
    await productTitle.waitFor({ state: 'visible', timeout: 6000 });

    // Verify Brand IC-HONEY
    const brand = page.locator('text=IC-HONEY').first();
    await brand.waitFor({ state: 'visible', timeout: 4000 });

    // Verify Price ₹2,400.00
    const price = page.locator('text=₹2,400.00').first();
    await price.waitFor({ state: 'visible', timeout: 4000 });

    // Verify Authenticity Badge
    const authBadge = page.locator('text=100% Authentic').first();
    await authBadge.waitFor({ state: 'visible', timeout: 4000 });

    passedTests++;
    console.log('  ✓ Verified 100% authentic CSV product displayed (Title, IC-HONEY, ₹2,400.00, Authenticity badge).');
  } catch (err) {
    failedTests++;
    failureDetails.push({ test: 'Real CSV Product Presence', error: err.message });
  }

  // =========================================================================
  // Test 2: Complete Absence of Marketplace Popular & Demo/Mock Content
  // =========================================================================
  console.log('\n--- 2. Complete Removal of Mock/Demo Content on /shop ---');
  const prohibitedItems = [
    'Marketplace Popular:',
    'Attar & Pure Oils',
    'A2 Desi Ghee',
    'Tellicherry Pepper',
    'Single-Origin Saffron',
    'Handloom Khadi',
    'Toggle Empty State Test',
    'Related Searches:',
    '(521)',
    '(188)',
  ];

  for (const item of prohibitedItems) {
    totalTests++;
    try {
      const el = page.locator(`text="${item}"`);
      const count = await el.count();
      if (count > 0) {
        throw new Error(`Prohibited static/demo item found in DOM: "${item}" (count: ${count})`);
      }
      passedTests++;
      console.log(`  ✓ Confirmed prohibited item absent: "${item}"`);
    } catch (err) {
      failedTests++;
      failureDetails.push({ test: `Absence of "${item}"`, error: err.message });
    }
  }

  // =========================================================================
  // Test 3: Draggable Dual-Range Slider Functionality
  // =========================================================================
  console.log('\n--- 3. Interactive Draggable Dual-Range Slider Verification ---');
  totalTests++;
  try {
    const minInput = page.locator('input[aria-label="Minimum Price Filter"]').first();
    const maxInput = page.locator('input[aria-label="Maximum Price Filter"]').first();

    await minInput.waitFor({ state: 'attached', timeout: 4000 });
    await maxInput.waitFor({ state: 'attached', timeout: 4000 });

    // Read attributes
    const minVal = await minInput.getAttribute('min');
    const maxVal = await maxInput.getAttribute('max');
    console.log(`  Slider dynamic bounds detected: [min: ${minVal}, max: ${maxVal}]`);

    // Verify interaction: Adjust maxInput below the product price (₹2,400) -> should show empty state
    await maxInput.evaluate((el) => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(el, '1000');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(500);

    // Verify zero results message appears
    const emptyNotice = page.locator('text=No products found matching').first();
    await emptyNotice.waitFor({ state: 'visible', timeout: 6000 });
    console.log('  ✓ Slider boundary filtering: When max price is set to ₹1,000, ₹2,400 product correctly excluded.');

    // Adjust maxInput back to 3000 -> product reappears
    await maxInput.evaluate((el) => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(el, '3000');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(500);

    const productTitle = page.locator('text=100% Kashmiri Honey – Pure Taste & Natural Sweetness').first();
    await productTitle.waitFor({ state: 'visible', timeout: 6000 });
    console.log('  ✓ Slider restoration: When max price restored to ₹3,000, product immediately reappears.');

    passedTests++;
  } catch (err) {
    failedTests++;
    failureDetails.push({ test: 'Interactive Draggable Slider', error: err.message });
  }

  // =========================================================================
  // Test 4: Quick Price Presets
  // =========================================================================
  console.log('\n--- 4. Quick Price Brackets ---');
  totalTests++;
  try {
    const under1000Btn = page.locator('aside button:has-text("Under ₹1,000")').first();
    await under1000Btn.click();
    await page.waitForTimeout(500);

    // Product is ₹2,400 so it should not match Under ₹1,000
    const emptyNotice = page.locator('text=No products found matching').first();
    await emptyNotice.waitFor({ state: 'visible', timeout: 4000 });

    // Click All Prices to restore
    const allPricesBtn = page.locator('aside button:has-text("All Prices")').first();
    await allPricesBtn.click();
    await page.waitForTimeout(500);

    const productTitle = page.locator('text=100% Kashmiri Honey – Pure Taste & Natural Sweetness').first();
    await productTitle.waitFor({ state: 'visible', timeout: 4000 });

    passedTests++;
    console.log('  ✓ Quick price bracket presets successfully toggle price boundaries.');
  } catch (err) {
    failedTests++;
    failureDetails.push({ test: 'Quick Price Presets', error: err.message });
  }

  // =========================================================================
  // Test 5: 10-Viewport Responsiveness & Zero Horizontal Overflow
  // =========================================================================
  console.log('\n--- 5. 10-Viewport Responsiveness & 0px Horizontal Overflow ---');
  for (const vp of VIEWPORTS) {
    totalTests++;
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE_URL}/shop`, { waitUntil: 'domcontentloaded', timeout: 10000 });

      // Check horizontal overflow
      const overflow = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });

      if (overflow.hasOverflow) {
        throw new Error(`Horizontal overflow detected! scrollWidth: ${overflow.scrollWidth} > clientWidth: ${overflow.clientWidth}`);
      }

      // If mobile/tablet, test Mobile Filter Drawer
      if (vp.width < 1024) {
        const filterBtn = page.locator('button:has-text("Filters")').first();
        await filterBtn.waitFor({ state: 'visible', timeout: 4000 });
        await filterBtn.click();

        // Drawer should open
        const drawerHeading = page.locator('text=Filter Catalog').first();
        await drawerHeading.waitFor({ state: 'visible', timeout: 4000 });

        // Close drawer
        const closeBtn = page.locator('button[aria-label="Close filters"]').first();
        await closeBtn.click();
        await page.waitForTimeout(300);
      }

      passedTests++;
      console.log(`  ✓ ${vp.name.padEnd(20)} (${vp.width}x${vp.height}): Zero overflow (scrollWidth === clientWidth).`);
    } catch (err) {
      failedTests++;
      failureDetails.push({ test: `Viewport ${vp.name} (${vp.width}px)`, error: err.message });
    }
  }

  // =========================================================================
  // Test 6: Admin Panel CSV Synchronization Button & API
  // =========================================================================
  console.log('\n--- 6. Admin Panel CSV Synchronization Integration ---');
  totalTests++;
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/admin/products`, { waitUntil: 'domcontentloaded', timeout: 10000 });

    const syncCsvBtn = page.locator('button:has-text("Sync from CSV")').first();
    await syncCsvBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Click Sync from CSV
    await syncCsvBtn.click();

    // Verify toast notification appears
    const toast = page.locator('text=Synchronized 1 product(s) directly from CSV files in All_Docs/Products/').first();
    await toast.waitFor({ state: 'visible', timeout: 8000 });

    passedTests++;
    console.log('  ✓ Admin Panel "Sync from CSV" button triggered POST /api/admin/products/sync-csv with toast confirmation.');
  } catch (err) {
    failedTests++;
    failureDetails.push({ test: 'Admin CSV Sync Integration', error: err.message });
  }

  console.log('\n======================================================');
  console.log(`TOTAL TESTS:   ${totalTests}`);
  console.log(`PASSED:        ${passedTests}`);
  console.log(`FAILED:        ${failedTests}`);
  console.log('======================================================\n');

  if (failureDetails.length > 0) {
    console.error('FAILURES:');
    failureDetails.forEach((f) => console.error(`  ✖ [${f.test}]: ${f.error}`));
  }

  await browser.close();
  process.exit(failedTests > 0 ? 1 : 0);
}

runShopVerification().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
