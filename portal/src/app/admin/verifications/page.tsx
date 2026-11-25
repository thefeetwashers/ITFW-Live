"use client";

import { useMemo } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import VerificationQueue from "@/components/admin/VerificationQueue";

export default function AdminVerificationsPage() {
  const supabaseLive = useMemo(() => getSupabase() !== null, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Verification Queue — Founder / Admin only
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Review attorney and DOJ-Accredited Nonprofit submissions. Questions?
          Email{" "}
          <a
            className="text-blue-600 underline"
            href="mailto:nipteiapp@gmail.com"
          >
            nipteiapp@gmail.com
          </a>{" "}
          or call{" "}
          <a className="text-blue-600 underline" href="tel:+17729716129">
            (772) 971-6129
          </a>
          .
        </p>
      </header>

      {!supabaseLive && (
        <p className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Example data — not live. Supabase is not connected in this build.
        </p>
      )}
      <p className="mb-6 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Immigration with NIPTEI is not a law firm and is not affiliated with
        USCIS. We provide clerical and educational help only — no approval is
        guaranteed. Only a licensed attorney or a DOJ-Accredited Representative
        can give legal advice or represent a client (8 CFR 292.1).
      </p>

      <VerificationQueue />

      <footer className="mt-8 text-xs text-slate-500">
        <Link href="/" className="text-blue-600 underline">
          ← Back to home
        </Link>
      </footer>
    </main>
  );
}
