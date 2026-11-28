// "More added" — further expert features beyond the 20 differentiators
// (LAST ADDITION, Nov 28, 2026). Founder: "if you have more you can add
// them and do not leave anything behind."
//
// What this file adds (verified against the codebase before building —
// none of these existed as working features on Nov 28, 2026):
//   1. Biometrics appointment TRACKER — the backbone guide
//      (lib/backbone.ts BIOMETRICS_GUIDE) is static text only; it has
//      nowhere to store an appointment date. This adds stored dates +
//      days-until / overdue logic. Dates come only from the client's
//      own I-797C notice, entered manually — never from USCIS.
//   2. Address-change (AR-11) helper — only the locked AR-11 Stripe
//      prices and one daily-news line about the 10-day rule existed.
//      This adds the deadline math + the what-it-updates checklist.
//      The platform NEVER files AR-11 for anyone.
//   3. Emergency "what if" guide — RFE decoding + deadline countdown
//      exist (lib/caseTracking.ts, lib/backbone.ts) but there was no
//      single guide for RFE / lost notice / missed interview / denial,
//      and no I-290B pricing surfaced anywhere. Educational only.
//   4. Sponsor income calculator — the 125% lookup + shortfall math
//      exist (lib/formChecklists.ts sponsorShortfallCheck) but there
//      was no client-facing calculator, and that function's `qualified`
//      boolean reads as a verdict on sufficiency. This wrapper returns
//      NUMBERS ONLY (required, shortfall, asset multiples, joint
//      sponsor side-by-side) and never a pass/fail decision — only
//      USCIS decides sufficiency.
//   5. Document translation tracker — backbone lists which documents
//      need certified translations (NVC_CIVIL_DOCUMENTS) but there was
//      no per-document status or cost. Locked $45/page
//      (addon_translation_page) drives the estimate.
//   6. Payment plan dashboard — payment_plans rows exist (0002) and
//      the locked splitter exists (lib/stripe.ts splitInvoices) but
//      nothing showed a client their plan: installments, next payment,
//      and the exact missed-payment math (50% founder rule, manual
//      handling only — no Stripe setting).
//
// HONESTY RULES (do not weaken):
//   * Document-preparation service, NOT a law firm, NOT affiliated
//     with USCIS / NVC / the State Department. Only a licensed
//     attorney or DOJ-accredited representative gives legal advice
//     (8 CFR 292.1). No AI decides relief / eligibility / evidence
//     strength / safe-to-leave. Nothing here promises or implies an
//     approval.
//   * All figures come from locked data already in the codebase
//     (2026 I-864P 125% table, $45/page translation, I-290B
//     $599 / $750 / $899, bundle totals, 50% missed-payment rule).
//     Government figures change — every figure says to confirm the
//     current figure before acting.
//   * No DOB, A-Number, SSN, or passport number is handled here.
//     Receipt numbers stay masked (lib/caseTracking.ts).
//   * Empty states are honest: no stored date means "unknown", never
//     a guessed date or status.
import { getLockedPriceByKey } from "./stripePrices";
import {
  requiredSponsorIncome,
  sponsorShortfallCheck,
  type SponsorRegion,
} from "./formChecklists";
import { splitInvoices } from "./stripe";
import type { PaymentPlanType } from "./order";

export const MORE_ADDED_NOT_AFFILIATED_NOTICE =
  "Immigration with NIPTEI is a document-preparation service, not a law firm and not affiliated with USCIS, NVC, or the U.S. Department of State. Only a licensed attorney or DOJ-accredited representative gives legal advice (8 CFR 292.1). Nothing here promises or implies an approval.";

// ---------------------------------------------------------------------------
// Shared date helpers — dates are YYYY-MM-DD strings, compared as dates
// only (no invented times). A missing date is always "unknown".
// ---------------------------------------------------------------------------

