// Daily home screen — pure logic (Nov 28, 2026, completeness sweep).
//
// The "Today" screen is where a client lands every day: case status at a
// glance, today's next step, today's news, the interview question of the
// day, reminders, the per-case timeline, everything they saved, and what
// changed today. Everything here runs on REAL STORED DATA ONLY:
//   * cases + case_lifecycle + case_renewals + documents + messages +
//     notification_logs + diy_drafts + questionnaire_responses (Supabase)
//   * the existing next-step engine (src/lib/nextStepEngine.ts)
//   * the existing interview question banks (src/lib/interviewPrep.ts)
//   * the built-in sourced news posts (src/lib/dailyNews.ts)
//
// This file is PURE — no Supabase, no Stripe, no sending. The API route
// /api/today reads the rows and hands them to these builders; the page
// renders the result. Nothing is ever invented here:
//   * No case -> honest empty states, never a made-up status.
//   * No lifecycle row for a stage -> "No record yet", never a date.
//   * No event today -> "Nothing new today", never an invented change.
//   * No live USCIS status: the status shown is the status stored in
//     the case row (entered by the provider, or the client) — it is
//     labelled "as recorded in your file", never "live from USCIS".
//   * No promised dates: the timeline shows when a stage was recorded
//     and what is next; it never promises when a stage will happen.
//   * Identifiers are masked (see maskIdentifier). DOB, A-Number, SSN
//     and passport numbers never appear in this file's outputs.
import { deriveNextStep, parsePathfinderRoute, type NextStep } from "./nextStepEngine";
import { LIFECYCLE_STAGES, stageDef, type LifecycleStageId } from "./lifecycle";
import {
  allInterviewQuestions,
  INTERVIEW_BANKS,
  type InterviewQuestion,
} from "./interviewPrep";
import { DAILY_NEWS, newsForForms, newsPublishedOn, type DailyNewsPost } from "./dailyNews";
import { deriveRenewals, RENEWAL_TYPE_LABEL, type RenewalDerived, type RenewalInput } from "./renewals";

export { DAILY_NEWS, newsForForms, newsPublishedOn };
export type { DailyNewsPost };

// ---------------------------------------------------------------------------
// Shared row shapes (what /api/today reads from Supabase)
// ---------------------------------------------------------------------------

