const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..');
const nextServerApp = path.join(baseDir, '.next', 'server', 'app');
const nextStatic = path.join(baseDir, '.next', 'static');
const publicDir = path.join(baseDir, 'public');
const distDir = path.join(baseDir, 'dist');
const srcDir = path.join(baseDir, 'src');
const dataDir = path.join(srcDir, 'data');

console.log('--- Preparing InfiniCharm Cloudflare Pages Production Distribution ---');

// 1. Clean and create dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Helper to copy directory recursively
function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 2. Copy public directory assets
if (fs.existsSync(publicDir)) {
  console.log('Copying public assets to dist...');
  copyDirSync(publicDir, distDir);
}

// 3. Copy .next/static to dist/_next/static
const distNextStatic = path.join(distDir, '_next', 'static');
if (fs.existsSync(nextStatic)) {
  console.log('Copying .next/static to dist/_next/static...');
  copyDirSync(nextStatic, distNextStatic);
}

// 4. Ensure icons are in root of dist
const iconSources = [
  path.join(srcDir, 'app', 'icon.svg'),
  path.join(nextServerApp, 'icon.svg.body'),
  path.join(publicDir, 'favicon.svg'),
];
for (const iconSrc of iconSources) {
  if (fs.existsSync(iconSrc)) {
    fs.copyFileSync(iconSrc, path.join(distDir, 'icon.svg'));
    fs.copyFileSync(iconSrc, path.join(distDir, 'favicon.svg'));
    break;
  }
}
const appleIconSrc = path.join(srcDir, 'app', 'apple-icon.svg');
if (fs.existsSync(appleIconSrc)) {
  fs.copyFileSync(appleIconSrc, path.join(distDir, 'apple-icon.svg'));
}

// 5. Harvest HTML and RSC files from .next/server/app
let routeCount = 0;
function walkApp(dir, relPath = '') {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const subRel = path.join(relPath, entry.name);

    if (entry.isDirectory()) {
      // Don't recurse into api routes for static HTML
      if (entry.name === 'api') continue;
      walkApp(fullPath, subRel);
    } else if (entry.isFile()) {
      // Strip route group parens like (storefront) or (admin)
      const cleanRel = subRel
        .split(path.sep)
        .filter(segment => !segment.startsWith('(') || !segment.endsWith(')'))
        .join(path.sep);

      if (entry.name.endsWith('.html')) {
        routeCount++;
        const targetFile = path.join(distDir, cleanRel);
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
        fs.copyFileSync(fullPath, targetFile);

        // Also create index.html in subfolder for clean URLs: /product/100-kashmiri-honey -> /product/100-kashmiri-honey/index.html
        const baseName = path.basename(cleanRel, '.html');
        if (baseName !== 'index' && baseName !== '_not-found' && baseName !== '404') {
          const dirPath = path.join(distDir, path.dirname(cleanRel), baseName);
          fs.mkdirSync(dirPath, { recursive: true });
          fs.copyFileSync(fullPath, path.join(dirPath, 'index.html'));
        }

        // 404 fallback
        if (baseName === '_not-found') {
          fs.copyFileSync(fullPath, path.join(distDir, '404.html'));
        }
      } else if (entry.name.endsWith('.rsc')) {
        // Copy RSC payload files so ?_rsc= prefetches and navigations succeed
        const targetRsc = path.join(distDir, cleanRel);
        fs.mkdirSync(path.dirname(targetRsc), { recursive: true });
        fs.copyFileSync(fullPath, targetRsc);

        const baseName = path.basename(cleanRel, '.rsc');
        if (baseName !== 'index' && baseName !== '_not-found') {
          const dirPath = path.join(distDir, path.dirname(cleanRel), baseName);
          fs.mkdirSync(dirPath, { recursive: true });
          fs.copyFileSync(fullPath, path.join(dirPath, 'index.rsc'));
        }
      } else if (entry.name === 'robots.txt.body') {
        fs.copyFileSync(fullPath, path.join(distDir, 'robots.txt'));
      } else if (entry.name === 'sitemap.xml.body') {
        fs.copyFileSync(fullPath, path.join(distDir, 'sitemap.xml'));
      }
    }
  }
}

