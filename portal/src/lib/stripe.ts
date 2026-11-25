// Stripe — SKELETON ONLY. No keys, no live charges.
// Env vars (set in Vercel / .env.local, never in code):
//   STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET
// Professionals also connect their OWN Stripe (BYO) — the platform
// never holds money or splits legal fees.
export const STRIPE_ENV_VARS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
] as const;

// Split-invoice plan for Pay in 3 / Monthly (amounts in integer cents).
// Pay in Full = one invoice for the whole service fee.
// Pay in 3 = 3 equal-ish installments (remainder on the last one).
// Monthly 6 / 12 = equal monthly installments, auto-draft dates monthly.
export function splitInvoices(
  totalServiceFeeCents: number,
  plan: "full_upfront" | "installments_3" | "monthly_6" | "monthly_12",
  firstDraftDate: Date = new Date()
): { label: string; amountCents: number; dueDate: string }[] {
  const count =
    plan === "full_upfront" ? 1 : plan === "installments_3" ? 3 : plan === "monthly_6" ? 6 : 12;
  // Distribute the remainder 1 cent at a time over the FIRST
  // installments, so Pay in 3 on $1,799 = $599.67 / $599.67 / $599.66
  // (the locked v33 split), not $599.66 / $599.66 / $599.68.
  const base = Math.floor(totalServiceFeeCents / count);
  const remainder = totalServiceFeeCents - base * count;
  return Array.from({ length: count }, (_, i) => {
    const due = new Date(firstDraftDate);
    due.setMonth(due.getMonth() + i);
    return {
      label:
        count === 1
          ? "Paid in Full"
          : plan === "installments_3"
            ? `Installment ${i + 1} of 3`
            : `Monthly payment ${i + 1} of ${count}`,
      amountCents: base + (i < remainder ? 1 : 0),
      dueDate: due.toISOString().slice(0, 10),
    };
  });
}
