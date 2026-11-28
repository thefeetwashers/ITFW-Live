// Case-number tracking + NVC / consular view — EIGHTH ADDITION, Nov 28, 2026.
//
// Founder's brief: once the client gives their case / receipt number,
// the client and the professional should see everything about the case
// — what is done, what is missing, whether the file is complete — to
// help get the application approved.
//
// HONEST BOUNDARY (do not weaken — this file exists to enforce it):
//   * USCIS does NOT give any platform a view inside an officer's file.
//     There is NO API that shows what an officer touched, changed, or
//     noted. The USCIS Case Status API is Sandbox-approved only;
//     Production is NOT granted (it needs 5 days of Sandbox traffic +
//     a demo + approval), so there is NO live USCIS lookup in this
//     build. Statuses here are either (a) the PUBLIC status words
//     USCIS shows on Case Status Online, entered manually after the
//     client / preparer checks uscis.gov, or (b) a Sandbox / mock
//     value, labelled as such. Never present either as a live lookup
//     or as officer activity.
//   * NVC has NO API at all. CEAC is manual only: a link out to
//     https://ceac.state.gov/IV/Login.aspx. A CEAC password must NEVER
//     be stored, and this portal NEVER asks for one — there is no
//     password field anywhere in this module.
//   * The completeness view is built from OUR records (our packet
//     audit + our document list + receipt notices we recorded), and
//     every row says so. It is never USCIS's internal file.
//   * Nothing here promises or implies an approval. Only USCIS (or
//     the consulate, for a visa abroad) decides a case.
//   * Platform is a document-preparation service, NOT a law firm, NOT
//     USCIS affiliated. Only a licensed attorney or DOJ-accredited
//     representative gives legal advice (8 CFR 292.1). The RFE / NOID
//     decoder below translates notice WORDS into plain English and
//     clerical next steps only — it never writes a legal response.
//     A NOID always carries the attorney-review flag.
//
// REUSES (never duplicates):
//   * Receipt + NVC case-number validation: parseUscisReceipt /
//     parseNvcCaseNumber / lookupNvcPost in lib/nvc.ts. The receipt
//     prefixes IOE / EAC / WAC / LIN / SRC / NBC / MSC are validated
//     there — this file does not re-implement them.
//   * CEAC 6 steps + DOS fees ($120 AOS + $325 IV): CEAC_STEPS /
//     CEAC_FEE_AMOUNTS / CEAC_LOGIN_URL in lib/nvc.ts. The K-1 flow
//     (DS-160 + I-134, NO DS-260 / I-864 / CEAC fees) is in nvc.ts
//     too — this file reuses it, it does not copy I-130 steps onto K-1.
//   * Status sync + delivery: POST /api/case-status and
//     lib/caseStatusSync.ts. A status change logged here is stored in
//     case_watch.milestones (jsonb, migration 0001) via
//     buildCaseWatchMilestone() — NO new table and NO migration were
//     needed: case_watch already holds receipt_number + uscis_status +
//     uscis_status_at + milestones, case_lifecycle (0010) already
//     holds stage history, and audit_log (0001) already holds the
//     audit trail. The route owner can append the milestone; this
//     file only builds the value.
//   * Packet audit: computePacketReadiness in lib/audit.ts and
//     auditItemsForTemplate / readinessForTemplate in
//     lib/formChecklists.ts. Filing needs 100% + every blocking item
//     cleared — that rule lives there, not here.
//   * Interview prep banks + no-guarantee notice:
//     lib/interviewPrep.ts (INTERVIEW_BANKS, NO_GUARANTEE_NOTICE).
//   * RFE clerical checklist: RfeTracker component (preparer
//     dashboard) + rfe_uploads (0002). The decoder here only ADDS the
//     plain-English meaning of notice words.
//   * NVC trackers table: nvc_trackers (0002) stores the NVC case
//     number + Invoice ID (encrypted by the API layer). This file
//     never stores either in plain text.
//
// PRIVACY: receipt numbers are MASKED in the UI (prefix + last 4
// digits only — maskReceiptNumber). Never log a full receipt number,
// never put one in an email subject. No DOB, A-Number, SSN or
// passport number is handled anywhere in this module.
import { CEAC_FEE_AMOUNTS, CEAC_LOGIN_URL, CEAC_STEPS, lookupNvcPost, parseNvcCaseNumber, parseUscisReceipt, type NvcPost } from "./nvc";
import { auditItemsForTemplate, readinessForTemplate } from "./formChecklists";
import { NO_GUARANTEE_NOTICE } from "./interviewPrep";
import { daysUntil } from "./shipments";

