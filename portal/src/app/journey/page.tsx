import type { Metadata } from "next";
import { PUBLIC_PAGE_META } from "@/lib/seo";
import Link from "next/link";
import DirRoot from "@/components/DirRoot";

export const metadata: Metadata = {
  title: PUBLIC_PAGE_META["/journey"].title,
  description: PUBLIC_PAGE_META["/journey"].description,
};
import {
  JOURNEY_STEPS,
  POST_ARRIVAL_CHECKLIST,
} from "@/lib/journey";

const DATE_BASIS_LABEL: Record<string, string> = {
  locked_range: "Locked range — no date promised",
  no_date_promised: "No date promised",
  client_specific_date: "Date from your own letter — never invented here",
};

export default function JourneyPage() {
  return (
    <DirRoot>
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <strong>One case, whole journey.</strong> From your first question
          to the interview, to the green card in hand, to the Social Security
          card arriving after entry. Every step names its locked source. No
          USCIS timeline is invented — the only timing here is the range
          already locked in the case lifecycle: Green Card &amp; SSN mailed
          30–90 days after entry. No date is ever promised.
        </p>

        <h1 className="mt-4 text-xl font-bold">
          Your Journey — First Question to Green Card in Hand
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          <Link href="/portal" className="underline">
            ← Back to Portal
          </Link>
          {" · "}
          <Link href="/backbone" className="underline">
            The Backbone — USCIS · NVC · Embassy
          </Link>
        </p>

        <ol className="mt-4 space-y-3">
          {JOURNEY_STEPS.map((step) => (
            <li
              key={step.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h2 className="text-base font-semibold">
                Step {step.position} — {step.title}
              </h2>
              <p className="mt-1 text-sm text-slate-700">{step.detail}</p>
              <p className="mt-2 text-xs text-slate-500">
                Source: {step.source}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-600">
                {DATE_BASIS_LABEL[step.dateBasis]}
                {step.lockedRange ? ` — ${step.lockedRange}` : ""}
              </p>
            </li>
          ))}
        </ol>

        <section
          aria-labelledby="post-arrival-heading"
          className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 id="post-arrival-heading" className="text-base font-semibold">
            Post-arrival checklist — after you enter the United States
          </h2>
          <ul className="mt-2 space-y-2">
            {POST_ARRIVAL_CHECKLIST.map((item) => (
              <li key={item.id} className="text-sm">
                <span className="mr-2 inline-block h-4 w-4 rounded border border-slate-400 align-middle" />
                {item.label}
                <span className="block pl-6 text-xs text-slate-500">
                  Source: {item.source} ·{" "}
                  {DATE_BASIS_LABEL[item.dateBasis]}
                  {item.lockedRange ? ` — ${item.lockedRange}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Immigration with NIPTEI — not a law firm, not affiliated with
            USCIS. Only a licensed attorney or DOJ-Accredited Representative
            gives legal advice (8 CFR 292.1). The system never files for you;
            you review and sign before anything is submitted.
          </p>
        </section>
      </div>
    </div>
    </DirRoot>
  );
}
