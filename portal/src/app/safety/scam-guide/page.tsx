// /safety/scam-guide — plain-language immigration-scam guide.
// Sensitive-adjacent page: Quick Exit is pinned top-right.
import type { Metadata } from "next";
import { PUBLIC_PAGE_META } from "@/lib/seo";
import Link from "next/link";
import QuickExitButton from "@/components/safety/QuickExitButton";
import ScamGuideSection from "@/components/safety/ScamGuideSection";

export const metadata: Metadata = {
  title: PUBLIC_PAGE_META["/safety/scam-guide"].title,
  description: PUBLIC_PAGE_META["/safety/scam-guide"].description,
};

export default function ScamGuidePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <QuickExitButton variant="fixed" />
      <header>
        <h1 className="text-2xl font-bold">
          Immigration scams — how to spot them and where to report them
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          If someone is watching your screen, use Quick Exit (top right,
          or press Escape) to leave this page at once.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/safety" className="text-blue-700 underline">
            ← Back to the Safety hub
          </Link>
        </p>
      </header>
      <ScamGuideSection />
      <footer className="no-print mt-8 text-xs text-slate-500">
        <Link href="/safety" className="text-blue-600 underline">
          ← Back to the Safety hub
        </Link>
      </footer>
    </main>
  );
}