export { CEAC_LOGIN_URL, NO_GUARANTEE_NOTICE };

// ---------------------------------------------------------------------------
// The honest note — shown on every case-tracker view, verbatim.
// ---------------------------------------------------------------------------
export const HONEST_TRACKER_NOTE =
  "We show your case status from USCIS public status and from your own file with us. " +
  "We cannot see inside the officer's file.";

// ---------------------------------------------------------------------------
// USCIS Case Status Online — link out (the client / preparer checks
// the status there; the result is then entered here manually).
// ---------------------------------------------------------------------------
export const USCIS_CASE_STATUS_URL =
  "https://egov.uscis.gov/casestatus/landing.do";

/** Mask a receipt number for display: IOE0928374651 -> "IOE••••••4651".
 *  Prefix + last 4 digits only; the middle digits never render. */
export function maskReceiptNumber(value: string | null | undefined): string {
  if (!value) return "—";
  const normalized = value.trim().toUpperCase();
  if (normalized.length < 7) return "•••";
  return `${normalized.slice(0, 3)}••••••${normalized.slice(-4)}`;
}

/** Validate a client-entered receipt number. Reuses parseUscisReceipt
 *  (lib/nvc.ts) — the prefix list IOE / EAC / WAC / LIN / SRC / NBC /
 *  MSC lives there. Returns the normalised number when valid. */
export function validateReceiptNumber(value: string): {
  valid: boolean;
  normalized: string | null;
  masked: string;
  errors: string[];
} {
  const parsed = parseUscisReceipt(value);
  return {
    valid: parsed.valid,
    normalized: parsed.valid ? parsed.normalized : null,
    masked: parsed.valid ? maskReceiptNumber(parsed.normalized) : "—",
    errors: parsed.errors,
  };
}

// ---------------------------------------------------------------------------
// Public USCIS status words — the status text USCIS itself shows on
// Case Status Online (egov.uscis.gov). Each entry is the public
// status ONLY, with a plain-English meaning and the next step. An
// unknown status is never guessed: explainPublicStatus() says so and
// tells the reader to check the exact words on the USCIS page.
// Source: USCIS Case Status Online public status messages.
// ---------------------------------------------------------------------------
export type PublicStatusCategory =
  | "received"
  | "review"
  | "rfe"
  | "interview"
  | "decision"
  | "card";

export interface PublicStatusExplanation {
  /** Exact public status text, as USCIS shows it. */
  statusText: string;
  category: PublicStatusCategory;
  /** Plain-English meaning of the public status. */
  plainEnglish: string;
  /** What to do next (clerical step, never legal advice). */
  nextStep: string;
}