/** Whole days from `from` to `date` (negative when `date` is past). */
export function daysBetween(from: string, date: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${date}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Add `n` days to a YYYY-MM-DD date, returning YYYY-MM-DD. */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Today in the caller's timezone as YYYY-MM-DD (pass explicitly so the
 *  function is testable and never reads the clock inside a component). */
export function todayIso(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// 1. Biometrics appointment tracker
//    Stored rows live in public.biometrics_appointments (migration 0030).
//    The appointment date, ASC location, and notice-received date are
//    entered manually from the client's own I-797C notice.
// ---------------------------------------------------------------------------

export type BiometricsStatus = "scheduled" | "attended" | "missed" | "rescheduled";

export interface BiometricsAppointment {
  id: string;
  caseId: string;
  /** Date on the I-797C notice, YYYY-MM-DD. */
  appointmentDate: string;
  /** Application Support Center from the notice (free text, as printed). */
  ascLocation: string;
  /** Date the notice itself arrived, YYYY-MM-DD, or null if not recorded. */
  noticeReceivedAt: string | null;
  status: BiometricsStatus;
  /** Previous date when this appointment was rescheduled, if any. */
  rescheduledFromDate: string | null;
}

export type BiometricsState =
  | "upcoming"
  | "today"
  | "overdue-unconfirmed"
  | "attended"
  | "missed"
  | "rescheduled";

export interface BiometricsTrackerView {
  appointment: BiometricsAppointment;
  daysUntil: number;
  state: BiometricsState;
  headline: string;
  /** What to do next — plain steps, never a legal conclusion. */
  nextSteps: string[];
}

/**
 * Tracker view from a STORED appointment only. A past date with status
 * still "scheduled" is "overdue — unconfirmed": the platform never
 * assumes the client attended or missed it — only the client (or a
 * status check) can say so.
 */
export function biometricsTrackerView(
  appointment: BiometricsAppointment,
  today: string
): BiometricsTrackerView {
  const daysUntil = daysBetween(today, appointment.appointmentDate);
  if (appointment.status === "attended") {
    return {
      appointment,
      daysUntil,
      state: "attended",
      headline: "Biometrics done — the case goes back into review. Nothing is decided at the appointment.",
      nextSteps: [
        "Keep the stamped notice / receipt from the appointment with the case file.",
        "Watch for the next USCIS notice — review, RFE, interview, or decision.",
      ],
    };
  }
  if (appointment.status === "missed") {
    return {
      appointment,
      daysUntil,
      state: "missed",
      headline: "Missed biometrics appointment — contact USCIS right away using the number on the notice.",
      nextSteps: [
        "Call the number printed on the appointment notice — do not wait for a second letter.",
        "Tell your preparer at once so the case file notes the missed date.",
        "A missed biometrics appointment can delay the case and put it at risk — ask USCIS for a new date.",
      ],
    };
  }
  if (appointment.status === "rescheduled") {
    return {
      appointment,
      daysUntil,
      state: "rescheduled",
      headline:
        daysUntil >= 0
          ? `Rescheduled — new date is in ${daysUntil} day${daysUntil === 1 ? "" : "s"}.`
          : "Rescheduled date has passed — confirm with USCIS whether a new date was set.",
      nextSteps: [
        "Bring the new I-797C notice and a photo ID to the new date.",
        "If no new notice arrived, call the number on the old notice.",
      ],
    };
  }
  if (daysUntil < 0) {
    return {
      appointment,
      daysUntil,
      state: "overdue-unconfirmed",
      headline: `Appointment date (${appointment.appointmentDate}) has passed and no outcome is recorded — the platform does not guess whether it was attended or missed.`,
      nextSteps: [
        "Confirm what happened: check for a stamped notice, or call the number on the I-797C notice.",
        "Update the stored status to attended or missed so the tracker is true.",
        "If it was missed, contact USCIS right away — a missed biometrics appointment can put the case at risk.",
      ],
    };
  }
  if (daysUntil === 0) {
    return {
      appointment,
      daysUntil,
      state: "today",
      headline: "Biometrics appointment is today.",
      nextSteps: [
        "Bring the I-797C appointment notice and a photo ID.",
        "Go to the ASC on the notice — fingerprints, a photo, and a signature. The appointment itself is short.",
      ],
    };
  }
  return {
    appointment,
    daysUntil,
    state: "upcoming",
    headline: `Biometrics appointment in ${daysUntil} day${daysUntil === 1 ? "" : "s"} — ${appointment.appointmentDate}.`,
    nextSteps: [
      "Bring the I-797C appointment notice and a photo ID.",
      "If you cannot go on that date, follow the rescheduling instructions on the notice itself and tell your preparer at once.",
    ],
  };
}

/** What to bring — reuses the backbone guide wording, not a new list. */
export const BIOMETRICS_TRACKER_BRING: string[] = [
  "The biometrics appointment notice (Form I-797C) — the letter with the date, time, and place.",
  "A photo ID.",
];

// ---------------------------------------------------------------------------
// 2. Address-change (AR-11) helper
//    The platform NEVER files Form AR-11. The client files it themself
//    (online at uscis.gov or by paper) and records here that they did.
//    Stored rows live in public.address_changes (migration 0030). Only
//    city / state / ZIP are stored — never a full street address.
// ---------------------------------------------------------------------------

export const AR11_DEADLINE_DAYS = 10;

export const AR11_RULE =
  "USCIS asks you to report a change of address within 10 days of moving, using Form AR-11.";

export const AR11_NEVER_FILES_NOTICE =
  "Immigration with NIPTEI never files Form AR-11 for you. You file it yourself at uscis.gov (or by paper form). This helper only counts the 10 days and lists what else needs the new address — it does not send anything to USCIS, NVC, or anyone else.";

/** The 10-day deadline for a move date (YYYY-MM-DD in, YYYY-MM-DD out). */
export function ar11Deadline(moveDate: string): string {
  return addDays(moveDate, AR11_DEADLINE_DAYS);
}

export interface Ar11ChecklistItem {
  id: string;
  label: string;
  detail: string;
}

export const AR11_CHECKLIST: Ar11ChecklistItem[] = [
  {
    id: "uscis-ar11",
    label: "File Form AR-11 with USCIS — within 10 days of moving",
    detail:
      "You file it yourself at uscis.gov (or by paper). A letter sent to an old address can still count as delivered, and a missed deadline can delay or close a case.",
  },
  {
    id: "nvc-ceac",
    label: "Update the address with NVC / CEAC (consular cases)",
    detail:
      "If the case is with the National Visa Center, update the mailing address there too — interview notices and document requests go to the address on file.",
  },
  {
    id: "platform-profile",
    label: "Update the address on your platform profile",
    detail: "So the preparer and any mailed packet go to the right place.",
  },
  {
    id: "tell-preparer",
    label: "Tell your preparer the same day you move",
    detail: "So nothing is mailed to the old address while the USCIS update is in transit.",
  },
  {
    id: "check-notices",
    label: "Check for notices sent to the old address",
    detail:
      "Biometrics appointments, interview notices, and Requests for Evidence are time-sensitive. If a notice went to the old address, tell your preparer at once.",
  },
];

export type Ar11Urgency = "ok" | "due-soon" | "overdue" | "unknown";

export interface Ar11View {
  moveDate: string;
  deadline: string;
  daysLeft: number;
  urgency: Ar11Urgency;
  headline: string;
}

export function ar11View(moveDate: string, today: string): Ar11View {
  const deadline = ar11Deadline(moveDate);
  const daysLeft = daysBetween(today, deadline);
  const urgency: Ar11Urgency = daysLeft < 0 ? "overdue" : daysLeft <= 3 ? "due-soon" : "ok";
  return {
    moveDate,
    deadline,
    daysLeft,
    urgency,
    headline:
      daysLeft < 0
        ? `The 10-day AR-11 deadline (${deadline}) has passed — file Form AR-11 yourself right away and tell your preparer.`
        : daysLeft === 0
          ? "Today is the 10th day — file Form AR-11 yourself today."
          : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left to file Form AR-11 (deadline ${deadline}).`,
  };
}

// ---------------------------------------------------------------------------
// 3. Emergency "what if" guide — educational only, never legal advice.
//    Every scenario ends with "ask a licensed attorney or DOJ-accredited
//    representative". I-290B prices are the LOCKED Stripe prices
//    (i-290b_basic $599 / standard $750 / premium $899) — read from
//    stripePrices, never re-typed here.
// ---------------------------------------------------------------------------

export type EmergencyScenarioId = "rfe" | "lost-notice" | "missed-interview" | "denied";

export interface EmergencyScenario {
  id: EmergencyScenarioId;
  title: string;
  whatHappened: string;
  doNow: string[];
  doNot: string[];
  deadlineSource: string;
  attorneyNote: string;
}

const ATTORNEY_EVERYWHERE =
  "Ask a licensed attorney or DOJ-accredited representative before you act — this guide is general information, not legal advice, and only they can advise on your case.";

export const EMERGENCY_GUIDE_INTRO =
  "Something went wrong with a case. This guide says what each situation usually means and what to do first. It is general information only — not legal advice. Deadlines in immigration are real and short: when in doubt, ask a licensed attorney or DOJ-accredited representative right away, and tell your preparer the same day.";

function i290bPriceCents(tier: "basic" | "standard" | "premium"): number {
  const price = getLockedPriceByKey(`i-290b_${tier}`);
  if (!price) throw new Error(`Locked I-290B ${tier} price is missing from stripePrices.ts — do not guess it.`);
  return price.amountCents;
}

export function i290bLockedPrices(): { basic: number; standard: number; premium: number } {
  return {
    basic: i290bPriceCents("basic"),
    standard: i290bPriceCents("standard"),
    premium: i290bPriceCents("premium"),
  };
}

export const EMERGENCY_GUIDE: EmergencyScenario[] = [
  {
    id: "rfe",
    title: "An RFE arrived (Request for Evidence)",
    whatHappened:
      "USCIS is asking for more evidence before it decides. An RFE is not a denial — but the reply deadline on the notice is a hard deadline.",
    doNow: [
      "Read the whole notice — it lists exactly what USCIS wants and the date the reply must reach USCIS.",
      "Use the RFE / NOID decoder and deadline countdown on the Backbone page to work out the days left from the notice date and the response window printed on the notice.",
      "Gather only what the notice asks for, and send the reply so USCIS receives it by the deadline — not just mailed by it.",
    ],
    doNot: [
      "Do not send extra documents USCIS did not ask for.",
      "Do not miss the deadline — a late or missing reply can lead to a denial.",
      "Do not guess what evidence is strong enough — that is a legal question.",
    ],
    deadlineSource: "The response window printed on the RFE notice itself (counted from the notice date).",
    attorneyNote: ATTORNEY_EVERYWHERE,
  },
  {
    id: "lost-notice",
    title: "A USCIS notice was lost or never arrived",
    whatHappened:
      "USCIS and NVC send time-sensitive letters — biometrics appointments, interview notices, RFEs — to the address on file. A letter sent to the old address can still count as delivered.",
    doNow: [
      "Check the case status online with the receipt number (masked in this portal — never share the full number by email).",
      "If the address on file is old, file Form AR-11 yourself right away (see the AR-11 helper — 10-day rule) and tell your preparer.",
      "Ask your preparer to check whether a notice was issued and what deadline it carries.",
    ],
    doNot: [
      "Do not assume no news is good news — a missed notice can still carry a deadline.",
      "Do not wait for a second letter before checking.",
    ],
    deadlineSource: "Whatever deadline the missing notice itself carries — find it from the case status check or your preparer, never assume one.",
    attorneyNote: ATTORNEY_EVERYWHERE,
  },
  {
    id: "missed-interview",
    title: "An interview was missed",
    whatHappened:
      "Missing a USCIS or embassy interview can delay the case, and in some cases the case can be denied or closed. What happens next depends on the form and the notice — it is not the same for every case.",
    doNow: [
      "Contact USCIS (or the embassy / NVC for a consular interview) right away using the contact on the interview notice.",
      "Tell your preparer the same day — they need the interview date and the notice details.",
      "Ask in writing for a new interview date and keep a copy of everything you send.",
    ],
    doNot: [
      "Do not wait for USCIS or the embassy to contact you first.",
      "Do not re-file on your own to 'start over' — that can make things worse.",
    ],
    deadlineSource: "The interview notice and any follow-up letter — both may carry a deadline to respond.",
    attorneyNote: ATTORNEY_EVERYWHERE,
  },
  {
    id: "denied",
    title: "A case was denied",
    whatHappened:
      "USCIS (or the embassy) said no. A denial is not always the end — depending on the case there may be an appeal or a motion to reopen / reconsider on Form I-290B, or a new filing. Which option exists, and its deadline, depends on the denial notice itself.",
    doNow: [
      "Read the denial notice in full — it states whether an appeal or motion is available and the deadline (often 30 days, but the notice controls).",
      "Show the denial notice to a licensed attorney or DOJ-accredited representative right away — deadlines apply and the choice between appeal, motion, and re-filing is legal advice.",
      "Do not re-file on your own while an appeal or motion deadline is running.",
      "If an attorney advises filing Form I-290B, the locked document-preparation prices are Basic $599, Standard $750, Premium $899 — preparation only, never the legal decision to file.",
    ],
    doNot: [
      "Do not re-file on your own.",
      "Do not miss the deadline on the denial notice — a late I-290B can be rejected.",
      "Do not treat this guide as advice that an appeal or motion will work — only an attorney or DOJ-accredited representative can advise that.",
    ],
    deadlineSource: "The deadline printed on the denial notice itself (often 30 days from the decision — the notice controls, never this guide).",
    attorneyNote:
      "A denial is legal work. Show the denial notice to a licensed attorney or DOJ-accredited representative right away — before any deadline passes. This guide never advises whether to appeal, file a motion, or re-file.",
  },
];

export function emergencyScenario(id: EmergencyScenarioId): EmergencyScenario {
  const found = EMERGENCY_GUIDE.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown emergency scenario: ${id}`);
  return found;
}

// ---------------------------------------------------------------------------
// 4. Sponsor income calculator — numbers only, never a decision.
//    Wraps the locked 2026 I-864P 125% table (lib/formChecklists.ts
//    requiredSponsorIncome / sponsorShortfallCheck) and presents the
//    figures side by side for the petitioner and, if given, a joint
//    sponsor. The `qualified` verdict from sponsorShortfallCheck is
//    DELIBERATELY not returned: only USCIS decides sufficiency.
// ---------------------------------------------------------------------------

export type { SponsorRegion };

export interface SponsorCalculatorInput {
  householdSize: number;
  region: SponsorRegion;
  /** Active-duty military petitioner: 100% column instead of 125%. */
  military: boolean;
  /** Annual household income in dollars. */
  income: number;
  /** Assets in dollars (only counted as the notice allows). */
  assets: number;
  /** Spouse or minor child of a U.S. citizen: assets count at 3x, else 5x. */
  isSpouseOrMinorChildOfUSC: boolean;
  /** Joint sponsor, if any — judged on THEIR OWN household, never combined. */
  jointSponsor?: {
    householdSize: number;
    region: SponsorRegion;
    military: boolean;
    income: number;
    assets: number;
    isSpouseOrMinorChildOfUSC: boolean;
  } | null;
}

export interface SponsorFigureSet {
  required: number;
  income: number;
  shortfall: number;
  /** Asset multiple: 3 for spouse / minor child of a U.S. citizen, else 5. */
  multiplier: number;
  assetsNeeded: number;
  assets: number;
  assetsCoverShortfall: boolean;
  /** Plain reading of the arithmetic — not a verdict. */
  reading: string;
}

export interface SponsorCalculatorResult {
  petitioner: SponsorFigureSet;
  jointSponsor: SponsorFigureSet | null;
  sourceNote: string;
  notADecision: string;
}

export const SPONSOR_CALCULATOR_NOT_A_DECISION =
  "This calculator shows arithmetic only: the locked 2026 I-864P 125% figure for the household size, the shortfall, and the asset multiple (3x for a spouse or minor child of a U.S. citizen, 5x otherwise). It does NOT decide whether income or assets are sufficient — only USCIS decides that. Figures change every year: confirm the current Form I-864P at uscis.gov before you file.";

function figureSet(args: {
  householdSize: number;
  region: SponsorRegion;
  military: boolean;
  income: number;
  assets: number;
  isSpouseOrMinorChildOfUSC: boolean;
  label: string;
}): SponsorFigureSet {
  // Numbers only — sponsorShortfallCheck's `qualified` / `nextStep`
  // verdict is intentionally not used.
  const check = sponsorShortfallCheck(args);
  const required = requiredSponsorIncome(args.householdSize, args.region, args.military);
  const assetsCoverShortfall = check.shortfall === 0 || args.assets >= check.assetsNeeded;
  const reading =
    check.shortfall === 0
      ? `${args.label} income of $${args.income.toLocaleString("en-US")} meets the 125% figure of $${required.toLocaleString("en-US")} on the numbers alone.`
      : `${args.label} income of $${args.income.toLocaleString("en-US")} is $${check.shortfall.toLocaleString("en-US")} below the 125% figure of $${required.toLocaleString("en-US")}. At the ${check.multiplier}x asset multiple, $${check.assetsNeeded.toLocaleString("en-US")} in assets would be needed to cover that shortfall on the numbers alone — this is arithmetic, not a decision.`;
  return {
    required,
    income: args.income,
    shortfall: check.shortfall,
    multiplier: check.multiplier,
    assetsNeeded: check.assetsNeeded,
    assets: args.assets,
    assetsCoverShortfall,
    reading,
  };
}

export function sponsorCalculator(input: SponsorCalculatorInput): SponsorCalculatorResult {
  return {
    petitioner: figureSet({ ...input, label: "Petitioner" }),
    jointSponsor: input.jointSponsor
      ? figureSet({ ...input.jointSponsor, label: "Joint sponsor" })
      : null,
    sourceNote:
      "Source: locked 2026 USCIS Form I-864P, effective March 1, 2026 (lib/formChecklists.ts SPONSOR_125_2026). Household sizes 2–8 by exact table lookup; above 8 adds the per-extra-person amount. Active-duty military uses the 100% column.",
    notADecision: SPONSOR_CALCULATOR_NOT_A_DECISION,
  };
}

// ---------------------------------------------------------------------------
// 5. Document translation tracker
//    Which documents need a certified translation (from the backbone
//    NVC_CIVIL_DOCUMENTS list), per-document status, and the locked
//    $45/page price (addon_translation_page). Stored rows live in
//    public.document_translations (migration 0030).
// ---------------------------------------------------------------------------

export const TRANSLATION_PRICE_PER_PAGE_CENTS: number = (() => {
  const price = getLockedPriceByKey("addon_translation_page");
  if (!price) throw new Error("Locked translation price (addon_translation_page) is missing from stripePrices.ts — do not guess it.");
  return price.amountCents;
})();

/** Civil documents that CAN need a certified translation. Passport bio
 *  pages, photos, and the DS-260 confirmation page do not — they are
 *  listed here as not needing one so the tracker is explicit. */
export const TRANSLATION_DOCUMENT_TYPES: {
  id: string;
  document: string;
  needsTranslation: boolean;
  note: string;
}[] = [
  { id: "birth", document: "Birth certificate", needsTranslation: true, note: "If it is not in English, a certified English translation with a Certificate of Translation Accuracy is needed." },
  { id: "marriage", document: "Marriage certificate", needsTranslation: true, note: "Certified translation if it is not in English." },
  { id: "divorce-death", document: "Divorce decree / death certificate", needsTranslation: true, note: "For every prior marriage — certified translation if not in English." },
  { id: "police", document: "Police certificate", needsTranslation: true, note: "From every country lived in 6+ months since age 16 — certified translation if not in English." },
  { id: "other", document: "Other foreign-language document", needsTranslation: true, note: "Any document not in English needs a certified English translation before USCIS / NVC." },
  { id: "passport", document: "Passport bio page", needsTranslation: false, note: "No translation — the bio page is accepted as issued. Keep the passport valid 6+ months beyond entry." },
  { id: "photos", document: "Photographs (2x2)", needsTranslation: false, note: "No translation — photos only." },
  { id: "ds260-confirmation", document: "DS-260 confirmation page", needsTranslation: false, note: "No translation — printed from CEAC." },
];

export type TranslationStatus = "needed" | "in-progress" | "done" | "not-needed";

export interface TranslationItem {
  documentType: string;
  /** Page count as entered by the client/preparer (0 = not counted yet). */
  pages: number;
  status: TranslationStatus;
}

export interface TranslationEstimateRow {
  documentType: string;
  document: string;
  pages: number;
  status: TranslationStatus;
  costCents: number;
}

export interface TranslationEstimate {
  rows: TranslationEstimateRow[];
  totalPages: number;
  totalCents: number;
  pricePerPageCents: number;
  note: string;
}

export function translationEstimate(items: TranslationItem[]): TranslationEstimate {
  const rows: TranslationEstimateRow[] = items.map((item) => {
    const type = TRANSLATION_DOCUMENT_TYPES.find((t) => t.id === item.documentType);
    const billable = item.status === "not-needed" ? 0 : item.pages;
    return {
      documentType: item.documentType,
      document: type ? type.document : item.documentType,
      pages: item.pages,
      status: item.status,
      costCents: billable * TRANSLATION_PRICE_PER_PAGE_CENTS,
    };
  });
  return {
    rows,
    totalPages: rows.reduce((sum, r) => sum + (r.status === "not-needed" ? 0 : r.pages), 0),
    totalCents: rows.reduce((sum, r) => sum + r.costCents, 0),
    pricePerPageCents: TRANSLATION_PRICE_PER_PAGE_CENTS,
    note: "Certified translation — $45 per page (locked price). Pages are counted as entered; a document with 0 pages has no cost yet because its page count is unknown — never guessed. Translations already marked done are still shown with their cost so the total stays honest.",
  };
}

// ---------------------------------------------------------------------------
// 6. Payment plan dashboard — from REAL payment_plans rows (0002) +
//    the locked splitter (lib/stripe.ts splitInvoices). Pay in 3 /
//    Monthly 6 / Monthly 12 are the locked plans (LOCKED_PAYMENT_PLANS).
//    The 50% missed-payment rule is a FOUNDER rule, manual handling
//    only — there is NO Stripe setting for it, so the dashboard shows
//    the math and says so.
// ---------------------------------------------------------------------------

export interface PaymentPlanRecord {
  id: string;
  caseId: string;
  totalServiceFeeCents: number;
  /** Stored pay_choice spelling: 'all_at_once' or 'installments_3'. */
  payChoice: string;
  installmentAmountsCents: number[];
  paidCents: number;
  missedPaymentPenaltyPercent: number;
  status: string;
}

export interface PaymentPlanInstallmentView {
  label: string;
  amountCents: number;
  /** Due date, or null when no plan start date is stored — never guessed. */
  dueDate: string | null;
  paidCents: number;
  unpaidCents: number;
  state: "paid" | "due-next" | "upcoming" | "missed";
  /** 50% penalty on the UNPAID part of a missed installment, or 0. */
  penaltyCents: number;
  /** Unpaid part + penalty — what is now due for this installment. */
  nowDueCents: number;
}

export interface PaymentPlanDashboard {
  plan: PaymentPlanType;
  planLabel: string;
  totalCents: number;
  paidCents: number;
  remainingCents: number;
  installments: PaymentPlanInstallmentView[];
  nextPayment: PaymentPlanInstallmentView | null;
  missedTotalCents: number;
  missedPenaltyCents: number;
  missedNowDueCents: number;
  missedRule: string;
  datesKnown: boolean;
}

export const MISSED_PAYMENT_RULE =
  "Missed-payment rule (founder rule): a missed installment carries a 50% penalty on the unpaid part of that installment. There is NO Stripe setting for this — it is manual handling only, never an automatic charge. The dashboard shows the exact math; nothing here charges a card.";

/**
 * Dashboard from a real payment_plans row. `planStartDate` is the date
 * the FIRST installment was due (from the stored invoice / checkout
 * record). When it is null, amounts are shown but every due date is
 * "unknown" — the dashboard never invents a schedule.
 */
export function paymentPlanDashboard(
  record: PaymentPlanRecord,
  plan: PaymentPlanType,
  planStartDate: string | null,
  today: string
): PaymentPlanDashboard {
  const schedule = splitInvoices(
    record.totalServiceFeeCents,
    plan,
    planStartDate ? new Date(`${planStartDate}T00:00:00Z`) : new Date()
  );
  const penaltyPercent =
    record.missedPaymentPenaltyPercent >= 0 && record.missedPaymentPenaltyPercent <= 100
      ? record.missedPaymentPenaltyPercent
      : 50;
  let paidLeft = record.paidCents;
  let seenFirstUnpaid = false;
  const installments: PaymentPlanInstallmentView[] = schedule.map((s) => {
    const paidHere = Math.min(paidLeft, s.amountCents);
    paidLeft -= paidHere;
    const unpaid = s.amountCents - paidHere;
    const dueDate = planStartDate ? s.dueDate : null;
    const isPastDue = dueDate !== null && unpaid > 0 && daysBetween(today, dueDate) < 0;
    let state: PaymentPlanInstallmentView["state"];
    if (unpaid === 0) state = "paid";
    else if (isPastDue) state = "missed";
    else if (!seenFirstUnpaid) state = "due-next";
    else state = "upcoming";
    if (unpaid > 0 && !seenFirstUnpaid) seenFirstUnpaid = true;
    const penaltyCents = state === "missed" ? Math.round((unpaid * penaltyPercent) / 100) : 0;
    return {
      label: s.label,
      amountCents: s.amountCents,
      dueDate,
      paidCents: paidHere,
      unpaidCents: unpaid,
      state,
      penaltyCents,
      nowDueCents: unpaid + penaltyCents,
    };
  });
  const missed = installments.filter((i) => i.state === "missed");
  const planLabel =
    plan === "full_upfront"
      ? "Pay in Full"
      : plan === "installments_3"
        ? "Pay in 3"
        : plan === "monthly_6"
          ? "Monthly — 6 months"
          : "Monthly — 12 months";
  return {
    plan,
    planLabel,
    totalCents: record.totalServiceFeeCents,
    paidCents: record.paidCents,
    remainingCents: Math.max(0, record.totalServiceFeeCents - record.paidCents),
    installments,
    nextPayment: installments.find((i) => i.state === "due-next" || i.state === "missed") ?? null,
    missedTotalCents: missed.reduce((sum, i) => sum + i.unpaidCents, 0),
    missedPenaltyCents: missed.reduce((sum, i) => sum + i.penaltyCents, 0),
    missedNowDueCents: missed.reduce((sum, i) => sum + i.nowDueCents, 0),
    missedRule: `${MISSED_PAYMENT_RULE} (Penalty on this plan: ${penaltyPercent}%.)`,
    datesKnown: planStartDate !== null,
  };
}
