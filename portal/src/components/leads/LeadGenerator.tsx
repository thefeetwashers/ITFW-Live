// Lead Generator — front page of the account: a lead-capture funnel.
// Public intake: a person who needs immigration help registers their
// enquiry and orders online (Smart Intake Calculator link for the full
// quote + an instant fee estimate from the LOCKED prices shown here).
//
// What it does NOT do: it never invents or buys lists of real people
// and never scrapes personal data — a lead exists only because that
// person filled in this form. Prices shown are the locked prices only
// (resolveQuotedFee, lib/lifecycle.ts); a service with no locked price
// says TO BE CONFIRMED and never shows a guessed number.
"use client";

import { useMemo, useState } from "react";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";
import {
  resolveQuotedFee,
  SERVICE_REQUESTED_LABELS,
  type ServiceRequested,
  type ServiceTier,
} from "@/lib/lifecycle";
import {
  BENEFICIARY_LOCATIONS,
  LEAD_URGENCIES,
  type BeneficiaryLocation,
  type LeadUrgency,
} from "@/lib/leadScoring";
import { referralLink } from "@/lib/referrals";

const SERVICE_OPTIONS = (
  Object.keys(SERVICE_REQUESTED_LABELS) as ServiceRequested[]
).map((id) => ({ id, label: SERVICE_REQUESTED_LABELS[id] }));

const TIERS: { id: ServiceTier; label: string }[] = [
  { id: "basic", label: "Basic" },
  { id: "standard", label: "Standard" },
  { id: "premium", label: "Premium" },
];

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US")}`;
}

interface LeadGeneratorProps {
  /** Provider storefront slug, when the funnel sits on /p/[slug]. */
  providerSlug?: string | null;
  /** Referral code from /r/[code] or ?ref=, when the visitor used one. */
  referralCode?: string | null;
  /** The professional's own referral code, to display their link. */
  myReferralCode?: string | null;
}

export default function LeadGenerator({
  providerSlug = null,
  referralCode = null,
  myReferralCode = null,
}: LeadGeneratorProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [service, setService] = useState<ServiceRequested>("family_bundle");
  const [tier, setTier] = useState<ServiceTier>("standard");
  const [location, setLocation] = useState<BeneficiaryLocation | "">("");
  const [documentsReady, setDocumentsReady] = useState(false);
  const [interviewDate, setInterviewDate] = useState("");
  const [urgency, setUrgency] = useState<LeadUrgency | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Instant fee estimate from the LOCKED prices only — the browser
  // never computes a price the server would not. Government fees are
  // separate and are never added to this estimate.
  const estimate = useMemo(() => resolveQuotedFee(service, tier), [service, tier]);

  async function submit() {
    setNotice(null);
    if (!fullName.trim() || !phone.trim() || !email.trim()) {
      setNotice("Name, phone and email are all required — nothing is submitted without them.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          email,
          preferredLanguage: language,
          serviceRequested: service,
          serviceTier: tier,
          beneficiaryLocation: location === "" ? null : location,
          documentsReady,
          interviewDate,
          urgency: urgency === "" ? null : urgency,
          referralCode,
          providerSlug,
        }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setNotice(
          data.error ??
            "Your enquiry could not be saved. Nothing was created — please try again."
        );
        return;
      }
      setSubmitted(true);
      setNotice(
        "Thank you — your enquiry was saved. We will contact you in your preferred language. Nothing has been filed and no fee is due yet."
      );
    } catch {
      setNotice("Could not reach the server. Nothing was submitted — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="lead-generator-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="lead-generator-heading" className="text-lg font-semibold">
        Need immigration help? Tell us what you need
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Fill in this form and we will contact you in your preferred
        language. Nothing is filed and no fee is due at this stage.
        Clerical help only — not a law firm, no approval guarantee.
      </p>

      {myReferralCode && (
        <p className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          Your referral link:{" "}
          <a
            className="font-mono text-blue-700 underline"
            href={referralLink(myReferralCode)}
          >
            {referralLink(myReferralCode)}
          </a>{" "}
          — share it and referred enquiries arrive here as leads. Referral
          reward: to be announced by the founder.
        </p>
      )}

      {submitted ? (
        <p role="status" className="mt-4 rounded border border-green-400 bg-green-50 p-3 text-sm font-medium text-green-900">
          {notice}
        </p>
      ) : (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Full name *</span>
              <input
                className="mt-1 w-full rounded border border-slate-300 p-2"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Phone / WhatsApp *</span>
              <input
                className="mt-1 w-full rounded border border-slate-300 p-2"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Email *</span>
              <input
                type="email"
                className="mt-1 w-full rounded border border-slate-300 p-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Preferred language</span>
              <select
                className="mt-1 w-full rounded border border-slate-300 p-2"
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label} ({l.native})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Service needed</span>
              <select
                className="mt-1 w-full rounded border border-slate-300 p-2"
                value={service}
                onChange={(e) => setService(e.target.value as ServiceRequested)}
              >
                {SERVICE_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Service level</span>
              <select
                className="mt-1 w-full rounded border border-slate-300 p-2"
                value={tier}
                onChange={(e) => setTier(e.target.value as ServiceTier)}
              >
                {TIERS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Where is the person who needs help?</span>
              <select
                className="mt-1 w-full rounded border border-slate-300 p-2"
                value={location}
                onChange={(e) =>
                  setLocation(e.target.value as BeneficiaryLocation | "")
                }
              >
                <option value="">Prefer not to say yet</option>
                {BENEFICIARY_LOCATIONS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Interview date (if you already have one)</span>
              <input
                type="date"
                className="mt-1 w-full rounded border border-slate-300 p-2"
                value={interviewDate}
                onChange={(e) => setInterviewDate(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">How urgent is it?</span>
              <select
                className="mt-1 w-full rounded border border-slate-300 p-2"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as LeadUrgency | "")}
              >
                <option value="">Prefer not to say yet</option>
                {LEAD_URGENCIES.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={documentsReady}
              onChange={(e) => setDocumentsReady(e.target.checked)}
            />
            My documents are ready (passport, birth / marriage certificates, photos)
          </label>

          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-medium">Instant fee estimate — preparation fee only</p>
            {estimate.amountCents !== null ? (
              <p className="mt-1">
                {formatCents(estimate.amountCents)} — {estimate.note} Government
                fees are separate and are paid directly to USCIS / the
                Department of State, never to us as part of this fee.
              </p>
            ) : (
              <p className="mt-1">{estimate.note}</p>
            )}
            <p className="mt-2">
              For the full quote with payment plans, use the{" "}
              <a className="text-blue-700 underline" href="/portal/questionnaire">
                Smart Intake Calculator
              </a>
              .
            </p>
          </div>

          {notice && (
            <p role="status" className="rounded border border-amber-400 bg-amber-50 p-3 text-sm font-medium text-amber-900">
              {notice}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send my enquiry"}
          </button>
        </form>
      )}
    </section>
  );
}