export const PUBLIC_USCIS_STATUSES: PublicStatusExplanation[] = [
  {
    statusText: "Case Was Received",
    category: "received",
    plainEnglish:
      "USCIS has your filing and has given it a receipt number. This only means it arrived — nothing has been decided.",
    nextStep:
      "Keep the receipt notice (Form I-797C). Watch for the biometrics appointment letter.",
  },
  {
    statusText: "Case Was Received and A Receipt Notice Was Sent",
    category: "received",
    plainEnglish:
      "USCIS received your filing and mailed the receipt notice. This only means it arrived — nothing has been decided.",
    nextStep:
      "Keep the receipt notice (Form I-797C). Watch for the biometrics appointment letter.",
  },
  {
    statusText: "Biometrics Appointment Was Scheduled",
    category: "review",
    plainEnglish:
      "USCIS has set a date to take your fingerprints, photo, and signature. This is a routine step, not a decision.",
    nextStep:
      "Go to the appointment on the date in the letter, with the letter and a photo ID. Tell your preparer at once if you cannot go.",
  },
  {
    statusText: "Case Is Being Actively Reviewed By USCIS",
    category: "review",
    plainEnglish:
      "An officer has your file open and is reviewing it. This does not mean a decision is near, and it does not say what the officer is looking at.",
    nextStep:
      "Nothing to send unless USCIS asks. Keep your address updated with USCIS and keep your documents ready.",
  },
  {
    statusText: "Request for Additional Evidence Was Sent",
    category: "rfe",
    plainEnglish:
      "USCIS needs more evidence before it can decide. This is not a denial — but the reply has a deadline printed on the notice, and missing it can end the case.",
    nextStep:
      "Read the notice with your preparer, gather exactly what it asks for, and reply before the deadline on the notice. See the RFE decoder below.",
  },
  {
    statusText: "Response To USCIS' Request For Evidence Was Received",
    category: "rfe",
    plainEnglish:
      "USCIS received your reply to the Request for Evidence. The case goes back into review — this does not mean it is approved.",
    nextStep:
      "Nothing to send unless USCIS asks again. Keep a copy of everything you sent.",
  },
  {
    statusText: "Interview Was Scheduled",
    category: "interview",
    plainEnglish:
      "USCIS has set a date to interview you. The interview is part of the review — it is not an approval.",
    nextStep:
      "Go to the interview on the date in the letter, with the originals of your documents. Use the interview preparation in your portal.",
  },
  {
    statusText: "New Card Is Being Produced",
    category: "card",
    plainEnglish:
      "USCIS approved the benefit tied to the card and is making the card. The card itself has not been mailed yet.",
    nextStep:
      "Make sure the mailing address USCIS has is correct. Watch for the card in the mail.",
  },
  {
    statusText: "Card Was Delivered To Me By The Post Office",
    category: "card",
    plainEnglish:
      "The post office delivered the card. Check the name, date of birth, and dates on the card as soon as it arrives.",
    nextStep:
      "Check the card for errors and tell your preparer at once if anything is wrong. Keep the card safe.",
  },
  {
    statusText: "Case Was Approved",
    category: "decision",
    plainEnglish:
      "USCIS approved this filing. Read the approval notice — it says what was approved and what happens next (for example, a card in the mail, or the case moving to NVC).",
    nextStep:
      "Read the approval notice with your preparer and follow the next step it names. If the case goes to NVC, log the NVC case number here.",
  },
  {
    statusText: "Case Was Denied",
    category: "decision",
    plainEnglish:
      "USCIS did not approve this filing. The denial notice says why and whether you can appeal, reopen, or refile — those are legal questions.",
    nextStep:
      "Do not guess what to do next. Show the denial notice to a licensed attorney or DOJ-accredited representative right away — deadlines apply.",
  },
  {
    statusText: "Case Was Transferred To Another Office",
    category: "review",
    plainEnglish:
      "USCIS moved your file to a different office. This is a routine routing step and does not mean anything about the outcome.",
    nextStep:
      "Nothing to send. The receipt number stays the same — keep checking the same case status page.",
  },
];

/** Explain a public status string. Matching is case-insensitive and
 *  trims whitespace. Unknown text is NEVER guessed: it returns
 *  known: false with instructions to check the exact words on the
 *  USCIS page. */
