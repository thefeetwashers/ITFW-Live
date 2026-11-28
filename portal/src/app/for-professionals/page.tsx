// Public professional landing page — /for-professionals.
// Why join, flat locked prices, verification process, BYO tools,
// honest empty states. Leads to /register (professional roles) and
// to the verified directory /professionals. No professional is
// invented here: prices come from the locked Stripe map, the
// directory link shows real verified professionals only, and when
// none are listed the directory shows its honest empty state.
import type { Metadata } from "next";
import { PUBLIC_PAGE_META } from "@/lib/seo";
import Link from "next/link";
import {
  PRO_LANDING_HEADLINE,
  PRO_LANDING_SUBHEAD,
  VERIFICATION_STEPS,
  WHY_JOIN,
  formatFlatPrice,
  proSubscriptionPrices,
} from "@/lib/proDiscovery";
import { GOOGLE_SETUP_NOT_DONE_NOTE } from "@/lib/googleIntegrations";
import { REFERRAL_REWARD_LABEL } from "@/lib/referrals";

export const metadata: Metadata = {
  title: PUBLIC_PAGE_META["/for-professionals"].title,
  description: PUBLIC_PAGE_META["/for-professionals"].description,
};

export default function ForProfessionalsPage() {
  const prices = proSubscriptionPrices();
  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-bold">{PRO_LANDING_HEADLINE}</h1>
        <p className="mt-1 text-sm text-slate-600">{PRO_LANDING_SUBHEAD}</p>
        <p className="mt-2 text-sm text-slate-600">
          Immigration with NIPTEI is a document-preparation service, not a
          law firm, not affiliated with USCIS. Only a licensed attorney or
          DOJ-accredited representative gives legal advice (8 CFR 292.1).
          Preparers give clerical help only.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/register"
            className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white"
          >
            Register as a professional →
          </Link>
          <Link
            href="/professionals"
            className="rounded border border-blue-700 px-4 py-2 text-sm font-medium text-blue-700"
          >
            See the verified directory →
          </Link>
        </div>

        <section aria-labelledby="why-join-heading" className="mt-6">
          <h2 id="why-join-heading" className="text-base font-semibold">
            Why join
          </h2>
          <ul className="mt-2 space-y-3">
            {WHY_JOIN.map((w) => (
              <li
                key={w.title}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <h3 className="font-semibold">{w.title}</h3>
                <p className="mt-1 text-sm text-slate-700">{w.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="prices-heading" className="mt-6">
          <h2 id="prices-heading" className="text-base font-semibold">
            Flat locked prices — monthly subscription
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            These prices are locked. The platform never takes a percentage
            of your fees and never charges per lead. Government (USCIS /
            NVC) fees are always separate.
          </p>
          <ul className="mt-2 space-y-2">
            {prices.map((p) => (
              <li
                key={p.role}
                className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm"
              >
                <span className="font-medium">{p.role}: </span>
                {formatFlatPrice(p.price)}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="verification-heading" className="mt-6">
          <h2 id="verification-heading" className="text-base font-semibold">
            How verification works
          </h2>
          <ol className="mt-2 space-y-2">
            {VERIFICATION_STEPS.map((s) => (
              <li
                key={s.step}
                className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm"
              >
                <span className="font-medium">
                  Step {s.step} — {s.title}:{" "}
                </span>
                {s.detail}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-sm text-slate-600">
            No one is listed until they are verified, published, and on an
            active subscription. Unverified profiles are never shown.
          </p>
        </section>

        <section aria-labelledby="byo-heading" className="mt-6">
          <h2 id="byo-heading" className="text-base font-semibold">
            Your own tools (BYO)
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            Connect your own Twilio (SMS / WhatsApp), Resend or AWS SES
            (email), Stripe (payments), calendar, and e-signature accounts
            from your dashboard. The platform never holds your clients&apos;
            money or messages. {GOOGLE_SETUP_NOT_DONE_NOTE} Google sign-in
            itself is separate: it works through Supabase Auth, with a
            6-digit email code still required after Google on every login.
          </p>
          <p className="mt-1 text-sm text-slate-700">{REFERRAL_REWARD_LABEL}.</p>
        </section>

        <p className="mt-6 text-sm">
          <Link href="/register" className="text-blue-700 underline">
            Register as a professional →
          </Link>{" "}
          or{" "}
          <Link href="/professionals" className="text-blue-700 underline">
            browse the verified directory
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
