// Immigration Journey Map — the surprise signature feature
// (ELEVENTH ADDITION, Nov 28, 2026).
//
// ONE living page per client/family: where they started, where they are
// now, what is next, what is missing, their interview date, and the
// green card in hand — in plain language, in their language (7
// languages where locked translations exist, English original always
// shown). It is the home screen of the client dashboard.
//
// WHAT IT REUSES (nothing rebuilt):
//   * src/lib/journey.ts — JOURNEY_STEPS / POST_ARRIVAL_CHECKLIST, the
//     only timing anywhere ("30–90 days after entry", locked Stage 6).
//   * src/lib/lifecycle.ts — stage definitions (clientWhere /
//     clientNext) for "where you are now" and "what is next".
//   * src/lib/dailyHome.ts — buildCaseTimeline() (per-case timeline
//     from case_lifecycle rows) — the map's step states come from the
//     same rows, never from a second source.
//   * src/lib/lockedTranslations.ts — bilingual headings: a heading
//     shows its locked translation ONLY where a locked storefront
//     string exists for it; otherwise English +
//     "Translation pending — shown in English". No translation is ever
//     made up, and live translation is not_configured.
//   * src/lib/familyCase.ts — sharing: a family member sees the map
//     ONLY through the existing family invite system, with their own
//     login, for their invited case only. There is NO public link to
//     a private case, and this file creates none.
//
// HONESTY RULES (do not weaken):
//   * Runs on REAL STORED case data only. No case -> the honest empty
//     state (journeyMapEmptyState), never an invented journey.
//   * No milestone is shown as done unless a case_lifecycle row (or
//     the stored case status) records it. A step with no record is
//     "not recorded yet", never "done".
//   * The interview date is shown ONLY when it is stored
//     (case_agency_numbers.interview_date, migration 0010, or
//     nvc_trackers.interview_at, migration 0027) — i.e. a date from
//     the client's own interview letter, entered from that letter.
//     No interview date on file -> "No interview date on file yet".
//     No date is ever promised or guessed.
//   * The green card: the ONLY timing is the locked 30–90 day range
//     after U.S. entry. With a stored us_entry_at (migration 0027)
//     the range is shown against that real entry date; without one
//     the range is shown with no date attached.
//   * DOB, A-Number, SSN and passport numbers are never read here,
//     never shown, never logged. Receipt / case numbers are masked
//     by the caller (see dailyHome.maskIdentifier) — this file takes
//     no identifier at all.
import {
  JOURNEY_STEPS,
  journeyHasNoPromisedDates,
  type JourneyStep,
} from "./journey";
import {
  LIFECYCLE_STAGES,
  stageDef,
  type LifecycleStageId,
} from "./lifecycle";
import {
  bilingualList,
  TRANSLATION_PENDING_NOTE,
  type BilingualLine,
} from "./lockedTranslations";
import type { LanguageCode } from "./i18n";

export { TRANSLATION_PENDING_NOTE };

/** Stored data the map reads. Every field is a real stored value (or
 *  null when nothing is stored). The API route that builds this input
 *  reads cases / case_lifecycle / case_agency_numbers / nvc_trackers /
 *  inbox_items — the same tables /api/today already reads. */
export interface JourneyMapCaseInput {
  caseId: string;
  forms: string[];
  /** Stored case status (cases.status, migration 0001). */
  status: string;
  createdAt: string;
  /** Current lifecycle stage number (1–6) from case_lifecycle, or
   *  null when no stage was ever recorded. */
  currentStage: number | null;
  /** stage number -> stage_changed_at (YYYY-MM-DD or ISO) for every
   *  recorded stage. A stage absent here was never recorded. */
  stageRecordedAt: Record<number, string>;
  /** Interview date from the client's own interview letter, as
   *  stored (case_agency_numbers.interview_date / nvc_trackers
   *  .interview_at). Null = no interview date on file yet. */
  interviewDate: string | null;
  /** $235 USCIS Immigrant Fee paid before flying (cases
   *  .immigrant_fee_paid, migration 0027). */
  immigrantFeePaid: boolean;
  /** Date the client entered the United States (cases.us_entry_at,
   *  migration 0027). Null = no entry recorded yet. */
  usEntryAt: string | null;
  /** Documents still missing (inbox_items type missing_document,
   *  status missing) — labels only, never file contents. */
  missingItems: { id: string; label: string }[];
  /** Family members invited to this case (case_family_members) —
   *  count only; names are shown by the family roster, not here. */
  familyMemberCount: number;
}

