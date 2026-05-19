import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Creates a Supabase server client that reads/writes cookies via the
 * proxy request/response objects. Used exclusively in proxy.ts.
 */
export function createSupabaseProxyClient(
  request: NextRequest,
  response: NextResponse,
) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
}
