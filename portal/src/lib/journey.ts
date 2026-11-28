// One Case, Whole Journey — Immigration with NIPTEI (Nov 28, 2026)
// Founder-approved standout feature #4.
//
// WHAT ALREADY EXISTED (reused, not rebuilt):
//   * src/lib/lifecycle.ts — the 6-stage lifecycle (1 New Lead → 6 Visa
//     Approved, Travel & Flight Prep / Closed), Stage 5A (USCIS) and
//     5B (NVC, 4 CEAC steps) guidance. Stage 6 ALREADY contains the
//     post-arrival facts this feature extends honestly:
//       - $235 USCIS Immigrant Fee paid at my.uscis.gov BEFORE flying
//       - sealed packet + medical records in carry-on, never opened
//       - Green Card & SSN mailed to the U.S. address, usually 30–90
//         days after entry; tell us if you move during those 90 days
//   * src/lib/interviewPrep.ts — the interview question banks (gated
//     behind the paywall; this file links to them, it does not copy
//     them).
//
// WHAT THIS FILE ADDS: the journey as ONE timeline from the first
// question to the interview, to the green card in hand, to the Social
// Security card arriving after entry — with the post-arrival checklist
// as its final steps. Every step carries:
//   * source — the locked basis in this codebase (a lifecycle stage,
//     a CEAC step, or the interview-prep banks). No step without a
//     source.
//   * dateBasis — "locked_range" (a range already locked in the code,
//     e.g. 30–90 days), "no_date_promised" (no date is given at all),
//     or "client_specific_date" (a date the client themself sets, e.g.
//     their interview date from their own letter — never invented).
// NO USCIS TIMELINES ARE INVENTED: no processing time, no approval
// date, no promised date appears anywhere in this file. The only
// ranges are the ones already locked in lifecycle.ts Stage 6.
// journeyHasNoPromisedDates() proves it: it scans every step for a
// specific calendar date and reports violations.
import {
  LIFECYCLE_STAGES,
  STAGE_5B_GUIDANCE,
  type LifecycleStageId,
} from "./lifecycle";

export type JourneyDateBasis =
  | "locked_range"
  | "no_date_promised"
  | "client_specific_date";

export interface JourneyStep {
  id: string;
  /** Lifecycle stage this step belongs to, or the journey-only steps. */
  stage: LifecycleStageId | "interview" | "post_arrival";
  /** 1-based position in the whole journey. */
  position: number;
  title: string;
  detail: string;
  /** Locked basis — a lifecycle stage, CEAC step, or interview bank.
   *  Every step has one; a step without a source must not be added. */
  source: string;
  dateBasis: JourneyDateBasis;
  /** The locked range text, when dateBasis is "locked_range". */
  lockedRange: string | null;
}

export interface PostArrivalChecklistItem {
  id: string;
  label: string;
  /** Locked basis in lifecycle.ts Stage 6. */
  source: string;
  dateBasis: JourneyDateBasis;
  lockedRange: string | null;
}

const SRC_STAGE = (n: string) =>
  `Locked: src/lib/lifecycle.ts Stage ${n}`;
const SRC_5B = (step: string) =>
  `Locked: src/lib/lifecycle.ts Stage 5B — ${step}`;

