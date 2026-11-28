// Fee-waiver check results API — /api/waiver-checks
// GET  ?caseId=<case id> — saved guided I-912 check results for the
//      case, newest first (fee_waiver_checks, migration 0029).
// POST — save a check result: { caseId, householdSize, region,
//      grounds, outcome, threshold150Cents }. The result is validated
//      server-side and REJECTED unless it is one of 'may_qualify' |
//      'no_ground_indicated' | 'cannot_tell' — there is no 'qualified'
//      value anywhere: this platform NEVER decides eligibility, only
//      USCIS does. The household income figure is NEVER accepted or
//      stored (only the 150% threshold it was compared against).
//      No DOB, A-Number, SSN, or passport number is accepted either.
// Until Supabase env vars are set this route returns 501.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  feeWaiver150Threshold,
  type FeeWaiverCheckOutcome,
  type FeeWaiverGround,
  type SponsorRegion,
} from "@/lib/feeWaiverChecker";
import { safeDbError } from "@/lib/apiErrors";
import { writeAuditLog } from "@/lib/auditLog";

export const runtime = "nodejs";

const OUTCOMES: FeeWaiverCheckOutcome[] = [
  "may_qualify",
  "no_ground_indicated",
  "cannot_tell",
];
const GROUNDS: FeeWaiverGround[] = [
  "means_tested_benefit",
  "income_150",
  "financial_hardship",
];
const REGIONS: SponsorRegion[] = ["contiguous", "alaska", "hawaii"];

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function notConfigured() {
  return NextResponse.json(
    {
      error:
        "Fee-waiver checks not configured — Supabase env vars are not set, so no check was read or stored. Run migration 0029 first.",
      notConfigured: true,
    },
    { status: 501 }
  );
}

export async function GET(req: Request) {
  const admin = serviceClient();
  if (!admin) return notConfigured();
  const caseId = new URL(req.url).searchParams.get("caseId");
  if (!caseId) {
    return NextResponse.json({ error: "caseId is required." }, { status: 400 });
  }
  const { data, error } = await admin
    .from("fee_waiver_checks")
    .select("id, case_id, household_size, region, grounds, result, threshold_150_cents, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      {
        error: safeDbError(
          "Could not read fee-waiver checks. No checks were returned.",
          "Migration 0029 may not have run yet.",
          error
        ),
      },
      { status: 500 }
    );
  }
  return NextResponse.json({ checks: data ?? [] });
}

export async function POST(req: Request) {
  const admin = serviceClient();
  if (!admin) return notConfigured();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const caseId = body.caseId as string | undefined;
  const householdSize = body.householdSize as number | undefined;
  const region = body.region as string | undefined;
  const grounds = body.grounds as string[] | undefined;
  const outcome = body.outcome as string | undefined;
  if (!caseId || !householdSize || !region || !outcome) {
    return NextResponse.json(
      { error: "caseId, householdSize, region and outcome are required." },
      { status: 400 }
    );
  }
  if (!OUTCOMES.includes(outcome as FeeWaiverCheckOutcome)) {
    return NextResponse.json(
      {
        error: `Outcome "${outcome}" is not accepted — a fee-waiver check can only be may_qualify, no_ground_indicated, or cannot_tell. This platform never decides eligibility.`,
      },
      { status: 400 }
    );
  }
  if (!REGIONS.includes(region as SponsorRegion)) {
    return NextResponse.json(
      { error: `Unknown region "${region}". Use contiguous, alaska, or hawaii.` },
      { status: 400 }
    );
  }
  if (
    body.annualHouseholdIncome !== undefined ||
    body.income !== undefined ||
    body.ssn !== undefined ||
    body.aNumber !== undefined
  ) {
    return NextResponse.json(
      {
        error:
          "Income figures, SSNs and A-Numbers are never accepted by this route — only the household size, region, grounds, outcome, and the 150% threshold are stored.",
      },
      { status: 400 }
    );
  }
  const cleanGrounds = (Array.isArray(grounds) ? grounds : []).filter((g) =>
    GROUNDS.includes(g as FeeWaiverGround)
  );
  const threshold150 = feeWaiver150Threshold(
    Math.max(1, Math.floor(householdSize)),
    region as SponsorRegion
  );
  // checked_by: the caller's account id is resolved from the token
  // by the caller passing it is NOT trusted — the service client
  // cannot know the caller, so the route requires checkedByAccountId
  // to match a real account on the case (client or assigned
  // provider), enforced by the RLS policy on insert via the anon
  // client is not available here; instead verify the account exists
  // and is a participant on the case before inserting.
  const checkedBy = body.checkedByAccountId as string | undefined;
  if (!checkedBy) {
    return NextResponse.json(
      { error: "checkedByAccountId is required." },
      { status: 400 }
    );
  }
  const { data: caseRow } = await admin
    .from("cases")
    .select("id, client_id, assigned_provider_id")
    .eq("id", caseId)
    .maybeSingle();
  const c = caseRow as {
    client_id?: string;
    assigned_provider_id?: string;
  } | null;
  if (!c || (c.client_id !== checkedBy && c.assigned_provider_id !== checkedBy)) {
    return NextResponse.json(
      {
        error:
          "Only the client on the case or its assigned provider can save a fee-waiver check for it.",
      },
      { status: 403 }
    );
  }
  const { data, error } = await admin
    .from("fee_waiver_checks")
    .insert({
      case_id: caseId,
      checked_by: checkedBy,
      household_size: Math.max(1, Math.floor(householdSize)),
      region,
      grounds: cleanGrounds,
      result: outcome,
      threshold_150_cents: threshold150 * 100,
    })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json(
      {
        error: safeDbError(
          "Could not save the fee-waiver check. Nothing was saved.",
          "Migration 0029 may not have run yet.",
          error
        ),
      },
      { status: 500 }
    );
  }
  // Audit: a waiver check is a sensitive write (it records a guided
  // result on a case). Log the outcome code only — never the income
  // figure (never accepted), never any threshold amount.
  await writeAuditLog(admin, {
    actorId: checkedBy,
    action: "fee_waiver_check_saved",
    entityType: "fee_waiver_checks",
    entityId: (data as { id: string }).id,
    caseId,
    detail: { result: outcome, region },
  });
  return NextResponse.json({
    ok: true,
    id: (data as { id: string }).id,
    outcome,
    note: "Saved as a guided check result only — this is not a decision. Only USCIS decides a fee waiver.",
  });
}
