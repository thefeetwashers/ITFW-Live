// Printable guide — checklist, interview prep, and what-to-bring,
// rendered for printing with the browser. No PDF generator is used:
// the Print button calls window.print() and the print CSS in
// src/app/globals.css hides navigation and buttons (.no-print) and
// shows only the guide (.print-area). The what-to-bring and
// interview-conduct sections are REUSED from
// src/lib/interviewPrep.ts (WHAT_TO_BRING, CONDUCT_GUIDE), so the
// printed page can never disagree with the interview-prep pages;
// the checklists are the general ones in src/lib/safety.ts.
//
// Accessibility: the Print button is a native <button> with a
// visible label; the guide is plain headings and lists, readable by
// screen readers and clean on paper.
"use client";

import { CONDUCT_GUIDE, WHAT_TO_BRING } from "@/lib/interviewPrep";
import { PRINTABLE_CHECKLIST } from "@/lib/safety";

export default function PrintableGuideSection() {
  return (
    <div>
      <div className="no-print mt-4">
        <button
          type="button"
          onClick={() => window.print()}
          aria-label="Print this guide"
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
        >
          Print this guide
        </button>
        <p className="mt-2 text-sm text-slate-600">
          Prints only this guide — the buttons and navigation are left
          out. Your appointment notice lists exactly what to bring to
          YOUR interview and overrides any general list here.
        </p>
      </div>

      <div className="print-area mt-6 space-y-6">
        {PRINTABLE_CHECKLIST.map((section) => (
          <section key={section.id} aria-labelledby={`print-${section.id}`}>
            <h2 id={`print-${section.id}`} className="text-lg font-semibold text-slate-900">
              {section.heading}
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}

        <section aria-labelledby="print-conduct">
          <h2 id="print-conduct" className="text-lg font-semibold text-slate-900">
            {CONDUCT_GUIDE.heading}
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {CONDUCT_GUIDE.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="print-what-to-bring">
          <h2 id="print-what-to-bring" className="text-lg font-semibold text-slate-900">
            What to bring to the interview
          </h2>
          {WHAT_TO_BRING.map((g) => (
            <div key={g.interviewType} className="mt-3">
              <h3 className="text-base font-semibold text-slate-900">{g.interviewType}</h3>
              <p className="mt-1 text-sm text-slate-600">{g.checkFirst}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {g.items.map((i) => (
                  <li key={i.item}>
                    {i.item} — {i.why}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <p className="text-sm text-slate-600">
          Immigration with NIPTEI is a document-preparation service, not
          a law firm, and is not USCIS. Educational information only,
          not legal advice — and no outcome is promised. Only a licensed
          attorney or DOJ-accredited representative gives legal advice
          (8 CFR 292.1).
        </p>
      </div>
    </div>
  );
}
