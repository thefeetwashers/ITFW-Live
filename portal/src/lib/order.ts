// Order, Invoice & Process Roadmap (Founder's Order section)
// LOCKED pricing: Bundle Basic $999 / Standard $1,799 / Premium $2,799.
// LOCKED payment options: Pay in Full, Pay in 3, Monthly 6 / 12 via Stripe.
// There is NO locked 50/50 split plan for immigration bundles — 50/50 is
// the Florida Property Compliance OS default (a different business).
// The wireframe's Invoice #INV-2049, $1,200 total, $600 paid / $600 due
// is EXAMPLE data only, labelled as such in the UI.
// Service fee and USCIS government fees are ALWAYS separate — never
// combined into one total. I-485 Paper USCIS fee $1,440 is locked;
// other USCIS fees in bundles.ts are marked TO BE CONFIRMED where the
// locked list does not state them.
export type PaymentPlanType =
  | "full_upfront"
  | "installments_3"
  | "monthly_6"
  | "monthly_12";

export type UnlockStage =
  | "intake_and_docs"
  | "drafting"
  | "esign_and_download";

export interface OrderInvoice {
  invoiceNumber: string; // e.g. "INV-2049-1"
  milestoneStep: number;
  milestoneLabel: string;
  amountCents: number;
  status: "paid" | "unpaid" | "overdue" | "void";
  unlocksStage: UnlockStage;
  paidAt: string | null;
}

export interface ServiceOrder {
  packageTitle: string;
  orderedForms: string[];
  paymentPlanType: PaymentPlanType;
  totalServiceFeeCents: number;
  estimatedUscisGovFeeCents: number; // separate, never added to the service total
  invoices: OrderInvoice[];
}

export const MISSED_PAYMENT_RULE =
  "If you miss a payment, 50% is added to the total amount.";

export function missedPaymentTotal(totalCents: number): number {
  return Math.round(totalCents * 1.5);
}

// Dynamic roadmap: which stages are unlocked depends on the ACTUAL
// payment plan on the order — not on a fixed split.
export function roadmapStages(order: ServiceOrder): {
  step: number;
  label: string;
  unlocked: boolean;
  detail: string;
}[] {
  const paid = order.invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amountCents, 0);
  const balanceDue = order.totalServiceFeeCents - paid;
  const allPaid = balanceDue <= 0;
  const depositPaid = paid > 0;
  const planLabel =
    order.paymentPlanType === "full_upfront"
      ? "Paid in Full"
      : order.paymentPlanType === "installments_3"
        ? "Pay in 3"
        : order.paymentPlanType === "monthly_6"
          ? "Monthly — 6 months"
          : "Monthly — 12 months";
  return [
    {
      step: 1,
      label: "Deposit Paid",
      unlocked: depositPaid,
      detail: `${planLabel} — unlocks Intake Forms & Document Vault.`,
    },
    {
      step: 2,
      label: "Forms & Docs (Now)",
      unlocked: depositPaid,
      detail: "Complete checklists & upload IDs.",
    },
    {
      step: 3,
      label: "Draft & Audit",
      unlocked: depositPaid,
      detail: "Provider prepares drafts; packet audit must reach 100%.",
    },
    {
      step: 4,
      label: "Final Balance",
      unlocked: allPaid,
      detail: allPaid
        ? "Balance paid — E-Sign unlocked."
        : `Pay remaining ${formatCents(balanceDue)} to unlock E-Sign. ${MISSED_PAYMENT_RULE}`,
    },
    {
      step: 5,
      label: "E-Sign & Mail / File",
      unlocked: allPaid,
      detail: "Sign packet & receive USCIS tracking #.",
    },
  ];
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// EXAMPLE order only — uses the LOCKED Standard bundle price $1,799
// (Pay in 3: $599.67 / $599.67 / $599.66, matching the live site v33).
// The wireframe's $1,200 / $600-paid / $600-due was example only and
// is NOT used as a price anywhere in this build.
export const EXAMPLE_ORDER: ServiceOrder = {
  packageTitle: "Family Adjustment Bundle (Form I-130 & Form I-485)",
  orderedForms: ["I-130", "I-485"],
  paymentPlanType: "installments_3",
  totalServiceFeeCents: 179900, // Standard bundle $1,799 — locked price
  estimatedUscisGovFeeCents: 144000, // I-485 Paper $1,440 locked; shown separately, never added to the service total
  invoices: [
    { invoiceNumber: "INV-2049-1", milestoneStep: 1, milestoneLabel: "Installment 1 of 3", amountCents: 59967, status: "paid", unlocksStage: "intake_and_docs", paidAt: "2026-11-10" },
    { invoiceNumber: "INV-2049-2", milestoneStep: 2, milestoneLabel: "Installment 2 of 3", amountCents: 59967, status: "paid", unlocksStage: "drafting", paidAt: "2026-11-17" },
    { invoiceNumber: "INV-2049-3", milestoneStep: 3, milestoneLabel: "Installment 3 of 3 — final balance", amountCents: 59966, status: "unpaid", unlocksStage: "esign_and_download", paidAt: null },
  ],
};
