// /api/diy/drafts — DIY save-and-resume drafts (migration 0023).
//
// EXTENDED Nov 28, 2026 (save-and-resume build) from the extras
// builder's first version. What changed, and why:
//   * AUTH: the first version took accountId from the query/body with
//     NO caller auth (its own NOTE flagged this). This version
//     resolves the caller from their Bearer <redacted> via
//     resolveDiyCaller() in src/lib/diy.ts — the same helper the
//     other /api/diy/* routes use. An account id in the body is
//     never trusted as proof of identity. No second auth helper was
//     built for this route.
//   * CASE-SCOPED: drafts are per account + case + form (migration
//     0023 unique constraint), not per account + form. A case id is
//     required to save, and the case must belong to the caller
//     (cases.client_id) unless admin/founder.
//   * RESUME POSITION: the draft stores currentSectionIndex /
//     currentQuestionIndex / currentFieldName — the exact question
//     the client left off. When the client reports no position, the
//     server recomputes it (first unanswered required question).
//   * STATUS is server-decided (diyCompletionStatus): 'completed'
//     only when every required non-sensitive question is answered —
//     never trusted from the client. 'transferred' is set only by
//     POST /api/diy/transfer.
//   * PROGRESS: every draft is returned with answered / total /
//     percent (summarizeDraft) so the flow can show a progress bar.
//
// GET  ?caseId=<uuid>&formCode=<code> — one draft (404 when none)
//      ?draftId=<uuid>                — one draft by id (must be yours)
//      ?caseId=<uuid>                 — all drafts for the case
//      (no query)                     — all drafts for the account
// POST { caseId, formCode, answers, currentSectionIndex,
//        currentQuestionIndex, currentFieldName }
//      Upserts the draft. Answers are sanitized first
//      (src/lib/diyDrafts.ts) AND the 0023 trigger rejects sensitive
//      keys at the database — a save containing an SSN / A-Number /
//      passport key fails, it is never stored.
// DELETE ?id=<draft uuid> — abandon (delete) a draft of yours.
//
// 501 when Supabase is not configured. Draft answers are never
// logged and never emailed. Saving a draft files nothing with USCIS.
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DIY_FORM_CODES, resolveDiyCaller } from "@/lib/diy";
import {
  diyDraftResumeUrl,
  sanitizeDraftAnswers,
  summarizeDraft,
  type DiyDraftAnswers,
} from "@/lib/diyDrafts";
import { diyCompletionStatus, resumePositionFor } from "@/lib/diyTransfer";
import { safeDbError } from "@/lib/apiErrors";
import { writeAuditLog } from "@/lib/auditLog";

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

function notConfigured() {
  return NextResponse.json(
    {
      error:
        "Drafts are not connected yet — Supabase is not configured, so no draft was saved or loaded. " +
        "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and run migration 0023 first. Nothing was saved.",
      code: "not_configured",
    },
    { status: 501 }
  );
}

interface DraftRow {
  id: string;
  account_id: string;
  case_id: string;
  form_code: string;
  answers: Record<string, string>;
  current_section_index: number;
  current_question_index: number;
  current_field_name: string | null;
  status: string;
  completed_at: string | null;
  transferred_at: string | null;
  created_at: string;
  updated_at: string;
}

function presentDraft(row: DraftRow) {
  const answers = (row.answers ?? {}) as DiyDraftAnswers;
  const completion = diyCompletionStatus(row.form_code, answers);
  const summary = summarizeDraft({
    formCode: row.form_code,
    answers,
    totalKnownFields: completion.totalCount > 0 ? completion.totalCount : null,
    lastSavedAt: row.updated_at,
  });
  return {
    id: row.id,
    accountId: row.account_id,
    caseId: row.case_id,
    formCode: row.form_code,
    answers,
    currentSectionIndex: row.current_section_index,
    currentQuestionIndex: row.current_question_index,
    currentFieldName: row.current_field_name,
    status: row.status,
    completedAt: row.completed_at,
    transferredAt: row.transferred_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSavedAt: row.updated_at,
    answeredCount: summary.answeredCount,
    totalKnownFields: summary.totalKnownFields,
    progressPercent: summary.progressPercent,
    missingFieldNames: completion.missing.map((f) => f.name),
    mustEnterOnForm: completion.mustEnterOnForm.map((f) => f.name),
    resumeUrl: diyDraftResumeUrl(row.id, row.form_code),
    savedMessage: `Saved — come back anytime. ${summary.answeredCount} of ${summary.totalKnownFields ?? "?"} required questions answered.`,
  };
}

