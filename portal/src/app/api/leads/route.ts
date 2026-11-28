// POST /api/leads — public lead capture (Lead Generator funnel).
// GET  /api/leads?preparerId=<account id> — list a preparer's leads.
//
// POST: a real person filled in the intake form (name, phone, email,
// language, service needed, inside/outside US, documents ready,
// interview date, urgency). The server validates, prices from the
// LOCKED prices only (resolveQuotedFee), scores transparently
// (scoreLead — every point has its reason), and inserts ONE row into
// preparer_leads (0010 + 0017 referral columns + 0021 scoring columns).
// pipeline_stage starts at 'new_lead'. No lead is ever invented, no
// list is bought, nothing is scraped, no SSN is asked for or stored.
//
// The preparer must be identified by the link the visitor used:
// providerSlug (/p/[slug]) or referralCode (/r/[code]). Without either,
// the route refuses with 400 — it never assigns a lead to a guessed
// preparer. Returns 501 / notConfigured when Supabase env vars are
// missing, and creates NOTHING then.
//
// GET: returns only rows visible to the caller's session (the request's
// Authorization header is forwarded to the anon client, so RLS
// applies as that user). With no session the list is empty — never a
// service-role bypass. Empty list returns [] with an honest empty
// state, never invented rows.
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  validateLeadCapture,
  scoreLead,
  defaultFollowUpDate,
  followUpStatus,
} from "@/lib/leadScoring";
import { resolveQuotedFee } from "@/lib/lifecycle";
import {
  checkRateLimit,
  PUBLIC_INTAKE_LIMIT,
  rateLimitKey,
  rateLimitResponse,
} from "@/lib/rateLimit";
import { isMissingSchemaError, safeDbError } from "@/lib/apiErrors";
import { writeAuditLog } from "@/lib/auditLog";

export const runtime = "nodejs";

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function notConfigured() {
  return NextResponse.json(
    {
      error:
        "Lead capture not configured — NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set. No lead was saved.",
      notConfigured: true,
    },
    { status: 501 }
  );
}

type PreparerResolution =
  | { ok: true; preparerId: string; referrerAccountId: string | null }
  | { ok: false; error: string };

