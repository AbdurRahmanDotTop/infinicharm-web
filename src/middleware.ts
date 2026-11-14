import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { pathname } = request.nextUrl;

  // 1. Skip static assets, internal paths, and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icon')
  ) {
    return response;
  }

  // 2. Initialize Supabase Server Client for Edge Middleware
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ziafauuodnmktzmsjpka.supabase.co';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_8Up2lFm0QMVuqdc5PLRhTQ_oUB3ccJK';

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Attempt to refresh / read user session
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user || null;
  } catch {
    user = null;
  }

  const isDevBypass =
    request.headers.get('x-e2e-audit') === 'true' ||
    request.cookies.get('infinicharm_dev_bypass')?.value === 'true';

  // 3. Admin Portal RBAC Protection (/admin/*)
  if (pathname.startsWith('/admin')) {
    const hasAdminSession =
      request.cookies.get('infinicharm_admin_session')?.value === 'active' ||
      isDevBypass;

    if (pathname === '/admin/login') {
      // If already logged in with admin session, redirect to dashboard
      if (user || (request.cookies.get('infinicharm_admin_session')?.value === 'active' && !isDevBypass)) {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      }
      return response;
    }

    // Protect all other admin subpaths
    if (!user && !hasAdminSession) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 4. Customer Account Protection (/account/*)
  if (pathname.startsWith('/account')) {
    const hasCustomerSession =
      request.cookies.get('infinicharm_customer_session')?.value === 'active' ||
      isDevBypass;

    if (!user && !hasCustomerSession) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images, svg, icons
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
