// Preparer profile + public page editor — preparer dashboard.
// Local state only (example) until migration 0012 preparer_profiles is
// applied and wired. Listing fee is LOCKED at $49/mo (preparer_pro_49).
// Verification status is "UPL agreement signed" — a preparer is NEVER
// labelled bar-verified or attorney-verified.
"use client";

import { useState } from "react";
import Link from "next/link";
import { LANGUAGES } from "@/lib/i18n";
import { FORM_CHECKLIST_TEMPLATES } from "@/lib/formChecklists";
import { UplBadge } from "@/components/preparer/UplBadge";

const SERVICE_AREAS = [
  "Fort Pierce, FL",
  "Broward County, FL",
  "Statewide — Florida",
  "Nationwide — remote",
] as const;

export default function PreparerProfileCard() {
  const [slug, setSlug] = useState("your-name");
  const [bio, setBio] = useState("");
  const [languages, setLanguages] = useState<string[]>(["en", "es"]);
  const [serviceArea, setServiceArea] = useState<string>(SERVICE_AREAS[0]);
  const [services, setServices] = useState<string[]>(["I-130", "I-485"]);
  const [uplSigned] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const toggle = (list: string[], value: string, set: (v: string[]) => void) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const slugOk = /^[a-z0-9][a-z0-9-]{2,60}$/.test(slug);

  return (
    <section
      aria-labelledby="preparer-profile-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="preparer-profile-heading" className="text-lg font-semibold">
        Your Preparer Profile &amp; Public Page
      </h2>
      <UplBadge />
      <p className="mt-2 text-sm text-slate-600">
        Your public page is{" "}
        <Link
          href={`/p/${slugOk ? slug : "your-name"}`}
          className="font-semibold text-blue-700 underline"
        >
          immigration.niptei.com/p/{slugOk ? slug : "your-name"}
        </Link>
        . Unverified profiles are NOT listed in the directory.
      </p>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Verification status
          </dt>
          <dd className="mt-1 font-medium">
            {uplSigned
              ? "UPL clerical agreement signed (example)"
              : "UPL agreement NOT signed — sign it in /register before listing"}
          </dd>
          <dd className="mt-1 text-xs text-slate-600">
            Preparers are never labelled bar-verified or attorney-verified.
            Only a licensed attorney or DOJ-Accredited Representative is
            bar / DOJ verified (8 CFR 292.1).
          </dd>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Listing fee — locked
          </dt>
          <dd className="mt-1 font-medium">$49/mo — preparer_pro_49</dd>
          <dd className="mt-1 text-xs text-slate-600">
            Locked price. Listing goes live only after verification + active
            subscription.
          </dd>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Claim your profile
          </dt>
          <dd className="mt-1 text-xs text-slate-600">
            1. Register as Document Preparer at /register (UPL agreement
            required). 2. Pick your slug below. 3. Admin review. 4. Subscribe
            $49/mo. 5. Your /p/&lt;slug&gt; page lists.
          </dd>
        </div>
      </dl>

      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="font-medium">Public slug (3–61 chars, lowercase letters, numbers, hyphens)</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            className="mt-1 w-full max-w-sm rounded border border-slate-300 px-2 py-1 text-sm"
          />
          {!slugOk && (
            <span className="mt-1 block text-xs text-red-700">
              Slug must be 3–61 chars, lowercase letters, numbers and hyphens
              only — same rule as /api/register-role.
            </span>
          )}
        </label>
        <label className="block text-sm">
          <span className="font-medium">Bio (clerical services only — no legal-advice claims)</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="Example: I help families organise documents and prepare immigration forms. Clerical help only — not a law firm."
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <fieldset>
          <legend className="text-sm font-medium">Languages you serve in</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <label key={l.code} className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={languages.includes(l.code)}
                  onChange={() => toggle(languages, l.code, setLanguages)}
                />
                {l.label} ({l.native})
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm">
          <span className="font-medium">Service area</span>
          <select
            value={serviceArea}
            onChange={(e) => setServiceArea(e.target.value)}
            className="mt-1 w-full max-w-sm rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            {SERVICE_AREAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="text-sm font-medium">Services / forms offered (clerical prep only)</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {FORM_CHECKLIST_TEMPLATES.map((t) => (
              <label key={t.id} className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={services.includes(t.formsIncluded[0])}
                  onChange={() => toggle(services, t.formsIncluded[0], setServices)}
                />
                {t.formsIncluded.join(" + ")} — {t.name}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            I-589 is clerical prep only — never legal advice. I-601 / I-601A /
            I-212 waivers are attorney-referral cases, not preparer services.
          </p>
        </fieldset>
        <button
          type="button"
          disabled={!slugOk}
          onClick={() => setSavedAt(new Date().toISOString())}
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Save profile (example — local only)
        </button>
        {savedAt && (
          <p role="status" className="text-sm text-green-700">
            Saved locally at {new Date(savedAt).toLocaleString()} — NOT in
            Supabase yet. Migration 0012 defines preparer_profiles; apply it
            and wire this form before claiming a live profile.
          </p>
        )}
      </div>
    </section>
  );
}
