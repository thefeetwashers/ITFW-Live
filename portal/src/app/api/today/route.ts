// GET /api/today — Daily home screen data (Nov 28, 2026, completeness sweep).
//
// Assembles the "Today" payload from REAL STORED ROWS ONLY — no invented
// status, news, or dates. Auth reuses resolveDiyCaller() (src/lib/diy.ts):
// the caller is resolved from their Bearer <redacted> the same helper the
// other /api/diy/* routes use. An account id in the query is never
// trusted. 401 when not signed in, 501 when Supabase is not configured
// (fail closed — nothing is unlocked, nothing is shown as real).
//
// Reads (existing tables only — migrations 0001–0024; daily_checkins is
// migration 0026 and is read defensively, so the route still works
// before 0026 is run):
//   * cases (client_id = caller) — status at a glance
//   * case_lifecycle (0010) — per-case timeline + today's stage changes
//   * case_watch (0001) — manually recorded agency status, labelled as such
//   * case_renewals (0014/0017) — renewal reminders from real dates
//   * rfe_uploads (0002) — open RFE deadlines (real deadline dates only)
//   * documents (0001) — saved things + retake reminders
//   * diy_drafts (0023) — saved things (progress via summarizeDraft)
//   * questionnaire_responses (0005) — saved things (counts per form)
//   * messages (0001) — unread count + today's messages for the feed
//   * notification_logs (0010) — today's notifications for the feed
//   * inbox_items (0001) — today's document requests for the feed
//   * daily_checkins (0026) — streak, defensive read
//
// Pay gates (REUSED, never rebuilt):
//   * Interview question of the day: getPaidAccessForAccount(...,
//     "interview_prep") — the same server check as /api/interview-prep.
//     Unpaid callers get the question locked (with its unlock label),
//     never the question banks.
//   * Draft download/print: getDiyUnlockForCase() per draft (lib/diy.ts).
//   * Document download: getPaidAccessForAccount(..., "document_vault").
// News is the built-in sourced posts (lib/dailyNews.ts) — no live feed.
//
// No DOB / A-Number / SSN / passport number is read, logged, or returned
// anywhere in this route. Receipt / case numbers are never returned — the
// client sees masked identifiers only if a future step adds them.
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getDiyUnlockForCase, resolveDiyCaller } from "@/lib/diy";
import { summarizeDraft as summarizeDraftAnswers } from "@/lib/diyDrafts";
import { getPaidAccessForAccount } from "@/lib/paywall";
import {
  buildCaseTimeline,
  buildDailyReminders,
  buildSavedThings,
  caseAtAGlance,
  computeStreak,
  emptyDailyHomePayload,
  questionOfTheDay,
  todaysNewsForForms,
  whatChangedToday,
  type ChangeEventInput,
  type DailyHomePayload,
  type DraftRow,
  type LifecycleRow,
  type RenewalRow,
} from "@/lib/dailyHome";
import { DAILY_NEWS, LIVE_FEED_NOTICE, newsForForms } from "@/lib/dailyNews";

export const runtime = "nodejs";

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type Row = Record<string, unknown>;
const asRows = (data: unknown): Row[] =>
  Array.isArray(data) ? (data as Row[]) : [];
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String).filter(Boolean) : [];

