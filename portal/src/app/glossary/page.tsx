// /glossary — plain-language glossary of immigration terms.
// Server component: renders src/lib/glossary.ts, which is sourced
// from the codebase + the official site named on each entry.
// Educational information only, not legal advice.
import type { Metadata } from "next";
import { PUBLIC_PAGE_META } from "@/lib/seo";
import Link from "next/link";
import { GLOSSARY, GLOSSARY_DISCLAIMER } from "@/lib/glossary";

export const metadata: Metadata = {
  title: PUBLIC_PAGE_META["/glossary"].title,
  description: PUBLIC_PAGE_META["/glossary"].description,
};

export default function GlossaryPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">Glossary — immigration words, in plain language</h1>
        <p className="mt-2 text-sm text-slate-600">
          Every term below is already defined or used in this platform&apos;s
          own guides, explained in plain language, with the official
          source that publishes it. {GLOSSARY_DISCLAIMER}
        </p>
        <p className="mt-2 text-sm">
          <Link href="/portal" className="text-blue-700 underline">
            ← Back to the portal
          </Link>
          {" · "}
          <Link href="/your-rights" className="text-blue-700 underline">
            Your rights at the interview / at the border →
          </Link>
          {" · "}
          <Link href="/fee-waiver" className="text-blue-700 underline">
            Fee-waiver (I-912) checklist →
          </Link>
        </p>
      </header>
      <dl className="mt-6 space-y-4">
        {GLOSSARY.map((g) => (
          <div key={g.term} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <dt className="text-base font-semibold">{g.term}</dt>
            <dd className="mt-1 text-sm text-slate-700">{g.definition}</dd>
            <dd className="mt-2 text-xs text-slate-500">
              Defined or used in: {g.definedIn}. Source:{" "}
              <a href={g.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                {g.sourceLabel}
              </a>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-xs text-slate-500">
        Ask NIPTEI in the chat can also define a word for you — ask
        “what does RFE mean?” and it answers from this glossary, with
        the same source. A definition is not legal advice.
      </p>
    </main>
  );
}
