// /auth/callback — where Google (via Supabase Auth) sends the user back.
//
// Client page (not a route handler): supabase-js in the browser picks
// the session up from the redirect itself — the implicit-flow hash
// (#access_token=…) is read automatically by getSession(), and a PKCE
// ?code=… is exchanged here. No new dependency is needed, and the
// session persists in the browser Supabase client.
//
// After the session exists:
//   * public.accounts HAS a row for this auth_user_id → existing user:
//     Google verified the email, but a 6-digit email code is STILL
//     required on every login. The page POSTs
//     /api/auth/login { email, oauthAccessToken } so the server can
//     issue the code for this verified OAuth session, then sends the
//     user to /login?step=code&email=…&oauth=1 for step 2. The user
//     is NEVER redirected straight to their role destination.
//   * NO row → new Google user: /onboarding?google=1 — role selection
//     is still required (nothing pre-selected) and the role profile is
//     completed via /api/google-profile. No role is auto-assigned.
//   * Lookup itself fails → show the choice honestly instead of
//     guessing: the user picks "Continue onboarding" or "Log in".
//   * The code cannot be emailed yet (Resend not connected) → the
//     API answers 501 and this page says so honestly.
//
// The Google token is NEVER logged and the user's Google email is
// never shown here, never put in a URL, and never logged.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { lookupAccount } from "@/lib/googleAuth";

type State =
  | { kind: "working"; message: string }
  | { kind: "error"; message: string }
  | { kind: "unknown-account"; message: string };

export default function AuthCallbackPage() {
  const [state, setState] = useState<State>({
    kind: "working",
    message: "Signing you in with Google…",
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = getSupabase();
      if (!supabase) {
        if (!cancelled)
          setState({
            kind: "error",
            message:
              "Google sign-in is wired to Supabase Auth — it will work once the Supabase env vars are set in Vercel and the portal is deployed. It does NOT work on the static live site.",
          });
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const oauthError =
        params.get("error_description") || params.get("error");
      if (oauthError) {
        if (!cancelled)
          setState({
            kind: "error",
            message: `Google sign-in did not complete: ${oauthError}`,
          });
        return;
      }

      // Implicit flow: the session is already in the URL hash and
      // getSession() reads it. PKCE flow: exchange the ?code= first.
      // Keep the whole session: the access token is needed to ask the
      // server to issue the login code for this verified Google user.
      let session: Session | null = null;
      const { data: sessionData } = await supabase.auth.getSession();
      session = sessionData.session;
      if (!session) {
        const code = params.get("code");
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error || !data.session) {
            if (!cancelled)
              setState({
                kind: "error",
                message:
                  "Google sign-in could not be completed. Please try signing in again from the Login page.",
              });
            return;
          }
          session = data.session;
        }
      }
      if (!session) {
        if (!cancelled)
          setState({
            kind: "error",
            message:
              "No Google session was found. Please try signing in again from the Login page.",
          });
        return;
      }
      const sessionUserId = session.user.id;

      if (!cancelled)
        setState({ kind: "working", message: "Checking your account…" });
      const account = await lookupAccount(supabase, sessionUserId);
      if (cancelled) return;
      if (account.found === true) {
        // Existing account — same account, matched by email. No
        // duplicate is created, no role is re-picked. But the login is
        // NOT finished: a 6-digit email code is required on every
        // login, Google included. Ask the server to issue the code for
        // this verified OAuth session, then send the user to /login
        // step 2 — never straight to the role destination.
        const email = session.user.email;
        if (!email) {
          if (!cancelled)
            setState({
              kind: "error",
              message:
                "Google sign-in worked, but no email came back with it. Please try signing in again from the Login page.",
            });
          return;
        }
        if (!cancelled)
          setState({ kind: "working", message: "Sending your login code…" });
        const loginRes = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, oauthAccessToken: session.access_token }),
        });
        if (cancelled) return;
        if (!loginRes.ok) {
          if (!cancelled)
            setState({
              kind: "error",
              message:
                loginRes.status === 501
                  ? "Email codes are not configured yet (Resend is not connected) — your login code cannot be sent. Try again once email sending is set up."
                  : "Google sign-in worked, but your login code could not be sent. Please try signing in again from the Login page.",
            });
          return;
        }
        window.location.assign(
          `/login?step=code&email=${encodeURIComponent(email)}&oauth=1`
        );
        return;
      }
      if (account.found === false) {
        // New Google user — role selection is still required.
        window.location.assign("/onboarding?google=1");
        return;
      }
      // Lookup failed: do not guess, do not create anything.
      setState({
        kind: "unknown-account",
        message:
          "You are signed in with Google, but your account could not be checked just now. If you already have an account, use Log in; if this is your first time here, continue onboarding and choose your role.",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">
        Signing you in with Google
      </h1>
      {state.kind === "working" && (
        <p className="mt-4 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {state.message}
        </p>
      )}
      {state.kind === "error" && (
        <div className="mt-4 space-y-3">
          <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {state.message}
          </p>
          <p className="text-sm">
            <Link href="/login" className="text-blue-600 underline">
              Back to Login →
            </Link>
          </p>
        </div>
      )}
      {state.kind === "unknown-account" && (
        <div className="mt-4 space-y-3">
          <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {state.message}
          </p>
          <p className="space-x-4 text-sm">
            <Link href="/onboarding?google=1" className="text-blue-600 underline">
              Continue onboarding →
            </Link>
            <Link href="/login" className="text-blue-600 underline">
              Log in →
            </Link>
          </p>
        </div>
      )}
      <p className="mt-6 text-xs text-slate-500">
        Google verifies your email — and you still get a 6-digit email
        code after Google, because a code is required on every login.
        No Google password is stored. New Google users still choose one
        role and complete that role&apos;s profile before they are active.
      </p>
    </main>
  );
}
