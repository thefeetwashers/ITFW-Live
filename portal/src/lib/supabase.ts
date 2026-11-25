import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Honest wiring: returns null when env vars are not set, so pages must
// fall back to clearly-labelled EXAMPLE data and never claim a live login.
// Set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in
// Vercel (project itfw-live) or .env.local. Never put the service-role
// key in client code.
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export const SUPABASE_CONFIGURED =
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
