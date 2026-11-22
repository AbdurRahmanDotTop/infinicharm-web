import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = process.env.TEST_URL || 'https://infinicharm.com';
const ARTIFACTS_DIR = 'C:/Users/abdur/.gemini/antigravity/brain/ce2a0e6d-268f-4b78-838d-1a590251f115';

const VIEWPORTS = [
  { name: '320px Mobile Mini', width: 320, height: 600 },
  { name: '375px Mobile Standard', width: 375, height: 667 },
  { name: '414px Mobile Large', width: 414, height: 896 },
  { name: '768px Tablet Portrait', width: 768, height: 1024 },
  { name: '1024px Tablet Landscape', width: 1024, height: 768 },
  { name: '1280px Desktop Small', width: 1280, height: 800 },
  { name: '1366px Laptop HD', width: 1366, height: 768 },
  { name: '1440px Desktop Full HD', width: 1440, height: 900 },
  { name: '1920px 1080p Desktop', width: 1920, height: 1080 },
  { name: '2560px 2K QHD', width: 2560, height: 1440 },
];

async function run() {
  console.log(`Starting automated verification on ${BASE_URL}...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // 1. Authenticate as Admin
  console.log('1. Authenticating as admin@infinicharm.com...');
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@infinicharm.com');
  await page.fill('input[type="password"]', 'Admin@1234!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // 2. Test GET /api/admin/users/cust-founder-01
  console.log('2. Verifying GET /api/admin/users/cust-founder-01 (assert status 200)...');
  const resFounder = await page.request.get(`${BASE_URL}/api/admin/users/cust-founder-01`);
  console.log('cust-founder-01 HTTP Status:', resFounder.status());
  assert.equal(resFounder.status(), 200, 'GET /api/admin/users/cust-founder-01 must return 200 OK');
  const dataFounder = await resFounder.json();
  assert.equal(dataFounder.success, true);
  assert.equal(dataFounder.user.id, 'cust-founder-01');
  assert.equal(dataFounder.user.email, 'abdurrahmanibnghufran@gmail.com');
  assert.equal(dataFounder.user.isProtected, true);
  console.log('✔ GET /api/admin/users/cust-founder-01 verified successfully.');

  // 3. Test GET /api/admin/users/usr-admin-01
  console.log('3. Verifying GET /api/admin/users/usr-admin-01 (assert status 200)...');
  const resAdmin = await page.request.get(`${BASE_URL}/api/admin/users/usr-admin-01`);
  assert.equal(resAdmin.status(), 200, 'GET /api/admin/users/usr-admin-01 must return 200 OK');
  const dataAdmin = await resAdmin.json();
  assert.equal(dataAdmin.success, true);
  assert.equal(dataAdmin.user.role, 'SUPER_ADMIN');
  console.log('✔ GET /api/admin/users/usr-admin-01 verified successfully.');

  // 4. Test DELETE on non-existent or already deleted user is idempotent
  console.log('4. Verifying DELETE /api/admin/users/cust-01 returns 200...');
  const resDel = await page.request.delete(`${BASE_URL}/api/admin/users/cust-01`);
  console.log('DELETE cust-01 HTTP Status:', resDel.status());
  assert.equal(resDel.status(), 200, 'DELETE /api/admin/users/cust-01 must return 200 OK');
  const dataDel = await resDel.json();
  assert.equal(dataDel.success, true);
  console.log('✔ DELETE /api/admin/users/cust-01 verified successfully.');

  // 5. Navigate to /admin/users and test UI Details Drawer
  console.log('5. Navigating to /admin/users...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click Details button for cust-founder-01
  console.log('6. Clicking Details button on AbdurRahman Ibn Ghufran row...');
  const founderRow = page.locator('tr:has-text("abdurrahmanibnghufran@gmail.com")');
  await founderRow.waitFor({ state: 'visible', timeout: 10000 });
  
  const detailsBtn = founderRow.locator('button:has-text("Details")');
  await detailsBtn.click();
  await page.waitForTimeout(1500);

  // Verify Drawer is visible
  const drawer = page.locator('text=User Profile Inspector');
  await drawer.waitFor({ state: 'visible', timeout: 8000 });
  console.log('✔ Details Drawer opened successfully.');

  // Check no 404 errors occurred
  const has404 = consoleErrors.some(e => e.includes('404'));
  assert.equal(has404, false, `Console must NOT contain 404 errors. Found: ${consoleErrors.join(', ')}`);
  console.log('✔ Zero 404 console errors confirmed.');

  // Take screenshot of drawer
  const drawerScreenshotPath = path.join(ARTIFACTS_DIR, 'prod_admin_users_details_drawer_verified.png');
  await page.screenshot({ path: drawerScreenshotPath, fullPage: true });
  console.log('✔ Screenshot saved:', drawerScreenshotPath);

  // Close drawer
  const closeBtn = page.locator('button[aria-label="Close inspector"], button:has-text("Close")').first();
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  }

  // 6. 10 Viewports Audit
  console.log('\n7. Performing 10-Viewport Responsive & Horizontal Overflow Audit on /admin/users:');
  const viewportResults = [];
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(400);

    const overflow = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const winWidth = window.innerWidth;
      return {
        docWidth,
        winWidth,
        hasOverflow: docWidth > winWidth,
        overflowPx: Math.max(0, docWidth - winWidth)
      };
    });

    const passed = !overflow.hasOverflow;
    console.log(`  [${vp.name}] ${vp.width}x${vp.height} -> Overflow: ${overflow.overflowPx}px | Status: ${passed ? 'PASS' : 'FAIL'}`);
    assert.equal(passed, true, `Viewport ${vp.name} (${vp.width}px) has ${overflow.overflowPx}px horizontal overflow!`);
    viewportResults.push({ ...vp, ...overflow, passed });
  }
  console.log('✔ All 10 viewports passed with 0px horizontal overflow.');

  // Save full-page desktop screenshot
  await page.setViewportSize({ width: 1440, height: 900 });
  const finalScreenshotPath = path.join(ARTIFACTS_DIR, 'prod_admin_users_verified_clean.png');
  await page.screenshot({ path: finalScreenshotPath, fullPage: true });
  console.log('✔ Final verification screenshot saved:', finalScreenshotPath);

  await browser.close();
  console.log('\nAll assertions and audits passed successfully!');
}

run().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