export function explainPublicStatus(statusText: string): {
  known: boolean;
  explanation: PublicStatusExplanation | null;
  plainEnglish: string;
  nextStep: string;
} {
  const normalized = (statusText ?? "").trim().toLowerCase();
  const found =
    PUBLIC_USCIS_STATUSES.find(
      (s) => s.statusText.toLowerCase() === normalized
    ) ?? null;
  if (found) {
    return {
      known: true,
      explanation: found,
      plainEnglish: found.plainEnglish,
      nextStep: found.nextStep,
    };
  }
  return {
    known: false,
    explanation: null,
    plainEnglish:
      "This status text is not in our list of USCIS public status words, so we cannot explain it here. " +
      "Check the exact words on the USCIS Case Status Online page — do not guess what it means.",
    nextStep:
      "Open the USCIS Case Status Online page from the link below, read the status there, and ask your preparer to log it here.",
  };
}

// ---------------------------------------------------------------------------
// Status-change log — every change, with date + plain-English meaning.
// One entry per change. Stored in case_watch.milestones (jsonb, 0001)
// via buildCaseWatchMilestone(); the audit trail also lives in
// case_lifecycle (0010) + audit_log (0001). No new table, no migration.
// ---------------------------------------------------------------------------
export type StatusChangeSource =
  | "uscis_public"
  | "professional_manual"
  | "sandbox_mock";

export const STATUS_SOURCE_LABEL: Record<StatusChangeSource, string> = {
  uscis_public:
    "Public USCIS status — checked on uscis.gov and entered here. Not a live lookup, and not the officer's file.",
  professional_manual:
    "Entered by your preparer from a USCIS notice or letter — not a live USCIS lookup.",
  sandbox_mock:
    "Sandbox / mock value for testing only — not a real case status and not a live lookup.",
};

export interface CaseStatusLogEntry {
  id: string;
  /** ISO date-time the change was recorded. */
  recordedAt: string;
  /** Public status text, exactly as shown by USCIS (or as entered). */
  statusText: string;
  /** Where this status came from — never hidden from the reader. */
  source: StatusChangeSource;
  /** Plain-English meaning (from explainPublicStatus). */
  plainEnglish: string;
  /** What to do next. */
  nextStep: string;
  /** Masked receipt number this status belongs to. */
  receiptNumberMasked: string;
}

/** Build one log entry from a status text. Pure — nothing is saved
 *  by this helper. recordedAt defaults to now; pass it in tests for
 *  a fixed date. */
export function buildStatusLogEntry(args: {
  id: string;
  statusText: string;
  source: StatusChangeSource;
  receiptNumber: string;
  recordedAt?: string;
}): CaseStatusLogEntry {
  const explained = explainPublicStatus(args.statusText);
  return {
    id: args.id,
    recordedAt: args.recordedAt ?? new Date().toISOString(),
    statusText: args.statusText.trim(),
    source: args.source,
    plainEnglish: explained.plainEnglish,
    nextStep: explained.nextStep,
    receiptNumberMasked: maskReceiptNumber(args.receiptNumber),
  };
}

/** Append a status change to the log. If the new status is the same
 *  as the latest entry, it is NOT logged twice — the log records
 *  changes, not repeat checks. Returns a new array. */
export function appendStatusChange(
  entries: CaseStatusLogEntry[],
  entry: CaseStatusLogEntry
): CaseStatusLogEntry[] {
  const latest = entries[entries.length - 1];
  if (
    latest &&
    latest.statusText.trim().toLowerCase() ===
      entry.statusText.trim().toLowerCase()
  ) {
    return entries;
  }
  return [...entries, entry];
}

/** Shape for case_watch.milestones (jsonb, migration 0001) so the
 *  /api/case-status route can persist a status change without a new
 *  table or column. Full receipt numbers are NEVER stored here —
 *  only the masked form. */
export function buildCaseWatchMilestone(entry: CaseStatusLogEntry): {
  kind: "uscis_status_change";
  recorded_at: string;
  status_text: string;
  source: StatusChangeSource;
  plain_english: string;
  next_step: string;
  receipt_number_masked: string;
} {
  return {
    kind: "uscis_status_change",
    recorded_at: entry.recordedAt,
    status_text: entry.statusText,
    source: entry.source,
    plain_english: entry.plainEnglish,
    next_step: entry.nextStep,
    receipt_number_masked: entry.receiptNumberMasked,
  };
}

