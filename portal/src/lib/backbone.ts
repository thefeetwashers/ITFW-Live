// Immigration backbone — USCIS · NVC · Embassy (NINTH ADDITION, Nov 28, 2026).
//
// Founder's brief: "make sure the backbone of immigration that everyone
// need even immigration, USCIS, NVC and the embassy." The platform must
// cover the whole journey in one place. This file is the backbone check:
// for each of the three it states what is covered, what is still a
// manual step, and it FILLS the gaps that are buildable honestly.
//
// WHAT ALREADY EXISTED (reused, never rebuilt):
//   * USCIS receipt + NVC case-number validation, post lookup (BGT is
//     Bogotá, BOG is not), CEAC 6 steps, DOS fees ($120 AOS + $325 IV),
//     post-arrival $235 immigrant fee + 30–90 day window: lib/nvc.ts.
//   * Public USCIS status words + explainer, receipt masking +
//     validation, status-change log, completeness view, RFE / NOID
//     decoder (words -> plain English + clerical steps), deadline
//     urgency, consular online-submission checklist, NVC public
//     contact, "no embassy email stored" rule: lib/caseTracking.ts
//     (EIGHTH ADDITION, Nov 28, 2026 — the parallel case-number
//     tracking builder). This file EXTENDS it, it does not copy it.
//   * Lifecycle stages 1–6 + 5A/5B guidance: lib/lifecycle.ts.
//   * USCIS stages, consular + adjustment route steps:
//     lib/nextStepEngine.ts.
//   * Filing facts (G-1450 / G-1650, one payment per form, no checks):
//     lib/diySubmission.ts + lib/intakeCalculator.ts — consolidated
//     here into one client-facing guide, not re-decided.
//   * Interview prep banks (paywalled): lib/interviewPrep.ts —
//     LINKED to from the backbone page, never copied here.
//
// WHAT THIS FILE ADDS (the gaps found by the backbone check):
//   1. USCIS_FILING_GUIDE — paper vs online, G-1450 / G-1650, one
//      separate fee payment per form, in one place.
//   2. rfeNoidDeadlineCountdown — deadline from the notice date +
//      the response window printed on the notice ONLY. Extends the
//      decoder in lib/caseTracking.ts, which has no countdown.
//   3. BIOMETRICS_GUIDE — what to bring, what happens, reschedule /
//      missed appointment. Previously only one-line mentions.
//   4. decisionNextSteps — approval / denial / RFE mapped to the
//      consular or adjustment route steps already in the codebase.
//   5. NVC_CIVIL_DOCUMENTS + I864_GUIDE + DQ_AND_INTERVIEW —
//      per-document detail and the I-864 income rule behind the
//      summary checklist in lib/caseTracking.ts.
//   6. EMBASSY_POSTS — the embassy directory: one entry per NVC post
//      code with the post's OFFICIAL travel.state.gov interview
//      instructions link, per-post medical + visa-pickup notes, and
//      a contact email ONLY where it was verified on that official
//      page (3 of 12). The other 9 carry no email — the official
//      page link instead, per the brief. This is a deliberate,
//      brief-authorised difference from the eighth addition's
//      "no embassy email stored anywhere" rule: the brief for THIS
//      task asks for the email "only from official guidance already
//      in the codebase or a travel.state.gov source you cite", and
//      each stored email below cites its official PDF + date. The
//      coordinator can reconcile the two rules; nothing here is
//      unverified.
//   7. EMBASSY_WHAT_TO_BRING + MEDICAL_EXAM_GUIDE + TRAVEL_PREP —
//      the embassy visit and the flight home, consolidated with
//      their travel.state.gov sources.
//   8. BACKBONE_COVERAGE — the check itself, as data, so the page
//      and the smoke test render the same truth.
//
// HONESTY RULES (do not weaken):
//   * No live connection to USCIS, NVC, CEAC, or any embassy exists
//     in this build. Statuses are manual entry + public status words
//     (lib/caseTracking.ts) + links out. CEAC is manual only — NVC
//     has no API — and a CEAC password is never asked for or stored.
//   * The platform is a document-preparation service, NOT a law
//     firm, NOT affiliated with USCIS, NVC, the State Department,
//     or any embassy. Only a licensed attorney or DOJ-accredited
//     representative gives legal advice (8 CFR 292.1). No AI decides
//     relief / eligibility / evidence strength / safe-to-leave, and
//     nothing here promises or implies an approval.
//   * Every fee / timeline is from locked data already in the
//     codebase ($120 AOS, $325 IV, $235 immigrant fee, 30–90 days).
//     Government fees change — every fee line says to confirm the
//     current fee at uscis.gov/fees before paying.
//   * Receipt numbers are masked in the UI (lib/caseTracking.ts).
//     No DOB, A-Number, SSN, or passport number is handled here.
import { CEAC_FEE_AMOUNTS, POST_ARRIVAL_WINDOW_DAYS, lookupNvcPost, parseNvcCaseNumber, type NvcPost } from "./nvc";
import { deadlineUrgency, type DeadlineUrgency } from "./caseTracking";
import { ADJUSTMENT_STEPS, CONSULAR_STEPS, USCIS_STAGES, type RouteStep } from "./nextStepEngine";
import { USCIS_FEE_SCHEDULE_URL } from "./fees";
import { CEAC_LOGIN_URL } from "./agency";
import { GOV_FEE_DISCLAIMER } from "./diyFees";
import { daysUntil } from "./shipments";

export { CEAC_FEE_AMOUNTS, CEAC_LOGIN_URL, POST_ARRIVAL_WINDOW_DAYS, USCIS_FEE_SCHEDULE_URL };
export { NVC_PAGE_URL, USEMBASSY_DIRECTORY_URL, NVC_PUBLIC_CONTACT, CEAC_PASSWORD_RULE, EMBASSY_CONTACT_NOTE } from "./caseTracking";
export { USCIS_CASE_STATUS_URL } from "./caseTracking";

// ---------------------------------------------------------------------------
// Standing notices — shown on the backbone page, verbatim.
// ---------------------------------------------------------------------------
export const BACKBONE_NOT_AFFILIATED_NOTICE =
  "Immigration with NIPTEI is a document-preparation service, not a law firm, " +
  "and is not affiliated with USCIS, the National Visa Center, the U.S. Department of State, " +
  "or any U.S. embassy or consulate. Only a licensed attorney or DOJ-accredited representative " +
  "gives legal advice (8 CFR 292.1).";

