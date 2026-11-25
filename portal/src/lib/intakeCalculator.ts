// Smart Guided Intake — fee tables + form determination (PURE logic).
// Single source of truth for the SmartIntakeCalculator component AND the
// /api/confirm-intake-order route, so the server re-computes every price
// from these locked tables and never trusts a total sent by the browser.
//
// FEE RULES (do not weaken these):
//  * Every government fee is labelled LOCKED or TO BE CONFIRMED. A
//    TO BE CONFIRMED fee is shown with its figure (when the task brief
//    gives one) but is NEVER counted in a subtotal and NEVER presented
//    as verified. The only locked gov fees in this repo are: I-485 paper
//    $1,440 · I-821 TPS $520 · I-589 $100 + $105/yr · NVC AOS $120 +
//    IV $325 (CEAC) · USCIS Immigrant Fee $235 · I-864 $0 (no separate
//    fee) · I-751 paper $750. Everything else below is TO BE CONFIRMED.
//  * Prep fees are the LOCKED bundle / single-form tiers only:
//    Family Adjustment Bundle $999 / $1,799 / $2,799; I-130 $299 / $499 /
//    $750 · I-485 $750 / $1,200 / $1,500 · I-821 $189 / $295 / $400 ·
//    I-765 $129 / $249 / $350 · N-400 $199 / $400 / $600 · I-589 $900 /
//    $1,050 / $1,200 · I-90 $129 / $240 / $350 · I-864 $99 / $175 / $250
//    · I-131 $250 / $325 / $400 · I-751 $139 / $295 / $449 · I-539
//    $250 / $375 / $500 · I-129F $750 / $925 / $1,095.
//    (Same locked list as src/lib/formChecklists.ts / serviceTiers.ts /
//    src/lib/dynamicIntakeSchemas.ts. The paste's example tiers for
//    the four expanded forms — I-131 $250/$350/$475, I-751
//    $550/$725/$900, I-539 $350/$475/$625, I-129F $750/$975/$1,200 —
//    were EXAMPLE prices, NOT locked, and are NOT used.)
//    The paste's Standard/Rush/Expedited prep fees ($1,100 / $1,450 /
//    $1,850 etc.) were EXAMPLE prices, NOT locked — they are NOT used.
//  * Speed fees are LOCKED and are PACKET PREPARATION time, NOT USCIS
//    processing time: Standard 15–30 days +$0 (included), Rush 7 days
//    +$199, 24-Hour Express +$399.
//  * Prep and government fees are ALWAYS shown on separate lines first.
//    A combined "total to budget" is shown ONLY after both subtotals,
//    and is labelled as a budgeting total, not a single charge: gov fees
//    are paid directly to USCIS / the Department of State, never to us.
//  * Payment plans are LOCKED only: Pay in Full / Pay in 3 / Monthly 6 /
//    Monthly 12. There is NO split_50_50 plan for immigration (50/50 is
//    the Florida Property Compliance OS default, a different business).
//  * Premium Processing (Form I-907, $1,780 TO BE CONFIRMED) is offered
//    ONLY for OPT / STEM EAD (standalone I-765) — NEVER for I-130 / I-485.
//    Separately, Form I-907 (+$1,965 TO BE CONFIRMED) is offered for
//    I-539 only for eligible F/J/M categories — never for other I-539
//    categories, and never added unless the category is eligible.
//  * Paper filings: USCIS is paid by Form G-1450 (card) or Form G-1650
//    (ACH debit) only — no personal checks, no money orders.
//  * Nothing is pre-selected anywhere: goal, location, filing method,
//    speed, tier and payment plan all start unchosen, in the UI and in
//    the API validation below.
//
// RECONCILIATIONS (paste figures NOT shipped as fact):
//  * I-821 "$510 + $30 biometrics" is NOT shown as a fee. The locked
//    I-821 TPS fee in this repo is $520; the $30 biometrics figure is
//    TO BE CONFIRMED and is shown as its own separate line.
//  * I-589 "$102/year" in the paste CONFLICTS with the locked $105/yr —
//    $105/yr is used and $102 is flagged below as unverified.
//  * I-130 + NVC "$1,355" is conditional arithmetic ($675 TBC + $120 +
//    $325 + $235) and is NEVER shown as a verified total; the three
//    locked NVC lines are shown separately.
//  * I-765 TPS EAD "$560 initial / $280 renewal" are TO BE CONFIRMED
//    figures from the task brief (not in the repo locked list).

