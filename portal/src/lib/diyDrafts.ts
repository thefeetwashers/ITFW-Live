// DIY save-and-resume — pure draft logic (sanitize, mask, summarize).
//
// WHY THIS FILE EXISTS: a half-finished DIY form is real work, and
// losing it means the client starts over. Drafts are saved to the
// `diy_drafts` table (migration 0023) so the client can resume from
// their account. The storage rules are enforced in THREE places, so
// no single mistake can leak a sensitive number:
//   1. HERE (code): sanitizeDraftAnswers() strips every sensitive
//      key before anything is saved, and reports which keys were
//      stripped so the UI can say so honestly.
//   2. THE API ROUTE (/api/diy/drafts): calls sanitizeDraftAnswers()
//      and refuses to save anything it did not sanitize.
//   3. THE DATABASE (migration 0023): a BEFORE INSERT OR UPDATE
//      trigger rejects any draft whose top-level answer keys match a
//      sensitive pattern — the database is the backstop.
//
// WHAT IS NEVER STORED IN A DRAFT:
//   * Social Security numbers, A-Numbers, passport numbers, green
//     card numbers — any answer key mentioning ssn, a-number,
//     passport or green card. The client re-enters those on the
//     official form itself; the draft never holds them.
// WHAT IS STORED: all other answers (names, dates of birth, addresses,
//   timelines, trip details). Date of birth IS stored — it is already
//   held in accounts.date_of_birth (migration 0001) and is needed to
//   resume. It is masked in the UI, never logged, and never put in an
//   email subject — same rule as everywhere else in the portal.
//
// A draft is NOT a filing. Saving a draft files nothing with USCIS,
// and resuming a draft does not submit anything.

export type DiyDraftAnswers = Record<string, string>;

/** Key fragments that mark an answer as a sensitive identifier.
//  Matched case-insensitively against the answer KEY (not the value),
//  so a trip purpose that happens to mention the word "passport"
//  in its VALUE is not stripped — only keys like
//  `i131_passport_number` or `beneficiary_passport_number`. */
export const FORBIDDEN_DRAFT_KEY_FRAGMENTS = [
  "ssn",
  "social_security",
  "a_number",
  "a-number",
  "alien_number",
  "passport",
  "green_card",
  "greencard",
] as const;

export function isForbiddenDraftKey(key: string): boolean {
  const lower = key.toLowerCase();
  return FORBIDDEN_DRAFT_KEY_FRAGMENTS.some((frag) => lower.includes(frag));
}

export interface SanitizedDraft {
  /** Answers safe to save — sensitive keys removed. */
  answers: DiyDraftAnswers;
  /** Keys that were stripped, so the UI can say so. */
  strippedKeys: string[];
  /** True when anything was stripped. */
  hadSensitiveKeys: boolean;
}

/** Strip sensitive-identifier answers before saving. Pure — no I/O. */
export function sanitizeDraftAnswers(
  answers: DiyDraftAnswers
): SanitizedDraft {
  const kept: DiyDraftAnswers = {};
  const strippedKeys: string[] = [];
  for (const [key, value] of Object.entries(answers ?? {})) {
    if (isForbiddenDraftKey(key)) {
      strippedKeys.push(key);
      continue;
    }
    kept[key] = value;
  }
  return { answers: kept, strippedKeys, hadSensitiveKeys: strippedKeys.length > 0 };
}

/** Mask a draft value for display in lists / summaries. Dates of
 *  birth and other kept values show only a hint — never the full
 *  value in a list view. Mirrors maskSensitiveValue() in
 *  src/lib/dynamicIntakeSchemas.ts. */
export function maskDraftValueForDisplay(value: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.length <= 4) return "***";
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
}

export interface DiyDraftSummary {
  formCode: string;
  answeredCount: number;
  /** Total answerable fields known for the form (0 when the form has
   *  no dynamic schema in the codebase — progress is then "answers
   *  saved", not a percentage). */
  totalKnownFields: number | null;
  /** 0–100 when totalKnownFields is known, otherwise null. */
  progressPercent: number | null;
  lastSavedAt: string | null;
}

/** Progress summary for a resumed draft. `totalKnownFields` comes
 *  from the form's intake schema (required + optional fields); pass
 *  null when the form has no schema in the codebase. */
export function summarizeDraft(args: {
  formCode: string;
  answers: DiyDraftAnswers;
  totalKnownFields: number | null;
  lastSavedAt: string | null;
}): DiyDraftSummary {
  const answeredCount = Object.values(args.answers ?? {}).filter(
    (v) => (v ?? "").trim() !== ""
  ).length;
  const total = args.totalKnownFields;
  return {
    formCode: args.formCode,
    answeredCount,
    totalKnownFields: total,
    progressPercent:
      total !== null && total > 0
        ? Math.min(100, Math.round((answeredCount / total) * 100))
        : null,
    lastSavedAt: args.lastSavedAt,
  };
}

/** Resume URL for a draft, on the DIY page (src/app/diy/page.tsx —
 *  query params ?caseId=<case id>&form=<form code>). The draft id is
 *  carried as &draft=<id> so the page can load that exact draft
 *  through GET /api/diy/drafts; the page today reads caseId + form,
 *  so case + form are the lookup keys and the draft id is a hint. */
export function diyDraftResumeUrl(
  caseId: string,
  formCode: string,
  draftId?: string
): string {
  const params = new URLSearchParams({ caseId, form: formCode });
  if (draftId) params.set("draft", draftId);
  return `/diy?${params.toString()}`;
}