export const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: "j-first-question",
    stage: "new_lead",
    position: 1,
    title: "First question — you ask us about immigration help",
    detail:
      "You ask us about help and we record what you need. Nothing has been filed with USCIS yet, and no government case number exists yet.",
    source: SRC_STAGE("1 — New Lead (Inquiry)"),
    dateBasis: "no_date_promised",
    lockedRange: null,
  },
  {
    id: "j-quote",
    stage: "consultation_quote",
    position: 2,
    title: "Consultation and written quote",
    detail:
      "We talk with you and send a written quote. Our preparation service fee and the USCIS government fee are shown separately — never combined.",
    source: SRC_STAGE("2 — Consultation / Quote Sent"),
    dateBasis: "no_date_promised",
    lockedRange: null,
  },
  {
    id: "j-payment",
    stage: "payment_arrangement",
    position: 3,
    title: "Invoice and payment arrangement",
    detail:
      "You accept the quote and we send an invoice on a locked plan only: Pay in Full, Pay in 3, or Monthly 6 / 12 months. Work starts once your first payment is made.",
    source: SRC_STAGE("3 — Payment Arrangement / Invoice Sent"),
    dateBasis: "no_date_promised",
    lockedRange: null,
  },
  {
    id: "j-docs-drafting",
    stage: "active_client",
    position: 4,
    title: "Documents and drafting — your packet is prepared",
    detail:
      "We collect your documents, run the packet audit to 100%, and draft your forms. You read every draft and e-sign only once the balance is paid and the audit is 100%.",
    source: SRC_STAGE("4 — Active Client (Docs & Drafting)"),
    dateBasis: "no_date_promised",
    lockedRange: null,
  },
  {
    id: "j-uscis",
    stage: "submitted_uscis",
    position: 5,
    title: "Filed — at USCIS",
    detail:
      "Your packet has been filed. USCIS sends a receipt notice, calls most people for biometrics, and may send a Request for Evidence (RFE) — an RFE is not a denial, and it has a deadline. Send us every USCIS letter the same day you receive it.",
    source: SRC_STAGE("5A — At USCIS"),
    dateBasis: "no_date_promised",
    lockedRange: null,
  },
  {
    id: "j-nvc",
    stage: "submitted_uscis",
    position: 6,
    title: "Approved by USCIS — at the National Visa Center (NVC)",
    detail:
      "USCIS approved the petition and sent the case to NVC. On CEAC you pay the two NVC fees separately ($120 AOS + $325 IV), submit Form DS-260, and upload Form I-864 with your civil documents. When NVC accepts everything, your case becomes Documentarily Qualified (DQ).",
    source: SRC_5B("Steps 1–4 — CEAC fees, DS-260, I-864 + civil documents, DQ"),
    dateBasis: "no_date_promised",
    lockedRange: null,
  },
  {
    id: "j-interview",
    stage: "interview",
    position: 7,
    title: "The visa interview at the U.S. embassy or consulate",
    detail:
      "NVC schedules the interview and sends the interview letter. Go to the medical exam before the interview, as the letter instructs, and bring the originals of every document you uploaded. Your interview date comes from YOUR interview letter — no date is promised here. Interview preparation question banks are in /interview-prep (paid access).",
    source: `${SRC_5B("Step 4 — wait for DQ & the interview")} + src/lib/interviewPrep.ts question banks`,
    dateBasis: "client_specific_date",
    lockedRange: null,
  },
  {
    id: "j-visa-travel",
    stage: "visa_approved_closed",
    position: 8,
    title: "Visa approved — get ready to travel",
    detail:
      "Your visa was approved. Pay the $235 USCIS Immigrant Fee online at my.uscis.gov BEFORE you fly. Check your passport and visa details before you leave the pickup location, and carry your sealed immigration packet and medical records in your carry-on bag — never in checked luggage, never opened.",
    source: SRC_STAGE("6 — Visa Approved, Travel & Flight Prep / Closed"),
    dateBasis: "no_date_promised",
    lockedRange: null,
  },
  {
    id: "j-entry",
    stage: "visa_approved_closed",
    position: 9,
    title: "You enter the United States",
    detail:
      "Hand the sealed packet to the officer when you arrive, exactly as it was given to you. Your entry starts the final wait below — the Green Card and Social Security card are mailed to your U.S. address.",
    source: SRC_STAGE("6 — Visa Approved, Travel & Flight Prep / Closed"),
    dateBasis: "no_date_promised",
    lockedRange: null,
  },
  {
    id: "j-green-card-ssn",
    stage: "post_arrival",
    position: 10,
    title: "Green Card in hand, Social Security card arriving",
    detail:
      "After you enter the United States, your Green Card and your Social Security Number (SSN) are mailed to your U.S. address, usually 30–90 days after entry. That 30–90 day range is the only timing in this whole journey — it is the range already locked in Stage 6, not a promised date.",
    source: SRC_STAGE("6 — Green Card & SSN mailed 30–90 days after entry"),
    dateBasis: "locked_range",
    lockedRange: "30–90 days after entry",
  },
];