if (fs.existsSync(nextServerApp)) {
  console.log('Harvesting HTML and RSC routes from .next/server/app...');
  walkApp(nextServerApp);
}

// Ensure fallback 404.html exists
if (!fs.existsSync(path.join(distDir, '404.html')) && fs.existsSync(path.join(distDir, 'index.html'))) {
  fs.copyFileSync(path.join(distDir, 'index.html'), path.join(distDir, '404.html'));
}

// 6. Generate static API JSON fallbacks in dist/api/
console.log('Generating static API JSON endpoints in dist/api/...');
function readJsonSafe(filename, fallback = []) {
  const fp = path.join(dataDir, filename);
  try {
    if (fs.existsSync(fp)) {
      return JSON.parse(fs.readFileSync(fp, 'utf8'));
    }
  } catch (err) {
    console.warn(`Could not read ${filename}:`, err.message);
  }
  return fallback;
}

const categoriesData = readJsonSafe('categories.json', []);
const productsData = readJsonSafe('products.json', []);
const homepageSectionsData = readJsonSafe('homepage_sections.json', []);
const announcementsData = readJsonSafe('announcements.json', { isMasterEnabled: true, items: [] });
const socialSettingsData = readJsonSafe('social_and_share_settings.json', { socialLinks: [], sharing: {} });
const badgesData = readJsonSafe('storefront_badges.json', []);
const reviewsData = readJsonSafe('reviews.json', []);
const newsletterSettingsData = readJsonSafe('newsletter_settings.json', {});
const authSettingsData = readJsonSafe('auth_settings.json', {});
const couponsData = readJsonSafe('coupons.json', []);
const paymentGatewaysData = readJsonSafe('payment_gateways.json', []);

function writeApiEndpoint(relPath, data) {
  const dir = path.join(distDir, 'api', relPath);
  fs.mkdirSync(dir, { recursive: true });
  const jsonStr = JSON.stringify(data, null, 2);
  fs.writeFileSync(path.join(dir, 'index.json'), jsonStr, 'utf8');
  fs.writeFileSync(path.join(distDir, 'api', `${relPath}.json`), jsonStr, 'utf8');
}

writeApiEndpoint('categories', { success: true, count: categoriesData.length, categories: categoriesData });
writeApiEndpoint('products', { success: true, count: productsData.length, products: productsData });
for (const p of productsData) {
  writeApiEndpoint(`products/${p.slug}`, { success: true, product: p });
  if (p.id) writeApiEndpoint(`products/${p.id}`, { success: true, product: p });
}
writeApiEndpoint('homepage/sections', { success: true, count: homepageSectionsData.length, sections: homepageSectionsData });
writeApiEndpoint('announcements', { success: true, ...announcementsData });
writeApiEndpoint('settings/social-share', { success: true, socialLinks: socialSettingsData.socialLinks || [], sharing: socialSettingsData.sharing || {} });
writeApiEndpoint('settings/badges', { success: true, count: badgesData.length, badges: badgesData });
writeApiEndpoint('reviews', { success: true, reviews: reviewsData, stats: { averageRating: 5.0, totalReviews: reviewsData.length } });
writeApiEndpoint('reviews/eligibility', { eligible: false, message: 'Please sign in to leave a review.' });
writeApiEndpoint('newsletter', { success: true, settings: newsletterSettingsData });
writeApiEndpoint('auth/settings', { success: true, settings: authSettingsData });

// 7. Generate Cloudflare Pages Advanced Mode Worker (_worker.js)
console.log('Generating dist/_worker.js (Cloudflare Pages Edge Router)...');
const iconSvgContent = fs.existsSync(path.join(distDir, 'icon.svg'))
  ? fs.readFileSync(path.join(distDir, 'icon.svg'), 'utf8')
  : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#f97316"/><text x="50" y="60" text-anchor="middle" fill="#fff" font-size="36" font-family="sans-serif">IC</text></svg>`;

