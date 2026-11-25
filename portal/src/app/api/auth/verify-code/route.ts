// POST /api/auth/verify-code — Step 2 of login: check the 6-digit
// email code, then (and only then) create the session.
//
//   * { email, code, password } — password path: after the code
//     checks out, the route signs in with Supabase Auth and returns
//     the session tokens. The login page sets them with
//     supabase.auth.setSession() and redirects by role.
//   * { email, code, oauthAccessToken } — Google path: after the code
//     checks out, the route verifies the OAuth token belongs to this
//     email and returns ok with no new tokens — the login page keeps
//     the OAuth session it already holds and redirects by role.
//
// Code rules (migration 0020, constants in src/lib/loginCodes.ts):
// 6 digits, 10-minute expiry, ONE use, 3 wrong codes lock the code
// for 15 minutes. Only the LATEST unused code for the account is
// checked, so requesting a new code kills the old one. The code is
// compared by SHA-256 hash — the plaintext code is never stored and
// never returned.
//
// SKELETON / NOT LIVE until env vars are set + migration 0020 has run.
// No keys in code; values come from Vercel / .env.local.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  LOGIN_CODE_LOCK_MINUTES,
  LOGIN_CODE_MAX_WRONG,
  hashLoginCode,
  loginCodeBlockReason,
  loginCodeLockSecondsLeft,
  loginCodeLockedUntil,
  redirectAfterLogin,
  type LoginCodeRow,
} from "@/lib/loginCodes";

export const runtime = "nodejs";

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "Login is not configured — NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are not set. No session was created.",
      },
      { status: 501 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const email = asString(body.email);
  const code = asString(body.code);
  const password = typeof body.password === "string" ? body.password : "";
  const oauthAccessToken = asString(body.oauthAccessToken);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "The code is 6 digits." }, { status: 400 });
  }
  // A session needs a credential: password or a verified OAuth token.
  // Checked BEFORE the code is consumed, so a bad request does not
  // burn the one-use code.
  if (!password && !oauthAccessToken) {
    return NextResponse.json(
      { error: "A password or a Google login is required to finish signing in." },
      { status: 400 }
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: account, error: accountError } = await admin
    .from("accounts")
    .select("id, role")
    .eq("email", email)
    .maybeSingle();
  if (accountError || !account) {
    return NextResponse.json(
      { error: "No Immigration account exists for this email." },
      { status: 400 }
    );
  }
  const accountId = (account as { id: string }).id;
  const role = (account as { role: string }).role;

  // Latest unused code only — requesting a new code kills the old one.
  const { data: row, error: rowError } = await admin
    .from("login_codes")
    .select("id, code_hash, expires_at, wrong_attempts, locked_until, used_at, created_at")
    .eq("account_id", accountId)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (rowError || !row) {
    return NextResponse.json(
      {
        error:
          "No login code is waiting for this email. Request a new code from the login page.",
      },
      { status: 400 }
    );
  }
  const codeRow = row as LoginCodeRow;
  const now = new Date();
  const block = loginCodeBlockReason(codeRow, now);
  if (block === "expired") {
    return NextResponse.json(
      { error: "That code has expired (10 minutes). Request a new code." },
      { status: 400 }
    );
  }
  if (block === "locked") {
    return NextResponse.json(
      {
        error: `Too many wrong codes — locked for ${LOGIN_CODE_LOCK_MINUTES} minutes. Try again in ${loginCodeLockSecondsLeft(codeRow, now)} seconds, or request a new code after the lock lifts.`,
        retryAfterSeconds: loginCodeLockSecondsLeft(codeRow, now),
      },
      { status: 429 }
    );
  }
  if (block === "used") {
    return NextResponse.json(
      { error: "That code was already used. Request a new code." },
      { status: 400 }
    );
  }

  if (hashLoginCode(code) !== codeRow.code_hash) {
    const wrongAttempts = codeRow.wrong_attempts + 1;
    const patch: Record<string, unknown> = { wrong_attempts: wrongAttempts };
    if (wrongAttempts >= LOGIN_CODE_MAX_WRONG) {
      patch.locked_until = loginCodeLockedUntil(now).toISOString();
    }
    await admin.from("login_codes").update(patch).eq("id", codeRow.id);
    if (wrongAttempts >= LOGIN_CODE_MAX_WRONG) {
      return NextResponse.json(
        {
          error: `Incorrect code — 3 wrong codes. Locked for ${LOGIN_CODE_LOCK_MINUTES} minutes.`,
          retryAfterSeconds: LOGIN_CODE_LOCK_MINUTES * 60,
        },
        { status: 429 }
      );
    }
    return NextResponse.json(
      {
        error: `Incorrect code. ${LOGIN_CODE_MAX_WRONG - wrongAttempts} attempt${LOGIN_CODE_MAX_WRONG - wrongAttempts === 1 ? "" : "s"} left before a ${LOGIN_CODE_LOCK_MINUTES}-minute lock.`,
      },
      { status: 401 }
    );
  }

  // Correct code — burn it (one use), then create the session.
  await admin.from("login_codes").update({ used_at: now.toISOString() }).eq("id", codeRow.id);

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (oauthAccessToken) {
    const { data, error } = await anon.auth.getUser(oauthAccessToken);
    if (error || !data.user || data.user.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: "Google login could not be verified for this email. The code was used — request a new one and try again." },
        { status: 401 }
      );
    }
    // No new tokens: the login page keeps the OAuth session it holds.
    return NextResponse.json({
      ok: true,
      role,
      redirectTo: redirectAfterLogin(role),
      session: null,
      note: "Code verified. Your Google session is now active.",
    });
  }

  const { data: sessionData, error: sessionError } =
    await anon.auth.signInWithPassword({ email, password });
  if (sessionError || !sessionData.session) {
    return NextResponse.json(
      {
        error:
          "Code verified, but the password sign-in failed (the password may have changed since step 1). The code was used — request a new code and try again.",
      },
      { status: 401 }
    );
  }
  return NextResponse.json({
    ok: true,
    role,
    redirectTo: redirectAfterLogin(role),
    session: {
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      expires_in: sessionData.session.expires_in,
    },
    note: "Code verified. Signed in.",
  });
}