async function assertCaseOwned(
  supabase: SupabaseClient,
  accountId: string,
  caseId: string
): Promise<{ ok: true } | { ok: false; status: 403 | 404; error: string }> {
  const { data: caseRow, error } = await supabase
    .from("cases")
    .select("id, client_id")
    .eq("id", caseId)
    .maybeSingle();
  if (error || !caseRow) {
    return { ok: false, status: 404, error: `No case was found for case id ${caseId}.` };
  }
  const row = caseRow as { id: string; client_id: string };
  if (row.client_id !== accountId) {
    return { ok: false, status: 403, error: "This case belongs to a different account." };
  }
  return { ok: true };
}

const DRAFT_COLUMNS =
  "id, account_id, case_id, form_code, answers, current_section_index, current_question_index, current_field_name, status, completed_at, transferred_at, created_at, updated_at";

export async function GET(req: Request) {
  const caller = await resolveDiyCaller(req);
  if (!caller.ok) {
    return NextResponse.json({ error: caller.error }, { status: caller.status });
  }
  const params = new URL(req.url).searchParams;
  const draftId = params.get("draftId") ?? params.get("id") ?? "";
  const caseId = params.get("caseId") ?? "";
  const formCode = params.get("formCode") ?? "";
  if (draftId && !UUID_RE.test(draftId)) {
    return NextResponse.json({ error: "draftId must be a valid UUID (diy_drafts.id)." }, { status: 400 });
  }
  if (caseId && !UUID_RE.test(caseId)) {
    return NextResponse.json({ error: "caseId must be a valid UUID (cases.id)." }, { status: 400 });
  }
  if (formCode && !DIY_FORM_CODES.includes(formCode)) {
    return NextResponse.json(
      { error: "formCode must be a DIY form code (e.g. I-130, I-485, N-400)." },
      { status: 400 }
    );
  }
  const supabase = getServiceClient();
  if (!supabase) return notConfigured();

  let query = supabase
    .from("diy_drafts")
    .select(DRAFT_COLUMNS)
    .eq("account_id", caller.accountId)
    .order("updated_at", { ascending: false });
  if (draftId) query = query.eq("id", draftId);
  if (caseId) query = query.eq("case_id", caseId);
  if (formCode) query = query.eq("form_code", formCode);
  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      {
        error: safeDbError(
          "Drafts could not be read. No drafts were returned.",
          "Migration 0023 may not have run yet.",
          error
        ),
      },
      { status: 502 }
    );
  }
  const rows = ((data ?? []) as DraftRow[]).map(presentDraft);
  if ((draftId || (caseId && formCode)) && rows.length === 0) {
    return NextResponse.json(
      { error: "No saved draft was found for this form yet. Answer a question and it saves automatically." },
      { status: 404 }
    );
  }
  return NextResponse.json({ drafts: rows });
}