import { FAMILY_ADJUSTMENT_BUNDLE } from "./bundles";
import { SINGLE_FORM_TIER_PRICES } from "./serviceTiers";
import { getTemplate, lockedGovFeeCents, type FormChecklistTemplate } from "./formChecklists";
import { splitInvoices } from "./stripe";
import type { PaymentPlanType } from "./order";

export type { PaymentPlanType };

export const USCIS_FEE_SCHEDULE_URL = "https://www.uscis.gov/fees";
export const USCIS_G1055_URL = "https://www.uscis.gov/g-1055";
export const STATE_DEPT_FEES_URL =
  "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/fees-visa-services.html";

export const GOV_FEE_DISCLAIMER =
  "Government fees change. Confirm the current fee at uscis.gov/fees before you pay.";

export const USCIS_PAYMENT_COMPLIANCE_NOTE =
  "Paying USCIS on a paper filing: use Form G-1450 (credit / debit card) or Form G-1650 (ACH debit from a U.S. bank account) only. Do NOT send a personal check or a money order with a paper filing.";

export type IntakeGoal =
  | "family"
  | "citizenship"
  | "renewal"
  | "tps"
  | "work_permit"
  | "asylum"
  | "travel_document"
  | "remove_conditions"
  | "extend_change_status"
  | "fiance_visa";

export type BeneficiaryLocation = "inside_us" | "outside_us";
export type FilingMethod = "online" | "paper";
export type SpeedId = "standard" | "rush" | "express";
export type TierId = "basic" | "standard" | "premium";

export const INTAKE_GOALS: { id: IntakeGoal; label: string; plainEnglish: string }[] = [
  { id: "family", label: "Family green card", plainEnglish: "Bring a spouse or relative to live in the U.S. as a permanent resident." },
  { id: "citizenship", label: "Citizenship (N-400)", plainEnglish: "Become a U.S. citizen." },
  { id: "renewal", label: "Green card renewal (I-90)", plainEnglish: "Replace or renew your green card." },
  { id: "tps", label: "TPS — Temporary Protected Status", plainEnglish: "Apply for or renew Temporary Protected Status and a work permit." },
  { id: "work_permit", label: "Work permit (I-765)", plainEnglish: "Apply for or renew an Employment Authorization Document." },
  { id: "asylum", label: "Asylum (I-589)", plainEnglish: "Apply for asylum. Clerical preparation only — this is not legal advice and not a guarantee of any outcome." },
  { id: "travel_document", label: "Travel Document / Advance Parole (I-131)", plainEnglish: "Travel outside the U.S. and return — Advance Parole, Reentry Permit, Refugee Travel Document, or Emergency Advance Parole." },
  { id: "remove_conditions", label: "Remove Conditions on Residence (I-751)", plainEnglish: "Remove the conditions on a 2-year conditional green card — file within the 90-day window before the card expires." },
  { id: "extend_change_status", label: "Extend / Change Nonimmigrant Status (I-539)", plainEnglish: "Extend your stay, change to another nonimmigrant status, or ask for reinstatement — file before your I-94 expires." },
  { id: "fiance_visa", label: "Fiancé(e) Visa — K-1 (I-129F)", plainEnglish: "Bring your fiancé(e) to the U.S. on a K-1 visa to marry within 90 days of entry." },
];

export const SPEED_OPTIONS: {
  id: SpeedId;
  label: string;
  dayRange: string;
  feeCents: number;
  note: string;
}[] = [
  {
    id: "standard",
    label: "Standard",
    dayRange: "15–30 days",
    feeCents: 0,
    note: "Included in the tier price. Packet preparation time — NOT USCIS processing time.",
  },
  {
    id: "rush",
    label: "Rush",
    dayRange: "7 days",
    feeCents: 19900,
    note: "+$199. Packet preparation time — NOT USCIS processing time.",
  },
  {
    id: "express",
    label: "24-Hour Express",
    dayRange: "24 hours",
    feeCents: 39900,
    note: "+$399. Packet preparation time — NOT USCIS processing time.",
  },
];

