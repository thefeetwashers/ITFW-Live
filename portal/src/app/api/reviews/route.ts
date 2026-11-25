// Real reviews API — /api/reviews
// GET    ?professionalId=<account id> — visible, consented reviews for
//        that professional's storefront. Public read (RLS allows it).
// POST   — a client leaves a review. Gates (all checked here, and the
//        DB trigger + RLS enforce them again): a real case, stage 6
//        (closed) in case_lifecycle, the case belongs to this client and
//        is assigned to this professional, consent_given = true.
// PATCH  — { id, replyText } professional reply, or
//        { id, hide: true, hiddenReason, actorAccountId } founder/admin
//        hide with a reason (role is read from accounts; the DB trigger
//        also requires hidden_reason and logs the hide to audit_log).
//        There is NO delete and NO edit of rating/text/name/service.
// Until Supabase env vars are set this route returns 501 and stores
// nothing. Auth note: no Supabase Auth session is wired into this
// build yet, so the caller names their account id and the route
// verifies the case belongs to that account + the stage-6 gate; the
// RLS policies + trigger are the enforcement once auth is wired.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { validateReview } from "@/lib/reviews";

const NOT_CONFIGURED = {
  error:
    "Reviews not configured — Supabase env vars are not set, so no review was stored. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY, and run migration 0017 first.",
};

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function notConfigured() {
  return NextResponse.json(NOT_CONFIGURED, { status: 501 });
}

export async function GET(req: Request) {
  const professionalId = new URL(req.url).searchParams.get("professionalId");
  if (!professionalId) {
    return NextResponse.json(
      { error: "professionalId is required." },
      { status: 400 }
    );
  }
  const supabase = getSupabase();
  if (!supabase) return notConfigured();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("professional_account_id", professionalId)
    .eq("visible", true)
    .eq("consent_given", true)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      {
        error: `Could not read reviews: ${error.message}. Migration 0017 may not have run yet.`,
      },
      { status: 500 }
    );
  }
  return NextResponse.json({ reviews: data ?? [] });
}

export async function POST(req: Request) {
  const admin = serviceClient();
  if (!admin) return notConfigured();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const errors = validateReview({
    caseId: body.caseId,
    professionalAccountId: body.professionalAccountId,
    serviceFormCode: body.serviceFormCode,
    rating: body.rating,
    body: body.body,
    displayName: body.displayName,
    consentGiven: body.consentGiven,
  });
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }
  const caseId = body.caseId as string;
  const clientAccountId = body.clientAccountId as string;
  const professionalAccountId = body.professionalAccountId as string;
  if (!clientAccountId) {
    return NextResponse.json(
      { error: "clientAccountId is required — a review is tied to the real client on the case." },
      { status: 400 }
    );
  }
  // Gate 1: the case exists, belongs to this client, assigned to this professional.
  const { data: cases, error: caseError } = await admin
    .from("cases")
    .select("id, client_id, assigned_provider_id")
    .eq("id", caseId)
    .limit(1);
  if (caseError) {
    return NextResponse.json({ error: `Could not check the case: ${caseError.message}` }, { status: 500 });
  }
  const theCase = cases?.[0];
  if (!theCase) {
    return NextResponse.json(
      { error: "No such case — a review can only be left after a real case." },
      { status: 404 }
    );
  }
  if (theCase.client_id !== clientAccountId) {
    return NextResponse.json(
      { error: "This case does not belong to that client — a review can only be left by the client on the case." },
      { status: 403 }
    );
  }
  if (theCase.assigned_provider_id !== professionalAccountId) {
    return NextResponse.json(
      { error: "This case is not assigned to that professional — a review is tied to the professional you used." },
      { status: 403 }
    );
  }
  // Gate 2: stage 6 (closed) — the latest case_lifecycle row must be stage 6.
  const { data: lifecycle, error: lifeError } = await admin
    .from("case_lifecycle")
    .select("stage")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (lifeError) {
    return NextResponse.json({ error: `Could not check the case stage: ${lifeError.message}` }, { status: 500 });
  }
  if (!lifecycle?.[0] || lifecycle[0].stage !== 6) {
    return NextResponse.json(
      {
        error:
          "Reviews open only after your case closes (stage 6). This case has not reached stage 6 yet, so no review was stored.",
      },
      { status: 409 }
    );
  }
  const { data, error } = await admin
    .from("reviews")
    .insert({
      case_id: caseId,
      professional_account_id: professionalAccountId,
      client_account_id: clientAccountId,
      service_form_code: body.serviceFormCode,
      service_name: typeof body.serviceName === "string" ? body.serviceName : null,
      rating: body.rating,
      body: (body.body as string).trim(),
      consent_given: true,
      display_name_choice: body.displayNameChoice === "full_name" ? "full_name" : "first_name_initial",
      display_name: (body.displayName as string).trim(),
    })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json(
      { error: `Review was NOT stored: ${error.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}

export async function PATCH(req: Request) {
  const admin = serviceClient();
  if (!admin) return notConfigured();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = body.id as string | undefined;
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }
  // Hide path — founder/admin only, with a reason (the DB trigger also
  // requires hidden_reason and logs the hide to audit_log).
  if (body.hide === true) {
    const hiddenReason = typeof body.hiddenReason === "string" ? body.hiddenReason.trim() : "";
    if (!hiddenReason) {
      return NextResponse.json(
        { error: "Hiding a review requires a reason (hiddenReason)." },
        { status: 400 }
      );
    }
    const actorAccountId = body.actorAccountId as string | undefined;
    if (!actorAccountId) {
      return NextResponse.json({ error: "actorAccountId is required to hide a review." }, { status: 400 });
    }
    const { data: actors } = await admin
      .from("accounts")
      .select("role")
      .eq("id", actorAccountId)
      .limit(1);
    const role = actors?.[0]?.role as string | undefined;
    if (role !== "admin" && role !== "founder") {
      return NextResponse.json(
        { error: "Only a founder/admin can hide a review — and only with a reason." },
        { status: 403 }
      );
    }
    const { error } = await admin
      .from("reviews")
      .update({ visible: false, hidden_reason: hiddenReason, hidden_by: actorAccountId, hidden_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: `Review was NOT hidden: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true, hidden: true });
  }
  // Reply path — the professional's reply (the only thing they may change).
  const replyText = typeof body.replyText === "string" ? body.replyText.trim() : "";
  if (!replyText) {
    return NextResponse.json({ error: "replyText is required." }, { status: 400 });
  }
  const { error } = await admin
    .from("reviews")
    .update({
      reply_text: replyText,
      replied_at: new Date().toISOString(),
      replied_by: typeof body.actorAccountId === "string" ? body.actorAccountId : null,
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: `Reply was NOT saved: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
