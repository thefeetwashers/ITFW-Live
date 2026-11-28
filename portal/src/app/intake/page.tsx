// /intake — Powerful client intake: one guided sequence (final sweep,
// Nov 28, 2026).
//
// Founder's charge: one intake entry point that routes a new client
// through Path Finder -> Smart Intake Calculator (instant fee estimate,
// USCIS fee + our fee separate) -> document checklist preview (first 2
// items free; the full checklist is paid/gated) -> register -> pay ->
// case created.
//
// REUSES, never rebuilds:
//   * Path Finder questions + fee estimate: the existing
//     SmartIntakeCalculator (lib/intakeCalculator.ts) — the 4
//     plain-English questions, locked fee tables, prep vs government
//     fees on separate lines. Nothing is pre-selected.
//   * Checklist preview: the existing form-checklist templates
//     (lib/formChecklists.ts) — the first 2 items are shown free, the
//     rest are counted as locked, never listed.
//   * Register: /register (role forms + Stripe checkout summary).
//     Pay: the existing Stripe checkout — DB-confirmed by the webhook,
//     never a front-end flag. Case created: the case, invoice and full
//     checklist open in /portal, with the daily home on /today.
//   * Save-and-resume: DIY drafts (/diy, /api/diy/drafts, migration
//     0023) — answers are saved as you go and can be resumed later.
//
// Free until here / pay from here: steps 1–4 are FREE, steps 5–6 need
// payment. The boundary is INTAKE_FREE_PAID_BOUNDARY
// (lib/finalSweep.ts) — the progress indicator below is rendered from
// INTAKE_STEPS, so the boundary can never drift from the list.
// No step is invented, no price is invented, no approval is promised.
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SmartIntakeCalculator from "@/components/SmartIntakeCalculator";
import {
  INTAKE_FREE_PAID_BOUNDARY,
  INTAKE_STEPS,
  checklistPreview,
} from "@/lib/finalSweep";
import {
  FORM_CHECKLIST_TEMPLATES,
  getTemplate,
} from "@/lib/formChecklists";

