// Authentic NVC & Consular Processing Engine (Part 2)
// ------------------------------------------------------
// NVC has NO API — CEAC status is MANUAL ENTRY + a link out to
// https://ceac.state.gov/IV/Login.aspx. Never store a CEAC password.
// USCIS live status needs the Production key + worker — NOT built;
// receipt / status values here are manual / EXAMPLE until then.
// All names, case numbers and Invoice IDs in this file are EXAMPLE
// only — never present them as a real case.
//
// NVC case number format (13 characters):
//   3-letter post code + 4-digit year + 3-digit Julian day + 3-digit sequence
//   e.g. PHP2026514009 = PHP + 2026 + 514 + 009
// USCIS receipt format (13 characters):
//   3-letter service-center prefix + 10 digits, e.g. IOE0928374651 (EXAMPLE)
import { CEAC_LOGIN_URL } from "./agency";

export { CEAC_LOGIN_URL };

// ---------------------------------------------------------------------------
// NVC post-code lookup — ONLY the posts the founder named.
// Any code not in this table is "Post code not in lookup — verify with
// NVC", never a guessed post name. NOTE: BOG is NOT the Bogotá post
// code — BGT is. Do NOT accept BOG as Bogotá.
// ---------------------------------------------------------------------------
export interface NvcPost {
  code: string;
  city: string;
  country: string;
}

export const NVC_POSTS: NvcPost[] = [
  { code: "PHP", city: "Port-au-Prince", country: "Haiti" },
  { code: "SDO", city: "Santo Domingo", country: "Dominican Republic" },
  { code: "CDJ", city: "Ciudad Juárez", country: "Mexico" },
  { code: "MNL", city: "Manila", country: "Philippines" },
  { code: "BGT", city: "Bogotá", country: "Colombia" },
  { code: "CRS", city: "Caracas", country: "Venezuela" },
  { code: "PRS", city: "Paris", country: "France" },
  { code: "PNM", city: "Panama City", country: "Panama" },
  { code: "PTS", city: "Port of Spain", country: "Trinidad and Tobago" },
  { code: "SNJ", city: "San José", country: "Costa Rica" },
  { code: "MTL", city: "Montreal", country: "Canada" },
  { code: "LND", city: "London", country: "United Kingdom" },
];

export function lookupNvcPost(code: string | null | undefined): NvcPost | null {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  return NVC_POSTS.find((p) => p.code === upper) ?? null;
}

export const NVC_UNKNOWN_POST_LABEL =
  "Post code not in lookup — verify with NVC";

// ---------------------------------------------------------------------------
// NVC case-number validation
// ---------------------------------------------------------------------------
export interface NvcCaseParse {
  input: string;
  normalized: string;
  valid: boolean;
  postCode: string | null;
  post: NvcPost | null;
  postKnown: boolean;
  year: number | null;
  julianDay: number | null;
  sequence: string | null;
  errors: string[];
  notes: string[];
}

const NVC_CASE_RE = /^([A-Z]{3})(\d{4})(\d{3})(\d{3})$/;

export function parseNvcCaseNumber(value: string): NvcCaseParse {
  const input = value ?? "";
  const normalized = input.trim().toUpperCase();
  const result: NvcCaseParse = {
    input,
    normalized,
    valid: false,
    postCode: null,
    post: null,
    postKnown: false,
    year: null,
    julianDay: null,
    sequence: null,
    errors: [],
    notes: [],
  };

  if (normalized.length !== 13) {
    result.errors.push(
      `NVC case number must be 13 characters (3-letter post + 4-digit year + 3-digit Julian day + 3-digit sequence); got ${normalized.length}.`
    );
    return result;
  }
  const match = NVC_CASE_RE.exec(normalized);
  if (!match) {
    result.errors.push(
      "Format must be 3 letters, then 4 digits (year), 3 digits (Julian day), 3 digits (sequence) — e.g. PHP2026514009 (EXAMPLE)."
    );
    return result;
  }

  const [, postCode, yearStr, julianStr, sequence] = match;
  result.postCode = postCode;
  result.year = Number(yearStr);
  result.julianDay = Number(julianStr);
  result.sequence = sequence;

  if (result.year < 2000 || result.year > 2099) {
    result.errors.push(`Year ${yearStr} is outside the expected 2000–2099 range.`);
  }
  if (result.julianDay < 1 || result.julianDay > 366) {
    result.errors.push(
      `Julian day ${julianStr} must be between 001 and 366.`
    );
  }

  result.post = lookupNvcPost(postCode);
  result.postKnown = result.post !== null;
  if (!result.postKnown) {
    result.notes.push(NVC_UNKNOWN_POST_LABEL);
  }
  if (postCode === "BOG") {
    result.notes.push(
      "BOG is NOT the Bogotá post code — Bogotá is BGT. Verify with NVC."
    );
  }

  result.valid = result.errors.length === 0;
  return result;
}

