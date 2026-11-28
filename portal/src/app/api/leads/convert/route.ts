// POST /api/leads/convert — convert a lead into an existing case.
//
// Writes preparer_leads.pipeline_stage = 'converted' + a
// case_lifecycle row with stage 2 (payment_plan), per the existing
// convention in confirm-intake-order/route.ts. A case is NEVER invented
// here: the caller must pass the caseId of a case that already exists
// (created by Smart Intake / confirm-intake-order, or by the
// professional). With no caseId the route refuses with 400 and changes
// nothing. A quote past its expiry blocks conversion until the
// professional re-confirms it (quoteReconfirmed: true).
//
// Returns 501 / notConfigured when Supabase env vars are missing.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildConversionUpdate } from "@/lib/pipeline";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      {
        error:
          "Conversion not configured — NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set. Nothing was changed.",
        notConfigured: true,
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
  const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
  const caseId = typeof body.caseId === "string" && body.caseId.trim() ? body.caseId.trim() : null;
  const quoteReconfirmed = body.quoteReconfirmed === true;
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required." }, { status: 400 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: lead, error: leadError } = await admin
    .from("preparer_leads")
    .select("id, pipeline_stage, quote_expires_at")
    .eq("id", leadId)
    .maybeSingle();
  if (leadError) {
    return NextResponse.json(
      { error: `Could not look up the lead: ${leadError.message}. Nothing was changed.` },
      { status: 500 }
    );
  }
  const row = lead as {
    id: string;
    pipeline_stage: string;
    quote_expires_at: string | null;
  } | null;
  if (!row) {
    return NextResponse.json(
      { error: `No lead with id "${leadId}". Nothing was changed.` },
      { status: 404 }
    );
  }

  const decision = buildConversionUpdate({
    leadId: row.id,
    caseId,
    quoteExpiresAt: row.quote_expires_at
      ? String(row.quote_expires_at).slice(0, 10)
      : null,
    quoteReconfirmed,
    currentPipelineStage: row.pipeline_stage,
  });
  if (!decision.ok) {
    return NextResponse.json(
      { error: `${decision.error} Nothing was changed.` },
      { status: 400 }
    );
  }

  // The case must really exist — never link a lead to a case id that
  // is not in the database.
  const { data: caseRow, error: caseError } = await admin
    .from("cases")
    .select("id")
    .eq("id", decision.leadUpdate.case_id)
    .maybeSingle();
  if (caseError) {
    return NextResponse.json(
      { error: `Could not look up the case: ${caseError.message}. Nothing was changed.` },
      { status: 500 }
    );
  }
  if (!caseRow) {
    return NextResponse.json(
      {
        error: `No case with id "${decision.leadUpdate.case_id}". A case is never invented by conversion — create it first. Nothing was changed.`,
      },
      { status: 404 }
    );
  }

  // Clear any current lifecycle row first: case_lifecycle has a unique
  // partial index on (case_id) where is_current = true (migration 0010).
  const { error: clearError } = await admin
    .from("case_lifecycle")
    .update({ is_current: false })
    .eq("case_id", decision.lifecycleInsert.case_id)
    .eq("is_current", true);
  if (clearError) {
    return NextResponse.json(
      { error: `Could not clear the current lifecycle stage: ${clearError.message}. Nothing was changed.` },
      { status: 500 }
    );
  }
  const { error: lifecycleError } = await admin
    .from("case_lifecycle")
    .insert(decision.lifecycleInsert);
  if (lifecycleError) {
    return NextResponse.json(
      { error: `Lifecycle stage could not be recorded: ${lifecycleError.message}. The lead was NOT converted.` },
      { status: 500 }
    );
  }

  const { error: updateError } = await admin
    .from("preparer_leads")
    .update(decision.leadUpdate)
    .eq("id", row.id);
  if (updateError) {
    // The lifecycle row is already written; report it honestly rather
    // than pretending the conversion fully happened.
    return NextResponse.json(
      {
        error: `Lifecycle stage 2 was recorded, but the lead row could not be updated: ${updateError.message}. The lead still shows its old stage — retry the conversion.`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    leadId: row.id,
    caseId: decision.leadUpdate.case_id,
    pipelineStage: "converted",
    lifecycleStage: 2,
    lifecycleStageLabel: "payment_plan",
  });
}
