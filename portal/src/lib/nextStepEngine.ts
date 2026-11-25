// Next Step + Stage + Payment + Communication engine (single source of truth).
// ---------------------------------------------------------------------------
// ONE engine, used by EVERY dashboard (Client, Family, Preparer, Attorney,
// DOJ Nonprofit, supervised Law Student, Company Back-Office). It answers,
// in plain English in the client's language, with the original + English
// side by side:
//   "What you need to do next, by when, and what happens after that."
//
// What this file REUSES (never duplicates):
//   - Payment plans + missed-payment rule: lib/order.ts (MISSED_PAYMENT_RULE,
//     missedPaymentTotal, EXAMPLE_ORDER, formatCents) and lib/stripe.ts
//     (splitInvoices — Pay in Full / Pay in 3 / Monthly 6 / 12 ONLY.
//     There is NO 50/50 plan for immigration bundles.)
//   - NVC / CEAC steps + DOS fees ($120 AOS + $325 IV): lib/nvc.ts
//     (CEAC_STEPS, CEAC_FEE_AMOUNTS, parseUscisReceipt, parseNvcCaseNumber).
//   - Lifecycle stages + plain-English guidance: lib/lifecycle.ts.
//   - Nudge timing (48h): lib/nudges.ts (NUDGE_INTERVAL_HOURS).
//   - Packet audit (weight-based): lib/audit.ts (computePacketReadiness).
//     The colour readiness here is a DIFFERENT, simpler score — derived
//     only from document colours — and is labelled as such wherever shown.
//
// What is NOT live (labelled everywhere this engine is shown):
//   Stripe, Twilio, Resend / AWS SES, Google Translate, live USCIS lookup
//   (Production key NOT built — manual entry + Sandbox only), CEAC (manual
//   only — NVC has no API), carrier APIs, video, calendar, E-Sign provider.
//   No invented prices, people, numbers, or dates as real: every figure
//   below is either a locked value already in lib/fees.ts / lib/nvc.ts /
//   lib/order.ts, or is labelled EXAMPLE / TO BE CONFIRMED.
import { CEAC_FEE_AMOUNTS } from "./nvc";
import {
  MISSED_PAYMENT_RULE,
  formatCents,
  missedPaymentTotal,
  type PaymentPlanType,
} from "./order";
import { splitInvoices } from "./stripe";
import type { DocumentReviewStatus } from "./types";
import type { LanguageCode } from "./i18n";

export { MISSED_PAYMENT_RULE, formatCents, missedPaymentTotal };
export type { PaymentPlanType };

// ---------------------------------------------------------------------------
// Case route — chosen by the Path Finder route (cases.pathfinder_route),
// NEVER guessed. The two flows NEVER mix: an adjustment client never sees
// NVC / CEAC / DS-260 steps, a consular client never sees adjustment steps.
// A professional may switch the route only with a reason, logged to
// audit_log + case_route_changes (migration 0016).
// ---------------------------------------------------------------------------
export type CaseRoute = "inside_us" | "outside_us";

export const ROUTE_LABELS: Record<CaseRoute, string> = {
  inside_us: "Inside the US — Adjustment of Status",
  outside_us: "Outside the US — Consular / NVC Processing",
};

/** Read the route out of cases.pathfinder_route (jsonb). Returns null when
 *  the route was never set — the UI then says so instead of guessing. */
export function parsePathfinderRoute(
  pathfinderRoute: unknown
): CaseRoute | null {
  if (!pathfinderRoute || typeof pathfinderRoute !== "object") return null;
  const r = pathfinderRoute as Record<string, unknown>;
  const raw = String(
    r.route ?? r.location ?? r.where ?? r.processing_route ?? ""
  ).toLowerCase();
  if (raw.includes("inside") || raw.includes("adjustment") || raw === "aos" || raw === "i-485")
    return "inside_us";
  if (raw.includes("outside") || raw.includes("consular") || raw.includes("nvc") || raw === "cp")
    return "outside_us";
  return null;
}

