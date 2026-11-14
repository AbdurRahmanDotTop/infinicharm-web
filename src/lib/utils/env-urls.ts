// ==============================================================================
// InfiniCharm — Centralized Dynamic URL & Environment Detection Engine
// Governing PRDs: PRD 01, PRD 02, PRD 14, PRD 16
// Single Source of Truth for Application URLs, Origins, Routes, and Callbacks
// Standard: Zero Mock Data, Automatic Environment Resolution, Strict DRY
// ==============================================================================

export type AppEnvironment = 'development' | 'production' | 'test';

export interface UrlDetails {
  origin: string;
  protocol: 'http:' | 'https:';
  host: string;
  hostname: string;
  port: string;
  environment: AppEnvironment;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
}

export type RequestContext =
  | Request
  | {
      headers?:
        | Headers
        | Record<string, string | string[] | undefined>
        | { get(name: string): string | null };
      nextUrl?: {
        origin?: string;
        pathname?: string;
        protocol?: string;
        host?: string;
        port?: string;
      };
      url?: string;
      cookies?: { get(name: string): { value?: string } | undefined };
    }
  | string
  | null
  | undefined;

export const STORAGE_KEYS = {
  ORIGIN: 'infinicharm_app_origin',
  FIRST_VISIT: 'infinicharm_first_visit_at',
  LAST_SYNC: 'infinicharm_origin_last_synced_at',
  COOKIE_ORIGIN: 'infinicharm_origin',
} as const;

export const CANONICAL_DOMAINS = {
  PRODUCTION: 'https://infinicharm.com',
  PRODUCTION_WWW: 'https://www.infinicharm.com',
  DEVELOPMENT: 'http://localhost:3000',
} as const;

/**
 * Extracts a header value safely from Web Headers or plain record objects.
 */
function getHeaderValue(
  headers: any,
  name: string
): string | null {
  if (!headers) return null;
  if (typeof headers.get === 'function') {
    return headers.get(name);
  }
  const obj = headers as Record<string, string | string[] | undefined>;
  const val = obj[name] ?? obj[name.toLowerCase()] ?? obj[name.toUpperCase()];
  if (Array.isArray(val)) return val[0] || null;
  return typeof val === 'string' ? val : null;
}

/**
 * Normalizes an origin or URL string, stripping trailing slashes.
 */
export function sanitizeOrigin(origin: string): string {
  if (!origin) return '';
  return origin.trim().replace(/\/+$/, '');
}

/**
 * Determines whether a given host or origin represents local development.
 */
export function isLocalHost(hostOrOrigin: string): boolean {
  if (!hostOrOrigin) return false;
  const lower = hostOrOrigin.toLowerCase();
  return (
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('[::1]') ||
    lower.includes('0.0.0.0') ||
    lower.endsWith('.local') ||
    lower.includes(':3000') ||
    lower.includes(':3001') ||
    lower.includes(':8080')
  );
}

/**
 * Centralized Application Origin Resolver.
 * Automatically discovers origin from client window, incoming HTTP headers,
 * environment variables, or fallback hierarchy.
 */
export function getAppOrigin(context?: RequestContext): string {
  // 1. Explicit string origin passed
  if (typeof context === 'string') {
    const trimmed = context.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        return sanitizeOrigin(new URL(trimmed).origin);
      } catch {
        return sanitizeOrigin(trimmed);
      }
    }
    if (trimmed) return sanitizeOrigin(trimmed);
  }

  // 2. Client Browser Context (window.location.origin is authoritative)
  if (typeof window !== 'undefined' && window.location?.origin) {
    const clientOrigin = sanitizeOrigin(window.location.origin);
    if (clientOrigin && clientOrigin !== 'null') {
      return clientOrigin;
    }
  }

  // 3. Server Request Context (NextRequest, Request, or headers object)
  if (context && typeof context === 'object') {
    const ctx = context as {
      headers?: any;
      nextUrl?: { origin?: string; pathname?: string };
      url?: string;
      cookies?: { get(name: string): { value?: string } | undefined };
    };

    if (ctx.headers) {
      const forwardedHost = getHeaderValue(ctx.headers, 'x-forwarded-host');
      const host = forwardedHost || getHeaderValue(ctx.headers, 'host');

      if (host) {
        const rawProto =
          getHeaderValue(ctx.headers, 'x-forwarded-proto') ||
          getHeaderValue(ctx.headers, 'cf-visitor');
        let proto = 'https';

        if (rawProto) {
          if (rawProto.includes('https')) proto = 'https';
          else if (rawProto.includes('http')) proto = 'http';
        } else if (isLocalHost(host)) {
          proto = 'http';
        }

        const cleanHost = host.split(',')[0].trim();
        return sanitizeOrigin(`${proto}://${cleanHost}`);
      }
    }

    if (ctx.nextUrl?.origin && ctx.nextUrl.origin !== 'null') {
      return sanitizeOrigin(ctx.nextUrl.origin);
    }

    if (ctx.url && typeof ctx.url === 'string') {
      try {
        const parsed = new URL(ctx.url);
        return sanitizeOrigin(parsed.origin);
      } catch {
        // Continue to fallback
      }
    }

    // Check cookie fallback if present
    if (typeof ctx.cookies?.get === 'function') {
      const cookieVal = ctx.cookies.get(STORAGE_KEYS.COOKIE_ORIGIN)?.value;
      if (cookieVal) {
        try {
          const decoded = decodeURIComponent(cookieVal);
          if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
            return sanitizeOrigin(decoded);
          }
        } catch {
          // Ignore invalid cookie
        }
      }
    }
  }

  // 4. Environment Variables Hierarchy
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null) ||
    process.env.CF_PAGES_URL;

  if (envUrl && typeof envUrl === 'string') {
    const cleaned = sanitizeOrigin(envUrl);
    if (cleaned) return cleaned;
  }

  // 5. Canonical Fallback based on NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    return CANONICAL_DOMAINS.PRODUCTION;
  }

  return CANONICAL_DOMAINS.DEVELOPMENT;
}

