// Billing & Payment Arrangement Pipeline — preparer view.
// Locked plans only: Pay in Full / Pay in 3 / Monthly 6 / 12.
// Example order is the locked $1,799 Standard Family Adjustment Bundle
// (Pay in 3) from lib/order.ts. The clerical prep fee is ALWAYS shown
// separately from USCIS / NVC government fees.
"use client";

import { useState } from "react";
import {
  EXAMPLE_ORDER,
  MISSED_PAYMENT_RULE,
  formatCents,
} from "@/lib/order";
import { splitInvoices } from "@/lib/stripe";
import { FAMILY_ADJUSTMENT_BUNDLE } from "@/lib/bundles";
import { NUDGE_INTERVAL_HOURS, shouldNudge } from "@/lib/nudges";

const PIPELINE_BUCKETS = [
  "Paid in Full",
  "Active Payment Arrangement",
  "Past Due",
  "Action Needed",
] as const;

type PipelineBucket = (typeof PIPELINE_BUCKETS)[number];

export default function BillingPipeline() {
  const order = EXAMPLE_ORDER;
  const paid = order.invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amountCents, 0);
  const remaining = order.totalServiceFeeCents - paid;
  const unpaid = order.invoices.filter((i) => i.status !== "paid");

  // Auto-draft schedule from the locked split-invoice helper, anchored
  // on the first paid installment date (example).
  const schedule = splitInvoices(
    order.totalServiceFeeCents,
    order.paymentPlanType,
    new Date("2026-11-10")
  );
  const nextDraft = schedule.find(
    (s) => new Date(s.dueDate) > new Date("2026-11-17")
  );

  const activeBucket: PipelineBucket =
    remaining <= 0
      ? "Paid in Full"
      : unpaid.some((i) => i.status === "overdue")
        ? "Past Due"
        : "Active Payment Arrangement";

  const [queue, setQueue] = useState<string[]>([]);

  const nudgeCheck = shouldNudge({
    actionItemCleared: false,
    notificationPreference: "sms",
    optedOutSms: false,
    now: new Date("2026-11-19T12:00:00Z"),
    nextDueAt: new Date(Date.now() + NUDGE_INTERVAL_HOURS * 3600_000).toISOString(),
  });

  const queueReminder = () =>
    setQueue((q) => [
      ...q,
      "Payment reminder queued (logic only) — not sent. Next nudge check: every 48h while a Priority Action Item is open.",
    ]);
  const queuePaymentLink = () =>
    setQueue((q) => [
      ...q,
      "Payment arrangement link queued (skeleton only) — no invoice was sent and no charge was made.",
    ]);

  return (
    <section
      aria-labelledby="billing-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="billing-heading" className="text-lg font-semibold">
        Billing &amp; Payment Arrangement Pipeline
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {order.packageTitle} — {FAMILY_ADJUSTMENT_BUNDLE.name} (Standard,{" "}
        {formatCents(FAMILY_ADJUSTMENT_BUNDLE.price.standard * 100)} locked).
        Locked plans only: Pay in Full / Pay in 3 / Monthly 6 / 12. No
        other split plan exists for immigration bundles.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-4" role="list">
        {PIPELINE_BUCKETS.map((bucket) => (
          <div
            key={bucket}
            role="listitem"
            className={`rounded border p-3 text-center text-sm font-medium ${
              bucket === activeBucket
                ? "border-blue-600 bg-blue-50 text-blue-900"
                : "border-slate-200 bg-slate-50 text-slate-600"
            }`}
          >
            {bucket}
            <span className="block text-xs font-normal">
              {bucket === activeBucket ? "1 example order" : "0 example orders"}
            </span>
          </div>
        ))}
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Clerical prep fee (service fee)
          </dt>
          <dd className="text-sm font-medium">
            {formatCents(order.totalServiceFeeCents)} total —{" "}
            {formatCents(paid)} paid, {formatCents(remaining)} remaining
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            USCIS / NVC government fees (separate)
          </dt>
          <dd className="text-sm font-medium">
            {formatCents(order.estimatedUscisGovFeeCents)} estimated — shown
            separately, never added to the service total
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Next auto-draft
          </dt>
          <dd className="text-sm font-medium">
            {nextDraft
              ? `${nextDraft.label} — ${formatCents(nextDraft.amountCents)} on ${nextDraft.dueDate}`
              : "No future draft scheduled"}
          </dd>
        </div>
      </dl>

      <h3 className="mt-5 text-sm font-semibold">Invoices (example)</h3>
      <ul className="mt-2 space-y-2">
        {order.invoices.map((inv) => (
          <li
            key={inv.invoiceNumber}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 p-3 text-sm"
          >
            <span>
              <span className="font-medium">{inv.invoiceNumber}</span> —{" "}
              {inv.milestoneLabel} — {formatCents(inv.amountCents)}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-semibold ${
                inv.status === "paid"
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {inv.status === "paid"
                ? `Paid ${inv.paidAt ?? ""}`
                : "Unpaid — final balance"}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-slate-500">{MISSED_PAYMENT_RULE}</p>
      <p className="mt-1 text-xs text-slate-500">
        Nudge check ({NUDGE_INTERVAL_HOURS}h interval): {nudgeCheck.reason}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={queueReminder}
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Send SMS / Email Reminder
        </button>
        <button
          type="button"
          onClick={queuePaymentLink}
          className="rounded bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Send Payment Arrangement Link
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-600">
        Reminder logic ready — sending needs Twilio (not connected).
        Payment link skeleton — Stripe not connected. Nothing above
        actually sends a message or an invoice.
      </p>

      {queue.length > 0 && (
        <ul className="mt-3 space-y-1 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          {queue.map((item, i) => (
            <li key={i}>Queued: {item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
