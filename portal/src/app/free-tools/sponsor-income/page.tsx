// /free-tools/sponsor-income — public sponsor income checker page
// (Nov 28, 2026). Thin server wrapper: metadata + the checker UI
// (src/components/free-tools/SponsorIncomeChecker.tsx), which runs
// the locked 2026 qualifier in the browser and never stores income.
import type { Metadata } from "next";
import Link from "next/link";
import ShareButtons from "@/components/free-tools/ShareButtons";
import SponsorIncomeChecker from "@/components/free-tools/SponsorIncomeChecker";
import { PUBLIC_PAGE_META, SEO_DISCLAIMER, SEO_NO_RANKING_NOTE } from "@/lib/seo";

export const metadata: Metadata = {
  title: PUBLIC_PAGE_META["/free-tools/sponsor-income"].title,
  description: PUBLIC_PAGE_META["/free-tools/sponsor-income"].description,
};

export default function SponsorIncomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm font-semibold text-niptei-blue">Immigration with NIPTEI — Free tool</p>
      <h1 className="mt-2 text-3xl font-bold text-niptei-navy">
        Sponsor income checker (Form I-864)
      </h1>
      <p className="mt-3 text-slate-700">{SEO_DISCLAIMER}</p>
      <p className="mt-2 text-sm text-slate-700">
        The Affidavit of Support asks whether the sponsor&apos;s household
        income meets 125% of the Federal Poverty Guidelines (100% for
        active-duty military). This checker uses the locked 2026 table
        from Form I-864P, effective March 1, 2026. Your income stays in
        this browser — it is never stored or sent anywhere.
      </p>
      <div className="mt-6">
        <SponsorIncomeChecker />
      </div>
      <ShareButtons
        path="/free-tools/sponsor-income"
        title="Free sponsor income checker (Form I-864) — Immigration with NIPTEI"
      />
      <p className="mt-6 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {SEO_NO_RANKING_NOTE}
      </p>
      <p className="mt-4 text-xs text-slate-500">
        <Link href="/free-tools" className="text-blue-600 underline">
          ← All free tools
        </Link>{" "}
        ·{" "}
        <Link href="/forms/I-864" className="text-blue-600 underline">
          Form I-864 →
        </Link>
      </p>
    </main>
  );
}