async function resolvePreparer(
  admin: SupabaseClient,
  providerSlug: string | null,
  referralCode: string | null
): Promise<PreparerResolution> {
  if (providerSlug) {
    const { data, error } = await admin
      .from("professional_profiles")
      .select("account_id")
      .eq("slug", providerSlug)
      .maybeSingle();
    if (error) return { ok: false, error: "Could not look up the professional. Try again." };
    const row = data as { account_id: string } | null;
    if (!row) return { ok: false, error: `No professional profile with slug "${providerSlug}".` };
    return { ok: true, preparerId: row.account_id, referrerAccountId: null };
  }
  if (referralCode) {
    // 1. A professional's own referral code.
    const { data: profiles, error: profileError } = await admin
      .from("professional_profiles")
      .select("account_id")
      .eq("referral_code", referralCode)
      .limit(1);
    if (profileError) {
      return { ok: false, error: "Could not resolve the referral code. Try again." };
    }
    const profile = (profiles as { account_id: string }[] | null)?.[0];
    if (profile) {
      return { ok: true, preparerId: profile.account_id, referrerAccountId: profile.account_id };
    }
    // 2. A client's account-level code: the referrer stays the client,
    //    and the lead goes to that client's latest case provider.
    const { data: accounts, error: accountError } = await admin
      .from("accounts")
      .select("id")
      .eq("referral_code", referralCode)
      .limit(1);
    if (accountError) {
      return { ok: false, error: "Could not resolve the referral code. Try again." };
    }
    const referrer = (accounts as { id: string }[] | null)?.[0];
    if (!referrer) {
      return { ok: false, error: `No referral code "${referralCode}" matches a professional or a client.` };
    }
    const { data: cases, error: caseError } = await admin
      .from("cases")
      .select("assigned_provider_id")
      .eq("client_id", referrer.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (caseError) {
      return { ok: false, error: "Could not find the referrer's provider. Try again." };
    }
    const latest = (cases as { assigned_provider_id: string | null }[] | null)?.[0];
    if (!latest?.assigned_provider_id) {
      return {
        ok: false,
        error:
          "The referrer has no case with an assigned provider yet, so this lead cannot be routed. Ask the referrer for their professional's link.",
      };
    }
    return {
      ok: true,
      preparerId: latest.assigned_provider_id,
      referrerAccountId: referrer.id,
    };
  }
  return {
    ok: false,
    error:
      "No professional was identified — open this form from a professional's page (/p/[slug]) or a referral link (/r/[code]). A lead is never assigned to a guessed preparer.",
  };
}

export async function POST(req: Request) {
  // Public intake route: a bot must not be able to spam lead capture.
  // 10/minute per IP, honest 429, never a fake success.
  const limited = checkRateLimit(
    rateLimitKey("leads", req),
    PUBLIC_INTAKE_LIMIT.limit,
    PUBLIC_INTAKE_LIMIT.windowMs
  );
  if (!limited.allowed) {
    return rateLimitResponse(limited.retryAfterSeconds, "lead submissions");
  }

  const admin = serviceClient();
  if (!admin) return notConfigured();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  let input;
  try {
    input = validateLeadCapture(body);
  } catch (e) {
    return NextResponse.json(
      { error: `Validation failed: ${e instanceof Error ? e.message : "invalid lead."} Nothing was saved.` },
      { status: 400 }
    );
  }

  const resolved = await resolvePreparer(admin, input.providerSlug, input.referralCode);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: `${resolved.error} Nothing was saved.` },
      { status: 400 }
    );
  }

  const quote = resolveQuotedFee(input.serviceRequested, input.serviceTier);
  const score = scoreLead({
    documentsReady: input.documentsReady,
    interviewDate: input.interviewDate || null,
    urgency: input.urgency,
    serviceRequested: input.serviceRequested,
    viaReferral: input.referralCode !== null,
  });

  // Base row: migration 0010 columns + 0017 referral columns.
  const baseInsert: Record<string, unknown> = {
    preparer_id: resolved.preparerId,
    full_name: input.fullName,
    email: input.email,
    phone: input.phone,
    preferred_language: input.preferredLanguage,
    lead_source: input.referralCode ? "Referral" : "public-intake",
    service_interested: input.serviceRequested,
    quoted_fee_cents: quote.amountCents,
    pipeline_stage: "new_lead",
    follow_up_date: defaultFollowUpDate(),
    notes: [
      `Beneficiary location: ${input.beneficiaryLocation ?? "not stated"}.`,
      quote.amountCents === null
        ? "Quote: TO BE CONFIRMED — no locked price for this service."
        : `Quoted prep fee: $${(quote.amountCents / 100).toLocaleString("en-US")} (${input.serviceTier}). Government fees separate.`,
      `Lead score ${score.score} (${score.bandLabel}).`,
      // Free-tool follow-up (Nov 28, 2026): the tool id lives in the
      // notes too, so the arrival is recorded even before migration
      // 0033 (tool_used column) has run. Never a guessed tool.
      input.toolUsed ? `Arrived via free tool: ${input.toolUsed}.` : null,
    ]
      .filter((n): n is string => n !== null)
      .join(" "),
  };
  if (input.referralCode) {
    baseInsert.referral_source = "Referral";
    baseInsert.referral_code = input.referralCode;
    baseInsert.referrer_account_id = resolved.referrerAccountId;
  }

  // Full row adds the migration 0021 scoring columns + 0028 arrival
  // channel + 0033 tool_used. If a migration has not been run yet the
  // insert fails on an unknown column — retry without them and say so
  // honestly instead of failing the lead.
  const fullInsert: Record<string, unknown> = {
    ...baseInsert,
    beneficiary_location: input.beneficiaryLocation,
    documents_ready: input.documentsReady,
    interview_date: input.interviewDate || null,
    urgency: input.urgency,
    lead_score: score.score,
    lead_score_reasons: score.reasons,
    arrival_channel: input.arrivalChannel ?? (input.toolUsed ? "other" : null),
    tool_used: input.toolUsed,
  };

  let leadId: string | null = null;
  let migration0021Pending = false;
  const { data: fullRow, error: fullError } = await admin
    .from("preparer_leads")
    .insert(fullInsert)
    .select("id")
    .single();
  if (fullError) {
    // Missing-column detection by Postgres error CODE (42P01/42703),
    // not by matching the message text — the message can name the
    // schema and must not reach the caller.
    if (isMissingSchemaError(fullError)) {
      migration0021Pending = true;
      const { data: baseRow, error: baseError } = await admin
        .from("preparer_leads")
        .insert(baseInsert)
        .select("id")
        .single();
      if (baseError || !baseRow) {
        return NextResponse.json(
          {
            error: safeDbError(
              "Lead could not be saved. Nothing was saved.",
              undefined,
              baseError ?? undefined
            ),
          },
          { status: 500 }
        );
      }
      leadId = (baseRow as { id: string }).id;
    } else {
      return NextResponse.json(
        {
          error: safeDbError(
            "Lead could not be saved. Nothing was saved.",
            undefined,
            fullError
          ),
        },
        { status: 500 }
      );
    }
  } else if (fullRow) {
    leadId = (fullRow as { id: string }).id;
  }

  // Audit: a lead capture is a money-adjacent write (a quoted fee is
  // attached). Log ids/status only — no name, email, phone, or amount.
  if (leadId) {
    await writeAuditLog(admin, {
      actorId: resolved.preparerId,
      action: "lead_saved",
      entityType: "preparer_leads",
      entityId: leadId,
      detail: { pipeline_stage: "new_lead" },
    });
  }

  return NextResponse.json(
    {
      ok: true,
      leadId,
      pipelineStage: "new_lead",
      followUpDate: defaultFollowUpDate(),
      quotedFeeCents: quote.amountCents,
      quotedFeeNote: quote.note,
      leadScore: score.score,
      leadScoreBand: score.bandLabel,
      leadScoreReasons: score.reasons,
      migration0021Pending,
      note: migration0021Pending
        ? "Saved, but a newer migration has not been run yet (0021 scoring, 0028 arrival channel, or 0033 tool_used), so those fields were kept in notes only. Run the pending migration to store them as columns."
        : "Saved as a new lead. No case exists yet and no fee is due.",
    },
    { status: 201 }
  );
}