// ---------------------------------------------------------------------------
// Completeness view — what OUR packet contains vs the form checklist,
// what is missing, what was submitted, what USCIS receipted. Built
// ONLY from our records: the packet audit (lib/audit.ts +
// lib/formChecklists.ts) + the preparer's submitted / receipted
// flags, which come from the receipt notices on file. Every row is
// labelled with its source. This is never USCIS's internal file.
// ---------------------------------------------------------------------------
export const COMPLETENESS_SOURCE_LABEL =
  "Our records with Immigration with NIPTEI — not USCIS's internal file.";

export type CompletenessState = "submitted" | "missing" | "receipted";

export const COMPLETENESS_STATE_LABEL: Record<CompletenessState, string> = {
  submitted: "Submitted — in our packet, sent to USCIS",
  missing: "Missing — not in our packet yet",
  receipted: "Receipted — USCIS sent a receipt notice for this filing",
};

export interface CompletenessRow {
  id: string;
  label: string;
  state: CompletenessState;
  /** Blocking = filing cannot be marked ready until this is cleared. */
  blocking: boolean;
  /** Always COMPLETENESS_SOURCE_LABEL — the data is ours, not USCIS's. */
  sourceNote: string;
  detail?: string;
}

export interface CompletenessView {
  templateId: string;
  /** 0–100, from computePacketReadiness (lib/audit.ts). Filing needs
   *  100 + every blocking item cleared. */
  readinessScore: number;
  readyToFile: boolean;
  rows: CompletenessRow[];
  sourceNote: string;
}

/** Build the completeness view for a form template.
 *  clearedItemIds: checklist item ids already cleared (from
 *  readinessForTemplate). submittedItemIds: items in the packet that
 *  was sent. receiptedItemIds: filings USCIS receipted — the
 *  preparer records this only when the I-797C receipt notice is on
 *  file, never assumed. Unknown template id -> empty view, never a
 *  guessed checklist. */
export function buildCompletenessView(args: {
  templateId: string;
  clearedItemIds?: string[];
  submittedItemIds?: string[];
  receiptedItemIds?: string[];
}): CompletenessView {
  const cleared = args.clearedItemIds ?? [];
  const submitted = new Set(args.submittedItemIds ?? []);
  const receipted = new Set(args.receiptedItemIds ?? []);
  const readiness = readinessForTemplate(args.templateId, cleared);
  const auditItems = auditItemsForTemplate(args.templateId);
  const rows: CompletenessRow[] = auditItems.map((item) => {
    const bareId = item.id.replace(/^audit-/, "");
    let state: CompletenessState = "missing";
    if (receipted.has(bareId) || receipted.has(item.id)) state = "receipted";
    else if (submitted.has(bareId) || submitted.has(item.id)) state = "submitted";
    else if (cleared.includes(bareId) || cleared.includes(item.id))
      state = "submitted";
    return {
      id: item.id,
      label: item.label,
      state,
      blocking: item.blocking,
      sourceNote: COMPLETENESS_SOURCE_LABEL,
      detail: item.detail,
    };
  });
  return {
    templateId: args.templateId,
    readinessScore: readiness.score,
    readyToFile: readiness.readyToFile,
    rows,
    sourceNote: COMPLETENESS_SOURCE_LABEL,
  };
}

