// Client Pipeline page — one shared pipeline view with a role
// switcher (Preparer / Attorney / DOJ). Rows load from
// GET /api/pipeline?role=…&providerId=… (real DB rows only).
// ?providerId=<account id> identifies the professional; without it
// the page says so honestly and shows the empty state instead of
// inventing rows. The professional's own account id is what they pass
// once signed in — wiring sign-in to fill it automatically is still
// open (see the build report).
import type { Metadata } from "next";
import { Suspense } from "react";
import PipelinePageClient from "@/components/pipeline/PipelinePageClient";

export const metadata: Metadata = {
  title: "Client Pipeline — Immigration with NIPTEI",
  description:
    "Client pipeline for preparers, attorneys and DOJ-accredited representatives: masked DOB, case stage, next step, missing documents and payment status from the database.",
};

export default function PipelinePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">Client Pipeline</h1>
        <p className="mt-1 text-sm text-slate-600">
          Immigration with NIPTEI — one shared pipeline for preparers,
          attorneys and DOJ-accredited representatives. Clerical help only
          — not a law firm, no approval guarantee.
        </p>
      </header>
      <div className="mt-6">
        <Suspense
          fallback={
            <p className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              Loading the pipeline…
            </p>
          }
        >
          <PipelinePageClient />
        </Suspense>
      </div>
      <footer className="mt-8 text-xs text-slate-500">
        <a href="https://immigration.niptei.com" className="text-blue-700 underline">
          Back to Immigration with NIPTEI
        </a>
      </footer>
    </main>
  );
}