export function speedOption(id: SpeedId) {
  const found = SPEED_OPTIONS.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown preparation speed: ${id}`);
  return found;
}

export interface GovFeeLine {
  label: string;
  /** Integer cents, or null when TO BE CONFIRMED / no figure listed. */
  amountCents: number | null;
  locked: boolean;
  /** True for a recurring fee (I-589 $105/yr): its own line, never folded
   *  into a one-off subtotal. */
  recurring?: boolean;
  note?: string;
}

export interface PrepItem {
  /** Key the client picks a tier for: a form code, or "family-adjustment-bundle". */
  key: string;
  label: string;
  /** Locked tier prices (dollars), or null when no locked fee exists —
   *  the item is then TO BE CONFIRMED and contributes $0 to the total. */
  tierPrices: { basic: number; standard: number; premium: number } | null;
  note: string;
}

export interface IntakeDetermination {
  goal: IntakeGoal;
  goalLabel: string;
  forms: string[];
  packageTitle: string;
  /** Checklist template id in src/lib/formChecklists.ts, or null when no
   *  template exists for this intake (standalone I-765). */
  templateId: string | null;
  template: FormChecklistTemplate | null;
  prepItems: PrepItem[];
  govFees: GovFeeLine[];
  /** True only for standalone I-765 (OPT / STEM EAD) and for I-539
   *  (eligible F/J/M categories only). Never I-130 / I-485. When true,
   *  premiumProcessingLabel (below) is the exact checkbox text — the
   *  two eligible cases have different I-907 figures. */
  premiumProcessingEligible: boolean;
  /** Exact Premium Processing checkbox text for this goal, or undefined
   *  for the standalone-I-765 default (Form I-907, $1,780 TO BE
   *  CONFIRMED, OPT / STEM EAD only). */
  premiumProcessingLabel?: string;
  notes: string[];
}

function tbc(label: string, note: string): GovFeeLine {
  return { label, amountCents: null, locked: false, note };
}

/**
 * The 4 guided questions, answered -> exact forms, exact gov fees,
 * prep items and eligibility. Location only changes the answer for the
 * family goal (inside US = adjustment, outside US = consular / NVC);
 * every other goal is filed from inside the US.
 */
export function determineIntake(
  goal: IntakeGoal,
  location: BeneficiaryLocation | null,
  filingMethod: FilingMethod
): IntakeDetermination {
  const online = filingMethod === "online";
  const goalLabel = INTAKE_GOALS.find((g) => g.id === goal)?.label ?? goal;

  if (goal === "family") {
    if (location === "outside_us") {
      return {
        goal,
        goalLabel,
        forms: ["I-130", "DS-260", "I-864", "I-864A"],
        packageTitle: "I-130 + NVC Consular",
        templateId: "i130-nvc",
        template: getTemplate("i130-nvc"),
        prepItems: [
          {
            key: "I-130",
            label: "I-130 — Petition for Alien Relative",
            tierPrices: SINGLE_FORM_TIER_PRICES["I-130"],
            note: "Locked I-130 single-form prep fee — Basic $299 / Standard $499 / Premium $750.",
          },
          {
            key: "NVC",
            label: "NVC consular guidance (DS-260, CEAC, interview)",
            tierPrices: null,
            note: "TO BE CONFIRMED — no locked combined fee for the I-130 + NVC bundle. Do not quote a bundle total until it is confirmed.",
          },
        ],
        govFees: [
          tbc(
            "USCIS fee — I-130",
            online
              ? "$625 online / $675 paper — TO BE CONFIRMED. This filing is online, so $625 is the figure to confirm."
              : "$625 online / $675 paper — TO BE CONFIRMED. This filing is on paper, so $675 is the figure to confirm."
          ),
          { label: "DOS fee — AOS (CEAC)", amountCents: 12000, locked: true, note: "$120 per case, paid in CEAC, separate from the prep fee." },
          { label: "DOS fee — IV (CEAC)", amountCents: 32500, locked: true, note: "$325 per applicant, paid in CEAC, separate from the prep fee." },
          { label: "USCIS Immigrant Fee", amountCents: 23500, locked: true, note: "$235, paid at my.uscis.gov BEFORE flying, separate from the prep fee." },
        ],
        premiumProcessingEligible: false,
        notes: [
          "The NVC fees are three separate lines ($120 + $325 + $235) — they are never combined with the prep fee, and no $1,355 total is shown as verified: that total only works if the $675 I-130 figure is confirmed.",
          "Premium Processing (Form I-907) is not offered for I-130.",
        ],
      };
    }
    return {
      goal,
      goalLabel,
      forms: [...FAMILY_ADJUSTMENT_BUNDLE.forms],
      packageTitle: "Family Adjustment Bundle",
      templateId: "family-adjustment",
      template: getTemplate("family-adjustment"),
      prepItems: [
        {
          key: "family-adjustment-bundle",
          label: "Family Adjustment Bundle — I-130, I-485, I-130A, I-864, I-765, I-131, I-693 (I-130A included free with I-130)",
          tierPrices: { ...FAMILY_ADJUSTMENT_BUNDLE.price },
          note: "Locked bundle prep fee — Basic $999 / Standard $1,799 / Premium $2,799.",
        },
      ],
      govFees: [
        online
          ? tbc(
              "USCIS fee — I-485",
              "$1,390 online — TO BE CONFIRMED. The locked I-485 fee is $1,440 for paper filing (mandatory 09/18/26 edition); confirm the online figure at uscis.gov/fees before you pay."
            )
          : { label: "USCIS fee — I-485 (paper)", amountCents: 144000, locked: true, note: "$1,440 — paper only, mandatory 09/18/26 edition." },
        tbc(
          "USCIS fee — I-130",
          online
            ? "$625 online / $675 paper — TO BE CONFIRMED. This filing is online, so $625 is the figure to confirm."
            : "$625 online / $675 paper — TO BE CONFIRMED. This filing is on paper, so $675 is the figure to confirm."
        ),
        tbc("USCIS fee — I-765 (EAD, concurrent with I-485)", "$260 concurrent-filing fee — TO BE CONFIRMED. Confirm at uscis.gov/fees before paying."),
        tbc("USCIS fee — I-131 (Travel Document, if filing concurrently)", "TO BE CONFIRMED — no figure in the locked fee list. Confirm at uscis.gov/fees before paying."),
      ],
      premiumProcessingEligible: false,
      notes: [
        "Premium Processing (Form I-907) is not offered for I-130 / I-485.",
        "The I-693 sealed medical exam is paid to the doctor ($250–$500, free booking) — a third-party cost, not a USCIS fee.",
      ],
    };
  }

  if (goal === "citizenship") {
    return {
      goal,
      goalLabel,
      forms: ["N-400"],
      packageTitle: "N-400 Citizenship",
      templateId: "n400",
      template: getTemplate("n400"),
      prepItems: [
        { key: "N-400", label: "N-400 — Application for Naturalization", tierPrices: SINGLE_FORM_TIER_PRICES["N-400"], note: "Locked N-400 prep fee — Basic $199 / Standard $400 / Premium $600." },
      ],
      govFees: [
        tbc(
          "USCIS fee — N-400",
          online
            ? "$710 online / $760 paper / $380 reduced — TO BE CONFIRMED. This filing is online, so $710 is the figure to confirm."
            : "$710 online / $760 paper / $380 reduced — TO BE CONFIRMED. This filing is on paper, so $760 is the figure to confirm."
        ),
        tbc("USCIS fee — N-400 (reduced fee)", "$380 reduced fee — TO BE CONFIRMED, and only if you qualify. Ask your professional before counting on it."),
      ],
      premiumProcessingEligible: false,
      notes: ["Premium Processing (Form I-907) is not offered for N-400."],
    };
  }

  if (goal === "renewal") {
    return {
      goal,
      goalLabel,
      forms: ["I-90"],
      packageTitle: "I-90 Green Card Renewal",
      templateId: "i90",
      template: getTemplate("i90"),
      prepItems: [
        { key: "I-90", label: "I-90 — Application to Replace Permanent Resident Card", tierPrices: SINGLE_FORM_TIER_PRICES["I-90"], note: "Locked I-90 prep fee — Basic $129 / Standard $240 / Premium $350." },
      ],
      govFees: [
        tbc(
          "USCIS fee — I-90",
          online
            ? "$415 online / $465 paper — TO BE CONFIRMED. This filing is online, so $415 is the figure to confirm."
            : "$415 online / $465 paper — TO BE CONFIRMED. This filing is on paper, so $465 is the figure to confirm."
        ),
      ],
      premiumProcessingEligible: false,
      notes: ["Premium Processing (Form I-907) is not offered for I-90."],
    };
  }

  if (goal === "tps") {
    return {
      goal,
      goalLabel,
      forms: ["I-821", "I-765"],
      packageTitle: "I-821 TPS + I-765 EAD",
      templateId: "i821-i765",
      template: getTemplate("i821-i765"),
      prepItems: [
        { key: "I-821", label: "I-821 — Application for Temporary Protected Status", tierPrices: SINGLE_FORM_TIER_PRICES["I-821"], note: "Locked I-821 prep fee — Basic $189 / Standard $295 / Premium $400." },
        { key: "I-765", label: "I-765 — Employment Authorization (TPS)", tierPrices: SINGLE_FORM_TIER_PRICES["I-765"], note: "Locked I-765 prep fee — Basic $129 / Standard $249 / Premium $350." },
      ],
      govFees: [
        { label: "USCIS fee — I-821 (TPS)", amountCents: 52000, locked: true, note: "$520 — locked I-821 TPS fee." },
        tbc("USCIS fee — I-765 (EAD, TPS)", "$560 initial / $280 renewal — TO BE CONFIRMED. Your professional confirms which one applies to you."),
        tbc("Biometrics fee", "$30 — TO BE CONFIRMED. Confirm at uscis.gov/fees before paying."),
      ],
      premiumProcessingEligible: false,
      notes: [
        "Reconciliation: a pasted draft listed I-821 as “$510 + $30 biometrics”. That is NOT verified and is NOT shown as a fee. The locked I-821 TPS fee in this repo is $520, and the $30 biometrics figure is TO BE CONFIRMED on its own line.",
        "Premium Processing (Form I-907) is not offered for I-821 / TPS.",
      ],
    };
  }

  if (goal === "work_permit") {
    return {
      goal,
      goalLabel,
      forms: ["I-765"],
      packageTitle: "I-765 Work Permit (standalone)",
      templateId: null,
      template: null,
      prepItems: [
        { key: "I-765", label: "I-765 — Application for Employment Authorization", tierPrices: SINGLE_FORM_TIER_PRICES["I-765"], note: "Locked I-765 prep fee — Basic $129 / Standard $249 / Premium $350." },
      ],
      govFees: [
        tbc(
          "USCIS fee — I-765 (standalone)",
          online
            ? "$470 online / $520 paper — TO BE CONFIRMED. This filing is online, so $470 is the figure to confirm."
            : "$470 online / $520 paper — TO BE CONFIRMED. This filing is on paper, so $520 is the figure to confirm."
        ),
      ],
      premiumProcessingEligible: true,
      notes: [
        "Premium Processing (Form I-907, $1,780 TO BE CONFIRMED) is available ONLY for OPT / STEM EAD categories — never for I-130 / I-485. Your professional confirms your category before it is added.",
        "No standalone I-765 document checklist template exists in src/lib/formChecklists.ts yet — the checklist step for this goal is TO BE CONFIRMED and no checklist rows are created for it.",
      ],
    };
  }

  if (goal === "travel_document") {
    return {
      goal,
      goalLabel,
      forms: ["I-131"],
      packageTitle: "I-131 Travel Document / Advance Parole",
      templateId: "i131",
      template: getTemplate("i131"),
      prepItems: [
        { key: "I-131", label: "I-131 — Application for Travel Document", tierPrices: SINGLE_FORM_TIER_PRICES["I-131"], note: "Locked I-131 prep fee — Basic $250 / Standard $325 / Premium $400. Speed fee: Standard +$0, Rush +$199, Express +$399 (packet preparation time, NOT USCIS processing time)." },
      ],
      govFees: [
        tbc(
          "USCIS fee — I-131",
          online
            ? "$580 online / $630 paper — TO BE CONFIRMED. This filing is online, so $580 is the figure to confirm."
            : "$580 online / $630 paper — TO BE CONFIRMED. This filing is on paper, so $630 is the figure to confirm."
        ),
        tbc(
          "USCIS fee — I-131 Refugee Travel Document",
          "$575 — TO BE CONFIRMED. Applies only to a Refugee Travel Document, not to Advance Parole or a Reentry Permit. Confirm at uscis.gov/fees before paying."
        ),
      ],
      premiumProcessingEligible: false,
      notes: [
        "Do not travel outside the United States before Advance Parole is approved unless an attorney tells you it is safe — travelling without it can end a pending case.",
        "Premium Processing (Form I-907) is not offered for I-131.",
      ],
    };
  }

  if (goal === "remove_conditions") {
    return {
      goal,
      goalLabel,
      forms: ["I-751"],
      packageTitle: "I-751 Remove Conditions on Residence",
      templateId: "i751",
      template: getTemplate("i751"),
      prepItems: [
        { key: "I-751", label: "I-751 — Petition to Remove Conditions on Residence", tierPrices: SINGLE_FORM_TIER_PRICES["I-751"], note: "Locked I-751 prep fee — Basic $139 / Standard $295 / Premium $449. Speed fee: Standard +$0, Rush +$199, Express +$399 (packet preparation time, NOT USCIS processing time)." },
      ],
      govFees: [
        { label: "USCIS fee — I-751 (paper)", amountCents: 75000, locked: true, note: "$750 — LOCKED. I-751 paper only $750. Paid to U.S. Department of Homeland Security, separate from the prep fee." },
      ],
      premiumProcessingEligible: false,
      notes: [
        "I-751 is paper filing only — the $750 fee is the paper fee. If you chose online filing above, confirm with your professional: the I-751 is filed on paper.",
        "File within the 90-day window before the conditional card expires — not before the window opens, not after expiry. The intake engine checks the filing date against the window.",
        "Premium Processing (Form I-907) is not offered for I-751.",
      ],
    };
  }

  if (goal === "extend_change_status") {
    return {
      goal,
      goalLabel,
      forms: ["I-539", "I-539A"],
      packageTitle: "I-539 Extend / Change Nonimmigrant Status",
      templateId: "i539",
      template: getTemplate("i539"),
      prepItems: [
        { key: "I-539", label: "I-539 — Application to Extend / Change Nonimmigrant Status", tierPrices: SINGLE_FORM_TIER_PRICES["I-539"], note: "Locked I-539 prep fee — Basic $250 / Standard $375 / Premium $500. Speed fee: Standard +$0, Rush +$199, Express +$399 (packet preparation time, NOT USCIS processing time). Co-applicants file on Form I-539A." },
      ],
      govFees: [
        tbc(
          "USCIS fee — I-539",
          online
            ? "$420 online / $470 paper — TO BE CONFIRMED. This filing is online, so $420 is the figure to confirm."
            : "$420 online / $470 paper — TO BE CONFIRMED. This filing is on paper, so $470 is the figure to confirm."
        ),
        tbc(
          "Premium Processing — Form I-907 (eligible F/J/M categories only)",
          "+$1,965 — TO BE CONFIRMED, eligible F/J/M categories only. Do not add this fee unless the category is eligible."
        ),
      ],
      premiumProcessingEligible: true,
      premiumProcessingLabel:
        "Add Premium Processing — Form I-907 (+$1,965 — TO BE CONFIRMED). Only for eligible F/J/M categories. Your professional confirms your category before it is added.",
      notes: [
        "The I-539 must be filed BEFORE the current I-94 expires. The intake engine checks the filing date against the I-94 expiry date.",
        "Premium Processing (Form I-907, +$1,965 TO BE CONFIRMED) is available only for eligible F/J/M categories — never for other I-539 categories. It is never added to the totals below — the fee is TO BE CONFIRMED.",
      ],
    };
  }

  if (goal === "fiance_visa") {
    return {
      goal,
      goalLabel,
      forms: ["I-129F"],
      packageTitle: "I-129F Fiancé(e) — K-1",
      templateId: "i129f",
      template: getTemplate("i129f"),
      prepItems: [
        { key: "I-129F", label: "I-129F — Petition for Alien Fiancé(e) (K-1)", tierPrices: SINGLE_FORM_TIER_PRICES["I-129F"], note: "Locked I-129F prep fee — Basic $750 / Standard $925 / Premium $1,095. Speed fee: Standard +$0, Rush +$199, Express +$399 (packet preparation time, NOT USCIS processing time)." },
      ],
      govFees: [
        tbc("USCIS fee — I-129F", "$675 USCIS — TO BE CONFIRMED. Confirm at uscis.gov/fees before paying."),
        tbc("K-1 Visa Fee at Embassy", "$265 K-1 visa fee, paid at the embassy — TO BE CONFIRMED. Separate from the USCIS fee and from the prep fee."),
      ],
      premiumProcessingEligible: false,
      notes: [
        "The petitioner and fiancé(e) must have met in person within 2 years before filing. The intake engine checks the last meeting date against the filing date.",
        "After USCIS approval the case transfers to NVC, then to the embassy for the interview — tracked with the same NVC engine as I-130 consular (NVC case number + Invoice ID, embassy interview + medical exam). No second NVC tracker is built.",
        "Premium Processing (Form I-907) is not offered for I-129F.",
      ],
    };
  }

  // asylum
  return {
    goal,
    goalLabel,
    forms: ["I-589"],
    packageTitle: "I-589 Asylum — Clerical Prep Only",
    templateId: "i589",
    template: getTemplate("i589"),
    prepItems: [
      { key: "I-589", label: "I-589 — Application for Asylum and for Withholding of Removal", tierPrices: SINGLE_FORM_TIER_PRICES["I-589"], note: "Locked I-589 prep fee — Basic $900 / Standard $1,050 / Premium $1,200." },
    ],
    govFees: [
      { label: "USCIS fee — I-589", amountCents: 10000, locked: true, note: "$100 — locked." },
      { label: "USCIS fee — I-589 annual fee", amountCents: 10500, locked: true, recurring: true, note: "$105/year, in addition to the $100 filing fee — locked. Shown as its own line so it is never hidden inside a total." },
    ],
    premiumProcessingEligible: false,
    notes: [
      "Reconciliation: a pasted draft listed the I-589 annual fee as $102/year. That CONFLICTS with the locked $105/year in this repo — $105/year is used here and $102 is unverified, so it is not shown as a fee.",
      "Clerical preparation only — this is not legal advice and not a guarantee of any outcome. The one-year filing deadline check is part of the checklist.",
      "Premium Processing (Form I-907) is not offered for I-589.",
    ],
  };
}

/** Sum of LOCKED, one-off gov fees only. TBC, recurring ($105/yr) and
 *  conditional lines are excluded — they are listed, never totalled. */
export function lockedGovSubtotalCents(govFees: GovFeeLine[]): number {
  return govFees.reduce(
    (sum, line) =>
      line.locked && !line.recurring && line.amountCents !== null ? sum + line.amountCents : sum,
    0
  );
}

/** Locked gov subtotal from the checklist template (server cross-check). */
export function lockedGovSubtotalForTemplate(templateId: string | null): number {
  if (!templateId) return 0;
  const template = getTemplate(templateId);
  return template ? lockedGovFeeCents(template) : 0;
}

export interface TierSelection {
  key: string;
  tier: TierId;
}

export interface PrepTotal {
  /** Prep fee + speed fee, integer cents, or null when a required tier
   *  is unpicked or a required prep item has no locked price. */
  prepFeeCents: number | null;
  tierTotalCents: number | null;
  speedFeeCents: number;
  missing: string[];
}

/** Prep total from the client's tier picks + speed. Nothing is assumed:
 *  an unpicked tier (or a TBC-priced item) makes the total null. */
export function computePrepTotal(
  determination: IntakeDetermination,
  selections: TierSelection[],
  speed: SpeedId
): PrepTotal {
  const missing: string[] = [];
  let tierTotal = 0;
  for (const item of determination.prepItems) {
    const pick = selections.find((s) => s.key === item.key);
    if (!pick) {
      missing.push(`Choose a tier for ${item.label}.`);
      continue;
    }
    if (!item.tierPrices) {
      missing.push(`${item.label} has no locked price yet — TO BE CONFIRMED. The order cannot be priced until it is confirmed.`);
      continue;
    }
    tierTotal += item.tierPrices[pick.tier] * 100;
  }
  const speedFeeCents = speedOption(speed).feeCents;
  if (missing.length > 0) {
    return { prepFeeCents: null, tierTotalCents: null, speedFeeCents, missing };
  }
  return { prepFeeCents: tierTotal + speedFeeCents, tierTotalCents: tierTotal, speedFeeCents, missing };
}

export const LOCKED_PAYMENT_PLANS: { id: PaymentPlanType; label: string }[] = [
  { id: "full_upfront", label: "Pay in Full" },
  { id: "installments_3", label: "Pay in 3" },
  { id: "monthly_6", label: "Monthly — 6 months" },
  { id: "monthly_12", label: "Monthly — 12 months" },
];

export function isLockedPaymentPlan(value: unknown): value is PaymentPlanType {
  return (
    typeof value === "string" &&
    (LOCKED_PAYMENT_PLANS as { id: string }[]).some((p) => p.id === value)
  );
}

/** payment_plans.pay_choice spelling for a service_orders plan
 *  (0002/0003: 'all_at_once' is the pre-case spelling of 'full_upfront'). */
export function payChoiceForPlan(plan: PaymentPlanType): string {
  return plan === "full_upfront" ? "all_at_once" : plan;
}

/** Installment slices for a plan, from the locked splitter in lib/stripe
 *  (remainder on the FIRST installments — Pay in 3 on $1,799 =
 *  $599.67 / $599.67 / $599.66, the locked v33 split). */
export function installmentsForPlan(totalServiceFeeCents: number, plan: PaymentPlanType) {
  return splitInvoices(totalServiceFeeCents, plan);
}

// ---------------------------------------------------------------------------
// Server-side order validation (shared by the API route). The browser
// sends picks, never totals: the server re-derives everything here.
// ---------------------------------------------------------------------------

export interface IntakeOrderInput {
  providerSlug: string;
  goal: IntakeGoal;
  beneficiaryLocation: BeneficiaryLocation | null;
  filingMethod: FilingMethod;
  speed: SpeedId;
  tierSelections: TierSelection[];
  paymentPlan: PaymentPlanType;
  premiumProcessing: boolean;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  preferredLanguage: string;
}

export interface ValidatedIntakeOrder {
  determination: IntakeDetermination;
  prep: PrepTotal;
  lockedGovFeeCents: number;
  installments: { label: string; amountCents: number; dueDate: string }[];
}

export function validateIntakeOrder(input: IntakeOrderInput): ValidatedIntakeOrder {
  const errors: string[] = [];
  if (!input.providerSlug || typeof input.providerSlug !== "string") {
    errors.push("providerSlug is required — the professional's storefront slug (immigration.niptei.com/p/<slug>).");
  }
  if (!INTAKE_GOALS.some((g) => g.id === input.goal)) errors.push(`Unknown immigration goal: ${String(input.goal)}.`);
  if (input.goal === "family" && input.beneficiaryLocation !== "inside_us" && input.beneficiaryLocation !== "outside_us") {
    errors.push("For a family green card, say where the beneficiary is: inside the US (adjustment) or outside the US (consular / NVC).");
  }
  if (input.filingMethod !== "online" && input.filingMethod !== "paper") {
    errors.push("Filing method is required: online or paper.");
  }
  if (!SPEED_OPTIONS.some((s) => s.id === input.speed)) errors.push(`Unknown preparation speed: ${String(input.speed)}.`);
  if (!isLockedPaymentPlan(input.paymentPlan)) {
    errors.push("Payment plan is required and must be one of the locked plans: Pay in Full / Pay in 3 / Monthly 6 / Monthly 12. There is no split_50_50 plan for immigration.");
  }
  if (!input.clientName || !input.clientName.trim()) errors.push("Client full name is required.");
  if (!input.clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.clientEmail)) {
    errors.push("A valid client email is required.");
  }
  for (const s of input.tierSelections ?? []) {
    if (s.tier !== "basic" && s.tier !== "standard" && s.tier !== "premium") {
      errors.push(`Unknown tier "${String(s.tier)}" for ${s.key} — tier must be Basic, Standard or Premium.`);
    }
  }
  if (errors.length > 0) throw new Error(errors.join(" "));

  const determination = determineIntake(input.goal, input.beneficiaryLocation, input.filingMethod);
  if (input.premiumProcessing && !determination.premiumProcessingEligible) {
    throw new Error("Premium Processing (Form I-907) is offered only for OPT / STEM EAD (standalone I-765) and for eligible F/J/M categories on Form I-539 — never for I-130 / I-485 or this goal.");
  }
  const prep = computePrepTotal(determination, input.tierSelections, input.speed);
  if (prep.prepFeeCents === null) {
    throw new Error(`The order cannot be priced yet: ${prep.missing.join(" ")}`);
  }
  const lockedGovFeeCents = lockedGovSubtotalCents(determination.govFees);
  return {
    determination,
    prep,
    lockedGovFeeCents,
    installments: installmentsForPlan(prep.prepFeeCents, input.paymentPlan),
  };
}

export function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
