// PaymentCentre — the payment + missing-payment centre, on every dashboard.
// Reuses the locked order data (lib/order.ts EXAMPLE_ORDER, MISSED_PAYMENT_RULE,
// missedPaymentTotal) and the locked split logic (lib/stripe.ts splitInvoices).
//   - Every invoice: paid / due / overdue, with amounts.
//   - Next auto-draft date + amount (from the plan schedule).
//   - "Pay Now" — Stripe SKELETON ONLY: Stripe is NOT connected, so the
//     button shows a preview notice and charges nothing.
//   - "Send payment link" / "Send invoice" — QUEUE ONLY: Twilio / Resend
//     are NOT connected, so nothing is sent; the request is listed as queued.
//   - Missed-payment 50% rule with the EXACT math for this client's plan.
//   - Past-due nudges at 48h, in the client's language, via the notification
//     engine — queued only until Twilio / Resend are connected.
//   - Payment arrangement editor: Pay in Full / Pay in 3 / Monthly 6 / 12
//     ONLY. There is NO 50/50 plan for immigration bundles.
// Prep fee and government fees are ALWAYS shown separately, never combined.
"use client";

import { useMemo, useState } from "react";
import {
  EXAMPLE_ORDER,
  formatCents,
  type ServiceOrder,
} from "@/lib/order";
import {
  PAYMENT_PLANS,
  missedPaymentMath,
  pastDueNudgeText,
  planSchedule,
  type PaymentPlanType,
} from "@/lib/nextStepEngine";
import { NUDGE_INTERVAL_HOURS } from "@/lib/nudges";
import type { LanguageCode } from "@/lib/i18n";

