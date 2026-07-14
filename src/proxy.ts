import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Root proxy (M5 — accounts). Next 16 renamed the `middleware` file convention
 * to `proxy`; this keeps the Supabase session cookie fresh on every navigation.
 * Matcher skips static assets and image files for perf.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