// ---------------------------------------------------------------------------
// RFE / NOID decoder — what the words on the notice usually mean, in
// plain English, with the clerical next step. This translates WORDS
// only. It never decides whether the evidence is strong enough, never
// writes a legal response, and never says what the outcome will be.
// A NOID (Notice of Intent to Deny) ALWAYS carries attorneyReview:
// the response is legal work for a licensed attorney or
// DOJ-accredited representative. The clerical tracker for the RFE
// itself lives in RfeTracker + rfe_uploads (0002).
// ---------------------------------------------------------------------------
export interface RfeDecodeRule {
  /** Words to look for on the notice (case-insensitive substring). */
  matchPhrases: string[];
  /** What the notice is asking about, in plain English. */
  meaning: string;
  /** Clerical next step — gather / organise only. */
  clericalNextStep: string;
  /** True when the response needs attorney review. */
  attorneyReview: boolean;
}

export const RFE_DECODE_RULES: RfeDecodeRule[] = [
  {
    matchPhrases: ["bona fide marriage", "good faith marriage", "marital relationship"],
    meaning:
      "USCIS wants more proof the marriage is real — that you live together as a married couple, not only on paper.",
    clericalNextStep:
      "Gather joint documents (lease, bank statements, bills, photos with dates) exactly as listed on the notice. Your preparer organises them; the legal response belongs to an attorney.",
    attorneyReview: true,
  },
  {
    matchPhrases: ["income", "125%", "poverty guidelines", "affidavit of support", "i-864"],
    meaning:
      "USCIS wants more proof the sponsor earns enough to support the person coming — or a joint sponsor.",
    clericalNextStep:
      "Gather the sponsor's tax transcripts, W-2s / 1099s, and pay records listed on the notice, or the joint sponsor's papers if the notice asks for them.",
    attorneyReview: true,
  },
  {
    matchPhrases: ["birth certificate", "civil document"],
    meaning:
      "USCIS wants a birth certificate (or another civil document) it can accept — the one sent was missing, unclear, or not translated.",
    clericalNextStep:
      "Get a clear copy of the certificate and a certified translation if it is in another language, exactly as the notice asks.",
    attorneyReview: false,
  },
  {
    matchPhrases: ["medical", "i-693", "vaccination"],
    meaning:
      "USCIS wants the medical exam form (I-693) or vaccination records — missing, expired, or incomplete.",
    clericalNextStep:
      "Book the exam with a USCIS civil surgeon (inside the U.S.) or panel physician (abroad) and bring the vaccination records.",
    attorneyReview: false,
  },
  {
    matchPhrases: ["intent to deny", "noid", "notice of intent to deny"],
    meaning:
      "USCIS is telling you it plans to deny the case unless you answer. This is more serious than a Request for Evidence — the reply is legal work.",
    clericalNextStep:
      "Do not reply alone. Show the notice to a licensed attorney or DOJ-accredited representative right away — the deadline on the notice applies.",
    attorneyReview: true,
  },
  {
    matchPhrases: ["passport", "photo", "biometrics"],
    meaning:
      "USCIS wants a passport, photo, or biometrics item that was missing, expired, or unclear.",
    clericalNextStep:
      "Provide a clear copy of the passport bio page or new passport photos (2x2), exactly as the notice asks.",
    attorneyReview: false,
  },
  {
    matchPhrases: ["address", "employment history", "work history", "residence"],
    meaning:
      "USCIS wants address or work history filled in — a gap in the dates, or a period with nothing listed.",
    clericalNextStep:
      "Fill in the missing dates with your preparer, using the 5-year address and work history from your questionnaire.",
    attorneyReview: false,
  },
];

export const ATTORNEY_REVIEW_NOTICE =
  "A Request for Evidence or Notice of Intent to Deny is legal work. " +
  "Your preparer gathers and organises the documents; a licensed attorney or " +
  "DOJ-accredited representative reviews the response before it is sent. " +
  "Immigration with NIPTEI is a document-preparation service, not a law firm.";

/** Decode notice text (pasted from the RFE / NOID). Returns every
 *  rule whose phrases appear, plus whether any match needs attorney
 *  review. No match -> an honest "not recognised" result, never a
 *  guess. Never logs or stores the notice text. */
