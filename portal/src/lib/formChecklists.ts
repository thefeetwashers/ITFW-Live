// Master Form & Checklist Templates — Immigration with NIPTEI
// ---------------------------------------------------------------------------
// Templates for the 7 requested services (+ the locked Family Adjustment
// Bundle as a composite 8th template). Adapted to the locked prices and
// to the existing src/lib/bundles.ts — this file REUSES bundles.ts, it
// does NOT create a competing bundle catalog. Where bundles.ts and this
// file differ, the difference is flagged in the notes below, never
// silently resolved.
//
// PRICE RULES (do not weaken these):
// - Prep fee = the LOCKED single-form / bundle price only, Basic /
//   Standard / Premium, in integer cents in storage. The paste's
//   defaultPrepFee figures ($1,200 / $1,100 / $350 / $350 / $650 / $200)
//   were EXAMPLE prices, NOT locked — they are NOT used anywhere here.
//   Locked tiers used here (per the founder's locked price list):
//     I-130      $299 / $499 / $750      I-485      $750 / $1,200 / $1,500
//     I-821      $189 / $295 / $400      I-765      $129 / $249 / $350
//     N-400      $199 / $400 / $600      I-589      $900 / $1,050 / $1,200
//     I-90       $129 / $240 / $350      I-864      $99 / $175 / $250
//     Family Adjustment Bundle           $999 / $1,799 / $2,799
//     I-131      $250 / $325 / $400      I-751      $139 / $295 / $449
//     I-539      $250 / $375 / $500      I-129F     $750 / $925 / $1,095
//   Speed fees (same for the four expanded forms, LOCKED): Standard
//   tier + $0, Rush tier + $199, Express tier + $399. Speed is packet
//   preparation time, NOT USCIS processing time. The paste's example
//   tiers (I-131 $250/$350/$475, I-751 $550/$725/$900, I-539
//   $350/$475/$625, I-129F $750/$975/$1,200) are NOT used anywhere.
//   See src/lib/dynamicIntakeSchemas.ts for the locked source.
//   FLAG — bundles.ts still marks the I-765 standalone, I-90 and I-864
//   service fees as TO BE CONFIRMED (no locked serviceFee on those
//   BundleTemplate entries). The tier prices above come from the locked
//   price list given for this build; bundles.ts should be reconciled
//   by its owner before it is quoted from. This file does NOT edit
//   bundles.ts. The Choose-a-Form catalog's premium values corroborate
//   the top tier (I-130 $750, I-765 $350, I-864 $250, N-400 $599~$600,
//   I-90 $349~$350) but its USCIS figures are NOT treated as locked.
// - Gov fees are ALWAYS a separate line, never combined with the prep
//   fee. A gov fee that is not in the locked list is TO BE CONFIRMED
//   (amountCents null), never presented as verified:
//     LOCKED:  I-485 $1,440 (paper) · I-821 TPS $520 · I-589 $100 + $105/yr
//              NVC AOS $120 + IV $325 (CEAC, separate) · USCIS Immigrant
//              Fee $235 · I-864 $0 (no separate USCIS fee).
//     TO BE CONFIRMED: I-130 $675 · I-765 $260 concurrent with I-485 ·
//              I-765 $520 paper / $470 online · TPS biometrics $30 ·
//              N-400 $710 online / $760 paper / $380 reduced ·
//              I-90 $415 online / $465 paper · I-131 $580 online /
//              $630 paper ($575 Refugee Travel Document) ·
//              I-539 $420 online / $470 paper (+$1,965 I-907 premium
//              processing, eligible F/J/M only) · I-129F $675 USCIS +
//              $265 K-1 visa fee at the embassy.
//     LOCKED (expanded forms): I-751 $750 paper only.
//   The sponsor-qualifier file lists some of those TBC figures as if
//   known (e.g. I-130 $675 paper / $625 online); they stay TO BE
//   CONFIRMED here because the locked fee list does not verify them.
// - I-130 + NVC total: $675 (TBC) + $120 + $325 + $235 = $1,355 ONLY
//   if $675 is confirmed. Otherwise the total is TO BE CONFIRMED.
//   The paste's $1,355 double-counted / confused the lines; it is NOT
//   repeated here as a verified total.
// - I-589 "$0 USCIS Filing Fee" in the paste was WRONG. Locked I-589
//   fee is $100 + $105/year.
// - I-864 was requested but NOT in the paste — it is BUILT here
//   (I-864 + I-864A, 125% 2026 figures from the locked sponsor
//   qualifier, joint-sponsor flow).
// - I-589 is CLERICAL PREP ONLY. Nothing here is legal advice and
//   nothing guarantees an approval.
//
// WHERE CHECKLIST ROWS GO (correction to the integration brief):
// - Checklist rows are inserted into public.inbox_items
//   (type 'missing_document', status 'missing') — that IS the designed
//   checklist table (migration 0001) — plus public.packet_audit_items
//   (migration 0005) for the packet audit. They are NOT inserted into
//   public.documents: a documents row is a real uploaded FILE
//   (file_name, mime_type from a whitelist, storage_path UNIQUE,
//   storage_bucket = 'vault' per 0001/0003). Inventing placeholder
//   file rows would break those constraints. When the file is actually
//   uploaded, inbox_items.document_id links to the documents row.
// - Money on service_orders: total_service_fee_cents = prep fee ONLY;
//   estimated_uscis_gov_fee_cents = LOCKED gov fees only (TBC gov fees
//   are excluded and named in govFeeNote). See serviceOrderDraftForTemplate.
// - Lifecycle: every template targets Stage 4 — Active Client (Docs &
//   Drafting). See src/lib/lifecycle.ts LIFECYCLE_STAGES.
// - Packet audit: auditItemsForTemplate() builds src/lib/audit.ts
//   AuditItem rows; readinessForTemplate() runs computePacketReadiness.
//   Filing is ready only at 100% with every blocking item cleared.
//
// INTEGRATION POINT (Lead Sheet / Back-Office Case Creator):
// - Do NOT edit LeadSheet.tsx (CSV bulk importer) or LeadLifecycle.tsx
//   (the "Convert Lead to Active Case" UI, owned by another builder).
//   From the convert handler, once the case exists in Supabase, call:
//     insertChecklistRows(supabase, { caseId, clientId, requestedBy,
//       providerId, templateId: templateIdForService(lead.serviceRequested),
//       tier: lead.serviceTier })
//   and serviceOrderDraftForTemplate(templateId, tier, plan) for the
//   service_orders row. Both helpers live in this file. Nothing here
//   runs live: Supabase is not connected in this build (getSupabase()
//   returns null without env vars) and migrations 0009–0011 are written
//   only, not run live. See portal DEPLOY.md §8.

import type { SupabaseClient } from "@supabase/supabase-js";
import { FAMILY_ADJUSTMENT_BUNDLE } from "./bundles";
import { computePacketReadiness, type AuditItem } from "./audit";
import type { PaymentPlanType } from "./order";
import type { ServiceRequested, ServiceTier } from "./lifecycle";
import { USCIS_FEE_SCHEDULE_URL } from "./fees";

export { USCIS_FEE_SCHEDULE_URL };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChecklistAssignee =
  | "Primary Client"
  | "Spouse-Beneficiary"
  | "Joint Sponsor";

/** Vault categories are the migration 0001 vault_category enum. */
export type ChecklistVaultCategory =
  | "Identity"
  | "Relationship Proof"
  | "Financial/Tax"
  | "Medical/Police"
  | "USCIS Notices";

export interface FormChecklistItem {
  id: string;
  title: string;
  assignedTo: ChecklistAssignee;
  /** True when a certified English translation is required (foreign doc). */
  translationRequired: boolean;
  vaultCategory: ChecklistVaultCategory;
  formCode: string;
  /** e.g. "Consular case only" / "Only if filing concurrently". */
  condition?: string;
  /** Packet-audit rule this item maps to (src/lib/audit.ts). */
  auditRule: AuditItem["rule"];
  blocking: boolean;
}

export interface GovFeeLine {
  label: string;
  /** Integer cents. Null = TO BE CONFIRMED — never present as verified. */
  amountCents: number | null;
  locked: boolean;
  /** True for a recurring fee (e.g. I-589 $105/yr): shown as its own
   *  line, never folded into a one-off gov total or estimate. */
  recurring?: boolean;
  /** Set when a fee applies only in some cases (e.g. "Consular cases
   *  only"): shown as its own line, excluded from the one-off estimate. */
  appliesOnly?: string;
  note?: string;
}