export function isValidNvcCaseNumber(value: string): boolean {
  return parseNvcCaseNumber(value).valid;
}

// ---------------------------------------------------------------------------
// USCIS receipt-prefix recognition (manual / EXAMPLE until the live
// USCIS status worker + Production key exist — NOT built).
// ---------------------------------------------------------------------------
export const USCIS_RECEIPT_PREFIXES = [
  "IOE",
  "EAC",
  "WAC",
  "LIN",
  "SRC",
  "NBC",
  "MSC",
] as const;

export type UscisReceiptPrefix = (typeof USCIS_RECEIPT_PREFIXES)[number];

export interface UscisReceiptParse {
  input: string;
  normalized: string;
  valid: boolean;
  prefix: string | null;
  prefixKnown: boolean;
  errors: string[];
}

const USCIS_RECEIPT_RE = /^([A-Z]{3})(\d{10})$/;

export function parseUscisReceipt(value: string): UscisReceiptParse {
  const input = value ?? "";
  const normalized = input.trim().toUpperCase();
  const result: UscisReceiptParse = {
    input,
    normalized,
    valid: false,
    prefix: null,
    prefixKnown: false,
    errors: [],
  };
  if (normalized.length !== 13) {
    result.errors.push(
      `USCIS receipt number must be 13 characters (3-letter prefix + 10 digits); got ${normalized.length}.`
    );
    return result;
  }
  const match = USCIS_RECEIPT_RE.exec(normalized);
  if (!match) {
    result.errors.push(
      "Format must be a 3-letter service-center prefix followed by 10 digits — e.g. IOE0928374651 (EXAMPLE)."
    );
    return result;
  }
  result.prefix = match[1];
  result.prefixKnown = (
    USCIS_RECEIPT_PREFIXES as readonly string[]
  ).includes(match[1]);
  if (!result.prefixKnown) {
    result.errors.push(
      `Prefix ${match[1]} is not a recognised USCIS receipt prefix (IOE, EAC, WAC, LIN, SRC, NBC, MSC).`
    );
  }
  result.valid = result.errors.length === 0;
  return result;
}

// ---------------------------------------------------------------------------
// CEAC 6-step tracker + DOS fee tracker
// DOS fees are separate from the clerical prep fee and from USCIS fees:
//   $120 Affidavit of Support (AOS) fee + $325 Immigrant Visa (IV) fee
//   per applicant, paid in CEAC.
// ---------------------------------------------------------------------------
export interface CeacStep {
  id: string;
  title: string;
  detail: string;
}

export const CEAC_STEPS: CeacStep[] = [
  {
    id: "case-created",
    title: "1. NVC Case Created & Welcome Letter",
    detail:
      "NVC case number + Invoice ID issued. Keep the Invoice ID — it is needed to log in to CEAC.",
  },
  {
    id: "fees",
    title: "2. DOS Fees Paid",
    detail:
      "$120 Affidavit of Support (AOS) fee + $325 Immigrant Visa (IV) fee per applicant, paid in CEAC. Separate from the clerical prep fee.",
  },
  {
    id: "ds260",
    title: "3. DS-260 Immigrant Visa Application",
    detail:
      "Online immigrant visa application for each applicant, submitted in CEAC.",
  },
  {
    id: "i864",
    title: "4. I-864 + IRS Transcripts",
    detail:
      "Affidavit of Support with IRS tax transcripts (petitioner; joint sponsor + I-864A if household income is below 125% of the HHS Poverty Guidelines).",
  },
  {
    id: "civil-docs",
    title: "5. Civil Documents Uploaded to CEAC",
    detail:
      "Birth / marriage / divorce certificates, police clearances, passport bio pages — uploaded as scans in CEAC.",
  },
  {
    id: "dq",
    title: "6. Documentarily Qualified (DQ) → Embassy Interview Scheduled",
    detail:
      "NVC marks the case Documentarily Qualified (DQ), then schedules the embassy interview. Complete the panel-physician medical exam before the interview.",
  },
];

