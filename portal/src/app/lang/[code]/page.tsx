// Per-language landing pages — /lang/<code> (Nov 28, 2026).
// One page per supported language (src/lib/i18n.ts LANGUAGES).
// Content comes ONLY from src/lib/seo.ts LANGUAGE_PAGES: the
// language name, the locked "I speak …" line, and links to the
// intake form, the free tools, and the form landings. The page
// states plainly that help is offered in that language and that
// translations of individual strings appear only where a locked
// translation exists — otherwise English is shown with the note
// "Translation pending — shown in English"
// (src/lib/lockedTranslations.ts). No translated copy is invented,
// and no hreflang is emitted until a real translated version of a
// page exists. Unknown code → 404 (nothing invented).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allFormLandings, languageLanding, LANGUAGE_PAGES, SEO_DISCLAIMER, SEO_NO_RANKING_NOTE } from "@/lib/seo";
import { TRANSLATION_PENDING_NOTE } from "@/lib/lockedTranslations";

export function generateStaticParams() {
  return LANGUAGE_PAGES.map((l) => ({ code: l.code }));
}

export async function generateMetadata({
  params,
}: {
  params: { code: string };
}): Promise<Metadata> {
  const lang = languageLanding(params.code);
  if (!lang) return { title: "Language not found — Immigration with NIPTEI" };
  return { title: lang.title, description: lang.description };
}

export default function LanguagePage({ params }: { params: { code: string } }) {
  const lang = languageLanding(params.code);
  if (!lang) notFound();
  const forms = allFormLandings();
  const isEnglish = lang.code === "en";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10" lang={lang.code}>
      <p className="text-sm font-semibold text-niptei-blue">Immigration with NIPTEI</p>
      <h1 className="mt-2 text-3xl font-bold text-niptei-navy">
        Immigration help in {lang.label} ({lang.native})
      </h1>
      <p className="mt-3 text-lg font-semibold">{lang.spokenLine}</p>
      <p className="mt-3 text-slate-700">{lang.description}</p>
      <p className="mt-3 text-slate-700">{SEO_DISCLAIMER}</p>
      {!isEnglish && (
        <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {TRANSLATION_PENDING_NOTE} for the pages below: each page is shown
          in English with its locked translation where one exists. A human
          must confirm before anyone acts on a quote, contract, price, or
          deadline.
        </p>
      )}

      <section aria-label="Forms" className="mt-6 rounded border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Forms we prepare</h2>
        <ul className="mt-2 space-y-2">
          {forms.map((f) => (
            <li key={f.formCode} className="text-sm">
              <Link href={`/forms/${f.formCode}`} className="font-semibold text-blue-700 underline">
                Form {f.formCode} — {f.name} →
              </Link>{" "}
              <span className="text-slate-600">Preparation fee: {f.serviceFeeText}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-6">
        <Link
          href="/leads"
          className="inline-block rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Get help in {lang.label} →
        </Link>{" "}
        <Link
          href="/free-tools"
          className="inline-block rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800"
        >
          Try the free tools →
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