export function decodeRfeNotice(noticeText: string): {
  matched: RfeDecodeRule[];
  needsAttorneyReview: boolean;
  recognised: boolean;
  guidance: string;
} {
  const haystack = (noticeText ?? "").toLowerCase();
  const matched = RFE_DECODE_RULES.filter((rule) =>
    rule.matchPhrases.some((phrase) => haystack.includes(phrase.toLowerCase()))
  );
  return {
    matched,
    needsAttorneyReview: matched.some((r) => r.attorneyReview),
    recognised: matched.length > 0,
    guidance:
      matched.length > 0
        ? "The matches below are what the words on the notice usually mean. They are not legal advice, and they do not predict the outcome."
        : "These words are not in our decoder, so we cannot explain them here. Show the full notice to your preparer — and to a licensed attorney or DOJ-accredited representative if it is a Notice of Intent to Deny.",
  };
}

// ---------------------------------------------------------------------------
// Deadline urgency — computed from STORED dates only (the date on the
// notice, the NVC 1-year date, the EAD expiry). Never a live lookup.
// ---------------------------------------------------------------------------
export type DeadlineUrgency = "overdue" | "due_soon" | "upcoming" | "opens_future";

export function deadlineUrgency(
  dueIso: string,
  direction: "due" | "opens",
  todayIso?: string
): DeadlineUrgency {
  const today = todayIso ? new Date(`${todayIso}T00:00:00Z`) : new Date();
  const days = daysUntil(dueIso, today);
  if (direction === "opens") return days <= 0 ? "upcoming" : "opens_future";
  if (days < 0) return "overdue";
  if (days <= 14) return "due_soon";
  return "upcoming";
}

// ---------------------------------------------------------------------------
// NVC / consular — what to submit online to the embassy, per post.
// Reuses the existing NVC engine (lib/nvc.ts): CEAC_STEPS, fees,
// post lookup, K-1 steps. Embassy contact details are NOT invented:
// no embassy email address is stored anywhere in this portal. Each
// post's official page — including its immigrant-visa email address —
// is found through the U.S. Department of State's official embassy
// directory below. NVC's own public contact details are the only
// addresses listed here, and they are labelled as NVC's, not an
// embassy's.
// Sources (verified Nov 28, 2026):
//   * travel.state.gov — National Visa Center page:
//     https://travel.state.gov/content/travel/en/us-visas/immigrate/national-visa-center.html
//   * CEAC immigrant-visa login: https://ceac.state.gov/IV/Login.aspx
//   * DOS fees $120 AOS + $325 IV per applicant (CEAC_FEE_AMOUNTS,
//     lib/nvc.ts) — confirmed against travel.state.gov fee guidance.
// ---------------------------------------------------------------------------
export const NVC_PAGE_URL =
  "https://travel.state.gov/content/travel/en/us-visas/immigrate/national-visa-center.html";

export const USEMBASSY_DIRECTORY_URL = "https://www.usembassy.gov/";

export const NVC_PUBLIC_CONTACT = {
  /** NVC public inquiry email, published by the U.S. Department of
   *  State — confirm on the NVC page linked above. This is NVC's
   *  address, NOT an embassy's. */
  email: "NVCquery@state.gov",
  /** NVC public phone line, published by the U.S. Department of
   *  State — confirm on the NVC page linked above. */
  phone: "1-603-334-0700",
} as const;

export const EMBASSY_CONTACT_NOTE =
  "No embassy email address is stored in this portal — embassy contact details change, " +
  "and a wrong address would send your documents to the wrong place. " +
  "Find your embassy's immigrant-visa email address and mailing address on its official page, " +
  "through the U.S. Department of State embassy directory linked below.";

export const CEAC_PASSWORD_RULE =
  "Never enter your CEAC password in this portal. We never ask for it and never store it. " +
  "You log in to CEAC yourself, on the official CEAC site, with the NVC case number and Invoice ID from your NVC welcome letter.";

export interface ConsularOnlineSubmission {
  id: string;
  /** What to submit online (CEAC), in order. */
  title: string;
  detail: string;
}