export default function PaymentCentre(props: {
  order?: ServiceOrder;
  clientLanguage?: LanguageCode;
  /** Family / student views see invoices only — no editing. */
  canEdit?: boolean;
}) {
  const order = props.order ?? EXAMPLE_ORDER;
  const lang = props.clientLanguage ?? "es";
  const canEdit = props.canEdit ?? true;
  const [plan, setPlan] = useState<PaymentPlanType>(order.paymentPlanType);
  const [payNotice, setPayNotice] = useState<string | null>(null);
  const [queued, setQueued] = useState<string[]>([]);
  const [arrangementSaved, setArrangementSaved] = useState<string | null>(null);

  // Schedule from the locked split logic. First draft date: the first
  // paid invoice's date in this EXAMPLE order (2026-11-10); the schedule
  // is labelled EXAMPLE throughout.
  const schedule = useMemo(
    () => planSchedule(order.totalServiceFeeCents, plan, new Date("2026-11-10")),
    [order.totalServiceFeeCents, plan]
  );
  const paidCents = order.invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amountCents, 0);
  const dueCents = order.totalServiceFeeCents - paidCents;
  const overdue = order.invoices.filter((i) => i.status === "overdue");
  const nextDraft = schedule.find(
    (s, i) => i >= order.invoices.filter((x) => x.status === "paid").length
  );
  const math = missedPaymentMath(order.totalServiceFeeCents);
  const nudge =
    overdue.length > 0
      ? pastDueNudgeText(overdue[0].invoiceNumber, overdue[0].amountCents, lang)
      : null;

  const queue = (label: string) =>
    setQueued((q) => [
      ...q,
      `${label} — Queued only. Twilio / Resend are NOT connected, so nothing was sent.`,
    ]);

  return (
    <section
      aria-labelledby="payment-centre-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="payment-centre-heading" className="text-base font-semibold">
        Payment Centre — {order.packageTitle} (EXAMPLE)
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Prep fee total: <strong>{formatCents(order.totalServiceFeeCents)}</strong>{" "}
        · Paid: <strong>{formatCents(paidCents)}</strong> · Still due:{" "}
        <strong>{formatCents(dueCents)}</strong> · USCIS government fees are
        separate: <strong>{formatCents(order.estimatedUscisGovFeeCents)}</strong>{" "}
        (shown separately — never added to the prep-fee total).
      </p>

      <h3 className="mt-4 text-sm font-semibold">Invoices</h3>
      <ul className="mt-2 space-y-2 text-sm">
        {order.invoices.map((inv) => (
          <li
            key={inv.invoiceNumber}
            className={`flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 ${
              inv.status === "paid"
                ? "border-green-300 bg-green-50"
                : inv.status === "overdue"
                  ? "border-red-300 bg-red-50"
                  : "border-slate-200 bg-slate-50"
            }`}
          >
            <span>
              <span className="font-medium">{inv.invoiceNumber}</span> —{" "}
              {inv.milestoneLabel} — {formatCents(inv.amountCents)} ·{" "}
              <strong>
                {inv.status === "paid"
                  ? `Paid${inv.paidAt ? ` (${inv.paidAt})` : ""}`
                  : inv.status === "overdue"
                    ? "OVERDUE"
                    : "Due"}
              </strong>
            </span>
            {canEdit && inv.status !== "paid" && (
              <span className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPayNotice(
                      `Pay Now is a Stripe skeleton only — Stripe is NOT connected, so no charge was made for ${inv.invoiceNumber} (${formatCents(inv.amountCents)}). Connect Stripe (BYO) before any real payment.`
                    )
                  }
                  className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Pay Now (Stripe — not connected)
                </button>
                <button
                  type="button"
                  onClick={() => queue(`Send payment link — ${inv.invoiceNumber}`)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold"
                >
                  Send payment link
                </button>
                <button
                  type="button"
                  onClick={() => queue(`Send invoice — ${inv.invoiceNumber}`)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold"
                >
                  Send invoice
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>

      {nextDraft && (
        <p className="mt-2 text-sm">
          Next auto-draft: <strong>{nextDraft.label}</strong> —{" "}
          <strong>{formatCents(nextDraft.amountCents)}</strong> on{" "}
          <strong>{nextDraft.dueDate}</strong> (EXAMPLE schedule from the{" "}
          {PAYMENT_PLANS.find((p) => p.id === plan)?.label} plan).
        </p>
      )}
      {payNotice && (
        <p role="status" className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          {payNotice}
        </p>
      )}
      {queued.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-slate-600">
          {queued.map((q, i) => (
            <li key={i} className="rounded border border-slate-200 bg-slate-50 px-2 py-1">{q}</li>
          ))}
        </ul>
      )}

      <h3 className="mt-4 text-sm font-semibold">Missed-payment rule — exact math for this plan</h3>
      <p className="mt-1 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
        {math.rule} For this plan: {math.originalTotal} + 50% penalty (
        {math.penalty}) = <strong>{math.newTotal}</strong> total if a payment
        is missed. If you think you will miss a payment, tell your provider
        before the due date.
      </p>

      {overdue.length > 0 && nudge && (
        <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          <p className="font-semibold">
            Past-due nudge — queued (every {NUDGE_INTERVAL_HOURS}h until cleared)
          </p>
          <p className="mt-1">{nudge.original}</p>
          {nudge.original !== nudge.english && (
            <p className="mt-1 text-slate-600">{nudge.english}</p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            Queued only — Twilio / Resend are NOT connected, so no text or
            email was sent. The nudge stops the moment the invoice is paid.
          </p>
        </div>
      )}
      {overdue.length === 0 && (
        <p className="mt-2 text-xs text-slate-500">
          No invoice is overdue on this example order, so no past-due nudge is
          queued. A nudge is queued every {NUDGE_INTERVAL_HOURS}h while an
          invoice stays overdue, in the client&apos;s language.
        </p>
      )}

      {canEdit && (
        <>
          <h3 className="mt-4 text-sm font-semibold">Payment arrangement</h3>
          <p className="mt-1 text-xs text-slate-500">
            Locked plans only — Pay in Full / Pay in 3 / Monthly 6 / Monthly
            12. There is NO 50/50 plan for immigration bundles.
          </p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Payment arrangement">
            {PAYMENT_PLANS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={plan === p.id}
                onClick={() => {
                  setPlan(p.id);
                  setArrangementSaved(null);
                }}
                className={
                  "rounded-lg border px-3 py-2 text-sm font-medium " +
                  (plan === p.id
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 bg-white hover:border-blue-400")
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {schedule.map((s) => (
              <li key={s.label} className="rounded border border-slate-200 px-3 py-1.5">
                {s.label} — {formatCents(s.amountCents)} — due {s.dueDate} (EXAMPLE schedule)
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() =>
              setArrangementSaved(
                `Arrangement "${PAYMENT_PLANS.find((p) => p.id === plan)?.label}" saved locally in this demo only — it is NOT written to Supabase yet. It writes to payment_plans (0002, live) / payment_arrangements (0009, written only — not run yet) once migration 0009 has run.`
              )
            }
            className="mt-2 rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Save arrangement
          </button>
          {arrangementSaved && (
            <p role="status" className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {arrangementSaved}
            </p>
          )}
        </>
      )}
    </section>
  );
}
