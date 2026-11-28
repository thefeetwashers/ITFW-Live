import type { Metadata } from "next";
import PreparerDashboard from "@/components/preparer/PreparerDashboard";
import RoleCheatsheet from "@/components/cheatsheets/RoleCheatsheet";
import { getSupabase } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Document Preparer Command Center — Immigration with NIPTEI",
  description:
    "Preparer-only command center: client identity, billing pipeline, USCIS & NVC case number hub, family invites, and clerical compliance guardrails. Clerical help only — not a law firm.",
};

export default function PreparerDashboardPage() {
  // getSupabase() returns null when env vars are unset — the page then
  // shows example data only and never claims a live login, sync, or
  // payment.
  const live = getSupabase() !== null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">
          Document Preparer Command Center
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Immigration with NIPTEI — preparer role only. Clerical /
          educational help only; not a law firm, not affiliated with
          USCIS, no approval guarantee. Only a licensed attorney or
          DOJ-Accredited Representative gives legal advice or represents
          a client (8 CFR 292.1).
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Immigration with NIPTEI · nipteiapp@gmail.com · (772) 971-6129
        </p>
      </header>

      {!live && (
        <p
          role="status"
          className="mt-4 rounded border border-amber-400 bg-amber-50 p-3 text-sm font-medium text-amber-900"
        >
          Example data — not live. Supabase is not connected, so no live
          login, sync, or payment is claimed on this page.
        </p>
      )}
      {live && (
        <p
          role="status"
          className="mt-4 rounded border border-green-400 bg-green-50 p-3 text-sm font-medium text-green-900"
        >
          Supabase is configured. Example rows below are still labelled
          example until live case data is wired in.
        </p>
      )}

      <div className="mt-6">
        <RoleCheatsheet role="preparer" compact />
      </div>

      <div className="mt-6">
        <PreparerDashboard />
      </div>

      <footer className="mt-8 text-xs text-slate-500">
        <a href="https://immigration.niptei.com" className="text-blue-700 underline">
          Back to Immigration with NIPTEI
        </a>
      </footer>
    </main>
  );
}
