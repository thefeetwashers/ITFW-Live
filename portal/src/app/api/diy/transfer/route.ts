// POST /api/diy/transfer — automatic answer transfer on completion.
//
// Founder's addition (Nov 28, 2026): once the client has answered
// ALL the questions, the system AUTOMATICALLY transfers their answers
// into the immigration form and lets them print, save, and more.
//
// What this route does, in order — and what it refuses to do:
//   1. Resolves the caller from their Bearer <redacted> (never from
//      an account id in the body) and loads THEIR draft for this
//      case + form from public.diy_drafts (migration 0023).
//      No draft → 404. A draft belonging to someone else → 404
//      (never confirm or deny another account's draft).
//   2. COMPLETION GATE: transferAnswersToForm() (src/lib/
//      diyTransfer.ts). A half-finished form → 409 with the missing
//      required questions. NOTHING is transferred and NO packet is
//      generated — a half-finished form never reaches the packet
//      route. (Sensitive required fields never block: they are listed
//      as mustEnterOnForm — re-enter on the official form itself.)
//   3. DIY PAY GATE (src/lib/diy.ts, the existing gate — NOT a second
//      one): unpaid → 402 DIY_NOT_PAID, before anything is written
//      or generated. Print / save / email stay locked until the DIY
//      $25/form or $99 bundle payment is confirmed in the database.
//   4. THE TRANSFER ITSELF: the draft's sanitized answers are
//      written into public.questionnaire_responses (migration 0005)
//      — one row per question key, original + mapped English —
//      because POST /api/generate-packet reads its answers from
//      THAT table, not from the request body. This write-through is
//      the transfer: draft → questionnaire_responses → the existing
//      USCIS field mappings → the PDF. Sensitive keys cannot leak
//      here: the draft never held them (0023 trigger).
//      The draft is then marked status='transferred'.
//   5. "AND MORE": the response carries the transfer bundle —
//      mapped fields (existing mappings, all UNVERIFIED), unmapped
//      answers, the document checklist, the draft cover letter and
//      the submission-order guide (all three reused from
//      src/lib/diySubmission.ts) plus the fee breakdown.
//   6. PACKET: the EXISTING /api/generate-packet route is called
//      (same handler the intake engine uses). Its own gates still
//      apply and are reported honestly, never rewritten into a
//      success: audit not 100% → 409, balance due / no service
//      order → 402 (a DIY-only payment does NOT create a service
//      order — see portal/docs/diy-flow.md §"Known gaps"), missing
//      USCIS template → 404. A transfer that succeeds does NOT mean
//      a packet was generated: the response reports the packet
//      attempt separately ({ generated, status, error }).
//
// Nothing here files anything with USCIS. The packet stays DRAFT
// (watermark + cover sheet) until 100% audit + balance paid, and
// only review_status='accepted' documents are included — all
// enforced by /api/generate-packet, not re-decided here.
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DIY_FORM_CODES,
  getDiyUnlockForCase,
  resolveDiyCaller,
} from "@/lib/diy";
import { GOV_PAYMENT_OPTIONS } from "@/components/DynamicFormIntakeEngine";
import { POST as generatePacketPost } from "../../generate-packet/route";
import {
  buildDiyTransferBundle,
  transferAnswersToForm,
} from "@/lib/diyTransfer";
import { getRegistrySchema } from "@/lib/dynamicIntakeSchemas";
import type { DiyDraftAnswers } from "@/lib/diyDrafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const caseId = typeof body.caseId === "string" ? body.caseId : "";
  const formCode = typeof body.formCode === "string" ? body.formCode : "";
  if (!caseId || !UUID_RE.test(caseId)) {
    return NextResponse.json(
      { error: "caseId is required and must be a valid UUID (cases.id)." },
      { status: 400 }
    );
  }
  if (!formCode || !DIY_FORM_CODES.includes(formCode)) {
    return NextResponse.json(
      { error: `Unknown formCode "${formCode}". Use one of: ${DIY_FORM_CODES.join(", ")}.` },
      { status: 400 }
    );
  }
  const govPaymentAuthorization =
    typeof body.govPaymentAuthorization === "string" ? body.govPaymentAuthorization : "";
  if (
    govPaymentAuthorization &&
    !GOV_PAYMENT_OPTIONS.some((o) => o.id === govPaymentAuthorization)
  ) {
    return NextResponse.json(
      {
        error: `Unknown govPaymentAuthorization "${govPaymentAuthorization}". Use one of: ${GOV_PAYMENT_OPTIONS.map((o) => o.id).join(", ")}.`,
      },
      { status: 400 }
    );
  }

  const caller = await resolveDiyCaller(req);
  if (!caller.ok) {
    return NextResponse.json({ error: caller.error }, { status: caller.status });
  }
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Transfer records are not connected yet (Supabase is not configured), so nothing was transferred and no packet was generated.",
        code: "not_configured",
      },
      { status: 501 }
    );
  }

  // 1. Load the caller's draft.
  const { data: draftRow, error: draftError } = await supabase
    .from("diy_drafts")
    .select("id, account_id, case_id, form_code, answers, status")
    .eq("account_id", caller.accountId)
    .eq("case_id", caseId)
    .eq("form_code", formCode)
    .maybeSingle();
  if (draftError || !draftRow) {
    return NextResponse.json(
      {
        error:
          "No saved draft was found for this form yet. Answer the questions first — answers save automatically as you go, and the transfer runs once every required question is answered.",
        code: "no_draft",
      },
      { status: 404 }
    );
  }
  const draft = draftRow as {
    id: string;
    account_id: string;
    case_id: string;
    form_code: string;
    answers: Record<string, string>;
    status: string;
  };
  const answers = (draft.answers ?? {}) as DiyDraftAnswers;

  // 2. Completion gate — a half-finished form transfers nothing
  //    and generates no packet.
  const transfer = transferAnswersToForm(formCode, answers);
  if (!transfer.complete) {
    return NextResponse.json(
      {
        error: `This form is not finished yet — ${transfer.missing.length} required question(s) are still unanswered. Answer them and the transfer runs automatically. Nothing was transferred and no packet was generated.`,
        code: "incomplete",
        complete: false,
        missing: transfer.missing.map((f) => ({ name: f.name, label: f.label })),
        mustEnterOnForm: transfer.mustEnterOnForm.map((f) => ({ name: f.name, label: f.label })),
        timelineFields: transfer.timelineFields.map((f) => ({ name: f.name, label: f.label })),
        answeredCount: transfer.mappedFields.filter((f) => f.answered).length,
      },
      { status: 409 }
    );
  }

  // 3. DIY pay gate — the existing gate, reused (never rebuilt).
  const unlock = await getDiyUnlockForCase(caller.accountId, caseId, formCode);
  if (!unlock.configured) {
    return NextResponse.json(
      { error: unlock.reason, code: "diy_not_configured", complete: true },
      { status: 501 }
    );
  }
  if (!unlock.unlocked) {
    return NextResponse.json(
      {
        error:
          "Your answers are complete, but print, save and email stay locked until your DIY payment is confirmed in our records. " +
          unlock.reason,
        code: "diy_not_paid",
        complete: true,
        formCode,
      },
      { status: 402 }
    );
  }

  // 4. The transfer: write the draft answers into
  //    questionnaire_responses (the table /api/generate-packet reads).
  //    Same delete-then-insert per key as the intake engine's
  //    saveAnswers — questionnaire_responses has no unique key on
  //    (case_id, question_key), so a plain upsert cannot dedupe.
  const schema = getRegistrySchema(formCode);
  const fieldByKey = new Map<string, { formCode: string; label: string }>();
  if (schema) {
    for (const section of schema.sections) {
      for (const field of section.fields) {
        if (field.type !== "note") {
          fieldByKey.set(field.name, { formCode: schema.formCode, label: field.label });
        }
      }
    }
  }
  const answeredKeys = Object.keys(answers).filter((k) => (answers[k] ?? "").trim() !== "");
  let transferredCount = 0;
  const transferErrors: string[] = [];
  for (const key of answeredKeys) {
    const meta = fieldByKey.get(key);
    if (!meta) continue; // No schema field for this key — it stays in
    // the bundle's unmappedAnswers list, never silently dropped.
    const value = answers[key];
    const { error: deleteError } = await supabase
      .from("questionnaire_responses")
      .delete()
      .eq("case_id", caseId)
      .eq("question_key", key);
    if (deleteError) {
      transferErrors.push(`${key}: ${deleteError.message}`);
      continue;
    }
    const { error: insertError } = await supabase
      .from("questionnaire_responses")
      .insert({
        case_id: caseId,
        client_id: caller.accountId,
        question_key: key,
        original_language: "en",
        original_value: value,
        mapped_english_value: value,
        form_code: meta.formCode,
        field_name: meta.label,
      });
    if (insertError) transferErrors.push(`${key}: ${insertError.message}`);
    else transferredCount += 1;
  }
  if (transferErrors.length > 0 && transferredCount === 0) {
    return NextResponse.json(
      {
        error: `Your answers could not be transferred into the form (${transferErrors[0]}). Nothing was generated. Try again.`,
        code: "transfer_failed",
        complete: true,
      },
      { status: 502 }
    );
  }

  // Mark the draft transferred (the transfer happened even if the
  // packet step below is blocked by its own gates).
  await supabase
    .from("diy_drafts")
    .update({ status: "transferred", transferred_at: new Date().toISOString() })
    .eq("id", draft.id);

  // 5. "And more" bundle (checklist + draft cover letter +
  //    submission-order guide + fee breakdown).
  const bundle = buildDiyTransferBundle(formCode, answers);

  // 6. Packet via the EXISTING route — its gates pass through
  //    honestly, never rewritten into a success.
  const mappedAnswers: Record<string, string> = {};
  for (const f of transfer.mappedFields) {
    if (f.answered) mappedAnswers[f.questionKey] = f.value;
  }
  const packetReq = new Request("http://localhost/api/generate-packet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseId,
      formCodes: [formCode],
      answers: mappedAnswers,
      gov_payment_authorization: govPaymentAuthorization || undefined,
      actorId: caller.accountId,
      actorRole: "client",
    }),
  });
  const packetRes = await generatePacketPost(packetReq);
  let packetBody: Record<string, unknown> = {};
  try {
    packetBody = (await packetRes.json()) as Record<string, unknown>;
  } catch {
    packetBody = {};
  }
  const packetGenerated =
    packetRes.ok &&
    typeof (packetBody.signedUrl ?? packetBody.downloadUrl) === "string";

  return NextResponse.json({
    transferred: true,
    complete: true,
    formCode,
    transferredCount,
    transferErrors: transferErrors.length > 0 ? transferErrors : undefined,
    transfer,
    bundle,
    packet: {
      generated: packetGenerated,
      status: packetRes.status,
      signedUrl: packetGenerated
        ? ((packetBody.signedUrl ?? packetBody.downloadUrl) as string)
        : undefined,
      downloadUrl: packetGenerated
        ? ((packetBody.signedUrl ?? packetBody.downloadUrl) as string)
        : undefined,
      pageCount: packetBody.pageCount,
      auditScore: packetBody.auditScore,
      error: packetGenerated ? undefined : (packetBody.error as string | undefined),
      code: packetBody.code,
      detail: packetBody.detail,
      note: packetGenerated
        ? "DRAFT packet — review and sign before you submit. This does not file your case."
        : "Your answers were transferred into the form, but the packet itself could not be generated yet — see the error above (usually the packet audit is not 100% or the balance is not paid). Fix that and request the packet again; your answers are already transferred and do not need re-typing.",
    },
  });
}
