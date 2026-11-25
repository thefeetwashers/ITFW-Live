// Google Register + Login — Supabase Auth (OAuth), Nov 19, 2026.
//
// Google Auth is ALREADY ENABLED in the live Supabase "Immigration"
// project (verified Nov 19, 2026 — Client ID + Client Secret already
// filled in Supabase). Do NOT create a second Google Cloud OAuth client
// and do NOT change the Supabase Google provider settings. The exact
// callback URL Supabase shows is:
//   https://jdxjskqdvwqarfhcqjlg.supabase.co/auth/v1/callback
// Supabase handles that callback; the portal only has to send the user
// to Google and receive them back at /auth/callback (see
// src/app/auth/callback/page.tsx).
//
// HONEST STATUS: Google sign-in is wired to Supabase Auth — it will
// work once the Supabase env vars are set in Vercel and the portal is
// deployed. It does NOT work on the static live site. Until the env
// vars are set, getSupabase() returns null and the Google button is
// rendered DISABLED with that explanation — never a fake button that
// does nothing, and never a claim that Google login works on the
// static site.
//
// FLOW
//   * Register AND Login both offer "Continue with Google" for every
//     role EXCEPT Founder / Admin (email + code only, no Google, no
//     remember-device — see src/app/login/page.tsx).
//   * signInWithOAuth({ provider: "google" }) — Google verifies the
//     user; NO Google password is ever stored, and the Google token
//     is NEVER logged. A 6-digit email code IS still required after
//     Google, on every login (Nov 19–20 consolidation — the task
//     letter requires a code every login, Google included): the
//     callback issues the code and sends the user to /login step 2.
//   * Supabase Auth matches by email: a Google sign-in with an email
//     that already has an Auth user signs into THAT same account —
//     no duplicate Auth user is created. The portal then looks up
//     public.accounts by auth_user_id: if a row exists, the user gets
//     their login code and finishes at /login (never straight to
//     their role destination); if no row exists, the user is sent to
//     /onboarding?google=1 and MUST still pick ONE role
//     (nothing pre-selected) and complete that role's profile via
//     /api/google-profile before they are active. No role is ever
//     auto-assigned and no professional is ever auto-verified.
//   * After Google register the onboarding ladder is the same as
//     email register: role_selected → profile_completed →
//     pending_verification → active. Professionals still need admin
//     verification before listing / G-28 / assignments (attorney bar,
//     DOJ EOIR roster, student supervisor confirmation).
//   * Privacy: a user's Google email is shown only to the user
//     themselves, to their assigned professional, and to the
//     Founder/Admin verification queue where the role requires it.
//     It is never shown to other users, never put in a URL, and
//     never logged.
import { getSupabase } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// Shown wherever the Google button appears while Supabase is not wired.
export const GOOGLE_NOT_LIVE_NOTE =
  "Google sign-in is wired to Supabase Auth — it will work once the Supabase env vars are set in Vercel and the portal is deployed. It does NOT work on the static live site.";

// Roles a Google sign-in may lead to. Founder / Admin is deliberately
// absent: admin login is email + code only, never Google.
export type GoogleRole =
  | "client"
  | "preparer"
  | "attorney"
  | "nonprofit"
  | "law_student"
  | "teacher";

// Where an existing account lands after sign-in, by role.
export function roleDestination(role: string): string {
  switch (role) {
    case "client":
      return "/portal";
    case "preparer":
      return "/preparer-dashboard";
    case "attorney":
      return "/legal-back-office";
    case "nonprofit":
      return "/legal-back-office";
    case "law_student":
      return "/legal-back-office";
    case "teacher":
      // Same destination as email login (redirectAfterLogin in
      // src/lib/loginCodes.ts): the teacher dashboard, where teachers
      // confirm students. NOT /admin/verifications — that is the
      // Founder/Admin queue. The page exists now
      // (src/app/teacher-dashboard/page.tsx, built Nov 19–20, 2026).
      return "/teacher-dashboard";
    default:
      return "/portal";
  }
}

export type AccountLookup =
  | { found: true; role: string; onboardingStatus: string | null }
  | { found: false }
  | { found: "error" };

// Look up public.accounts by auth_user_id. Returns found:false when the
// Google user has an Auth user but no account row yet (new user → role
// selection). Returns found:"error" when the lookup itself failed —
// callers must NOT treat that as "no account" and must NOT create a
// duplicate row on the strength of it.
export async function lookupAccount(
  supabase: SupabaseClient,
  authUserId: string
): Promise<AccountLookup> {
  const { data, error } = await supabase
    .from("accounts")
    .select("role, onboarding_status")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) return { found: "error" };
  if (!data) return { found: false };
  const row = data as { role: string; onboarding_status: string | null };
  return { found: true, role: row.role, onboardingStatus: row.onboarding_status };
}

// Start Google sign-in. Returns null on success (the browser is leaving
// for Google), or an error message to show when Supabase is not wired
// or Google refused the redirect. Never logs the token or the email.
export async function signInWithGoogle(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return GOOGLE_NOT_LIVE_NOTE;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // Back to the portal callback, which sorts existing vs new users.
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) return `Google sign-in could not start: ${error.message}`;
  return null;
}
