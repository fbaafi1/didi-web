import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseProxyClient } from '@/services/supabaseServer';

/**
 * Route guard proxy.
 *
 * Public  → /customer/* and /auth/* (anyone can browse the marketplace)
 * Private → /admin/* and /vendor/* (require a valid Supabase session)
 *
 * Uses @supabase/ssr so sessions stored in cookies are readable here.
 * The response is passed through to allow Supabase to refresh the token
 * cookie if needed.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute  = pathname.startsWith('/admin');
  const isVendorRoute = pathname.startsWith('/vendor');

  // Only run the (async) session check for protected routes
  if (!isAdminRoute && !isVendorRoute) {
    return NextResponse.next();
  }

  const response = NextResponse.next({ request });

  try {
    const supabase = createSupabaseProxyClient(request, response);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('returnTo', pathname);
      return NextResponse.redirect(loginUrl);
    }
  } catch {
    // On any error, redirect to login to be safe
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/vendor/:path*'],
};

export default proxy;