export type JourneyStepState = "done" | "current" | "upcoming" | "not_recorded";

export interface JourneyMapStep {
  step: JourneyStep;
  state: JourneyStepState;
  /** Real recorded date for this step's stage, or null. */
  recordedAt: string | null;
}

export interface JourneyMap {
  caseId: string;
  forms: string[];
  /** Plain-language "where you started". */
  whereStarted: string;
  /** Plain-language "where you are now" (current stage). */
  whereNow: string;
  currentStageLabel: string | null;
  currentStageNumber: number | null;
  /** Plain-language "what is next" (next stage's first step). */
  whatIsNext: string;
  /** Missing documents — the "what is missing" list. Empty when
   *  nothing is recorded as missing. */
  missingItems: { id: string; label: string }[];
  /** Stored interview date, or null (shown as "not on file yet"). */
  interviewDate: string | null;
  /** Green-card line: the locked 30–90 day range, anchored to the
   *  real entry date when one is stored, otherwise dateless. */
  greenCardLine: string;
  immigrantFeePaid: boolean;
  familyMemberCount: number;
  steps: JourneyMapStep[];
  /** True when the underlying journey promises no dates. Always true
   *  — asserted by the smoke test. */
  noPromisedDates: boolean;
}

export const JOURNEY_MAP_EMPTY_STATE =
  "No case on file yet. Your Journey Map appears here once your case is created — it shows where you started, where you are now, what is next, and what is still missing, from your real case file. Nothing here is invented, and no date is ever promised.";

export const JOURNEY_MAP_NO_INTERVIEW_DATE =
  "No interview date on file yet. Your interview date comes from your own interview letter — when NVC sends it, your provider records it here. No date is promised before then.";

export const JOURNEY_MAP_NO_MISSING_ITEMS =
  "Nothing recorded as missing right now. If your provider asks for a document, it appears here.";

export const JOURNEY_MAP_SHARE_NOTE =
  "Share this map with your family: invite them through Family Invite in the Client Portal. Each family member gets their own login and sees only the case they were invited to. There is no public link to your case — never share a link that shows your case to anyone without a login.";

/** Section headings, rendered bilingually. No locked translation
 *  exists for these headings yet, so non-English languages honestly
 *  show English + TRANSLATION_PENDING_NOTE (see lockedTranslations).
 *  When a locked string is added for a heading, pass its lockedKey
 *  and the translation appears automatically. */
export const JOURNEY_MAP_HEADINGS = [
  { id: "started", english: "Where you started" },
  { id: "now", english: "Where you are now" },
  { id: "next", english: "What is next" },
  { id: "missing", english: "What is missing" },
  { id: "interview", english: "Your interview" },
  { id: "green-card", english: "Green card in hand" },
  { id: "share", english: "Share with your family" },
] as const;

export function journeyMapHeadings(lang: LanguageCode): BilingualLine[] {
  return bilingualList(
    JOURNEY_MAP_HEADINGS.map((h) => ({ id: h.id, english: h.english })),
    lang
  );
}

const STAGE_IDS: LifecycleStageId[] = [
  "new_lead",
  "consultation_quote",
  "payment_arrangement",
  "active_client",
  "submitted_uscis",
  "visa_approved_closed",
];

function stageIdForNumber(n: number): LifecycleStageId {
  return STAGE_IDS[Math.min(Math.max(n, 1), 6) - 1];
}

/** Journey step -> lifecycle stage number. Steps 1–6 map to stages
 *  1–6; the interview step (7) belongs to stage 5; travel/entry (8–9)
 *  and green card (10) belong to stage 6. */
