"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LanguagePicker from "@/components/LanguagePicker";
import { getSupabase } from "@/lib/supabase";
import OnboardingProgress, {
  type OnboardingStatus,
} from "@/components/onboarding/OnboardingProgress";
import RoleForms, { type RoleId } from "@/components/onboarding/RoleForms";

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
    blurb: "Clerical help only. Free profile claim; $49/mo Back Office & listing.",
  },
  {
    id: "attorney",
    title: "Licensed Attorney",
    blurb: "Bar-verified. $99/mo after verification.",
  },
  {
    id: "nonprofit",
    title: "DOJ-Accredited Nonprofit",
    blurb: "EOIR roster check. 50% off: $24.50/mo Standard or $49.50/mo Full.",
  },
  {
    id: "student",
    title: "Law Student",
    blurb: "Supervised-only workspace. $35/mo.",
  },
  {
    id: "teacher",
    title: "Teacher / Clinic Director",
    blurb: "Confirm your law students.",
  },
  {
    id: "admin",
    title: "Founder / Admin",
    blurb: "Login only — no self-registration.",
  },
];

export default function OnboardingPage() {
  const supabaseLive = useMemo(() => getSupabase() !== null, []);
  const [role, setRole] = useState<RoleId | null>(null);
  const [status, setStatus] = useState<OnboardingStatus>("role_selected");
  const [note, setNote] = useState<string | null>(null);
  // True when the user arrived here from Google sign-in
  // (/auth/callback → /onboarding?google=1): their email is already
  // verified by Google, so the role forms post to /api/google-profile
  // (no password, no second Auth user) instead of /api/register-role.
  // Role selection is still required — nothing is pre-selected.
  const [googleReturn, setGoogleReturn] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setGoogleReturn(
      new URLSearchParams(window.location.search).get("google") === "1"
    );
  }, []);

  const selectRole = (id: RoleId) => {
    setRole(id);
    setStatus("role_selected");
    setNote(null);
  };

  const handleComplete = (next: OnboardingStatus, message: string) => {
    setStatus(next);
    setNote(message);
  };

  const selected = ROLES.find((r) => r.id === role);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Join Immigration with NIPTEI
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Choose your role to get started. Questions? Email{" "}
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
        </div>
        <LanguagePicker />
      </header>

      {!supabaseLive && (
        <p className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Example data — not live. Supabase is not connected in this build.
        </p>
      )}
      <p className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Registration creates a real account now that Supabase Auth is
        connected. No account is created by this page until you choose a role
        and submit.
      </p>
      {googleReturn && (
        <p className="mb-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
          You signed in with Google — your email is already verified, so no
          email confirmation or password is needed. Choose ONE role below
          and complete that role&apos;s profile. No role is pre-selected
          and none is assigned automatically; professionals still need
          admin verification before they are listed or active.
        </p>
      )}
      <p className="mb-6 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Immigration with NIPTEI is not a law firm and is not affiliated with
        USCIS. We provide clerical and educational help only — no approval is
        guaranteed. Only a licensed attorney or a DOJ-Accredited Representative
        can give legal advice or represent you (8 CFR 292.1).
      </p>

      <section aria-label="Onboarding progress" className="mb-6">
        <OnboardingProgress status={status} started={role !== null} />
        {role === null && (
          <p className="mt-2 text-sm text-slate-500">
            Select a role below to begin.
          </p>
        )}
      </section>

      <section aria-label="Choose your role" className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">
          Step 1 — Choose your role
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
      </section>

      {selected && (
        <section
          aria-label={`${selected.title} form`}
          className="rounded-lg border border-slate-300 bg-white p-5"
        >
          <h2 className="mb-1 text-lg font-semibold text-slate-900">
            {selected.title}
          </h2>
          <p className="mb-4 text-sm text-slate-600">{selected.blurb}</p>
          <RoleForms
            key={selected.id}
            role={selected.id}
            googleMode={googleReturn}
            onComplete={handleComplete}
          />
          {note && (
            <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
              {note}
            </p>
          )}
          {status === "pending_verification" && (
            <p className="mt-3 text-sm text-slate-600">
              Your status is <strong>pending_verification</strong> — it stays
              there until an admin approves you. Nothing is verified
              automatically in this build.
            </p>
          )}
        </section>
      )}

      <footer className="mt-8 text-xs text-slate-500">
        <Link href="/" className="text-blue-600 underline">
          ← Back to home
        </Link>
      </footer>
    </main>
  );
}
