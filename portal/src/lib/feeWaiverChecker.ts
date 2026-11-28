// Fee Waiver Checker (Form I-912) — a GUIDED CHECK, never a decision.
//
// WHAT THIS IS: the client answers the same three questions USCIS
// asks on Form I-912 (see the checklist in
// src/lib/feeWaiverChecklist.ts) and, for the income question, their
// household income is compared with 150% of the Federal Poverty
// Guidelines. The result is ALWAYS one of:
//   "may_qualify"        — "You may qualify — an attorney/DOJ rep
//                          should confirm." NEVER "you qualify".
//   "no_ground_indicated"— no I-912 ground was indicated by the answers.
//   "cannot_tell"        — not enough was answered to say anything.
// Only USCIS decides a fee waiver. This module never decides
// eligibility, never promises a waiver, and never says "you qualify".
//
// THE 150% FIGURES — verified, not invented:
//   The locked 2026 sponsor qualifier in src/lib/formChecklists.ts
//   (SPONSOR_125_2026, source: 2026 USCIS Form I-864P, effective
//   March 1, 2026) prints the 100% column for household sizes 2–8 +
//   per-extra-person, by region. 150% is that 100% figure × 1.5.
//   Check: household 4, contiguous US — 100% is $33,000, so 150% is
//   $49,500, which matches the founder's figure. Every other figure
//   below is the same ×1.5 arithmetic on the same locked column —
//   e.g. HH2 contiguous $21,640 × 1.5 = $32,460; HH3 $27,320 × 1.5 =
//   $40,980. The table is computed from the locked column at module
//   load (feeWaiver150Threshold), never hand-typed, so it cannot
//   drift from the qualifier. The figures change yearly: the result
//   always says to confirm the current figures on uscis.gov before
//   filing, and the I-912 prep price is the locked Basic $39
//   (i-912_basic in src/lib/stripePrices.ts).
//
// PRIVACY: no income figure is ever stored by this module. The API
// route that saves a check result (/api/waiver-checks) stores only
// household size, region, which grounds were indicated, the result,
// and the threshold — never the income amount, never a DOB,
// A-Number, SSN, or passport number.
//
// Pure module (no Supabase, no Stripe, no secrets).
import { SPONSOR_125_2026, type SponsorRegion } from "./formChecklists";

export type { SponsorRegion };

export const FEE_WAIVER_MAY_QUALIFY =
  "You may qualify — an attorney/DOJ rep should confirm.";

export const FEE_WAIVER_ONLY_USCIS_DECIDES =
  "Only USCIS decides whether you get a fee waiver. This check cannot tell you that you qualify, and filing Form I-912 does not guarantee a waiver. If USCIS denies the waiver, it will tell you what to do next — read that letter the day it arrives.";

export const FEE_WAIVER_VERIFY_FIGURES_NOTE =
  "150% figures below are derived from the locked 2026 Form I-864P 100% column in this codebase (× 1.5). Poverty guidelines change every year — confirm the current figures on uscis.gov before you file Form I-912.";

export const FEE_WAIVER_SOURCE = {
  label: "uscis.gov — Form I-912 (Request for Fee Waiver)",
  url: "https://www.uscis.gov/forms",
} as const;

/**
 * 150% of the Federal Poverty Guidelines for a household size +
 * region, derived from the locked 2026 I-864P 100% column × 1.5.
 * Household sizes below 2 are treated as 2 (the table starts at 2);
 * above 8 adds the per-extra-person 150% amount. Dollars, integer.
 */
export function feeWaiver150Threshold(
  householdSize: number,
  region: SponsorRegion
): number {
  const table = SPONSOR_125_2026[region];
  const size = Math.max(2, Math.floor(householdSize));
  const base100 =
    size <= 8
      ? table.household[size][1]
      : table.household[8][1] + (size - 8) * table.extra[1];
  return Math.round(base100 * 1.5);
}

export type FeeWaiverGround = "means_tested_benefit" | "income_150" | "financial_hardship";

