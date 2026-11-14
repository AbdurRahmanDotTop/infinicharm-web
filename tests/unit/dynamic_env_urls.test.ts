import { test, describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAppOrigin,
  getAppEnvironment,
  isProduction,
  isDevelopment,
  getUrlDetails,
  buildAbsoluteUrl,
  getApiUrl,
  getAuthCallbackUrl,
  getEmailVerificationUrl,
  getPasswordResetUrl,
  getUnsubscribeUrl,
  getProductShareUrl,
  getCategoryShareUrl,
  getOrderTrackingUrl,
  getAdminUrl,
  getCustomerDashboardUrl,
  getWebhookUrl,
  getSitemapUrl,
  getCanonicalUrl,
  syncClientEnvironmentOrigin,
  STORAGE_KEYS,
  CANONICAL_DOMAINS,
} from '../../src/lib/utils/env-urls.ts';

describe('Dynamic URL & Environment Detection Engine (PRD 01, 02, 14, 16)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('1. Resolves local development origin from headers (localhost:3000 and arbitrary ports)', () => {
    const mockReq = {
      headers: new Headers({
        host: 'localhost:3000',
      }),
    };
    const origin = getAppOrigin(mockReq as any);
    assert.strictEqual(origin, 'http://localhost:3000');
    assert.strictEqual(isDevelopment(mockReq as any), true);
    assert.strictEqual(isProduction(mockReq as any), false);

    // Arbitrary dev port e.g. 3001
    const mockReq3001 = {
      headers: new Headers({
        'x-forwarded-host': 'localhost:3001',
        'x-forwarded-proto': 'http',
      }),
    };
    assert.strictEqual(getAppOrigin(mockReq3001 as any), 'http://localhost:3001');

    // 127.0.0.1
    const mockReqIp = {
      headers: new Headers({
        host: '127.0.0.1:8080',
      }),
    };
    assert.strictEqual(getAppOrigin(mockReqIp as any), 'http://127.0.0.1:8080');
  });

  it('2. Resolves live production domain (https://infinicharm.com) from reverse proxy headers', () => {
    const mockReq = {
      headers: new Headers({
        'x-forwarded-host': 'infinicharm.com',
        'x-forwarded-proto': 'https',
      }),
    };
    const origin = getAppOrigin(mockReq as any);
    assert.strictEqual(origin, 'https://infinicharm.com');
    assert.strictEqual(isProduction(mockReq as any), true);
    assert.strictEqual(isDevelopment(mockReq as any), false);
  });

  it('3. Respects nextUrl.origin when present on NextRequest', () => {
    const mockNextReq = {
      nextUrl: {
        origin: 'https://staging.infinicharm.com',
        pathname: '/shop',
      },
    };
    const origin = getAppOrigin(mockNextReq as any);
    assert.strictEqual(origin, 'https://staging.infinicharm.com');
  });

  it('4. Uses fallback hierarchy when no request context is provided', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.SITE_URL;

    // In production NODE_ENV, defaults to canonical production domain
    (process.env as any).NODE_ENV = 'production';
    assert.strictEqual(getAppOrigin(), CANONICAL_DOMAINS.PRODUCTION);

    // When NEXT_PUBLIC_APP_URL is provided, it takes precedence
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000/';
    assert.strictEqual(getAppOrigin(), 'http://localhost:3000');
  });

  it('5. Decomposes origin details accurately via getUrlDetails', () => {
    const localDetails = getUrlDetails('http://localhost:3000');
    assert.strictEqual(localDetails.origin, 'http://localhost:3000');
    assert.strictEqual(localDetails.protocol, 'http:');
    assert.strictEqual(localDetails.host, 'localhost:3000');
    assert.strictEqual(localDetails.hostname, 'localhost');
    assert.strictEqual(localDetails.port, '3000');
    assert.strictEqual(localDetails.isDevelopment, true);
    assert.strictEqual(localDetails.isProduction, false);

    const prodDetails = getUrlDetails('https://infinicharm.com');
    assert.strictEqual(prodDetails.origin, 'https://infinicharm.com');
    assert.strictEqual(prodDetails.protocol, 'https:');
    assert.strictEqual(prodDetails.host, 'infinicharm.com');
    assert.strictEqual(prodDetails.hostname, 'infinicharm.com');
    assert.strictEqual(prodDetails.port, '');
    assert.strictEqual(prodDetails.isProduction, true);
    assert.strictEqual(prodDetails.isDevelopment, false);
  });

  it('6. Generates consistent, sanitized API URLs', () => {
    const origin = 'http://localhost:3000';
    assert.strictEqual(getApiUrl('orders', origin), 'http://localhost:3000/api/orders');
    assert.strictEqual(getApiUrl('/orders', origin), 'http://localhost:3000/api/orders');
    assert.strictEqual(getApiUrl('/api/orders', origin), 'http://localhost:3000/api/orders');
    assert.strictEqual(getApiUrl('api/orders', origin), 'http://localhost:3000/api/orders');
  });

  it('7. Generates complete authentication redirect and callback URLs', () => {
    const origin = 'http://localhost:3000';
    assert.strictEqual(getAuthCallbackUrl('login', origin), 'http://localhost:3000/account/login');
    assert.strictEqual(getAuthCallbackUrl('register', origin), 'http://localhost:3000/account/register');
    assert.strictEqual(getAuthCallbackUrl('verify-email', origin), 'http://localhost:3000/verify-email');
    assert.strictEqual(getAuthCallbackUrl('reset-password', origin), 'http://localhost:3000/reset-password');
    assert.strictEqual(getAuthCallbackUrl('account', origin), 'http://localhost:3000/account');
    assert.strictEqual(getAuthCallbackUrl('admin', origin), 'http://localhost:3000/admin');
  });

  it('8. Generates secure tokenized email verification and password reset links', () => {
    const localOrigin = 'http://localhost:3000';
    const prodOrigin = 'https://infinicharm.com';

    // Email verification
    const localVerify = getEmailVerificationUrl('tok_12345', '/checkout', localOrigin);
    assert.strictEqual(localVerify, 'http://localhost:3000/verify-email?token=tok_12345&redirect=%2Fcheckout');

    const prodVerify = getEmailVerificationUrl('tok_12345', undefined, prodOrigin);
    assert.strictEqual(prodVerify, 'https://infinicharm.com/verify-email?token=tok_12345');

    // Password reset
    const localReset = getPasswordResetUrl('reset_abc99', 'user@example.com', localOrigin);
    assert.strictEqual(localReset, 'http://localhost:3000/reset-password?token=reset_abc99&email=user%40example.com');

    const prodReset = getPasswordResetUrl('reset_abc99', undefined, prodOrigin);
    assert.strictEqual(prodReset, 'https://infinicharm.com/reset-password?token=reset_abc99');

    // Unsubscribe link
    assert.strictEqual(getUnsubscribeUrl('unsub_tok', localOrigin), 'http://localhost:3000/unsubscribe?token=unsub_tok');
    assert.strictEqual(getUnsubscribeUrl(null, prodOrigin), 'https://infinicharm.com/unsubscribe');
  });

  it('9. Generates dynamic sharing and order tracking URLs', () => {
    const localOrigin = 'http://localhost:3000';
    const prodOrigin = 'https://infinicharm.com';

    // Product share
    assert.strictEqual(
      getProductShareUrl('100-kashmiri-honey', localOrigin),
      'http://localhost:3000/product/100-kashmiri-honey'
    );
    assert.strictEqual(
      getProductShareUrl('100-kashmiri-honey', prodOrigin),
      'https://infinicharm.com/product/100-kashmiri-honey'
    );

    // Category share
    assert.strictEqual(
      getCategoryShareUrl('honey', localOrigin),
      'http://localhost:3000/shop?category=honey'
    );

    // Order tracking
    assert.strictEqual(
      getOrderTrackingUrl('INF-202611-1234', localOrigin),
      'http://localhost:3000/track-order?id=INF-202611-1234'
    );
    assert.strictEqual(
      getOrderTrackingUrl('INF-202611-1234', prodOrigin),
      'https://infinicharm.com/track-order?id=INF-202611-1234'
    );
  });

  it('10. Generates payment gateway webhook and administrative URLs dynamically', () => {
    const localOrigin = 'http://localhost:3000';
    const prodOrigin = 'https://infinicharm.com';

    assert.strictEqual(getWebhookUrl('razorpay', localOrigin), 'http://localhost:3000/api/webhooks/razorpay');
    assert.strictEqual(getWebhookUrl('phonepe', prodOrigin), 'https://infinicharm.com/api/webhooks/phonepe');
    assert.strictEqual(getWebhookUrl('custom-upi', localOrigin), 'http://localhost:3000/api/webhooks/custom-upi');

    assert.strictEqual(getAdminUrl('orders', localOrigin), 'http://localhost:3000/admin/orders');
    assert.strictEqual(getCustomerDashboardUrl('orders', prodOrigin), 'https://infinicharm.com/account/orders');
    assert.strictEqual(getSitemapUrl(prodOrigin), 'https://infinicharm.com/sitemap.xml');
    assert.strictEqual(getCanonicalUrl('/about', prodOrigin), 'https://infinicharm.com/about');
  });

  it('11. Client-Side Simulation: First-visit detection records origin and timestamps', () => {
    const mockStore: Record<string, string> = {};
    const mockDocument = { cookie: '' };

    // Set up mock window and localStorage
    (global as any).window = {
      location: { origin: 'http://localhost:3000' },
    };
    (global as any).localStorage = {
      getItem: (k: string) => mockStore[k] || null,
      setItem: (k: string, v: string) => { mockStore[k] = v; },
    };
    (global as any).document = mockDocument;

    try {
      // 1st visit
      const res1 = syncClientEnvironmentOrigin();
      assert.strictEqual(res1.isFirstVisit, true);
      assert.strictEqual(res1.hasChanged, false);
      assert.strictEqual(res1.origin, 'http://localhost:3000');
      assert.strictEqual(mockStore[STORAGE_KEYS.ORIGIN], 'http://localhost:3000');
      assert.ok(mockStore[STORAGE_KEYS.FIRST_VISIT]);
      assert.ok(mockDocument.cookie.includes('infinicharm_origin=http%3A%2F%2Flocalhost%3A3000'));

      // 2nd visit (same origin)
      const res2 = syncClientEnvironmentOrigin();
      assert.strictEqual(res2.isFirstVisit, false);
      assert.strictEqual(res2.hasChanged, false);
      assert.strictEqual(res2.origin, 'http://localhost:3000');

      // Port or environment change simulation (switched to localhost:3001)
      (global as any).window.location.origin = 'http://localhost:3001';
      const res3 = syncClientEnvironmentOrigin();
      assert.strictEqual(res3.hasChanged, true);
      assert.strictEqual(res3.origin, 'http://localhost:3001');
      assert.strictEqual(mockStore[STORAGE_KEYS.ORIGIN], 'http://localhost:3001');
      assert.ok(mockDocument.cookie.includes('infinicharm_origin=http%3A%2F%2Flocalhost%3A3001'));

      // Invariant: Stale stored origin must NEVER override live window.location.origin
      mockStore[STORAGE_KEYS.ORIGIN] = 'http://localhost:9999-stale';
      const live = getAppOrigin();
      assert.strictEqual(live, 'http://localhost:3001');
    } finally {
      delete (global as any).window;
      delete (global as any).localStorage;
      delete (global as any).document;
    }
  });

  it('12. Invariant: Zero 24-hour expiration on environment configuration', () => {
    // Audit check: Verify that no arbitrary 24-hour timeout deletes or resets stored origin
    const mockStore: Record<string, string> = {
      [STORAGE_KEYS.ORIGIN]: 'http://localhost:3000',
      [STORAGE_KEYS.FIRST_VISIT]: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), // 48 hours ago
    };
    (global as any).window = {
      location: { origin: 'http://localhost:3000' },
    };
    (global as any).localStorage = {
      getItem: (k: string) => mockStore[k] || null,
      setItem: (k: string, v: string) => { mockStore[k] = v; },
    };
    (global as any).document = { cookie: '' };

    try {
      const res = syncClientEnvironmentOrigin();
      // Should NOT treat as first visit or discard configuration after 48 hours
      assert.strictEqual(res.isFirstVisit, false);
      assert.strictEqual(res.origin, 'http://localhost:3000');
      assert.strictEqual(mockStore[STORAGE_KEYS.ORIGIN], 'http://localhost:3000');
    } finally {
      delete (global as any).window;
      delete (global as any).localStorage;
      delete (global as any).document;
    }
  });
});

