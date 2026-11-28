// Total Cost Estimator — shown BEFORE the client starts, so there
// are no surprises at checkout.
//
// WHAT IT SHOWS, ALWAYS SEPARATELY:
//   * Our preparation fee (locked prices in src/lib/stripePrices.ts,
//     via src/lib/bundles.ts BUNDLE_TEMPLATES / FAMILY_ADJUSTMENT_BUNDLE
//     and src/lib/diyFees.ts diyFeeBreakdown).
//   * The USCIS government fee (locked lines from the same sources).
// The two are paid to DIFFERENT parties and are NEVER added into one
// combined total: there is deliberately NO combined-total field on
// any result in this module (same rule as diyFees.ts). A form whose
// government fee is not in the locked lists is shown as
// TO BE CONFIRMED with "Confirm at uscis.gov/fees before paying" —
// never a guessed fee.
//
// Sources (locked, reused — nothing invented here):
//   * Per-form prep tiers + USCIS lines: BUNDLE_TEMPLATES.
//   * Family Adjustment Bundle: $999 / $1,799 / $2,799 (locked).
//   * DIY: $25/form or $99 bundle (diyFees.ts).
//   * I-912 pointer: if the USCIS fee is unaffordable, Form I-912
//     exists — this platform does not decide who qualifies.
//
// Pure module (no Supabase, no Stripe calls, no secrets).
import {
  BUNDLE_TEMPLATES,
  FAMILY_ADJUSTMENT_BUNDLE,
  type BundleTemplate,
} from "./bundles";
import {
  diyFeeBreakdown,
  GOV_FEE_DISCLAIMER,
  DIY_FEE_WAIVER_NOTE,
  type DiyFeeBreakdown,
} from "./diyFees";

export { GOV_FEE_DISCLAIMER, DIY_FEE_WAIVER_NOTE };

export type CostTier = "basic" | "standard" | "premium";

export const COST_TIER_LABEL: Record<CostTier, string> = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
};

export interface CostFeeLine {
  label: string;
  /** Display amount, e.g. "$750" or "TO BE CONFIRMED". */
  amount: string;
  locked: boolean;
  note?: string;
}

export interface TotalCostEstimate {
  kind: "form" | "bundle" | "diy";
  formCode: string;
  name: string;
  tier: CostTier;
  /** Our preparation fee only — one line. */
  ourFee: CostFeeLine;
  /** Government fees — USCIS (and DOS, where listed) — each its own
   *  line, never folded into our fee. */
  governmentFees: CostFeeLine[];
  /** True when any government line is TO BE CONFIRMED. */
  hasUnconfirmedGovernmentFee: boolean;
  feeWaiverNote: string;
  disclaimer: string;
  /** Deliberately absent: no combined total. Our fee and government
   *  fees are paid to different parties and are never added together
   *  into one charge. */
}

