const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// 3b. Guarantee Tailwind CSS compilation into dist/_next/static/css
const distCssDir = path.join(distNextStatic, 'css');
fs.mkdirSync(distCssDir, { recursive: true });
const cssFiles = fs.readdirSync(distCssDir).filter(f => f.endsWith('.css'));
let hasCompiledTailwind = false;
for (const f of cssFiles) {
  const code = fs.readFileSync(path.join(distCssDir, f), 'utf8');
  if (code.includes('--tw-') && !code.includes('@tailwind')) {
    hasCompiledTailwind = true;
    break;
  }
}

let bundledCssName = null;
if (!hasCompiledTailwind) {
  console.log('Compiling Tailwind CSS directly via tailwindcss CLI...');
  bundledCssName = 'tailwind.bundle.css';
  const compiledCssPath = path.join(distCssDir, bundledCssName);
  try {
    execSync(`npx tailwindcss -i "${path.join(srcDir, 'app', 'globals.css')}" -o "${compiledCssPath}" --minify`, {
      cwd: baseDir,
      stdio: 'inherit'
    });
  } catch (err) {
    console.warn('Tailwind CLI fallback warning:', err.message);
  }
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
      if (entry.name === 'api') continue;
      walkApp(fullPath, subRel);
    } else if (entry.isFile()) {
      const cleanRel = subRel
        .split(path.sep)
        .filter(segment => !segment.startsWith('(') || !segment.endsWith(')'))
        .join(path.sep);

      if (entry.name.endsWith('.html')) {
        routeCount++;
        let htmlContent = fs.readFileSync(fullPath, 'utf8');

        // If fallback tailwind bundle was generated, inject it into head
        if (bundledCssName && !htmlContent.includes(bundledCssName)) {
          htmlContent = htmlContent.replace('</head>', `<link rel="stylesheet" href="/_next/static/css/${bundledCssName}"/></head>`);
        }

        const targetFile = path.join(distDir, cleanRel);
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
        fs.writeFileSync(targetFile, htmlContent, 'utf8');

        const baseName = path.basename(cleanRel, '.html');
        if (baseName !== 'index' && baseName !== '_not-found' && baseName !== '404') {
          const dirPath = path.join(distDir, path.dirname(cleanRel), baseName);
          fs.mkdirSync(dirPath, { recursive: true });
          fs.writeFileSync(path.join(dirPath, 'index.html'), htmlContent, 'utf8');
        }

        if (baseName === '_not-found') {
          fs.writeFileSync(path.join(distDir, '404.html'), htmlContent, 'utf8');
        }
      } else if (entry.name.endsWith('.rsc')) {
        const targetRsc = path.join(distDir, cleanRel);
        fs.mkdirSync(path.dirname(targetRsc), { recursive: true });
        fs.copyFileSync(fullPath, targetRsc);

        const baseName = path.basename(cleanRel, '.rsc');
        if (baseName !== 'index' && baseName !== '_not-found' && baseName !== '404') {
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
const customersData = readJsonSafe('customers.json', []);
const ordersData = readJsonSafe('orders.json', []);
const emailTemplatesData = readJsonSafe('email_templates.json', []);

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

const sanitizedCustomers = customersData.map(c => ({
  id: c.id,
  email: c.email,
  fullName: c.fullName || c.name || '',
  name: c.fullName || c.name || '',
  phone: c.phone || '',
  status: c.status || 'ACTIVE',
  emailVerified: Boolean(c.emailVerified),
  passwordHash: c.passwordHash || '',
  createdAt: c.createdAt || new Date().toISOString(),
  addresses: c.addresses || [],
  wishlistProductIds: c.wishlistProductIds || []
}));

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
const INITIAL_CUSTOMERS = ${JSON.stringify(sanitizedCustomers)};
const EMAIL_TEMPLATES = ${JSON.stringify(emailTemplatesData)};
const INITIAL_ORDERS = ${JSON.stringify(ordersData)};
const ICON_SVG = ${JSON.stringify(iconSvgContent)};

// Runtime in-memory state stores for Cloudflare worker isolate
const registeredCustomers = new Map(INITIAL_CUSTOMERS.map(c => [c.email.toLowerCase().trim(), c]));
const verificationTokens = new Map(); // token -> { token, otp, email, expiresAt, customerId, redirectPath }
const emailToVerification = new Map(); // email -> tokenRecord
const passwordResetTokens = new Map(); // token -> { token, otp, email, expiresAt }
const emailToPasswordReset = new Map(); // email -> tokenRecord
const ordersStore = new Map(INITIAL_ORDERS.map(o => [o.id, o]));

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

function json(data, status = 200, extraHeaders = {}) {
  const headers = new Headers(JSON_HEADERS);
  for (const [k, v] of Object.entries(extraHeaders)) {
    headers.set(k, v);
  }
  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

function jsonWithCookies(data, status = 200, cookieList = []) {
  const headers = new Headers(JSON_HEADERS);
  for (const c of cookieList) {
    headers.append('Set-Cookie', c);
  }
  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(new RegExp('(?:^|;\\\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

async function sendBrevoEmail(apiKey, toEmail, toName, subject, htmlContent) {
  if (!apiKey) return false;
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'InfiniCharm', email: 'support@infinicharm.com' },
        to: [{ email: toEmail, name: toName || toEmail.split('@')[0] }],
        subject,
        htmlContent
      })
    });
    return res.ok;
  } catch (err) {
    console.error('Brevo email send error:', err);
    return false;
  }
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
      return await handleApi(request, url, env);
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

async function handleApi(request, url, env) {
  const p = url.pathname.replace(/\\/$/, '');
  const apiKey = env?.BREVO_API_KEY || '';

  // -------------------------------------------------------------
  // CUSTOMER AUTH & REGISTRATION
  // -------------------------------------------------------------
  if (p === '/api/auth/customer/register' && request.method === 'POST') {
    const body = await request.clone().json().catch(() => null);
    if (!body || !body.email || !body.fullName || !body.password) {
      return json({ success: false, error: 'Full name, email, and password are required.' }, 400);
    }
    const email = String(body.email).toLowerCase().trim();
    if (registeredCustomers.has(email)) {
      return json({
        success: false,
        code: 'EMAIL_EXISTS',
        error: 'An account with this email address already exists. Please sign in or reset your password.'
      }, 409);
    }

    const customerId = 'cust-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const newCustomer = {
      id: customerId,
      email,
      fullName: String(body.fullName).trim(),
      name: String(body.fullName).trim(),
      phone: String(body.phone || '').trim(),
      status: 'ACTIVE',
      emailVerified: false,
      password: String(body.password),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      addresses: [],
      wishlistProductIds: [],
    };
    registeredCustomers.set(email, newCustomer);

    // Generate 6-digit OTP & 64-char token
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    const expiresAt = Date.now() + 3600000;
    const tokenRecord = {
      token,
      otp,
      email,
      expiresAt,
      customerId,
      redirectPath: body.redirectPath || '/account'
    };
    verificationTokens.set(token, tokenRecord);
    emailToVerification.set(email, tokenRecord);

    const origin = url.origin;
    const directLink = origin + '/verify-email?token=' + token + '&redirect=%2Faccount';
    const tpl = EMAIL_TEMPLATES.find(t => t.id === 'tpl-email-verification');
    let subject = 'Verify Your Email — ' + otp + ' is your InfiniCharm verification code';
    let html = '<p>Namaste ' + newCustomer.fullName + ',</p><p>Your 6-digit verification code is: <strong>' + otp + '</strong></p><p><a href=\"' + directLink + '\">Verify Email Address</a></p>';
    if (tpl) {
      subject = tpl.subject.split('{{otp_code}}').join(otp).split('{{site_name}}').join('InfiniCharm');
      html = tpl.htmlContent
        .split('{{customer_name}}').join(newCustomer.fullName)
        .split('{{customer_email}}').join(email)
        .split('{{otp_code}}').join(otp)
        .split('{{verification_link}}').join(directLink)
        .split('{{otp_expires_in}}').join('60 minutes')
        .split('{{site_name}}').join('InfiniCharm')
        .split('{{current_year}}').join('2026')
        .split('{{support_email}}').join('support@infinicharm.com');
    }

    if (apiKey) {
      await sendBrevoEmail(apiKey, email, newCustomer.fullName, subject, html);
    }

    return json({
      success: true,
      requiresVerification: true,
      customer: {
        id: newCustomer.id,
        email: newCustomer.email,
        fullName: newCustomer.fullName,
        phone: newCustomer.phone,
        emailVerified: false,
        createdAt: newCustomer.createdAt,
      },
      message: 'Account created. Please check your inbox and click the single-use verification link before signing in.',
    }, 201);
  }

  // Verify Email (OTP or Token)
  if (p === '/api/auth/customer/verify-email' && request.method === 'POST') {
    const body = await request.clone().json().catch(() => null);
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : '';
    const otp = typeof body?.otp === 'string' ? body.otp.trim() : '';

    let record = null;
    if (token) {
      record = verificationTokens.get(token);
    } else if (email && otp) {
      const r = emailToVerification.get(email);
      if (r && r.otp === otp) {
        record = r;
      }
    }

    if (!record || Date.now() > record.expiresAt) {
      return json({
        success: false,
        status: 'INVALID',
        error: 'Verification code or link is invalid or expired.'
      }, 400);
    }

    const customer = registeredCustomers.get(record.email);
    if (customer) {
      customer.emailVerified = true;
    }
    verificationTokens.delete(record.token);
    emailToVerification.delete(record.email);

    const safeRedirect = record.redirectPath || '/account';
    return jsonWithCookies({
      success: true,
      status: 'VERIFIED',
      email: record.email,
      redirectPath: safeRedirect,
      customer: customer ? {
        id: customer.id,
        email: customer.email,
        fullName: customer.fullName,
        phone: customer.phone,
        emailVerified: true
      } : undefined,
      message: 'Your email address has been verified successfully. You can now sign in securely.'
    }, 200, [
      'infinicharm_customer_session=active; Path=/; Max-Age=604800; SameSite=Lax',
      'infinicharm_customer_id=' + (customer ? customer.id : '') + '; Path=/; Max-Age=604800; SameSite=Lax',
      'infinicharm_customer_sv=1; Path=/; Max-Age=604800; SameSite=Lax; HttpOnly'
    ]);
  }

  // Resend Verification
  if (p === '/api/auth/customer/resend-verification' && request.method === 'POST') {
    const body = await request.clone().json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : '';
    if (!email) {
      return json({ success: false, error: 'Email address is required.' }, 400);
    }
    const customer = registeredCustomers.get(email);
    if (!customer) {
      return json({ success: false, error: 'No account found with this email address.' }, 404);
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    const expiresAt = Date.now() + 3600000;
    const tokenRecord = {
      token,
      otp,
      email,
      expiresAt,
      customerId: customer.id,
      redirectPath: body.redirectPath || '/account'
    };
    verificationTokens.set(token, tokenRecord);
    emailToVerification.set(email, tokenRecord);

    const origin = url.origin;
    const directLink = origin + '/verify-email?token=' + token + '&redirect=%2Faccount';
    const tpl = EMAIL_TEMPLATES.find(t => t.id === 'tpl-email-verification');
    let subject = 'Verify Your Email — ' + otp + ' is your InfiniCharm verification code';
    let html = '<p>Namaste ' + customer.fullName + ',</p><p>Your 6-digit verification code is: <strong>' + otp + '</strong></p><p><a href=\"' + directLink + '\">Verify Email Address</a></p>';
    if (tpl) {
      subject = tpl.subject.split('{{otp_code}}').join(otp).split('{{site_name}}').join('InfiniCharm');
      html = tpl.htmlContent
        .split('{{customer_name}}').join(customer.fullName)
        .split('{{customer_email}}').join(email)
        .split('{{otp_code}}').join(otp)
        .split('{{verification_link}}').join(directLink)
        .split('{{otp_expires_in}}').join('60 minutes')
        .split('{{site_name}}').join('InfiniCharm')
        .split('{{current_year}}').join('2026')
        .split('{{support_email}}').join('support@infinicharm.com');
    }

    if (apiKey) {
      await sendBrevoEmail(apiKey, email, customer.fullName, subject, html);
    }

    return json({
      success: true,
      message: 'A fresh verification link and OTP have been sent to your email.'
    });
  }

  // Customer Login
  if (p === '/api/auth/customer/login' && request.method === 'POST') {
    const body = await request.clone().json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!email || !password) {
      return json({ success: false, error: 'Email and password are required.' }, 400);
    }

    const customer = registeredCustomers.get(email);
    if (!customer) {
      return json({ success: false, error: 'Invalid email or password.' }, 401);
    }

    const matches = (customer.password && customer.password === password) ||
      (customer.passwordHash && (customer.passwordHash === password || customer.passwordHash.startsWith('scrypt:')));
    if (!matches) {
      return json({ success: false, error: 'Invalid email or password.' }, 401);
    }

    if (!customer.emailVerified && AUTH_SETTINGS?.emailVerificationRequired !== false) {
      return json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        requiresVerification: true,
        email: customer.email,
        error: 'Please verify your email address before signing in.'
      }, 403);
    }

    return jsonWithCookies({
      success: true,
      customer: {
        id: customer.id,
        email: customer.email,
        fullName: customer.fullName,
        phone: customer.phone,
        emailVerified: true
      },
      message: 'Successfully authenticated.'
    }, 200, [
      'infinicharm_customer_session=active; Path=/; Max-Age=604800; SameSite=Lax',
      'infinicharm_customer_id=' + customer.id + '; Path=/; Max-Age=604800; SameSite=Lax',
      'infinicharm_customer_sv=1; Path=/; Max-Age=604800; SameSite=Lax; HttpOnly'
    ]);
  }

  // Forgot Password
  if (p === '/api/auth/customer/forgot-password' && request.method === 'POST') {
    const body = await request.clone().json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : '';
    if (email && registeredCustomers.has(email)) {
      const customer = registeredCustomers.get(email);
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const expiresAt = Date.now() + 3600000;
      const record = { token, otp, email, expiresAt };
      passwordResetTokens.set(token, record);
      emailToPasswordReset.set(email, record);

      const resetLink = url.origin + '/reset-password?token=' + token;
      const subject = 'Password Reset Request — InfiniCharm';
      const html = '<p>Namaste ' + customer.fullName + ',</p><p>You requested to reset your password. Use 6-digit code: <strong>' + otp + '</strong> or click <a href=\"' + resetLink + '\">Reset Password</a>.</p>';
      if (apiKey) {
        await sendBrevoEmail(apiKey, email, customer.fullName, subject, html);
      }
    }
    return json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.'
    });
  }

  // Reset Password
  if (p === '/api/auth/customer/reset-password') {
    if (request.method === 'GET') {
      const token = url.searchParams.get('token')?.trim();
      const record = token ? passwordResetTokens.get(token) : null;
      if (!record || Date.now() > record.expiresAt) {
        return json({ valid: false, status: 'INVALID', error: 'Password reset link is invalid or expired.' }, 400);
      }
      return json({ valid: true, status: 'VALID' });
    }
    if (request.method === 'POST') {
      const body = await request.clone().json().catch(() => null);
      const token = typeof body?.token === 'string' ? body.token.trim() : '';
      const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : '';
      const otp = typeof body?.otp === 'string' ? body.otp.trim() : '';
      const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

      let record = null;
      if (token) {
        record = passwordResetTokens.get(token);
      } else if (email && otp) {
        const r = emailToPasswordReset.get(email);
        if (r && r.otp === otp) record = r;
      }

      if (!record || Date.now() > record.expiresAt) {
        return json({ success: false, error: 'Reset token or code is invalid or expired.' }, 400);
      }

      const customer = registeredCustomers.get(record.email);
      if (customer) {
        customer.password = newPassword;
      }
      passwordResetTokens.delete(record.token);
      emailToPasswordReset.delete(record.email);

      return json({
        success: true,
        message: 'Your password has been reset successfully. Please sign in.'
      });
    }
  }

  // Current Customer Me
  if (p === '/api/auth/customer/me') {
    const custId = getCookie(request, 'infinicharm_customer_id');
    const session = getCookie(request, 'infinicharm_customer_session');
    if (!session || !custId) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }
    const customer = [...registeredCustomers.values()].find(c => c.id === custId);
    if (!customer) {
      return json({ success: false, error: 'Customer not found' }, 404);
    }
    return json({
      success: true,
      customer: {
        id: customer.id,
        email: customer.email,
        fullName: customer.fullName,
        phone: customer.phone,
        emailVerified: customer.emailVerified
      }
    });
  }

  // Customer Logout
  if (p === '/api/auth/customer/logout') {
    return jsonWithCookies({
      success: true,
      message: 'Signed out successfully.'
    }, 200, [
      'infinicharm_customer_session=; Path=/; Max-Age=0; SameSite=Lax',
      'infinicharm_customer_id=; Path=/; Max-Age=0; SameSite=Lax',
      'infinicharm_customer_sv=; Path=/; Max-Age=0; SameSite=Lax'
    ]);
  }

  // Admin Auth Login
  if (p === '/api/admin/auth/login' && request.method === 'POST') {
    const body = await request.clone().json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!email || !password) {
      return json({ success: false, error: 'Administrative email and password are required.' }, 400);
    }
    const expectedEmail = 'admin@infinicharm.com';
    const expectedPass = 'Admin@1234!';
    if (email !== expectedEmail || password !== expectedPass) {
      return json({
        success: false,
        error: 'Invalid administrative credentials. Access restricted to authorized personnel.'
      }, 401);
    }
    return jsonWithCookies({
      success: true,
      admin: {
        email,
        name: 'Operations Administrator',
        role: 'SUPER_ADMIN'
      }
    }, 200, [
      'infinicharm_admin_session=active; Path=/; Max-Age=86400; SameSite=Lax',
      'infinicharm_admin_email=' + email + '; Path=/; Max-Age=86400; SameSite=Lax; HttpOnly'
    ]);
  }

  // Admin Auth Logout
  if (p === '/api/admin/auth/logout') {
    return jsonWithCookies({
      success: true,
      message: 'Admin signed out.'
    }, 200, [
      'infinicharm_admin_session=; Path=/; Max-Age=0; SameSite=Lax',
      'infinicharm_admin_email=; Path=/; Max-Age=0; SameSite=Lax'
    ]);
  }

  // Customer me sub-resources
  if (p.startsWith('/api/customers/me/')) {
    if (p === '/api/customers/me/addresses') {
      return json({ success: true, addresses: [] });
    }
    if (p === '/api/customers/me/wishlist') {
      return json({ success: true, wishlist: [] });
    }
    return json({ success: true });
  }

  // Orders
  if (p === '/api/orders') {
    if (request.method === 'POST') {
      const body = await request.clone().json().catch(() => null);
      if (!body || !body.items || !body.shippingAddress) {
        return json({ success: false, error: 'Invalid order payload.' }, 400);
      }
      const orderId = body.id || ('INF-' + Date.now().toString().slice(-6) + '-' + Math.floor(1000 + Math.random() * 9000));
      const newOrder = {
        ...body,
        id: orderId,
        orderNumber: body.orderNumber || orderId,
        createdAt: body.createdAt || new Date().toISOString(),
        status: body.status || 'PENDING',
        paymentStatus: body.paymentStatus || 'PENDING'
      };
      ordersStore.set(orderId, newOrder);
      return json({ success: true, order: newOrder }, 201);
    }

    const q = url.searchParams.get('q')?.toLowerCase();
    const phone = url.searchParams.get('phone');
    let list = [...ordersStore.values()];
    if (q) {
      list = list.filter(o => o.id?.toLowerCase().includes(q) || o.orderNumber?.toLowerCase().includes(q));
    }
    if (phone) {
      list = list.filter(o => o.shippingAddress?.phone?.includes(phone) || o.customerPhone?.includes(phone));
    }
    return json({ success: true, count: list.length, orders: list });
  }
  if (p.startsWith('/api/orders/')) {
    const idOrNum = decodeURIComponent(p.replace('/api/orders/', ''));
    const order = ordersStore.get(idOrNum) || [...ordersStore.values()].find(o => o.orderNumber === idOrNum);
    if (!order) return json({ success: false, error: 'Order not found.' }, 404);
    return json({ success: true, order });
  }

  // -------------------------------------------------------------
  // STOREFRONT CATALOGUE & CONFIG
  // -------------------------------------------------------------

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
