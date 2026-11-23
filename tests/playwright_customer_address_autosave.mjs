import { chromium } from 'playwright';
import { createCustomer, deleteCustomer } from '../src/lib/server/customers-store.ts';

const BASE_URL = process.env.TEST_BASE_URL || process.argv[2] || 'http://localhost:3000';

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

async function runTest() {
  console.log(`\n===============================================================`);
  console.log(`  InfiniCharm E2E: Customer Details Auto-Save & Address Book   `);
  console.log(`  Target: ${BASE_URL}`);
  console.log(`===============================================================\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) InfiniCharm-Playwright-Verification',
  });
  const page = await context.newPage();

  let passCount = 0;
  let failCount = 0;
  let createdCustomerId = null;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✔ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`  ✖ FAIL: ${message}`);
      failCount++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Phase 1: Customer Authentication & Initial State
    // -------------------------------------------------------------------------
    console.log(`\n--- Phase 1: Customer Authentication & Initial State ---`);
    const testEmail = `patron-${Date.now()}@infinicharm.customer`;
    const testPassword = 'Customer@1234!';
    const testName = 'Playwright Test Patron';

    // Provision an authentic verified customer account with 0 saved addresses (matches user's screenshot state)
    const customer = createCustomer({
      email: testEmail,
      fullName: testName,
      password: testPassword,
      emailVerified: true,
      status: 'ACTIVE',
    });
    assert(customer.id, 'Customer registered and verified successfully');
    createdCustomerId = customer.id;

    const loginRes = await page.request.post(`${BASE_URL}/api/auth/customer/login`, {
      data: { email: testEmail, password: testPassword }
    });
    const loginData = await loginRes.json();
    assert(loginData.success, 'Customer signed in and session established');

    await page.goto(`${BASE_URL}/account`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    assert(page.url().includes('/account'), 'Customer successfully signed in and navigated to /account');

    const initialAccountText = await page.textContent('body');
    assert(
      initialAccountText.includes('0 Saved') && initialAccountText.includes('No default address saved yet'),
      'Initial account page shows "0 Saved" addresses & "No default address saved yet" (matches screenshot state)'
    );

    // -------------------------------------------------------------------------
    // Phase 2: Add item to cart and proceed to checkout
    // -------------------------------------------------------------------------
    console.log(`\n--- Phase 2: Add Item & Checkout Order #1 (New Address) ---`);
    await page.goto(`${BASE_URL}/shop`, { waitUntil: 'networkidle' });

    // Click "Add to Cart" on first product
    const addToBagButtons = page.locator('button:has-text("Add to Cart")');
    await addToBagButtons.first().waitFor({ state: 'visible', timeout: 8000 });
    await addToBagButtons.first().click();
    await page.waitForTimeout(1000);

    // Navigate to checkout
    await page.goto(`${BASE_URL}/checkout`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Verify customer is recognized as signed in
    const checkoutBody = await page.textContent('body');
    assert(checkoutBody.includes('Signed in as') || checkoutBody.includes(testEmail), 'Checkout recognizes signed-in customer status');

    // Fill in new address details for Order 1
    console.log(`  Filling Order #1 delivery details (Motihari Home)...`);
    const nameInput = page.locator('input[placeholder*="AbdurRahman"]');
    await nameInput.fill('AbdurRahman Home Patron');

    const phoneInput = page.locator('input[placeholder*="9876543210"]');
    await phoneInput.fill('9876543210');

    // Address Line 1
    const addr1Input = page.locator('input[placeholder*="Ward No."]');
    await addr1Input.fill('Flat 101, Royal Residency, Main Market Road');

    // PIN code (triggers auto-fill for Motihari, Bihar)
    const pinInput = page.locator('input[placeholder*="845427"]');
    await pinInput.fill('845401');
    await page.waitForTimeout(600);

    // Verify City & State auto-filled or populated
    const cityInput = page.locator('input[placeholder*="Auto-filled or type city"]');
    const stateInput = page.locator('input[placeholder*="Bihar, Delhi"]');
    if (!(await cityInput.inputValue())) await cityInput.fill('Motihari');
    if (!(await stateInput.inputValue())) await stateInput.fill('Bihar');

    // Select "Home" category pill
    const homePill = page.locator('[data-testid="checkout-addr-type-home"]');
    if (await homePill.isVisible().catch(() => false)) {
      await homePill.click();
    }

    // Set custom address nickname
    const labelInput = page.locator('[data-testid="checkout-address-label-input"]');
    if (await labelInput.isVisible().catch(() => false)) {
      await labelInput.fill('My Family Home');
    }

    // Select Custom UPI payment method and enter valid UTR
    console.log(`  Submitting UTR reference for Order #1...`);
    const utrInput = page.locator('input[placeholder*="431902847190"]');
    await utrInput.waitFor({ state: 'visible', timeout: 5000 });
    await utrInput.fill('98IUHYGTRDER54U');

    // Submit Order 1
    const placeOrderBtn = page.locator('button:has-text("Confirm & Place Order")');
    await placeOrderBtn.click();

    // Verify redirection to checkout success
    await page.waitForURL('**/checkout/success**', { timeout: 15000 });
    assert(page.url().includes('/checkout/success'), 'Order #1 placed successfully, redirected to success page');

    // -------------------------------------------------------------------------
    // Phase 3: Verify Auto-Save to Customer Account & Address Book
    // -------------------------------------------------------------------------
    console.log(`\n--- Phase 3: Verify Address Auto-Save in Account ---`);
    await page.goto(`${BASE_URL}/account`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const accountBodyText = await page.textContent('body');
    assert(accountBodyText.includes('1 Saved'), 'Account dashboard metrics reflect "1 Saved" address');
    assert(
      accountBodyText.includes('Royal Residency') || accountBodyText.includes('845401'),
      'Default Delivery Address card renders auto-saved order address'
    );

    // Visit /account/addresses
    await page.goto(`${BASE_URL}/account/addresses`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const addrPageText = await page.textContent('body');
    assert(addrPageText.includes('Royal Residency'), 'Address Book contains auto-saved address line');
    assert(addrPageText.includes('845401'), 'Address Book contains auto-saved PIN code');
    assert(
      addrPageText.includes('My Family Home') || addrPageText.includes('Home'),
      'Address Book displays address label / category badge'
    );

    // -------------------------------------------------------------------------
    // Phase 4: Auto-Fill on Future Orders & Address Selector
    // -------------------------------------------------------------------------
    console.log(`\n--- Phase 4: Order #2 Auto-Fill & Saved Address Selector ---`);
    await page.goto(`${BASE_URL}/shop`, { waitUntil: 'networkidle' });
    const addButtons2 = page.locator('button:has-text("Add to Cart")');
    await addButtons2.first().click();
    await page.waitForTimeout(1000);

    await page.goto(`${BASE_URL}/checkout`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Verify Saved Address Selector is visible
    const savedAddressCards = page.locator('[data-testid^="checkout-saved-address-"]');
    const savedCardCount = await savedAddressCards.count();
    assert(savedCardCount >= 1, `Saved Address selector displays ${savedCardCount} saved address card(s)`);

    // Verify form fields are pre-populated with previously saved details
    const prefilledAddr1 = await addr1Input.inputValue();
    assert(prefilledAddr1.includes('Royal Residency'), `Form pre-populated address line 1 automatically ("${prefilledAddr1}")`);
    const prefilledPin = await pinInput.inputValue();
    assert(prefilledPin === '845401', `Form pre-populated PIN code automatically ("${prefilledPin}")`);

    // -------------------------------------------------------------------------
    // Phase 5: Add 2nd Address Without Overwriting 1st Address
    // -------------------------------------------------------------------------
    console.log(`\n--- Phase 5: Place Order #2 with 2nd Address (Office) ---`);
    const useNewAddrBtn = page.locator('[data-testid="checkout-use-new-address-btn"]');
    await useNewAddrBtn.waitFor({ state: 'visible', timeout: 5000 });
    await useNewAddrBtn.click();
    await page.waitForTimeout(500);

    // Fill in 2nd address (Office in Patna)
    await nameInput.fill('AbdurRahman Work Office');
    await phoneInput.fill('9876599999');
    await addr1Input.fill('TechilyFly Corporate Suite, Exhibition Road');
    await pinInput.fill('800001');
    await page.waitForTimeout(600);

    if (!(await cityInput.inputValue())) await cityInput.fill('Patna');
    if (!(await stateInput.inputValue())) await stateInput.fill('Bihar');

    // Select "Office" pill
    const officePill = page.locator('[data-testid="checkout-addr-type-office"]');
    if (await officePill.isVisible().catch(() => false)) {
      await officePill.click();
    }
    if (await labelInput.isVisible().catch(() => false)) {
      await labelInput.fill('Patna Tech Office');
    }

    // Submit Custom UPI payment
    const utrInput2 = page.locator('input[placeholder*="431902847190"]');
    await utrInput2.waitFor({ state: 'visible', timeout: 5000 });
    await utrInput2.fill('888877776666');

    const placeOrderBtn2 = page.locator('button:has-text("Confirm & Place Order")');
    await placeOrderBtn2.click();

    await page.waitForURL('**/checkout/success**', { timeout: 15000 });
    assert(page.url().includes('/checkout/success'), 'Order #2 placed successfully with separate office address');

    // -------------------------------------------------------------------------
    // Phase 6: Verify Multiple Addresses Persist Without Overwrite
    // -------------------------------------------------------------------------
    console.log(`\n--- Phase 6: Verify Multi-Address Integrity in Address Book ---`);
    await page.goto(`${BASE_URL}/account/addresses`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const multiAddrText = await page.textContent('body');
    assert(multiAddrText.includes('Royal Residency'), 'Original Home address is preserved intact');
    assert(multiAddrText.includes('Exhibition Road'), 'Second Office address is present as a distinct entry');
    assert(multiAddrText.includes('845401') && multiAddrText.includes('800001'), 'Both PIN codes exist without overwriting');

    // -------------------------------------------------------------------------
    // Phase 7: Switch Between Multiple Addresses on Checkout
    // -------------------------------------------------------------------------
    console.log(`\n--- Phase 7: Address Switching Verification ---`);
    await page.goto(`${BASE_URL}/shop`, { waitUntil: 'networkidle' });
    const addButtons3 = page.locator('button:has-text("Add to Cart")');
    await addButtons3.first().click();
    await page.waitForTimeout(1000);

    await page.goto(`${BASE_URL}/checkout`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const allCards = page.locator('[data-testid^="checkout-saved-address-"]');
    const totalCards = await allCards.count();
    assert(totalCards >= 2, `Checkout displays ${totalCards} saved address cards for 1-click selection`);

    // Click first card (Motihari Home)
    await allCards.first().click();
    await page.waitForTimeout(400);
    const selectedLine1 = await addr1Input.inputValue();
    assert(
      selectedLine1.includes('Royal Residency') || selectedLine1.includes('Exhibition Road'),
      'Form inputs dynamically updated on card click'
    );

    // Click second card
    await allCards.nth(1).click();
    await page.waitForTimeout(400);
    const selectedLine2 = await addr1Input.inputValue();
    assert(selectedLine2 !== selectedLine1, 'Form inputs dynamically changed when switching between saved address cards');

    // -------------------------------------------------------------------------
    // Phase 8: Address Book CRUD (Edit / Delete)
    // -------------------------------------------------------------------------
    console.log(`\n--- Phase 8: Address Book CRUD Operations ---`);
    await page.goto(`${BASE_URL}/account/addresses`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Edit address modal test
    const editButtons = page.locator('button[title="Edit address"]');
    if ((await editButtons.count()) > 0) {
      await editButtons.first().click();
      await page.waitForTimeout(500);

      // Verify modal opened
      const modalHeader = page.locator('h3:has-text("Edit Delivery Address")');
      assert(await modalHeader.isVisible(), 'Edit Delivery Address modal opens properly');

      // Update locality
      const modalAddr2 = page.locator('input[placeholder*="Near State Bank"]');
      await modalAddr2.fill('Phase 2 Extension Block');
      await page.click('button:has-text("Update Address")');
      await page.waitForTimeout(1500);

      const afterEditText = await page.textContent('body');
      assert(afterEditText.includes('Phase 2 Extension Block'), 'Address edits persist cleanly to account');
    }

    // Delete all addresses and verify persistence down to 0 without resurrection
    console.log(`\n--- Phase 8B: Delete All Addresses & Non-Resurrection Invariant ---`);
    let deleteButtons = page.locator('button[title="Delete address"]');
    while ((await deleteButtons.count()) > 0) {
      await deleteButtons.first().click();
      await page.waitForTimeout(400);
      const confirmDeleteBtn = page.locator('button:has-text("Confirm Delete")');
      if (await confirmDeleteBtn.isVisible().catch(() => false)) {
        await confirmDeleteBtn.click();
        await page.waitForTimeout(1000);
      }
      deleteButtons = page.locator('button[title="Delete address"]');
    }

    // Verify 0 saved addresses on addresses page
    const emptyAddrText = await page.textContent('body');
    assert(emptyAddrText.includes('No saved addresses found'), 'Address Book confirms "No saved addresses found" after explicit deletions');

    // Reload /account and verify it does NOT resurrect deleted addresses
    await page.goto(`${BASE_URL}/account`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const accountAfterDeleteText = await page.textContent('body');
    assert(
      accountAfterDeleteText.includes('0 Saved') && accountAfterDeleteText.includes('No default address saved yet'),
      'Account dashboard strictly retains "0 Saved" addresses without resurrecting past placed orders'
    );

    // -------------------------------------------------------------------------
    // Phase 9: 10 Viewports Responsive Audit (Zero Horizontal Overflow)
    // -------------------------------------------------------------------------
    console.log(`\n--- Phase 9: 10-Viewport Responsiveness & Zero Overflow Audit ---`);
    const pagesToAudit = ['/checkout', '/account', '/account/addresses'];

    for (const testPage of pagesToAudit) {
      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${BASE_URL}${testPage}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(300);

        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth - window.innerWidth;
        });

        assert(
          overflow <= 1, // allow <= 1px sub-pixel rendering variation
          `Page ${testPage} at ${vp.name} (${vp.width}x${vp.height}px) has 0px horizontal overflow (diff=${overflow}px)`
        );
      }
    }

    console.log(`\n===============================================================`);
    console.log(`  ALL E2E AUDIT CHECKS PASSED: ${passCount} Passed, ${failCount} Failed`);
    console.log(`===============================================================\n`);
  } finally {
    // Clean up created test customer
    if (createdCustomerId) {
      try {
        console.log(`\n  Cleaning up test customer account (${createdCustomerId})...`);
        deleteCustomer(createdCustomerId);
      } catch (cleanErr) {
        // ignore
      }
    }
    await browser.close();
  }
}

runTest().catch((err) => {
  console.error('\n✖ Fatal Playwright test error:', err);
  process.exit(1);
});