export const FEE_WAIVER_GROUND_LABEL: Record<FeeWaiverGround, string> = {
  means_tested_benefit:
    "Receiving a means-tested benefit (for example Medicaid, SNAP, SSI, TANF)",
  income_150:
    "Household income at or below 150% of the Federal Poverty Guidelines",
  financial_hardship:
    "Financial hardship that makes paying the USCIS fee difficult",
};

export const FEE_WAIVER_GROUND_PROOF: Record<FeeWaiverGround, string> = {
  means_tested_benefit:
    "Bring the benefit letter that shows you receive the benefit now — USCIS checks the current benefit, not an old one.",
  income_150:
    "Bring tax returns, pay stubs, or other proof of what the household earns, for everyone in the household. Confirm the current 150% figures on uscis.gov before you file.",
  financial_hardship:
    "Describe the hardship plainly and bring proof of it (bills, letters, records) — a statement with no proof is weaker than a statement with proof.",
};

export type FeeWaiverCheckOutcome =
  | "may_qualify"
  | "no_ground_indicated"
  | "cannot_tell";

export interface FeeWaiverCheckInput {
  householdSize: number;
  region: SponsorRegion;
  /** Annual household income in dollars, all household members.
   *  Null = the client did not enter it — the income ground is then
   *  unanswered, never guessed. Never stored (see header). */
  annualHouseholdIncome: number | null;
  hasMeansTestedBenefit: boolean | null;
  hasFinancialHardship: boolean | null;
}

export interface FeeWaiverCheckResult {
  outcome: FeeWaiverCheckOutcome;
  /** The exact words the UI shows for a may-qualify result. */
  headline: string;
  groundsIndicated: FeeWaiverGround[];
  threshold150: number;
  /** What proof to gather, one line per indicated ground. */
  proofToGather: string[];
  disclaimer: string;
  verifyFiguresNote: string;
}

/**
 * Guided I-912 check. NEVER returns "you qualify": the strongest
 * outcome is "may_qualify" with the headline
 * "You may qualify — an attorney/DOJ rep should confirm."
 */
export function checkFeeWaiver(input: FeeWaiverCheckInput): FeeWaiverCheckResult {
  const threshold150 = feeWaiver150Threshold(input.householdSize, input.region);
  const grounds: FeeWaiverGround[] = [];
  if (input.hasMeansTestedBenefit === true) grounds.push("means_tested_benefit");
  if (
    input.annualHouseholdIncome !== null &&
    Number.isFinite(input.annualHouseholdIncome) &&
    input.annualHouseholdIncome >= 0 &&
    input.annualHouseholdIncome <= threshold150
  ) {
    grounds.push("income_150");
  }
  if (input.hasFinancialHardship === true) grounds.push("financial_hardship");

  const answeredAnything =
    input.hasMeansTestedBenefit !== null ||
    input.hasFinancialHardship !== null ||
    input.annualHouseholdIncome !== null;

  const outcome: FeeWaiverCheckOutcome =
    grounds.length > 0
      ? "may_qualify"
      : answeredAnything
        ? "no_ground_indicated"
        : "cannot_tell";

  return {
    outcome,
    headline:
      outcome === "may_qualify"
        ? FEE_WAIVER_MAY_QUALIFY
        : outcome === "no_ground_indicated"
          ? "No fee-waiver ground was indicated by these answers — an attorney or DOJ-accredited representative can still check with you."
          : "Not enough was answered to say anything — answer at least one question, or ask an attorney or DOJ-accredited representative.",
    groundsIndicated: grounds,
    threshold150,
    proofToGather: grounds.map((g) => `${FEE_WAIVER_GROUND_LABEL[g]} — ${FEE_WAIVER_GROUND_PROOF[g]}`),
    disclaimer: FEE_WAIVER_ONLY_USCIS_DECIDES,
    verifyFiguresNote: FEE_WAIVER_VERIFY_FIGURES_NOTE,
  };
}
