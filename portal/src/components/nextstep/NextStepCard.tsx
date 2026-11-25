// NextStepCard — the single "What you need to do next, by when, and what
// happens after that" card, on EVERY dashboard. Plain English in the
// client's language, original + English side by side. Derived from the
// case (lib/nextStepEngine.ts deriveNextStep) — never hardcoded.
"use client";

import {
  deriveNextStep,
  tNextStep,
  type NextStepInput,
} from "@/lib/nextStepEngine";

export default function NextStepCard(props: { input: NextStepInput }) {
  const step = deriveNextStep(props.input);
  const title = tNextStep("nextStepTitle", props.input.language);
  const byWhen = tNextStep("byWhen", props.input.language);
  const after = tNextStep("whatHappensAfter", props.input.language);
  return (
    <section
      aria-labelledby="next-step-heading"
      className="rounded-lg border-2 border-slate-900 bg-white p-4 shadow-sm"
    >
      <h2 id="next-step-heading" className="text-base font-semibold">
        {title.original}
        {title.original !== title.english && (
          <span className="block text-sm font-normal text-slate-500">
            {title.english}
          </span>
        )}
      </h2>
      <p className="mt-2 text-sm font-semibold">{step.title}</p>
      <p className="mt-1 text-sm text-slate-700">{step.detail}</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <dt className="font-semibold">
            {byWhen.original}
            {byWhen.original !== byWhen.english && (
              <span className="font-normal text-slate-500"> · {byWhen.english}</span>
            )}
          </dt>
          <dd>{step.byWhen}</dd>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <dt className="font-semibold">
            {after.original}
            {after.original !== after.english && (
              <span className="font-normal text-slate-500"> · {after.english}</span>
            )}
          </dt>
          <dd>{step.after}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-slate-500">
        {step.actor === "client"
          ? "This step is yours to do."
          : "This step is your provider's to do — nothing is needed from you right now."}{" "}
        Example case — replace with the real case once Supabase is connected.
      </p>
    </section>
  );
}