export type CeacFeeStatus = "paid" | "in_process" | "not_paid";

export const CEAC_FEE_STATUS_LABEL: Record<CeacFeeStatus, string> = {
  paid: "PAID",
  in_process: "IN PROCESS",
  not_paid: "NOT PAID",
};

export interface CeacFee {
  id: "aos" | "iv";
  label: string;
  amountUsd: number;
  per: string;
  status: CeacFeeStatus;
}

// DOS fees (per the brief): $120 AOS + $325 IV per applicant.
export const CEAC_FEE_AMOUNTS = { aos: 120, iv: 325 } as const;

export function ceacFeeTotalUsd(
  fees: Pick<CeacFee, "amountUsd">[],
  applicantCount: number
): number {
  const perApplicant = fees.reduce((sum, f) => sum + f.amountUsd, 0);
  return perApplicant * Math.max(1, applicantCount);
}

// ---------------------------------------------------------------------------
// EXAMPLE NVC case only — every name / number here is EXAMPLE.
// PHP2026514009 (Port-au-Prince), Invoice ID 42117188, Carlos & Elena
// Mendez — none of these is a real case.
// ---------------------------------------------------------------------------
export interface ExampleNvcCase {
  caseNumber: string;
  invoiceId: string;
  petitionerExample: string;
  beneficiaryExample: string;
  currentStepIndex: number; // 0-based index into CEAC_STEPS
  fees: CeacFee[];
  applicantCount: number;
}

export const EXAMPLE_NVC_CASE: ExampleNvcCase = {
  caseNumber: "PHP2026514009",
  invoiceId: "42117188",
  petitionerExample: "Elena Mendez",
  beneficiaryExample: "Carlos Mendez",
  currentStepIndex: 1, // Step 2 (DOS fees) in progress in this example
  applicantCount: 1,
  fees: [
    {
      id: "aos",
      label: "Affidavit of Support (AOS) fee",
      amountUsd: CEAC_FEE_AMOUNTS.aos,
      per: "per case",
      status: "paid",
    },
    {
      id: "iv",
      label: "Immigrant Visa (IV) fee",
      amountUsd: CEAC_FEE_AMOUNTS.iv,
      per: "per applicant",
      status: "in_process",
    },
  ],
};

// ---------------------------------------------------------------------------
// (b) NVC CEAC Dual-Track Checklist — Side A Petitioner Financial vs
//     Side B Beneficiary Civil Documents. EXAMPLE statuses only.
// ---------------------------------------------------------------------------
export interface DualTrackItem {
  id: string;
  label: string;
  note?: string;
  status: "done" | "pending" | "to_be_confirmed";
}

export const EXAMPLE_DUAL_TRACK: {
  sideA: DualTrackItem[];
  sideB: DualTrackItem[];
} = {
  sideA: [
    { id: "a-i864", label: "I-864 Affidavit of Support (petitioner)", status: "done" },
    { id: "a-irs", label: "IRS tax transcripts (petitioner)", status: "pending" },
    { id: "a-w2", label: "W-2s / 1099s", status: "pending" },
    { id: "a-status", label: "Proof of U.S. citizen / LPR status (petitioner)", status: "done" },
    {
      id: "a-i864a",
      label: "Joint Sponsor I-864A",
      note: "Only if household income is below 125% of the HHS Poverty Guidelines — TO BE CONFIRMED for this case.",
      status: "to_be_confirmed",
    },
  ],
  sideB: [
    { id: "b-ds260", label: "DS-260 confirmation page", status: "pending" },
    { id: "b-birth", label: "Birth certificate (+ certified translation if foreign)", status: "done" },
    { id: "b-marriage", label: "Marriage certificate (+ certified translation if foreign)", status: "done" },
    { id: "b-divorce", label: "Divorce / death certificates for prior marriages (if any)", status: "to_be_confirmed" },
    {
      id: "b-police",
      label: "Police clearance — every country lived in 6+ months since age 16",
      status: "pending",
    },
    { id: "b-passport", label: "Passport bio page (check expiry — see Family Tree roster)", status: "done" },
  ],
};