/** Locked prep-fee tiers, dollars. Null tierPrices = no locked fee. */
export interface TierPrices {
  basic: number;
  standard: number;
  premium: number;
}

export interface FormChecklistTemplate {
  id: string;
  name: string;
  formsIncluded: string[];
  summary: string;
  /** Locked prep fee by tier, or null when no locked fee exists. */
  tierPrices: TierPrices | null;
  /** Explains the prep fee (which tier prices, what is TBC). */
  prepFeeNote: string;
  govFees: GovFeeLine[];
  /** Why there is no single combined total (or the conditional total). */
  govTotalNote: string;
  checklist: FormChecklistItem[];
  /** Lifecycle stage this checklist belongs to: Stage 4, Active Client. */
  lifecycleStage: "active_client";
  stage4Note: string;
  /** True for I-589: clerical prep only, never legal advice. */
  clericalOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Locked gov-fee helpers
// ---------------------------------------------------------------------------

/** Sum of LOCKED, one-off, always-applicable gov fees only, integer
 *  cents. TBC lines, recurring lines (e.g. $105/yr) and conditional
 *  lines (e.g. consular-only $120 AOS) are excluded. */
export function lockedGovFeeCents(template: FormChecklistTemplate): number {
  return template.govFees.reduce(
    (sum, line) =>
      line.locked && !line.recurring && !line.appliesOnly && line.amountCents !== null
        ? sum + line.amountCents
        : sum,
    0
  );
}

/** Locked prep fee for one tier, integer cents, or null if not locked. */
export function prepFeeCentsForTier(
  template: FormChecklistTemplate,
  tier: ServiceTier
): number | null {
  if (!template.tierPrices) return null;
  return template.tierPrices[tier] * 100;
}

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US")}`;
}

// ---------------------------------------------------------------------------
// 2026 I-864P sponsor qualifier — 125% / 100% active-duty military
// Source: workspace/your_files/itfw-sponsor-qualifier/
// itfw-2026-sponsor-qualifier-and-fees.md ("LOCKED IN: 2026 USCIS Form
// I-864P, effective March 1, 2026"). Household sizes 2–8 + per-extra.
// Hawaii uses the EXACT table values, not the rounded formula: the
// formula 31,113 + 8,163 = 39,276, but the official table says HH3
// Hawaii $39,275 — so this is a lookup table, never a formula.
// The file itself says "Estimate only — verify against current Form
// I-864P and uscis.gov/fees." Nothing here is legal advice.
// ---------------------------------------------------------------------------

export type SponsorRegion = "contiguous" | "alaska" | "hawaii";

export const SPONSOR_125_2026: Record<
  SponsorRegion,
  { household: Record<number, [number, number]>; extra: [number, number] }
> = {
  contiguous: {
    household: {
      2: [27050, 21640],
      3: [34150, 27320],
      4: [41250, 33000],
      5: [48350, 38680],
      6: [55450, 44360],
      7: [62550, 50040],
      8: [69650, 55720],
    },
    extra: [7100, 5680],
  },
  alaska: {
    household: {
      2: [33813, 27050],
      3: [42688, 34150],
      4: [51563, 41250],
      5: [60438, 48350],
      6: [69313, 55450],
      7: [78188, 62550],
      8: [87063, 69650],
    },
    extra: [8875, 7100],
  },
  hawaii: {
    household: {
      2: [31113, 24890],
      3: [39275, 31420],
      4: [47438, 37950],
      5: [55600, 44480],
      6: [63763, 51010],
      7: [71925, 57540],
      8: [80088, 64070],
    },
    extra: [8163, 6530],
  },
};

/**
 * Required sponsor income for a household size + region, 2026 I-864P.
 * military = true uses the 100% active-duty column, otherwise 125%.
 * Exact table lookup (HH2–8); beyond 8 adds the per-extra amount.
 */
export function requiredSponsorIncome(
  householdSize: number,
  region: SponsorRegion,
  military: boolean
): number {
  const table = SPONSOR_125_2026[region];
  const idx = military ? 1 : 0;
  const size = Math.max(2, Math.floor(householdSize));
  if (size <= 8) return table.household[size][idx];
  return table.household[8][idx] + (size - 8) * table.extra[idx];
}

/**
 * Sponsor math from the qualifier: shortfall, assets needed at 3x
 * (spouse / minor child of a U.S. citizen) or 5x (most other cases).
 */
