// /your-rights — your rights at the interview / at the border.
// ---------------------------------------------------------------------------
// Honest information page, educational only — NOT legal advice, NOT
// USCIS. The interview half is sourced from the platform's own
// interview preparation (src/lib/interviewPrep.ts: the conduct guide,
// what the officer looks for, what to bring, and the no-guarantee
// notice). The border half is honest about what this platform does
// NOT hold: there is no locked border-encounter guidance in the
// codebase, so it gives only general pointers and sends the reader
// to a licensed attorney or DOJ-accredited representative and to the
// official sources — it never invents a border rule or a safe
// answer for a specific encounter. Anything that needs a decision
// about a real encounter goes to an attorney.
import type { Metadata } from "next";
import { PUBLIC_PAGE_META } from "@/lib/seo";
import Link from "next/link";
import EmergencyHelpSection from "@/components/safety/EmergencyHelpSection";
import QuickExitButton from "@/components/safety/QuickExitButton";

export const metadata: Metadata = {
  title: PUBLIC_PAGE_META["/your-rights"].title,
  description: PUBLIC_PAGE_META["/your-rights"].description,
};
import {
  CONDUCT_GUIDE,
  NO_GUARANTEE_NOTICE,
  WHAT_OFFICER_LOOKS_FOR,
  WHAT_TO_BRING,
} from "@/lib/interviewPrep";

const DISCLAIMER =
  "Educational information only, not legal advice. Immigration with NIPTEI is a document-preparation service, not a law firm, and is not USCIS. Only a licensed attorney or DOJ-accredited representative gives legal advice (8 CFR 292.1).";

export default function YourRightsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* Quick Exit (Nov 28, 2026): this is a sensitive page — a
          client reading about their rights may be in danger. One tap
          (or Escape) leaves for Google; it is never logged. */}
      <QuickExitButton variant="fixed" />
      <header>
        <h1 className="text-2xl font-bold">
          Your rights at the interview / at the border
        </h1>
        <p className="mt-2 text-sm text-slate-600">{DISCLAIMER}</p>
        <p className="mt-2 text-sm">
          <Link href="/portal" className="text-blue-700 underline">
            ← Back to the portal
          </Link>
          {" · "}
          <Link href="/glossary" className="text-blue-700 underline">
            Glossary →
          </Link>
          {" · "}
          <Link href="/fee-waiver" className="text-blue-700 underline">
            Fee-waiver (I-912) checklist →
          </Link>
        </p>
      </header>

      {/* Emergency help (Nov 28, 2026): hotlines on this sensitive
          page, and a link to the Safety hub for Quick Exit, scam
          warnings, privacy, and the printable guide. */}
      <EmergencyHelpSection />

      <section aria-labelledby="interview-rights" className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 id="interview-rights" className="text-lg font-semibold">
          At the interview
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Source: this platform&apos;s Interview Prep (from official USCIS
          guidance — see the source on each item there). Your
          appointment notice lists exactly what to bring to YOUR
          interview and overrides any general list.
        </p>
        <h3 className="mt-4 text-sm font-semibold">{CONDUCT_GUIDE.heading}</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {CONDUCT_GUIDE.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <h3 className="mt-4 text-sm font-semibold">{WHAT_OFFICER_LOOKS_FOR.heading}</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {WHAT_OFFICER_LOOKS_FOR.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <h3 className="mt-4 text-sm font-semibold">What to bring</h3>
        {WHAT_TO_BRING.map((g) => (
          <div key={g.interviewType} className="mt-2">
            <p className="text-sm font-semibold">{g.interviewType}</p>
            <p className="text-sm text-slate-600">{g.checkFirst}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {g.items.map((i) => (
                <li key={i.item}>
                  {i.item} — {i.why}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="mt-4 text-sm font-semibold">
          You may be represented.{" "}
          <span className="font-normal">
            You can have a licensed attorney or DOJ-accredited
            representative with you. Find one on the DOJ recognition
            and accreditation roster at{" "}
            <a
              href="https://www.justice.gov/eoir/recognition-and-accreditation-program"
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 underline"
            >
              justice.gov/eoir
            </a>
            . If you are unsure about a fact in your past, talk to an
            attorney BEFORE the interview.
          </span>
        </p>
        <p className="mt-2 text-sm text-slate-600">{NO_GUARANTEE_NOTICE}</p>
      </section>

      <section aria-labelledby="border-rights" className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 id="border-rights" className="text-lg font-semibold">
          At the border
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          This platform holds no locked guidance about border
          encounters — no border rule is printed here, because none is
          in the platform&apos;s locked content. Do not treat this
          section as instructions for a specific encounter.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>
            Do not travel or leave the United States without advice
            first. This platform never decides whether it is safe to
            travel or safe to leave — that question goes to a licensed
            attorney or DOJ-accredited representative.
          </li>
          <li>
            Keep your immigration documents with you when you travel,
            and keep your address updated with USCIS (Form AR-11) so
            letters reach you.
          </li>
          <li>
            If you are stopped or questioned, you can ask to speak to
            a licensed attorney or DOJ-accredited representative, ask
            for an interpreter if you need one, and ask for anything
            you are asked to sign to be explained to you first.
          </li>
          <li>
            Tell the truth. Do not sign a paper you do not understand,
            and do not guess an answer — say you do not know, and ask
            for your representative.
          </li>
        </ul>
        <p className="mt-2 text-sm text-slate-600">
          Official sources:{" "}
          <a href="https://www.uscis.gov" target="_blank" rel="noreferrer" className="text-blue-700 underline">
            uscis.gov
          </a>{" "}
          ·{" "}
          <a href="https://www.justice.gov/eoir" target="_blank" rel="noreferrer" className="text-blue-700 underline">
            justice.gov/eoir
          </a>{" "}
          ·{" "}
          <a href="https://travel.state.gov" target="_blank" rel="noreferrer" className="text-blue-700 underline">
            travel.state.gov
          </a>
          . For a specific encounter, ask an attorney — this page
          cannot answer it.
        </p>
      </section>
    </main>
  );
}
