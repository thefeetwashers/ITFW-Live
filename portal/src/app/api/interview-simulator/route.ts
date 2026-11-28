// GET /api/interview-simulator — timed mock-interview run plan (paid only).
// POST /api/interview-simulator — score a practice run (paid only).
//
// Same server-side gate as /api/interview-prep: the caller is
// identified by their Supabase Auth access token (Authorization:
// Bearer <token>), verified with the anon client; the account is read
// with the service-role client; src/lib/paywall.ts decides (surface
// "interview_prep"). Unpaid callers get 403 and NO content.
//
//   GET  ?bank=n400-civics|n400-personal|i485|consular&date=YYYY-MM-DD
//        200 { allowed, plan } — the plan has QUESTIONS ONLY, never
//        official answers. The browser must not see answers before
//        answering, or the practice is worthless.
//   POST { bankId, answers: [{ questionId, answerText, secondsTaken,
//        matchesApplication?, namedSupportingDocument? }] }
//        200 { allowed, result } — the score. PRACTICE ONLY: the
//        result carries the practice label + no-prediction notice and
//        never predicts the real interview outcome.
//   401 no / invalid token. 403 unpaid. 501 Supabase not configured.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPaidAccessForAccount } from "@/lib/paywall";
import {
  buildRunPlan,
  scoreRun,
  type SimulatorAnswer,
  type SimulatorBankId,
} from "@/lib/interviewSimulator";

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

async function paidAccountId(req: Request) {
  const cs = clients();
  if (!cs) return { status: 501 as const, accountId: null };
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { status: 401 as const, accountId: null };
  const { data: userData, error: userError } = await cs.anon.auth.getUser(token);
  if (userError || !userData.user) {
    return { status: 401 as const, accountId: null };
  }
  const { data: account, error: accountError } = await cs.admin
    .from("accounts")
    .select("id")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (accountError || !account) {
    return { status: 403 as const, accountId: null };
  }
  const decision = await getPaidAccessForAccount(
    (account as { id: string }).id,
    "interview_prep"
  );
  if (!decision.allowed) {
    return {
      status: 403 as const,
      accountId: null,
      reason: decision.reason,
      unlockPriceKey: decision.unlockPriceKey,
      unlockLabel: decision.unlockLabel,
    };
  }
  return { status: 200 as const, accountId: (account as { id: string }).id };
}

const BANKS: SimulatorBankId[] = [
  "n400-civics",
  "n400-personal",
  "i485",
  "consular",
];

export async function GET(req: Request) {
  const auth = await paidAccountId(req);
  if (auth.status === 501) {
    return NextResponse.json(
      {
        error:
          "Payment records are not connected yet (Supabase is not configured), so access cannot be verified. Nothing is unlocked.",
        allowed: false,
      },
      { status: 501 }
    );
  }
  if (auth.status === 401) {
    return NextResponse.json(
      { error: "Sign in first — no access token was sent.", allowed: false },
      { status: 401 }
    );
  }
  if (auth.status === 403) {
    return NextResponse.json(
      {
        error:
          (auth as { reason?: string }).reason ??
          "No Immigration account exists for this login.",
        allowed: false,
        unlockPriceKey: (auth as { unlockPriceKey?: string }).unlockPriceKey,
        unlockLabel: (auth as { unlockLabel?: string }).unlockLabel,
      },
      { status: 403 }
    );
  }
  const url = new URL(req.url);
  const bank = (url.searchParams.get("bank") ?? "n400-civics") as SimulatorBankId;
  if (!BANKS.includes(bank)) {
    return NextResponse.json(
      { error: `Unknown interview bank "${bank}".`, allowed: true },
      { status: 400 }
    );
  }
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const plan = buildRunPlan(bank, date);
  return NextResponse.json({ allowed: true, plan });
}

export async function POST(req: Request) {
  const auth = await paidAccountId(req);
  if (auth.status !== 200) {
    const status = auth.status as 401 | 403 | 501;
    return NextResponse.json(
      {
        error:
          status === 501
            ? "Payment records are not connected yet (Supabase is not configured), so access cannot be verified. Nothing is unlocked."
            : status === 401
              ? "Sign in first — no access token was sent."
              : ((auth as { reason?: string }).reason ??
                "No Immigration account exists for this login."),
        allowed: false,
      },
      { status }
    );
  }
  let body: { bankId?: string; answers?: SimulatorAnswer[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Send JSON: { bankId, answers: [...] }.", allowed: true },
      { status: 400 }
    );
  }
  if (!body.bankId || !BANKS.includes(body.bankId as SimulatorBankId)) {
    return NextResponse.json(
      { error: `Unknown interview bank "${String(body.bankId)}".`, allowed: true },
      { status: 400 }
    );
  }
  if (!Array.isArray(body.answers)) {
    return NextResponse.json(
      { error: "answers must be an array.", allowed: true },
      { status: 400 }
    );
  }
  const result = scoreRun(body.bankId as SimulatorBankId, body.answers);
  if (!result) {
    return NextResponse.json(
      { error: "Could not score that run.", allowed: true },
      { status: 400 }
    );
  }
  return NextResponse.json({ allowed: true, result });
}