export async function POST(req: Request) {
  const caller = await resolveDiyCaller(req);
  if (!caller.ok) {
    return NextResponse.json({ error: caller.error }, { status: caller.status });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
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
      { error: "formCode is required and must be a DIY form code (e.g. I-130, I-485, N-400)." },
      { status: 400 }
    );
  }
  const rawAnswers =
    body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
      ? (body.answers as Record<string, unknown>)
      : {};
  const stringAnswers: DiyDraftAnswers = {};
  for (const [key, value] of Object.entries(rawAnswers)) {
    if (typeof value === "string") stringAnswers[key] = value;
  }
  // Sanitize BEFORE saving: sensitive-identifier keys never reach the DB
  // (the 0023 trigger is the backstop).
  const sanitized = sanitizeDraftAnswers(stringAnswers);
  const answers = sanitized.answers;

  const supabase = getServiceClient();
  if (!supabase) return notConfigured();

  const owned = await assertCaseOwned(supabase, caller.accountId, caseId);
  if (!owned.ok) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  // Resume position: use the client's reported position when it names
  // a real field; otherwise recompute it from the answers (first
  // unanswered required question — the exact question left off).
  const reportedField =
    typeof body.currentFieldName === "string" && body.currentFieldName.trim()
      ? body.currentFieldName.trim()
      : null;
  const computed = resumePositionFor(formCode, answers);
  const sectionIndex =
    typeof body.currentSectionIndex === "number" && body.currentSectionIndex >= 0
      ? Math.floor(body.currentSectionIndex)
      : computed?.sectionIndex ?? 0;
  const questionIndex =
    typeof body.currentQuestionIndex === "number" && body.currentQuestionIndex >= 0
      ? Math.floor(body.currentQuestionIndex)
      : computed?.questionIndex ?? 0;
  const fieldName = reportedField ?? computed?.fieldName ?? null;

  // Status is decided here, never trusted from the client.
  const completion = diyCompletionStatus(formCode, answers);
  const status = completion.complete ? "completed" : "in_progress";

  const { data, error } = await supabase
    .from("diy_drafts")
    .upsert(
      {
        account_id: caller.accountId,
        case_id: caseId,
        form_code: formCode,
        answers,
        current_section_index: sectionIndex,
        current_question_index: questionIndex,
        current_field_name: fieldName,
        status,
        completed_at: completion.complete ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id,case_id,form_code" }
    )
    .select(DRAFT_COLUMNS)
    .single();
  if (error || !data) {
    return NextResponse.json(
      {
        error: safeDbError(
          "Draft could not be saved. Nothing was saved.",
          "Migration 0023 may not have run yet.",
          error ?? undefined
        ),
        strippedSensitiveKeys: sanitized.strippedKeys,
      },
      { status: 502 }
    );
  }
  const draft = presentDraft(data as DraftRow);
  // Audit: a draft save is a sensitive write on a case. Log form
  // code + server-decided status only — never the answers.
  await writeAuditLog(supabase, {
    actorId: caller.accountId,
    action: "diy_draft_saved",
    entityType: "diy_drafts",
    entityId: draft.id,
    caseId,
    detail: { form_code: formCode, status },
  });
  return NextResponse.json({
    ...draft,
    saved: true,
    strippedSensitiveKeys: sanitized.strippedKeys,
    sensitiveNote: sanitized.hadSensitiveKeys
      ? "Some answers were NOT saved: Social Security numbers, A-Numbers, passport numbers and green card numbers are never stored in a draft. Re-enter those on the official form itself."
      : "No sensitive identifiers were in the draft.",
  });
}

export async function DELETE(req: Request) {
  const caller = await resolveDiyCaller(req);
  if (!caller.ok) {
    return NextResponse.json({ error: caller.error }, { status: caller.status });
  }
  const params = new URL(req.url).searchParams;
  const id = params.get("id") ?? params.get("draftId") ?? "";
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "id query param is required and must be a valid UUID (diy_drafts.id)." },
      { status: 400 }
    );
  }
  const supabase = getServiceClient();
  if (!supabase) return notConfigured();
  const { error } = await supabase
    .from("diy_drafts")
    .delete()
    .eq("id", id)
    .eq("account_id", caller.accountId);
  if (error) {
    return NextResponse.json(
      { error: safeDbError("Draft could not be deleted.", undefined, error) },
      { status: 502 }
    );
  }
  // Audit: a draft delete is a destructive write. Log ids only.
  await writeAuditLog(supabase, {
    actorId: caller.accountId,
    action: "diy_draft_deleted",
    entityType: "diy_drafts",
    entityId: id,
    detail: { status: "deleted" },
  });
  return NextResponse.json({ deleted: true, id });
}