export async function GET(req: Request) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const caller = await resolveDiyCaller(req);
  if (!caller.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: caller.error,
        payload: emptyDailyHomePayload(todayIso),
      },
      { status: caller.status }
    );
  }
  const accountId = caller.accountId;
  const admin = serviceClient();
  if (!admin) return bad("Supabase is not configured.", 501);

  // ---- Cases (own only) ----
  const { data: caseData } = await admin
    .from("cases")
    .select("id, status, forms, pathfinder_route, created_at, updated_at")
    .eq("client_id", accountId)
    .order("created_at", { ascending: false });
  const cases = asRows(caseData);
  const caseIds = cases.map((c) => str(c.id)).filter(Boolean);

  if (caseIds.length === 0) {
    const payload = emptyDailyHomePayload(todayIso);
    payload.configured = true;
    payload.news = DAILY_NEWS;
    return NextResponse.json({ ok: true, payload });
  }

  // ---- Lifecycle, renewals, watch, RFEs, documents, drafts, questionnaire ----
  const [{ data: lifecycleData }, { data: renewalData }, { data: watchData }, { data: rfeData }, { data: docData }, { data: draftData }, { data: qData }] =
    await Promise.all([
      admin
        .from("case_lifecycle")
        .select("case_id, stage, sub_stage, is_current, stage_changed_at")
        .in("case_id", caseIds)
        .order("stage_changed_at", { ascending: false }),
      admin
        .from("case_renewals")
        .select("id, case_id, renewal_type, eligibility_or_expiry_date, status")
        .in("case_id", caseIds),
      admin
        .from("case_watch")
        .select("case_id, uscis_status, uscis_status_at")
        .in("case_id", caseIds)
        .order("uscis_status_at", { ascending: false }),
      admin
        .from("rfe_uploads")
        .select("case_id, deadline, status")
        .in("case_id", caseIds)
        .not("deadline", "is", null),
      admin
        .from("documents")
        .select("id, case_id, file_name, vault_category, review_status, retake_note, created_at")
        .in("case_id", caseIds)
        .order("created_at", { ascending: false }),
      admin
        .from("diy_drafts")
        .select("id, case_id, form_code, status, answers, updated_at")
        .eq("account_id", accountId)
        .in("case_id", caseIds)
        .order("updated_at", { ascending: false }),
      admin
        .from("questionnaire_responses")
        .select("case_id, form_code, updated_at")
        .eq("client_id", accountId)
        .in("case_id", caseIds),
    ]);

  const lifecycleRows: LifecycleRow[] = asRows(lifecycleData).map((r) => ({
    caseId: str(r.case_id),
    stage: Number(r.stage ?? 0),
    subStage: (r.sub_stage as "5A" | "5B" | null) ?? null,
    isCurrent: r.is_current === true,
    stageChangedAt: str(r.stage_changed_at),
  }));
  const renewals: RenewalRow[] = asRows(renewalData).map((r) => ({
    id: str(r.id),
    caseId: str(r.case_id),
    type: str(r.renewal_type) as RenewalRow["type"],
    eligibilityOrExpiryDate: str(r.eligibility_or_expiry_date),
    status: (str(r.status) || "upcoming") as RenewalRow["status"],
  }));
  const docs = asRows(docData);
  const draftsRaw = asRows(draftData);

  // ---- Messages: unread count + today's messages (feed) ----
  const { count: unreadCount } = await admin
    .from("messages")
    .select("id", { count: "exact" })
    .in("case_id", caseIds)
    .eq("recipient_id", accountId)
    .eq("is_read", false);
  const { data: todayMsgData } = await admin
    .from("messages")
    .select("id, case_id, sender_role, created_at")
    .in("case_id", caseIds)
    .eq("recipient_id", accountId)
    .gte("created_at", `${todayIso}T00:00:00Z`)
    .lt("created_at", `${todayIso}T23:59:59Z`);

  // ---- Notification logs + inbox items created today (feed) ----
  const [{ data: logData }, { data: inboxData }] = await Promise.all([
    admin
      .from("notification_logs")
      .select("id, case_id, channel, stage_key, created_at")
      .in("case_id", caseIds)
      .gte("created_at", `${todayIso}T00:00:00Z`),
    admin
      .from("inbox_items")
      .select("id, case_id, type, created_at")
      .in("case_id", caseIds)
      .eq("type", "missing_document")
      .gte("created_at", `${todayIso}T00:00:00Z`),
  ]);

  // ---- Daily check-ins (migration 0026; defensive — table may not exist yet) ----
  let checkinDates: string[] = [];
  try {
    const { data: checkinData } = await admin
      .from("daily_checkins")
      .select("checked_date")
      .eq("account_id", accountId)
      .gte("checked_date", new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10));
    checkinDates = asRows(checkinData).map((r) => str(r.checked_date));
  } catch {
    checkinDates = [];
  }

  // ---- Build the feed from stored events only ----
  const events: ChangeEventInput[] = [];
  for (const r of lifecycleRows) {
    if (r.stageChangedAt.slice(0, 10) === todayIso) {
      events.push({
        id: `lc-${r.caseId}-${r.stage}`,
        kind: "lifecycle",
        caseId: r.caseId,
        at: r.stageChangedAt,
        label: `Your case moved to Stage ${r.stage}${r.subStage ? ` (${r.subStage})` : ""}.`,
        detail: "Recorded by your provider. Open the timeline below to see where your case stands.",
      });
    }
  }
  for (const r of asRows(watchData)) {
    if (str(r.uscis_status_at).slice(0, 10) === todayIso && str(r.uscis_status)) {
      events.push({
        id: `watch-${r.case_id}`,
        kind: "status",
        caseId: str(r.case_id),
        at: str(r.uscis_status_at),
        label: "Your provider recorded a new agency status for your case.",
        detail: `Recorded status: ${str(r.uscis_status)}. This was entered by your provider from a USCIS or NVC letter — it is not a live lookup.`,
      });
    }
  }
  for (const r of asRows(todayMsgData)) {
    events.push({
      id: `msg-${r.id}`,
      kind: "message",
      caseId: str(r.case_id),
      at: str(r.created_at),
      label: `New message from your ${str(r.sender_role) || "provider"}.`,
      detail: "Open your case messages to read it. Message contents are never copied into this feed.",
    });
  }
  for (const r of asRows(logData)) {
    events.push({
      id: `log-${r.id}`,
      kind: "notification",
      caseId: str(r.case_id),
      at: str(r.created_at),
      label: `Notification sent (${str(r.channel)}) — ${str(r.stage_key)}.`,
      detail: "A notification about your case was recorded today. The notification itself contains no sensitive numbers.",
    });
  }
  for (const r of asRows(inboxData)) {
    events.push({
      id: `inbox-${r.id}`,
      kind: "document_request",
      caseId: str(r.case_id),
      at: str(r.created_at),
      label: "A document was requested for your case.",
      detail: "Check your document checklist — a missing document was added today.",
    });
  }
  const whatChanged = whatChangedToday(events, todayIso);

  // ---- Per-case glance + timeline ----
  const allForms = Array.from(new Set(cases.flatMap((c) => strArr(c.forms))));
  const glance = cases.map((c) => {
    const caseLifecycle = lifecycleRows.filter((r) => r.caseId === str(c.id));
    const blocking = docs
      .filter(
        (d) =>
          str(d.case_id) === str(c.id) &&
          (str(d.review_status) === "retake_requested" || str(d.review_status) === "uploaded")
      )
      .map((d) => str(d.file_name));
    const watch = asRows(watchData).find((w) => str(w.case_id) === str(c.id));
    return caseAtAGlance(
      {
        id: str(c.id),
        status: str(c.status),
        forms: strArr(c.forms),
        pathfinderRoute: c.pathfinder_route,
        createdAt: str(c.created_at),
        updatedAt: str(c.updated_at),
      },
      caseLifecycle,
      blocking,
      "en",
      watch && str(watch.uscis_status)
        ? { status: str(watch.uscis_status), at: str(watch.uscis_status_at) }
        : null
    );
  });
  const timelines = cases.map((c) =>
    buildCaseTimeline(str(c.id), lifecycleRows)
  );

  // ---- Reminders ----
  const rfeDeadlines = asRows(rfeData)
    .filter((r) => !["submitted", "closed", "done"].includes(str(r.status)))
    .map((r) => ({
      caseId: str(r.case_id),
      formLabel: "RFE",
      deadline: str(r.deadline),
    }));
  const retakes = docs
    .filter((d) => str(d.review_status) === "retake_requested")
    .map((d) => ({
      id: str(d.id),
      caseId: str(d.case_id),
      fileName: str(d.file_name),
      vaultCategory: str(d.vault_category),
      reviewStatus: str(d.review_status),
      retakeNote: (d.retake_note as string | null) ?? null,
      createdAt: str(d.created_at),
    }));
  const reminders = buildDailyReminders({
    renewals,
    rfeDeadlines,
    retakeDocuments: retakes,
    todayIso,
  });

  // ---- Saved things (pay-gated downloads reuse existing gates) ----
  const vaultAccess = await getPaidAccessForAccount(accountId, "document_vault");
  const vaultLocked = !vaultAccess.allowed;
  const draftRows: (DraftRow & { downloadLocked: boolean })[] = [];
  for (const d of draftsRaw) {
    const answers = (d.answers ?? {}) as Record<string, string>;
    const summary = summarizeDraftAnswers({
      formCode: str(d.form_code),
      answers,
      totalKnownFields: null,
      lastSavedAt: str(d.updated_at),
    });
    const unlock = await getDiyUnlockForCase(
      accountId,
      str(d.case_id),
      str(d.form_code)
    );
    draftRows.push({
      id: str(d.id),
      caseId: str(d.case_id),
      formCode: str(d.form_code),
      status: (str(d.status) || "in_progress") as DraftRow["status"],
      answeredCount: summary.answeredCount,
      progressPercent: summary.progressPercent,
      updatedAt: str(d.updated_at),
      downloadLocked: !unlock.unlocked,
    });
  }
  const qCountsMap = new Map<string, { caseId: string; formCode: string; answeredCount: number; updatedAt: string }>();
  for (const q of asRows(qData)) {
    const key = `${str(q.case_id)}|${str(q.form_code)}`;
    const prev = qCountsMap.get(key);
    qCountsMap.set(key, {
      caseId: str(q.case_id),
      formCode: str(q.form_code),
      answeredCount: (prev?.answeredCount ?? 0) + 1,
      updatedAt: str(q.updated_at) > (prev?.updatedAt ?? "") ? str(q.updated_at) : (prev?.updatedAt ?? ""),
    });
  }
  const savedThings = buildSavedThings({
    drafts: draftRows as (DraftRow & { downloadLocked: boolean })[],
    documents: docs.map((d) => ({
      id: str(d.id),
      caseId: str(d.case_id),
      fileName: str(d.file_name),
      vaultCategory: str(d.vault_category),
      reviewStatus: str(d.review_status),
      retakeNote: (d.retake_note as string | null) ?? null,
      createdAt: str(d.created_at),
      downloadLocked: vaultLocked,
    })),
    questionnaireCounts: Array.from(qCountsMap.values()),
  });

  // ---- Question of the day (existing paywall — interview_prep) ----
  const interviewAccess = await getPaidAccessForAccount(accountId, "interview_prep");
  const qotd = interviewAccess.allowed ? questionOfTheDay(todayIso) : null;

  // ---- News (built-in sourced posts; today's items join the feed) ----
  const news = newsForForms(DAILY_NEWS, allForms);
  for (const post of todaysNewsForForms(allForms, todayIso)) {
    whatChanged.events.push({
      id: `news-${post.id}`,
      kind: "news",
      caseId: null,
      at: `${post.publishedDate}T09:00:00Z`,
      label: `New immigration post: ${post.title}`,
      detail: `Source: ${post.sourceLabel}. Built-in post — no live feed is connected yet.`,
    });
  }
  whatChanged.events.sort((a, b) => (a.at < b.at ? 1 : -1));

  const payload: DailyHomePayload = {
    todayIso,
    configured: true,
    cases: glance,
    timelines,
    reminders,
    news,
    newsNote: LIVE_FEED_NOTICE,
    questionOfTheDay: qotd,
    questionLocked: !interviewAccess.allowed,
    questionLockNote: interviewAccess.allowed
      ? null
      : `${interviewAccess.reason} Unlock: ${interviewAccess.unlockLabel}.`,
    whatChanged,
    savedThings,
    unreadMessages: unreadCount ?? 0,
    checkin: computeStreak(checkinDates, todayIso),
    emptyStates: {
      noCases: false,
      noReminders: reminders.length === 0,
      noChanges: whatChanged.events.length === 0,
      noSavedThings: savedThings.items.length === 0,
    },
  };
  return NextResponse.json({ ok: true, payload });
}