// ---------------------------------------------------------------------------
// Colour-coded document system — ONE palette, used on every checklist.
//   green  Approved
//   amber  Pending Review / In Progress
//   red    Missing / Rejected / Overdue
//   blue   Uploaded — Awaiting Review
//   grey   Not Started
// Packet readiness % is derived from these colours (see colourReadiness).
// ---------------------------------------------------------------------------
export type DocColourStatus =
  | "approved"
  | "pending_review"
  | "in_progress"
  | "missing"
  | "rejected"
  | "overdue"
  | "uploaded_awaiting"
  | "not_started";

export interface DocColour {
  status: DocColourStatus;
  label: string;
  dotClass: string;
  chipClass: string;
  rowClass: string;
}

export const DOC_COLOURS: Record<DocColourStatus, DocColour> = {
  approved: {
    status: "approved",
    label: "Approved",
    dotClass: "bg-green-600",
    chipClass: "bg-green-100 text-green-900 border-green-600",
    rowClass: "border-green-300 bg-green-50",
  },
  pending_review: {
    status: "pending_review",
    label: "Pending Review",
    dotClass: "bg-amber-500",
    chipClass: "bg-amber-100 text-amber-900 border-amber-500",
    rowClass: "border-amber-300 bg-amber-50",
  },
  in_progress: {
    status: "in_progress",
    label: "In Progress",
    dotClass: "bg-amber-500",
    chipClass: "bg-amber-100 text-amber-900 border-amber-500",
    rowClass: "border-amber-300 bg-amber-50",
  },
  missing: {
    status: "missing",
    label: "Missing",
    dotClass: "bg-red-600",
    chipClass: "bg-red-100 text-red-900 border-red-600",
    rowClass: "border-red-300 bg-red-50",
  },
  rejected: {
    status: "rejected",
    label: "Rejected / Retake Needed",
    dotClass: "bg-red-600",
    chipClass: "bg-red-100 text-red-900 border-red-600",
    rowClass: "border-red-300 bg-red-50",
  },
  overdue: {
    status: "overdue",
    label: "Overdue",
    dotClass: "bg-red-600",
    chipClass: "bg-red-100 text-red-900 border-red-600",
    rowClass: "border-red-300 bg-red-50",
  },
  uploaded_awaiting: {
    status: "uploaded_awaiting",
    label: "Uploaded — Awaiting Review",
    dotClass: "bg-blue-600",
    chipClass: "bg-blue-100 text-blue-900 border-blue-500",
    rowClass: "border-blue-300 bg-blue-50",
  },
  not_started: {
    status: "not_started",
    label: "Not Started",
    dotClass: "bg-slate-400",
    chipClass: "bg-slate-100 text-slate-700 border-slate-400",
    rowClass: "border-slate-200 bg-slate-50",
  },
};

/** The legend shown on EVERY checklist — same colours, same words. */
export const DOC_COLOUR_LEGEND: DocColourStatus[] = [
  "approved",
  "pending_review",
  "in_progress",
  "uploaded_awaiting",
  "missing",
  "rejected",
  "overdue",
  "not_started",
];

/** Map the existing documents.review_status enum onto the colour system,
 *  so old rows and new rows colour the same way. */
export function colourForReviewStatus(
  status: DocumentReviewStatus
): DocColourStatus {
  switch (status) {
    case "accepted":
      return "approved";
    case "under_review":
      return "pending_review";
    case "retake_requested":
      return "rejected";
    case "uploaded":
      return "uploaded_awaiting";
  }
}

/** Weight of each colour toward packet readiness (0–1). Approved counts
 *  fully; an upload awaiting review counts half (it exists, it is not
 *  approved yet); in-progress / pending counts a quarter; anything
 *  missing, rejected, overdue or not started counts zero. */
