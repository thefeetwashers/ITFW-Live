import Link from "next/link";
import { EXAMPLE_ORDER, roadmapStages, formatCents, MISSED_PAYMENT_RULE } from "@/lib/order";
import { BUNDLE_TEMPLATES, FAMILY_ADJUSTMENT_BUNDLE } from "@/lib/bundles";
import {
  exampleInvoiceLines,
  refundStatus,
  USCIS_FEE_SCHEDULE_URL,
  TRANSLATION_PRICE_PER_PAGE_CENTS,
} from "@/lib/fees";
import { splitInvoices } from "@/lib/stripe";
import { EXAMPLE_SMART_FORMS, EXAMPLE_CHECKLIST } from "@/lib/example-data";

const PLAN_LABEL: Record<string, string> = {
  full_upfront: "Pay in Full",
  installments_3: "Pay in 3",
  monthly_6: "Monthly — 6 months",
  monthly_12: "Monthly — 12 months",
};

export function OrderSummary() {
  const order = EXAMPLE_ORDER;
  const paid = order.invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amountCents, 0);
  const due = order.totalServiceFeeCents - paid;
  const schedule = splitInvoices(
    order.totalServiceFeeCents,
    order.paymentPlanType,
    new Date("2026-11-10")
  );
  const feeLines = exampleInvoiceLines();
  // Current stage for the refund box: drafting is under way, so the
  // example order sits in document collection (50% tier, draft policy).
  const refund = refundStatus("document_collection");

  return (
    <section
      id="ordered-package"
      aria-labelledby="order-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="order-heading" className="text-base font-semibold">
        1. Your Ordered Package &amp; Invoice Summary
      </h2>
      <p className="mt-1 text-sm">
        <strong>Service Ordered:</strong> {order.packageTitle}
      </p>
      <p className="text-sm">
        <strong>Payment Plan:</strong>{" "}
        {PLAN_LABEL[order.paymentPlanType] ?? order.paymentPlanType} —{" "}
        {order.paymentPlanType === "full_upfront"
          ? "all stages unlocked."
          : order.paymentPlanType === "installments_3"
            ? "3 installments; drafting proceeds, E-Sign / final download unlock when the balance is paid."
            : "monthly auto-draft; the final packet needs the balance current."}
      </p>

      <div className="mt-3 rounded border border-slate-200 p-3">
        <h3 className="text-sm font-semibold">
          Invoice #INV-2049 (example order number)
        </h3>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt>Total (service fee only):</dt>
            <dd className="font-semibold">{formatCents(order.totalServiceFeeCents)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Paid:</dt>
            <dd>{formatCents(paid)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Due:</dt>
            <dd className="font-semibold text-red-700">{formatCents(due)}</dd>
          </div>
        </dl>
        <ul className="mt-2 space-y-1 text-sm">
          {order.invoices.map((inv) => (
            <li key={inv.invoiceNumber} className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-1">
              <span>
                {inv.invoiceNumber} — {inv.milestoneLabel}
              </span>
              <span>
                {formatCents(inv.amountCents)} ·{" "}
                {inv.status === "paid"
                  ? `Paid ${inv.paidAt ?? ""}`
                  : "Unpaid — final balance"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Auto-draft schedule ({PLAN_LABEL[order.paymentPlanType]} — from
          splitInvoices, skeleton only, no charge made):{" "}
          {schedule
            .map((s) => `${s.label}: ${formatCents(s.amountCents)} due ${s.dueDate}`)
            .join(" · ")}
        </p>
        <p className="mt-2 text-sm font-semibold">
          USCIS Gov. Filing Fees paid separately to DHS —{" "}
          {formatCents(order.estimatedUscisGovFeeCents)} I-485 USCIS fee
          (locked), shown on a SEPARATE line, never combined into the service
          total above.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => alert("Example only — no receipt PDF is generated in this build.")}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Download PDF Receipt
          </button>
          <button
            type="button"
            onClick={() => alert("Example only — no payment is actually taken in this build.")}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            Pay Remaining
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Example buttons — no payment is actually taken. No payment on
          Nov 19, 2026 is real.
        </p>
      </div>

      {/* Layer 1 — Transparent Fee Breakdown & Refund Rules */}
      <div id="invoices-pay" className="mt-4 rounded border border-slate-200 p-3">
        <h3 className="text-sm font-semibold">
          Transparent Fee Breakdown — Invoices &amp; Pay
        </h3>
        <p className="text-xs text-slate-500">
          Service fees and USCIS government fees are always separate — never
          combined into one total.
        </p>
        <ul className="mt-2 space-y-2 text-sm">
          {feeLines.map((line) => (
            <li
              key={line.label}
              className="flex flex-wrap items-start justify-between gap-2 rounded border border-slate-200 px-3 py-2"
            >
              <span>
                <strong>
                  {line.kind === "preparation"
                    ? "(1) "
                    : line.kind === "addon"
                      ? "(2) "
                      : "(3) "}
                  {line.label}
                </strong>
                <span className="block text-xs text-slate-500">
                  {line.note}{" "}
                  {line.locked ? "Locked price." : "Not a locked price."}
                </span>
                {line.kind === "uscis_government" && (
                  <a
                    href={USCIS_FEE_SCHEDULE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline"
                  >
                    USCIS fee schedule — {USCIS_FEE_SCHEDULE_URL}
                  </a>
                )}
              </span>
              <span className="font-semibold">{formatCents(line.amountCents)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Certified Translation is ${TRANSLATION_PRICE_PER_PAGE_CENTS / 100}
          /page (locked). Express Review $50 is an EXAMPLE / to-be-confirmed
          add-on, NOT a locked price.
        </p>

        <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          <h4 className="font-semibold">Refund status — {refund.label}</h4>
          <p>
            Refund: <strong>{refund.refundPercent}%</strong> at this stage
            (example order is in document collection / drafting).
          </p>
          <p className="mt-1 text-xs">{refund.policyNote}</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-amber-500"
              style={{ width: `${refund.refundPercent}%` }}
            />
          </div>
          <ul className="mt-2 list-disc pl-5 text-xs">
            <li>Before intake starts — 100%</li>
            <li>During document collection — 50%</li>
            <li>Once forms are drafted — 0%</li>
          </ul>
          <p className="mt-1 text-xs font-semibold">
            Draft refund policy — for a licensed attorney to review before
            live use. Refunds are not guaranteed.
          </p>
        </div>
      </div>
    </section>
  );
}

export function ProcessRoadmap() {
  const stages = roadmapStages(EXAMPLE_ORDER);
  const labels = [
    "Deposit Paid — Unlocks Intake Forms & Document Vault",
    "Forms & Docs (Now)",
    "Draft & Audit",
    "Final Balance — Pay remaining to unlock E-Sign",
    "E-Sign & Mail/File — Sign packet & receive USCIS tracking #",
  ];
  return (
    <section
      aria-labelledby="roadmap-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="roadmap-heading" className="text-base font-semibold">
        2. How Your Process Works
      </h2>
      <ol className="mt-3 space-y-2">
        {stages.map((s, i) => (
          <li
            key={s.step}
            className={`flex gap-3 rounded border px-3 py-2 text-sm ${
              s.unlocked
                ? "border-green-300 bg-green-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <span className="font-bold">{s.unlocked ? "✓" : "🔒"}</span>
            <span>
              <strong>
                Step {s.step}: {labels[i]}
              </strong>
              <span className="block text-xs text-slate-600">{s.detail}</span>
              {s.step === 4 && (
                <span className="block text-xs font-semibold text-slate-700">
                  Missed-payment rule: {MISSED_PAYMENT_RULE}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-slate-500">
        Stages are computed from the actual order (roadmapStages) — which
        stages are unlocked depends on the payment plan and what has been
        paid, not on a fixed split.
      </p>
    </section>
  );
}

export function FormsIncluded() {
  const ordered = BUNDLE_TEMPLATES.filter((b) =>
    EXAMPLE_ORDER.orderedForms.includes(b.formCode)
  );
  const uploadedCount = EXAMPLE_CHECKLIST.filter(
    (i) => i.status === "accepted" || i.status === "under_review"
  ).length;
  const addressForm = EXAMPLE_SMART_FORMS.find((f) => f.id === "sf-address");
  return (
    <section
      aria-labelledby="forms-included-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="forms-included-heading" className="text-base font-semibold">
        3. Forms Included in Your Order &amp; Required Checklist
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {FAMILY_ADJUSTMENT_BUNDLE.name}: Basic $
        {FAMILY_ADJUSTMENT_BUNDLE.price.basic} / Standard $
        {FAMILY_ADJUSTMENT_BUNDLE.price.standard} / Premium $
        {FAMILY_ADJUSTMENT_BUNDLE.price.premium} (locked bundle prices). Your
        order: Standard $1,799.
      </p>
      {ordered.map((b) => (
        <div key={b.formCode} className="mt-3 rounded border border-slate-200 p-3">
          <h3 className="text-sm font-semibold">
            Form {b.formCode} — {b.name}
          </h3>
          <p className="text-xs text-slate-500">
            {b.serviceFee ? (
              <>
                Service fee (locked): Basic $
                {"basic" in b.serviceFee ? b.serviceFee.basic : ""} /
                Standard $
                {"standard" in b.serviceFee ? b.serviceFee.standard : ""} /
                Premium $
                {"premium" in b.serviceFee ? b.serviceFee.premium : ""}.
              </>
            ) : (
              <>Service fee: TO BE CONFIRMED — no locked service fee for this bundle yet.</>
            )}
          </p>
          <p className="text-xs font-semibold">
            USCIS fee note: {b.uscisFeeNote}
          </p>
          {b.formCode === "I-130" && (
            <p className="text-xs">
              Questionnaire progress (5-Year Address &amp; Work History):{" "}
              {addressForm?.pct}% — {addressForm?.state}.{" "}
              <Link href="/portal/questionnaire" className="underline">
                Resume Questionnaire →
              </Link>
            </p>
          )}
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {b.checklist.map((c) => (
              <li key={c.label}>
                {c.label}{" "}
                {c.status === "to_be_confirmed" && (
                  <span className="text-xs font-semibold text-amber-700">
                    (to be confirmed)
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <h3 className="mt-4 text-sm font-semibold">
        Required Documents — {uploadedCount} of {EXAMPLE_CHECKLIST.length}{" "}
        Uploaded
      </h3>
      <ul className="mt-2 space-y-1 text-sm">
        {EXAMPLE_CHECKLIST.map((item) => (
          <li key={item.id} className="flex justify-between gap-2 rounded border border-slate-200 px-3 py-2">
            <span>{item.label}</span>
            <span>
              {item.status === "accepted" && "Uploaded ✓"}
              {item.status === "under_review" && "Uploaded — under review"}
              {item.status === "retake_requested" && "Upload Joint Bank Statement !"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