function dollars(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

function tierAmount(
  fee: BundleTemplate["serviceFee"],
  tier: CostTier
): number | null {
  if (!fee) return null;
  if ("flat" in fee) return fee.flat;
  return fee[tier];
}

function bundleFeeLines(template: BundleTemplate): CostFeeLine[] {
  return (template.feeBreakdown ?? []).map((line) => ({
    label: line.label,
    amount: line.amount,
    locked: line.locked,
    note: line.note,
  }));
}

/** Estimate for one form at a tier, from the locked bundle template. */
export function estimateForForm(
  formCode: string,
  tier: CostTier = "basic"
): TotalCostEstimate | null {
  const template = BUNDLE_TEMPLATES.find((t) => t.formCode === formCode);
  if (!template) return null;
  const prep = tierAmount(template.serviceFee, tier);
  const lines = bundleFeeLines(template);
  const ourFee: CostFeeLine = {
    label: `Our fee — ${template.name} (${COST_TIER_LABEL[tier]} preparation only)`,
    amount: prep !== null ? dollars(prep) : "TO BE CONFIRMED",
    locked: prep !== null,
    note:
      prep === null
        ? "No locked preparation fee for this form yet — never a guessed price."
        : "Our preparation fee only. USCIS government fees are separate and are NOT included.",
  };
  const governmentFees = lines.filter(
    (l) => l.label.startsWith("USCIS fee") || l.label.startsWith("DOS fee")
  );
  return {
    kind: "form",
    formCode: template.formCode,
    name: template.name,
    tier,
    ourFee,
    governmentFees,
    hasUnconfirmedGovernmentFee: governmentFees.some((l) => !l.locked),
    feeWaiverNote: DIY_FEE_WAIVER_NOTE,
    disclaimer: GOV_FEE_DISCLAIMER,
  };
}

/**
 * Estimate for the Family Adjustment Bundle (7 forms: I-130, I-485,
 * I-130A, I-864, I-765, I-131, I-693) at a tier. Our fee is the locked
 * bundle price; government fees are the locked per-form USCIS lines
 * from the bundle templates (I-485 $1,440 paper is locked; the rest
 * are TO BE CONFIRMED where the templates say so).
 */
export function estimateForFamilyAdjustmentBundle(
  tier: CostTier = "basic"
): TotalCostEstimate {
  const ourAmount = FAMILY_ADJUSTMENT_BUNDLE.price[tier];
  const governmentFees: CostFeeLine[] = FAMILY_ADJUSTMENT_BUNDLE.forms
    .map((code) => BUNDLE_TEMPLATES.find((t) => t.formCode === code))
    .filter((t): t is BundleTemplate => Boolean(t))
    .flatMap((t) => bundleFeeLines(t))
    .filter(
      (l) => l.label.startsWith("USCIS fee") || l.label.startsWith("DOS fee")
    );
  return {
    kind: "bundle",
    formCode: "FAMILY-ADJUSTMENT",
    name: `${FAMILY_ADJUSTMENT_BUNDLE.name} — ${FAMILY_ADJUSTMENT_BUNDLE.forms.join(", ")}`,
    tier,
    ourFee: {
      label: `Our fee — Family Adjustment Bundle (${COST_TIER_LABEL[tier]} preparation only)`,
      amount: dollars(ourAmount),
      locked: true,
      note: "Our preparation fee only, for all 7 forms in the bundle. USCIS government fees are separate and are NOT included.",
    },
    governmentFees,
    hasUnconfirmedGovernmentFee: governmentFees.some((l) => !l.locked),
    feeWaiverNote: DIY_FEE_WAIVER_NOTE,
    disclaimer: GOV_FEE_DISCLAIMER,
  };
}

/** DIY estimate for one form — reuses diyFeeBreakdown (no combined total there either). */
export function estimateForDiy(
  formCode: string,
  opts: { bundle?: boolean } = {}
): TotalCostEstimate {
  const breakdown: DiyFeeBreakdown = diyFeeBreakdown(formCode, opts);
  return {
    kind: "diy",
    formCode: breakdown.formCode,
    name: breakdown.templateName ?? `DIY — Form ${formCode}`,
    tier: "basic",
    ourFee: {
      label: breakdown.ourFee.label,
      amount:
        breakdown.ourFee.amountCents !== null
          ? dollars(breakdown.ourFee.amountCents / 100)
          : "TO BE CONFIRMED",
      locked: breakdown.ourFee.locked,
      note: breakdown.ourFee.note,
    },
    governmentFees: breakdown.governmentFees.map((line) => ({
      label: line.label,
      amount:
        line.amountCents !== null
          ? dollars(line.amountCents / 100)
          : "TO BE CONFIRMED",
      locked: line.locked,
      note: line.note,
    })),
    hasUnconfirmedGovernmentFee: breakdown.hasUnconfirmedGovernmentFee,
    feeWaiverNote: breakdown.feeWaiverNote,
    disclaimer: breakdown.disclaimer,
  };
}

/** Every form/bundle code the estimator can price (locked templates only). */
export function estimableFormCodes(): string[] {
  return BUNDLE_TEMPLATES.map((t) => t.formCode);
}