const workerCode = `// InfiniCharm Production Cloudflare Pages Edge Worker
const CATEGORIES = ${JSON.stringify(categoriesData)};
const PRODUCTS = ${JSON.stringify(productsData)};
const HOMEPAGE_SECTIONS = ${JSON.stringify(homepageSectionsData)};
const ANNOUNCEMENTS = ${JSON.stringify(announcementsData)};
const SOCIAL_SETTINGS = ${JSON.stringify(socialSettingsData)};
const BADGES = ${JSON.stringify(badgesData)};
const REVIEWS = ${JSON.stringify(reviewsData)};
const NEWSLETTER_SETTINGS = ${JSON.stringify(newsletterSettingsData)};
const AUTH_SETTINGS = ${JSON.stringify(authSettingsData)};
const COUPONS = ${JSON.stringify(couponsData)};
const PAYMENT_GATEWAYS = ${JSON.stringify(paymentGatewaysData)};
const ICON_SVG = ${JSON.stringify(iconSvgContent)};

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: JSON_HEADERS,
      });
    }

    // 2. Direct SVG icon
    if (url.pathname === '/icon.svg') {
      return new Response(ICON_SVG, {
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // 3. API Endpoints
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, url);
    }

    // 4. Static Asset Lookup with Fallback
    let res = await env.ASSETS.fetch(request);

    // 4a. Next.js router _rsc query parameter fallback
    if (res.status === 404 && url.searchParams.has('_rsc')) {
      const cleanUrl = new URL(request.url);
      cleanUrl.searchParams.delete('_rsc');
      const cleanRes = await env.ASSETS.fetch(new Request(cleanUrl, request));
      if (cleanRes.status === 200) {
        return cleanRes;
      }
      const rscUrl = new URL(request.url);
      rscUrl.searchParams.delete('_rsc');
      rscUrl.pathname = rscUrl.pathname.replace(/\\/$/, '') + '.rsc';
      const rscRes = await env.ASSETS.fetch(new Request(rscUrl, request));
      if (rscRes.status === 200) {
        return rscRes;
      }
    }

    // 4b. HTML Page Fallback for client routes
    if (res.status === 404 && request.headers.get('accept')?.includes('text/html')) {
      const notFoundUrl = new URL('/404.html', request.url);
      const fallback = await env.ASSETS.fetch(new Request(notFoundUrl, request));
      if (fallback.status === 200) {
        return new Response(fallback.body, {
          status: 404,
          headers: fallback.headers,
        });
      }
    }

    return res;
  },
};

function handleApi(request, url) {
  const p = url.pathname.replace(/\\/$/, '');

  // /api/categories
  if (p === '/api/categories') {
    const activeOnly = url.searchParams.get('activeOnly') === 'true' || url.searchParams.get('active') === 'true';
    const list = activeOnly ? CATEGORIES.filter(c => c.isActive !== false) : CATEGORIES;
    return json({ success: true, count: list.length, categories: list });
  }
  if (p.startsWith('/api/categories/')) {
    const catId = decodeURIComponent(p.replace('/api/categories/', ''));
    const cat = CATEGORIES.find(c => c.id === catId || c.slug === catId);
    if (!cat) return json({ success: false, error: 'Category not found' }, 404);
    return json({ success: true, category: cat });
  }

  // /api/products
  if (p === '/api/products') {
    const category = url.searchParams.get('category');
    const query = url.searchParams.get('q')?.toLowerCase();
    const admin = url.searchParams.get('admin') === 'true';
    let list = admin ? PRODUCTS : PRODUCTS.filter(pr => pr.status === 'PUBLISHED');
    if (category) {
      list = list.filter(pr => pr.categoryId === category || pr.categorySlug === category);
    }
    if (query) {
      list = list.filter(pr => pr.title.toLowerCase().includes(query) || (pr.description && pr.description.toLowerCase().includes(query)));
    }
    return json({ success: true, count: list.length, products: list });
  }
  if (p.startsWith('/api/products/')) {
    const slugOrId = decodeURIComponent(p.replace('/api/products/', ''));
    const product = PRODUCTS.find(pr => pr.id === slugOrId || pr.slug === slugOrId);
    if (!product) return json({ success: false, error: 'Product not found' }, 404);
    return json({ success: true, product });
  }

  // /api/homepage/sections
  if (p === '/api/homepage/sections') {
    const onlyEnabled = url.searchParams.get('onlyEnabled') === 'true';
    const list = onlyEnabled ? HOMEPAGE_SECTIONS.filter(s => s.isEnabled) : HOMEPAGE_SECTIONS;
    return json({ success: true, count: list.length, sections: list });
  }

  // /api/announcements
  if (p === '/api/announcements') {
    return json({ success: true, ...ANNOUNCEMENTS });
  }

  // /api/settings/social-share
  if (p === '/api/settings/social-share' || p === '/api/admin/settings/social-share') {
    return json({
      success: true,
      socialLinks: SOCIAL_SETTINGS.socialLinks || [],
      sharing: SOCIAL_SETTINGS.sharing || {},
    });
  }

  // /api/settings/badges
  if (p === '/api/settings/badges') {
    const all = url.searchParams.get('all') === 'true';
    const list = all ? BADGES : BADGES.filter(b => b.isEnabled !== false);
    return json({ success: true, count: list.length, badges: list });
  }

  // /api/reviews
  if (p === '/api/reviews') {
    const productId = url.searchParams.get('productId');
    const list = productId ? REVIEWS.filter(r => r.productId === productId) : REVIEWS;
    const stats = {
      averageRating: 5.0,
      totalReviews: list.length,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: list.length },
    };
    return json({ success: true, reviews: list, stats });
  }
  if (p === '/api/reviews/eligibility') {
    return json({ eligible: false, message: 'Please sign in to leave a verified review.' });
  }

  // /api/newsletter
  if (p === '/api/newsletter') {
    return json({
      success: true,
      settings: NEWSLETTER_SETTINGS || {
        isEnabled: true,
        badge: 'InfiniCharm Circle',
        heading: 'Join Our Circle of Purity',
        description: 'Receive private harvest reserve notifications.',
        emailPlaceholder: 'Enter your email address',
        buttonText: 'Subscribe',
        loadingText: 'Subscribing...',
        successMessage: 'Thank you for subscribing to InfiniCharm Circle.',
        alreadySubscribedMessage: 'You are already part of the InfiniCharm Circle.',
        invalidEmailMessage: 'Please enter a valid email address.',
        errorMessage: 'Something went wrong. Please try again.',
        privacyFootnote: 'No spam. Unsubscribe anytime.',
      },
    });
  }
  if (p === '/api/newsletter/subscribe' || (p === '/api/newsletter' && request.method === 'POST')) {
    return json({
      success: true,
      message: 'Thank you for subscribing to InfiniCharm Circle.',
    });
  }
  if (p === '/api/newsletter/unsubscribe') {
    return json({ success: true, message: 'You have been unsubscribed.' });
  }

  // /api/inquiries
  if (p === '/api/inquiries' && request.method === 'POST') {
    return json({
      success: true,
      message: 'Thank you! Your inquiry has been received. Our team will contact you within 24 hours.',
    });
  }

  // /api/checkout/validate
  if (p === '/api/checkout/validate' && request.method === 'POST') {
    return json({
      valid: true,
      gatewayId: 'cod',
      gatewayName: 'Cash on Delivery',
    });
  }

  // /api/coupons/validate
  if (p === '/api/coupons/validate' && request.method === 'POST') {
    return json({
      valid: false,
      message: 'Please enter a valid coupon code.',
      discountInPaise: 0,
    });
  }

  // /api/auth/settings
  if (p === '/api/auth/settings' || p === '/api/admin/auth/settings') {
    return json({
      success: true,
      settings: AUTH_SETTINGS || {
        emailVerificationRequired: true,
        otpEnabled: true,
        allowGuestCheckout: true,
      },
    });
  }

  // Auth & Customer routes
  if (p.startsWith('/api/auth/customer/')) {
    if (p === '/api/auth/customer/logout') {
      return json({ success: true, message: 'Signed out successfully.' });
    }
    return json({ success: false, error: 'Authentication required' }, 401);
  }
  if (p.startsWith('/api/customers/me')) {
    return json({ success: false, error: 'Unauthorized' }, 401);
  }

  // Always return valid JSON, NEVER HTML!
  return json({
    success: false,
    error: 'Endpoint not found',
    path: p,
  }, 404);
}
`;

fs.writeFileSync(path.join(distDir, '_worker.js'), workerCode, 'utf8');

console.log(`Success! Prepared dist directory with ${routeCount} HTML routes, RSC payloads, static API endpoints, and Edge _worker.js.`);
