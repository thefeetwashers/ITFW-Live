// Dynamic Intake Schemas — EXPANDED FORMS: I-131, I-751, I-539, I-129F
// ============================================================================
// NEW FILE (2026-11-19). The four expanded-form schemas live here so the
// Smart Intake Calculator, the Dynamic Intake Engine, the form checklists
// (src/lib/formChecklists.ts) and the PDF auto-fill mappings
// (src/lib/uscisFieldMappings.ts) all read ONE source of truth for these
// four forms. Nothing here is copied verbatim from any paste.
//
// CORRECTIONS APPLIED (the paste's prep tiers were EXAMPLE prices, NOT
// locked — they are NOT used anywhere here):
//   I-131  locked tiers $250 / $325 / $400   (paste said $250/$350/$475 — WRONG)
//   I-751  locked tiers $139 / $295 / $449   (paste said $550/$725/$900 — WRONG)
//   I-539  locked tiers $250 / $375 / $500   (paste said $350/$475/$625 — WRONG)
//   I-129F locked tiers $750 / $925 / $1,095 (paste said $750/$975/$1,200 — WRONG)
// Speed mapping (same for all four — LOCKED):
//   Standard = tier + $0 · Rush = tier + $199 · Express = tier + $399.
// The speed fee buys PACKET PREPARATION TIME, NOT USCIS processing
// time. No tier and no speed is ever pre-selected: the client must tap
// a tier (and then a speed) before any total is shown.
//
// GOV FEES — labelled LOCKED or TO BE CONFIRMED, never presented as
// verified when they are not:
//   I-131  $580 online / $630 paper (and $575 Refugee Travel Document):
//          TO BE CONFIRMED.
//   I-751  $750 paper: LOCKED (I-751 paper only $750). Corroborated by
//          src/lib/storefront.ts ("I-751 paper filing $750").
//   I-539  $420 online / $470 paper: TO BE CONFIRMED. I-907 Premium
//          Processing +$1,965 for eligible F/J/M categories only:
//          TO BE CONFIRMED.
//   I-129F $675 USCIS + $265 K-1 Visa Fee at Embassy: TO BE CONFIRMED.
// Every total shown from these schemas carries GOV_FEE_DISCLAIMER.
//
// SCOPE NOTES:
// - These four schemas do NOT replace src/lib/bundles.ts. bundles.ts
//   still lists I-131 with NO locked service fee (TO BE CONFIRMED) —
//   that entry is owned by another builder and is NOT edited here.
//   The locked tiers above are the authority for these four forms.
// - src/lib/serviceTiers.ts SINGLE_FORM_TIER_PRICES /
//   TEMPLATE_ID_FOR_FORM now list these four forms (added 2026-11-19
//   with the Smart Intake Calculator integration, locked tiers
//   I-131 $250/$325/$400 · I-751 $139/$295/$449 · I-539 $250/$375/$500
//   · I-129F $750/$925/$1,095), so createCaseFromOrder() no longer
//   throws for these services and the calculator's prep items resolve
//   from that table.
// - Service options are DIY / Preparer / Attorney / DOJ-Accredited
//   Representative on every page of the intake engine. DIY $25,
//   Review $99 and Human Review $199 are brief-given prices recorded
//   in src/lib/serviceTiers.ts, not repo-locked — they are labelled
//   as such wherever shown.
// - Nothing here runs live: no Supabase, no Stripe, no sending, no
//   keys or secrets. Dates are stored as ISO calendar dates
//   (YYYY-MM-DD); validators compare calendar dates only.

import { USCIS_FEE_SCHEDULE_URL } from "./fees";
import {
  FORM_CHECKLIST_TEMPLATES,
  type ChecklistVaultCategory,
} from "./formChecklists";

export { USCIS_FEE_SCHEDULE_URL };

/** Shown on EVERY total that includes a government fee. */
export const GOV_FEE_DISCLAIMER =
  "Government fees change. Confirm the current fee at uscis.gov/fees before you pay.";

export type DynamicFormCode = "I-131" | "I-751" | "I-539" | "I-129F";

export const DYNAMIC_FORM_CODES: DynamicFormCode[] = [
  "I-131",
  "I-751",
  "I-539",
  "I-129F",
];

export type PrepTierId = "basic" | "standard" | "premium";

export const PREP_TIER_LABEL: Record<PrepTierId, string> = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
};

/** Speed = packet preparation time, NOT USCIS processing time. */
export type SpeedId = "standard" | "rush" | "express";

export interface SpeedOption {
  id: SpeedId;
  label: string;
  /** Added to the tapped prep tier, dollars. */
  addedFeeUsd: number;
  note: string;
}

export const SPEED_OPTIONS: SpeedOption[] = [
  {
    id: "standard",
    label: "Standard",
    addedFeeUsd: 0,
    note: "Standard packet preparation time. Speed is preparation time, NOT USCIS processing time.",
  },
  {
    id: "rush",
    label: "Rush",
    addedFeeUsd: 199,
    note: "Rush packet preparation (+$199). Speed is preparation time, NOT USCIS processing time.",
  },
  {
    id: "express",
    label: "Express",
    addedFeeUsd: 399,
    note: "Express packet preparation (+$399). Speed is preparation time, NOT USCIS processing time.",
  },
];

export function speedFeeFor(speed: SpeedId): number {
  return SPEED_OPTIONS.find((s) => s.id === speed)?.addedFeeUsd ?? 0;
}

/** Locked prep tiers, dollars. These are the LOCKED tiers — the paste's
 *  example tiers are NOT used. */
export const LOCKED_PREP_TIERS: Record<DynamicFormCode, Record<PrepTierId, number>> = {
  "I-131": { basic: 250, standard: 325, premium: 400 },
  "I-751": { basic: 139, standard: 295, premium: 449 },
  "I-539": { basic: 250, standard: 375, premium: 500 },
  "I-129F": { basic: 750, standard: 925, premium: 1095 },
};

/** Locked tier price + tapped speed fee = prep total, dollars. */
export function prepTotalFor(
  formCode: DynamicFormCode,
  tier: PrepTierId,
  speed: SpeedId
): number {
  return LOCKED_PREP_TIERS[formCode][tier] + speedFeeFor(speed);
}

export type IntakeMode = "client_diy" | "preparer_assisted";

export const INTAKE_MODE_LABEL: Record<IntakeMode, string> = {
  client_diy: "Client DIY",
  preparer_assisted: "Preparer-Assisted",
};

export type IntakeServiceOption = "diy" | "preparer" | "attorney" | "doj";

export interface IntakeServiceOptionDef {
  id: IntakeServiceOption;
  label: string;
  note: string;
}

/**
 * All four help options, visible on EVERY page of the Dynamic Intake
 * Engine. "DOJ" = DOJ-accredited representative (the "nonprofit"
 * service option in src/lib/serviceTiers.ts). Only an attorney gives
 * legal advice. Review $99 / Human Review $199 are brief-given prices
 * (serviceTiers.ts), not repo-locked.
 */
export const INTAKE_SERVICE_OPTIONS: IntakeServiceOptionDef[] = [
  {
    id: "diy",
    label: "DIY — $25",
    note: "Self-serve. No assigned professional. Review $99 / Human Review $199 are available add-ons (brief-given prices).",
  },
  {
    id: "preparer",
    label: "Preparer",
    note: "Clerical help only — a preparer prepares the forms from your answers and documents. No legal advice, no G-28.",
  },
  {
    id: "attorney",
    label: "Attorney",
    note: "A verified licensed attorney is assigned. Only an attorney gives legal advice.",
  },
  {
    id: "doj",
    label: "DOJ-Accredited Representative",
    note: "A DOJ-accredited representative is assigned, within the accreditation. (The \"nonprofit\" service option in serviceTiers.ts.)",
  },
];

// ---------------------------------------------------------------------------
// Government fees
// ---------------------------------------------------------------------------

export interface DynamicGovFee {
  label: string;
  /** Display amount, e.g. "$580 online". Null = TO BE CONFIRMED. */
  displayAmount: string | null;
  /** Integer cents when locked, otherwise null (TO BE CONFIRMED). */
  amountCents: number | null;
  locked: boolean;
  /** Set when the fee applies only in some cases. */
  appliesOnly?: string;
  note?: string;
}

export const DYNAMIC_GOV_FEES: Record<DynamicFormCode, DynamicGovFee[]> = {
  "I-131": [
    {
      label: "USCIS fee — I-131 (online)",
      displayAmount: "$580",
      amountCents: null,
      locked: false,
      note: "$580 online — TO BE CONFIRMED. Confirm at uscis.gov/fees before paying.",
    },
    {
      label: "USCIS fee — I-131 (paper)",
      displayAmount: "$630",
      amountCents: null,
      locked: false,
      note: "$630 paper — TO BE CONFIRMED. Confirm at uscis.gov/fees before paying.",
    },
    {
      label: "USCIS fee — I-131 Refugee Travel Document",
      displayAmount: "$575",
      amountCents: null,
      locked: false,
      appliesOnly: "Refugee Travel Document only",
      note: "$575 — TO BE CONFIRMED. Confirm at uscis.gov/fees before paying.",
    },
  ],
  "I-751": [
    {
      label: "USCIS fee — I-751 (paper)",
      displayAmount: "$750",
      amountCents: 75000,
      locked: true,
      note: "$750 — LOCKED. I-751 paper only $750. Paid to U.S. Department of Homeland Security, separate from the prep fee.",
    },
  ],
  "I-539": [
    {
      label: "USCIS fee — I-539 (online)",
      displayAmount: "$420",
      amountCents: null,
      locked: false,
      note: "$420 online — TO BE CONFIRMED. Confirm at uscis.gov/fees before paying.",
    },
    {
      label: "USCIS fee — I-539 (paper)",
      displayAmount: "$470",
      amountCents: null,
      locked: false,
      note: "$470 paper — TO BE CONFIRMED. Confirm at uscis.gov/fees before paying.",
    },
    {
      label: "Premium Processing — Form I-907 (eligible F/J/M categories only)",
      displayAmount: "+$1,965",
      amountCents: null,
      locked: false,
      appliesOnly: "Eligible F/J/M categories only",
      note: "+$1,965 — TO BE CONFIRMED, eligible categories only. Do not add this fee unless the category is eligible.",
    },
  ],
  "I-129F": [
    {
      label: "USCIS fee — I-129F",
      displayAmount: "$675",
      amountCents: null,
      locked: false,
      note: "$675 USCIS — TO BE CONFIRMED. Confirm at uscis.gov/fees before paying.",
    },
    {
      label: "K-1 Visa Fee at Embassy",
      displayAmount: "$265",
      amountCents: null,
      locked: false,
      note: "$265 K-1 visa fee, paid at the embassy — TO BE CONFIRMED. Separate from the USCIS fee and from the prep fee.",
    },
  ],
};