export function sponsorShortfallCheck(args: {
  householdSize: number;
  region: SponsorRegion;
  military: boolean;
  income: number;
  assets: number;
  isSpouseOrMinorChildOfUSC: boolean;
}): {
  required: number;
  shortfall: number;
  multiplier: number;
  assetsNeeded: number;
  qualified: boolean;
  nextStep: string;
} {
  const required = requiredSponsorIncome(args.householdSize, args.region, args.military);
  const shortfall = Math.max(0, required - args.income);
  const multiplier = args.isSpouseOrMinorChildOfUSC ? 3 : 5;
  const assetsNeeded = shortfall * multiplier;
  const qualified = shortfall === 0 || args.assets >= assetsNeeded;
  return {
    required,
    shortfall,
    multiplier,
    assetsNeeded,
    qualified,
    nextStep: qualified
      ? "PASS on income / assets — proceed with the I-864."
      : "NOT YET QUALIFIED — invite a Joint Sponsor (separate I-864, meets 125% on their own household) or add a household member on Form I-864A.",
  };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const I130_NVC_TEMPLATE: FormChecklistTemplate = {
  id: "i130-nvc",
  name: "I-130 + NVC Consular",
  formsIncluded: ["I-130", "DS-260", "I-864", "I-864A"],
  summary:
    "Petition for Alien Relative for a spouse / relative outside the United States, then NVC consular processing (CEAC fees, DS-260, civil documents, interview).",
  // Locked I-130 single-form fee. There is NO locked combined fee for
  // the I-130 + NVC bundle (bundles.ts I-130+NVC has no serviceFee) —
  // the NVC consular-guidance portion is TO BE CONFIRMED, never added
  // to this price by assumption.
  tierPrices: { basic: 299, standard: 499, premium: 750 },
  prepFeeNote:
    "Locked I-130 single-form prep fee — Basic $299 / Standard $499 / Premium $750. No locked combined fee for the I-130 + NVC bundle yet — the NVC consular-guidance portion is TO BE CONFIRMED; do not quote a bundle total until it is confirmed.",
  govFees: [
    {
      label: "USCIS fee — I-130",
      amountCents: null,
      locked: false,
      note: "$675 TO BE CONFIRMED. Confirm at uscis.gov/fees before paying.",
    },
    {
      label: "DOS fee — AOS (CEAC)",
      amountCents: 12000,
      locked: true,
      note: "$120 per case, paid in CEAC, separate from the prep fee.",
    },
    {
      label: "DOS fee — IV (CEAC)",
      amountCents: 32500,
      locked: true,
      note: "$325 per applicant, paid in CEAC, separate from the prep fee.",
    },
    {
      label: "USCIS Immigrant Fee",
      amountCents: 23500,
      locked: true,
      note: "$235, paid at my.uscis.gov BEFORE flying, separate from the prep fee.",
    },
  ],
  govTotalNote:
    "No single verified gov total: $675 (TO BE CONFIRMED) + $120 + $325 + $235 = $1,355 ONLY if $675 is confirmed — otherwise the total is TO BE CONFIRMED. Locked gov fees in this template sum to $680 ($120 + $325 + $235). Never present $1,355 as verified.",
  checklist: [
    { id: "i130-pet-passport", title: "Petitioner passport / ID", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-130", auditRule: "missing_document", blocking: true },
    { id: "i130-ben-passport", title: "Beneficiary passport / ID", assignedTo: "Spouse-Beneficiary", translationRequired: false, vaultCategory: "Identity", formCode: "I-130", auditRule: "missing_document", blocking: true },
    { id: "i130-relationship", title: "Proof of relationship (birth / marriage certificate)", assignedTo: "Primary Client", translationRequired: true, vaultCategory: "Relationship Proof", formCode: "I-130", auditRule: "untranslated_foreign_document", blocking: true },
    { id: "i130-history-5y", title: "5-year address & work history (petitioner + beneficiary)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-130", auditRule: "incomplete_form_section", blocking: true },
    { id: "i130-photos", title: "Passport photos (2x2)", assignedTo: "Spouse-Beneficiary", translationRequired: false, vaultCategory: "Identity", formCode: "I-130", auditRule: "missing_document", blocking: true },
    { id: "i130-i130a", title: "Form I-130A — Supplemental Information for Spouse Beneficiary (included with I-130 at no extra charge)", assignedTo: "Spouse-Beneficiary", translationRequired: false, vaultCategory: "Identity", formCode: "I-130A", auditRule: "incomplete_form_section", blocking: true },
    { id: "i130-nvc-numbers", title: "NVC case number + Invoice ID (CEAC)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "USCIS Notices", formCode: "DS-260", condition: "Consular case only", auditRule: "missing_document", blocking: true },
    { id: "i130-ds260", title: "DS-260 confirmation page", assignedTo: "Spouse-Beneficiary", translationRequired: false, vaultCategory: "USCIS Notices", formCode: "DS-260", condition: "Consular case only", auditRule: "missing_document", blocking: true },
    { id: "i130-i864", title: "I-864 + IRS transcripts (petitioner)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Financial/Tax", formCode: "I-864", auditRule: "missing_document", blocking: true },
    { id: "i130-joint-sponsor", title: "Joint sponsor I-864 + I-864A (only if below 125% HHS Poverty Guidelines)", assignedTo: "Joint Sponsor", translationRequired: false, vaultCategory: "Financial/Tax", formCode: "I-864", condition: "Only if the petitioner's household income is below 125% — see the I-864 template for the 2026 table", auditRule: "missing_document", blocking: true },
    { id: "i130-ceac-civil", title: "Civil documents uploaded to CEAC (birth / marriage certificates)", assignedTo: "Spouse-Beneficiary", translationRequired: true, vaultCategory: "Relationship Proof", formCode: "DS-260", condition: "Consular case only", auditRule: "untranslated_foreign_document", blocking: true },
    { id: "i130-police", title: "Police clearance certificate(s)", assignedTo: "Spouse-Beneficiary", translationRequired: true, vaultCategory: "Medical/Police", formCode: "DS-260", condition: "Consular case only", auditRule: "untranslated_foreign_document", blocking: true },
    { id: "i130-interview", title: "Embassy interview + medical exam readiness", assignedTo: "Spouse-Beneficiary", translationRequired: false, vaultCategory: "Medical/Police", formCode: "DS-260", condition: "Consular case only", auditRule: "incomplete_form_section", blocking: false },
  ],
  lifecycleStage: "active_client",
  stage4Note:
    "Stage 4 — Active Client (Docs & Drafting): collect the items above, run the packet audit to 100%, draft the forms, then e-sign once the balance is paid.",
};

const I485_TEMPLATE: FormChecklistTemplate = {
  id: "i485",
  name: "I-485 Adjustment of Status",
  formsIncluded: ["I-485", "I-864", "I-765", "I-131", "I-693"],
  summary:
    "Application to Register Permanent Residence / Adjust Status for a person already in the United States. Paper filing only, mandatory 09/18/26 edition.",
  tierPrices: { basic: 750, standard: 1200, premium: 1500 },
  prepFeeNote:
    "Locked I-485 prep fee — Basic $750 / Standard $1,200 / Premium $1,500.",
  govFees: [
    {
      label: "USCIS fee — I-485 (paper)",
      amountCents: 144000,
      locked: true,
      note: "$1,440 — paper only, mandatory 09/18/26 edition.",
    },
    {
      label: "USCIS fee — I-765 (EAD, concurrent with I-485)",
      amountCents: null,
      locked: false,
      note: "$260 concurrent-filing fee is UNVERIFIED — TO BE CONFIRMED. Confirm at uscis.gov/fees before paying.",
    },
    {
      label: "USCIS fee — I-131 (Travel Document, if filing concurrently)",
      amountCents: null,
      locked: false,
      note: "TO BE CONFIRMED — not in the locked fee list. Confirm at uscis.gov/fees before paying.",
    },
    {
      label: "Sealed Form I-693 medical exam — paid to the doctor",
      amountCents: null,
      locked: false,
      note: "Third-party cost, NOT a USCIS fee: $250–$500 to the doctor (free booking). Shown as a range, not a single price.",
    },
  ],
  govTotalNote:
    "Locked gov fee in this template: $1,440 (I-485 paper). The I-765 concurrent fee, the I-131 fee and the I-693 doctor cost are TO BE CONFIRMED / third-party, so no single gov total is quoted.",
  checklist: [
    { id: "i485-i130-receipt", title: "I-130 receipt / approval (if filing together, the I-130 checklist applies)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "USCIS Notices", formCode: "I-485", auditRule: "missing_document", blocking: true },
    { id: "i485-birth", title: "Birth certificate + certified translation if foreign", assignedTo: "Primary Client", translationRequired: true, vaultCategory: "Relationship Proof", formCode: "I-485", auditRule: "untranslated_foreign_document", blocking: true },
    { id: "i485-passport", title: "Passport bio page + photos (2x2)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-485", auditRule: "missing_document", blocking: true },
    { id: "i485-history-5y", title: "5-year address, work & travel history", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-485", auditRule: "incomplete_form_section", blocking: true },
    { id: "i485-i693", title: "I-693 sealed medical exam (from the doctor)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Medical/Police", formCode: "I-693", auditRule: "missing_document", blocking: true },
    { id: "i485-i864", title: "I-864 Affidavit of Support + sponsor tax returns", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Financial/Tax", formCode: "I-864", auditRule: "missing_document", blocking: true },
    { id: "i485-employment", title: "Employment / tax history", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Financial/Tax", formCode: "I-485", auditRule: "incomplete_form_section", blocking: true },
    { id: "i485-i765", title: "I-765 eligibility category + prior EAD (if renewing)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-765", condition: "Only if filing I-765 concurrently", auditRule: "incomplete_form_section", blocking: false },
    { id: "i485-i131", title: "I-131 purpose of travel + travel dates", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-131", condition: "Only if filing I-131 concurrently", auditRule: "incomplete_form_section", blocking: false },
  ],
  lifecycleStage: "active_client",
  stage4Note:
    "Stage 4 — Active Client (Docs & Drafting): collect the items above, run the packet audit to 100%, draft the forms, then e-sign once the balance is paid. Family Adjustment Bundle alternative: 7 forms (I-130, I-485, I-130A, I-864, I-765, I-131, I-693) at Basic $999 / Standard $1,799 / Premium $2,799 — see the family-adjustment template.",
};

const I821_I765_TEMPLATE: FormChecklistTemplate = {
  id: "i821-i765",
  name: "I-821 TPS + I-765 EAD",
  formsIncluded: ["I-821", "I-765"],
  summary:
    "Application for Temporary Protected Status with Employment Authorization. Each family member files their own I-821 + I-765.",
  // No locked COMBINED service fee (bundles.ts I-821+I-765). The two
  // single-form locked fees are named in the note; they are NOT added
  // into an invented bundle price.
  tierPrices: null,
  prepFeeNote:
    "No locked combined prep fee for I-821 + I-765 — TO BE CONFIRMED. Locked single-form fees: I-821 TPS Basic $189 / Standard $295 / Premium $400; I-765 EAD Basic $129 / Standard $249 / Premium $350. Do not add them into a bundle price until a combined fee is confirmed.",
  govFees: [
    {
      label: "USCIS fee — I-821 (TPS)",
      amountCents: 52000,
      locked: true,
      note: "$520 — locked I-821 TPS fee.",
    },
    {
      label: "USCIS fee — I-765 (EAD)",
      amountCents: null,
      locked: false,
      note: "$520 paper / $470 online is UNVERIFIED — TO BE CONFIRMED. Confirm at uscis.gov/fees before paying.",
    },
    {
      label: "Biometrics fee",
      amountCents: null,
      locked: false,
      note: "$30 is UNVERIFIED — TO BE CONFIRMED. Confirm at uscis.gov/fees before paying.",
    },
  ],
  govTotalNote:
    "Locked gov fee in this template: $520 (I-821 TPS). The I-765 fee and the $30 biometrics fee are TO BE CONFIRMED, so no single gov total is quoted.",
  checklist: [
    { id: "i821-passport", title: "Passport / identity documents", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-821", auditRule: "missing_document", blocking: true },
    { id: "i821-nationality", title: "Proof of nationality + continuous residence", assignedTo: "Primary Client", translationRequired: true, vaultCategory: "Relationship Proof", formCode: "I-821", auditRule: "untranslated_foreign_document", blocking: true },
    { id: "i821-presence", title: "Proof of continuous physical presence", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-821", auditRule: "missing_document", blocking: true },
    { id: "i821-i765-category", title: "I-765 eligibility category + prior EAD (if renewing)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-765", auditRule: "incomplete_form_section", blocking: true },
    { id: "i821-photos", title: "Passport photos (2x2) for EAD", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-765", auditRule: "missing_document", blocking: true },
    { id: "i821-renewal-window", title: "180-day EAD / TPS renewal window check (see Deadline Radar)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "USCIS Notices", formCode: "I-821", auditRule: "incomplete_form_section", blocking: false },
  ],
  lifecycleStage: "active_client",
  stage4Note:
    "Stage 4 — Active Client (Docs & Drafting): collect the items above, run the packet audit to 100%, draft the forms, then e-sign once the balance is paid.",
};

const N400_TEMPLATE: FormChecklistTemplate = {
  id: "n400",
  name: "N-400 Citizenship",
  formsIncluded: ["N-400"],
  summary:
    "Application for Naturalization. Individual application — one applicant per filing.",
  tierPrices: { basic: 199, standard: 400, premium: 600 },
  prepFeeNote:
    "Locked N-400 prep fee — Basic $199 / Standard $400 / Premium $600. (The paste's $350 example price is NOT used.)",
  govFees: [
    {
      label: "USCIS fee — N-400",
      amountCents: null,
      locked: false,
      note: "$710 online / $760 paper / $380 reduced are all UNVERIFIED — TO BE CONFIRMED. Confirm at uscis.gov/fees before paying.",
    },
  ],
  govTotalNote:
    "No verified gov total: the $710 online / $760 paper / $380 reduced figures are all UNVERIFIED. The total is TO BE CONFIRMED.",
  checklist: [
    { id: "n400-greencard", title: "Green card (front and back)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "N-400", auditRule: "missing_document", blocking: true },
    { id: "n400-history-5y", title: "5-year address, work & travel history", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "N-400", auditRule: "incomplete_form_section", blocking: true },
    { id: "n400-taxes", title: "Tax returns", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Financial/Tax", formCode: "N-400", auditRule: "missing_document", blocking: true },
    { id: "n400-marriage", title: "Marriage / divorce certificates if applicable", assignedTo: "Primary Client", translationRequired: true, vaultCategory: "Relationship Proof", formCode: "N-400", condition: "Only if applicable", auditRule: "untranslated_foreign_document", blocking: true },
    { id: "n400-disclosure", title: "Disclose any arrests, citations, or removals (if any apply)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "USCIS Notices", formCode: "N-400", condition: "Only if any apply — answer honestly; do not hide anything", auditRule: "incomplete_form_section", blocking: true },
    { id: "n400-photos", title: "Passport photos (2x2)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "N-400", auditRule: "missing_document", blocking: true },
  ],
  lifecycleStage: "active_client",
  stage4Note:
    "Stage 4 — Active Client (Docs & Drafting): collect the items above, run the packet audit to 100%, draft the form, then e-sign once the balance is paid.",
};

const I589_TEMPLATE: FormChecklistTemplate = {
  id: "i589",
  name: "I-589 Asylum — Clerical Prep Only",
  formsIncluded: ["I-589"],
  summary:
    "Application for Asylum and for Withholding of Removal. CLERICAL PREP ONLY — we prepare the forms from the client's own words and documents; this is not legal advice and not a guarantee of any outcome.",
  tierPrices: { basic: 900, standard: 1050, premium: 1200 },
  prepFeeNote:
    "Locked I-589 prep fee — Basic $900 / Standard $1,050 / Premium $1,200. (The paste's '$1,200+' is the locked $1,200 premium; the '+' adds no unlisted amount.)",
  govFees: [
    {
      label: "USCIS fee — I-589",
      amountCents: 10000,
      locked: true,
      note: "$100 + $105/year — locked. The paste's \"$0 USCIS Filing Fee\" was WRONG.",
    },
    {
      label: "USCIS fee — I-589 annual fee",
      amountCents: 10500,
      locked: true,
      recurring: true,
      note: "$105/year, in addition to the $100 filing fee — locked. Shown as its own line so it is never hidden inside a total.",
    },
  ],
  govTotalNote:
    "Locked gov fee: $100 filing + $105/year. The $105 is an annual fee, so it is shown as its own line and NOT folded into a one-off total.",
  checklist: [
    { id: "i589-passport", title: "Passport / identity documents", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-589", auditRule: "missing_document", blocking: true },
    { id: "i589-statement", title: "Detailed asylum statement (plain-language questionnaire)", assignedTo: "Primary Client", translationRequired: true, vaultCategory: "Relationship Proof", formCode: "I-589", auditRule: "incomplete_form_section", blocking: true },
    { id: "i589-evidence", title: "Supporting evidence — country conditions, witness statements", assignedTo: "Primary Client", translationRequired: true, vaultCategory: "Relationship Proof", formCode: "I-589", auditRule: "untranslated_foreign_document", blocking: true },
    { id: "i589-deadline", title: "One-year filing deadline check", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "USCIS Notices", formCode: "I-589", auditRule: "incomplete_form_section", blocking: true },
    { id: "i589-derivatives", title: "Derivatives listed (spouse / unmarried children — confirm eligibility)", assignedTo: "Spouse-Beneficiary", translationRequired: false, vaultCategory: "Identity", formCode: "I-589", condition: "Only if derivatives are included", auditRule: "incomplete_form_section", blocking: false },
  ],
  lifecycleStage: "active_client",
  stage4Note:
    "Stage 4 — Active Client (Docs & Drafting): collect the items above, run the packet audit to 100%, draft the form, then e-sign once the balance is paid. Clerical help only — no legal advice, no approval guarantee.",
  clericalOnly: true,
};

const I864_TEMPLATE: FormChecklistTemplate = {
  id: "i864",
  name: "I-864 Affidavit of Support (+ I-864A)",
  formsIncluded: ["I-864", "I-864A"],
  summary:
    "Affidavit of Support, built from the locked 2026 sponsor qualifier (2026 USCIS Form I-864P, effective March 1, 2026; Form I-864 edition 08/24/26 mandatory since Oct 1, 2026). Sponsor income is checked at 125% of the 2026 guidelines (100% for active-duty military); joint sponsor or household-member (I-864A) flow when the petitioner is below the line. This template was requested but was NOT in the paste — it is built here.",
  tierPrices: { basic: 99, standard: 175, premium: 250 },
  prepFeeNote:
    "Locked I-864 prep fee — Basic $99 / Standard $175 / Premium $250. (bundles.ts still marks the I-864-only service fee TO BE CONFIRMED — see the header flag; this price comes from the locked price list for this build.)",
  govFees: [
    {
      label: "USCIS fee — I-864",
      amountCents: 0,
      locked: true,
      note: "No separate USCIS fee — the I-864 is filed with the underlying petition / submitted to NVC.",
    },
    {
      label: "DOS fee — AOS (CEAC, consular cases only)",
      amountCents: 12000,
      locked: true,
      appliesOnly: "Consular cases only",
      note: "$120 per case, paid in CEAC, separate from the prep fee. Consular cases only — not charged on in-U.S. filings.",
    },
  ],
  govTotalNote:
    "No separate USCIS fee for the I-864 itself ($0, locked). The $120 AOS fee applies to consular cases only, so it is NOT included in a one-off gov total for this template.",
  checklist: [
    { id: "i864-edition", title: "Correct Form I-864 edition 08/24/26 — verify the edition date at the bottom of every page (mandatory since Oct 1, 2026)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "USCIS Notices", formCode: "I-864", auditRule: "incomplete_form_section", blocking: true },
    { id: "i864-status", title: "Proof of U.S. citizen / LPR status + U.S. domicile (passport, birth certificate, Certificate of Naturalization, or green card front/back; driver's license, lease, or utility bill)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-864", auditRule: "missing_document", blocking: true },
    { id: "i864-transcripts", title: "IRS tax transcripts — most recent year (complete Form 1040 + all W-2s and 1099s if no transcript); past 3 years recommended if income recently increased", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Financial/Tax", formCode: "I-864", auditRule: "missing_document", blocking: true },
    { id: "i864-employment", title: "Current employment proof — most recent 6 months of pay stubs + employment verification letter (job title and annual salary)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Financial/Tax", formCode: "I-864", auditRule: "missing_document", blocking: true },
    { id: "i864-household-125", title: "Household size + 125% 2026 threshold check (e.g. household of 4, 48 states: $41,250 required; 100% military $33,000) — see SPONSOR_125_2026 in this file", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Financial/Tax", formCode: "I-864", auditRule: "incomplete_form_section", blocking: true },
    { id: "i864-credit-freeze", title: "Temporarily lift credit freezes at Equifax, Experian, and TransUnion before filing (the 08/24/26 edition authorizes a consumer credit/reporting check; a freeze can delay verification)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Financial/Tax", formCode: "I-864", auditRule: "incomplete_form_section", blocking: false },
    { id: "i864-joint-sponsor", title: "Joint Sponsor's own Form I-864 (separate person; meets 125% on THEIR OWN household size, by themself — incomes are not combined)", assignedTo: "Joint Sponsor", translationRequired: false, vaultCategory: "Financial/Tax", formCode: "I-864", condition: "Only if the petitioner is below 125% — invite via the Sponsor / Family Door", auditRule: "missing_document", blocking: true },
    { id: "i864a-household", title: "Form I-864A — household member adds income/assets (relative living at the sponsor's address, signs I-864A)", assignedTo: "Joint Sponsor", translationRequired: false, vaultCategory: "Financial/Tax", formCode: "I-864A", condition: "Only if a household member's income/assets are needed", auditRule: "missing_document", blocking: true },
    { id: "i864-assets", title: "Asset proof if using assets to close an income gap (3x shortfall for spouse / minor child of a U.S. citizen, 5x most other cases; net value, convertible to cash within 12 months)", assignedTo: "Primary Client", translationRequired: true, vaultCategory: "Financial/Tax", formCode: "I-864", condition: "Only if assets are used — bank/brokerage statements, deeds, appraisals (within 12 months), mortgage/lien statements", auditRule: "untranslated_foreign_document", blocking: true },
  ],
  lifecycleStage: "active_client",
  stage4Note:
    "Stage 4 — Active Client (Docs & Drafting): collect the items above, run the packet audit to 100%, draft the forms, then e-sign once the balance is paid. If the sponsor is NOT YET QUALIFIED, the next step is a Joint Sponsor invite — never file an I-864 that does not meet the threshold.",
};

const I90_TEMPLATE: FormChecklistTemplate = {
  id: "i90",
  name: "I-90 Green Card Renewal",
  formsIncluded: ["I-90"],
  summary:
    "Application to Replace Permanent Resident Card (lost / stolen / expired / damaged). Individual application — one applicant per filing.",
  tierPrices: { basic: 129, standard: 240, premium: 350 },
  prepFeeNote:
    "Locked I-90 prep fee — Basic $129 / Standard $240 / Premium $350. (bundles.ts still marks the I-90 service fee TO BE CONFIRMED — see the header flag; this price comes from the locked price list for this build.)",
  govFees: [
    {
      label: "USCIS fee — I-90",
      amountCents: null,
      locked: false,
      note: "$415 online / $465 paper are UNVERIFIED — TO BE CONFIRMED. Confirm at uscis.gov/fees before paying.",
    },
  ],
  govTotalNote:
    "No verified gov total: the $415 online / $465 paper figures are UNVERIFIED. The total is TO BE CONFIRMED.",
  checklist: [
    { id: "i90-greencard", title: "Current green card (front and back) or proof of LPR status", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-90", auditRule: "missing_document", blocking: true },
    { id: "i90-id", title: "Passport / government-issued ID", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-90", auditRule: "missing_document", blocking: true },
    { id: "i90-reason", title: "Reason for replacement (lost / stolen / expired / damaged)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "USCIS Notices", formCode: "I-90", auditRule: "incomplete_form_section", blocking: true },
    { id: "i90-photos", title: "Passport photos (2x2)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-90", auditRule: "missing_document", blocking: true },
    { id: "i90-police", title: "Police report (if card was stolen)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "USCIS Notices", formCode: "I-90", condition: "Only if the card was stolen", auditRule: "missing_document", blocking: false },
  ],
  lifecycleStage: "active_client",
  stage4Note:
    "Stage 4 — Active Client (Docs & Drafting): collect the items above, run the packet audit to 100%, draft the form, then e-sign once the balance is paid.",
};

// ---------------------------------------------------------------------------
// EXPANDED FORMS (2026-11-19): I-131, I-751, I-539, I-129F.
// Prep tiers are the LOCKED tiers in src/lib/dynamicIntakeSchemas.ts
// (the paste's example tiers are NOT used). Gov fees are labelled
// LOCKED or TO BE CONFIRMED per that file. Assignees follow the
// existing convention in this file — Primary Client for the applicant's
// own items, Spouse-Beneficiary for the spouse / fiancé(e) items — and
// translationRequired is true only for a foreign-language document.
// The paste itself was not supplied with the task, so no assignment or
// translation flag is claimed to come from it; each row below says
// what it is on its own terms.
// ---------------------------------------------------------------------------

const I131_TEMPLATE: FormChecklistTemplate = {
  id: "i131",
  name: "I-131 Travel Document / Advance Parole",
  formsIncluded: ["I-131"],
  summary:
    "Application for Travel Document — Advance Parole (pending I-485 / TPS), Reentry Permit, Refugee Travel Document, or Emergency Advance Parole. Applicant only — each traveller files their own I-131.",
  tierPrices: { basic: 250, standard: 325, premium: 400 },
  prepFeeNote:
    "Locked I-131 prep fee — Basic $250 / Standard $325 / Premium $400. Speed fee: Standard +$0, Rush +$199, Express +$399 (packet preparation time, NOT USCIS processing time). The paste's $250/$350/$475 example tiers are NOT used.",
  govFees: [
    {
      label: "USCIS fee — I-131 (online)",
      amountCents: null,
      locked: false,
      note: "$580 online — TO BE CONFIRMED. Confirm at uscis.gov/fees before paying.",
    },
    {
      label: "USCIS fee — I-131 (paper)",
      amountCents: null,
      locked: false,
      note: "$630 paper — TO BE CONFIRMED. Confirm at uscis.gov/fees before paying.",
    },
    {
      label: "USCIS fee — I-131 Refugee Travel Document",
      amountCents: null,
      locked: false,
      appliesOnly: "Refugee Travel Document only",
      note: "$575 — TO BE CONFIRMED. Confirm at uscis.gov/fees before paying.",
    },
  ],
  govTotalNote:
    "No single verified gov total: $580 online / $630 paper (and $575 Refugee Travel Document) are all TO BE CONFIRMED. The total is TO BE CONFIRMED.",
  checklist: [
    { id: "i131-passport", title: "Passport bio page", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-131", auditRule: "missing_document", blocking: true },
    { id: "i131-greencard-receipt", title: "Green card / receipt notice (front and back)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-131", auditRule: "missing_document", blocking: true },
    { id: "i131-trip-purpose", title: "Purpose of travel + travel dates (intended departure date, trip length, countries, purpose)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-131", auditRule: "incomplete_form_section", blocking: true },
    { id: "i131-photos", title: "Passport photos (2x2)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-131", auditRule: "missing_document", blocking: true },
    { id: "i131-prior-travel-document", title: "Prior travel document (if re-applying)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "USCIS Notices", formCode: "I-131", condition: "Only if re-applying for a travel document", auditRule: "missing_document", blocking: false },
    { id: "i131-emergency-proof", title: "Emergency proof (Emergency Advance Parole only)", assignedTo: "Primary Client", translationRequired: true, vaultCategory: "Medical/Police", formCode: "I-131", condition: "Only for Emergency Advance Parole", auditRule: "missing_document", blocking: true },
  ],
  lifecycleStage: "active_client",
  stage4Note:
    "Stage 4 — Active Client (Docs & Drafting): collect the items above, run the packet audit to 100%, draft the form, then e-sign once the balance is paid.",
};

const I751_TEMPLATE: FormChecklistTemplate = {
  id: "i751",
  name: "I-751 Remove Conditions on Residence",
  formsIncluded: ["I-751"],
  summary:
    "Petition to Remove Conditions on Residence for a 2-year conditional green card. File within the 90-day window before the conditional card expires — jointly with the petitioning spouse, or alone on a waiver (divorce, battery/cruelty, or hardship).",
  tierPrices: { basic: 139, standard: 295, premium: 449 },
  prepFeeNote:
    "Locked I-751 prep fee — Basic $139 / Standard $295 / Premium $449. Speed fee: Standard +$0, Rush +$199, Express +$399 (packet preparation time, NOT USCIS processing time). The paste's $550/$725/$900 example tiers are NOT used.",
  govFees: [
    {
      label: "USCIS fee — I-751 (paper)",
      amountCents: 75000,
      locked: true,
      note: "$750 — LOCKED. I-751 paper only $750. Paid to U.S. Department of Homeland Security, separate from the prep fee.",
    },
  ],
  govTotalNote:
    "Locked gov fee: $750 (I-751 paper only). The prep fee is separate — never combine them into one total without showing both lines.",
  checklist: [
    { id: "i751-greencard", title: "Conditional green card (front and back) + expiry date", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-751", auditRule: "missing_document", blocking: true },
    { id: "i751-marriage-certificate", title: "Marriage certificate (+ certified translation if foreign)", assignedTo: "Primary Client", translationRequired: true, vaultCategory: "Relationship Proof", formCode: "I-751", auditRule: "untranslated_foreign_document", blocking: true },
    { id: "i751-shared-addresses", title: "Shared addresses timeline (with dates)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Relationship Proof", formCode: "I-751", auditRule: "incomplete_form_section", blocking: true },
    { id: "i751-joint-evidence", title: "Joint evidence — joint bank statements, lease, tax returns, photos, children's birth certificates", assignedTo: "Spouse-Beneficiary", translationRequired: true, vaultCategory: "Relationship Proof", formCode: "I-751", condition: "Joint filing only", auditRule: "untranslated_foreign_document", blocking: true },
    { id: "i751-waiver-evidence", title: "Waiver evidence — divorce decree, police/medical records, or hardship evidence", assignedTo: "Primary Client", translationRequired: true, vaultCategory: "Relationship Proof", formCode: "I-751", condition: "Waiver filing only (divorce / battery-cruelty / hardship)", auditRule: "untranslated_foreign_document", blocking: true },
    { id: "i751-photos", title: "Passport photos (2x2)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-751", auditRule: "missing_document", blocking: true },
    { id: "i751-spouse-id", title: "Petitioning spouse ID / status proof", assignedTo: "Spouse-Beneficiary", translationRequired: false, vaultCategory: "Identity", formCode: "I-751", condition: "Joint filing only", auditRule: "missing_document", blocking: true },
  ],
  lifecycleStage: "active_client",
  stage4Note:
    "Stage 4 — Active Client (Docs & Drafting): collect the items above, run the packet audit to 100%, draft the form, then e-sign once the balance is paid. Do not file before the 90-day window opens or after the card expires — see the I-751 timeline validator in src/lib/dynamicIntakeSchemas.ts.",
};

const I539_TEMPLATE: FormChecklistTemplate = {
  id: "i539",
  name: "I-539 Extend / Change Nonimmigrant Status",
  formsIncluded: ["I-539", "I-539A"],
  summary:
    "Application to Extend / Change Nonimmigrant Status, or to request reinstatement. Must be filed BEFORE the current I-94 expires. Co-applicants file on Form I-539A.",
  tierPrices: { basic: 250, standard: 375, premium: 500 },
  prepFeeNote:
    "Locked I-539 prep fee — Basic $250 / Standard $375 / Premium $500. Speed fee: Standard +$0, Rush +$199, Express +$399 (packet preparation time, NOT USCIS processing time). The paste's $350/$475/$625 example tiers are NOT used.",
  govFees: [
    {
      label: "USCIS fee — I-539 (online)",
      amountCents: null,
      locked: false,
      note: "$420 online — TO BE CONFIRMED. Confirm at uscis.gov/fees before paying.",
    },
    {
      label: "USCIS fee — I-539 (paper)",
      amountCents: null,
      locked: false,
      note: "$470 paper — TO BE CONFIRMED. Confirm at uscis.gov/fees before paying.",
    },
    {
      label: "Premium Processing — Form I-907 (eligible F/J/M categories only)",
      amountCents: null,
      locked: false,
      appliesOnly: "Eligible F/J/M categories only",
      note: "+$1,965 — TO BE CONFIRMED, eligible categories only. Do not add this fee unless the category is eligible.",
    },
  ],
  govTotalNote:
    "No single verified gov total: $420 online / $470 paper are TO BE CONFIRMED, and the +$1,965 I-907 premium-processing fee applies to eligible F/J/M categories only (also TO BE CONFIRMED). The total is TO BE CONFIRMED.",
  checklist: [
    { id: "i539-passport", title: "Passport bio page + all pages with visas / stamps", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-539", auditRule: "missing_document", blocking: true },
    { id: "i539-i94", title: "Current I-94 (record + expiry date)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "USCIS Notices", formCode: "I-539", auditRule: "incomplete_form_section", blocking: true },
    { id: "i539-status-evidence", title: "Evidence of current status (visa, prior approval notices, school / employer letter if applicable)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "USCIS Notices", formCode: "I-539", auditRule: "missing_document", blocking: true },
    { id: "i539-financial-support", title: "Financial support evidence (bank statements / sponsor support)", assignedTo: "Primary Client", translationRequired: true, vaultCategory: "Financial/Tax", formCode: "I-539", auditRule: "untranslated_foreign_document", blocking: true },
    { id: "i539-coapplicants", title: "Form I-539A for each co-applicant + their passports / I-94s", assignedTo: "Spouse-Beneficiary", translationRequired: false, vaultCategory: "Identity", formCode: "I-539A", condition: "Only if co-applicants are included", auditRule: "missing_document", blocking: true },
    { id: "i539-photos", title: "Passport photos (2x2)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-539", auditRule: "missing_document", blocking: true },
  ],
  lifecycleStage: "active_client",
  stage4Note:
    "Stage 4 — Active Client (Docs & Drafting): collect the items above, run the packet audit to 100%, draft the form, then e-sign once the balance is paid. File BEFORE the I-94 expiry date — see the I-539 timeline validator in src/lib/dynamicIntakeSchemas.ts.",
};

const I129F_TEMPLATE: FormChecklistTemplate = {
  id: "i129f",
  name: "I-129F Fiancé(e) — K-1",
  formsIncluded: ["I-129F"],
  summary:
    "Petition for Alien Fiancé(e) (K-1). The U.S. citizen petitioner and the fiancé(e) abroad must have met in person within 2 years before filing. After USCIS approval the case transfers to NVC, then to the embassy for the K-1 interview — tracked with the same NVC engine as I-130 consular (src/lib/nvc.ts).",
  tierPrices: { basic: 750, standard: 925, premium: 1095 },
  prepFeeNote:
    "Locked I-129F prep fee — Basic $750 / Standard $925 / Premium $1,095. Speed fee: Standard +$0, Rush +$199, Express +$399 (packet preparation time, NOT USCIS processing time). The paste's $750/$975/$1,200 example tiers are NOT used.",
  govFees: [
    {
      label: "USCIS fee — I-129F",
      amountCents: null,
      locked: false,
      note: "$675 USCIS — TO BE CONFIRMED. Confirm at uscis.gov/fees before paying.",
    },
    {
      label: "K-1 Visa Fee at Embassy",
      amountCents: null,
      locked: false,
      note: "$265 K-1 visa fee, paid at the embassy — TO BE CONFIRMED. Separate from the USCIS fee and from the prep fee.",
    },
  ],
  govTotalNote:
    "No single verified gov total: $675 USCIS + $265 K-1 visa fee at the embassy are both TO BE CONFIRMED. The $265 is paid at the embassy, not to USCIS. The total is TO BE CONFIRMED.",
  checklist: [
    { id: "i129f-petitioner-citizenship", title: "Petitioner proof of U.S. citizenship (birth certificate, passport, or naturalization certificate)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Identity", formCode: "I-129F", auditRule: "missing_document", blocking: true },
    { id: "i129f-fiance-passport", title: "Fiancé(e) passport bio page", assignedTo: "Spouse-Beneficiary", translationRequired: false, vaultCategory: "Identity", formCode: "I-129F", auditRule: "missing_document", blocking: true },
    { id: "i129f-meeting-evidence", title: "Proof you met in person within 2 years (photos together, travel stamps, boarding passes, hotel receipts)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "Relationship Proof", formCode: "I-129F", auditRule: "missing_document", blocking: true },
    { id: "i129f-intent-to-marry", title: "Statements of intent to marry within 90 days of entry (petitioner + fiancé(e))", assignedTo: "Spouse-Beneficiary", translationRequired: true, vaultCategory: "Relationship Proof", formCode: "I-129F", auditRule: "untranslated_foreign_document", blocking: true },
    { id: "i129f-photos", title: "Passport photos (2x2) — petitioner + fiancé(e)", assignedTo: "Spouse-Beneficiary", translationRequired: false, vaultCategory: "Identity", formCode: "I-129F", auditRule: "missing_document", blocking: true },
    { id: "i129f-nvc-case", title: "NVC case number + Invoice ID (after USCIS approval and transfer to NVC)", assignedTo: "Primary Client", translationRequired: false, vaultCategory: "USCIS Notices", formCode: "I-129F", condition: "After USCIS approval — K-1 NVC tracking, same NVC engine as I-130 consular", auditRule: "missing_document", blocking: false },
  ],
  lifecycleStage: "active_client",
  stage4Note:
    "Stage 4 — Active Client (Docs & Drafting): collect the items above, run the packet audit to 100%, draft the form, then e-sign once the balance is paid. After USCIS approval, log the NVC case number + Invoice ID in the K-1 NVC tracker so the petitioner and the fiancé(e) abroad can track the embassy interview + medical exam.",
};

// Family Adjustment Bundle composite — built from the two templates
// above (consular-only rows excluded: this bundle is in-U.S.
// adjustment), de-duplicated by title. Prices and form list come
// straight from FAMILY_ADJUSTMENT_BUNDLE in bundles.ts.
function buildFamilyAdjustmentTemplate(): FormChecklistTemplate {
  const seen = new Set<string>();
  const checklist: FormChecklistItem[] = [];
  for (const item of [...I130_NVC_TEMPLATE.checklist, ...I485_TEMPLATE.checklist]) {
    if (item.condition === "Consular case only") continue;
    const key = item.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    checklist.push({ ...item, id: `fam-${item.id}` });
  }
  return {
    id: "family-adjustment",
    name: "Family Adjustment Bundle",
    formsIncluded: [...FAMILY_ADJUSTMENT_BUNDLE.forms],
    summary:
      "Marriage / Family Green Card inside the U.S.: I-130, I-485, I-130A, I-864, I-765, I-131, I-693. I-130A included free with I-130.",
    tierPrices: {
      basic: FAMILY_ADJUSTMENT_BUNDLE.price.basic,
      standard: FAMILY_ADJUSTMENT_BUNDLE.price.standard,
      premium: FAMILY_ADJUSTMENT_BUNDLE.price.premium,
    },
    prepFeeNote: `Locked Family Adjustment Bundle prep fee — Basic $${FAMILY_ADJUSTMENT_BUNDLE.price.basic} / Standard $${FAMILY_ADJUSTMENT_BUNDLE.price.standard} / Premium $${FAMILY_ADJUSTMENT_BUNDLE.price.premium}.`,
    govFees: [
      {
        label: "USCIS fee — I-485 (paper)",
        amountCents: 144000,
        locked: true,
        note: "$1,440 — paper only, mandatory 09/18/26 edition.",
      },
      {
        label: "USCIS fee — I-130",
        amountCents: null,
        locked: false,
        note: "$675 TO BE CONFIRMED. Confirm at uscis.gov/fees before paying.",
      },
      {
        label: "USCIS fee — I-765 (EAD, concurrent with I-485)",
        amountCents: null,
        locked: false,
        note: "$260 concurrent-filing fee is UNVERIFIED — TO BE CONFIRMED.",
      },
      {
        label: "USCIS fee — I-131 (Travel Document, if filing concurrently)",
        amountCents: null,
        locked: false,
        note: "TO BE CONFIRMED — not in the locked fee list.",
      },
      {
        label: "Sealed Form I-693 medical exam — paid to the doctor",
        amountCents: null,
        locked: false,
        note: "Third-party cost, NOT a USCIS fee: $250–$500 to the doctor (free booking).",
      },
    ],
    govTotalNote:
      "Locked gov fee in this bundle: $1,440 (I-485 paper). The I-130 fee, I-765 concurrent fee, I-131 fee and I-693 doctor cost are TO BE CONFIRMED / third-party, so no single gov total is quoted.",
    checklist,
    lifecycleStage: "active_client",
    stage4Note:
      "Stage 4 — Active Client (Docs & Drafting): collect the items above, run the packet audit to 100%, draft the forms, then e-sign once the balance is paid.",
  };
}

export const FORM_CHECKLIST_TEMPLATES: FormChecklistTemplate[] = [
  I130_NVC_TEMPLATE,
  I485_TEMPLATE,
  I821_I765_TEMPLATE,
  N400_TEMPLATE,
  I589_TEMPLATE,
  I864_TEMPLATE,
  I90_TEMPLATE,
  I131_TEMPLATE,
  I751_TEMPLATE,
  I539_TEMPLATE,
  I129F_TEMPLATE,
  buildFamilyAdjustmentTemplate(),
];

export function getTemplate(templateId: string): FormChecklistTemplate | null {
  return FORM_CHECKLIST_TEMPLATES.find((t) => t.id === templateId) ?? null;
}

/** Lead Sheet service -> template. "other" has no template (TO BE CONFIRMED). */
export function templateIdForService(
  serviceRequested: ServiceRequested
): string | null {
  switch (serviceRequested) {
    case "family_bundle":
      return "family-adjustment";
    case "I-130":
      return "i130-nvc";
    case "I-485":
      return "i485";
    case "N-400":
      return "n400";
    case "I-589":
      return "i589";
    case "I-821":
      return "i821-i765";
    case "other":
      return null;
  }
}

/**
 * Expanded-form code -> template. Kept separate from
 * templateIdForService() because ServiceRequested in
 * src/lib/lifecycle.ts does not include I-131 / I-751 / I-539 / I-129F
 * (that file was not in scope for this task) — this helper is the
 * mapping the Dynamic Intake Engine uses. Returns null for any other
 * code, never a guessed template.
 */
export function templateIdForDynamicForm(
  formCode: "I-131" | "I-751" | "I-539" | "I-129F"
): string {
  switch (formCode) {
    case "I-131":
      return "i131";
    case "I-751":
      return "i751";
    case "I-539":
      return "i539";
    case "I-129F":
      return "i129f";
  }
}

// ---------------------------------------------------------------------------
// Rows for a template (pure — no Supabase, no side effects)
// ---------------------------------------------------------------------------

export interface InboxItemDraft {
  /** inbox_items.type — always 'missing_document' for a checklist row. */
  type: "missing_document";
  status: "missing";
  title: string;
  /** Assigned person + translation flag + condition, in plain text. */
  instructions: string;
  vaultCategory: ChecklistVaultCategory;
  formCode: string;
}

export interface PacketAuditItemDraft {
  rule: AuditItem["rule"];
  label: string;
  weight: number;
  status: "fail";
  blocking: boolean;
  detail: string;
}

export interface OrderLineDraft {
  kind: "preparation" | "uscis_government";
  label: string;
  /** Integer cents. Null = TO BE CONFIRMED — do not charge this line yet. */
  amountCents: number | null;
  locked: boolean;
  note?: string;
}

export interface TemplateRows {
  template: FormChecklistTemplate;
  tier: ServiceTier;
  prepFeeCents: number | null;
  lockedGovFeeCents: number;
  inboxItems: InboxItemDraft[];
  auditItems: PacketAuditItemDraft[];
  /** Prep fee first, then one line per gov fee — never combined. */
  orderLines: OrderLineDraft[];
}

export function rowsForTemplate(
  templateId: string,
  tier: ServiceTier = "standard"
): TemplateRows | null {
  const template = getTemplate(templateId);
  if (!template) return null;
  const prepFeeCents = prepFeeCentsForTier(template, tier);
  const lockedGov = lockedGovFeeCents(template);
  const inboxItems: InboxItemDraft[] = template.checklist.map((item) => ({
    type: "missing_document",
    status: "missing",
    title: item.title,
    instructions: [
      `Assigned to: ${item.assignedTo}.`,
      item.translationRequired
        ? "Certified English translation required if the document is not in English."
        : "",
      item.condition ? `Applies: ${item.condition}.` : "",
      `Form: ${item.formCode}.`,
    ]
      .filter(Boolean)
      .join(" "),
    vaultCategory: item.vaultCategory,
    formCode: item.formCode,
  }));
  const auditItems: PacketAuditItemDraft[] = template.checklist.map((item) => ({
    rule: item.auditRule,
    label: item.title,
    weight: 10,
    status: "fail",
    blocking: item.blocking,
    detail: `Assigned to: ${item.assignedTo}${item.translationRequired ? " — certified translation required" : ""}${item.condition ? ` — ${item.condition}` : ""}.`,
  }));
  const orderLines: OrderLineDraft[] = [
    {
      kind: "preparation",
      label: `Clerical prep fee — ${template.name} (${tier})`,
      amountCents: prepFeeCents,
      locked: prepFeeCents !== null,
      note:
        prepFeeCents === null
          ? "TO BE CONFIRMED — no locked prep fee for this template. Do not charge until confirmed."
          : template.prepFeeNote,
    },
    ...template.govFees.map((fee) => ({
      kind: "uscis_government" as const,
      label: fee.label,
      amountCents: fee.amountCents,
      locked: fee.locked,
      note: fee.note,
    })),
  ];
  return { template, tier, prepFeeCents, lockedGovFeeCents: lockedGov, inboxItems, auditItems, orderLines };
}

// ---------------------------------------------------------------------------
// Packet audit wiring (src/lib/audit.ts)
// ---------------------------------------------------------------------------

/** AuditItem rows for a template, for computePacketReadiness. */
export function auditItemsForTemplate(templateId: string): AuditItem[] {
  const template = getTemplate(templateId);
  if (!template) return [];
  return template.checklist.map((item) => ({
    id: `audit-${item.id}`,
    rule: item.auditRule,
    label: item.title,
    weight: 10,
    status: "fail",
    blocking: item.blocking,
    detail: `Assigned to: ${item.assignedTo}${item.translationRequired ? " — certified translation required" : ""}.`,
  }));
}

/**
 * Readiness for a template given the checklist item ids already cleared.
 * Ready only at 100% with every blocking item cleared (audit.ts).
 */
export function readinessForTemplate(templateId: string, clearedItemIds: string[]) {
  const items = auditItemsForTemplate(templateId).map((item) => ({
    ...item,
    status: clearedItemIds.includes(item.id.replace(/^audit-/, ""))
      ? ("pass" as const)
      : item.status,
  }));
  return computePacketReadiness(items);
}

// ---------------------------------------------------------------------------
// Service-order draft (migration 0006 service_orders columns)
// ---------------------------------------------------------------------------

export interface ServiceOrderDraft {
  packageTitle: string;
  orderedForms: string[];
  paymentPlanType: PaymentPlanType;
  /** Prep fee ONLY, integer cents. Null = TO BE CONFIRMED — do NOT insert the order yet. */
  totalServiceFeeCents: number | null;
  /** LOCKED, one-off, always-applicable gov fees only, integer cents.
   *  TBC, recurring and conditional gov fees are excluded (named in govFeeNote). */
  estimatedUscisGovFeeCents: number;
  /** Names the excluded TBC gov fees, so the estimate is never misread. */
  govFeeNote: string;
  prepFeeNote: string;
}

export function serviceOrderDraftForTemplate(
  templateId: string,
  tier: ServiceTier,
  plan: PaymentPlanType
): ServiceOrderDraft | null {
  const template = getTemplate(templateId);
  if (!template) return null;
  const tbcGov = template.govFees
    .filter((fee) => !fee.locked)
    .map((fee) => fee.label)
    .join("; ");
  return {
    packageTitle: template.name,
    orderedForms: template.formsIncluded,
    paymentPlanType: plan,
    totalServiceFeeCents: prepFeeCentsForTier(template, tier),
    estimatedUscisGovFeeCents: lockedGovFeeCents(template),
    govFeeNote: tbcGov
      ? `Gov fees NOT in this estimate (TO BE CONFIRMED): ${tbcGov}. ${template.govTotalNote}`
      : template.govTotalNote,
    prepFeeNote: template.prepFeeNote,
  };
}

// ---------------------------------------------------------------------------
// Insert checklist rows into Supabase (Lead Sheet / Case Creator hook)
// ---------------------------------------------------------------------------

export interface InsertChecklistArgs {
  caseId: string;
  /** accounts.id of the client (primary client on the case). */
  clientId: string;
  /** accounts.id of the preparer doing the insert (RLS: inbox_items
   *  INSERT requires requested_by = current_account_id()). */
  requestedBy: string;
  providerId?: string | null;
  templateId: string;
  tier?: ServiceTier;
}

export interface InsertChecklistResult {
  templateId: string;
  insertedInboxItems: number;
  insertedAuditItems: number;
  errors: string[];
}

/**
 * Insert a template's checklist into the REAL tables:
 *   inbox_items (type 'missing_document', status 'missing') and
 *   packet_audit_items (status 'fail', blocking per template).
 *
 * Deliberately NOT public.documents: a documents row is a real file
 * (file_name, whitelisted mime_type, UNIQUE storage_path,
 * storage_bucket = 'vault'). Checklist rows have no file yet; when a
 * file is uploaded, inbox_items.document_id links to the documents
 * row. RLS: the caller must be a case participant (migration 0001 /
 * 0003 via is_case_participant) and requested_by must be themself.
 * Returns counts + errors instead of throwing, so the Case Creator
 * can show exactly what landed and what did not. Nothing is claimed
 * live: if Supabase is not connected, the caller must not call this
 * (getSupabase() returns null) — see the header integration note.
 */
export async function insertChecklistRows(
  supabase: SupabaseClient,
  args: InsertChecklistArgs
): Promise<InsertChecklistResult> {
  const result: InsertChecklistResult = {
    templateId: args.templateId,
    insertedInboxItems: 0,
    insertedAuditItems: 0,
    errors: [],
  };
  const rows = rowsForTemplate(args.templateId, args.tier ?? "standard");
  if (!rows) {
    result.errors.push(
      `Unknown template id "${args.templateId}" — no checklist rows inserted.`
    );
    return result;
  }
  if (rows.prepFeeCents === null) {
    result.errors.push(
      `Prep fee for "${rows.template.name}" is TO BE CONFIRMED — checklist rows were still inserted, but do NOT create a service order or charge until the prep fee is confirmed.`
    );
  }
  const inboxPayload = rows.inboxItems.map((item) => ({
    case_id: args.caseId,
    client_id: args.clientId,
    provider_id: args.providerId ?? null,
    type: item.type,
    status: item.status,
    title: item.title,
    instructions: item.instructions,
    vault_category: item.vaultCategory,
    requested_by: args.requestedBy,
  }));
  const { error: inboxError } = await supabase
    .from("inbox_items")
    .insert(inboxPayload);
  if (inboxError) {
    result.errors.push(`inbox_items insert failed: ${inboxError.message}`);
    return result;
  }
  result.insertedInboxItems = inboxPayload.length;

  const auditPayload = rows.auditItems.map((item) => ({
    case_id: args.caseId,
    rule: item.rule,
    label: item.label,
    weight: item.weight,
    status: item.status,
    blocking: item.blocking,
    detail: item.detail,
  }));
  const { error: auditError } = await supabase
    .from("packet_audit_items")
    .insert(auditPayload);
  if (auditError) {
    result.errors.push(
      `packet_audit_items insert failed: ${auditError.message} (${result.insertedInboxItems} inbox_items rows were already inserted — re-run only the audit insert, do not duplicate the checklist.)`
    );
    return result;
  }
  result.insertedAuditItems = auditPayload.length;
  return result;
}

/** Human-readable gov-fee line for quotes: "$120" or "TO BE CONFIRMED". */
export function govFeeDisplay(line: GovFeeLine): string {
  return line.amountCents === null
    ? "TO BE CONFIRMED"
    : dollars(line.amountCents);
}