/**
 * Returns the current application environment type.
 */
export function getAppEnvironment(context?: RequestContext): AppEnvironment {
  if (process.env.NODE_ENV === 'test') {
    return 'test';
  }
  const origin = getAppOrigin(context);
  if (isLocalHost(origin)) {
    return 'development';
  }
  if (origin.includes('infinicharm.com')) {
    return 'production';
  }
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

/**
 * Returns true if running in production environment.
 */
export function isProduction(context?: RequestContext): boolean {
  return getAppEnvironment(context) === 'production';
}

/**
 * Returns true if running in development environment.
 */
export function isDevelopment(context?: RequestContext): boolean {
  return getAppEnvironment(context) === 'development';
}

/**
 * Decomposes origin into structured URL components.
 */
export function getUrlDetails(context?: RequestContext): UrlDetails {
  const origin = getAppOrigin(context);
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    parsed = new URL(CANONICAL_DOMAINS.DEVELOPMENT);
  }

  const env = getAppEnvironment(context);

  return {
    origin,
    protocol: parsed.protocol as 'http:' | 'https:',
    host: parsed.host,
    hostname: parsed.hostname,
    port: parsed.port,
    environment: env,
    isProduction: env === 'production',
    isDevelopment: env === 'development',
    isTest: env === 'test',
  };
}

/**
 * Client-Side First-Visit Detection & Origin Synchronization Engine.
 * Persists detected environment safely and revalidates dynamically on hard refresh.
 * Never allows stale stored origin to override live origin.
 */
export function syncClientEnvironmentOrigin(): {
  origin: string;
  isFirstVisit: boolean;
  hasChanged: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      origin: getAppOrigin(),
      isFirstVisit: false,
      hasChanged: false,
    };
  }

  const liveOrigin = sanitizeOrigin(window.location.origin);
  let storedOrigin: string | null = null;
  let firstVisitTimestamp: string | null = null;

  try {
    storedOrigin = localStorage.getItem(STORAGE_KEYS.ORIGIN);
    firstVisitTimestamp = localStorage.getItem(STORAGE_KEYS.FIRST_VISIT);
  } catch {
    // Storage access blocked or restricted
  }

  const isFirstVisit = !storedOrigin && !firstVisitTimestamp;
  const hasChanged = Boolean(storedOrigin && storedOrigin !== liveOrigin);

  try {
    if (isFirstVisit) {
      localStorage.setItem(STORAGE_KEYS.FIRST_VISIT, new Date().toISOString());
      localStorage.setItem(STORAGE_KEYS.ORIGIN, liveOrigin);
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    } else if (hasChanged || !storedOrigin) {
      localStorage.setItem(STORAGE_KEYS.ORIGIN, liveOrigin);
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    }

    // Set cookie for server hydration alignment (no 24h expiration on environment)
    document.cookie = `${STORAGE_KEYS.COOKIE_ORIGIN}=${encodeURIComponent(liveOrigin)}; Path=/; SameSite=Lax; Max-Age=31536000`;
  } catch {
    // Storage write failed
  }

  return {
    origin: liveOrigin,
    isFirstVisit,
    hasChanged,
  };
}

/**
 * Builds an absolute URL with the resolved origin.
 */
export function buildAbsoluteUrl(path: string, context?: RequestContext): string {
  if (!path) return getAppOrigin(context);
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const base = getAppOrigin(context);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Returns absolute API route URL.
 */
export function getApiUrl(endpoint: string, context?: RequestContext): string {
  let cleanEndpoint = endpoint.trim();
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.substring(5);
  } else if (cleanEndpoint.startsWith('api/')) {
    cleanEndpoint = cleanEndpoint.substring(4);
  } else if (cleanEndpoint.startsWith('/')) {
    cleanEndpoint = cleanEndpoint.substring(1);
  }
  return buildAbsoluteUrl(`/api/${cleanEndpoint}`, context);
}

/**
 * Returns absolute auth callback or redirect URL.
 */