function stepStageNumber(step: JourneyStep): number {
  if (step.id === "j-interview") return 5;
  if (
    step.id === "j-visa-travel" ||
    step.id === "j-entry" ||
    step.id === "j-green-card-ssn"
  )
    return 6;
  const idx = STAGE_IDS.indexOf(step.stage as LifecycleStageId);
  return idx >= 0 ? idx + 1 : 1;
}

/**
 * Build one family's Journey Map from real stored case data only.
 * Returns null when there is no case — the caller shows
 * JOURNEY_MAP_EMPTY_STATE. Never invents a milestone, a date, or a
 * next step: a step with no recorded stage is "not_recorded", and
 * "what is next" comes from the lifecycle definition of the stage
 * after the current one (or the honest "no stage recorded" line).
 */
export function buildJourneyMap(input: JourneyMapCaseInput | null): JourneyMap | null {
  if (!input) return null;
  const current = input.currentStage;
  const firstRecorded = Object.keys(input.stageRecordedAt)
    .map(Number)
    .sort((a, b) => a - b)[0];
  const whereStarted =
    firstRecorded !== undefined
      ? `You started at Stage ${firstRecorded} — ${stageDef(stageIdForNumber(firstRecorded)).shortLabel}. ${stageDef(stageIdForNumber(firstRecorded)).clientWhere}`
      : `Your case was created on ${input.createdAt.slice(0, 10)}. No lifecycle stage has been recorded yet — your provider records each stage change here as your case moves.`;
  const whereNow =
    current !== null
      ? stageDef(stageIdForNumber(current)).clientWhere
      : "No stage has been recorded for this case yet. Your provider records each stage change here as your case moves.";
  const nextNumber = current !== null ? current + 1 : null;
  const whatIsNext =
    nextNumber !== null && nextNumber <= 6
      ? (stageDef(stageIdForNumber(nextNumber)).clientNext[0] ??
        stageDef(stageIdForNumber(nextNumber)).clientHeading)
      : current === 6
        ? "Your case is closed. If anything changes — a move, a new letter — tell your provider."
        : "No stage has been recorded for this case yet, so there is no next stage to show. Your provider records each stage change here as your case moves.";
  const greenCardLine = input.usEntryAt
    ? `You entered the United States on ${input.usEntryAt.slice(0, 10)}. Your Green Card and Social Security card are mailed to your U.S. address, usually 30–90 days after entry — that range is the only timing on this map, and no exact date is promised.`
    : "After you enter the United States, your Green Card and Social Security card are mailed to your U.S. address, usually 30–90 days after entry. That 30–90 day range is the only timing on this map — it is the range already locked in Stage 6, not a promised date.";
  const steps: JourneyMapStep[] = JOURNEY_STEPS.map((step) => {
    const stageNumber = stepStageNumber(step);
    const recordedAt = input.stageRecordedAt[stageNumber] ?? null;
    let state: JourneyStepState;
    if (current === null) state = recordedAt ? "done" : "not_recorded";
    else if (stageNumber < current) state = recordedAt ? "done" : "not_recorded";
    else if (stageNumber === current) state = "current";
    else state = "upcoming";
    return { step, state, recordedAt };
  });
  return {
    caseId: input.caseId,
    forms: input.forms,
    whereStarted,
    whereNow,
    currentStageLabel:
      current !== null
        ? `Stage ${current} — ${stageDef(stageIdForNumber(current)).shortLabel}`
        : null,
    currentStageNumber: current,
    whatIsNext,
    missingItems: input.missingItems,
    interviewDate: input.interviewDate,
    greenCardLine,
    immigrantFeePaid: input.immigrantFeePaid,
    familyMemberCount: input.familyMemberCount,
    steps,
    noPromisedDates: journeyHasNoPromisedDates(),
  };
}

/** The lifecycle stage list, re-exported so the map page reads stages
 *  and map from one place. */
export { LIFECYCLE_STAGES };
