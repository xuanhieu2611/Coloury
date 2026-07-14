import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigured } from './env';

/**
 * Refresh the Supabase auth token on every request and mirror the refreshed
 * cookies onto both the request (for Server Components downstream) and the
 * response (for the browser). This is the standard @supabase/ssr middleware
 * pattern — without it, server-side session reads can go stale.
 *
 * No-ops when Supabase isn't configured so the app still runs pre-setup.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  if (!supabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: getClaims() verifies + refreshes the token. Do not run other logic
  // between creating the client and this call, or sessions can be logged out at
  // random (per Supabase's SSR guidance).
  await supabase.auth.getClaims();

  return response;
}