export function getAuthCallbackUrl(
  action: 'login' | 'register' | 'verify-email' | 'reset-password' | 'account' | 'admin' | string,
  context?: RequestContext
): string {
  switch (action) {
    case 'login':
      return buildAbsoluteUrl('/account/login', context);
    case 'register':
      return buildAbsoluteUrl('/account/register', context);
    case 'verify-email':
      return buildAbsoluteUrl('/verify-email', context);
    case 'reset-password':
      return buildAbsoluteUrl('/reset-password', context);
    case 'account':
      return buildAbsoluteUrl('/account', context);
    case 'admin':
      return buildAbsoluteUrl('/admin', context);
    default:
      return buildAbsoluteUrl(action, context);
  }
}

/**
 * Returns absolute email verification URL with token.
 */
export function getEmailVerificationUrl(
  token: string,
  redirectPath?: string,
  context?: RequestContext
): string {
  const query = new URLSearchParams();
  query.set('token', token);
  if (redirectPath && redirectPath.trim()) {
    query.set('redirect', redirectPath.trim());
  }
  return buildAbsoluteUrl(`/verify-email?${query.toString()}`, context);
}

/**
 * Returns absolute password reset URL with token.
 */
export function getPasswordResetUrl(
  token: string,
  email?: string,
  context?: RequestContext
): string {
  const query = new URLSearchParams();
  query.set('token', token);
  if (email && email.trim()) {
    query.set('email', email.trim());
  }
  return buildAbsoluteUrl(`/reset-password?${query.toString()}`, context);
}

/**
 * Returns absolute newsletter unsubscribe URL with optional token.
 */
export function getUnsubscribeUrl(
  token?: string | null,
  context?: RequestContext
): string {
  if (!token) return buildAbsoluteUrl('/unsubscribe', context);
  return buildAbsoluteUrl(`/unsubscribe?token=${encodeURIComponent(token)}`, context);
}

/**
 * Returns absolute product sharing URL.
 */
export function getProductShareUrl(slug?: string | null, context?: RequestContext): string {
  if (!slug || !slug.trim()) return buildAbsoluteUrl('/shop', context);
  return buildAbsoluteUrl(`/product/${encodeURIComponent(slug.trim())}`, context);
}

/**
 * Returns absolute category sharing URL.
 */
export function getCategoryShareUrl(categorySlug?: string | null, context?: RequestContext): string {
  if (!categorySlug || !categorySlug.trim()) return buildAbsoluteUrl('/shop', context);
  return buildAbsoluteUrl(`/shop?category=${encodeURIComponent(categorySlug.trim())}`, context);
}

/**
 * Returns absolute order tracking URL.
 */
export function getOrderTrackingUrl(orderNumberOrId: string, context?: RequestContext): string {
  return buildAbsoluteUrl(`/track-order?id=${encodeURIComponent(orderNumberOrId)}`, context);
}

/**
 * Returns absolute shareable HTTPS payment page URL.
 * Standard web URL copyable into WhatsApp, SMS, Telegram, Email, and browsers.
 */
export function getPaymentUrl(
  orderNumberOrId: string,
  token?: string | null,
  context?: RequestContext
): string {
  const clean = (orderNumberOrId || '').trim();
  const subpath = clean ? `/pay/${encodeURIComponent(clean)}` : '/pay';
  if (token && token.trim()) {
    const sep = subpath.includes('?') ? '&' : '?';
    return buildAbsoluteUrl(`${subpath}${sep}token=${encodeURIComponent(token.trim())}`, context);
  }
  return buildAbsoluteUrl(subpath, context);
}

/**
 * Returns absolute admin portal URL.
 */
export function getAdminUrl(subpath: string = '', context?: RequestContext): string {
  const clean = subpath.trim();
  if (!clean) return buildAbsoluteUrl('/admin', context);
  const formatted = clean.startsWith('/') ? clean : `/${clean}`;
  return buildAbsoluteUrl(`/admin${formatted}`, context);
}

/**
 * Returns absolute customer dashboard URL.
 */
export function getCustomerDashboardUrl(subpath: string = '', context?: RequestContext): string {
  const clean = subpath.trim();
  if (!clean) return buildAbsoluteUrl('/account', context);
  const formatted = clean.startsWith('/') ? clean : `/${clean}`;
  return buildAbsoluteUrl(`/account${formatted}`, context);
}

/**
 * Returns absolute payment webhook URL for a given gateway.
 */
export function getWebhookUrl(gatewayId: string, context?: RequestContext): string {
  const cleanId = encodeURIComponent(gatewayId.toLowerCase().trim());
  return buildAbsoluteUrl(`/api/webhooks/${cleanId}`, context);
}

/**
 * Returns absolute sitemap URL.
 */
export function getSitemapUrl(context?: RequestContext): string {
  return buildAbsoluteUrl('/sitemap.xml', context);
}

/**
 * Returns absolute canonical URL for a given pathname.
 */
export function getCanonicalUrl(pathname: string = '', context?: RequestContext): string {
  return buildAbsoluteUrl(pathname, context);
}
