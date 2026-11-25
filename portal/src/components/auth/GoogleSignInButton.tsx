// Shared "Continue with Google" button — Register AND Login.
//
// Rendered DISABLED with the honest not-live note while Supabase is not
// wired (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not
// set in Vercel). It never renders as a live-looking button that does
// nothing. When wired, it starts Supabase Auth Google OAuth — see
// src/lib/googleAuth.ts. There is deliberately NO Google button for
// Founder / Admin anywhere: admin login is email + code only.
"use client";

import { useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { GOOGLE_NOT_LIVE_NOTE, signInWithGoogle } from "@/lib/googleAuth";

export default function GoogleSignInButton({
  mode,
}: {
  // "register": Google register (role selection still follows).
  // "login": Google login (existing account, matched by email).
  mode: "register" | "login";
}) {
  const supabaseLive = useMemo(() => getSupabase() !== null, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (!supabaseLive || busy) return;
    setBusy(true);
    setError(null);
    // signInWithGoogle returns null when the browser is leaving for
    // Google; any string it returns is an error to show.
    const err = await signInWithGoogle();
    if (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={!supabaseLive || busy}
        className={
          "flex w-full items-center justify-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold transition " +
          (supabaseLive
            ? "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
            : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400")
        }
      >
        {/* Google "G" mark (inline SVG, brand colours). */}
        <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#FFC107"
              d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
            />
            <path
              fill="#FF3D00"
              d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
            />
          </svg>
        </span>
        {busy
          ? "Redirecting to Google…"
          : mode === "register"
            ? "Continue with Google"
            : "Continue with Google"}
      </button>
      {!supabaseLive ? (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {GOOGLE_NOT_LIVE_NOTE}
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          {mode === "register"
            ? "Google verifies your email. You will still choose ONE role and complete that role's profile before your account is active — no role is assigned automatically."
            : "Google verifies your email — you still get a 6-digit login code by email after Google, on every login. If your Google email already has an account, you sign into that same account; no duplicate is created."}
        </p>
      )}
      {error && (
        <p className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