/** Post-arrival checklist (stage 6 of the journey, extended honestly
 *  from lifecycle.ts Stage 6 — nothing here comes from anywhere else). */
export const POST_ARRIVAL_CHECKLIST: PostArrivalChecklistItem[] = [
  {
    id: "pa-immigrant-fee",
    label: "Pay the $235 USCIS Immigrant Fee at my.uscis.gov BEFORE you fly",
    source: SRC_STAGE("6 — $235 USCIS Immigrant Fee BEFORE flying"),
    dateBasis: "no_date_promised",
    lockedRange: null,
  },
  {
    id: "pa-sealed-packet",
    label: "Carry the sealed immigration packet and medical records in your carry-on — never open the sealed packet",
    source: SRC_STAGE("6 — sealed packet + medical records in carry-on"),
    dateBasis: "no_date_promised",
    lockedRange: null,
  },
  {
    id: "pa-green-card",
    label: "Green Card mailed to your U.S. address, usually 30–90 days after entry",
    source: SRC_STAGE("6 — Green Card & SSN mailed 30–90 days after entry"),
    dateBasis: "locked_range",
    lockedRange: "30–90 days after entry",
  },
  {
    id: "pa-ssn",
    label: "Social Security Number (SSN) mailed to your U.S. address, usually 30–90 days after entry",
    source: SRC_STAGE("6 — Green Card & SSN mailed 30–90 days after entry"),
    dateBasis: "locked_range",
    lockedRange: "30–90 days after entry",
  },
  {
    id: "pa-address",
    label: "Make sure the address USCIS has is correct — tell us if you move during those 90 days",
    source: SRC_STAGE("6 — tell us if you move during those 90 days"),
    dateBasis: "locked_range",
    lockedRange: "30–90 days after entry",
  },
  {
    id: "pa-after-90",
    label: "If the Green Card or SSN has not arrived after 90 days, tell us — do not guess a new date",
    source: SRC_STAGE("6 — Green Card & SSN mailed 30–90 days after entry (range ends at 90 days; no later date is promised)"),
    dateBasis: "no_date_promised",
    lockedRange: null,
  },
];

/** The lifecycle stage definitions this journey extends (re-exported
 *  so journey pages read stages and journey from one place). */
export { LIFECYCLE_STAGES, STAGE_5B_GUIDANCE };

export function journeyStep(id: string): JourneyStep | undefined {
  return JOURNEY_STEPS.find((s) => s.id === id);
}

/** True when every step and checklist item carries its locked source.
 *  A journey entry without a source must never be shown. */
export function journeyStepsAllSourced(): boolean {
  return (
    JOURNEY_STEPS.every((s) => s.source.length > 0) &&
    POST_ARRIVAL_CHECKLIST.every((s) => s.source.length > 0)
  );
}

const SPECIFIC_DATE_PATTERN =
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,?\s+\d{4})?\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/i;

/**
 * Prove the journey promises no dates: scan every step and checklist
 * item for a specific calendar date (month + day, ISO date, or
 * MM/DD/YYYY). Locked ranges ("30–90 days after entry") are NOT
 * specific dates and are allowed. Returns the violating step ids —
 * empty means no promised dates.
 */
export function journeyPromisedDateViolations(): string[] {
  const violations: string[] = [];
  for (const s of JOURNEY_STEPS) {
    if (
      SPECIFIC_DATE_PATTERN.test(s.title) ||
      SPECIFIC_DATE_PATTERN.test(s.detail)
    ) {
      violations.push(s.id);
    }
  }
  for (const item of POST_ARRIVAL_CHECKLIST) {
    if (SPECIFIC_DATE_PATTERN.test(item.label)) violations.push(item.id);
  }
  return violations;
}

export function journeyHasNoPromisedDates(): boolean {
  return journeyPromisedDateViolations().length === 0;
}
