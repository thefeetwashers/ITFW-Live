// Transparent Fee Breakdown & Refund Rules (Layer 1)
// Every invoice shows THREE separate lines, never combined:
//   (1) Platform / Provider Preparation Fee
//   (2) Add-On Services (e.g. Certified Translation, Express Review)
//   (3) USCIS Government Filing Fee — "Paid directly to U.S. Department
//       of Homeland Security — Not included in prep fee"
//       + link https://www.uscis.gov/fees
// LOCKED: translation $45/page (Additional Services list).
// NOT locked: Express Review $50 in the brief is an EXAMPLE / to-be-
// confirmed add-on — never present it as a locked price.
// Refund percentages are a PROPOSAL, configurable per order, labelled
// "Draft refund policy — for a licensed attorney to review before live
// use". Do NOT claim refunds are guaranteed.
export const USCIS_FEE_SCHEDULE_URL = "https://www.uscis.gov/fees";

export interface FeeLine {
  kind: "preparation" | "addon" | "uscis_government";
  label: string;
  amountCents: number;
  note?: string;
  locked: boolean;
}

export const TRANSLATION_PRICE_PER_PAGE_CENTS = 4500; // $45/page, locked

export function exampleInvoiceLines(): FeeLine[] {
  return [
    { kind: "preparation", label: "Platform / Provider Preparation Fee", amountCents: 60000, note: "EXAMPLE $600.00 — not a locked price; use the order's actual service fee.", locked: false },
    { kind: "addon", label: "Certified Translation", amountCents: 4500, note: "$45/page — locked price, per page.", locked: true },
    { kind: "addon", label: "Express Review", amountCents: 5000, note: "EXAMPLE $50.00 — NOT a locked price; to-be-confirmed add-on.", locked: false },
    { kind: "uscis_government", label: "USCIS Government Filing Fee", amountCents: 144000, note: "Paid directly to U.S. Department of Homeland Security — Not included in prep fee. I-485 Paper $1,440 (locked).", locked: true },
  ];
}

export interface RefundTier {
  stage: "before_intake" | "document_collection" | "forms_drafted";
  label: string;
  refundPercent: number; // configurable per order — proposal only
}

export const DRAFT_REFUND_TIERS: RefundTier[] = [
  { stage: "before_intake", label: "Before intake starts", refundPercent: 100 },
  { stage: "document_collection", label: "During document collection", refundPercent: 50 },
  { stage: "forms_drafted", label: "Once forms are drafted", refundPercent: 0 },
];

export function refundStatus(
  stage: RefundTier["stage"],
  tiers: RefundTier[] = DRAFT_REFUND_TIERS
): { label: string; refundPercent: number; policyNote: string } {
  const tier = tiers.find((t) => t.stage === stage) ?? tiers[0];
  return {
    label: tier.label,
    refundPercent: tier.refundPercent,
    policyNote:
      "Draft refund policy — for a licensed attorney to review before live use. Refunds are not guaranteed.",
  };
}