export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return notConfigured();
  const params = new URL(req.url).searchParams;
  const preparerId = params.get("preparerId");
  if (!preparerId) {
    return NextResponse.json(
      { error: "preparerId query parameter is required." },
      { status: 400 }
    );
  }
  // Forward the caller's session so RLS applies as that user. No
  // service-role read: a caller only ever sees their own leads.
  const authHeader = req.headers.get("authorization") ?? undefined;
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });
  const { data, error } = await client
    .from("preparer_leads")
    .select(
      "id, full_name, email, phone, preferred_language, lead_source, referral_source, service_interested, quoted_fee_cents, pipeline_stage, follow_up_date, quote_expires_at, lost_reason, lead_score, lead_score_reasons, beneficiary_location, documents_ready, interview_date, urgency, created_at"
    )
    .eq("preparer_id", preparerId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      {
        error: safeDbError(
          "Could not list leads. No leads were returned.",
          "Migration 0010 / 0021 may not have run yet.",
          error
        ),
      },
      { status: 500 }
    );
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  return NextResponse.json({
    ok: true,
    leads: rows.map((r) => ({
      ...r,
      followUp: followUpStatus(
        typeof r.follow_up_date === "string" ? r.follow_up_date : null,
        {
          converted: r.pipeline_stage === "converted",
          lost: r.pipeline_stage === "lost",
        }
      ),
    })),
    emptyState:
      rows.length === 0
        ? "No leads yet — share your referral link to bring in your first enquiry."
        : null,
  });
}
