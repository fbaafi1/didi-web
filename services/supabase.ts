import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Browser-side Supabase client (singleton).
 * Uses @supabase/ssr so the session is persisted in cookies,
 * making it readable by the proxy route-guard (proxy.ts).
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
