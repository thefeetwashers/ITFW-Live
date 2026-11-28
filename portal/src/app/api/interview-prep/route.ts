// GET /api/interview-prep — serve the interview question banks ONLY
// to a paid, signed-in user.
//
// Server-side gate: the caller is identified by their Supabase Auth
// access token (Authorization: Bearer <token>), verified with the
// anon client; the account is read with the service-role client; and
// src/lib/paywall.ts decides from professional_profiles
// .subscription_status + paid invoices. Unpaid callers get 403 and NO
// question data. The interview-prep page never imports
// src/lib/interviewPrep.ts — it fetches this route — so unpaid
// visitors cannot read the banks from the page bundle.
//
// Responses:
//   200 { banks, whatToBring, conduct, whatOfficerLooksFor,
//         delayDenialReasons, videoScripts, counts, noGuaranteeNotice }
//   401 no / invalid token
//   403 unpaid — { error, unlockPriceKey, unlockLabel } (no content)
//   501 Supabase not configured — access denied, fail closed
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPaidAccessForAccount } from "@/lib/paywall";
import {
  CONDUCT_GUIDE,
  DELAY_DENIAL_REASONS,
  INTERVIEW_BANKS,
  NO_GUARANTEE_NOTICE,
  VIDEO_SCRIPTS,
  WHAT_OFFICER_LOOKS_FOR,
  WHAT_TO_BRING,
  interviewQuestionCounts,
} from "@/lib/interviewPrep";

export const runtime = "nodejs";

function clients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return null;
  return {
    anon: createClient(url, anonKey, { auth: { persistSession: false } }),
    admin: createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

export async function GET(req: Request) {
  const cs = clients();
  if (!cs) {
    return NextResponse.json(
      {
        error:
          "Payment records are not connected yet (Supabase is not configured), so access cannot be verified. Nothing is unlocked.",
        allowed: false,
      },
      { status: 501 }
    );
  }
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return NextResponse.json(
      { error: "Sign in first — no access token was sent.", allowed: false },
      { status: 401 }
    );
  }
  const { data: userData, error: userError } = await cs.anon.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json(
      { error: "Your login could not be verified. Sign in again.", allowed: false },
      { status: 401 }
    );
  }
  const { data: account, error: accountError } = await cs.admin
    .from("accounts")
    .select("id")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (accountError || !account) {
    return NextResponse.json(
      { error: "No Immigration account exists for this login.", allowed: false },
      { status: 403 }
    );
  }

  const decision = await getPaidAccessForAccount(
    (account as { id: string }).id,
    "interview_prep"
  );
  if (!decision.allowed) {
    return NextResponse.json(
      {
        error: decision.reason,
        allowed: false,
        unlockPriceKey: decision.unlockPriceKey,
        unlockLabel: decision.unlockLabel,
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    allowed: true,
    role: decision.role,
    banks: INTERVIEW_BANKS,
    whatToBring: WHAT_TO_BRING,
    conduct: CONDUCT_GUIDE,
    whatOfficerLooksFor: WHAT_OFFICER_LOOKS_FOR,
    delayDenialReasons: DELAY_DENIAL_REASONS,
    videoScripts: VIDEO_SCRIPTS,
    counts: interviewQuestionCounts(),
    noGuaranteeNotice: NO_GUARANTEE_NOTICE,
  });
}
