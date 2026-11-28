// /free-tools — the public free-tools hub (Nov 28, 2026).
//
// One page gathering all five free lead magnets, each with a
// one-line description and a call-to-action, reusing the existing
// tools (src/lib/freeTools.ts FREE_TOOLS). No tool is rebuilt here.
// ?ref= / ?provider= are preserved into every tool link, so a
// visitor who arrived on a referral or storefront link keeps that
// routing for the optional follow-up capture (/api/leads refuses
// without a professional — see src/lib/freeTools.ts).
// HowTo JSON-LD comes from the existing lead-loop steps
// (src/lib/seo.ts buildHowToJsonLd). The SEO note and the honest
// lead-finding boundary are shown on the page, not buried.
import type { Metadata } from "next";
import Link from "next/link";
import ShareButtons from "@/components/free-tools/ShareButtons";
import { FREE_TOOLS } from "@/lib/freeTools";
import { LEAD_BOUNDARY_NOTE } from "@/lib/leadLoop";
import {
  PUBLIC_PAGE_META,
  SEO_NO_RANKING_NOTE,
  buildHowToJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: PUBLIC_PAGE_META["/free-tools"].title,
  description: PUBLIC_PAGE_META["/free-tools"].description,
};

function withRouting(href: string, ref: string | null, provider: string | null): string {
  const params = new URLSearchParams();
  if (ref) params.set("ref", ref);
  if (provider) params.set("provider", provider);
  const q = params.toString();
  return q ? `${href}?${q}` : href;
}

export default function FreeToolsPage({
  searchParams,
}: {
  searchParams?: { ref?: string; provider?: string };
}) {
  const ref = searchParams?.ref ?? null;
  const provider = searchParams?.provider ?? null;
  const howToJsonLd = buildHowToJsonLd();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <p className="text-sm font-semibold text-niptei-blue">Immigration with NIPTEI</p>
      <h1 className="mt-2 text-3xl font-bold text-niptei-navy">Free tools — check first, pay nothing to try</h1>
      <p className="mt-3 text-slate-700">
        Five free tools. Each one answers a real question before you spend
        anything — and each one ends with the same offer: tell us what you
        need, and we will contact you once about it. No tool here decides
        eligibility or promises an approval. Immigration with NIPTEI is a
        document-preparation service, not a law firm, and is not affiliated
        with USCIS or the Department of State.
      </p>

      <ul className="mt-6 space-y-4">
        {FREE_TOOLS.map((tool) => (
          <li
            key={tool.id}
            className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
          >
            <h2 className="text-base font-semibold">{tool.title}</h2>
            <p className="mt-1 text-sm text-slate-700">{tool.oneLine}</p>
            {tool.limit && (
              <p className="mt-1 text-xs text-slate-500">{tool.limit}</p>
            )}
            <p className="mt-3">
              <Link
                href={withRouting(tool.href, ref, provider)}
                className="inline-block rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                {tool.cta}
              </Link>
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-sm text-slate-700">
        Finished a tool and want help with the next step?{" "}
        <Link href={withRouting("/leads", ref, provider)} className="text-blue-700 underline">
          Get immigration help — tell us what you need →
        </Link>{" "}
        or{" "}
        <Link href="/professionals" className="text-blue-700 underline">
          find a verified professional →
        </Link>
      </p>

      <ShareButtons path="/free-tools" title="Free immigration tools — Immigration with NIPTEI" />

      <p className="mt-6 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {SEO_NO_RANKING_NOTE}
      </p>
      <p className="mt-4 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {LEAD_BOUNDARY_NOTE}
      </p>
      <p className="mt-4 text-xs text-slate-500">
        <Link href="/" className="text-blue-600 underline">
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