export interface DailyCaseRow {
  id: string;
  /** Stored case status (cases.status, migration 0001) — as recorded. */
  status: string;
  forms: string[];
  pathfinderRoute: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface LifecycleRow {
  caseId: string;
  /** Stage 1–6 (migration 0010). */
  stage: number;
  subStage: "5A" | "5B" | null;
  isCurrent: boolean;
  stageChangedAt: string;
}

export interface RenewalRow extends RenewalInput {}

export interface DocumentRow {
  id: string;
  caseId: string;
  fileName: string;
  vaultCategory: string;
  reviewStatus: string;
  retakeNote: string | null;
  createdAt: string;
}

export interface DraftRow {
  id: string;
  caseId: string;
  formCode: string;
  status: "in_progress" | "completed" | "transferred";
  answeredCount: number;
  progressPercent: number | null;
  updatedAt: string;
}

export interface ChangeEventInput {
  id: string;
  kind: "status" | "message" | "notification" | "lifecycle" | "document_request" | "news";
  caseId: string | null;
  /** ISO timestamp of the stored event. */
  at: string;
  label: string;
  detail?: string;
}

// ---------------------------------------------------------------------------
// Masking — identifiers are never shown in full on the home screen.
// ---------------------------------------------------------------------------

/** Show only the last 3 characters of an identifier (receipt number,
 *  case number, NVC number). Empty / short values show as masked. */
export function maskIdentifier(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (v.length === 0) return "—";
  if (v.length <= 3) return "•••";
  return `••••••${v.slice(-3)}`;
}

// ---------------------------------------------------------------------------
// 1. Case status at a glance
// ---------------------------------------------------------------------------

export interface CaseAtAGlance {
  caseId: string;
  forms: string[];
  /** Stored status, as recorded in the file — never "live from USCIS". */
  statusLabel: string;
  statusNote: string;
  stageLabel: string | null;
  /** Latest agency status as MANUALLY RECORDED in case_watch (migration
   *  0001) — entered by the provider from a USCIS/NVC letter, never a
   *  live lookup. Null when nothing was ever recorded. */
  recordedAgencyStatus: string | null;
  recordedAgencyStatusAt: string | null;
  /** Next step for THIS case, from the existing engine. Null when the
   *  route was never set — the engine says so itself. */
  nextStep: NextStep;
}

const CASE_STATUS_LABELS: Record<string, string> = {
  intake: "Intake — we have your inquiry",
  documents_pending: "Documents pending — we are waiting for your documents",
  in_preparation: "In preparation — your forms are being drafted",
  ready_to_sign: "Ready to sign — review your finished packet",
  filed: "Filed — your packet was filed with USCIS",
  uscis_pending: "At USCIS — USCIS has your case",
  rfe: "RFE — USCIS asked for more evidence",
  interview: "Interview — an interview is scheduled or happened",
  approved: "Approved",
  denied: "Denied — talk to your provider or an attorney",
  closed: "Closed",
};

/** One case, at a glance. The next step comes from deriveNextStep with
 *  the case's real route and its real blocking items (passed in by the
 *  API route from the documents table). No blocking items known means
 *  the engine falls through to its waiting/sign branch — it never
 *  invents a blocking item. */
export function caseAtAGlance(
  row: DailyCaseRow,
  lifecycleRows: LifecycleRow[],
  blockingLabels: string[],
  language: "en" | "es" | "ht" | "fr" | "pt" = "en",
  agencyStatus?: { status: string; at: string } | null
): CaseAtAGlance {
  const route = parsePathfinderRoute(row.pathfinderRoute);
  const current = lifecycleRows.find((r) => r.caseId === row.id && r.isCurrent);
  const stageLabel = current
    ? `Stage ${current.stage}${current.subStage ? ` (${current.subStage})` : ""} — ${stageDef(stageIdForNumber(current.stage)).shortLabel}`
    : null;
  const uscisStage: "rfe" | "review" | null =
    row.status === "rfe"
      ? "rfe"
      : row.status === "filed" || row.status === "uscis_pending" || row.status === "interview"
        ? "review"
        : null;
  const nextStep = deriveNextStep({
    route,
    uscisStage,
    blockingItems: blockingLabels.map((label) => ({
      id: label,
      label,
      status: "missing" as const,
      blocking: true,
    })),
    language,
  });
  return {
    caseId: row.id,
    forms: row.forms,
    statusLabel: CASE_STATUS_LABELS[row.status] ?? row.status,
    statusNote:
      "As recorded in your file. This is not a live check with USCIS — your provider updates it when USCIS or NVC writes to you.",
    stageLabel,
    recordedAgencyStatus: agencyStatus?.status ?? null,
    recordedAgencyStatusAt: agencyStatus?.at ?? null,
    nextStep,
  };
}

export function stageIdForNumber(n: number): LifecycleStageId {
  const ids: LifecycleStageId[] = [
    "new_lead",
    "consultation_quote",
    "payment_arrangement",
    "active_client",
    "submitted_uscis",
    "visa_approved_closed",
  ];
  return ids[Math.min(Math.max(n, 1), 6) - 1];
}

// ---------------------------------------------------------------------------
// 2. Interview question of the day — deterministic by date, from the
//    existing banks, never invented, always labelled with its source.
//    Civics (official USCIS questions) on 6 days out of 7; a practice
//    question on the 7th day, labelled practice.
// ---------------------------------------------------------------------------

export interface QuestionOfTheDay {
  question: InterviewQuestion;
  /** "Official USCIS civics question" or "Practice question". */
  kindLabel: string;
  dateIso: string;
  /** Day-of-year position, so the client can see it rotates. */
  dayIndex: number;
}

function dayIndexFor(dateIso: string): number {
  const ms = Date.parse(`${dateIso}T12:00:00Z`);
  return Math.floor(ms / 86_400_000);
}

export function questionOfTheDay(dateIso: string): QuestionOfTheDay {
  const dayIndex = dayIndexFor(dateIso);
  const civics = INTERVIEW_BANKS.find((b) => b.id === "n400-civics")!.questions;
  const practice = allInterviewQuestions().filter((q) => q.kind === "practice");
  const isCivicsDay = dayIndex % 7 !== 6;
  const question = isCivicsDay
    ? civics[dayIndex % civics.length]
    : practice[dayIndex % practice.length];
  return {
    question,
    kindLabel:
      question.kind === "official_civics"
        ? "Official USCIS civics question — one of the official 100 (sample of 25 in this app; study all 100 on uscis.gov)"
        : "Practice question — written by the platform from the topics USCIS lists. NOT an official USCIS question.",
    dateIso,
    dayIndex,
  };
}

// ---------------------------------------------------------------------------
// 3. Per-case timeline — from case_lifecycle rows only.
// ---------------------------------------------------------------------------

export interface TimelineEntry {
  stageNumber: number;
  stageId: LifecycleStageId;
  title: string;
  state: "done" | "current" | "upcoming" | "not_recorded";
  /** Real recorded date (stage_changed_at) or null — never invented. */
  recordedAt: string | null;
  subStage: "5A" | "5B" | null;
  /** Plain-English "where" for this stage, from the lifecycle lib. */
  where: string;
}

export interface CaseTimeline {
  caseId: string;
  entries: TimelineEntry[];
  /** What is next, in plain English — from the lifecycle lib for the
   *  stage after the current one, or null when the case is closed or
   *  no stage was ever recorded. Never a promised date. */
  whatIsNext: string | null;
  currentStageNumber: number | null;
}

export function buildCaseTimeline(
  caseId: string,
  rows: LifecycleRow[]
): CaseTimeline {
  const caseRows = rows.filter((r) => r.caseId === caseId);
  const current = caseRows.find((r) => r.isCurrent) ?? null;
  const byStage = new Map<number, LifecycleRow>();
  for (const r of caseRows) {
    if (!byStage.has(r.stage)) byStage.set(r.stage, r);
  }
  const entries: TimelineEntry[] = LIFECYCLE_STAGES.map((def, i) => {
    const n = i + 1;
    const row = byStage.get(n);
    const def2 = stageDef(def.id);
    return {
      stageNumber: n,
      stageId: def.id,
      title: def2.shortLabel,
      state: row
        ? row.isCurrent
          ? "current"
          : "done"
        : current && n < current.stage
          ? "not_recorded"
          : "upcoming",
      recordedAt: row ? row.stageChangedAt : null,
      subStage: row?.subStage ?? null,
      where: def2.clientWhere,
    };
  });
  const nextNumber = current ? current.stage + 1 : null;
  const whatIsNext =
    nextNumber !== null && nextNumber <= 6
      ? stageDef(stageIdForNumber(nextNumber)).clientNext[0] ??
        stageDef(stageIdForNumber(nextNumber)).clientHeading
      : current?.stage === 6
        ? "Your case is closed. If anything changes — a move, a new letter — tell your provider."
        : "No stage has been recorded for this case yet. Your provider records each stage change here as your case moves.";
  return {
    caseId,
    entries,
    whatIsNext,
    currentStageNumber: current?.stage ?? null,
  };
}

// ---------------------------------------------------------------------------
// 4. "What changed today" — from real stored events only.
// ---------------------------------------------------------------------------

export interface WhatChangedToday {
  events: ChangeEventInput[];
  /** "Nothing new today." when the list is empty — the page shows this. */
  emptyMessage: string;
}

export const NOTHING_NEW_TODAY =
  "Nothing new today. No status change, no new message, and no new document request was recorded for your cases today. Check back tomorrow — or open your case to review where it stands.";

export function whatChangedToday(
  events: ChangeEventInput[],
  todayIso: string
): WhatChangedToday {
  const todays = events
    .filter((e) => (e.at ?? "").slice(0, 10) === todayIso)
    .sort((a, b) => (a.at < b.at ? 1 : -1));
  return { events: todays, emptyMessage: NOTHING_NEW_TODAY };
}

/** News items published today and matching the client's forms — the
 *  news slice of the what-changed feed (built-in posts only). */
export function todaysNewsForForms(
  forms: string[],
  todayIso: string
): DailyNewsPost[] {
  return newsPublishedOn(DAILY_NEWS, todayIso, forms);
}

// ---------------------------------------------------------------------------
// 5. Reminders — renewals (real stored dates) + RFE deadlines +
//    documents asked to be retaken. Nothing is invented: a reminder
//    exists only when a real date or a real retake request exists.
// ---------------------------------------------------------------------------

export interface RfeDeadlineInput {
  caseId: string;
  formLabel: string;
  deadline: string; // YYYY-MM-DD, from the RFE letter as recorded
}

export interface DailyReminder {
  kind: "renewal" | "rfe" | "document_retake";
  caseId: string;
  title: string;
  detail: string;
  /** YYYY-MM-DD, or null for a retake (no deadline of its own). */
  dueDate: string | null;
  urgency: "overdue" | "due_soon" | "upcoming";
}

export function buildDailyReminders(args: {
  renewals: RenewalRow[];
  rfeDeadlines: RfeDeadlineInput[];
  retakeDocuments: DocumentRow[];
  todayIso: string;
  now?: Date;
}): DailyReminder[] {
  const out: DailyReminder[] = [];
  const derived: RenewalDerived[] = deriveRenewals(args.renewals, args.now);
  for (const r of derived) {
    if (r.status === "done" || !r.isDue) continue;
    out.push({
      kind: "renewal",
      caseId: r.caseId,
      title: `${RENEWAL_TYPE_LABEL[r.type]} — ${r.daysUntilDue < 0 ? `overdue by ${-r.daysUntilDue} day${-r.daysUntilDue === 1 ? "" : "s"}` : r.daysUntilDue === 0 ? "due today" : `due in ${r.daysUntilDue} day${r.daysUntilDue === 1 ? "" : "s"}`}`,
      detail: `File ${r.type === "passport" ? "a passport renewal with your country's passport office" : `Form ${r.type === "green_card" ? "I-90" : r.type === "conditional_green_card" ? "I-751" : r.type === "ead" ? "I-765" : r.type === "tps" ? "I-821 + I-765" : "N-400"}`}. The date below is the real expiry / eligibility date recorded for your case — never a guess.`,
      dueDate: r.eligibilityOrExpiryDate,
      urgency:
        r.daysUntilDue < 0 ? "overdue" : r.daysUntilDue <= 14 ? "due_soon" : "upcoming",
    });
  }
  for (const rfe of args.rfeDeadlines) {
    const overdue = rfe.deadline < args.todayIso;
    const soon =
      !overdue &&
      Date.parse(`${rfe.deadline}T12:00:00Z`) - Date.parse(`${args.todayIso}T12:00:00Z`) <=
        14 * 86_400_000;
    out.push({
      kind: "rfe",
      caseId: rfe.caseId,
      title: `RFE deadline — ${rfe.formLabel}`,
      detail:
        "USCIS asked for more evidence. Send only what your provider lists, before the deadline on the letter. An RFE is not a denial — missing its deadline can lead to one.",
      dueDate: rfe.deadline,
      urgency: overdue ? "overdue" : soon ? "due_soon" : "upcoming",
    });
  }
  for (const doc of args.retakeDocuments) {
    out.push({
      kind: "document_retake",
      caseId: doc.caseId,
      title: `Document retake needed — ${doc.fileName}`,
      detail:
        doc.retakeNote ??
        "Your provider asked for a clearer copy of this document. Upload a clear photo or scan — a blurry page delays your case.",
      dueDate: null,
      urgency: "due_soon",
    });
  }
  const rank = { overdue: 0, due_soon: 1, upcoming: 2 } as const;
  return out.sort((a, b) => {
    const byRank = rank[a.urgency] - rank[b.urgency];
    if (byRank !== 0) return byRank;
    const ad = a.dueDate ?? "9999-12-31";
    const bd = b.dueDate ?? "9999-12-31";
    return ad < bd ? -1 : ad > bd ? 1 : 0;
  });
}

// ---------------------------------------------------------------------------
// 6. "My saved things" — drafts + documents + questionnaire answers,
//    gathered in one place. Download/print stays pay-gated where the
//    existing gates apply: the API route fills `downloadLocked` from
//    the existing DIY unlock check (lib/diy.ts) and the document-vault
//    paywall surface (lib/paywall.ts) — no second paywall is built.
// ---------------------------------------------------------------------------

export interface SavedThing {
  kind: "draft" | "document" | "questionnaire";
  caseId: string;
  title: string;
  detail: string;
  updatedAt: string;
  /** Link inside the portal (resume / view). */
  href: string;
  /** True when download/print needs a paid unlock first. */
  downloadLocked: boolean;
  lockNote: string | null;
}

export function buildSavedThings(args: {
  drafts: (DraftRow & { downloadLocked: boolean })[];
  documents: (DocumentRow & { downloadLocked: boolean })[];
  questionnaireCounts: { caseId: string; formCode: string; answeredCount: number; updatedAt: string }[];
}): { items: SavedThing[]; counts: { drafts: number; documents: number; questionnaireAnswers: number } } {
  const items: SavedThing[] = [];
  for (const d of args.drafts) {
    items.push({
      kind: "draft",
      caseId: d.caseId,
      title: `Draft — Form ${d.formCode} (${d.status === "in_progress" ? "in progress" : d.status === "completed" ? "completed" : "transferred"})`,
      detail:
        d.progressPercent !== null
          ? `${d.answeredCount} answers saved — ${d.progressPercent}% complete. Saving a draft files nothing with USCIS.`
          : `${d.answeredCount} answers saved. Saving a draft files nothing with USCIS.`,
      updatedAt: d.updatedAt,
      href: `/diy?resume=${encodeURIComponent(d.formCode)}&caseId=${encodeURIComponent(d.caseId)}`,
      downloadLocked: d.downloadLocked,
      lockNote: d.downloadLocked
        ? "Download / print unlocks after the paid DIY unlock for this form — the draft itself is always free to resume."
        : null,
    });
  }
  for (const doc of args.documents) {
    items.push({
      kind: "document",
      caseId: doc.caseId,
      title: `Document — ${doc.fileName}`,
      detail: `${doc.vaultCategory} — review: ${doc.reviewStatus}.`,
      updatedAt: doc.createdAt,
      href: `/portal?view=document&doc=${encodeURIComponent(doc.id)}`,
      downloadLocked: doc.downloadLocked,
      lockNote: doc.downloadLocked
        ? "Document Vault is a paid surface — download unlocks with your membership or bundle."
        : null,
    });
  }
  for (const q of args.questionnaireCounts) {
    items.push({
      kind: "questionnaire",
      caseId: q.caseId,
      title: `Questionnaire answers — Form ${q.formCode}`,
      detail: `${q.answeredCount} answers saved from your questionnaire. Sensitive numbers (SSN, A-Number, passport) are never stored in drafts and are masked here.`,
      updatedAt: q.updatedAt,
      href: `/portal/questionnaire?caseId=${encodeURIComponent(q.caseId)}`,
      downloadLocked: false,
      lockNote: null,
    });
  }
  items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return {
    items,
    counts: {
      drafts: args.drafts.length,
      documents: args.documents.length,
      questionnaireAnswers: args.questionnaireCounts.reduce(
        (s, q) => s + q.answeredCount,
        0
      ),
    },
  };
}

// ---------------------------------------------------------------------------
// 7. Daily check-in + streak — from the daily_checkins table
//    (migration 0026) only. A streak is consecutive calendar days with
//    a stored check-in, ending today or yesterday. No check-in, no streak.
// ---------------------------------------------------------------------------

export function computeStreak(
  checkinDates: string[],
  todayIso: string
): { streakDays: number; checkedInToday: boolean; totalCheckins: number } {
  const days = new Set(checkinDates.map((d) => d.slice(0, 10)));
  const checkedInToday = days.has(todayIso);
  let streakDays = 0;
  // A streak counts back from today, or from yesterday if today is
  // not checked in yet — checking in today extends it.
  let cursor = new Date(`${todayIso}T12:00:00Z`);
  if (!checkedInToday) cursor.setUTCDate(cursor.getUTCDate() - 1);
  for (;;) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!days.has(iso)) break;
    streakDays += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return { streakDays, checkedInToday, totalCheckins: days.size };
}

