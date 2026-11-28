// /safety/printable-guide — printable checklist, interview prep,
// and what-to-bring. Renders cleanly for printing via the browser
// (window.print + print CSS in src/app/globals.css). No PDF
// generator. What-to-bring and interview conduct are REUSED from
// src/lib/interviewPrep.ts, not rewritten. Sensitive page: Quick
// Exit pinned top-right (hidden when printing).
import type { Metadata } from "next";
import { PUBLIC_PAGE_META } from "@/lib/seo";
import Link from "next/link";
import PrintableGuideSection from "@/components/safety/PrintableGuideSection";
import QuickExitButton from "@/components/safety/QuickExitButton";

export const metadata: Metadata = {
  title: PUBLIC_PAGE_META["/safety/printable-guide"].title,
  description: PUBLIC_PAGE_META["/safety/printable-guide"].description,
};

export default function PrintableGuidePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <QuickExitButton variant="fixed" />
      <header className="no-print">
        <h1 className="text-2xl font-bold">
          Printable guide — checklist, interview prep, and what to bring
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Print this page and keep it with your papers. Your
          appointment notice lists exactly what to bring to YOUR
          interview and overrides any general list here.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/safety" className="text-blue-700 underline">
            ← Back to the Safety hub
          </Link>
        </p>
      </header>
      <PrintableGuideSection />
      <footer className="no-print mt-8 text-xs text-slate-500">
        <Link href="/safety" className="text-blue-600 underline">
          ← Back to the Safety hub
        </Link>
      </footer>
    </main>
  );
}