// ---------------------------------------------------------------------------
// (c) Embassy Interview & Medical Exam Readiness Tracker (post-DQ).
//     EXAMPLE dates / places only.
// ---------------------------------------------------------------------------
export interface InterviewReadinessItem {
  id: string;
  label: string;
  note?: string;
  status: "done" | "pending" | "to_be_confirmed";
}

export const EXAMPLE_INTERVIEW_READINESS: InterviewReadinessItem[] = [
  {
    id: "med-exam",
    label: "Panel-physician medical exam completed",
    note: "Exam must be with an embassy-approved panel physician. Bring vaccination records.",
    status: "pending",
  },
  {
    id: "med-envelope",
    label: "Sealed medical envelope received — DO NOT OPEN",
    note: "The sealed envelope goes to the embassy unopened. Opening it can void the exam.",
    status: "to_be_confirmed",
  },
  {
    id: "vac",
    label: "VAC biometrics appointment",
    note: "EXAMPLE date/location only — no real appointment is booked in this build.",
    status: "to_be_confirmed",
  },
  {
    id: "binder",
    label: "Original civil documents binder packed",
    note: "Originals of every civil document uploaded to CEAC + certified translations.",
    status: "pending",
  },
  {
    id: "appt-letter",
    label: "Embassy interview appointment letter printed",
    status: "to_be_confirmed",
  },
  {
    id: "ds260-print",
    label: "DS-260 confirmation page printed",
    status: "pending",
  },
];

export const EXAMPLE_VAC: {
  dateIso: string;
  location: string;
} = {
  dateIso: "2027-02-10",
  location: "Visa Application Centre — Port-au-Prince (EXAMPLE)",
};

// ---------------------------------------------------------------------------
// (d) Expiration & Deadline Radar. Countdowns are COMPUTED FROM STORED
//     DATES (see daysUntil in lib/shipments.ts) — not live USCIS/NVC data.
// ---------------------------------------------------------------------------
export type DeadlineKind =
  | "rfe"
  | "noid"
  | "nvc_1yr"
  | "ead_tps_renewal";

export interface DeadlineItem {
  id: string;
  label: string;
  kind: DeadlineKind;
  dueIso: string;
  direction: "due" | "opens";
  basis: string;
  action: string;
}

export const DEADLINE_KIND_LABEL: Record<DeadlineKind, string> = {
  rfe: "RFE deadline",
  noid: "NOID deadline",
  nvc_1yr: "NVC 1-Year Contact Requirement — INA 203(g)",
  ead_tps_renewal: "EAD / TPS renewal window (180-day)",
};

export const EXAMPLE_DEADLINES: DeadlineItem[] = [
  {
    id: "dl-rfe",
    label: "RFE response — I-130 (EXAMPLE)",
    kind: "rfe",
    dueIso: "2027-01-15",
    direction: "due",
    basis:
      "Stored RFE notice date + the response window printed on the notice (EXAMPLE).",
    action: "Upload the RFE response before the date on the notice.",
  },
  {
    id: "dl-noid",
    label: "NOID response (EXAMPLE)",
    kind: "noid",
    dueIso: "2026-12-19",
    direction: "due",
    basis:
      "Stored NOID notice date + the response window printed on the notice (EXAMPLE).",
    action: "Upload the NOID response before the date on the notice.",
  },
  {
    id: "dl-nvc-1yr",
    label: "NVC 1-year contact deadline (EXAMPLE)",
    kind: "nvc_1yr",
    dueIso: "2027-06-01",
    direction: "due",
    basis:
      "Stored last-contact-with-NVC date + 1 year. Under INA 203(g) a case can be terminated if NVC is not contacted at least once a year.",
    action: "Contact NVC (or update CEAC) before this date to keep the case alive.",
  },
  {
    id: "dl-ead-window",
    label: "EAD / TPS renewal window opens (EXAMPLE)",
    kind: "ead_tps_renewal",
    dueIso: "2026-11-19",
    direction: "opens",
    basis:
      "Stored EAD expiry 2027-05-18 minus the 180-day renewal window.",
    action: "File the EAD / TPS renewal once the window opens.",
  },
  {
    id: "dl-ead-expiry",
    label: "EAD Work Permit expires (EXAMPLE)",
    kind: "ead_tps_renewal",
    dueIso: "2027-05-18",
    direction: "due",
    basis: "Stored EAD expiry date (EXAMPLE) — same date as the Mail Vault example notice.",
    action: "Start renewal — do not let the permit lapse.",
  },
];

