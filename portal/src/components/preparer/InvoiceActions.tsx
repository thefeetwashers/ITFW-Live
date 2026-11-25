// Invoice + receipt actions — preparer dashboard.
// Stripe is NOT connected: "Send a Stripe Invoice" is a SKELETON ONLY —
// it queues a request and never claims an invoice was sent or a charge
// happened. "Send me an invoice" is the client's request for an invoice,
// logged here, not sent. Refund policy is a DRAFT (attorney review
// needed; refunds are NOT guaranteed) — see lib/fees.
"use client";

import { useState } from "react";
import { EXAMPLE_ORDER, MISSED_PAYMENT_RULE, formatCents } from "@/lib/order";
import { DRAFT_REFUND_TIERS, refundStatus } from "@/lib/fees";

export default function InvoiceActions() {
  const [queue, setQueue] = useState<string[]>([]);
  const [refundStage, setRefundStage] = useState<"before_intake" | "document_collection" | "forms_drafted">("document_collection");
  const refund = refundStatus(refundStage);

  return (
    <section
      aria-labelledby="invoice-actions-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="invoice-actions-heading" className="text-lg font-semibold">
        Invoices, Receipts &amp; Refund Policy
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Example order: {EXAMPLE_ORDER.packageTitle} — prep fee{" "}
        <strong>{formatCents(EXAMPLE_ORDER.totalServiceFeeCents)}</strong>.
        USCIS / NVC government fees are shown separately and never added to
        the prep-fee total. Locked plans only: Pay in Full / Pay in 3 /
        Monthly 6 / 12. No 50/50 split.
      </p>

      <h3 className="mt-4 text-sm font-semibold">Receipt (example)</h3>
      <ul className="mt-2 space-y-1 text-sm">
        {EXAMPLE_ORDER.invoices.map((inv) => (
          <li key={inv.invoiceNumber} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
            {inv.invoiceNumber} — {inv.milestoneLabel} — {formatCents(inv.amountCents)} —{" "}
            {inv.status === "paid" ? `Paid ${inv.paidAt ?? ""} — receipt available` : "Unpaid"}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            setQueue((q) => [...q, "“Send me an invoice” request logged (example — local only). No invoice was sent; the preparer creates it from the locked order."])
          }
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white"
        >
          Send me an invoice
        </button>
        <button
          type="button"
          onClick={() =>
            setQueue((q) => [...q, "Stripe Invoice request queued (SKELETON ONLY) — Stripe is NOT connected, so no invoice was sent and no charge was made."])
          }
          className="rounded bg-slate-700 px-3 py-2 text-sm font-medium text-white"
        >
          Send a Stripe Invoice (skeleton — Stripe not connected)
        </button>
      </div>
      {queue.length > 0 && (
        <ul className="mt-2 space-y-1 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          {queue.map((item, i) => (
            <li key={i}>Queued: {item}</li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-slate-500">{MISSED_PAYMENT_RULE}</p>

      <h3 className="mt-4 text-sm font-semibold">
        Refund policy — DRAFT (attorney review needed; refunds not guaranteed)
      </h3>
      <label className="mt-2 block text-sm">
        <span className="font-medium">Case stage</span>
        <select
          value={refundStage}
          onChange={(e) => setRefundStage(e.target.value as typeof refundStage)}
          className="mt-1 w-full max-w-sm rounded border border-slate-300 bg-white px-2 py-1 text-sm"
        >
          {DRAFT_REFUND_TIERS.map((t) => (
            <option key={t.stage} value={t.stage}>{t.label}</option>
          ))}
        </select>
      </label>
      <p className="mt-2 text-sm">
        {refund.label}: <strong>{refund.refundPercent}% refund (draft)</strong> —{" "}
        {refund.policyNote}
      </p>
    </section>
  );
}
