import Link from "next/link";
import {
  buildFaqJsonLd,
  buildOrganizationJsonLd,
  SEO_NO_RANKING_NOTE,
} from "@/lib/seo";

export default function HomePage() {
  const orgJsonLd = buildOrganizationJsonLd();
  const faqJsonLd = buildFaqJsonLd();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <p className="text-sm font-semibold text-niptei-blue">
        Immigration with NIPTEI
      </p>
      <h1 className="mt-2 text-3xl font-bold text-niptei-navy">
        Client Portal, Onboarding &amp; Verification
      </h1>
      <p className="mt-3 text-slate-700">
        Immigration with NIPTEI is a document-preparation service, not a law
        firm, and is not affiliated with USCIS or the Department of State. We
        do not guarantee approval. Only a licensed attorney or a
        DOJ-Accredited Representative can give legal advice or represent you.
      </p>
      <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
        Example data on these screens is labelled EXAMPLE. The database and
        payments are connected. Email login codes are not set up yet, so
        sign-in by email code cannot send a code until email is connected.
      </p>
      <ul className="mt-6 space-y-3">
        <li>
          <Link
            href="/portal"
            className="block rounded border border-slate-300 bg-white px-4 py-3 font-semibold hover:border-niptei-blue"
          >
            Client Portal — My Case: Form I-130 →
          </Link>
        </li>
        <li>
          <Link
            href="/onboarding"
            className="block rounded border border-slate-300 bg-white px-4 py-3 font-semibold hover:border-niptei-blue"
          >
            Step 1 — Choose your role →
          </Link>
        </li>
        <li>
          <Link
            href="/leads"
            className="block rounded border border-slate-300 bg-white px-4 py-3 font-semibold hover:border-niptei-blue"
          >
            Get immigration help — tell us what you need →
          </Link>
        </li>
        <li>
          <Link
            href="/journey"
            className="block rounded border border-slate-300 bg-white px-4 py-3 font-semibold hover:border-niptei-blue"
          >
            Your Journey — first question to green card in hand →
          </Link>
        </li>
        <li>
          <Link
            href="/professionals"
            className="block rounded border border-slate-300 bg-white px-4 py-3 font-semibold hover:border-niptei-blue"
          >
            Find a verified professional →
          </Link>
        </li>
        <li>
          <Link
            href="/admin/verifications"
            className="block rounded border border-slate-300 bg-white px-4 py-3 font-semibold hover:border-niptei-blue"
          >
            Admin — Verification queue (Founder / Admin only) →
          </Link>
        </li>
      </ul>
      <p className="mt-6 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {SEO_NO_RANKING_NOTE}
      </p>
      <p className="mt-6 text-sm text-slate-600">
        Contact: nipteiapp@gmail.com · (772) 971-6129
      </p>
    </main>
  );
}
