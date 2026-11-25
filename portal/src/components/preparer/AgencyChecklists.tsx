// USCIS Case Status API & NVC CEAC checklist templates — preparer view.
// Renders AGENCY_CHECKLISTS for I-130, I-485, N-400, I-821, I-589
// (agency-number slots + required documents per bundle, from
// lib/agency.ts). The API route itself is out of scope here — it exists
// as a skeleton elsewhere. USCIS API: skeleton, Sandbox only, Production
// key needed. NVC: manual CEAC checklist — link out to CEAC, no
// password storage.
import { AGENCY_CHECKLISTS, CEAC_LOGIN_URL } from "@/lib/agency";
import { BUNDLE_TEMPLATES } from "@/lib/bundles";

const FORM_ORDER = ["I-130", "I-485", "N-400", "I-821", "I-589"] as const;

export default function AgencyChecklists() {
  return (
    <section
      aria-labelledby="agency-checklists-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="agency-checklists-heading" className="text-lg font-semibold">
        USCIS Case Status API &amp; NVC CEAC Checklist Templates
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        USCIS API: skeleton (Sandbox only, Production key needed). NVC:
        manual CEAC checklist — link out to CEAC, no password storage.
        Templates below are clerical form preparation and document
        organisation only — never legal advice.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {FORM_ORDER.map((formCode) => {
          const checklist = AGENCY_CHECKLISTS[formCode];
          const bundle = BUNDLE_TEMPLATES.find(
            (b) => b.formCode === formCode
          );
          if (!checklist) return null;
          return (
            <article
              key={formCode}
              className="rounded border border-slate-200 bg-slate-50 p-3"
            >
              <h3 className="text-sm font-semibold">
                {formCode}
                {bundle ? ` — ${bundle.name}` : ""}
              </h3>
              {bundle && (
                <p className="mt-1 text-xs text-slate-600">
                  {bundle.uscisFeeNote}
                </p>
              )}
              <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Agency-number slots
              </h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {checklist.agencySlots.map((slot) => (
                  <li key={slot}>{slot}</li>
                ))}
              </ul>
              <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Required documents
              </h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {checklist.documents.map((doc) => (
                  <li key={doc}>{doc}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>

      <p className="mt-4 text-sm">
        NVC CEAC:{" "}
        <a
          href={CEAC_LOGIN_URL}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-blue-700 underline"
        >
          Open CEAC login (ceac.state.gov)
        </a>{" "}
        — manual checklist tracking; no CEAC password is stored.
      </p>
    </section>
  );
}
