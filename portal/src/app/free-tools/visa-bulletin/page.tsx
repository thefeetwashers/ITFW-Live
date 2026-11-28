// /free-tools/visa-bulletin — public Visa Bulletin date checker page
// (Nov 28, 2026). Thin server wrapper: metadata + the checker UI
// (src/components/free-tools/VisaBulletinChecker.tsx), which runs
// the existing matcher in the browser. No cutoff dates are stored
// on the platform — the visitor enters the cutoff from the official
// bulletin, and the result always says to verify it there.
import type { Metadata } from "next";
import Link from "next/link";
import ShareButtons from "@/components/free-tools/ShareButtons";
import VisaBulletinChecker from "@/components/free-tools/VisaBulletinChecker";
import { PUBLIC_PAGE_META, SEO_DISCLAIMER, SEO_NO_RANKING_NOTE } from "@/lib/seo";

export const metadata: Metadata = {
  title: PUBLIC_PAGE_META["/free-tools/visa-bulletin"].title,
  description: PUBLIC_PAGE_META["/free-tools/visa-bulletin"].description,
};

export default function VisaBulletinPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm font-semibold text-niptei-blue">Immigration with NIPTEI — Free tool</p>
      <h1 className="mt-2 text-3xl font-bold text-niptei-navy">Visa Bulletin date checker</h1>
      <p className="mt-3 text-slate-700">{SEO_DISCLAIMER}</p>
      <p className="mt-2 text-sm text-slate-700">
        Is your priority date current? This checker compares it with the
        cutoff from the official Visa Bulletin for the month you pick.
        We store no cutoff dates here — you enter the cutoff straight
        from the bulletin at travel.state.gov, and the result tells you
        to verify it there before filing. Your priority date never
        leaves this browser.
      </p>
      <div className="mt-6">
        <VisaBulletinChecker />
      </div>
      <ShareButtons
        path="/free-tools/visa-bulletin"
        title="Free Visa Bulletin date checker — Immigration with NIPTEI"
      />
      <p className="mt-6 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {SEO_NO_RANKING_NOTE}
      </p>
      <p className="mt-4 text-xs text-slate-500">
        <Link href="/free-tools" className="text-blue-600 underline">
          ← All free tools
        </Link>{" "}
        ·{" "}
        <Link href="/journey" className="text-blue-600 underline">
          Your journey →
        </Link>
      </p>
    </main>
  );
}
