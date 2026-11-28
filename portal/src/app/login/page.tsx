// /login — Login page (NEW, Nov 19, 2026). There was no Login page
// before this: sign-in lived only as an example card inside RoleForms.
//
// Two steps, EVERY login, no exceptions:
//   * Email + password (Supabase Auth — the password set at
//     registration, 12+ chars with a strength meter) — checked by
//     POST /api/auth/login. No session is created in step 1.
//   * Then a 6-digit email code (10 minutes, one use, 3 wrong codes
//     lock for 15 minutes — migration 0020, POST /api/auth/verify-code).
//     The code is checked by the API and only then is a session
//     created. Founder/Admin get a code EVERY time.
//   * Continue with Google (Supabase Auth, Google provider — already
//     enabled in the live "Immigration" project). Google verifies the
//     email, and the user STILL gets an email code after Google: the
//     callback (/auth/callback) issues the code and sends the user
//     back here for step 2. No Google password is stored.
//   * Founder / Admin: email + code ONLY. There is no Google button
//     for Founder / Admin on this page, and no remember-device option
//     anywhere. Admin accounts are created by the founder, never by
//     self-registration.
//
// The code itself is NEVER stored (only its SHA-256 hash, in
// login_codes) and NEVER returned in a response. Until AWS SES is
// connected the code cannot be emailed and login stops honestly at
// step 1 with "email_not_configured".
//
// HONEST STATUS: nothing on this page works until Supabase is wired
// (NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in
// Vercel) and the portal is deployed. Until then the Google button
// is disabled with that explanation and the email form reports
// honestly that Supabase is not connected. Nothing here claims a
// login works on the static live site.
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LanguagePicker from "@/components/LanguagePicker";
import { getSupabase } from "@/lib/supabase";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

const inputCls =
  "w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm";
const labelCls = "block text-sm font-medium text-slate-700";
const btnCls =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

