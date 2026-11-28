// Per-topic landing pages — /topics/<slug> (Nov 28, 2026).
// Content comes ONLY from src/lib/seo.ts TOPIC_PAGES: groupings of
// pages that already exist (form landings from the locked catalog,
// the glossary, the free tools). A topic page adds no new claim and
// names its locked source. Unknown slug → 404 (nothing invented).
// HowTo JSON-LD only on /topics/getting-started, built from the
// existing lead-loop steps — the one topic whose steps already exist
// as content. Other topics carry no FAQ/HowTo JSON-LD: inventing
// structured data for content that does not exist yet would be
// inventing it.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  TOPIC_PAGES,
  buildHowToJsonLd,
  formLanding,
  topicLanding,
  SEO_DISCLAIMER,
  SEO_NO_RANKING_NOTE,
} from "@/lib/seo";

export function generateStaticParams() {
  return TOPIC_PAGES.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const topic = topicLanding(params.slug);
  if (!topic) return { title: "Topic not found — Immigration with NIPTEI" };
  return {
    title: `${topic.title} | Immigration with NIPTEI`,
    description: topic.description,
  };
}

export default function TopicPage({ params }: { params: { slug: string } }) {
  const topic = topicLanding(params.slug);
  if (!topic) notFound();
  const howToJsonLd = topic.slug === "getting-started" ? buildHowToJsonLd() : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {howToJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
        />
      )}
      <p className="text-sm font-semibold text-niptei-blue">Immigration with NIPTEI</p>
      <h1 className="mt-2 text-3xl font-bold text-niptei-navy">{topic.title}</h1>
      <p className="mt-3 text-slate-700">{topic.description}</p>
      <p className="mt-3 text-slate-700">{SEO_DISCLAIMER}</p>

      {topic.formCodes.length > 0 && (
        <section aria-label="Forms" className="mt-6 rounded border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">Forms in this topic</h2>
          <ul className="mt-2 space-y-2">
            {topic.formCodes.map((code) => {
              const landing = formLanding(code);
              if (!landing) return null;
              return (
                <li key={code} className="text-sm">
                  <Link href={`/forms/${code}`} className="font-semibold text-blue-700 underline">
                    Form {landing.formCode} — {landing.name} →
                  </Link>{" "}
                  <span className="text-slate-600">
                    Preparation fee: {landing.serviceFeeText}. {landing.governmentFeeNote}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-label="More" className="mt-4 rounded border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">More on this topic</h2>
        <ul className="mt-2 space-y-2">
          {topic.related.map((r) => (
            <li key={r.href} className="text-sm">
              <Link href={r.href} className="font-semibold text-blue-700 underline">
                {r.label} →
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">Source: {topic.source}</p>
      </section>

      <p className="mt-6">
        <Link
          href="/leads"
          className="inline-block rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Ask for help with this topic →
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
