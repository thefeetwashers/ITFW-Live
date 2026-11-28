// Second-person review upsell at the DIY print step — OPTIONAL.
//
// WHY THIS FILE EXISTS: a DIY client about to print may want a second
// pair of eyes on the packet before they file it themselves. The
// review options are offered at the print step as an ADD-ON — clearly
// optional, never required to print. Print works without any review
// purchase (canPrintWithoutReview() is always true, and the smoke test
// asserts it).
//
// PRICES (locked Stripe Prices in src/lib/stripePrices.ts — never
// changed here):
//   * Review $99/form (review_form, price_1UfS6TPfd9SRUcvhBTRVKrvQ)
//   * Review + Human Review $199 (review_human, price_1UfS7bPfd9SRUcvhY0CRdMUf)
//   * Review Bundle $399 (review_bundle, price_1UfS71Pfd9SRUcvhCNJTdWVJ)
// A review purchase NEVER unlocks printing — printing is unlocked by
// the DIY payment only (src/lib/diy.ts decideDiyUnlock). Buying a review and
// then not paying DIY still leaves print locked, and paying DIY
// without any review still unlocks print.

import { getLockedPriceByKey } from "./stripePrices";

export type DiyReviewOptionKey = "review_form" | "review_human" | "review_bundle";

export interface DiyReviewOption {
  key: DiyReviewOptionKey;
  priceId: string;
  label: string;
  amountCents: number;
  /** What the review covers, in plain English. */
  covers: string;
  /** Always true: this option is optional, never required to print. */
  optional: true;
}

const REVIEW_COVERS: Record<DiyReviewOptionKey, string> = {
  review_form:
    "A second-person review of one DIY form before you print it — someone else checks the packet against the checklist.",
  review_human:
    "Review of one DIY form plus a human review — a person (not only a checklist) reviews the packet before you print it.",
  review_bundle:
    "Review bundle — second-person review across the forms in your DIY bundle before you print.",
};

export function diyReviewOptions(): DiyReviewOption[] {
  const keys: DiyReviewOptionKey[] = ["review_form", "review_human", "review_bundle"];
  return keys
    .map((key) => {
      const price = getLockedPriceByKey(key);
      if (!price) return null;
      return {
        key,
        priceId: price.priceId,
        label: price.label,
        amountCents: price.amountCents,
        covers: REVIEW_COVERS[key],
        optional: true as const,
      };
    })
    .filter((o): o is DiyReviewOption => o !== null);
}

export function diyReviewOption(key: DiyReviewOptionKey): DiyReviewOption | null {
  return diyReviewOptions().find((o) => o.key === key) ?? null;
}

/** Print never requires a review purchase. Always true by design —
 *  the print gate (src/lib/diy.ts decideDiyUnlock) does not look at review purchases
 *  at all. */
export function canPrintWithoutReview(): { allowed: true; reason: string } {
  return {
    allowed: true,
    reason:
      "Review is an optional add-on. Printing is unlocked by the DIY payment only — " +
      "you can print without buying any review.",
  };
}

/** Sum of the selected OPTIONAL review add-ons, integer cents.
 *  A review total is never added to the DIY fee or to USCIS fees. */
export function reviewAddOnTotalCents(selectedKeys: DiyReviewOptionKey[]): number {
  const options = diyReviewOptions();
  return selectedKeys.reduce((sum, key) => {
    const option = options.find((o) => o.key === key);
    return sum + (option?.amountCents ?? 0);
  }, 0);
}

export const DIY_REVIEW_UPSELL_NOTE =
  "Optional add-on — you do not need a review to print. " +
  "Review $99/form · Review + Human Review $199 · Review Bundle $399 (locked prices). " +
  "A review does not unlock printing, and printing does not require a review.";
