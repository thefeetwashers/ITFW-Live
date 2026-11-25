// (f) Family Tree / Derivative Beneficiary Roster.
// One master profile: petitioner, principal beneficiary, derivative
// spouse / children, joint sponsor — each with masked A-Number
// (A-***-***-123), passport expiry, and birth date.
// A-Numbers are EXAMPLE placeholders and are NEVER shown in full in
// lists (maskANumber in lib/agency.ts).
import { maskANumber } from "@/lib/agency";
import { EXAMPLE_FAMILY_ROSTER, FAMILY_ROLE_LABEL } from "@/lib/nvc";

export default function FamilyTreeRoster() {
  return (
    <section
      aria-labelledby="family-tree-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="family-tree-heading" className="text-base font-semibold">
        Family Tree / Derivative Beneficiary Roster
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Master profile for one case (EXAMPLE names, dates and A-Numbers
        only — no real family). A-Numbers are masked (A-***-***-123) and
        never shown in full in lists. No derivative spouse is on this
        example case — that slot is empty below.
      </p>
      <ul className="mt-3 space-y-2">
        {EXAMPLE_FAMILY_ROSTER.map((m) => (
          <li
            key={m.id}
            className="rounded border border-slate-200 p-3 text-sm"
          >
            <p className="font-medium">
              {m.displayName} (EXAMPLE) — {FAMILY_ROLE_LABEL[m.role]}
            </p>
            <p className="text-xs text-slate-600">{m.relationship}</p>
            <dl className="mt-2 grid gap-1 sm:grid-cols-3">
              <div className="flex gap-2">
                <dt className="font-semibold">A-Number:</dt>
                <dd className="font-mono">{maskANumber(m.aNumberExample)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold">Birth date:</dt>
                <dd>{m.birthDateIso} (EXAMPLE)</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold">Passport expires:</dt>
                <dd>
                  {m.passportExpiryIso} — {m.passportCountry}
                </dd>
              </div>
            </dl>
          </li>
        ))}
        <li className="rounded border border-dashed border-slate-300 p-3 text-sm text-slate-500">
          Derivative Spouse — no derivative spouse on this example case.
        </li>
      </ul>
    </section>
  );
}