export const COLOUR_WEIGHTS: Record<DocColourStatus, number> = {
  approved: 1,
  uploaded_awaiting: 0.5,
  pending_review: 0.5,
  in_progress: 0.25,
  missing: 0,
  rejected: 0,
  overdue: 0,
  not_started: 0,
};

export interface ColourItem {
  id: string;
  label: string;
  status: DocColourStatus;
  note?: string;
  /** Blocking items must be cleared before filing. */
  blocking?: boolean;
}

/** Packet readiness % derived ONLY from document colours. This is not the
 *  audit-weight score from lib/audit.ts — the label says which one it is. */
export function colourReadiness(items: ColourItem[]): {
  score: number;
  approved: number;
  total: number;
  blockingOpen: ColourItem[];
  readyToFile: boolean;
} {
  const total = items.length;
  const earned = items.reduce((s, i) => s + COLOUR_WEIGHTS[i.status], 0);
  const score = total === 0 ? 0 : Math.round((earned / total) * 100);
  const approved = items.filter((i) => i.status === "approved").length;
  const blockingOpen = items.filter(
    (i) => i.blocking && i.status !== "approved"
  );
  return {
    score,
    approved,
    total,
    blockingOpen,
    readyToFile: score === 100 && blockingOpen.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Bilingual plain English — built-in translations for the Next Step card
// and guides. Google Translate is NOT connected: text in any other
// language falls back to English and says so. Original is always shown
// next to the English translation.
// ---------------------------------------------------------------------------
export type SupportedNextStepLang = "en" | "es" | "ht" | "fr" | "pt";

export function nextStepLang(code: LanguageCode): SupportedNextStepLang {
  return code === "es" || code === "ht" || code === "fr" || code === "pt"
    ? code
    : "en";
}

export interface Bilingual {
  en: string;
  es: string;
  ht: string;
  fr: string;
  pt: string;
}

export const NEXT_STEP_STRINGS: Record<string, Bilingual> = {
  nextStepTitle: {
    en: "What you need to do next",
    es: "Lo que debe hacer ahora",
    ht: "Sa ou bezwen fè apre sa",
    fr: "Ce que vous devez faire ensuite",
    pt: "O que você precisa fazer agora",
  },
  byWhen: {
    en: "By when",
    es: "Para cuándo",
    ht: "Pou kilè",
    fr: "Pour quand",
    pt: "Até quando",
  },
  whatHappensAfter: {
    en: "What happens after that",
    es: "Qué pasa después",
    ht: "Sa k ap pase apre sa",
    fr: "Ce qui se passe ensuite",
    pt: "O que acontece depois",
  },
  nothingNeeded: {
    en: "Nothing needed from you right now — your provider is working on your case. We will message you when it is your turn.",
    es: "No necesita hacer nada ahora — su preparador está trabajando en su caso. Le escribiremos cuando sea su turno.",
    ht: "Ou pa bezwen fè anyen kounye a — moun k ap ede ou la ap travay sou dosye ou a. N ap ekri ou lè se tou pa ou.",
    fr: "Rien à faire pour le moment — votre préparateur travaille sur votre dossier. Nous vous écrirons quand ce sera votre tour.",
    pt: "Nada necessário de você agora — seu preparador está trabalhando no seu caso. Escreveremos quando for a sua vez.",
  },
};

export function tNextStep(
  key: keyof typeof NEXT_STEP_STRINGS,
  lang: LanguageCode
): { original: string; english: string } {
  const l = nextStepLang(lang);
  const s = NEXT_STEP_STRINGS[key];
  return { original: s[l], english: s.en };
}

// ---------------------------------------------------------------------------
// Post-submission stages — USCIS first, then ONE route only.
//   USCIS: Receipt → Biometrics → Review → RFE if any → Approval / Denial
//   Outside US: Approval → NVC → CEAC fees → DS-260 → I-864 + civil docs
//     → DQ → Interview (medical + VAC) → Visa issued → $235 Immigrant Fee
//     → Flight + arrival.
//   Inside US: Receipt → Biometrics → EAD / Advance Parole (if ordered)
//     → Interview if scheduled (or waived) → Approval → Green Card mailed.
// ---------------------------------------------------------------------------
export type UscisStage =
  | "receipt"
  | "biometrics"
  | "review"
  | "rfe"
  | "approval"
  | "denial";

export const USCIS_STAGES: {
  id: UscisStage;
  label: string;
  plainEnglish: string;
}[] = [
  {
    id: "receipt",
    label: "Receipt",
    plainEnglish:
      "USCIS received your packet and gave you a receipt number. Keep that number — it is how you check your case.",
  },
  {
    id: "biometrics",
    label: "Biometrics",
    plainEnglish:
      "USCIS asks you to come in so they can take your fingerprints and photo. Bring the appointment notice and your ID.",
  },
  {
    id: "review",
    label: "Review",
    plainEnglish:
      "USCIS is reviewing your case. Nothing is needed from you unless they write to you.",
  },
  {
    id: "rfe",
    label: "RFE — Request for Evidence (only if USCIS asks)",
    plainEnglish:
      "USCIS needs more proof. There is a deadline on the letter — do not miss it. Your provider will tell you exactly what to send.",
  },
  {
    id: "approval",
    label: "Approval",
    plainEnglish:
      "USCIS approved your petition. What happens next depends on where you are — see your route below.",
  },
  {
    id: "denial",
    label: "Denial",
    plainEnglish:
      "USCIS did not approve your petition. Talk to your provider or an attorney about what can be done next — do not re-file on your own.",
  },
];

export interface RouteStep {
  id: string;
  title: string;
  detail: string;
  /** What the client must bring / do at this step, if anything. */
  needed?: string;
}

export const CONSULAR_STEPS: RouteStep[] = [
  {
    id: "uscis-approval",
    title: "USCIS Approval",
    detail:
      "USCIS approves the petition. The file is transferred to the National Visa Center (NVC).",
  },
  {
    id: "nvc-welcome",
    title: "NVC Welcome Letter — NVC Case # + Invoice ID",
    detail:
      "NVC sends a Welcome Letter with your NVC case number and Invoice ID. Keep the Invoice ID — you need it to log in to CEAC.",
    needed: "NVC case number + Invoice ID from the Welcome Letter.",
  },
  {
    id: "ceac-fees",
    title: "Pay the CEAC fees — $120 AOS + $325 IV",
    detail:
      "Pay in CEAC, AFTER the Welcome Letter and BEFORE the DS-260. $120 Affidavit of Support (AOS) fee per case + $325 Immigrant Visa (IV) fee per applicant. These are U.S. Department of State fees — separate from the prep fee and separate from USCIS fees.",
    needed: "Pay $120 + $325 in CEAC. Never combine government fees with the prep fee.",
  },
  {
    id: "ds260",
    title: "Submit the DS-260",
    detail:
      "The online immigrant visa application for each applicant, submitted in CEAC after the fees are paid.",
    needed: "DS-260 confirmation page (print it).",
  },
  {
    id: "i864-docs",
    title: "Upload I-864 + tax transcripts + civil documents",
    detail:
      "Affidavit of Support (I-864) with IRS tax transcripts, plus birth / marriage / divorce certificates, police clearances, and passport bio pages — uploaded as scans in CEAC.",
    needed: "I-864, IRS transcripts, civil documents + certified translations.",
  },
  {
    id: "dq",
    title: "Documentarily Qualified (DQ)",
    detail:
      "NVC marks the case Documentarily Qualified (DQ). That means NVC has everything it needs, and the embassy interview is next.",
  },
  {
    id: "interview",
    title: "Embassy Interview Scheduled",
    detail:
      "NVC schedules the interview at the embassy. Complete the medical exam with a panel physician BEFORE the interview, and attend the VAC biometrics appointment if one is needed.",
    needed:
      "Interview appointment letter, sealed medical envelope (DO NOT OPEN), original documents binder, DS-260 confirmation page.",
  },
  {
    id: "visa-issued",
    title: "Visa Issued",
    detail:
      "The embassy issues the immigrant visa in your passport. Check that your name, date of birth, and visa dates are correct before you leave the pickup location.",
  },
  {
    id: "immigrant-fee",
    title: "Pay the $235 USCIS Immigrant Fee — BEFORE flying",
    detail:
      "Pay $235 online to USCIS before you fly. USCIS will not make your Green Card until this fee is paid.",
    needed: "Pay $235 USCIS Immigrant Fee before your flight.",
  },
  {
    id: "flight-arrival",
    title: "Flight + Arrival Checklist",
    detail:
      "Fly to the United States, then check the arrival list: passport with visa, sealed medical envelope if you still have it, and the address where USCIS should mail your Green Card.",
    needed: "Passport with visa, sealed envelope, U.S. mailing address.",
  },
];

export const ADJUSTMENT_STEPS: RouteStep[] = [
  {
    id: "receipt",
    title: "USCIS Receipt",
    detail:
      "USCIS received your adjustment packet and gave you a receipt number.",
    needed: "Keep your receipt number.",
  },
  {
    id: "biometrics",
    title: "Biometrics Appointment",
    detail:
      "USCIS asks you to come in so they can take your fingerprints and photo.",
    needed: "Biometrics appointment notice + photo ID.",
  },
  {
    id: "ead-ap",
    title: "Work Permit (EAD) / Travel Document (Advance Parole) — only if ordered",
    detail:
      "If your provider ordered them, USCIS mails your work permit card and, if ordered, your travel document. Do not travel outside the United States without Advance Parole if your case needs it — ask your provider first.",
    needed: "EAD card when it arrives; travel document before any trip abroad.",
  },
  {
    id: "interview",
    title: "Interview — if scheduled (or waived)",
    detail:
      "USCIS may schedule an interview, or may waive it and decide your case without one. If an interview is scheduled, your provider will help you prepare and tell you what to bring.",
    needed: "Interview notice + original documents to bring (your provider lists them).",
  },
  {
    id: "approval",
    title: "Approval",
    detail: "USCIS approves your adjustment of status.",
  },
  {
    id: "green-card",
    title: "Green Card Mailed",
    detail:
      "USCIS mails your Green Card to the address on your case. Tell your provider at once if you move.",
    needed: "A U.S. mailing address where you can receive the card.",
  },
];

/** What an adjustment client does NOT need — shown explicitly so they are
 *  not confused by NVC steps. */
export const ADJUSTMENT_NOT_NEEDED = [
  "No NVC — your case stays with USCIS in the United States.",
  "No CEAC — you do not log in to CEAC.",
  "No DS-260 — that form is only for people outside the United States.",
  "No consular / embassy interview — any interview is with USCIS, if one is scheduled.",
] as const;

// ---------------------------------------------------------------------------
// "When should I pay?" — each government fee at the step where it is
// actually due. Never all at once, never combined with the prep fee.
// Amounts are the locked values from lib/nvc.ts / lib/fees.ts; the USCIS
// petition filing fee is NOT stated as a locked number here because the
// locked list only confirms I-485 Paper $1,440 — other USCIS fees are
// TO BE CONFIRMED on uscis.gov/fees and on the client's own invoice.
// ---------------------------------------------------------------------------
export interface GovFeeDue {
  id: string;
  stepId: string;
  stepTitle: string;
  feeLabel: string;
  amountUsd: number | null; // null = amount not locked; check the invoice / USCIS fee schedule
  payTo: string;
  when: string;
  note: string;
}

export function govFeeTimeline(route: CaseRoute): GovFeeDue[] {
  const uscisFiling: GovFeeDue = {
    id: "uscis-filing",
    stepId: route === "inside_us" ? "receipt" : "uscis-approval",
    stepTitle:
      route === "inside_us" ? "USCIS Receipt (filing)" : "USCIS Approval (petition filed)",
    feeLabel: "USCIS government filing fee",
    amountUsd: null,
    payTo: "U.S. Department of Homeland Security",
    when: "At filing — when the packet is filed with USCIS.",
    note:
      "Amount is on your own invoice and on uscis.gov/fees — it is NOT combined with the prep fee. I-485 Paper $1,440 is the one locked USCIS fee in this build; other USCIS fees are to be confirmed.",
  };
  if (route === "inside_us") {
    return [
      uscisFiling,
      {
        id: "ead-ap",
        stepId: "ead-ap",
        stepTitle: "Work Permit (EAD) / Travel Document",
        feeLabel: "EAD / Advance Parole government fee (only if ordered)",
        amountUsd: null,
        payTo: "U.S. Department of Homeland Security",
        when: "Only if your provider orders an EAD / Advance Parole for you.",
        note: "No separate amount is shown here — your provider confirms it before anything is paid. Do not pay anything extra until your provider confirms it.",
      },
    ];
  }
  return [
    uscisFiling,
    {
      id: "aos-fee",
      stepId: "ceac-fees",
      stepTitle: "Pay the CEAC fees",
      feeLabel: "Affidavit of Support (AOS) fee",
      amountUsd: CEAC_FEE_AMOUNTS.aos, // $120
      payTo: "U.S. Department of State — in CEAC",
      when: "After the NVC Welcome Letter, before the DS-260.",
      note: "Per case. Separate from the prep fee and from USCIS fees.",
    },
    {
      id: "iv-fee",
      stepId: "ceac-fees",
      stepTitle: "Pay the CEAC fees",
      feeLabel: "Immigrant Visa (IV) fee",
      amountUsd: CEAC_FEE_AMOUNTS.iv, // $325
      payTo: "U.S. Department of State — in CEAC",
      when: "After the NVC Welcome Letter, before the DS-260.",
      note: "Per applicant. Separate from the prep fee and from USCIS fees.",
    },
    {
      id: "immigrant-fee",
      stepId: "immigrant-fee",
      stepTitle: "Pay the $235 USCIS Immigrant Fee",
      feeLabel: "USCIS Immigrant Fee",
      amountUsd: 235,
      payTo: "USCIS — paid online",
      when: "After the visa is issued, BEFORE flying.",
      note: "USCIS will not make your Green Card until this fee is paid. Pay it before your flight, not at the airport.",
    },
  ];
}

// ---------------------------------------------------------------------------
// Interview scheduling tracker (consular only) — interview date, embassy,
// medical exam status, VAC appointment, original-documents binder.
// ---------------------------------------------------------------------------
export interface InterviewSchedule {
  interviewDate: string | null; // ISO date or null — never invented
  embassyPost: string | null;
  medicalExamStatus: "NOT SCHEDULED" | "SCHEDULED" | "COMPLETED" | "WAIVED";
  vacDate: string | null;
  vacLocation: string | null;
  binderItems: ColourItem[];
}

// ---------------------------------------------------------------------------
// The Next Step — derived from the case, never hardcoded. Priority:
// overdue payment → overdue / rejected / missing blocking document →
// RFE → biometrics → next open checklist item → ready to sign / filed →
// waiting on USCIS (nothing needed from the client).
// ---------------------------------------------------------------------------
export interface NextStepInput {
  route: CaseRoute | null;
  uscisStage: UscisStage | null;
  /** First unpaid / overdue invoice, if any. */
  overdueInvoice?: { invoiceNumber: string; amountCents: number; dueDate?: string } | null;
  nextUnpaidInvoice?: { invoiceNumber: string; amountCents: number; dueDate?: string } | null;
  blockingItems: ColourItem[];
  rfeDeadline?: string | null;
  biometricsDate?: string | null;
  language: LanguageCode;
}

export interface NextStep {
  kind:
    | "pay_overdue"
    | "fix_document"
    | "rfe"
    | "biometrics"
    | "complete_item"
    | "sign"
    | "wait_uscis"
    | "route_not_set";
  title: string;
  detail: string;
  byWhen: string;
  after: string;
  actor: "client" | "provider";
}

export function deriveNextStep(input: NextStepInput): NextStep {
  const lang = nextStepLang(input.language);
  const nothing = NEXT_STEP_STRINGS.nothingNeeded[lang];
  if (!input.route) {
    return {
      kind: "route_not_set",
      title: "Your provider needs to confirm your route first",
      detail:
        "We need to know whether you are inside the United States (adjustment) or outside the United States (consular / NVC). Your provider sets this from your Path Finder answers.",
      byWhen: "As soon as your provider confirms it",
      after:
        "Once the route is set, this card will show your exact next step and the steps after it.",
      actor: "provider",
    };
  }
  if (input.overdueInvoice) {
    return {
      kind: "pay_overdue",
      title: `Pay overdue invoice ${input.overdueInvoice.invoiceNumber} — ${formatCents(input.overdueInvoice.amountCents)}`,
      detail: `This payment is past due. ${MISSED_PAYMENT_RULE} Ask your provider before the next due date if you think you will miss a payment.`,
      byWhen: input.overdueInvoice.dueDate
        ? `It was due ${input.overdueInvoice.dueDate} — pay it now`
        : "Pay it now",
      after:
        "Once it is paid, document work continues and the next installment becomes due on its own date.",
      actor: "client",
    };
  }
  const blocking = input.blockingItems.find(
    (i) => i.status === "overdue" || i.status === "rejected" || i.status === "missing"
  );
  if (blocking) {
    return {
      kind: "fix_document",
      title: `Fix: ${blocking.label}`,
      detail:
        blocking.note ??
        "This item is blocking your filing. Upload a clear copy or complete it, and your provider will review it.",
      byWhen: "As soon as you can — filing cannot happen until blocking items are cleared",
      after:
        "Once it is approved, your packet readiness goes up and the next blocking item becomes your next step.",
      actor: "client",
    };
  }
  if (input.uscisStage === "rfe") {
    return {
      kind: "rfe",
      title: "Respond to the USCIS Request for Evidence (RFE)",
      detail:
        "USCIS asked for more proof. Your provider will tell you exactly what to send — send only what they list.",
      byWhen: input.rfeDeadline
        ? `By the deadline on the RFE letter: ${input.rfeDeadline}`
        : "By the deadline on the RFE letter — do not miss it",
      after: "USCIS reviews your reply and then decides your case.",
      actor: "client",
    };
  }
  if (input.uscisStage === "biometrics") {
    return {
      kind: "biometrics",
      title: "Go to your biometrics appointment",
      detail:
        "USCIS takes your fingerprints and photo. Bring the appointment notice and your photo ID.",
      byWhen: input.biometricsDate
        ? `On your appointment date: ${input.biometricsDate}`
        : "On the date on your biometrics notice",
      after:
        input.route === "inside_us"
          ? "USCIS continues reviewing your case. If an interview is scheduled, your provider will prepare you for it."
          : "USCIS continues reviewing your case. On approval, your file goes to the National Visa Center (NVC).",
      actor: "client",
    };
  }
  const open = input.blockingItems.find((i) => i.status !== "approved");
  if (open) {
    return {
      kind: "complete_item",
      title: `Next item: ${open.label}`,
      detail:
        open.note ??
        "Complete or upload this item so your provider can review it.",
      byWhen: "Before your packet can be filed",
      after:
        "Your provider reviews it. When every blocking item is approved, your packet is ready to sign and file.",
      actor: "client",
    };
  }
  if (input.uscisStage === "receipt" || input.uscisStage === "review") {
    return {
      kind: "wait_uscis",
      title: "Wait — USCIS has your case now",
      detail: nothing,
      byWhen: "No deadline for you right now",
      after:
        input.route === "inside_us"
          ? "Next: biometrics, then (if ordered) your work permit / travel document, then an interview if one is scheduled — or approval and your Green Card in the mail."
          : "Next: on approval, your file goes to NVC. Then the Welcome Letter, CEAC fees ($120 + $325), DS-260, documents, DQ, and your embassy interview.",
      actor: "provider",
    };
  }
  if (input.uscisStage === "approval") {
    return {
      kind: "wait_uscis",
      title:
        input.route === "inside_us"
          ? "Approved — your Green Card is next"
          : "Approved — your case moves to NVC next",
      detail: nothing,
      byWhen: "No deadline for you right now",
      after:
        input.route === "inside_us"
          ? "USCIS mails your Green Card to the address on your case. Tell your provider at once if you move."
          : "NVC sends a Welcome Letter with your case number and Invoice ID. Do not pay any CEAC fee until that letter arrives.",
      actor: "provider",
    };
  }
  return {
    kind: "sign",
    title: "Review and sign your finished packet",
    detail:
      "Your provider finished your forms. Read them, ask questions, then sign. The final balance must be paid before you can e-sign.",
    byWhen: "Before filing",
    after: "Your packet is filed with USCIS and you get a receipt number.",
    actor: "client",
  };
}

// ---------------------------------------------------------------------------
// Payment centre helpers — reuse the locked plans + split logic.
// Payment arrangement editor offers ONLY: Pay in Full / Pay in 3 /
// Monthly 6 / Monthly 12. No 50/50.
// ---------------------------------------------------------------------------
export const PAYMENT_PLANS: { id: PaymentPlanType; label: string }[] = [
  { id: "full_upfront", label: "Pay in Full" },
  { id: "installments_3", label: "Pay in 3" },
  { id: "monthly_6", label: "Monthly — 6 months" },
  { id: "monthly_12", label: "Monthly — 12 months" },
];

export function planSchedule(
  totalServiceFeeCents: number,
  plan: PaymentPlanType,
  firstDraftDate: Date
) {
  return splitInvoices(totalServiceFeeCents, plan, firstDraftDate);
}

/** Exact missed-payment math for THIS client's plan (50% rule). */
export function missedPaymentMath(totalServiceFeeCents: number): {
  rule: string;
  originalTotal: string;
  penalty: string;
  newTotal: string;
} {
  const penalty = Math.round(totalServiceFeeCents * 0.5);
  return {
    rule: MISSED_PAYMENT_RULE,
    originalTotal: formatCents(totalServiceFeeCents),
    penalty: formatCents(penalty),
    newTotal: formatCents(missedPaymentTotal(totalServiceFeeCents)),
  };
}

/** Past-due nudge (48h, in the client's language, QUEUE ONLY).
 *  Twilio / Resend are NOT connected, so this never claims a send. */
export function pastDueNudgeText(
  invoiceNumber: string,
  amountCents: number,
  lang: LanguageCode
): { original: string; english: string } {
  const amount = formatCents(amountCents);
  const en = `Reminder: invoice ${invoiceNumber} for ${amount} is past due. Please pay it in your portal or write to us before the next due date.`;
  const map: Record<SupportedNextStepLang, string> = {
    en,
    es: `Recordatorio: la factura ${invoiceNumber} por ${amount} está vencida. Páguela en su portal o escríbanos antes de la próxima fecha de vencimiento.`,
    ht: `Rapèl: fakti ${invoiceNumber} pou ${amount} an reta. Tanpri peye li nan pòtal ou a oswa ekri nou anvan pwochen dat limit la.`,
    fr: `Rappel : la facture ${invoiceNumber} de ${amount} est en retard. Veuillez la payer dans votre portail ou nous écrire avant la prochaine échéance.`,
    pt: `Lembrete: a fatura ${invoiceNumber} de ${amount} está vencida. Pague-a no seu portal ou escreva-nos antes da próxima data de vencimento.`,
  };
  const l = nextStepLang(lang);
  return { original: map[l], english: en };
}
