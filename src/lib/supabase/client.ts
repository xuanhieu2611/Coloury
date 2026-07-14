'use client';

import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_KEY, SUPABASE_URL } from './env';

/**
 * Browser Supabase client (M5 — accounts). Use in Client Components for auth
 * (sign in / sign up / sign out, `onAuthStateChange`). Session tokens are stored
 * in cookies by @supabase/ssr so the server (middleware) can read them too.
 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}