export const BACKBONE_MANUAL_TRACKING_NOTICE =
  "There is no live connection to USCIS, NVC, CEAC, or any embassy in this build. " +
  "Case status is tracked manually: you check the official government site, then enter " +
  "what it says here. Nothing here is a live government lookup, and nothing here " +
  "promises or implies an approval — only USCIS (or the consulate, for a visa abroad) decides a case.";

export const BACKBONE_NO_ENDORSEMENT_NOTICE =
  "No government agency has adopted or endorsed this platform. Links below go to official " +
  "government pages so you can check the current instructions yourself.";

// ---------------------------------------------------------------------------
// 1. USCIS filing guide — paper vs online, G-1450 / G-1650, one
//    payment per form. Consolidated from lib/diySubmission.ts +
//    lib/intakeCalculator.ts (same facts, one place).
// ---------------------------------------------------------------------------
export interface FilingGuideStep {
  id: string;
  title: string;
  detail: string;
}

export const USCIS_FILING_GUIDE: FilingGuideStep[] = [
  {
    id: "online-or-paper",
    title: "File online or on paper — your form decides",
    detail:
      "Some USCIS forms can be filed in a USCIS online account and paid online; others must be filed on paper. " +
      "Check the form instructions on uscis.gov for your form before you file — do not assume a form can be filed online.",
  },
  {
    id: "one-payment-per-form",
    title: "One separate packet and one separate fee payment per form",
    detail:
      "Each form is its own filing: its own packet and its own USCIS fee payment. Never combine two forms into one packet or pay one fee for two forms.",
  },
  {
    id: "g1450-g1650",
    title: "Paper filing: pay with Form G-1450 or Form G-1650 only",
    detail:
      "Attach Form G-1450 to authorise a credit / debit card charge, or Form G-1650 to authorise an ACH bank debit from a U.S. bank account. " +
      "Do NOT send a personal check or a money order with a paper filing.",
  },
  {
    id: "sign-and-copy",
    title: "Sign the form and keep copies of everything",
    detail:
      "Read every page before you sign — a wrong name, date, or address on a signed form is your mistake to fix. " +
      "Keep a full copy of the signed packet and the fee payment for your file before anything is mailed.",
  },
  {
    id: "mail-to",
    title: "Mail to the address in the form instructions",
    detail:
      "Mail the packet to the address printed in that form's instructions on uscis.gov. Never guess a mailing address — the address depends on the form and on where you live.",
  },
  {
    id: "fees",
    title: "Confirm the fee before you pay",
    detail: GOV_FEE_DISCLAIMER,
  },
];

export const USCIS_FILING_GUIDE_SOURCE =
  "Consolidated from lib/diySubmission.ts + lib/intakeCalculator.ts; fees: uscis.gov/fees.";