export default function LoginPage() {
  const supabaseLive = useMemo(() => getSupabase() !== null, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  // True when arriving from Google (/auth/callback issued a code and
  // sent the user back here): the OAuth session already exists, so
  // step 2 verifies the code against that session instead of a password.
  const [oauthMode, setOauthMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Arriving from Google: ?step=code&email=...&oauth=1 — the code was
  // already issued by /auth/callback, so go straight to step 2.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("step") === "code" && params.get("email")) {
      setEmail(params.get("email") ?? "");
      setOauthMode(params.get("oauth") === "1");
      setCodeSent(true);
      setNote(
        "Google sign-in confirmed. Enter the 6-digit code emailed to you to finish logging in — a code is required every login."
      );
    }
  }, []);

  // Step 1 (email login): check the password with the server and have
  // it issue the 6-digit email code. The API verifies the password
  // against Supabase Auth and DISCARDS the session — no login exists
  // until step 2. The code is emailed by AWS SES; if SES is not
  // connected the API answers 501 "email_not_configured" and this
  // page says so honestly instead of pretending a code was sent.
  // (The Supabase OTP flow — signInWithOtp / verifyOtp — was removed
  // Nov 19–20 consolidation: the task letter requires password +
  // custom code for every email login, with the code stored only as
  // a SHA-256 hash in login_codes.)
  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNote(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        if (response.status === 501) {
          setError(
            "Email codes are not configured yet (AWS SES is not connected) — your code cannot be sent. Try again once email sending is set up."
          );
        } else {
          setError(body.error ?? body.message ?? "Email or password not recognised. Try again.");
        }
        return;
      }
      setCodeSent(true);
      setNote(`A 6-digit login code was sent to ${email}. Enter it below.`);
    } catch {
      setError("Could not reach the login service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  // Step 2: verify the code with the server. The API burns the code
  // (one use) and returns the session tokens for a password login, or
  // just ok for a Google login whose session already exists. Only
  // then does this page create a session and send the user to their
  // role destination. A missing accounts row means role selection is
  // still outstanding.
  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNote(null);
    if (code.trim().length < 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    try {
      // The API needs a credential to finish the login: the password
      // (email flow — it signs in with Supabase Auth and returns the
      // session tokens) or the current OAuth access token (Google flow
      // — it verifies the token belongs to this email; the browser
      // already holds the session). Without one, the code is NOT
      // burned and the API answers 400.
      let oauthAccessToken: string | undefined;
      if (oauthMode) {
        const sb = getSupabase();
        const { data } = sb ? await sb.auth.getSession() : { data: { session: null } };
        oauthAccessToken = data.session?.access_token;
      }
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          password: oauthMode ? undefined : password,
          oauthAccessToken,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        session?: { access_token: string; refresh_token: string } | null;
        redirectTo?: string;
      };
      if (!response.ok) {
        if (response.status === 429) {
          setError(
            "Too many wrong codes — this email is locked for 15 minutes. Request a new code after the lock ends."
          );
        } else {
          setError(body.error ?? body.message ?? "That code did not work. Request a new code and try again.");
        }
        return;
      }
      // Password login: establish the session from the tokens the API
      // returned. Google login: the session already exists.
      if (body.session) {
        const sb = getSupabase();
        if (!sb) {
          setError("Supabase is not connected in this build — no login was completed.");
          return;
        }
        const { error: sessionError } = await sb.auth.setSession(body.session);
        if (sessionError) {
          setError(`The code was right but the session could not be started: ${sessionError.message}`);
          return;
        }
      }
      if (body.redirectTo) {
        window.location.assign(body.redirectTo);
        return;
      }
      setError(
        "You are signed in, but no role has been chosen for this account yet. Continue onboarding and choose ONE role."
      );
      window.location.assign("/onboarding");
    } catch {
      setError("Could not reach the login service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  // Step 2 resend: re-issue a fresh code (password logins re-check the
  // password; Google logins re-issue from the existing session).
  const resendCode = async () => {
    setError(null);
    setNote(null);
    if (oauthMode) {
      // Google flow: the callback issued the code; a fresh one comes
      // from re-running the Google sign-in, not from a password.
      setNote("Use the Google button again to receive a fresh code, or go back and sign in with Google once more.");
      return;
    }
    await sendCode(new Event("submit") as unknown as React.FormEvent);
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Log in — Immigration with NIPTEI
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Sign in with Google, or with email + password + code. A
            6-digit email code is required on every login. Questions? Email{" "}
            <a
              className="text-blue-600 underline"
              href="mailto:nipteiapp@gmail.com"
            >
              nipteiapp@gmail.com
            </a>{" "}
            or call{" "}
            <a className="text-blue-600 underline" href="tel:+17729716129">
              (772) 971-6129
            </a>
            .
          </p>
        </div>
        <LanguagePicker />
      </header>

      {!supabaseLive && (
        <p className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Example data — not live. Supabase is not connected in this build.
        </p>
      )}

      <section
        aria-label="Continue with Google"
        className="rounded-lg border border-slate-300 bg-white p-5"
      >
        <h2 className="mb-1 text-lg font-semibold text-slate-900">
          Continue with Google
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          For Clients, Document Preparers, Attorneys, DOJ Nonprofits, Law
          Students, and Teachers. Google verifies your email — and you
          still get a 6-digit email code after Google, because a code is
          required on every login.
        </p>
        <GoogleSignInButton mode="login" />
      </section>

      <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-300" />
        or log in with email + password + code
        <span className="h-px flex-1 bg-slate-300" />
      </div>

      <section
        aria-label="Log in with email, password and code"
        className="rounded-lg border border-slate-300 bg-white p-5"
      >
        <h2 className="mb-1 text-lg font-semibold text-slate-900">
          Log in with email, password and code
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          Step 1 checks your password, step 2 checks a 6-digit code sent
          to your email (10 minutes, one use). A code is required on
          every login — there is no &ldquo;remember this device&rdquo;
          option.
        </p>
        {error && (
          <p className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        {note && (
          <p className="mb-3 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
            {note}
          </p>
        )}
        {!codeSent ? (
          <form className="space-y-4" onSubmit={sendCode}>
            <label className={labelCls}>
              Email *
              <span className="mt-1 block">
                <input
                  className={inputCls}
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </span>
            </label>
            <label className={labelCls}>
              Password *
              <span className="mt-1 block">
                <input
                  className={inputCls}
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </span>
            </label>
            <button type="submit" className={btnCls} disabled={busy}>
              {busy ? "Checking password…" : "Send login code"}
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={verifyCode}>
            <label className={labelCls}>
              6-digit code *
              <span className="mt-1 block">
                <input
                  className={inputCls}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={btnCls} disabled={busy}>
                {busy ? "Checking code…" : "Log in"}
              </button>
              {!oauthMode && (
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => void resendCode()}
                  disabled={busy}
                >
                  Resend code
                </button>
              )}
              <button
                type="button"
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setCodeSent(false);
                  setCode("");
                  setPassword("");
                  setOauthMode(false);
                  setError(null);
                  setNote(null);
                }}
              >
                Use a different email
              </button>
            </div>
          </form>
        )}
      </section>

      <section
        aria-label="Founder / Admin login"
        className="mt-6 rounded-lg border border-slate-300 bg-slate-50 p-5"
      >
        <h2 className="mb-1 text-lg font-semibold text-slate-900">
          Founder / Admin
        </h2>
        <p className="text-sm text-slate-600">
          Founder / Admin login is email + password + code only — use the
          email form above. There is no Google sign-in for Founder /
          Admin, no self-registration, and no remember-device option.
          Admin accounts are created by the founder.
        </p>
      </section>

      <footer className="mt-8 text-xs text-slate-500">
        <Link href="/register" className="text-blue-600 underline">
          No account yet? Register →
        </Link>{" "}
        ·{" "}
        <Link href="/" className="text-blue-600 underline">
          ← Back to home
        </Link>
      </footer>
    </main>
  );
}
