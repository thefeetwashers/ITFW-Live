// /fee-waiver — Form I-912 fee-waiver eligibility CHECKLIST.
// Server component: renders src/lib/feeWaiverChecklist.ts.
// A checklist, NOT a decision — only USCIS decides.
import type { Metadata } from "next";
import { PUBLIC_PAGE_META } from "@/lib/seo";
import Link from "next/link";

export const metadata: Metadata = {
  title: PUBLIC_PAGE_META["/fee-waiver"].title,
  description: PUBLIC_PAGE_META["/fee-waiver"].description,
};
import {
  FEE_WAIVER_CHECKLIST,
  FEE_WAIVER_HOW_TO_USE,
  FEE_WAIVER_ONLY_USCIS_DECIDES,
  FEE_WAIVER_PREP_PRICE_NOTE,
  FEE_WAIVER_SOURCE,
} from "@/lib/feeWaiverChecklist";

export default function FeeWaiverPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">
          Fee waiver (Form I-912) — checklist, not a decision
        </h1>
        <p className="mt-2 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          {FEE_WAIVER_ONLY_USCIS_DECIDES}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Form I-912 is the Request for Fee Waiver. Below are the
          questions USCIS asks on that form. Answering “yes” to any one
          lets you ASK for a waiver — it does not grant one. Source:{" "}
          <a href={FEE_WAIVER_SOURCE.url} target="_blank" rel="noreferrer" className="text-blue-700 underline">
            {FEE_WAIVER_SOURCE.label}
          </a>
          .
        </p>
        <p className="mt-2 text-sm">
          <Link href="/portal" className="text-blue-700 underline">
            ← Back to the portal
          </Link>
          {" · "}
          <Link href="/glossary" className="text-blue-700 underline">
            Glossary →
          </Link>
          {" · "}
          <Link href="/your-rights" className="text-blue-700 underline">
            Your rights →
          </Link>
        </p>
      </header>

      <ol className="mt-6 space-y-4">
        {FEE_WAIVER_CHECKLIST.map((item, i) => (
          <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-base font-semibold">
              {i + 1}. {item.question}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              <span className="font-semibold">What to show: </span>
              {item.whatToShow}
            </p>
          </li>
        ))}
      </ol>

      <section aria-labelledby="fee-waiver-how" className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 id="fee-waiver-how" className="text-base font-semibold">How to use this checklist</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {FEE_WAIVER_HOW_TO_USE.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-600">{FEE_WAIVER_PREP_PRICE_NOTE}</p>
        <p className="mt-2 text-sm text-slate-600">
          Educational information only, not legal advice. Immigration
          with NIPTEI is a document-preparation service, not a law firm,
          and is not USCIS. Only a licensed attorney or DOJ-accredited
          representative gives legal advice (8 CFR 292.1). You can also
          ask Ask NIPTEI in the chat — “what is a fee waiver?” — and it
          answers with this same checklist.
        </p>
      </section>
    </main>
  );
}
