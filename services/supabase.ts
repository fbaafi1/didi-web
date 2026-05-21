import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Browser-side Supabase client (lazy singleton).
 * Uses @supabase/ssr so the session is persisted in cookies,
 * making it readable by the proxy route-guard (proxy.ts).
 *
 * The Proxy ensures createBrowserClient() is only called the first time
 * a property is accessed — always in a real browser context — so that
 * Next.js SSR prerendering never executes browser-only code at module load.
 */
let _client: ReturnType<typeof createBrowserClient> | null = null;

function getClient() {
  if (!_client) {
    _client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return _client;
}

export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_target, prop: string | symbol) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getClient() as any)[prop as any];
  },
});