// ---------------------------------------------------------------------------
// Date helpers (calendar dates only, YYYY-MM-DD)
// ---------------------------------------------------------------------------

function parseIsoDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string | null {
  const date = parseIsoDate(iso);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function daysBetweenIso(fromIso: string, toIso: string): number | null {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Timeline validators — pure date checks, not legal determinations
// ---------------------------------------------------------------------------

export interface TimelineCheck {
  ok: boolean;
  /** Empty when ok, otherwise the plain-English warning to show. */
  message: string;
}

/** I-751: the 90-day filing window opens 90 days before the conditional
 *  card expires and closes on the expiry date. Filing before the window
 *  opens is too early; filing after expiry is late. */
export function i751FilingWindow(cardExpiryIso: string): {
  opensIso: string | null;
  closesIso: string;
} {
  return { opensIso: addDaysIso(cardExpiryIso, -90), closesIso: cardExpiryIso };
}

export function isInI751Window(cardExpiryIso: string, filingDateIso: string): TimelineCheck {
  const window = i751FilingWindow(cardExpiryIso);
  if (!window.opensIso) {
    return { ok: false, message: "Enter the conditional card expiry date (YYYY-MM-DD) to check the 90-day filing window." };
  }
  if (filingDateIso < window.opensIso) {
    return {
      ok: false,
      message: `Too early to file: the 90-day filing window opens ${window.opensIso} (90 days before the card expires on ${cardExpiryIso}). Do not file before the window opens.`,
    };
  }
  if (filingDateIso > window.closesIso) {
    return {
      ok: false,
      message: `Past the filing window: the conditional card expired on ${cardExpiryIso}. Filing after expiry is late — get help before filing.`,
    };
  }
  return {
    ok: true,
    message: `Inside the 90-day filing window (${window.opensIso} to ${cardExpiryIso}).`,
  };
}

/** I-539: the application must be filed BEFORE the current I-94 expires. */
export function isBeforeI94Expiry(i94ExpiryIso: string, filingDateIso: string): TimelineCheck {
  if (!parseIsoDate(i94ExpiryIso)) {
    return { ok: false, message: "Enter the current I-94 expiry date (YYYY-MM-DD) to check the filing deadline." };
  }
  if (filingDateIso >= i94ExpiryIso) {
    return {
      ok: false,
      message: `Too late on this date: the I-94 expires on ${i94ExpiryIso}. The I-539 must be filed BEFORE the I-94 expiry date — get help before filing.`,
    };
  }
  const daysLeft = daysBetweenIso(filingDateIso, i94ExpiryIso);
  return {
    ok: true,
    message: `Filed before the I-94 expiry (${i94ExpiryIso})${daysLeft !== null ? ` — ${daysLeft} day(s) before expiry on the filing date` : ""}.`,
  };
}

/** I-129F (K-1): the petitioner and fiancé(e) must have met in person
 *  within 2 years before filing. */
export function isMeetingWithin2Years(meetingDateIso: string, filingDateIso: string): TimelineCheck {
  if (!parseIsoDate(meetingDateIso)) {
    return { ok: false, message: "Enter the last in-person meeting date (YYYY-MM-DD) to check the 2-year rule." };
  }
  if (meetingDateIso > filingDateIso) {
    return { ok: false, message: "The last in-person meeting date cannot be after the filing date." };
  }
  const days = daysBetweenIso(meetingDateIso, filingDateIso);
  if (days === null) {
    return { ok: false, message: "Enter the last in-person meeting date (YYYY-MM-DD) to check the 2-year rule." };
  }
  if (days > 730) {
    return {
      ok: false,
      message: `More than 2 years since the last in-person meeting (${meetingDateIso} is ${days} days before filing). The K-1 requires an in-person meeting within 2 years before filing — get help before filing.`,
    };
  }
  return {
    ok: true,
    message: `Last in-person meeting ${meetingDateIso} is within 2 years before filing (${days} day(s)).`,
  };
}

/** I-131: the intended departure date must be in the future. */
export function isDepartureInFuture(departureDateIso: string, todayIso: string): TimelineCheck {
  if (!parseIsoDate(departureDateIso)) {
    return { ok: false, message: "Enter the intended departure date (YYYY-MM-DD)." };
  }
  if (departureDateIso <= todayIso) {
    return { ok: false, message: "The intended departure date must be after today." };
  }
  return { ok: true, message: `Intended departure ${departureDateIso} is in the future.` };
}

// ---------------------------------------------------------------------------
// Schema types
// ---------------------------------------------------------------------------

export type DynamicFieldType = "text" | "date" | "number" | "select" | "textarea";

export interface DynamicField {
  key: string;
  label: string;
  type: DynamicFieldType;
  required: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
  /** Show this field only when another field has one of these values. */
  showWhen?: { field: string; equals: string[] };
}

export interface DynamicSection {
  id: string;
  title: string;
  description?: string;
  fields: DynamicField[];
}

export interface TimelineValidator {
  id: string;
  label: string;
  description: string;
  /** Reads the intake answers; empty message when ok. */
  validate: (answers: Record<string, string>) => TimelineCheck;
}

export interface DynamicIntakeSchema {
  formCode: DynamicFormCode;
  name: string;
  /** Question 1 goal label in the Smart Intake Calculator. */
  goalLabel: string;
  summary: string;
  tierPrices: Record<PrepTierId, number>;
  govFees: DynamicGovFee[];
  /** Why there is no single combined total (or the conditional total). */
  govTotalNote: string;
  sections: DynamicSection[];
  timelineValidators: TimelineValidator[];
  /** Checklist item ids in src/lib/formChecklists.ts for this form —
   *  the document slots the engine loads for this form only. */
  documentSlotIds: string[];
  /** Checklist template id in src/lib/formChecklists.ts. */
  checklistTemplateId: string;
  /** True when this form has a consular / NVC stage after USCIS. */
  nvcTracked: boolean;
}

// ---------------------------------------------------------------------------
// I-131 — Travel Document / Advance Parole
// ---------------------------------------------------------------------------

const I131_SCHEMA: DynamicIntakeSchema = {
  formCode: "I-131",
  name: "I-131 — Application for Travel Document",
  goalLabel: "Travel Document / Advance Parole (I-131)",
  summary:
    "Travel document for a person who needs to travel outside the United States and return — Advance Parole (pending I-485 / TPS), Reentry Permit, Refugee Travel Document, or Emergency Advance Parole.",
  tierPrices: { ...LOCKED_PREP_TIERS["I-131"] },
  govFees: DYNAMIC_GOV_FEES["I-131"],
  govTotalNote:
    "No single verified gov total: $580 online / $630 paper (and $575 Refugee Travel Document) are all TO BE CONFIRMED. The total is TO BE CONFIRMED.",
  sections: [
    {
      id: "i131-document-type",
      title: "Travel Document Type",
      description: "Which travel document are you applying for?",
      fields: [
        {
          key: "i131_document_type",
          label: "Travel document type",
          type: "select",
          required: true,
          options: [
            "Advance Parole (pending I-485 / TPS)",
            "Reentry Permit",
            "Refugee Travel Document",
            "Emergency Advance Parole",
          ],
          help: "Advance Parole is for a pending I-485 or TPS. A Reentry Permit is for a permanent resident travelling abroad for an extended period. A Refugee Travel Document is for a refugee or asylee.",
        },
        {
          key: "i131_emergency_reason",
          label: "Emergency reason (Emergency Advance Parole only)",
          type: "textarea",
          required: true,
          showWhen: { field: "i131_document_type", equals: ["Emergency Advance Parole"] },
          help: "Only asked for Emergency Advance Parole: describe the emergency that requires urgent travel.",
        },
        {
          key: "i131_pending_case",
          label: "Pending case (receipt number, if any)",
          type: "text",
          required: false,
          showWhen: {
            field: "i131_document_type",
            equals: ["Advance Parole (pending I-485 / TPS)", "Emergency Advance Parole"],
          },
          placeholder: "e.g. IOE… (13 characters)",
          help: "The receipt number of the pending I-485 or TPS case, if you have one.",
        },
      ],
    },
    {
      id: "i131-trip",
      title: "Trip Details",
      description: "When and where are you travelling, and why?",
      fields: [
        {
          key: "i131_departure_date",
          label: "Intended departure date",
          type: "date",
          required: true,
          help: "The date you plan to leave the United States.",
        },
        {
          key: "i131_trip_length",
          label: "Trip length (days)",
          type: "number",
          required: true,
          placeholder: "e.g. 21",
          help: "How many days you plan to be outside the United States.",
        },
        {
          key: "i131_countries",
          label: "Countries you will visit",
          type: "text",
          required: true,
          placeholder: "e.g. Haiti, Dominican Republic",
          help: "List every country you plan to visit, in order.",
        },
        {
          key: "i131_trip_purpose",
          label: "Purpose of the trip",
          type: "textarea",
          required: true,
          placeholder: "e.g. Visit a sick parent; attend a family funeral",
          help: "Why you need to travel. Write it in your own words.",
        },
      ],
    },
    {
      id: "i131-applicant",
      title: "Applicant",
      fields: [
        { key: "i131_applicant_name", label: "Applicant full legal name", type: "text", required: true },
        { key: "i131_applicant_dob", label: "Applicant date of birth", type: "date", required: true },
        { key: "i131_passport_number", label: "Passport number", type: "text", required: true },
        {
          key: "i131_current_status",
          label: "Current immigration status",
          type: "text",
          required: true,
          placeholder: "e.g. Pending I-485; TPS; Asylee",
        },
      ],
    },
  ],
  timelineValidators: [
    {
      id: "i131-departure-future",
      label: "Intended departure is in the future",
      description: "The intended departure date must be after today.",
      validate: (answers) =>
        isDepartureInFuture(
          answers.i131_departure_date ?? "",
          new Date().toISOString().slice(0, 10)
        ),
    },
  ],
  documentSlotIds: [
    "i131-passport",
    "i131-greencard-receipt",
    "i131-trip-purpose",
    "i131-photos",
    "i131-prior-travel-document",
    "i131-emergency-proof",
  ],
  checklistTemplateId: "i131",
  nvcTracked: false,
};

// ---------------------------------------------------------------------------
// I-751 — Remove Conditions on Residence
// ---------------------------------------------------------------------------

const I751_SCHEMA: DynamicIntakeSchema = {
  formCode: "I-751",
  name: "I-751 — Petition to Remove Conditions on Residence",
  goalLabel: "Remove Conditions on Residence (I-751)",
  summary:
    "Removes the conditions on a 2-year conditional green card. File within the 90-day window before the conditional card expires — jointly with the petitioning spouse, or alone on a waiver basis.",
  tierPrices: { ...LOCKED_PREP_TIERS["I-751"] },
  govFees: DYNAMIC_GOV_FEES["I-751"],
  govTotalNote:
    "Locked gov fee: $750 (I-751 paper only). The prep fee is separate — never combine them into one total without showing both lines.",
  sections: [
    {
      id: "i751-card",
      title: "Conditional Card & Filing Window",
      description:
        "The 90-day filing window opens 90 days before the conditional card expires and closes on the expiry date.",
      fields: [
        {
          key: "i751_card_expiry",
          label: "Conditional green card expiry date",
          type: "date",
          required: true,
          help: "The expiry date printed on the 2-year conditional green card.",
        },
        {
          key: "i751_filing_date",
          label: "Planned filing date",
          type: "date",
          required: true,
          help: "The date you plan to file. It must fall inside the 90-day window before expiry.",
        },
      ],
    },
    {
      id: "i751-basis",
      title: "Filing Basis",
      description: "Are you filing jointly, or alone on a waiver?",
      fields: [
        {
          key: "i751_filing_basis",
          label: "Filing basis",
          type: "select",
          required: true,
          options: [
            "Joint filing with petitioning spouse",
            "Waiver — Divorce",
            "Waiver — Battery / Cruelty",
            "Waiver — Extreme Hardship",
          ],
          help: "Joint filing needs the petitioning spouse. A waiver files alone — pick the waiver reason that applies.",
        },
        {
          key: "i751_waiver_detail",
          label: "Waiver details",
          type: "textarea",
          required: true,
          showWhen: {
            field: "i751_filing_basis",
            equals: ["Waiver — Divorce", "Waiver — Battery / Cruelty", "Waiver — Extreme Hardship"],
          },
          help: "Only asked for a waiver filing: describe the facts for the waiver in your own words (divorce, battery/cruelty, or hardship).",
        },
        {
          key: "i751_petitioning_spouse_name",
          label: "Petitioning spouse full legal name",
          type: "text",
          required: true,
          showWhen: { field: "i751_filing_basis", equals: ["Joint filing with petitioning spouse"] },
          help: "Only asked for a joint filing: the U.S. citizen / permanent resident spouse who petitioned for you.",
        },
      ],
    },
    {
      id: "i751-timeline",
      title: "Shared Addresses Timeline",
      description: "Where you lived together, with dates — the shared-address history for the marriage.",
      fields: [
        {
          key: "i751_shared_addresses",
          label: "Shared addresses timeline (with dates)",
          type: "textarea",
          required: true,
          placeholder: "e.g. 123 Main St, Fort Pierce, FL — Jan 2024 to present",
          help: "List every address where you lived together since the marriage, with dates.",
        },
        {
          key: "i751_conditional_resident_name",
          label: "Conditional resident full legal name",
          type: "text",
          required: true,
        },
      ],
    },
  ],
  timelineValidators: [
    {
      id: "i751-90-day-window",
      label: "Filing date is inside the 90-day window",
      description:
        "File within the 90 days before the conditional card expires — not before the window opens, not after expiry.",
      validate: (answers) =>
        isInI751Window(answers.i751_card_expiry ?? "", answers.i751_filing_date ?? ""),
    },
  ],
  documentSlotIds: [
    "i751-greencard",
    "i751-marriage-certificate",
    "i751-shared-addresses",
    "i751-joint-evidence",
    "i751-waiver-evidence",
    "i751-photos",
    "i751-spouse-id",
  ],
  checklistTemplateId: "i751",
  nvcTracked: false,
};

// ---------------------------------------------------------------------------
// I-539 — Extend / Change Nonimmigrant Status
// ---------------------------------------------------------------------------

const I539_SCHEMA: DynamicIntakeSchema = {
  formCode: "I-539",
  name: "I-539 — Application to Extend / Change Nonimmigrant Status",
  goalLabel: "Extend / Change Nonimmigrant Status (I-539)",
  summary:
    "Extends a nonimmigrant stay, changes to another nonimmigrant status, or asks for reinstatement. Must be filed BEFORE the current I-94 expires.",
  tierPrices: { ...LOCKED_PREP_TIERS["I-539"] },
  govFees: DYNAMIC_GOV_FEES["I-539"],
  govTotalNote:
    "No single verified gov total: $420 online / $470 paper are TO BE CONFIRMED, and the +$1,965 I-907 premium-processing fee applies to eligible F/J/M categories only (also TO BE CONFIRMED). The total is TO BE CONFIRMED.",
  sections: [
    {
      id: "i539-action",
      title: "Action Type",
      description: "What are you asking USCIS to do?",
      fields: [
        {
          key: "i539_action_type",
          label: "Action type",
          type: "select",
          required: true,
          options: ["Extend my current status", "Change to another status", "Reinstate my status"],
          help: "Extend: stay longer in the same status. Change: move to a different nonimmigrant status. Reinstate: ask USCIS to reinstate a status that lapsed.",
        },
        {
          key: "i539_change_to_status",
          label: "Status you want to change to",
          type: "text",
          required: true,
          showWhen: { field: "i539_action_type", equals: ["Change to another status"] },
          placeholder: "e.g. B-2 visitor; F-1 student",
          help: "Only asked when changing status: the nonimmigrant status you are asking for.",
        },
        {
          key: "i539_reinstate_reason",
          label: "Why reinstatement is needed",
          type: "textarea",
          required: true,
          showWhen: { field: "i539_action_type", equals: ["Reinstate my status"] },
          help: "Only asked for reinstatement: explain in your own words why the status lapsed and why it should be reinstated.",
        },
      ],
    },
    {
      id: "i539-status",
      title: "Current Status & I-94",
      description: "Your current status and when it expires — the I-539 must be filed before the I-94 expiry date.",
      fields: [
        {
          key: "i539_current_status_code",
          label: "Current status code",
          type: "text",
          required: true,
          placeholder: "e.g. B-2; F-1; J-1; M-1",
          help: "The nonimmigrant status code on your current I-94.",
        },
        {
          key: "i539_i94_expiry",
          label: "Current I-94 expiry date",
          type: "date",
          required: true,
          help: "The \"Admit Until\" date on your I-94. The I-539 must be filed BEFORE this date.",
        },
        {
          key: "i539_filing_date",
          label: "Planned filing date",
          type: "date",
          required: true,
          help: "The date you plan to file. It must be before the I-94 expiry date.",
        },
        {
          key: "i539_requested_until",
          label: "Requested-until date",
          type: "date",
          required: true,
          help: "The date you are asking USCIS to extend / change your status until.",
        },
      ],
    },
    {
      id: "i539-applicants",
      title: "Applicants",
      fields: [
        {
          key: "i539_applicant_name",
          label: "Applicant full legal name",
          type: "text",
          required: true,
        },
        {
          key: "i539_coapplicants_count",
          label: "Number of co-applicants (Form I-539A)",
          type: "number",
          required: true,
          placeholder: "0",
          help: "How many co-applicants are included on Form I-539A (spouse / unmarried children under 21, if any). Enter 0 if none.",
        },
      ],
    },
  ],
  timelineValidators: [
    {
      id: "i539-before-i94-expiry",
      label: "Filed before the I-94 expiry date",
      description: "The I-539 must be filed BEFORE the current I-94 expires.",
      validate: (answers) =>
        isBeforeI94Expiry(answers.i539_i94_expiry ?? "", answers.i539_filing_date ?? ""),
    },
  ],
  documentSlotIds: [
    "i539-passport",
    "i539-i94",
    "i539-status-evidence",
    "i539-financial-support",
    "i539-coapplicants",
    "i539-photos",
  ],
  checklistTemplateId: "i539",
  nvcTracked: false,
};

// ---------------------------------------------------------------------------
// I-129F — Fiancé(e) K-1
// ---------------------------------------------------------------------------

const I129F_SCHEMA: DynamicIntakeSchema = {
  formCode: "I-129F",
  name: "I-129F — Petition for Alien Fiancé(e) (K-1)",
  goalLabel: "Fiancé(e) Visa — K-1 (I-129F)",
  summary:
    "Petition for a fiancé(e) outside the United States to come on a K-1 visa and marry within 90 days of entry. After USCIS approval the case transfers to NVC, then to the embassy for the interview.",
  tierPrices: { ...LOCKED_PREP_TIERS["I-129F"] },
  govFees: DYNAMIC_GOV_FEES["I-129F"],
  govTotalNote:
    "No single verified gov total: $675 USCIS + $265 K-1 visa fee at the embassy are both TO BE CONFIRMED. The $265 is paid at the embassy, not to USCIS. The total is TO BE CONFIRMED.",
  sections: [
    {
      id: "i129f-petitioner",
      title: "Petitioner",
      description: "The U.S. citizen petitioner.",
      fields: [
        {
          key: "i129f_petitioner_name",
          label: "Petitioner full legal name",
          type: "text",
          required: true,
        },
        {
          key: "i129f_petitioner_citizenship_proof",
          label: "Petitioner citizenship proof",
          type: "select",
          required: true,
          options: [
            "U.S. birth certificate",
            "U.S. passport",
            "Certificate of Naturalization",
            "Certificate of Citizenship",
          ],
          help: "How the petitioner proves U.S. citizenship. The document itself is collected in the checklist.",
        },
      ],
    },
    {
      id: "i129f-fiance",
      title: "Fiancé(e)",
      description: "The fiancé(e) abroad.",
      fields: [
        {
          key: "i129f_fiance_name",
          label: "Fiancé(e) full legal name",
          type: "text",
          required: true,
        },
        {
          key: "i129f_fiance_dob",
          label: "Fiancé(e) date of birth",
          type: "date",
          required: true,
        },
        {
          key: "i129f_embassy_city",
          label: "Embassy city for the K-1 interview",
          type: "text",
          required: true,
          placeholder: "e.g. Port-au-Prince; Santo Domingo; Manila",
          help: "The U.S. embassy or consulate city where the fiancé(e) will interview. This is also the NVC post city — see the K-1 NVC tracker in src/lib/nvc.ts.",
        },
      ],
    },
    {
      id: "i129f-meeting",
      title: "How You Met & Last Meeting",
      description:
        "The petitioner and fiancé(e) must have met in person within 2 years before filing.",
      fields: [
        {
          key: "i129f_last_meeting_date",
          label: "Last in-person meeting date",
          type: "date",
          required: true,
          help: "The most recent date you met in person. It must be within 2 years before filing.",
        },
        {
          key: "i129f_filing_date",
          label: "Planned filing date",
          type: "date",
          required: true,
          help: "The date you plan to file. The last meeting must be within 2 years before this date.",
        },
        {
          key: "i129f_how_met",
          label: "How and where you met",
          type: "textarea",
          required: true,
          placeholder: "e.g. We met in person in Port-au-Prince in…",
          help: "How and where you met, in your own words.",
        },
        {
          key: "i129f_intent_to_marry",
          label: "Intent to marry within 90 days of entry",
          type: "select",
          required: true,
          options: ["Yes — we intend to marry within 90 days of entry", "No"],
          help: "A K-1 fiancé(e) must marry the petitioner within 90 days of entering the United States.",
        },
      ],
    },
  ],
  timelineValidators: [
    {
      id: "i129f-meeting-within-2-years",
      label: "Last in-person meeting within 2 years",
      description:
        "The petitioner and fiancé(e) must have met in person within 2 years before filing.",
      validate: (answers) =>
        isMeetingWithin2Years(answers.i129f_last_meeting_date ?? "", answers.i129f_filing_date ?? ""),
    },
  ],
  documentSlotIds: [
    "i129f-petitioner-citizenship",
    "i129f-fiance-passport",
    "i129f-meeting-evidence",
    "i129f-intent-to-marry",
    "i129f-photos",
    "i129f-nvc-case",
  ],
  checklistTemplateId: "i129f",
  nvcTracked: true,
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const DYNAMIC_INTAKE_SCHEMAS: DynamicIntakeSchema[] = [
  I131_SCHEMA,
  I751_SCHEMA,
  I539_SCHEMA,
  I129F_SCHEMA,
];

export function getDynamicSchema(formCode: DynamicFormCode): DynamicIntakeSchema | null {
  return DYNAMIC_INTAKE_SCHEMAS.find((s) => s.formCode === formCode) ?? null;
}

export function isDynamicFormCode(value: string): value is DynamicFormCode {
  return (DYNAMIC_FORM_CODES as string[]).includes(value);
}

/** Visible fields for a section, honouring showWhen conditions. */
export function visibleFieldsForSection(
  section: DynamicSection,
  answers: Record<string, string>
): DynamicField[] {
  return section.fields.filter((field) => {
    if (!field.showWhen) return true;
    const current = answers[field.showWhen.field] ?? "";
    return field.showWhen.equals.includes(current);
  });
}

/** Run every timeline validator for a schema against the answers. */
export function runTimelineValidators(
  schema: DynamicIntakeSchema,
  answers: Record<string, string>
): { validatorId: string; label: string; ok: boolean; message: string }[] {
  return schema.timelineValidators.map((validator) => {
    const result = validator.validate(answers);
    return {
      validatorId: validator.id,
      label: validator.label,
      ok: result.ok,
      message: result.message,
    };
  });
}

/** True only when every timeline validator passes. */
export function timelinesPass(
  schema: DynamicIntakeSchema,
  answers: Record<string, string>
): boolean {
  return runTimelineValidators(schema, answers).every((r) => r.ok);
}

// ============================================================================
// FULL REGISTRY — all intake forms, ONE registry shared by Self-Filing
// Clients (DIY) and Document Preparers (added 2026-11-19).
// ---------------------------------------------------------------------------
// STATUS: EVERY schema below is a DRAFT INTAKE MAPPING, not the official
// USCIS form. The field lists here are intake prompts in plain English
// written for this portal — they are NOT the official USCIS form field
// lists, and no schema here is the official form. Every schema carries
// the draft notice below, and the engine shows it on every form page:
//   "Draft intake mapping — check against the current USCIS form edition
//    at uscis.gov before filing"
// Field mappings to the official PDFs are UNVERIFIED — see
// src/lib/uscisFieldMappings.ts. Templates come from uscis.gov only.
//
// This registry EXTENDS (does not replace) the four expanded-form
// schemas above (I-131, I-751, I-539, I-129F), which keep their own
// tier / gov-fee / date-validator shape for the Smart Intake
// Calculator. The registry below covers all 15 intake forms
// (I-130, I-485, DS-260, I-864, N-400, I-821, I-765, I-589, I-90,
// I-131, I-751, I-539, I-129F, I-864A, I-130A) with sections, fields,
// required 5-year timeline validators and document slots, so the
// DynamicFormIntakeEngine renders ONLY the sections for the forms
// selected. Names in this section are prefixed `Registry*` to avoid
// colliding with the expanded-form types above.
//
// DOCUMENT SLOTS: reused from src/lib/formChecklists.ts — this file
// does NOT duplicate those checklists. checklistSlotsForForm() pulls
// the checklist rows for a form code out of FORM_CHECKLIST_TEMPLATES.
// Verified 2026-11-19: all 15 registry forms have checklist rows in
// formChecklists.ts (I-130 10, I-130A 2, I-485 10, DS-260 5, I-864 14,
// I-864A 1, N-400 6, I-821 4, I-765 4, I-589 5, I-90 5, I-131 8,
// I-751 7, I-539 5, I-129F 6) — every registry slot is source
// "formChecklists". The draftSlots() fallback below is used ONLY if a
// form ever has no checklist rows; those slots are labelled draft and
// must be verified against uscis.gov.
//
// SENSITIVE FIELDS: SSN, A-Number, green card number and passport
// number are SENSITIVE. They are masked in the UI (***-**-1234), never
// shown in full in any list or log, never logged, and stored only in
// questionnaire_responses / the vault under the existing RLS
// (migration 0005). See maskSensitiveValue() and the `sensitive` flag.
//
// I-485 ADMISSIBILITY: this engine does NOT decide admissibility and
// does NOT invent admissibility checkbox answers. The I-485 schema
// carries a note instead: "Admissibility questions are on the official
// I-485 — answer them on the form itself, this engine does not decide
// admissibility."
//
// I-589: clerical prep only, with the attorney warning. Nothing here
// is legal advice and nothing guarantees an outcome.
// ============================================================================

export const DRAFT_SCHEMA_NOTICE =
  "Draft intake mapping — check against the current USCIS form edition at uscis.gov before filing";

export const PREPARER_BLOCK_NOTICE =
  "Preparer block per the current form edition — verify the block location on the official form";

export const ADMISSIBILITY_NOTE =
  "Admissibility questions are on the official I-485 — answer them on the form itself, this engine does not decide admissibility";

export const DS260_SOCIAL_MEDIA_LABEL =
  "Social media identifiers used in the last 5 years (DS-260 asks for social media identifiers used in the last 5 years — enter exactly what the form asks for, do not add passwords)";

export const GOV_PAYMENT_RULE =
  "Paper filings require G-1450 or G-1650 — no personal checks or money orders.";

// ---------------------------------------------------------------------------
// Registry types
// ---------------------------------------------------------------------------

export type RegistryFieldType =
  | "text"
  | "date"
  | "number"
  | "select"
  | "checkbox_group"
  | "timeline_5yr"
  | "note";

export interface RegistryField {
  /** Stable key stored in questionnaire_responses.question_key. */
  name: string;
  /** Plain-English label shown to the client. */
  label: string;
  type: RegistryFieldType;
  required: boolean;
  /** True for SSN / A-Number / green card number / passport number:
   *  masked in the UI, never shown in full in lists/logs, never logged. */
  sensitive?: boolean;
  options?: string[];
  /** Extra plain-English help shown under the field. */
  help?: string;
  /** For type "note": the informational text shown (not an answer). */
  note?: string;
}

export interface RegistrySection {
  id: string;
  heading: string;
  /** Section-level note, e.g. the I-485 admissibility note. */
  note?: string;
  fields: RegistryField[];
}

/** One document upload slot for a form. */
export interface RegistryDocumentSlot {
  id: string;
  title: string;
  formCode: string;
  assignedTo: string;
  translationRequired: boolean;
  vaultCategory: ChecklistVaultCategory;
  blocking: boolean;
  condition?: string;
  /** "formChecklists" = reused from lib/formChecklists.ts.
   *  "draft-intake-slot" = no checklist template exists for this form
   *  yet in formChecklists.ts; draft only, verify at uscis.gov. */
  source: "formChecklists" | "draft-intake-slot";
  sourceNote?: string;
}

/** 5-year timeline validators a form requires (checked with
 *  src/lib/validator.ts validateTimeline — do NOT build a second
 *  validator). Empty when the form needs no 5-year timeline. */
export type RegistryTimelineKind = "address_5yr" | "employment_5yr";

export interface RegistryFormSchema {
  formCode: string;
  title: string;
  /** Draft notice shown on every page for this form. */
  draftNotice: string;
  /** True for red-flag forms (I-589 here): stronger attorney warning,
   *  never a lock on filing. */
  redFlag: boolean;
  /** Plain-English attorney warning shown when redFlag is true. */
  attorneyWarning?: string;
  timelineValidators: RegistryTimelineKind[];
  sections: RegistrySection[];
  /** Document upload slots — reused from formChecklists where they
   *  exist, draft slots where they do not (see header). */
  documentSlots: RegistryDocumentSlot[];
  /** Honest note about where the document slots came from. */
  checklistCoverageNote: string;
  /** True when this form is clerical prep only (I-589). */
  clericalOnly?: boolean;
  /** True when the form is included free with another form (I-130A). */
  includedFreeWith?: string;
}

// ---------------------------------------------------------------------------
// Red-flag forms / case types — stronger warning + attorney
// recommendation, NEVER a lock. The client always keeps the option to
// file DIY or with a preparer.
// ---------------------------------------------------------------------------

export const RED_FLAG_FORM_CODES = ["I-589", "I-601", "I-601A", "I-212"] as const;

export const RED_FLAG_CASE_TYPES = [
  "I-589 Asylum",
  "I-601 Waiver",
  "I-601A Provisional Waiver",
  "I-212 Permission to Return",
  "VAWA",
  "U Visa",
  "T Visa",
  "Complex RFE / NOID",
] as const;

export const RED_FLAG_WARNING =
  "This is a red-flag case type. An attorney can protect you — a wrong answer or a missed deadline can hurt your case. We strongly recommend talking to a licensed attorney or a DOJ-accredited representative before you file. This is a warning, not a lock: you can still choose DIY, a preparer, or an attorney below.";

export const ATTORNEY_OPTION_LINE =
  "Get an attorney — an attorney can protect you";

// ---------------------------------------------------------------------------
// Sensitive-value masking — last 4 characters only, never the full value.
// Use for every list, log line and summary. Never log a sensitive value.
// ---------------------------------------------------------------------------

export function maskSensitiveValue(value: string): string {
  const digits = value.replace(/[^0-9A-Za-z]/g, "");
  if (!digits) return "";
  if (digits.length <= 4) return `***-${digits}`;
  return `***-**-${digits.slice(-4)}`;
}

/** True when a field is a sensitive identifier field. */
export function isSensitiveField(field: RegistryField): boolean {
  return field.sensitive === true;
}

// ---------------------------------------------------------------------------
// Document slots — reused from lib/formChecklists.ts (never duplicated).
// ---------------------------------------------------------------------------

/** Checklist rows for one form code, pulled from FORM_CHECKLIST_TEMPLATES. */
export function checklistSlotsForForm(formCode: string): RegistryDocumentSlot[] {
  const seen = new Set<string>();
  const slots: RegistryDocumentSlot[] = [];
  for (const template of FORM_CHECKLIST_TEMPLATES) {
    for (const item of template.checklist) {
      if (item.formCode !== formCode) continue;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      slots.push({
        id: item.id,
        title: item.title,
        formCode: item.formCode,
        assignedTo: item.assignedTo,
        translationRequired: item.translationRequired,
        vaultCategory: item.vaultCategory,
        blocking: item.blocking,
        condition: item.condition,
        source: "formChecklists",
      });
    }
  }
  return slots;
}

/** Fallback draft slots, used ONLY if a form has no checklist rows in
 *  formChecklists.ts. Labelled draft — verify against uscis.gov.
 *  (Verified 2026-11-19: all 15 registry forms currently have
 *  checklist rows, so this fallback is not in use.) */
function draftSlots(
  formCode: string,
  slots: Array<Omit<RegistryDocumentSlot, "formCode" | "source" | "sourceNote">>
): RegistryDocumentSlot[] {
  return slots.map((s) => ({
    ...s,
    formCode,
    source: "draft-intake-slot" as const,
    sourceNote:
      `No checklist template for ${formCode} exists in src/lib/formChecklists.ts yet — ` +
      "draft slot only, verify against uscis.gov before relying on it.",
  }));
}

const REGISTRY_DRAFT_SLOTS_BY_FORM: Record<string, RegistryDocumentSlot[]> = {
  "I-751": draftSlots("I-751", [
    { id: "i751-greencard", title: "Conditional green card (front and back)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", blocking: true },
    { id: "i751-marriage-proof", title: "Proof of bona fide marriage (joint lease / mortgage, joint bank statements, joint tax returns, photos)", assignedTo: "Primary Client", translationRequired: true, vaultCategory: "Relationship Proof", blocking: true },
    { id: "i751-children", title: "Birth certificates of children of the marriage (if any)", assignedTo: "Primary Client", translationRequired: true, vaultCategory: "Relationship Proof", blocking: false },
  ]),
  "I-539": draftSlots("I-539", [
    { id: "i539-passport", title: "Passport bio page", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", blocking: true },
    { id: "i539-i94", title: "I-94 arrival / departure record", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "USCIS Notices", blocking: true },
    { id: "i539-support", title: "Proof of financial support for the extended stay", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Financial/Tax", blocking: true },
    { id: "i539-status", title: "Proof of current lawful status", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "USCIS Notices", blocking: true },
  ]),
  "I-129F": draftSlots("I-129F", [
    { id: "i129f-pet-passport", title: "Petitioner passport / ID (proof of U.S. citizenship)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", blocking: true },
    { id: "i129f-ben-passport", title: "Beneficiary (fiancé(e)) passport", assignedTo: "Spouse-Beneficiary", translationRequired: false, vaultCategory: "Identity", blocking: true },
    { id: "i129f-met", title: "Proof you met in person in the last 2 years (photos, travel records, stamps)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Relationship Proof", blocking: true },
    { id: "i129f-intent", title: "Signed statements of intent to marry within 90 days of arrival", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Relationship Proof", blocking: true },
  ]),
};

// ---------------------------------------------------------------------------
// Field helpers (keep the per-form lists readable)
// ---------------------------------------------------------------------------

function rf(
  name: string,
  label: string,
  type: RegistryFieldType,
  required: boolean,
  extra?: Partial<RegistryField>
): RegistryField {
  return { name, label, type, required, ...extra };
}

function rNoteField(name: string, label: string, note: string): RegistryField {
  return { name, label, type: "note", required: false, note };
}

function rTimelineField(name: string, label: string, required = true): RegistryField {
  return {
    name,
    label,
    type: "timeline_5yr",
    required,
    help: "List every address and job for the last 5 years, with dates. Date gaps block submission — add an entry to close each gap.",
  };
}

const rPersonName = (prefix: string, who: string) => [
  rf(`${prefix}_full_name`, `What is the ${who}'s full legal name?`, "text", true),
  rf(`${prefix}_date_of_birth`, `What is the ${who}'s date of birth?`, "date", true),
  rf(`${prefix}_country_of_birth`, `What country was the ${who} born in?`, "text", true),
];

const rSensitive = {
  ssn: (prefix: string) =>
    rf(`${prefix}_ssn`, "Social Security number (if you have one)", "text", false, {
      sensitive: true,
      help: "Sensitive — masked in this portal (***-**-1234). Never shown in full in lists or logs.",
    }),
  aNumber: (prefix: string) =>
    rf(`${prefix}_a_number`, "A-Number (Alien Registration Number, if you have one)", "text", false, {
      sensitive: true,
      help: "Sensitive — masked in this portal (***-**-1234). Never shown in full in lists or logs.",
    }),
  greenCard: (prefix: string) =>
    rf(`${prefix}_green_card_number`, "Green card number (if you have one)", "text", false, {
      sensitive: true,
      help: "Sensitive — masked in this portal (***-**-1234). Never shown in full in lists or logs.",
    }),
  passport: (prefix: string) =>
    rf(`${prefix}_passport_number`, "Passport number", "text", true, {
      sensitive: true,
      help: "Sensitive — masked in this portal (***-**-1234). Never shown in full in lists or logs.",
    }),
};

// ---------------------------------------------------------------------------
// Raw registry schemas (sections + fields). Document slots are attached
// below from formChecklists.ts / draft slots — never written out twice.
// ---------------------------------------------------------------------------

type RawRegistrySchema = Omit<RegistryFormSchema, "documentSlots" | "checklistCoverageNote">;

const RAW_REGISTRY_SCHEMAS: RawRegistrySchema[] = [
  {
    formCode: "I-130",
    title: "Petition for Alien Relative",
    draftNotice: DRAFT_SCHEMA_NOTICE,
    redFlag: false,
    timelineValidators: ["address_5yr", "employment_5yr"],
    sections: [
      {
        id: "i130-petitioner",
        heading: "Petitioner — about you",
        fields: [
          ...rPersonName("i130_petitioner", "petitioner"),
          rf("i130_petitioner_address", "What is the petitioner's current mailing address?", "text", true),
          rf("i130_petitioner_phone", "Petitioner's phone number", "text", false),
          rf("i130_petitioner_email", "Petitioner's email address", "text", false),
          rSensitive.ssn("i130_petitioner"),
        ],
      },
      {
        id: "i130-beneficiary",
        heading: "Beneficiary — the relative you are petitioning for",
        fields: [
          ...rPersonName("i130_beneficiary", "beneficiary"),
          rSensitive.passport("i130_beneficiary"),
          rf("i130_relationship", "How is the beneficiary related to you?", "select", true, {
            options: ["Spouse", "Child (unmarried, under 21)", "Child (unmarried, 21 or older)", "Parent", "Brother or sister"],
          }),
          rf("i130_beneficiary_address", "What is the beneficiary's current address?", "text", true),
        ],
      },
      {
        id: "i130-marriage",
        heading: "Marriage / relationship",
        fields: [
          rf("i130_marriage_date", "When did you get married? (spouse petitions)", "date", false),
          rf("i130_marriage_place", "Where did you get married? (city, state / country)", "text", false),
          rf("i130_prior_marriages", "Has either of you been married before?", "select", false, {
            options: ["No", "Yes — petitioner was married before", "Yes — beneficiary was married before", "Yes — both were married before"],
          }),
          rf("i130_bona_fide_evidence", "What proof of a real relationship can you provide? (joint bank account, lease, photos, messages — list what you have)", "text", false),
        ],
      },
      {
        id: "i130-timeline",
        heading: "5-year address & work history",
        fields: [rTimelineField("i130_history_5y", "Address & work history for the last 5 years")],
      },
    ],
  },
  {
    formCode: "I-130A",
    title: "Supplemental Information for Spouse Beneficiary",
    draftNotice: DRAFT_SCHEMA_NOTICE,
    redFlag: false,
    timelineValidators: ["address_5yr", "employment_5yr"],
    includedFreeWith: "I-130",
    sections: [
      {
        id: "i130a-spouse",
        heading: "Spouse beneficiary — about you",
        note: "Form I-130A is included free with Form I-130. It is filed together with the I-130 for a spouse beneficiary.",
        fields: [
          ...rPersonName("i130a_spouse", "spouse beneficiary"),
          rf("i130a_spouse_address", "What is the spouse beneficiary's current address?", "text", true),
          rSensitive.ssn("i130a_spouse"),
        ],
      },
      {
        id: "i130a-history",
        heading: "Address & work history (last 5 years)",
        fields: [rTimelineField("i130a_history_5y", "Address & work history for the last 5 years")],
      },
      {
        id: "i130a-marriages",
        heading: "Prior marriages",
        fields: [
          rf("i130a_prior_marriages", "Have you been married before?", "select", true, {
            options: ["No", "Yes"],
          }),
          rf("i130a_prior_marriage_detail", "If yes, when and how did the prior marriage end?", "text", false),
        ],
      },
    ],
  },
  {
    formCode: "I-485",
    title: "Application to Register Permanent Residence or Adjust Status",
    draftNotice: DRAFT_SCHEMA_NOTICE,
    redFlag: false,
    timelineValidators: ["address_5yr", "employment_5yr"],
    sections: [
      {
        id: "i485-applicant",
        heading: "Applicant — about you",
        fields: [
          ...rPersonName("i485_applicant", "applicant"),
          rSensitive.aNumber("i485_applicant"),
          rSensitive.ssn("i485_applicant"),
          rSensitive.passport("i485_applicant"),
          rf("i485_applicant_address", "What is your current mailing address in the United States?", "text", true),
          rf("i485_applicant_phone", "Your phone number", "text", false),
          rf("i485_applicant_email", "Your email address", "text", false),
        ],
      },
      {
        id: "i485-entry",
        heading: "Last arrival & current status",
        fields: [
          rf("i485_last_arrival_date", "When did you last arrive in the United States?", "date", true),
          rf("i485_last_arrival_place", "Where did you last arrive? (city / port of entry)", "text", true),
          rf("i485_i94_number", "I-94 number (if you have one)", "text", false),
          rf("i485_current_status", "What is your current immigration status?", "select", true, {
            options: ["Visitor (B-1/B-2)", "Student (F-1)", "Temporary Protected Status (TPS)", "Asylum applicant (pending)", "Parolee", "Other", "No current status"],
          }),
          rf("i485_visa_category", "What immigrant visa category are you adjusting under? (for example: immediate relative of a U.S. citizen)", "text", false),
        ],
      },
      {
        id: "i485-timeline",
        heading: "5-year address, work & travel history",
        fields: [rTimelineField("i485_history_5y", "Address, work & travel history for the last 5 years")],
      },
      {
        id: "i485-medical",
        heading: "Medical exam",
        fields: [
          rf("i485_i693_status", "Do you have a sealed Form I-693 medical exam from the doctor?", "select", true, {
            options: ["Yes — I have the sealed envelope", "No — not yet", "Appointment booked"],
          }),
        ],
      },
      {
        id: "i485-admissibility",
        heading: "Admissibility questions",
        note: ADMISSIBILITY_NOTE,
        fields: [
          rNoteField(
            "i485_admissibility_note",
            "About the admissibility questions",
            ADMISSIBILITY_NOTE +
              ". Do not answer admissibility questions here — answer them on the official I-485 form itself. If any answer may be a problem, get an attorney before you file (see the attorney option on this page)."
          ),
        ],
      },
    ],
  },
  {
    formCode: "DS-260",
    title: "Immigrant Visa Application (Online, for consular processing)",
    draftNotice: DRAFT_SCHEMA_NOTICE,
    redFlag: false,
    timelineValidators: ["address_5yr", "employment_5yr"],
    sections: [
      {
        id: "ds260-applicant",
        heading: "Applicant — about you",
        fields: [
          ...rPersonName("ds260_applicant", "applicant"),
          rSensitive.passport("ds260_applicant"),
          rf("ds260_nationality", "What is your nationality?", "text", true),
          rf("ds260_nvc_case_number", "NVC case number (if you have it)", "text", false),
        ],
      },
      {
        id: "ds260-history",
        heading: "Address, work & travel history (last 5 years)",
        fields: [rTimelineField("ds260_history_5y", "Address, work & travel history for the last 5 years")],
      },
      {
        id: "ds260-social",
        heading: "Social media",
        fields: [
          rf("ds260_social_media", DS260_SOCIAL_MEDIA_LABEL, "text", false, {
            help: "DS-260 asks for social media identifiers used in the last 5 years — enter exactly what the form asks for, do not add passwords.",
          }),
        ],
      },
      {
        id: "ds260-family",
        heading: "Family",
        fields: [
          rf("ds260_spouse_name", "Spouse's full legal name (if married)", "text", false),
          rf("ds260_children", "Children's full names and dates of birth (if any)", "text", false),
        ],
      },
      {
        id: "ds260-background",
        heading: "Background questions",
        fields: [
          rNoteField(
            "ds260_background_note",
            "About the background questions",
            "Answer the background and security questions on the official DS-260 in CEAC itself. This engine does not decide admissibility or eligibility."
          ),
        ],
      },
    ],
  },
  {
    formCode: "I-864",
    title: "Affidavit of Support",
    draftNotice: DRAFT_SCHEMA_NOTICE,
    redFlag: false,
    timelineValidators: [],
    sections: [
      {
        id: "i864-sponsor",
        heading: "Sponsor — about you",
        fields: [
          ...rPersonName("i864_sponsor", "sponsor"),
          rSensitive.ssn("i864_sponsor"),
          rf("i864_sponsor_address", "What is the sponsor's current address in the United States?", "text", true),
          rf("i864_sponsor_status", "What is the sponsor's status?", "select", true, {
            options: ["U.S. citizen", "Lawful permanent resident", "U.S. national"],
          }),
          rf("i864_sponsor_domicile", "Is the sponsor living in the United States (domiciled here)?", "select", true, {
            options: ["Yes — living in the United States", "No — living abroad (temporarily)"],
          }),
        ],
      },
      {
        id: "i864-income",
        heading: "Household size & income",
        note: "Income is checked against the 2026 Form I-864P guidelines (125% of the poverty guidelines, 100% for active-duty military). See src/lib/formChecklists.ts SPONSOR_125_2026 — verify against the current Form I-864P at uscis.gov.",
        fields: [
          rf("i864_household_size", "How many people are in the sponsor's household? (sponsor + spouse + children + intending immigrants + others)", "number", true),
          rf("i864_annual_income", "What is the sponsor's current annual income in U.S. dollars?", "number", true),
          rf("i864_employment", "Where does the sponsor work now? (employer name and job title)", "text", false),
          rf("i864_tax_transcripts", "Do you have the most recent year's IRS tax transcript (or complete Form 1040 with all W-2s and 1099s)?", "select", true, {
            options: ["Yes — I have the transcript", "Yes — I have the 1040 + W-2s / 1099s", "No — not yet"],
          }),
        ],
      },
      {
        id: "i864-joint",
        heading: "Joint sponsor / household member",
        fields: [
          rf("i864_needs_joint_sponsor", "Is a joint sponsor needed because the sponsor's income is below the required amount?", "select", true, {
            options: ["No", "Yes — a joint sponsor will file their own I-864", "Not sure — check the 2026 table first"],
          }),
          rf("i864a_household_member", "Is a household member adding income or assets on Form I-864A?", "select", false, {
            options: ["No", "Yes — a household member will file Form I-864A"],
          }),
        ],
      },
    ],
  },
  {
    formCode: "I-864A",
    title: "Contract Between Sponsor and Household Member",
    draftNotice: DRAFT_SCHEMA_NOTICE,
    redFlag: false,
    timelineValidators: [],
    sections: [
      {
        id: "i864a-member",
        heading: "Household member — about you",
        note: "Form I-864A is filed by a household member who lives with the sponsor and is adding their income or assets to the sponsor's I-864.",
        fields: [
          ...rPersonName("i864a_member", "household member"),
          rSensitive.ssn("i864a_member"),
          rf("i864a_relationship", "How is the household member related to the sponsor?", "select", true, {
            options: ["Spouse", "Parent", "Child (21 or older)", "Sibling", "Other relative living at the same address"],
          }),
          rf("i864a_address", "What is the household member's address? (must be the sponsor's address)", "text", true),
        ],
      },
      {
        id: "i864a-income",
        heading: "Income & assets",
        fields: [
          rf("i864a_annual_income", "What is the household member's current annual income in U.S. dollars?", "number", true),
          rf("i864a_assets", "What assets is the household member adding, if any? (bank accounts, property — list them)", "text", false),
          rNoteField(
            "i864a_sign_note",
            "Signing",
            "The household member signs Form I-864A. The sponsor's I-864 and this I-864A are filed together — verify the signature block on the current form edition."
          ),
        ],
      },
    ],
  },
  {
    formCode: "N-400",
    title: "Application for Naturalization",
    draftNotice: DRAFT_SCHEMA_NOTICE,
    redFlag: false,
    timelineValidators: ["address_5yr", "employment_5yr"],
    sections: [
      {
        id: "n400-applicant",
        heading: "Applicant — about you",
        fields: [
          ...rPersonName("n400_applicant", "applicant"),
          rSensitive.greenCard("n400_applicant"),
          rSensitive.aNumber("n400_applicant"),
          rSensitive.ssn("n400_applicant"),
          rf("n400_applicant_address", "What is your current mailing address?", "text", true),
        ],
      },
      {
        id: "n400-eligibility",
        heading: "Eligibility",
        fields: [
          rf("n400_lpr_since", "When did you become a lawful permanent resident? (date on your green card)", "date", true),
          rf("n400_basis", "What is your basis for naturalization?", "select", true, {
            options: ["5 years as a permanent resident", "3 years as a permanent resident married to the same U.S. citizen", "Other"],
          }),
          rf("n400_trips_abroad", "Have you travelled outside the United States in the last 5 years? List each trip with dates (or write 'None').", "text", true),
        ],
      },
      {
        id: "n400-timeline",
        heading: "5-year address & work history",
        fields: [rTimelineField("n400_history_5y", "Address & work history for the last 5 years")],
      },
      {
        id: "n400-family",
        heading: "Marriage & children",
        fields: [
          rf("n400_marital_status", "What is your marital status?", "select", true, {
            options: ["Single", "Married", "Divorced", "Widowed", "Separated"],
          }),
          rf("n400_spouse_name", "Spouse's full legal name (if married)", "text", false),
          rf("n400_children_count", "How many children do you have?", "number", false),
        ],
      },
      {
        id: "n400-disclosure",
        heading: "Arrests, citations & removals",
        fields: [
          rNoteField(
            "n400_disclosure_note",
            "Answer honestly on the official form",
            "Answer the questions about arrests, citations, removals and other history honestly on the official N-400 form itself. Do not hide anything — hiding an answer can hurt your case more than the answer itself. If any answer may be a problem, get an attorney before you file (see the attorney option on this page)."
          ),
        ],
      },
    ],
  },
  {
    formCode: "I-821",
    title: "Application for Temporary Protected Status",
    draftNotice: DRAFT_SCHEMA_NOTICE,
    redFlag: false,
    timelineValidators: ["address_5yr"],
    sections: [
      {
        id: "i821-applicant",
        heading: "Applicant — about you",
        fields: [
          ...rPersonName("i821_applicant", "applicant"),
          rSensitive.aNumber("i821_applicant"),
          rSensitive.passport("i821_applicant"),
          rf("i821_applicant_address", "What is your current mailing address in the United States?", "text", true),
        ],
      },
      {
        id: "i821-tps",
        heading: "TPS eligibility",
        fields: [
          rf("i821_country", "What country are you claiming TPS for?", "text", true),
          rf("i821_continuous_residence_since", "When did your continuous residence in the United States begin?", "date", true),
          rf("i821_last_arrival_date", "When did you last arrive in the United States?", "date", true),
          rf("i821_first_time_or_reregistration", "Is this a first-time TPS application or a re-registration?", "select", true, {
            options: ["First-time application", "Re-registration"],
          }),
        ],
      },
      {
        id: "i821-timeline",
        heading: "Address history (continuous residence)",
        fields: [rTimelineField("i821_history_5y", "Address history for the last 5 years (proof of continuous residence)")],
      },
      {
        id: "i821-ead",
        heading: "Work permit (I-765 filed with TPS)",
        fields: [
          rf("i821_want_ead", "Do you also want a work permit (Form I-765) with this TPS application?", "select", true, {
            options: ["Yes", "No"],
          }),
          rf("i821_ead_category", "I-765 eligibility category", "select", false, {
            options: ["(a)(12) — TPS", "(c)(19) — TPS applicant", "Other"],
          }),
        ],
      },
    ],
  },
  {
    formCode: "I-765",
    title: "Application for Employment Authorization",
    draftNotice: DRAFT_SCHEMA_NOTICE,
    redFlag: false,
    timelineValidators: [],
    sections: [
      {
        id: "i765-applicant",
        heading: "Applicant — about you",
        fields: [
          ...rPersonName("i765_applicant", "applicant"),
          rSensitive.aNumber("i765_applicant"),
          rSensitive.ssn("i765_applicant"),
          rf("i765_applicant_address", "What is your current mailing address?", "text", true),
        ],
      },
      {
        id: "i765-category",
        heading: "Eligibility category",
        fields: [
          rf("i765_category", "Which eligibility category are you applying under?", "select", true, {
            options: [
              "(c)(3)(B) — F-1 student, pre-completion OPT",
              "(c)(3)(C) — F-1 student, STEM OPT extension",
              "(c)(8) — Asylum application pending",
              "(c)(9) — Adjustment of status pending (I-485)",
              "(a)(12) — Temporary Protected Status",
              "(c)(19) — TPS applicant",
              "Other — write the category in the next field",
            ],
          }),
          rf("i765_category_other", "If 'Other', write the category here", "text", false),
        ],
      },
      {
        id: "i765-prior",
        heading: "Prior work permit",
        fields: [
          rf("i765_had_prior_ead", "Have you had a work permit (EAD) before?", "select", true, {
            options: ["No", "Yes"],
          }),
          rf("i765_prior_ead_expiry", "If yes, when did (or does) your last work permit expire?", "date", false),
        ],
      },
    ],
  },
  {
    formCode: "I-589",
    title: "Application for Asylum and for Withholding of Removal",
    draftNotice: DRAFT_SCHEMA_NOTICE,
    redFlag: true,
    attorneyWarning: RED_FLAG_WARNING,
    clericalOnly: true,
    timelineValidators: ["address_5yr"],
    sections: [
      {
        id: "i589-warning",
        heading: "Before you start — read this",
        note: RED_FLAG_WARNING,
        fields: [
          rNoteField(
            "i589_clerical_note",
            "Clerical prep only",
            "This is clerical prep only. We prepare the form from your own words and documents — this is not legal advice, and nothing here guarantees any outcome. " +
              RED_FLAG_WARNING
          ),
        ],
      },
      {
        id: "i589-applicant",
        heading: "Applicant — about you",
        fields: [
          ...rPersonName("i589_applicant", "applicant"),
          rSensitive.aNumber("i589_applicant"),
          rSensitive.passport("i589_applicant"),
          rf("i589_applicant_address", "What is your current mailing address in the United States?", "text", true),
          rf("i589_nationality", "What is your nationality?", "text", true),
        ],
      },
      {
        id: "i589-entry",
        heading: "Arrival & the one-year deadline",
        note: "Asylum generally must be filed within one year of your last arrival in the United States. Check your deadline — if the year has passed, get an attorney before you file.",
        fields: [
          rf("i589_last_arrival_date", "When did you last arrive in the United States?", "date", true),
          rf("i589_last_arrival_place", "Where did you last arrive?", "text", true),
          rf("i589_current_status", "What is your current immigration status, if any?", "text", false),
        ],
      },
      {
        id: "i589-claim",
        heading: "Your claim — in your own words",
        fields: [
          rf("i589_why_afraid", "Why are you afraid to return to your country? Write it in your own words, in your own language if you prefer.", "text", true),
          rf("i589_harm_feared", "What harm do you fear if you return?", "text", true),
          rf("i589_who_harmed", "Who harmed you or threatened you, if anyone?", "text", false),
          rf("i589_evidence_list", "What evidence do you have? (country reports, witness statements, medical records, photos — list what you have)", "text", false),
        ],
      },
      {
        id: "i589-derivatives",
        heading: "Spouse & children (derivatives)",
        fields: [
          rf("i589_spouse_name", "Spouse's full legal name (if included)", "text", false),
          rf("i589_children", "Children's full names and dates of birth (if included — unmarried children under 21)", "text", false),
        ],
      },
      {
        id: "i589-timeline",
        heading: "Address history (last 5 years)",
        fields: [rTimelineField("i589_history_5y", "Address history for the last 5 years")],
      },
    ],
  },
  {
    formCode: "I-90",
    title: "Application to Replace Permanent Resident Card",
    draftNotice: DRAFT_SCHEMA_NOTICE,
    redFlag: false,
    timelineValidators: [],
    sections: [
      {
        id: "i90-applicant",
        heading: "Applicant — about you",
        fields: [
          ...rPersonName("i90_applicant", "applicant"),
          rSensitive.aNumber("i90_applicant"),
          rSensitive.greenCard("i90_applicant"),
          rf("i90_applicant_address", "What is your current mailing address?", "text", true),
        ],
      },
      {
        id: "i90-reason",
        heading: "Why do you need a new card?",
        fields: [
          rf("i90_reason", "Why do you need a replacement card?", "select", true, {
            options: [
              "My card is expiring (or has expired)",
              "My card was lost",
              "My card was stolen",
              "My card was damaged",
              "My card has incorrect information",
              "I never received my card",
              "Other",
            ],
          }),
          rf("i90_card_expiry", "When does (or did) your current card expire?", "date", false),
          rf("i90_police_report", "If the card was stolen, do you have a police report?", "select", false, {
            options: ["Yes", "No", "Not applicable — the card was not stolen"],
          }),
        ],
      },
    ],
  },
  {
    formCode: "I-131",
    title: "Application for Travel Document (Advance Parole / Re-entry Permit)",
    draftNotice: DRAFT_SCHEMA_NOTICE,
    redFlag: false,
    timelineValidators: [],
    sections: [
      {
        id: "i131-applicant",
        heading: "Applicant — about you",
        fields: [
          ...rPersonName("i131_applicant", "applicant"),
          rSensitive.aNumber("i131_applicant"),
          rf("i131_current_status", "What is your current immigration status?", "select", true, {
            options: ["Adjustment of status pending (I-485)", "Temporary Protected Status (TPS)", "Asylum applicant (pending)", "Lawful permanent resident", "Other"],
          }),
          rf("i131_applicant_address", "What is your current mailing address in the United States?", "text", true),
        ],
      },
      {
        id: "i131-travel",
        heading: "Your planned travel",
        note: "Do not travel outside the United States before Advance Parole is approved unless an attorney tells you it is safe — travelling without it can end your pending case.",
        fields: [
          rf("i131_travel_purpose", "Why do you need to travel?", "select", true, {
            options: ["Humanitarian — family emergency / medical", "Educational", "Employment", "Other"],
          }),
          rf("i131_travel_purpose_detail", "Explain the reason for travel in your own words", "text", true),
          rf("i131_departure_date", "When do you plan to leave the United States?", "date", false),
          rf("i131_return_date", "When do you plan to return?", "date", false),
          rf("i131_trip_length", "How long will the trip be? (days)", "number", false),
          rf("i131_countries", "Which countries will you visit?", "text", false),
        ],
      },
      {
        id: "i131-document",
        heading: "Which document are you applying for?",
        fields: [
          rf("i131_document_type", "Which travel document do you need?", "select", true, {
            options: ["Advance Parole Document", "Re-entry Permit", "Refugee Travel Document", "Emergency Advance Parole"],
          }),
        ],
      },
    ],
  },
  {
    formCode: "I-751",
    title: "Petition to Remove Conditions on Residence",
    draftNotice: DRAFT_SCHEMA_NOTICE,
    redFlag: false,
    timelineValidators: ["address_5yr", "employment_5yr"],
    sections: [
      {
        id: "i751-petitioner",
        heading: "Conditional resident — about you",
        fields: [
          ...rPersonName("i751_petitioner", "conditional resident"),
          rSensitive.aNumber("i751_petitioner"),
          rSensitive.greenCard("i751_petitioner"),
          rf("i751_conditional_since", "When did you become a conditional resident? (date on your green card)", "date", true),
          rf("i751_card_expiry", "When does your conditional green card expire?", "date", true),
        ],
      },
      {
        id: "i751-filing",
        heading: "How are you filing?",
        fields: [
          rf("i751_filing_type", "How are you filing this petition?", "select", true, {
            options: ["Joint filing with petitioning spouse", "Waiver — Divorce", "Waiver — Battery / Cruelty", "Waiver — Extreme Hardship", "Not sure — I need advice before choosing"],
          }),
          rf("i751_spouse_name", "Spouse's full legal name (for a joint filing)", "text", false),
          rf("i751_filing_date", "What date do you plan to file? (must fall inside the 90-day window before the card expires)", "date", true),
        ],
      },
      {
        id: "i751-evidence",
        heading: "Proof of a real marriage",
        fields: [
          rf("i751_evidence_list", "What proof of a real marriage can you provide? (joint lease, joint bank statements, joint tax returns, photos, children's birth certificates — list what you have)", "text", true),
        ],
      },
      {
        id: "i751-timeline",
        heading: "5-year address & work history",
        fields: [rTimelineField("i751_history_5y", "Address & work history for the last 5 years")],
      },
    ],
  },
  {
    formCode: "I-539",
    title: "Application to Extend / Change Nonimmigrant Status",
    draftNotice: DRAFT_SCHEMA_NOTICE,
    redFlag: false,
    timelineValidators: ["address_5yr"],
    sections: [
      {
        id: "i539-applicant",
        heading: "Applicant — about you",
        fields: [
          ...rPersonName("i539_applicant", "applicant"),
          rSensitive.passport("i539_applicant"),
          rf("i539_applicant_address", "What is your current address in the United States?", "text", true),
        ],
      },
      {
        id: "i539-status",
        heading: "Current status",
        fields: [
          rf("i539_current_status", "What is your current nonimmigrant status?", "select", true, {
            options: ["Visitor (B-1/B-2)", "Student (F-1)", "Other nonimmigrant status"],
          }),
          rf("i539_i94_number", "I-94 number", "text", false),
          rf("i539_i94_expiry", "When does your current I-94 expire? (the \"Admit Until\" date — the I-539 must be filed BEFORE this date)", "date", true),
          rf("i539_filing_date", "What date do you plan to file? (must be before the I-94 expiry date)", "date", true),
          rf("i539_status_expires", "When does your current status expire?", "date", true),
        ],
      },
      {
        id: "i539-request",
        heading: "What are you asking for?",
        fields: [
          rf("i539_request_type", "What are you asking USCIS for?", "select", true, {
            options: ["Extend my current status", "Change to a different nonimmigrant status", "Reinstate my status"],
          }),
          rf("i539_requested_status", "Which status do you want to extend or change to?", "text", true),
          rf("i539_new_end_date", "Until when are you asking to stay?", "date", true),
          rf("i539_coapplicants_count", "How many co-applicants are on Form I-539A? (0 if none)", "number", true),
          rf("i539_reason", "Why do you need more time (or a different status)? Explain in your own words.", "text", true),
          rf("i539_financial_support", "How will you support yourself during the extended stay?", "text", true),
        ],
      },
      {
        id: "i539-timeline",
        heading: "Address history (last 5 years)",
        fields: [rTimelineField("i539_history_5y", "Address history for the last 5 years")],
      },
    ],
  },
  {
    formCode: "I-129F",
    title: "Petition for Alien Fiancé(e)",
    draftNotice: DRAFT_SCHEMA_NOTICE,
    redFlag: false,
    timelineValidators: ["address_5yr", "employment_5yr"],
    sections: [
      {
        id: "i129f-petitioner",
        heading: "Petitioner — about you",
        fields: [
          ...rPersonName("i129f_petitioner", "petitioner (U.S. citizen)"),
          rSensitive.ssn("i129f_petitioner"),
          rf("i129f_petitioner_citizenship_proof", "How does the petitioner prove U.S. citizenship?", "select", true, {
            options: ["U.S. birth certificate", "U.S. passport", "Certificate of Naturalization", "Certificate of Citizenship"],
          }),
          rf("i129f_petitioner_address", "What is the petitioner's current address in the United States?", "text", true),
        ],
      },
      {
        id: "i129f-beneficiary",
        heading: "Beneficiary — your fiancé(e)",
        fields: [
          ...rPersonName("i129f_beneficiary", "fiancé(e)"),
          rSensitive.passport("i129f_beneficiary"),
          rf("i129f_beneficiary_address", "What is your fiancé(e)'s current address?", "text", true),
          rf("i129f_embassy_city", "Which U.S. embassy city will your fiancé(e) interview in? (the K-1 interview city)", "text", true),
        ],
      },
      {
        id: "i129f-relationship",
        heading: "Your relationship & meeting",
        fields: [
          rf("i129f_last_meeting_date", "When did you last meet in person? (must be within 2 years before filing)", "date", true),
          rf("i129f_filing_date", "What date do you plan to file? (the last meeting must be within 2 years before this date)", "date", true),
          rf("i129f_met_place", "Where did you meet in person? (city, country)", "text", true),
          rf("i129f_met_proof", "What proof do you have that you met in person in the last 2 years? (photos, travel records, stamps)", "text", false),
          rf("i129f_intent_to_marry", "Do you both intend to marry within 90 days of your fiancé(e)'s arrival in the United States?", "checkbox_group", true, {
            options: ["Yes — we intend to marry within 90 days of arrival"],
          }),
          rf("i129f_prior_petitions", "How many I-129F petitions has the petitioner filed before?", "number", false),
        ],
      },
      {
        id: "i129f-timeline",
        heading: "5-year address & work history",
        fields: [rTimelineField("i129f_history_5y", "Address & work history for the last 5 years")],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Full registry — document slots attached from formChecklists.ts.
// ---------------------------------------------------------------------------

function attachRegistrySlots(raw: RawRegistrySchema): RegistryFormSchema {
  const fromChecklists = checklistSlotsForForm(raw.formCode);
  const drafts = REGISTRY_DRAFT_SLOTS_BY_FORM[raw.formCode] ?? [];
  const documentSlots = fromChecklists.length > 0 ? fromChecklists : drafts;
  const checklistCoverageNote =
    fromChecklists.length > 0
      ? `Document slots reused from src/lib/formChecklists.ts (${fromChecklists.length} slot(s) for ${raw.formCode}). ` +
        "That checklist may be partial — verify the full document list against the current form edition at uscis.gov."
      : `No checklist template for ${raw.formCode} exists in src/lib/formChecklists.ts yet — ` +
        `${drafts.length} draft slot(s) only, verify against uscis.gov before relying on them.`;
  return { ...raw, documentSlots, checklistCoverageNote };
}

export const REGISTRY_FORM_SCHEMAS: RegistryFormSchema[] =
  RAW_REGISTRY_SCHEMAS.map(attachRegistrySlots);

export const ALL_REGISTRY_FORM_CODES: string[] = REGISTRY_FORM_SCHEMAS.map(
  (s) => s.formCode
);

/** One registry schema by form code, or null when the code is not in the registry. */
export function getRegistrySchema(formCode: string): RegistryFormSchema | null {
  return REGISTRY_FORM_SCHEMAS.find((s) => s.formCode === formCode) ?? null;
}

/**
 * Schemas for the selected forms ONLY, in the order the forms were
 * selected, de-duplicated. Unknown codes are ignored (never rendered).
 * Selecting N-400 returns only the N-400 schema — never I-130 marriage
 * fields. Selecting I-130 + DS-260 + I-864 returns exactly those three.
 */
export function schemasForSelectedForms(selectedForms: string[]): RegistryFormSchema[] {
  const seen = new Set<string>();
  const out: RegistryFormSchema[] = [];
  for (const code of selectedForms) {
    if (seen.has(code)) continue;
    seen.add(code);
    const schema = getRegistrySchema(code);
    if (schema) out.push(schema);
  }
  return out;
}

/** Form codes in `selectedForms` that have no schema in this registry. */
export function unknownFormCodes(selectedForms: string[]): string[] {
  return Array.from(new Set(selectedForms)).filter((c) => !getRegistrySchema(c));
}

/** All required fields across the selected schemas (for the unfilled list). */
export function requiredFieldsForSchemas(
  schemas: RegistryFormSchema[]
): Array<{ formCode: string; field: RegistryField }> {
  const out: Array<{ formCode: string; field: RegistryField }> = [];
  for (const schema of schemas) {
    for (const section of schema.sections) {
      for (const field of section.fields) {
        if (field.required && field.type !== "note") {
          out.push({ formCode: schema.formCode, field });
        }
      }
    }
  }
  return out;
}

/** Timeline validators required by at least one selected schema. */
export function timelineValidatorsForSchemas(
  schemas: RegistryFormSchema[]
): RegistryTimelineKind[] {
  const set = new Set<RegistryTimelineKind>();
  for (const schema of schemas) {
    for (const v of schema.timelineValidators) set.add(v);
  }
  return Array.from(set);
}