// ---------------------------------------------------------------------------
// (e) Certified Translation & Passport Photo Add-On Tracker.
//     Reuses the existing TranslationOrders component for ordering;
//     this data only tracks WHICH documents still need a Certificate of
//     Translation Accuracy before USCIS / NVC.
// ---------------------------------------------------------------------------
export type TranslationAddonStatus =
  | "received"
  | "requested"
  | "not_requested";

export interface TranslationAddon {
  id: string;
  document: string;
  needsCertificate: boolean;
  status: TranslationAddonStatus;
  note?: string;
}

export const EXAMPLE_TRANSLATION_ADDONS: TranslationAddon[] = [
  {
    id: "ta-birth",
    document: "Birth Certificate (foreign)",
    needsCertificate: true,
    status: "received",
    note: "Certificate of Translation Accuracy on file.",
  },
  {
    id: "ta-marriage",
    document: "Marriage Certificate (foreign)",
    needsCertificate: true,
    status: "not_requested",
    note: "Still needs a Certificate of Translation Accuracy before USCIS / NVC.",
  },
  {
    id: "ta-divorce",
    document: "Divorce Certificate (foreign, if applicable)",
    needsCertificate: true,
    status: "not_requested",
    note: "TO BE CONFIRMED whether this document applies to this case.",
  },
  {
    id: "ta-police",
    document: "Police Clearance (foreign)",
    needsCertificate: true,
    status: "not_requested",
    note: "Still needs a Certificate of Translation Accuracy before NVC.",
  },
];

export interface PhotoAddon {
  id: string;
  personExample: string;
  status: TranslationAddonStatus;
  note?: string;
}

export const EXAMPLE_PHOTO_ADDONS: PhotoAddon[] = [
  { id: "ph-carlos", personExample: "Carlos Mendez", status: "not_requested", note: "Passport photos (2x2) — upload or take selfie." },
  { id: "ph-elena", personExample: "Elena Mendez", status: "received", note: "Passport photos (2x2) on file." },
  { id: "ph-sofia", personExample: "Sofia Mendez", status: "not_requested", note: "Passport photos (2x2) — upload or take selfie." },
];

// ---------------------------------------------------------------------------
// (f) Family Tree / Derivative Beneficiary Roster.
//     A-Numbers are stored here as EXAMPLE placeholders and shown MASKED
//     only (maskANumber in lib/agency.ts) — never in full in lists.
// ---------------------------------------------------------------------------
export type FamilyRole =
  | "petitioner"
  | "principal"
  | "derivative_spouse"
  | "derivative_child"
  | "joint_sponsor";

export const FAMILY_ROLE_LABEL: Record<FamilyRole, string> = {
  petitioner: "Petitioner",
  principal: "Principal Beneficiary",
  derivative_spouse: "Derivative Spouse",
  derivative_child: "Derivative Child",
  joint_sponsor: "Joint Sponsor (I-864)",
};

export interface FamilyMember {
  id: string;
  role: FamilyRole;
  displayName: string; // EXAMPLE name only
  relationship: string;
  aNumberExample: string; // EXAMPLE placeholder — rendered masked only
  birthDateIso: string; // EXAMPLE
  passportExpiryIso: string; // EXAMPLE
  passportCountry: string;
}

