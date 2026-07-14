/**
 * Supabase public config (M5 — accounts).
 *
 * Both values are safe to expose to the browser (the publishable/anon key is
 * designed for client use and is protected by Row Level Security on the server).
 * NEVER put the service-role/secret key in a NEXT_PUBLIC_* var — that would ship
 * it to every visitor.
 *
 * Accepts the newer "publishable" key name or the classic "anon" key name so it
 * works whichever the user copied from their project's API settings.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  '';

/** True when both public values are present — lets the UI degrade gracefully. */
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);
