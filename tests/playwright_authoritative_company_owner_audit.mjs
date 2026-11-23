// ==============================================================================
// InfiniCharm — Playwright Verification: Authoritative Company & Owner Audit
// Governing Document: All_Docs/Contents/CompanyAndOwner.md
// Standards: 10 Viewports, Zero Placeholder, Authoritative Identity Verification
// ==============================================================================

import { chromium } from 'playwright';
import assert from 'assert';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const VIEWPORTS = [
  { width: 320, height: 568, label: '320px Ultra-Compact Mobile' },
  { width: 375, height: 667, label: '375px Standard Mobile' },
  { width: 414, height: 896, label: '414px Large Mobile' },
  { width: 640, height: 800, label: '640px Small Tablet' },
  { width: 768, height: 1024, label: '768px Portrait Tablet' },
  { width: 1024, height: 768, label: '1024px Landscape Tablet / Small Laptop' },
  { width: 1280, height: 800, label: '1280px Standard Laptop' },
  { width: 1440, height: 900, label: '1440px Large Laptop' },
  { width: 1920, height: 1080, label: '1920px Full HD Desktop' },
  { width: 2560, height: 1440, label: '2560px 2K / QHD Display' },
];

async function runAudit() {
  console.log('===============================================================');
  console.log('  InfiniCharm: Authoritative Company & Owner Verification      ');
  console.log('  Governing: All_Docs/Contents/CompanyAndOwner.md              ');
  console.log(`  Target: ${BASE_URL}`);
  console.log('===============================================================\n');

  const browser = await chromium.launch({ headless: true });
  let totalAssertions = 0;
  let passedAssertions = 0;

  function check(desc, condition) {
    totalAssertions++;
    if (condition) {
      passedAssertions++;
      console.log(`  ✔ PASS: ${desc}`);
    } else {
      console.error(`  ✖ FAIL: ${desc}`);
      throw new Error(`Assertion failed: ${desc}`);
    }
  }

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // --- Phase 1: Registration Page Authoritative Placeholders ---
    console.log('--- Phase 1: Registration Form Placeholders (/register) ---');
    await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle' });

    // Full name placeholder
    const fullNameInput = page.locator('input[autocomplete="name"]');
    const namePlaceholder = await fullNameInput.getAttribute('placeholder');
    check('Full Name placeholder is "AbdurRahman Ibn Ghufran"', namePlaceholder === 'AbdurRahman Ibn Ghufran');

    // Email address placeholder
    const emailInput = page.locator('input[autocomplete="email"]');
    const emailPlaceholder = await emailInput.getAttribute('placeholder');
    check('Email Address placeholder is "abdurrahman@infinicharm.com"', emailPlaceholder === 'abdurrahman@infinicharm.com');

    // Phone placeholder
    const phoneInput = page.locator('input[autocomplete="tel"]');
    const phonePlaceholder = await phoneInput.getAttribute('placeholder');
    check('Mobile Phone placeholder is "+91 8825164657"', phonePlaceholder === '+91 8825164657');

    // Verify absence of outdated placeholders
    check('No "Aarav Sharma" on register page', !(await page.content()).includes('Aarav Sharma'));
    check('No "aarav@example.com" on register page', !(await page.content()).includes('aarav@example.com'));
    check('No "+91 98765 43210" on register page', !(await page.content()).includes('+91 98765 43210'));

    await page.screenshot({ path: 'prod_verified_register_page.png', fullPage: true });
    console.log('  📸 Screenshot saved: prod_verified_register_page.png\n');

    // --- Phase 2: Contact Page Authoritative Details ---
    console.log('--- Phase 2: Contact Page Authority (/contact) ---');
    await page.goto(`${BASE_URL}/contact`, { waitUntil: 'networkidle' });

    const contactHtml = await page.content();
    check('Contact phone +91 8825164657 present', contactHtml.includes('+91 8825164657'));
    check('East Champaran, Bihar, India - 845427 present', contactHtml.includes('East Champaran, Bihar, India - 845427'));
    check('Founder AbdurRahman Ibn Ghufran present', contactHtml.includes('AbdurRahman Ibn Ghufran'));
    check('No "Bairgania, Sitamarhi" on contact page', !contactHtml.includes('Bairgania, Sitamarhi'));

    await page.screenshot({ path: 'prod_verified_contact_page.png', fullPage: true });
    console.log('  📸 Screenshot saved: prod_verified_contact_page.png\n');

    // --- Phase 3: Homepage and Brand Identity ---
    console.log('--- Phase 3: Homepage & Brand Header/Footer (/) ---');
    await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle' });

    const homeHtml = await page.content();
    check('Brand entity "Techily Fly" rendered in brand taglines', homeHtml.includes('Techily Fly'));
    check('No "Bairgania, Bihar" on homepage', !homeHtml.includes('Bairgania, Bihar'));
    check('East Champaran, Bihar dispatch present', homeHtml.includes('East Champaran, Bihar'));

    // --- Phase 4: 10 Viewports Responsive Verification on /register ---
    console.log('--- Phase 4: 10 Viewports Zero Horizontal Overflow (/register) ---');
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(200);

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      check(`Viewport ${vp.width}px (${vp.label}) has zero horizontal overflow`, !hasHorizontalScroll);
    }

    console.log('\n===============================================================');
    console.log(`  ALL AUDIT CHECKS PASSED: ${passedAssertions}/${totalAssertions} assertions passed`);
    console.log('===============================================================');
  } finally {
    await browser.close();
  }
}

runAudit().catch((err) => {
  console.error('\n✖ Audit execution failed:', err);
  process.exit(1);
});