export const EXAMPLE_FAMILY_ROSTER: FamilyMember[] = [
  {
    id: "fam-elena",
    role: "petitioner",
    displayName: "Elena Mendez",
    relationship: "Petitioner — U.S. citizen spouse",
    aNumberExample: "A000000123",
    birthDateIso: "1988-04-12",
    passportExpiryIso: "2031-03-01",
    passportCountry: "United States (EXAMPLE)",
  },
  {
    id: "fam-carlos",
    role: "principal",
    displayName: "Carlos Mendez",
    relationship: "Principal Beneficiary — spouse of petitioner",
    aNumberExample: "A000000456",
    birthDateIso: "1990-07-25",
    passportExpiryIso: "2029-11-30",
    passportCountry: "Haiti (EXAMPLE)",
  },
  {
    id: "fam-sofia",
    role: "derivative_child",
    displayName: "Sofia Mendez",
    relationship: "Derivative — unmarried child of principal beneficiary",
    aNumberExample: "A000000789",
    birthDateIso: "2012-02-03",
    passportExpiryIso: "2028-06-15",
    passportCountry: "Haiti (EXAMPLE)",
  },
  {
    id: "fam-joint",
    role: "joint_sponsor",
    displayName: "Joint Sponsor (EXAMPLE — name not provided)",
    relationship: "Joint Sponsor (I-864) — only if needed under 125% HHS Poverty Guidelines",
    aNumberExample: "A000000321",
    birthDateIso: "1985-09-19",
    passportExpiryIso: "2030-01-20",
    passportCountry: "United States (EXAMPLE)",
  },
];

// ---------------------------------------------------------------------------
// (g) Post-Arrival — Green Card / SSN tracking + Case Close-Out checklist.
//     Stage 6, after entry to the United States. Green Card and SSN are
//     mailed to the U.S. address on file, usually 30–90 days after entry
//     (Stage 6 guidance, lib/lifecycle.ts). The $235 USCIS Immigrant Fee
//     must be paid at my.uscis.gov BEFORE flying. All dates are STORED
//     dates (EXAMPLE) — nothing here is a live USCIS lookup. The case
//     closes only when every close-out item below is done.
// ---------------------------------------------------------------------------
export type PostArrivalStatus = "not_due" | "waiting" | "received" | "overdue_follow_up";

export interface PostArrivalItem {
  id: string;
  label: string;
  detail: string;
  /** ISO date the item is expected / due, or null when it has no date. */
  dueIso: string | null;
  status: PostArrivalStatus;
}

export const POST_ARRIVAL_WINDOW_DAYS: { min: number; max: number } = { min: 30, max: 90 };

/** Entry date of the EXAMPLE traveller. Expected Green Card / SSN window
 *  is entry + 30 days to entry + 90 days. */
export const EXAMPLE_ENTRY_DATE_ISO = "2027-03-10";

export const EXAMPLE_POST_ARRIVAL: PostArrivalItem[] = [
  {
    id: "pa-immigrant-fee",
    label: "USCIS Immigrant Fee — $235 paid before flying",
    detail: "Paid online at my.uscis.gov BEFORE the flight. Without it, the Green Card is not produced. Keep the payment receipt.",
    dueIso: "2027-03-09",
    status: "received",
  },
  {
    id: "pa-entry",
    label: "Entered the United States — sealed packet handed to the officer unopened",
    detail: "Entry date is the start of the 30–90 day Green Card / SSN window. Sealed packet and medical records travelled in carry-on, never in checked luggage.",
    dueIso: EXAMPLE_ENTRY_DATE_ISO,
    status: "received",
  },
  {
    id: "pa-green-card",
    label: "Green Card received by mail",
    detail: "Mailed to the U.S. address USCIS has on file, usually 30–90 days after entry (here: 2027-04-09 to 2027-06-08). If the card has not arrived by day 90, follow up with USCIS.",
    dueIso: "2027-06-08",
    status: "waiting",
  },
  {
    id: "pa-ssn",
    label: "Social Security Number (SSN) received by mail",
    detail: "Mailed to the same U.S. address, usually 30–90 days after entry. If it has not arrived by day 90, visit a Social Security office with the passport + visa and the I-551 stamp.",
    dueIso: "2027-06-08",
    status: "waiting",
  },
  {
    id: "pa-address",
    label: "U.S. address on file with USCIS is correct",
    detail: "If the client moved during the 90 days, the address must be updated with USCIS or the Green Card and SSN go to the old address.",
    dueIso: null,
    status: "waiting",
  },
];

/** Case close-out checklist — the case closes only when every item is
 *  done. No item is checked by default: closing is a deliberate act, not
 *  an automatic one. */
