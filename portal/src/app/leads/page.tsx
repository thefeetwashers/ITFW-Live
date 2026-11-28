// Lead Generator front page — the front page of the account for new
// enquiries: the intake funnel (LeadGenerator) + the Smart Intake
// Calculator link for the full quote. Public: no login is needed to
// ask for help. ?ref=<code> carries a referral link (/r/[code]);
// ?provider=<slug> carries a professional's storefront (/p/[slug]).
import type { Metadata } from "next";
import { Suspense } from "react";
import LeadGeneratorFromParams from "@/components/leads/LeadGeneratorFromParams";
import { LEAD_BOUNDARY_NOTE, leadLoopSteps } from "@/lib/leadLoop";

export const metadata: Metadata = {
  title: "Get immigration help — Immigration with NIPTEI",
  description:
    "Tell us what immigration help you need. We reply in your preferred language. Nothing is filed and no fee is due at this stage.",
};

export default function LeadsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">Get immigration help</h1>
        <p className="mt-1 text-sm text-slate-600">
          Immigration with NIPTEI · nipteiapp@gmail.com · (772) 971-6129
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Clerical / educational help only; not a law firm, not affiliated
          with USCIS, no approval guarantee. Only a licensed attorney or
          DOJ-Accredited Representative gives legal advice or represents a
          client (8 CFR 292.1).
        </p>
      </header>
      <div className="mt-6">
        <Suspense
          fallback={
            <p className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              Loading the enquiry form…
            </p>
          }
        >
          <LeadGeneratorFromParams />
        </Suspense>
      </div>
      <section
        aria-label="How lead-finding honestly works"
        className="mt-6 rounded border border-amber-300 bg-amber-50 px-3 py-3"
      >
        <h2 className="text-sm font-semibold text-amber-900">
          How lead-finding honestly works here
        </h2>
        <p className="mt-1 text-sm text-amber-900">{LEAD_BOUNDARY_NOTE}</p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-amber-900">
          {leadLoopSteps().map((s) => (
            <li key={s.step}>
              <strong>
                {s.step}. {s.title}:
              </strong>{" "}
              {s.detail}
            </li>
          ))}
        </ol>
      </section>
      <footer className="mt-8 text-xs text-slate-500">
        <a href="https://immigration.niptei.com" className="text-blue-700 underline">
          Back to Immigration with NIPTEI
        </a>
      </footer>
    </main>
  );
}