export default function IntakePage() {
  const [templateId, setTemplateId] = useState("family-adjustment");
  const template = useMemo(
    () => getTemplate(templateId) ?? FORM_CHECKLIST_TEMPLATES[0],
    [templateId]
  );
  const preview = useMemo(
    () => checklistPreview(template.checklist, 2),
    [template]
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">Start your application — guided intake</h1>
        <p className="mt-1 text-sm text-slate-600">
          One path, six steps. Steps 1–4 are free. You pay only at step 5,
          and your case opens at step 6. Immigration with NIPTEI is a
          document-preparation service, not a law firm and not affiliated
          with USCIS. Only a licensed attorney or DOJ-accredited
          representative gives legal advice. Nothing here promises an
          approval.
        </p>
      </header>

      {/* Progress indicator — rendered from INTAKE_STEPS, with the
          free / paid boundary marked. */}
      <ol
        aria-label="Intake progress"
        className="mt-6 space-y-2"
      >
        {INTAKE_STEPS.map((step, i) => (
          <li
            key={step.id}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
              step.cost === "paid"
                ? "border-amber-400 bg-amber-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <span className="font-medium">{step.title}</span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                step.cost === "paid"
                  ? "border-amber-500 bg-amber-100 text-amber-900"
                  : "border-green-600 bg-green-100 text-green-900"
              }`}
            >
              {step.cost === "paid" ? "PAID — from here" : "FREE"}
            </span>
            {i === INTAKE_FREE_PAID_BOUNDARY && (
              <span className="w-full text-xs text-slate-600">
                ↑ Free until here — payment starts at this step. The full
                document checklist, Smart Forms, and Interview Prep unlock
                only after Stripe confirms your payment.
              </span>
            )}
          </li>
        ))}
      </ol>

      {/* Steps 1–2: Path Finder questions + instant fee estimate. */}
      <section
        id="step-calculator"
        aria-labelledby="intake-calculator-heading"
        className="mt-6"
      >
        <h2 id="intake-calculator-heading" className="text-base font-semibold">
          Steps 1–2 — Find your path &amp; see your fee estimate (FREE)
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Answer the Path Finder questions below. Your route — inside the
          US or outside the US — comes from your answers, and the fee
          estimate shows USCIS government fees and our prep fee on
          separate lines.
        </p>
        <div className="mt-3">
          <SmartIntakeCalculator />
        </div>
      </section>

      {/* Step 3: checklist preview — first 2 free, rest locked. */}
      <section
        id="step-checklist"
        aria-labelledby="intake-checklist-heading"
        className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 id="intake-checklist-heading" className="text-base font-semibold">
          Step 3 — Document checklist preview (FREE — first 2 items)
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Pick your form to preview its checklist. The first 2 items are
          free to see; the other {preview.lockedCount} of {preview.total}{" "}
          unlock after payment, when your case is created. The checklist
          uses the same colour system as your dashboard: green Approved,
          amber Pending / In Progress, red Missing / Rejected / Overdue,
          blue Uploaded awaiting review, grey Not Started.
        </p>
        <label htmlFor="intake-template" className="mt-3 block text-sm font-semibold">
          Form
        </label>
        <select
          id="intake-template"
          value={template.id}
          onChange={(e) => setTemplateId(e.target.value)}
          className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm"
        >
          {FORM_CHECKLIST_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <ul className="mt-3 space-y-2 text-sm">
          {preview.freeItems.map((item) => (
            <li
              key={item.id}
              className="rounded border border-slate-200 px-3 py-2"
            >
              <span className="font-medium">{item.title}</span>
              {item.blocking && (
                <span className="ml-2 text-xs font-semibold text-red-700">
                  (blocking)
                </span>
              )}
              {item.condition && (
                <span className="block text-xs text-slate-500">
                  {item.condition}
                </span>
              )}
            </li>
          ))}
          {preview.lockedCount > 0 && (
            <li className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
              🔒 {preview.lockedCount} more item
              {preview.lockedCount === 1 ? "" : "s"} in this checklist —
              unlock after payment (step 5).
            </li>
          )}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          {template.summary}
        </p>
      </section>

      {/* Steps 4–6: register -> pay -> case created. */}
      <section
        aria-labelledby="intake-register-heading"
        className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 id="intake-register-heading" className="text-base font-semibold">
          Steps 4–6 — Register (FREE) → Pay (PAID) → Case created
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Registration itself is free. Payment is through Stripe checkout
          at registration; access is confirmed from the database by the
          Stripe webhook, never by a front-end flag. Once payment is
          confirmed, your case, invoice, and full document checklist open
          in the Client Portal, with your next step first and your daily
          home on Today.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/register"
            className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Step 4 — Register →
          </Link>
          <Link
            href="/register"
            className="rounded border border-amber-500 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"
          >
            Step 5 — Pay at checkout (Stripe) →
          </Link>
          <Link
            href="/portal"
            className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold"
          >
            Step 6 — Open the Client Portal →
          </Link>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          <strong>Save-and-resume:</strong> if you start a DIY form
          instead, your answers are saved as drafts as you go and you can
          come back and resume them.{" "}
          <Link href="/diy" className="font-semibold text-blue-700 underline">
            Resume a saved DIY draft →
          </Link>
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Missed-payment rule: “If you miss a payment, 50% is added to the
          total amount.” ($999 → +$499.50 → $1,498.50; $1,799 → +$899.50 →{" "}
          $2,698.50; $2,799 → +$1,399.50 → $4,198.50.) If you think you
          will miss a payment, tell your provider before the due date.
        </p>
      </section>

      <footer className="mt-8 text-xs text-slate-500">
        <Link href="/" className="text-blue-600 underline">← Back to home</Link>
      </footer>
    </main>
  );
}
