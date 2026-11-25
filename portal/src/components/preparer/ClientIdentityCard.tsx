// Client Contact & Identity Card — preparer view only.
// EXAMPLE data only. No real client names, phones, or emails are used
// anywhere on this page. The A-Number is shown MASKED via maskANumber()
// and never in full in lists or logs.
"use client";

import LanguagePicker from "@/components/LanguagePicker";
import { maskANumber } from "@/lib/agency";
import { LANGUAGES } from "@/lib/i18n";

// Example masked value only — never a real A-Number.
const EXAMPLE_MASKED_A_NUMBER = maskANumber("A000000123");

const LINKED_FAMILY = [
  { label: "Example Spouse", role: "Beneficiary (I-130)", access: "Invited — View Case & USCIS/NVC Status" },
  { label: "Example Adult Child", role: "Beneficiary (I-485)", access: "Invited — View Case & USCIS/NVC Status" },
  { label: "Example Joint Sponsor", role: "Joint Sponsor (I-864)", access: "Invited — Upload Missing Docs & Pay Invoice" },
];

export default function ClientIdentityCard() {
  return (
    <section
      aria-labelledby="client-identity-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="client-identity-heading" className="text-lg font-semibold">
        Client Contact &amp; Identity — Example Client
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Example data — not a real client. Generic labels only; no real
        names, phone numbers, or email addresses are shown here.
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Primary email
          </dt>
          <dd className="text-sm">client@example.invalid (example)</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Mobile / WhatsApp
          </dt>
          <dd className="text-sm">(000) 000-0000 (example)</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Preferred language
          </dt>
          <dd className="mt-1 flex items-center gap-2 text-sm">
            <LanguagePicker />
            <span className="text-slate-500">
              7 languages: {LANGUAGES.map((l) => l.label).join(", ")}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            A-Number
          </dt>
          <dd className="text-sm font-mono">{EXAMPLE_MASKED_A_NUMBER}</dd>
          <dd className="text-xs text-slate-500">
            Masked — the full A-Number is never shown in lists and never
            written to logs.
          </dd>
        </div>
      </dl>

      <h3 className="mt-5 text-sm font-semibold">
        Linked family beneficiaries / petitioners
      </h3>
      <ul className="mt-2 space-y-2">
        {LINKED_FAMILY.map((person) => (
          <li
            key={person.label}
            className="rounded border border-slate-200 bg-slate-50 p-3 text-sm"
          >
            <span className="font-medium">{person.label}</span>
            <span className="text-slate-600"> — {person.role}</span>
            <span className="block text-xs text-slate-500">
              {person.access}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-slate-500">
        Public profile: immigration.niptei.com/p/your-name
      </p>
    </section>
  );
}
