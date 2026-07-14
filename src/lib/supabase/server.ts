import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_KEY, SUPABASE_URL } from './env';

/**
 * Server Supabase client (M5 — accounts). Reads/writes the session cookies via
 * Next's `cookies()` store so Server Components / Route Handlers see the signed-in
 * user. In Next 16 `cookies()` is async, so this factory is async too.
 *
 * The `setAll` try/catch is intentional: writing cookies from a Server Component
 * render throws (it's read-only there), and that's fine — the middleware refreshes
 * the session cookie on every request, so the component just reads the current one.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — safe to ignore (middleware refreshes).
        }
      },
    },
  });
}