// ---------------------------------------------------------------------------
// 8. The /api/today payload (also the page's props shape).
// ---------------------------------------------------------------------------

export interface DailyHomePayload {
  todayIso: string;
  configured: boolean;
  cases: CaseAtAGlance[];
  timelines: CaseTimeline[];
  reminders: DailyReminder[];
  news: DailyNewsPost[];
  newsNote: string;
  questionOfTheDay: QuestionOfTheDay | null;
  questionLocked: boolean;
  questionLockNote: string | null;
  whatChanged: WhatChangedToday;
  savedThings: { items: SavedThing[]; counts: { drafts: number; documents: number; questionnaireAnswers: number } };
  unreadMessages: number;
  checkin: { streakDays: number; checkedInToday: boolean; totalCheckins: number };
  emptyStates: {
    noCases: boolean;
    noReminders: boolean;
    noChanges: boolean;
    noSavedThings: boolean;
  };
}

/** Empty payload — what the page shows when Supabase is not configured
 *  or the client has no cases. Honest empty states, nothing invented. */
export function emptyDailyHomePayload(todayIso: string): DailyHomePayload {
  return {
    todayIso,
    configured: false,
    cases: [],
    timelines: [],
    reminders: [],
    news: DAILY_NEWS,
    newsNote:
      "No live news feed is connected yet — these are built-in posts from official sources, checked on 2026-11-28.",
    questionOfTheDay: null,
    questionLocked: true,
    questionLockNote:
      "Sign in to see today's interview question. Interview Preparation is a paid surface — one question a day is free once you are signed in and your access is confirmed.",
    whatChanged: { events: [], emptyMessage: NOTHING_NEW_TODAY },
    savedThings: {
      items: [],
      counts: { drafts: 0, documents: 0, questionnaireAnswers: 0 },
    },
    unreadMessages: 0,
    checkin: { streakDays: 0, checkedInToday: false, totalCheckins: 0 },
    emptyStates: {
      noCases: true,
      noReminders: true,
      noChanges: true,
      noSavedThings: true,
    },
  };
}