export const CONSULAR_ONLINE_SUBMISSIONS: ConsularOnlineSubmission[] = [
  {
    id: "fees",
    title: "1. Pay the DOS fees in CEAC",
    detail:
      "$120 Affidavit of Support (AOS) fee per case + $325 Immigrant Visa (IV) fee per applicant, paid in CEAC from a U.S. bank account. Separate from the clerical prep fee and from USCIS fees.",
  },
  {
    id: "ds260",
    title: "2. Submit Form DS-260 online (each applicant)",
    detail:
      "Online immigrant visa application for each person travelling, submitted in CEAC after the fees are paid. Print the confirmation page for the interview.",
  },
  {
    id: "i864",
    title: "3. Submit Form I-864 + IRS tax transcripts",
    detail:
      "Affidavit of Support with IRS tax transcripts (petitioner; joint sponsor + Form I-864A if household income is below 125% of the HHS Poverty Guidelines).",
  },
  {
    id: "civil-docs",
    title: "4. Upload civil documents to CEAC",
    detail:
      "Birth / marriage / divorce certificates, police clearances from every country lived in 6+ months since age 16, and passport bio pages — scans in CEAC, with certified translations for foreign documents. Bring the originals to the interview.",
  },
  {
    id: "dq-interview",
    title: "5. Documentarily Qualified (DQ) → embassy interview",
    detail:
      "NVC marks the case Documentarily Qualified (DQ), then schedules the embassy interview. Complete the panel-physician medical exam before the interview and keep the sealed medical envelope unopened.",
  },
];

export interface ConsularChecklist {
  post: NvcPost | null;
  postKnown: boolean;
  nvcCaseValid: boolean;
  /** What to submit online to the embassy, in order. */
  submitOnline: ConsularOnlineSubmission[];
  ceacSteps: typeof CEAC_STEPS;
  fees: { aosUsd: number; ivUsdPerApplicant: number };
  ceacLoginUrl: string;
  nvcPageUrl: string;
  embassyDirectoryUrl: string;
  /** Always null — no embassy email is stored. The UI must show
   *  EMBASSY_CONTACT_NOTE + the directory link instead. */
  embassyEmail: null;
  nvcContact: typeof NVC_PUBLIC_CONTACT;
  sources: string[];
}

/** Build the consular checklist for an NVC case number. The case
 *  number is validated by parseNvcCaseNumber (lib/nvc.ts); an
 *  invalid number returns postKnown: false and nvcCaseValid: false,
 *  never a guessed post. K-1 cases use the K-1 steps in lib/nvc.ts
 *  (DS-160 + I-134, no DS-260 / I-864 / CEAC fees) — this checklist
 *  is the I-130 consular (immigrant visa) one. */
export function buildConsularChecklist(nvcCaseNumber: string): ConsularChecklist {
  const parsed = parseNvcCaseNumber(nvcCaseNumber);
  const post = parsed.postCode ? lookupNvcPost(parsed.postCode) : null;
  return {
    post,
    postKnown: post !== null,
    nvcCaseValid: parsed.valid,
    submitOnline: CONSULAR_ONLINE_SUBMISSIONS,
    ceacSteps: CEAC_STEPS,
    fees: { aosUsd: CEAC_FEE_AMOUNTS.aos, ivUsdPerApplicant: CEAC_FEE_AMOUNTS.iv },
    ceacLoginUrl: CEAC_LOGIN_URL,
    nvcPageUrl: NVC_PAGE_URL,
    embassyDirectoryUrl: USEMBASSY_DIRECTORY_URL,
    embassyEmail: null,
    nvcContact: NVC_PUBLIC_CONTACT,
    sources: [
      "travel.state.gov — National Visa Center",
      "CEAC (Consular Electronic Application Center)",
      "lib/nvc.ts — CEAC steps + DOS fees ($120 AOS + $325 IV)",
    ],
  };
}
