// PaywallLocked — honest "pay first" state for a gated surface.
//
// Shows the locked price (from the locked Stripe Price map — never
// invented) and a real CheckoutButton to the locked Price ID. Rendered
// ONLY after a server-side access check denied the visitor
// (/api/access or /api/interview-prep returned 403). It never decides
// access itself.
"use client";

import CheckoutButton from "@/components/CheckoutButton";
import { unlockPrice } from "@/lib/paywall";

export default function PaywallLocked({
  surfaceLabel,
  unlockPriceKey,
  reason,
  accountId,
  email,
  caseId,
}: {
  surfaceLabel: string;
  unlockPriceKey: string | null;
  reason?: string;
  accountId?: string;
  email?: string;
  caseId?: string;
}) {
  const price = unlockPrice(unlockPriceKey);
  return (
    <section
      aria-labelledby="paywall-heading"
      className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 shadow-sm"
    >
      <h2 id="paywall-heading" className="text-base font-semibold text-amber-900">
        🔒 {surfaceLabel} — pay first to unlock
      </h2>
      <p className="mt-2 text-sm text-amber-900">
        {reason ??
          "This content is paid content. Pay first — nothing is shown until your payment is confirmed in our records."}
      </p>
      {price ? (
        <div className="mt-3 rounded border border-amber-300 bg-white p-3">
          <p className="text-sm font-semibold text-slate-900">
            {price.label} — ${(price.amountCents / 100).toFixed(2)}
            {unlockPriceKey?.includes("monthly") || price.label.includes("/mo")
              ? " / month"
              : ""}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            USCIS government fees are separate and are never part of this
            payment. Your subscription or purchase is recorded in our
            database, and access unlocks once Stripe confirms the payment.
          </p>
          <div className="mt-3">
            <CheckoutButton
              priceId={price.priceId}
              plan="full"
              email={email}
              accountId={accountId}
              caseId={caseId}
              label={`Pay $${(price.amountCents / 100).toFixed(2)} — unlock ${surfaceLabel}`}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            If you already paid, sign in with the same account you paid
            with — access is checked against the payment records for that
            account. If your payment is not showing, email
            nipteiapp@gmail.com or call (772) 971-6129.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-amber-900">
          No payment is needed for your role. If you see this message in
          error, sign in again or contact nipteiapp@gmail.com.
        </p>
      )}
    </section>
  );
}