// ---------------------------------------------------------------------------
// 2. RFE / NOID deadline countdown — extends decodeRfeNotice
//    (lib/caseTracking.ts), which translates notice WORDS but has no
//    countdown. The deadline is computed ONLY from the notice date +
//    the response window printed on the notice. Either one missing
//    means the deadline is unknown — never guessed.
// ---------------------------------------------------------------------------
export interface RfeNoidDeadline {
  noticeDateIso: string | null;
  responseWindowDays: number | null;
  deadlineIso: string | null;
  daysLeft: number | null;
  urgency: DeadlineUrgency | null;
  deadlineUnknownReason: string | null;
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isValidDateIso(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Deadline countdown for an RFE or NOID notice. Pass the notice
 *  date and the response window EXACTLY as printed on the notice.
 *  todayIso is injectable so tests use a fixed date. */
export function rfeNoidDeadlineCountdown(args: {
  noticeDateIso?: string | null;
  responseWindowDays?: number | null;
  todayIso?: string;
}): RfeNoidDeadline {
  const noticeDateIso = isValidDateIso(args.noticeDateIso) ? args.noticeDateIso : null;
  const windowDays =
    typeof args.responseWindowDays === "number" &&
    Number.isInteger(args.responseWindowDays) &&
    args.responseWindowDays > 0
      ? args.responseWindowDays
      : null;
  if (!noticeDateIso || windowDays === null) {
    return {
      noticeDateIso,
      responseWindowDays: windowDays,
      deadlineIso: null,
      daysLeft: null,
      urgency: null,
      deadlineUnknownReason:
        "The deadline is the date printed on the notice — this decoder never guesses it. " +
        "Enter the notice date and the response window printed on the notice to see the countdown.",
    };
  }
  const deadlineIso = addDaysIso(noticeDateIso, windowDays);
  const today = args.todayIso ? new Date(`${args.todayIso}T00:00:00Z`) : new Date();
  return {
    noticeDateIso,
    responseWindowDays: windowDays,
    deadlineIso,
    daysLeft: daysUntil(deadlineIso, today),
    urgency: deadlineUrgency(deadlineIso, "due", args.todayIso),
    deadlineUnknownReason: null,
  };
}

// ---------------------------------------------------------------------------
// 3. Biometrics guide — what it is, what to bring, what happens,
//    reschedule / missed. Sources: lib/lifecycle.ts Stage 5A +
//    lib/caseTracking.ts PUBLIC_USCIS_STATUSES ("Biometrics
//    Appointment Was Scheduled"). No phone number is invented:
//    rescheduling uses the number printed on the appointment notice.
// ---------------------------------------------------------------------------
export const BIOMETRICS_GUIDE: {
  whatItIs: string;
  bring: string[];
  whatHappens: string;
  reschedule: string;
  missed: string;
  feeNote: string;
} = {
  whatItIs:
    "Biometrics is a routine USCIS step, not a decision: at an Application Support Center (ASC) USCIS takes your fingerprints, a photo, and a signature.",
  bring: [
    "The biometrics appointment notice (Form I-797C) — the letter with the date, time, and place.",
    "A photo ID.",
  ],
  whatHappens:
    "You go to the ASC on the date in the letter. The appointment itself is short. After it, the case goes back into review — nothing is decided at the appointment.",
  reschedule:
    "If you cannot go on that date, follow the rescheduling instructions on the appointment notice itself (it carries the phone number to call) and tell your preparer at once.",
  missed:
    "If you miss the appointment, contact USCIS right away using the number on the notice — the case can be delayed, and a missed biometrics appointment can put the case at risk. Do not wait for a second letter.",
  feeNote:
    "A biometrics fee may apply to your form. Confirm the current fee at uscis.gov/fees before paying — the $30 biometrics figure in the codebase is TO BE CONFIRMED, not a locked fee.",
};

// ---------------------------------------------------------------------------
// 4. Decision steps — approval / denial / RFE mapped to the route
//    steps already in lib/nextStepEngine.ts. A denial is legal
//    work: the notice goes to a licensed attorney or DOJ-accredited
//    representative right away.
// ---------------------------------------------------------------------------
export type DecisionRoute = "consular" | "adjustment";

export function decisionNextSteps(route: DecisionRoute): {
  route: DecisionRoute;
  routeLabel: string;
  stages: { id: string; label: string; plainEnglish: string }[];
  steps: RouteStep[];
  denialNote: string;
} {
  const stages = USCIS_STAGES.map((s) => ({ id: s.id, label: s.label, plainEnglish: s.plainEnglish }));
  if (route === "consular") {
    return {
      route,
      routeLabel: "Consular — the beneficiary is outside the United States",
      stages,
      steps: CONSULAR_STEPS,
      denialNote:
        "If USCIS denies the petition, do not re-file on your own. Show the denial notice to a licensed attorney or DOJ-accredited representative right away — deadlines apply.",
    };
  }
  return {
    route,
    routeLabel: "Adjustment — the applicant is inside the United States",
    stages,
    steps: ADJUSTMENT_STEPS,
    denialNote:
      "If USCIS denies the application, do not re-file on your own. Show the denial notice to a licensed attorney or DOJ-accredited representative right away — deadlines apply.",
  };
}

// ---------------------------------------------------------------------------
// 5. NVC detail — civil documents, I-864, DQ → interview. Extends
//    the summary checklist in lib/caseTracking.ts
//    (CONSULAR_ONLINE_SUBMISSIONS) with the per-document detail.
// ---------------------------------------------------------------------------
export interface NvcCivilDocument {
  id: string;
  document: string;
  who: string;
  note: string;
}

export const NVC_CIVIL_DOCUMENTS: NvcCivilDocument[] = [
  {
    id: "birth",
    document: "Birth certificate",
    who: "Each applicant",
    note: "Original or certified copy. If it is not in English, a certified English translation with a Certificate of Translation Accuracy is needed.",
  },
  {
    id: "marriage",
    document: "Marriage certificate",
    who: "Each applicant who is or was married",
    note: "Original or certified copy, with a certified translation if it is not in English.",
  },
  {
    id: "divorce-death",
    document: "Divorce decree / death certificate for each prior marriage",
    who: "Each applicant with a prior marriage",
    note: "Final divorce decree, death certificate, or annulment papers for EVERY prior marriage — for both the petitioner and the applicant, where the form asks for it.",
  },
  {
    id: "police",
    document: "Police certificate",
    who: "Each applicant age 16 or older",
    note: "From every country where the applicant lived for 6 months or more since age 16. Bring the original to the interview.",
  },
  {
    id: "passport",
    document: "Passport bio page",
    who: "Each applicant",
    note: "Passport valid for six months beyond the intended date of entry into the United States. Check the expiry date before the interview — an expired passport delays the case.",
  },
  {
    id: "photos",
    document: "Two identical color photographs (2x2)",
    who: "Each applicant",
    note: "Meeting the U.S. visa photo requirements. Bring them to the interview even if photos were uploaded to CEAC.",
  },
  {
    id: "translations",
    document: "Certified translations",
    who: "Every foreign-language document",
    note: "Any document not in English needs a certified English translation with a Certificate of Translation Accuracy before USCIS / NVC. (Some embassies accept Spanish originals at the interview — Bogotá is one — but USCIS filings always need the certified English translation.)",
  },
  {
    id: "ds260-confirmation",
    document: "DS-260 confirmation page",
    who: "Each applicant",
    note: "Print it from CEAC after submitting the DS-260. Bring it to the interview.",
  },
];

export const I864_GUIDE: {
  whatItIs: string;
  thresholdNote: string;
  documents: string[];
  jointSponsorNote: string;
  notDecidedHere: string;
} = {
  whatItIs:
    "Form I-864, Affidavit of Support, is the petitioner's promise to support the person coming, so they will not need government help.",
  thresholdNote:
    "The sponsor's household income must meet 125% of the U.S. Department of Health and Human Services (HHS) Poverty Guidelines for the household size.",
  documents: [
    "IRS tax transcripts (most recent years, as CEAC asks for)",
    "W-2s / 1099s",
    "Proof of U.S. citizen or lawful permanent resident status (petitioner)",
    "Pay records, if CEAC asks for them",
  ],
  jointSponsorNote:
    "If the petitioner's household income is below 125% of the HHS Poverty Guidelines, a joint sponsor files their own I-864, and a household member who contributes income files Form I-864A.",
  notDecidedHere:
    "This platform does not decide whether a sponsor's income is enough. If the income is close to the line, or the household size is unclear, ask a licensed attorney or DOJ-accredited representative.",
};

export const DQ_AND_INTERVIEW: {
  whoSchedules: string;
  steps: string[];
  oneYearRule: string;
  failureToAppear: string;
} = {
  whoSchedules:
    "NVC schedules the embassy interview — the applicant does not book it. (K-1 fiancé(e) cases are different: the embassy sends its own instructions after NVC forwards the case — see lib/nvc.ts K1_NVC_STEPS.)",
  steps: [
    "NVC reviews everything uploaded to CEAC. If a document is rejected, fix only that document and re-upload it — do not start over.",
    "When NVC accepts everything, the case becomes Documentarily Qualified (DQ).",
    "NVC then schedules the interview at the U.S. embassy or consulate and sends the interview letter with the date, time, and place.",
    "Complete the panel-physician medical exam BEFORE the interview, as the letter instructs.",
    "Bring the originals of every document uploaded to CEAC to the interview.",
  ],
  oneYearRule:
    "Under INA 203(g), contact NVC at least once a year — if NVC hears nothing for a year, the case can be terminated. (Stored-date countdown: lib/nvc.ts EXAMPLE_DEADLINES, kind nvc_1yr.)",
  failureToAppear:
    "If you cannot appear on the scheduled date, contact the embassy or consulate as soon as possible. If you do not contact them within one year of receiving the interview appointment letter, the case may be terminated and the petition cancelled, and fees paid will not be refunded. (Source: travel.state.gov, Step 11 — Applicant Interview.)",
};

// ---------------------------------------------------------------------------
// 6. Embassy directory — one entry per NVC post code.
//
//    instructionsUrl: the post's OFFICIAL interview instructions on
//    travel.state.gov (page or PDF), verified Nov 28, 2026. Use the
//    verbatim URL returned by the search — never a guessed URL.
//    contactEmail: ONLY where the email appears on that official
//    page (3 of 12). Every other post has contactEmail: null and
//    emailVerified: false — the official page link is shown instead.
//    Medical + pickup notes are from the same official page.
// ---------------------------------------------------------------------------
export interface EmbassyPost {
  nvcCode: string;
  city: string;
  country: string;
  instructionsUrl: string;
  instructionsUpdated: string | null;
  contactEmail: string | null;
  emailVerified: boolean;
  contactNote: string;
  medicalNote: string;
  visaPickupNote: string;
  specialNote: string | null;
}

export const EMBASSY_POSTS: EmbassyPost[] = [
  {
    nvcCode: "PHP",
    city: "Port-au-Prince",
    country: "Haiti",
    instructionsUrl:
      "https://travel.state.gov/content/dam/visas/iv-dv-supplemental/PTP%20-%20Port%20au%20Prince-5-15-2025.pdf",
    instructionsUpdated: "May 15, 2025",
    contactEmail: "Haiti.Visas@gdit-gss.com",
    emailVerified: true,
    contactNote:
      "Email verified Nov 28, 2026 from the post's official instructions PDF (travel.state.gov). Phone on the same page: 1703-249-4685; toll-free 001-800-759-6238.",
    medicalNote:
      "Schedule a medical exam in Haiti with one of the embassy-approved physicians before the interview. Bring the DS-260 confirmation page and your profile registration to the exam.",
    visaPickupNote:
      "Create an online account (register) before the interview — the embassy uses it to return your passport to you after the interview.",
    specialNote:
      "The instructions PDF is filed under code PTP; the NVC case number for this post starts with PHP. Do not use PTP as the NVC post code.",
  },
  {
    nvcCode: "SDO",
    city: "Santo Domingo",
    country: "Dominican Republic",
    instructionsUrl:
      "https://childabduction.state.gov/content/dam/visas/iv-dv-supplemental/SDO-Santo%20Domingo-5-07-2026.pdf",
    instructionsUpdated: "May 7, 2026",
    contactEmail: "DominicanRepublic.Visas@gdit-gss.com",
    emailVerified: true,
    contactNote:
      "Email verified Nov 28, 2026 from the post's official instructions PDF (travel.state.gov). Phone on the same page: (829) 947-6370; in the U.S. 703-988-7087.",
    medicalNote:
      "Medical exam with one of the embassy-accredited panel physicians in Santo Domingo, 2 to 3 weeks before the visa interview.",
    visaPickupNote:
      "Register the appointment online first (free). Schedule a Visa Application Center (VAC) appointment at Sambil Mall in Santo Domingo before the interview — fingerprints and a photo are taken there. The passport is returned by courier.",
    specialNote: null,
  },
  {
    nvcCode: "CDJ",
    city: "Ciudad Juárez",
    country: "Mexico",
    instructionsUrl:
      "https://travel.state.gov/content/dam/visas/iv-dv-supplemental/CDJ-Ciudad-Juarez-8-17-2026.pdf",
    instructionsUpdated: "August 17, 2026",
    contactEmail: null,
    emailVerified: false,
    contactNote:
      "No embassy email was verified on the official instructions page — use the official page link above. The page directs applicants to the consulate's Immigrant Visas Navigator for contact.",
    medicalNote:
      "Medical exam with an authorised clinic in Mexico at least 3 days before the interview. Medical results from any other physician are not accepted.",
    visaPickupNote:
      "Register the appointment online (free) — the consulate uses it to return your passport and visa package by DHL after the interview. Book an Applicant Service Center appointment for photos and fingerprints as part of registration.",
    specialNote:
      "Plan to stay in Ciudad Juárez for a minimum of three business days, possibly longer. There are two separate appearances at the consulate spread over two business days, and the process cannot be changed to fit travel plans. Do not make travel plans to leave Juárez or enter the United States until the process is fully complete.",
  },
  {
    nvcCode: "MNL",
    city: "Manila",
    country: "Philippines",
    instructionsUrl:
      "https://childabduction.state.gov/content/dam/visas/iv-dv-supplemental/MNL-Manila-1-27-2026.pdf",
    instructionsUpdated: "January 27, 2026",
    contactEmail: "supportphilippines@usvisascheduling.com",
    emailVerified: true,
    contactNote:
      "Email verified Nov 28, 2026 from the post's official instructions PDF (travel.state.gov). Phones on the same page: (02) 85488223 and (02) 77928988. Embassy site: ph.usembassy.gov/visas.",
    medicalNote:
      "Medical exam at the panel physician, St. Luke's Medical Center Extension Clinic, two weeks before the interview date.",
    visaPickupNote:
      "Create an online profile at ustraveldocs.com, register your visa delivery address, and schedule a Visa Application Center (VAC) appointment at Parqal Building 8, Level 3, Diosdado Macapagal Blvd, Parañaque, before the interview — photo and fingerprints are taken there. The VAC appointment is required for all applicants with embassy appointments after October 1, 2024; missing it can cancel the interview. Passport is returned by courier (about 5–7 business days — do not book flights until it is back).",
    specialNote:
      "The embassy requires a Philippine police certificate known as a National Bureau of Investigation (NBI) Clearance, valid for one year from the date it was obtained.",
  },
  {
    nvcCode: "BGT",
    city: "Bogotá",
    country: "Colombia",
    instructionsUrl:
      "https://childabduction.state.gov/content/travel/en/us-visas/Supplements/Supplements_by_Post/BGT-Bogota.html",
    instructionsUpdated: null,
    contactEmail: null,
    emailVerified: false,
    contactNote:
      "No embassy email was verified on the official instructions page — use the official page link above.",
    medicalNote:
      "Medical exam in Bogotá with one of the embassy-accredited physicians, as soon as you have the interview date and before the interview. Medical exams have a maximum validity of six months — if they expire before you obtain the visa and travel, you must obtain them again at your own expense.",
    visaPickupNote:
      "Register the appointment online (free) — the embassy uses it to return your passport by courier. You pick it up at a courier office with ID or have it delivered, as you select when you register.",
    specialNote:
      "Bogotá also schedules immigrant visa interviews for residents of Venezuela, Aruba, Bonaire, and Curaçao. Colombian civil documents are accepted in Spanish at the interview without a certified English translation — but USCIS filings still need the certified English translation. FLAG: the Bogotá page states a $275 MRV fee for K (fiancé(e)) visas; the platform's K-1 $265 figure stays TO BE CONFIRMED — do not pay from either number without checking the current fee.",
  },
  {
    nvcCode: "CRS",
    city: "Caracas",
    country: "Venezuela",
    instructionsUrl:
      "https://travel.state.gov/content/travel/en/us-visas/Supplements/Supplements_by_Post/CRS-Caracas.html",
    instructionsUpdated: null,
    contactEmail: null,
    emailVerified: false,
    contactNote:
      "No embassy email was verified on the official instructions page — use the official page link above.",
    medicalNote:
      "Medical exam in Venezuela with one of the embassy-accredited physicians, before the interview. Medical results from other physicians are not accepted.",
    visaPickupNote:
      "Register the appointment online (free) — the embassy uses it to return your passport after the interview.",
    specialNote:
      "Bogotá also schedules immigrant visa interviews for residents of Venezuela — check your interview letter for which post your interview is at, and follow that post's instructions.",
  },
  {
    nvcCode: "PRS",
    city: "Paris",
    country: "France",
    instructionsUrl:
      "https://travel.state.gov/content/dam/visas/iv-dv-supplemental/PRS-Paris-3-26-2026.pdf",
    instructionsUpdated: "March 26, 2026",
    contactEmail: null,
    emailVerified: false,
    contactNote:
      "No embassy email was verified on the official instructions page — use the official page link above. The call centre on the page is open 9:00 a.m. to 5:00 p.m. Monday–Friday, except local and U.S. holidays.",
    medicalNote:
      "Medical exam in Paris, Lisbon, or Ponta Delgada with one of the designated doctors, before the interview. The post's instructions state a fixed fee: €460 for adults, €280 for children under 15 (paid directly to the physician).",
    visaPickupNote:
      "Register the appointment online (free) — the embassy uses it to return your passport after the interview.",
    specialNote:
      "Immigrant visa interviews for residents of both France and Portugal are held at the U.S. Embassy in Paris. Address on the page: 18 avenue Gabriel, 75008 Paris.",
  },
  {
    nvcCode: "PNM",
    city: "Panama City",
    country: "Panama",
    instructionsUrl:
      "https://travel.state.gov/content/travel/en/us-visas/Supplements/Supplements_by_Post/PNM-Panama-City.html",
    instructionsUpdated: null,
    contactEmail: null,
    emailVerified: false,
    contactNote:
      "No embassy email was verified on the official instructions page — use the official page link above. The embassy contacts the applicant by email after receiving the case from NVC, so watch the inbox on the case.",
    medicalNote:
      "Medical exam in Panama City with one of the designated doctors, before the interview. Fees on the page: Centro Medico Paitilla — adults $272.15, children (0–14) $100.00; Hospital Punta Pacifica — $270.00, children (0–14) $70.00 (paid directly to the physician).",
    visaPickupNote:
      "Create a profile on ustraveldocs.com to pick up the passport from the pre-selected pickup location.",
    specialNote:
      "Documents that can change — such as marriage or police certificates — must have been issued within the last year.",
  },
  {
    nvcCode: "PTS",
    city: "Port of Spain",
    country: "Trinidad and Tobago",
    instructionsUrl:
      "https://travel.state.gov/content/travel/en/us-visas/Supplements/Supplements_by_Post/PTS-Port-of-Spain.html",
    instructionsUpdated: null,
    contactEmail: null,
    emailVerified: false,
    contactNote:
      "No embassy email was verified on the official instructions page — use the official page link above.",
    medicalNote:
      "Medical exam in Trinidad and Tobago with one of the designated doctors, before the interview. After the exam the panel physician tells you when to come for Document Review (see below).",
    visaPickupNote:
      "Register the appointment online (free) — the embassy uses it to return your passport after the interview.",
    specialNote:
      "Two visits to the embassy: FIRST, Document Review and biometrics — no appointment needed, visit between 12:30 p.m. and 2:00 p.m. on the same Tuesday or Thursday afternoon as your medical exam (fingerprints, photos, passport check). SECOND, the visa interview on the date NVC scheduled. If Document Review is not complete before the interview, the appointment may need to be rescheduled. Trinidad and Tobago civil documents must be the computerised versions.",
  },
  {
    nvcCode: "SNJ",
    city: "San José",
    country: "Costa Rica",
    instructionsUrl:
      "https://travel.state.gov/content/travel/en/us-visas/Supplements/Supplements_by_Post/SNJ-San-Jose.html",
    instructionsUpdated: null,
    contactEmail: null,
    emailVerified: false,
    contactNote:
      "No embassy email was verified on the official instructions page — use the official page link above.",
    medicalNote:
      "The medical exam in San José can take as many as four appointments — start scheduling right away: blood test, urine test for gonorrhea, chest X-ray, then the physical exam with an approved doctor. Fees on the page: blood test $11.00, urine test $60.00, X-ray $20.00, physical exam $100.00 (paid directly to the physician or clinic).",
    visaPickupNote:
      "Register the appointment online with Cargo Expreso before the interview — the embassy uses it to return your passport after the interview.",
    specialNote:
      "Civil and financial documents requested by the embassy must be uploaded electronically before coming to the interview.",
  },
  {
    nvcCode: "MTL",
    city: "Montreal",
    country: "Canada",
    instructionsUrl:
      "https://childabduction.state.gov/content/dam/visas/iv-dv-supplemental/MTL-Montreal-8-4-2026.pdf",
    instructionsUpdated: "August 4, 2026",
    contactEmail: null,
    emailVerified: false,
    contactNote:
      "No embassy email was verified on the official instructions page — use the official page link above. The page directs applicants to the consulate's Public Inquiry Form for contact.",
    medicalNote:
      "Medical exam in Canada with one of the consulate-approved doctors, before the interview. Medical results may take up to one week — schedule accordingly. Bring the interview appointment letter with the case number, passport or travel document, one additional government-issued ID, and five passport-sized color photographs (taken less than 6 months ago, date-stamped).",
    visaPickupNote:
      "Each visa applicant on the case must separately register the interview appointment online with the free courier service BEFORE the interview.",
    specialNote:
      "Bring the originals of all required documents AND a photocopy of each, and upload them to the online application — the consulate will not upload documents for you. Missing documents can mean being turned away and rescheduled.",
  },
  {
    nvcCode: "LND",
    city: "London",
    country: "United Kingdom",
    instructionsUrl:
      "https://adoptions.state.gov/content/dam/visas/iv-dv-supplemental/LND-London-1-15-2026.pdf",
    instructionsUpdated: "January 15, 2026",
    contactEmail: null,
    emailVerified: false,
    contactNote:
      "No embassy email was verified on the official instructions page — use the official page link above.",
    medicalNote:
      "Medical exam in the United Kingdom with the embassy's designated medical practitioner (Visa Medicals, 4 Bentinck Mansions, London W1U 2ER, tel. 020-7486-7822 — give your case number when you call), at least two weeks before the interview. Fees on the page: adults (15 and older) £400, children 14 and younger £250, paid directly to the physician in cash or by credit card (Visa or MasterCard) only.",
    visaPickupNote:
      "Register a delivery address with the embassy's online service before the interview — the passport is returned to that address.",
    specialNote:
      "Two visits: FIRST, an in-person Document Review at the embassy on the SAME DAY as the medical appointment, after the exam — bring originals and photocopies. SECOND, the visa interview on the date confirmed through the appointment booking service. If you are not documentarily complete at the interview, you will be told to reschedule. Embassy address: 33 Nine Elms Lane, London SW11 7US.",
  },
];

export const EMBASSY_DIRECTORY_SOURCE =
  "U.S. Department of State, travel.state.gov — post interview instructions, verified Nov 28, 2026. " +
  "Emails are shown only where they appear on the post's official instructions page; all other posts link to that page instead.";

/** Look up an embassy post by NVC post code. Unknown codes return
 *  null — never a guessed post. BOG returns null: Bogotá is BGT. */
export function lookupEmbassyPost(code: string | null | undefined): EmbassyPost | null {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  return EMBASSY_POSTS.find((p) => p.nvcCode === upper) ?? null;
}

/** Embassy post for an NVC case number (validated by
 *  parseNvcCaseNumber in lib/nvc.ts). Invalid numbers return
 *  valid: false and embassy: null — never a guessed post. */
export function embassyPostForNvcCase(caseNumber: string): {
  valid: boolean;
  post: NvcPost | null;
  embassy: EmbassyPost | null;
  errors: string[];
} {
  const parsed = parseNvcCaseNumber(caseNumber);
  const post = parsed.postCode ? lookupNvcPost(parsed.postCode) : null;
  const embassy = parsed.postCode ? lookupEmbassyPost(parsed.postCode) : null;
  return { valid: parsed.valid, post, embassy, errors: parsed.errors };
}

/** Consistency guard: every embassy entry must match the NVC post
 *  table in lib/nvc.ts (same code, city, country). The smoke test
 *  asserts this so the two tables cannot drift apart. */
export function embassyPostsMatchNvcPosts(): { ok: boolean; mismatches: string[] } {
  const mismatches: string[] = [];
  for (const e of EMBASSY_POSTS) {
    const nvc = lookupNvcPost(e.nvcCode);
    if (!nvc) mismatches.push(`${e.nvcCode}: not in NVC_POSTS`);
    else if (nvc.city !== e.city || nvc.country !== e.country) {
      mismatches.push(`${e.nvcCode}: city/country differs from NVC_POSTS`);
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

// ---------------------------------------------------------------------------
// 7. What to bring, medical exam, visa pickup, travel prep.
//    Sources: travel.state.gov Step 10 (Prepare for the Interview)
//    + Step 11 (Applicant Interview) + lib/lifecycle.ts Stage 6 +
//    lib/nvc.ts post-arrival. $235 + 30–90 days are locked values
//    already in the codebase, reused here — not re-decided.
// ---------------------------------------------------------------------------
export const INTERVIEW_PREPARE_URL =
  "https://travel.state.gov/content/travel/en/us-visas/immigrate/the-immigrant-visa-process/interview/interview-prepare.html";

export const APPLICANT_INTERVIEW_URL =
  "https://travel.state.gov/content/travel/en/us-visas/immigrate/the-immigrant-visa-process/step-10-prepare-for-the-interview/step-11-applicant-interview.html";

export const EMBASSY_WHAT_TO_BRING: { item: string; detail: string }[] = [
  {
    item: "Interview appointment letter from NVC",
    detail: "The letter with the date, time, and place of the interview.",
  },
  {
    item: "Passport — valid six months beyond intended entry",
    detail: "Unexpired passport for each applicant, valid for six months beyond the intended date of entry into the United States.",
  },
  {
    item: "Two identical color photographs (2x2) per applicant",
    detail: "Meeting the U.S. visa photo requirements.",
  },
  {
    item: "DS-260 confirmation page",
    detail: "Printed from CEAC after submitting the DS-260.",
  },
  {
    item: "Originals of every civil document uploaded to CEAC",
    detail: "Birth / marriage / divorce certificates, police certificates, passport bio pages — originals or certified copies, plus the certified translations. Failure to bring all required documents can delay or deny the visa.",
  },
  {
    item: "Sealed medical envelope (if the physician gave you one)",
    detail: "Bring it sealed — DO NOT OPEN it. Some physicians send results directly to the embassy instead; then there is no envelope to carry.",
  },
  {
    item: "I-864 Affidavit of Support + financial evidence",
    detail: "The sponsor's I-864 with IRS tax transcripts, as uploaded to CEAC — bring the originals.",
  },
];

export const MEDICAL_EXAM_GUIDE: {
  rule: string;
  steps: string[];
  bring: string[];
  sealedEnvelope: string;
  validityNote: string;
} = {
  rule:
    "Every immigrant visa applicant, no matter their age, must have a medical exam before the visa can be issued — and ONLY a physician approved by the U.S. embassy or consulate can do it. Exams by any other physician are not accepted.",
  steps: [
    "Schedule the exam as soon as you receive the interview appointment date — with an approved physician in the country where you will be interviewed.",
    "Tell the physician the exam is for an immigrant visa and give them the interview date. The physician tells you the cost — it is paid directly to the physician, not to the embassy.",
    "Complete the exam, with any required vaccinations, BEFORE the scheduled interview date. Results can take up to 96 hours — and longer at some posts (Montreal: up to one week).",
    "Follow your post's instructions above: some posts need the exam 2–3 weeks before the interview (Santo Domingo, Manila, London), some need at least 3 days (Ciudad Juárez), and San José can take four separate appointments.",
  ],
  bring: [
    "Visa interview appointment letter",
    "Passport",
    "Passport-sized color photographs (your post's instructions say how many — Bogotá and Caracas ask for four)",
    "A copy of your immunization / vaccination records",
    "DS-260 confirmation page (your post's instructions say whether it is needed)",
  ],
  sealedEnvelope:
    "After the exam the physician either sends the results directly to the embassy or gives you a sealed envelope. If you are given an envelope, bring it sealed (not opened) to the visa interview — opening it can void the exam.",
  validityNote:
    "Medical results are usually valid for six months — you must enter the United States within that time. If the exam expires before you obtain the visa and travel, you must obtain it again at your own expense (Bogotá's instructions state this plainly).",
};

/** USCIS Immigrant Fee — locked $235 in lib/lifecycle.ts Stage 6 +
 *  lib/nvc.ts (EXAMPLE_POST_ARRIVAL). Paid at my.uscis.gov BEFORE
 *  flying. Without it, the Green Card is not produced. */
export const USCIS_IMMIGRANT_FEE_USD = 235;

export const TRAVEL_PREP: { item: string; detail: string }[] = [
  {
    item: "Pay the $235 USCIS Immigrant Fee BEFORE flying",
    detail:
      "Pay $235 online at my.uscis.gov before the flight. USCIS will not make the Green Card until this fee is paid. Keep the payment receipt.",
  },
  {
    item: "Pick up the passport with the visa — check it before leaving",
    detail:
      "Check that the name, date of birth, and visa dates are correct before leaving the pickup location. Do not book flights until the passport with the visa is back in hand.",
  },
  {
    item: "Sealed packet + medical records in carry-on — never checked luggage",
    detail:
      "Carry the sealed immigration packet and medical records in the carry-on bag. Do not open the sealed packet. Hand it to the officer when you arrive, exactly as it was given to you.",
  },
  {
    item: "Do not make permanent commitments before the visa is in hand",
    detail:
      "Do not sell a house, car, or property, resign from a job, or make other travel arrangements until the immigrant visa has been received. (Source: travel.state.gov, Step 11.)",
  },
  {
    item: "Green Card + Social Security Number mailed 30–90 days after entry",
    detail:
      "Mailed to the U.S. address USCIS has on file, usually 30–90 days after entry. If the card has not arrived by day 90, follow up with USCIS; if the SSN has not arrived by day 90, visit a Social Security office with the passport + visa and the I-551 stamp. Tell USCIS at once if you move during those 90 days, or the card and SSN go to the old address.",
  },
];

// ---------------------------------------------------------------------------
// 8. Backbone coverage — the check itself, as data. status:
//    "covered" = already in the codebase before this task;
//    "gap-filled" = added by this task; "manual" = the step is, and
//    stays, a manual step (official site + entry here) because no
//    live government connection exists. The page and the smoke test
//    render the same table.
// ---------------------------------------------------------------------------
export type BackboneSection = "uscis" | "nvc" | "embassy";
export type BackboneStatus = "covered" | "gap-filled" | "manual";

export interface BackboneCoverageRow {
  section: BackboneSection;
  item: string;
  status: BackboneStatus;
  detail: string;
  source: string;
}

export const BACKBONE_COVERAGE: BackboneCoverageRow[] = [
  // USCIS
  { section: "uscis", item: "Forms catalog + guided DIY", status: "covered", detail: "Form checklists + guided DIY flow + packet audit to 100% before signing.", source: "lib/formChecklists.ts, lib/diy.ts, DiyGuidedFlow" },
  { section: "uscis", item: "Fees — our fee and USCIS fee separately", status: "covered", detail: "Never combined into one total. Every fee line says: confirm the current USCIS fee at uscis.gov/fees before paying.", source: "lib/diyFees.ts, lib/fees.ts" },
  { section: "uscis", item: "Filing — paper vs online, G-1450 / G-1650, one payment per form", status: "gap-filled", detail: "Was scattered across submission-order text; now one guide: online where the form allows it, paper with G-1450 (card) or G-1650 (ACH) only, no personal checks or money orders, one packet + one payment per form.", source: "lib/backbone.ts USCIS_FILING_GUIDE (from lib/diySubmission.ts + lib/intakeCalculator.ts)" },
  { section: "uscis", item: "Receipt tracking — prefix-validated, public status only", status: "covered", detail: "Receipt numbers validated (IOE / EAC / WAC / LIN / SRC / NBC / MSC), masked in the UI, status from USCIS public status words entered manually. Manual step: check Case Status Online, then enter what it says here.", source: "lib/caseTracking.ts, lib/nvc.ts parseUscisReceipt" },
  { section: "uscis", item: "RFE / NOID decoder", status: "covered", detail: "Notice words translated to plain English + clerical next steps. NOID always carries the attorney-review flag. The decoder never decides evidence strength and never writes a legal response.", source: "lib/caseTracking.ts decodeRfeNotice" },
  { section: "uscis", item: "RFE / NOID deadline countdown", status: "gap-filled", detail: "NEW: deadline computed from the notice date + the response window printed on the notice, with days left + urgency. Either one missing means the deadline is unknown — never guessed.", source: "lib/backbone.ts rfeNoidDeadlineCountdown" },
  { section: "uscis", item: "Biometrics guide", status: "gap-filled", detail: "NEW: what biometrics is, what to bring (I-797C notice + photo ID), what happens, how to reschedule (number on the notice), what a missed appointment risks.", source: "lib/backbone.ts BIOMETRICS_GUIDE (from lib/lifecycle.ts Stage 5A + lib/caseTracking.ts)" },
  { section: "uscis", item: "Interview prep", status: "covered", detail: "Question banks from official USCIS guidance only (25 of the 100 civics questions as a sample — study all 100 on uscis.gov); practice questions labelled as platform-written, not official. Paywalled behind the paid-access check.", source: "lib/interviewPrep.ts, /api/interview-prep" },
  { section: "uscis", item: "Decision steps — approval / denial / RFE", status: "covered", detail: "USCIS stages (receipt → biometrics → review → RFE → approval / denial) mapped to the consular or adjustment route. A denial goes to a licensed attorney or DOJ-accredited representative — never re-file alone.", source: "lib/nextStepEngine.ts, lib/backbone.ts decisionNextSteps" },
  // NVC
  { section: "nvc", item: "NVC case creation — 13-character validation", status: "covered", detail: "3-letter post + 4-digit year + 3-digit Julian day + 3-digit sequence, validated; unknown post codes are never guessed.", source: "lib/nvc.ts parseNvcCaseNumber" },
  { section: "nvc", item: "NVC fees — $120 AOS + $325 IV, shown separately", status: "covered", detail: "Two separate DOS fees in CEAC, per applicant for the IV fee. Never presented as a single combined total. Separate from the prep fee and from USCIS fees.", source: "lib/nvc.ts CEAC_FEE_AMOUNTS, lib/lifecycle.ts Stage 5B" },
  { section: "nvc", item: "DS-260 immigrant visa application", status: "covered", detail: "Submitted in CEAC after the fees are paid, one per applicant. Confirmation page printed for the interview.", source: "lib/nvc.ts CEAC_STEPS, lib/caseTracking.ts CONSULAR_ONLINE_SUBMISSIONS" },
  { section: "nvc", item: "I-864 Affidavit of Support + IRS transcripts", status: "gap-filled", detail: "Summary existed; NEW per-line detail: 125% of HHS Poverty Guidelines, transcripts + W-2s / 1099s, joint sponsor + I-864A when below the line. The platform never decides whether income is enough.", source: "lib/backbone.ts I864_GUIDE" },
  { section: "nvc", item: "Civil documents", status: "gap-filled", detail: "Summary existed; NEW per-document detail: birth / marriage / divorce / death, police (16+, every country lived in 6+ months since 16), passport (6+ months beyond entry), photos, certified translations.", source: "lib/backbone.ts NVC_CIVIL_DOCUMENTS" },
  { section: "nvc", item: "Documentarily Qualified (DQ)", status: "covered", detail: "NVC marks the case DQ when everything is accepted. A rejected document is fixed alone and re-uploaded — never start over.", source: "lib/nvc.ts CEAC_STEPS, lib/lifecycle.ts Stage 5B" },
  { section: "nvc", item: "Interview scheduling", status: "covered", detail: "NVC schedules the embassy interview and sends the interview letter. Manual step: the interview is scheduled by NVC — the applicant does not book it (K-1 differs: the embassy sends its own instructions).", source: "lib/backbone.ts DQ_AND_INTERVIEW" },
  { section: "nvc", item: "NVC 1-year contact rule — INA 203(g)", status: "covered", detail: "Contact NVC at least once a year or the case can be terminated. Countdown computed from the stored last-contact date.", source: "lib/nvc.ts EXAMPLE_DEADLINES (nvc_1yr)" },
  { section: "nvc", item: "K-1 track kept separate (DS-160 + I-134, no DS-260 / I-864 / CEAC fees)", status: "covered", detail: "K-1 reuses the same NVC engine (same 13-character validation, same post lookup) with its own steps. The $265 K-1 visa fee stays TO BE CONFIRMED — and Bogotá's page states $275, flagged, not silently adopted.", source: "lib/nvc.ts K1_NVC_STEPS, lib/backbone.ts EMBASSY_POSTS (BGT)" },
  { section: "nvc", item: "CEAC tracking — manual only, never store a CEAC password", status: "manual", detail: "NVC has no API. Status is entered manually from the CEAC site; the portal links out to CEAC and never asks for the password.", source: "lib/caseTracking.ts CEAC_PASSWORD_RULE, lib/agency.ts CEAC_LOGIN_URL" },
  // Embassy
  { section: "embassy", item: "Post lookup — 12 posts, BGT is Bogotá, BOG is not", status: "covered", detail: "Post code from the NVC case number resolves to the city. Unknown codes are never guessed.", source: "lib/nvc.ts NVC_POSTS, lib/backbone.ts lookupEmbassyPost" },
  { section: "embassy", item: "Per-post official instructions links", status: "gap-filled", detail: "NEW: every one of the 12 posts now links to its official travel.state.gov interview instructions (page or PDF), verified Nov 28, 2026. No guessed URLs.", source: "lib/backbone.ts EMBASSY_POSTS" },
  { section: "embassy", item: "Per-post contact email", status: "gap-filled", detail: "NEW: verified emails for 3 of 12 posts (Port-au-Prince, Santo Domingo, Manila — each cited to its official PDF). The other 9 show the official page link instead and say the email was not verified. No embassy email is ever invented.", source: "lib/backbone.ts EMBASSY_POSTS" },
  { section: "embassy", item: "What to bring to the interview", status: "gap-filled", detail: "NEW: appointment letter, passport (6+ months beyond entry), 2 photos, DS-260 confirmation, originals of all CEAC civil documents, sealed medical envelope, I-864 + evidence.", source: "travel.state.gov Step 11 — Applicant Interview" },
  { section: "embassy", item: "Medical exam — panel physician, sealed results", status: "gap-filled", detail: "Rule existed; NEW per-post timing + clinic notes (e.g. Santo Domingo / Manila / London 2–3 weeks or 2 weeks before; Ciudad Juárez at least 3 days; San José up to 4 appointments) and the sealed-envelope rule.", source: "lib/backbone.ts MEDICAL_EXAM_GUIDE + EMBASSY_POSTS" },
  { section: "embassy", item: "Visa pickup", status: "gap-filled", detail: "NEW per-post pickup notes: online registration / courier (DHL, Cargo Expreso, ustraveldocs profile) and the check-before-leaving rule — name, date of birth, visa dates correct before leaving the pickup location.", source: "lib/backbone.ts EMBASSY_POSTS" },
  { section: "embassy", item: "USCIS Immigrant Fee $235 BEFORE flying", status: "covered", detail: "Paid online at my.uscis.gov before the flight. Without it the Green Card is not produced. Locked $235 from the codebase, reused — not re-decided.", source: "lib/lifecycle.ts Stage 6, lib/nvc.ts EXAMPLE_POST_ARRIVAL" },
  { section: "embassy", item: "Sealed packet + medical in carry-on", status: "covered", detail: "Never in checked luggage, never opened. Handed to the officer on arrival exactly as given.", source: "lib/lifecycle.ts Stage 6, lib/nvc.ts EXAMPLE_POST_ARRIVAL" },
  { section: "embassy", item: "Green Card + SSN mailed 30–90 days after entry", status: "covered", detail: "To the U.S. address on file. Day-90 follow-up: USCIS for the card, Social Security office (passport + visa + I-551 stamp) for the SSN. Update the address with USCIS if you move.", source: "lib/nvc.ts POST_ARRIVAL_WINDOW_DAYS, lib/lifecycle.ts Stage 6" },
];

export function backboneCoverageSummary(): {
  section: BackboneSection;
  covered: number;
  gapFilled: number;
  manual: number;
  total: number;
}[] {
  return (["uscis", "nvc", "embassy"] as BackboneSection[]).map((section) => {
    const rows = BACKBONE_COVERAGE.filter((r) => r.section === section);
    return {
      section,
      covered: rows.filter((r) => r.status === "covered").length,
      gapFilled: rows.filter((r) => r.status === "gap-filled").length,
      manual: rows.filter((r) => r.status === "manual").length,
      total: rows.length,
    };
  });
}
