// POST /api/auth/login — Step 1 of login: prove who you are, then get
// a 6-digit email code (migration 0020). No session is created here.
//
// Two credential types, one code path:
//   * { email, password } — Email + password via Supabase Auth.
//     The password is verified with signInWithPassword on a
//     non-persisted client; the session it returns is DISCARDED.
//     Nothing is stored in a cookie until the code is verified.
//   * { email, oauthAccessToken } — Google login. The token is verified
//     with auth.getUser(token): it must belong to this email. Used by
//     /auth/callback after Supabase exchanges the Google code. The
//     OAuth session itself is not trusted for dashboards until the
//     email code is verified too — code every login, no exceptions.
//
// Then a login_codes row is written (SHA-256 hash only, never the
// plaintext code) and the code is emailed via Resend. If Resend is
// not connected (RESEND_API_KEY not set) this route returns 501
// email_not_configured: the password/OAuth check may have passed, but
// no code could be delivered and NO session was created. The code is
// NEVER returned in a response.
//
// SKELETON / NOT LIVE until env vars are set + migration 0020 has run
// + Resend is connected. No keys in code; values come from Vercel /
// .env.local.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  LOGIN_CODE_TTL_MINUTES,
  generateLoginCode,
  hashLoginCode,
  loginCodeExpiresAt,
} from "@/lib/loginCodes";

export const runtime = "nodejs";

const CODE_TTL_SECONDS = LOGIN_CODE_TTL_MINUTES * 60;

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

async function sendCodeEmail(args: {
  to: string;
  code: string;
}): Promise<{ sent: boolean; detail: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      sent: false,
      detail:
        "Email sending is not connected (RESEND_API_KEY is not set), so no code was emailed.",
    };
  }
  const from =
    process.env.RESEND_FROM_EMAIL ??
    "Immigration with NIPTEI <updates@niptei.com>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: `Your Immigration with NIPTEI login code: ${args.code}`,
        text:
          `Your login code is ${args.code}.\n\n` +
          `It expires in ${LOGIN_CODE_TTL_MINUTES} minutes and can be used once. ` +
          `If you did not try to log in, ignore this email — no one can log in without the code.\n\n` +
          `Immigration with NIPTEI — https://immigration.niptei.com`,
      }),
    });
    if (!res.ok) {
      return {
        sent: false,
        detail: `Resend refused the email (HTTP ${res.status}). No code was delivered.`,
      };
    }
    return { sent: true, detail: "Code emailed." };
  } catch {
    return {
      sent: false,
      detail: "Could not reach Resend. No code was delivered.",
    };
  }
}

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "Login is not configured — NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are not set. No code was issued and no session was created.",
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
  const password = typeof body.password === "string" ? body.password : "";
  const oauthAccessToken = asString(body.oauthAccessToken);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (!password && !oauthAccessToken) {
    return NextResponse.json(
      { error: "A password or a Google login is required." },
      { status: 400 }
    );
  }

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (password) {
    // Verify the password. The session returned here is discarded on
    // purpose — the email code is the second factor, and no session
    // exists until it is verified.
    const { error } = await anon.auth.signInWithPassword({ email, password });
    if (error) {
      return NextResponse.json(
        { error: "Email or password is incorrect." },
        { status: 401 }
      );
    }
  } else {
    // Verify the Google OAuth token belongs to this email.
    const { data, error } = await anon.auth.getUser(oauthAccessToken);
    if (error || !data.user || data.user.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: "Google login could not be verified for this email." },
        { status: 401 }
      );
    }
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The Immigration account for this email (public.accounts). Auth
  // alone is not enough: login needs the account + role.
  const { data: account, error: accountError } = await admin
    .from("accounts")
    .select("id, role")
    .eq("email", email)
    .maybeSingle();
  if (accountError || !account) {
    return NextResponse.json(
      {
        error:
          "No Immigration account exists for this email. Register first — a Supabase Auth user alone is not an Immigration account.",
      },
      { status: 400 }
    );
  }

  // Founder/Admin login is email + code ONLY — never Google. The login
  // page hides the Google button for founders, and this route enforces
  // it server-side: a Google token for a founder/admin account is refused.
  if (oauthAccessToken) {
    const accountRole = (account as { role: string }).role;
    if (accountRole === "founder" || accountRole === "admin") {
      return NextResponse.json(
        {
          error:
            "Founder/Admin login is email + code only — Google sign-in is not available for Founder/Admin accounts. Use your email and password, then the email code.",
        },
        { status: 403 }
      );
    }
  }

  const code = generateLoginCode();
  const { error: codeError } = await admin.from("login_codes").insert({
    account_id: (account as { id: string }).id,
    email,
    code_hash: hashLoginCode(code),
    expires_at: loginCodeExpiresAt().toISOString(),
  });
  if (codeError) {
    return NextResponse.json(
      {
        error: `Login code could not be issued: ${codeError.message}. Migration 0020 (login_codes) must have run.`,
      },
      { status: 500 }
    );
  }

  const emailResult = await sendCodeEmail({ to: email, code });
  if (!emailResult.sent) {
    return NextResponse.json(
      {
        error:
          "Email code could not be delivered. " +
          emailResult.detail +
          " No session was created.",
        stage: "code",
        emailNotConfigured: !process.env.RESEND_API_KEY,
      },
      { status: 501 }
    );
  }

  return NextResponse.json({
    ok: true,
    stage: "code",
    email,
    role: (account as { role: string }).role,
    expiresInSeconds: CODE_TTL_SECONDS,
    note: `A 6-digit code was emailed to ${email}. It expires in ${LOGIN_CODE_TTL_MINUTES} minutes and can be used once. Founder/Admin get a code every login — no exceptions, no remember-this-device.`,
  });
}