export interface CloseOutItem {
  id: string;
  label: string;
  detail: string;
}

export const CASE_CLOSE_OUT_CHECKLIST: CloseOutItem[] = [
  {
    id: "co-travel",
    label: "Travel complete — client entered the United States",
    detail: "Sealed packet handed to the officer unopened; passport with visa checked before leaving the pickup location.",
  },
  {
    id: "co-fee",
    label: "$235 USCIS Immigrant Fee paid before flying (receipt on file)",
    detail: "Receipt kept in the case file. Without it the Green Card is not produced.",
  },
  {
    id: "co-green-card",
    label: "Green Card received and checked (name, date of birth correct)",
    detail: "If anything on the card is wrong, it must be corrected — do not close the case with a wrong card.",
  },
  {
    id: "co-ssn",
    label: "SSN received and checked",
    detail: "If it has not arrived by day 90 after entry, the client has been told to visit a Social Security office.",
  },
  {
    id: "co-invoices",
    label: "All preparer invoices paid — balance $0",
    detail: "Preparer fees are separate from USCIS government fees. No invoice may be left open at close-out.",
  },
  {
    id: "co-docs",
    label: "Final documents delivered to the client in the portal",
    detail: "Approved packet copy, receipts, and the interview / travel record are in the client's portal.",
  },
];

// ---------------------------------------------------------------------------
// (h) K-1 (I-129F) NVC / Consular Tracking — ADDED 2026-11-19.
//     REUSES this same NVC engine — there is NO second NVC tracker.
//     The NVC case number is validated by parseNvcCaseNumber() above
//     (13 characters: 3-letter post + year + Julian day + sequence)
//     and the post is looked up by lookupNvcPost() — the same
//     PHP/SDO/MNL/CDJ post-code lookup as I-130 consular.
//     Differences from I-130 consular (do NOT copy the I-130 steps):
//       - K-1 has NO DS-260, NO I-864 and NO CEAC $120 AOS / $325 IV
//         fees. The fiancé(e) completes Form DS-160 (online
//         nonimmigrant visa application) and an I-134 Affidavit of
//         Support is used instead of an I-864.
//       - The $265 K-1 visa fee is paid at the embassy — TO BE
//         CONFIRMED (see src/lib/dynamicIntakeSchemas.ts). It is NOT
//         a CEAC fee and is never added to the I-130 DOS totals.
//     Flow: USCIS approves the I-129F -> NVC creates the case and
//     issues the NVC case number + Invoice ID -> NVC forwards the
//     case to the embassy -> fiancé(e) completes the DS-160 and the
//     panel-physician medical exam -> embassy interview -> K-1 visa
//     issued -> enter the U.S. and marry within 90 days.
//     Petitioner + fiancé(e) abroad both track the same record.
//     Nothing here is a live NVC/CEAC lookup: the case number and
//     Invoice ID are entered manually from the NVC letter, exactly
//     as for I-130 consular. Never store a CEAC password.
// ---------------------------------------------------------------------------

export interface K1NvcStep {
  id: string;
  title: string;
  detail: string;
}

export const K1_NVC_STEPS: K1NvcStep[] = [
  {
    id: "uscis-approved",
    title: "1. USCIS Approves the I-129F",
    detail:
      "USCIS approval notice received. The approved petition is sent to NVC — the petitioner does nothing yet except wait for the NVC letter.",
  },
  {
    id: "nvc-case-created",
    title: "2. NVC Case Created — Case Number + Invoice ID Issued",
    detail:
      "NVC issues the 13-character case number (post code + year + Julian day + sequence) and the Invoice ID. Log both here so the petitioner and the fiancé(e) abroad track the same case.",
  },
  {
    id: "nvc-to-embassy",
    title: "3. NVC Forwards the Case to the Embassy",
    detail:
      "NVC sends the case to the U.S. embassy / consulate in the city named on the I-129F (the NVC post city). The embassy then sends the interview instructions.",
  },
  {
    id: "ds160-i134",
    title: "4. DS-160 + I-134 Affidavit of Support",
    detail:
      "The fiancé(e) completes Form DS-160 (online nonimmigrant visa application). The petitioner completes Form I-134 (Affidavit of Support) — the K-1 uses an I-134, NOT an I-864.",
  },
  {
    id: "medical-exam",
    title: "5. Panel-Physician Medical Exam",
    detail:
      "Medical exam with an embassy-approved panel physician. Bring vaccination records. The sealed medical envelope goes to the embassy unopened — opening it can void the exam.",
  },
  {
    id: "interview",
    title: "6. Embassy Interview → K-1 Visa Issued",
    detail:
      "Embassy interview for the fiancé(e). The $265 K-1 visa fee is paid at the embassy (TO BE CONFIRMED). After the visa is issued, the fiancé(e) enters the United States and must marry the petitioner within 90 days of entry.",
  },
];

