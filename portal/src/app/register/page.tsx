"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import LanguagePicker from "@/components/LanguagePicker";
import { getSupabase } from "@/lib/supabase";
import RoleForms, { type RoleId } from "@/components/onboarding/RoleForms";
import CheckoutSummary from "@/components/onboarding/CheckoutSummary";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import type { OnboardingStatus } from "@/components/onboarding/OnboardingProgress";

// Step 1 Register — exactly 6 locked roles. No role is pre-selected and
// the form cannot continue until one is chosen. Founder / Admin is NOT a
// register role here: admin accounts are created by the founder (no
// self-registration) — founders log in at /login.
const ROLES: {
  id: RoleId;
  title: string;
  blurb: string;
}[] = [
  {
    id: "client",
    title: "Client",
    blurb: "I need help with my immigration paperwork. Free — $0.",
  },
  {
    id: "preparer",
    title: "Document Preparer",
    blurb: "Free to register · $49/mo to be listed & use Back Office. UPL agreement required.",
  },
  {
    id: "attorney",
    title: "Licensed Immigration Attorney",
    blurb: "Free to register · $99/mo. Bar # + jurisdiction required.",
  },
  {
    id: "nonprofit",
    title: "DOJ-Accredited Nonprofit",
    blurb: "Free to register · 50% off — Standard $24.50/mo / Full $49.50/mo. Org name + DOJ recognition date + accreditation tier required.",
  },
  {
    id: "student",
    title: "Law Student — Supervised Only",
    blurb: "Free to register · $35/mo. No % / case / lead fees. Law school, year, supervisor name + email, student rules agreed.",
  },
  {
    id: "teacher",
    title: "Teacher / Clinic Director",
    blurb: "Free — no fee. Confirm your law students once a founder approves your account.",
  },
];

export default function RegisterPage() {
  const supabaseLive = useMemo(() => getSupabase() !== null, []);
  const [role, setRole] = useState<RoleId | null>(null);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const selectRole = (id: RoleId) => {
    setRole(id);
    setFormSubmitted(false);
    setNote(null);
  };

  const handleComplete = (_status: OnboardingStatus, message: string) => {
    setFormSubmitted(true);
    setNote(message);
  };

  const selected = ROLES.find((r) => r.id === role);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Register — Immigration with NIPTEI
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Step 1 — choose your role, complete the form, and review your
            checkout summary. Questions? Email{" "}
            <a
              className="text-blue-600 underline"
              href="mailto:nipteiapp@gmail.com"
            >
              nipteiapp@gmail.com
            </a>{" "}
            or call{" "}
            <a className="text-blue-600 underline" href="tel:+17729716129">
              (772) 971-6129
            </a>
            .
          </p>
          <p className="mt-2 text-sm">
            <Link href="/onboarding" className="text-blue-600 underline">
              Already started? Continue onboarding →
            </Link>
          </p>
        </div>
        <LanguagePicker />
      </header>

      {!supabaseLive && (
        <p className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Example data — not live. Supabase is not connected in this build.
        </p>
      )}
      <p className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Registration posts to <code>/api/register-role</code> (Supabase Auth +
        <code> public.accounts</code> / <code>professional_profiles</code> /
        <code>student_profiles</code>). Until Supabase is connected that route
        returns 501 and no account is created. Paid roles route to Stripe
        Checkout only once Stripe is connected — nothing is charged here.
      </p>
      <p className="mb-6 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Immigration with NIPTEI is not a law firm and is not affiliated with
        USCIS. We provide clerical and educational help only — no approval is
        guaranteed. Only a licensed attorney or a DOJ-Accredited Representative
        can give legal advice or represent you (8 CFR 292.1).
      </p>

      {/* Google register — every role except Founder / Admin. Google
          verifies the email; the user is then sent to /onboarding and
          must still choose ONE role (nothing pre-selected) and complete
          that role's profile before they are active. No role is
          auto-assigned, no professional is auto-verified. */}
      <section
        aria-label="Register with Google"
        className="mb-8 rounded-lg border border-slate-300 bg-white p-5"
      >
        <h2 className="mb-1 text-lg font-semibold text-slate-900">
          Register with Google
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          For Clients, Document Preparers, Attorneys, DOJ Nonprofits, Law
          Students, and Teachers. Already have an account?{" "}
          <Link href="/login" className="text-blue-600 underline">
            Log in →
          </Link>
        </p>
        <GoogleSignInButton mode="register" />
      </section>

      <div className="mb-8 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-300" />
        or register with email below
        <span className="h-px flex-1 bg-slate-300" />
      </div>

      <section aria-label="Choose your role" className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">
          Choose your role
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => {
            const active = role === r.id;
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={active}
                onClick={() => selectRole(r.id)}
                className={
                  "rounded-lg border p-4 text-left transition " +
                  (active
                    ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600"
                    : "border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50")
                }
              >
                <span className="block text-base font-semibold text-slate-900">
                  {r.title}
                </span>
                <span className="mt-1 block text-sm text-slate-600">
                  {r.blurb}
                </span>
                {active && (
                  <span className="mt-2 inline-block rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                    Selected
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {role === null && (
          <p className="mt-2 text-sm text-slate-500">
            Select a role above to see its registration form and checkout
            summary.
          </p>
        )}
      </section>

      {selected && (
        <section
          aria-label={`${selected.title} registration and checkout`}
          className="space-y-4"
        >
          <div className="rounded-lg border border-slate-300 bg-white p-5">
            <h2 className="mb-1 text-lg font-semibold text-slate-900">
              {selected.title}
            </h2>
            <p className="mb-4 text-sm text-slate-600">{selected.blurb}</p>
            <RoleForms
              key={selected.id}
              role={selected.id}
              onComplete={handleComplete}
            />
            {note && (
              <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
                {note}
              </p>
            )}
          </div>

          <CheckoutSummary role={selected.id} formSubmitted={formSubmitted} />

          {selected.id === "client" && (
            <p className="text-sm text-slate-600">
              Clients: after email verification, go to the{" "}
              <Link href="/portal" className="text-blue-600 underline">
                Client Portal
              </Link>
              .
            </p>
          )}
        </section>
      )}

      <footer className="mt-8 text-xs text-slate-500">
        <Link href="/" className="text-blue-600 underline">
          ← Back to home
        </Link>{" "}
        ·{" "}
        <Link href="/onboarding" className="text-blue-600 underline">
          Continue onboarding →
        </Link>
      </footer>
    </main>
  );
}
