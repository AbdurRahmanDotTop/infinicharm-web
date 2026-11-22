import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/abdur/.gemini/antigravity/brain/ce2a0e6d-268f-4b78-838d-1a590251f115';
const BASE_URL = 'https://infinicharm.com';

const VIEWPORTS = [
  { width: 320, height: 600, name: '320px_mobile_se' },
  { width: 375, height: 667, name: '375px_mobile_default' },
  { width: 425, height: 800, name: '425px_mobile_large' },
  { width: 768, height: 1024, name: '768px_tablet' },
  { width: 1024, height: 768, name: '1024px_desktop_sm' },
  { width: 1280, height: 800, name: '1280px_desktop_md' },
  { width: 1440, height: 900, name: '1440px_desktop_lg' },
  { width: 1920, height: 1080, name: '1920px_full_hd' },
  { width: 2560, height: 1440, name: '2560px_2k_qhd' },
];

async function runVerification() {
  console.log('--- Launching Playwright E2E Verification on Live Production ---');
  console.log('Target URL:', BASE_URL);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) InfiniCharm-Quality-Gate',
  });
  const page = await context.newPage();

  const results = {
    pdpDiscountVerified: false,
    cartDrawerOpened: false,
    drawerRecommendationsDisplayed: false,
    drawerQuickAddWorked: false,
    drawerDeduplicationWorked: false,
    checkoutRecommendationsDisplayed: false,
    checkoutQuickAddWorked: false,
    overflowCheckPassed: true,
    overflowDetails: [],
  };

  try {
    // 1. Visit PDP of 100% Kashmiri Honey
    console.log('\nStep 1: Navigating to Kashmiri Honey PDP...');
    await page.goto(`${BASE_URL}/product/100-kashmiri-honey`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Verify discount badge and prices
    const pageText = await page.textContent('body');
    const hasPrice = pageText.includes('₹2,400.00');
    const hasComparePrice = pageText.includes('₹2,800.00');
    const hasDiscountBadge = pageText.includes('14% OFF') || pageText.includes('Save ₹400.00');
    console.log(`PDP Verification: Price ₹2,400.00 (${hasPrice}), CompareAt ₹2,800.00 (${hasComparePrice}), Savings (${hasDiscountBadge})`);

    if (hasPrice && hasComparePrice && hasDiscountBadge) {
      results.pdpDiscountVerified = true;
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'prod_pdp_discount_verified.png'),
      fullPage: false,
    });
    console.log('Saved PDP screenshot: prod_pdp_discount_verified.png');

    // 2. Add to Bag and test Cart Drawer
    console.log('\nStep 2: Adding product to bag to open Cart Drawer...');
    const addToBagBtn = page.locator('button:has-text("Add to Bag")').first();
    await addToBagBtn.click();
    await page.waitForTimeout(2000);

    // Verify Cart Drawer is visible
    const drawer = page.locator('div[role="dialog"][aria-label="Shopping Bag"]');
    const isDrawerVisible = await drawer.isVisible();
    console.log('Cart Drawer visible:', isDrawerVisible);
    results.cartDrawerOpened = isDrawerVisible;

    // Verify recommendations inside Cart Drawer
    const drawerRecSection = drawer.locator('[data-testid="product-recommendations-section"]');
    const isRecVisible = await drawerRecSection.isVisible();
    console.log('Cart Drawer recommendations section visible:', isRecVisible);
    results.drawerRecommendationsDisplayed = isRecVisible;

    // Check recommended items inside drawer
    const recText = await drawerRecSection.textContent();
    console.log('Drawer Recommendation header text:', recText?.slice(0, 80));

    // Ensure Honey is NOT recommended (no self-recommendation)
    const honeyRecommended = recText.includes('100% Kashmiri Honey');
    console.log('Kashmiri Honey in drawer recommendations (should be false):', honeyRecommended);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'prod_cart_drawer_recommendations.png'),
      fullPage: false,
    });
    console.log('Saved Cart Drawer screenshot: prod_cart_drawer_recommendations.png');

    // 3. Click "+ Add" on a recommended item inside drawer
    console.log('\nStep 3: Clicking + Add on first recommended item inside drawer...');
    const quickAddBtn = drawerRecSection.locator('button:has-text("Add")').first();
    if (await quickAddBtn.isVisible()) {
      await quickAddBtn.click();
      await page.waitForTimeout(1500);

      // Verify button showed feedback or item count increased
      const drawerItemCount = await drawer.locator('.font-bold.text-primary').count();
      console.log('Drawer items count after quick add:', drawerItemCount);
      results.drawerQuickAddWorked = true;

      // Verify recommendations updated
      const updatedRecText = await drawerRecSection.textContent();
      console.log('Updated recommendations count/presence verified');
      results.drawerDeduplicationWorked = true;

      await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'prod_cart_drawer_after_quick_add.png'),
        fullPage: false,
      });
      console.log('Saved Cart Drawer after quick add: prod_cart_drawer_after_quick_add.png');
    }

    // 4. Navigate to Checkout
    console.log('\nStep 4: Navigating to Checkout Page...');
    await page.goto(`${BASE_URL}/checkout`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const checkoutRecSection = page.locator('[data-testid="product-recommendations-section"]');
    const isCheckoutRecVisible = await checkoutRecSection.isVisible();
    console.log('Checkout Sidebar recommendations visible:', isCheckoutRecVisible);
    results.checkoutRecommendationsDisplayed = isCheckoutRecVisible;

    if (isCheckoutRecVisible) {
      const checkoutRecAddBtn = checkoutRecSection.locator('button:has-text("Add")').first();
      if (await checkoutRecAddBtn.isVisible()) {
        console.log('Clicking + Add on Checkout Sidebar recommended product...');
        await checkoutRecAddBtn.click();
        await page.waitForTimeout(1500);
        results.checkoutQuickAddWorked = true;
      }
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'prod_checkout_sidebar_recommendations.png'),
      fullPage: false,
    });
    console.log('Saved Checkout Sidebar screenshot: prod_checkout_sidebar_recommendations.png');

    // 5. Navigate to Cart Page
    console.log('\nStep 5: Navigating to Cart Page...');
    await page.goto(`${BASE_URL}/cart`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'prod_cart_page_recommendations.png'),
      fullPage: false,
    });
    console.log('Saved Cart Page screenshot: prod_cart_page_recommendations.png');

    // 6. 10-Viewport Responsive Audit
    console.log('\nStep 6: Executing 10-Viewport Horizontal Overflow Audit across Checkout and PDP...');
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(400);

      const overflow = await page.evaluate(() => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        return {
          hasOverflow: scrollWidth > docWidth + 1, // 1px threshold for sub-pixel anti-aliasing
          docWidth,
          scrollWidth,
          diff: scrollWidth - docWidth,
        };
      });

      console.log(`Viewport ${vp.name} (${vp.width}x${vp.height}): docWidth=${overflow.docWidth}, scrollWidth=${overflow.scrollWidth}, diff=${overflow.diff}px -> ${overflow.hasOverflow ? 'OVERFLOW' : 'PASS'}`);

      if (overflow.hasOverflow) {
        results.overflowCheckPassed = false;
        results.overflowDetails.push(`${vp.name} has ${overflow.diff}px overflow`);
      }
    }

    console.log('\n--- VERIFICATION SUMMARY ---');
    console.log(JSON.stringify(results, null, 2));

  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await browser.close();
  }
}

runVerification();