/** K-1 interview + medical exam readiness — the same shape as
 *  InterviewReadinessItem above, K-1 wording. Statuses are manual
 *  entry, never a live lookup. */
export const K1_INTERVIEW_READINESS: InterviewReadinessItem[] = [
  {
    id: "k1-ds160",
    label: "DS-160 confirmation page printed",
    note: "Online nonimmigrant visa application — K-1 uses DS-160, NOT DS-260.",
    status: "pending",
  },
  {
    id: "k1-i134",
    label: "I-134 Affidavit of Support completed (petitioner)",
    note: "K-1 uses Form I-134, NOT Form I-864.",
    status: "pending",
  },
  {
    id: "k1-med-exam",
    label: "Panel-physician medical exam completed",
    note: "Exam must be with an embassy-approved panel physician. Bring vaccination records.",
    status: "pending",
  },
  {
    id: "k1-med-envelope",
    label: "Sealed medical envelope received — DO NOT OPEN",
    note: "The sealed envelope goes to the embassy unopened. Opening it can void the exam.",
    status: "to_be_confirmed",
  },
  {
    id: "k1-binder",
    label: "Original civil documents binder packed",
    note: "Originals of every civil document + certified translations, and proof you met in person within 2 years.",
    status: "pending",
  },
  {
    id: "k1-appt-letter",
    label: "Embassy interview appointment letter printed",
    status: "to_be_confirmed",
  },
  {
    id: "k1-visa-fee",
    label: "K-1 visa fee ($265 — TO BE CONFIRMED) ready for the embassy",
    note: "Paid at the embassy, not in CEAC and not to USCIS. Confirm the current fee at uscis.gov/fees before paying.",
    status: "to_be_confirmed",
  },
];

export interface K1NvcRecord {
  /** 13-character NVC case number, validated by parseNvcCaseNumber(). */
  caseNumber: string;
  /** Invoice ID from the NVC letter — needed to track the case. */
  invoiceId: string;
  /** Embassy / post city from the I-129F (e.g. Port-au-Prince). */
  embassyCity: string;
  /** NVC post looked up from the case number, if the code is known. */
  post: NvcPost | null;
  /** 0-based index into K1_NVC_STEPS. */
  currentStepIndex: number;
}

/**
 * Log a K-1 NVC case after USCIS approval and transfer to NVC.
 * Reuses parseNvcCaseNumber() / lookupNvcPost() — the same engine as
 * I-130 consular. Returns the record, or null + errors when the case
 * number is invalid or the Invoice ID is missing. Pure — nothing is
 * saved anywhere by this helper.
 */
export function createK1NvcRecord(args: {
  caseNumber: string;
  invoiceId: string;
  embassyCity: string;
  currentStepIndex?: number;
}): { record: K1NvcRecord | null; errors: string[] } {
  const errors: string[] = [];
  const parsed = parseNvcCaseNumber(args.caseNumber);
  if (!parsed.valid) errors.push(...parsed.errors);
  if (!args.invoiceId || !args.invoiceId.trim()) {
    errors.push("Invoice ID is required — it is on the NVC letter with the case number.");
  }
  if (!args.embassyCity || !args.embassyCity.trim()) {
    errors.push("Embassy city is required — the city named on the I-129F for the K-1 interview.");
  }
  if (errors.length > 0) return { record: null, errors };
  return {
    record: {
      caseNumber: parsed.normalized,
      invoiceId: args.invoiceId.trim(),
      embassyCity: args.embassyCity.trim(),
      post: parsed.post,
      currentStepIndex: args.currentStepIndex ?? 1,
    },
    errors: [],
  };
}
