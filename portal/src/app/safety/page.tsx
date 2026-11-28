// /safety — Safety hub for vulnerable clients.
//
// The portal had no safety hub, no VAWA/U/T page, and no quick exit
// (the public site has Quick Exit on its VAWA and U/T pages only —
// index.html:4541, 4661). This hub wires the portal into that
// protection: Quick Exit here and on every sensitive portal page,
// the emergency hotlines, the VAWA/U/T signpost (facts copied from
// the public site, full pages linked there — not duplicated), the
// scam guide, the privacy page, and the printable guide.
//
// No case detail is shown on this page. Nothing here is logged.
import type { Metadata } from "next";
import { PUBLIC_PAGE_META } from "@/lib/seo";
import Link from "next/link";
import EmergencyHelpSection from "@/components/safety/EmergencyHelpSection";
import QuickExitButton from "@/components/safety/QuickExitButton";

export const metadata: Metadata = {
  title: PUBLIC_PAGE_META["/safety"].title,
  description: PUBLIC_PAGE_META["/safety"].description,
};
import {
  PUBLIC_U_VISA_URL,
  PUBLIC_VAWA_URL,
  SAFE_BROWSING_TIPS,
  SCAM_DISCLAIMER,
  USCIS_VAWA_URL,
  VAWA_SIGNPOST,
} from "@/lib/safety";

export default function SafetyHubPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <QuickExitButton variant="fixed" />
      <header>
        <h1 className="text-2xl font-bold">Safety hub — use this site safely</h1>
        <p className="mt-1 text-sm text-slate-600">{SCAM_DISCLAIMER}</p>
      </header>

      <section
        aria-labelledby="safe-place-heading"
        className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 id="safe-place-heading" className="text-base font-semibold">
          Safe place — Quick Exit
        </h2>
        <p className="mt-1 text-sm text-slate-700">
          If someone is watching your phone, or may check it later, tap{" "}
          <strong>Quick Exit</strong>: this page disappears and Google
          opens instead, and the Back button does not bring this page
          back. Pressing the <strong>Escape</strong> key does the same.
          Quick Exit is never recorded — nobody can see that you used
          it.
        </p>
        <p className="mt-2 text-sm font-semibold text-slate-900">
          Quick Exit does NOT erase your browser history. Clear your
          history yourself, or use a private (incognito) window.
        </p>
        <div className="mt-3">
          <QuickExitButton variant="inline" />
        </div>
      </section>

      <EmergencyHelpSection />

      <section
        aria-labelledby="vawa-signpost-heading"
        className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 id="vawa-signpost-heading" className="text-lg font-semibold">
          {VAWA_SIGNPOST.heading}
        </h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-700">
          {VAWA_SIGNPOST.points.map((p) => (
            <li key={p.slice(0, 40)}>{p}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-600">{VAWA_SIGNPOST.disclaimer}</p>
        <p className="mt-3 text-sm">
          <a
            href={PUBLIC_VAWA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-700 underline"
          >
            Domestic Violence — How to Get a Green Card on Your Own (VAWA) →
          </a>{" "}
          ·{" "}
          <a
            href={PUBLIC_U_VISA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-700 underline"
          >
            U Visa &amp; T Visa — Victims of Crime &amp; Trafficking →
          </a>{" "}
          ·{" "}
          <a
            href={USCIS_VAWA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-700 underline"
          >
            USCIS — Abused Spouses, Children and Parents (VAWA) ↗
          </a>
        </p>
      </section>

      <section
        aria-labelledby="safety-guides-heading"
        className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 id="safety-guides-heading" className="text-lg font-semibold">
          Guides that protect you
        </h2>
        <ul className="mt-2 space-y-2 text-sm">
          <li>
            <Link href="/safety/scam-guide" className="font-semibold text-blue-700 underline">
              Immigration scams — how to spot them and where to report them →
            </Link>{" "}
            — notario fraud, fake job offers, fee scams, fake USCIS calls asking for gift cards or wires, and fake “expedited” promises.
          </li>
          <li>
            <Link href="/safety/privacy" className="font-semibold text-blue-700 underline">
              Your privacy — what we store, what we never store, and how to ask for deletion →
            </Link>{" "}
            — in plain language.
          </li>
          <li>
            <Link href="/safety/printable-guide" className="font-semibold text-blue-700 underline">
              Printable guide — checklist, interview prep, and what to bring →
            </Link>{" "}
            — prints cleanly from your browser.
          </li>
          <li>
            <Link href="/your-rights" className="font-semibold text-blue-700 underline">
              Your rights at the interview / at the border →
            </Link>
          </li>
        </ul>
      </section>

      <section
        aria-labelledby="safe-browsing-heading"
        className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 id="safe-browsing-heading" className="text-lg font-semibold">
          Browse safely
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {SAFE_BROWSING_TIPS.map((tip) => (
            <li key={tip.slice(0, 40)}>{tip}</li>
          ))}
        </ul>
      </section>

      <footer className="mt-8 text-xs text-slate-500">
        <Link href="/client-dashboard" className="text-blue-600 underline">
          ← Back to My Cases
        </Link>{" "}
        ·{" "}
        <Link href="/portal" className="text-blue-600 underline">
          Open the Client Portal →
        </Link>
      </footer>
    </main>
  );
}
