// Renewal reminders API — /api/renewals
// GET  ?caseId=<case id> — case_renewals rows for the case, with the
//      derived remind-on / due / next-nudge dates (see src/lib/renewals.ts).
//      Rows exist only when a real expiry/eligibility date was entered.
// POST — add a renewal row: { caseId, renewalType, eligibilityOrExpiryDate,
//      formToFile?, nudgeLanguage? }. Types are the widened set from
//      migration 0017 plus migration 0029 (advance_parole, visa):
//      ead, green_card (I-90), conditional_green_card (I-751), tps,
//      passport, advance_parole (I-131 renewal), visa, n400.
//      The 180/90/30/7-day reminder ladder is derived in
//      src/lib/renewals.ts (renewalReminderRungs); sending a due
//      reminder is POST /api/renewals/remind (honest 501 until SES is
//      connected — see src/lib/renewalReminders.ts).
// Nudges are QUEUED only (48h, in the client's language, via
// reminder_nudges + /api/reminders): Twilio/AWS SES are NOT connected,
// so nothing is ever claimed sent.
// Until Supabase env vars are set this route returns 501.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import {
  deriveRenewals,
  RENEWAL_FORM_TO_FILE,
  type RenewalInput,
  type RenewalType,
} from "@/lib/renewals";

const RENEWAL_TYPES: RenewalType[] = [
  "ead",
  "green_card",
  "conditional_green_card",
  "tps",
  "passport",
  "advance_parole",
  "visa",
  "n400",
];

function notConfigured() {
  return NextResponse.json(
    {
      error:
        "Renewals not configured — Supabase env vars are not set, so no renewal was read or stored. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY, and run migration 0017 first.",
    },
    { status: 501 }
  );
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  const caseId = new URL(req.url).searchParams.get("caseId");
  if (!caseId) {
    return NextResponse.json({ error: "caseId is required." }, { status: 400 });
  }
  const supabase = getSupabase();
  if (!supabase) return notConfigured();
  const { data, error } = await supabase
    .from("case_renewals")
    .select("id, case_id, renewal_type, eligibility_or_expiry_date, status, nudge_language, last_nudged_at")
    .eq("case_id", caseId)
    .order("eligibility_or_expiry_date", { ascending: true });
  if (error) {
    return NextResponse.json(
      { error: `Could not read renewals: ${error.message}. Migration 0017 may not have run yet.` },
      { status: 500 }
    );
  }
  const inputs: RenewalInput[] = (data ?? []).map((r) => ({
    id: r.id as string,
    caseId: r.case_id as string,
    type: r.renewal_type as RenewalType,
    eligibilityOrExpiryDate: r.eligibility_or_expiry_date as string,
    status: r.status as RenewalInput["status"],
    language: (r.nudge_language as string | undefined) ?? "en",
    lastNudgedAt: (r.last_nudged_at as string | null) ?? null,
  }));
  return NextResponse.json({ renewals: deriveRenewals(inputs) });
}

export async function POST(req: Request) {
  const admin = serviceClient();
  if (!admin) return notConfigured();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const caseId = body.caseId as string | undefined;
  const renewalType = body.renewalType as string | undefined;
  const date = body.eligibilityOrExpiryDate as string | undefined;
  if (!caseId || !renewalType || !date) {
    return NextResponse.json(
      { error: "caseId, renewalType and eligibilityOrExpiryDate are required." },
      { status: 400 }
    );
  }
  if (!RENEWAL_TYPES.includes(renewalType as RenewalType)) {
    return NextResponse.json(
      { error: `Unknown renewal type "${renewalType}". Use one of: ${RENEWAL_TYPES.join(", ")}.` },
      { status: 400 }
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T12:00:00Z`).getTime())) {
    return NextResponse.json(
      { error: "eligibilityOrExpiryDate must be a real date (YYYY-MM-DD). No date is guessed." },
      { status: 400 }
    );
  }
  const type = renewalType as RenewalType;
  const { data, error } = await admin
    .from("case_renewals")
    .insert({
      case_id: caseId,
      renewal_type: type,
      eligibility_or_expiry_date: date,
      form_to_file: typeof body.formToFile === "string" ? body.formToFile : RENEWAL_FORM_TO_FILE[type],
      nudge_language: typeof body.nudgeLanguage === "string" ? body.nudgeLanguage : "en",
      status: "upcoming",
    })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ error: `Renewal was NOT stored: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}
