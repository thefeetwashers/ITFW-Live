// Per-form landing pages — /forms/<code>.
// Content comes ONLY from the locked form catalog (src/lib/seo.ts
// formLanding(), built from src/lib/bundles.ts): form name, locked
// service-fee range or "TO BE CONFIRMED", the locked USCIS fee note,
// and the checklist. No invented claims, no invented reviews, no
// invented processing times. SEO note included: findable does not mean
// a guaranteed ranking.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  allFormLandings,
  buildFaqJsonLd,
  formLanding,
  SEO_DISCLAIMER,
  SEO_NO_RANKING_NOTE,
} from "@/lib/seo";

export function generateStaticParams() {
  return allFormLandings().map((f) => ({ code: f.formCode }));
}

export async function generateMetadata({
  params,
}: {
  params: { code: string };
}): Promise<Metadata> {
  const landing = formLanding(params.code);
  if (!landing) return { title: "Form not found — Immigration with NIPTEI" };
  return {
    title: landing.title,
    description: landing.description,
  };
}

export default function FormLandingPage({ params }: { params: { code: string } }) {
  const landing = formLanding(params.code);
  if (!landing) notFound();
  const faqJsonLd = buildFaqJsonLd();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <p className="text-sm font-semibold text-niptei-blue">
        Immigration with NIPTEI
      </p>
      <h1 className="mt-2 text-3xl font-bold text-niptei-navy">
        Form {landing.formCode} — {landing.name}
      </h1>
      <p className="mt-3 text-slate-700">{SEO_DISCLAIMER}</p>

      <section
        aria-label="Fees"
        className="mt-6 rounded border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 className="text-base font-semibold">Fees — shown separately</h2>
        <p className="mt-2 text-sm">
          Preparation fee: <strong>{landing.serviceFeeText}</strong>
          {landing.feeLocked
            ? ""
            : " — no locked service fee for this form yet; your written quote confirms it before you pay anything."}
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Government fee: {landing.governmentFeeNote}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Our preparation fee and the USCIS / government fee are always
          separate — never combined into one total.
        </p>
      </section>

      <section
        aria-label="Documents"
        className="mt-4 rounded border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 className="text-base font-semibold">
          Documents we will ask for ({landing.checklistCount})
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {landing.checklistLabels.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          This is the checklist from the locked form catalog. Your
          provider confirms which items apply to your case — nothing is
          filed until you have read every draft and signed it.
        </p>
      </section>

      <p className="mt-6">
        <Link
          href="/leads"
          className="inline-block rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Ask for help with Form {landing.formCode} →
        </Link>{" "}
        <Link
          href="/professionals"
          className="inline-block rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800"
        >
          Find a verified professional →
        </Link>
      </p>

      <p className="mt-6 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {SEO_NO_RANKING_NOTE}
      </p>
      <p className="mt-4 text-xs text-slate-500">
        <Link href="/" className="text-blue-600 underline">
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
