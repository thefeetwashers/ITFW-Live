// (a) Master Form & Service Bundle Catalog with auto-checklists.
// Extends lib/bundles.ts — no competing catalog. Selecting a service
// loads its required documents, family slots, and USCIS / NVC fee
// breakdown using ONLY locked prices / fees; unverifiable items are
// marked TO BE CONFIRMED, never invented.
// Locked bundle prices: Family Adjustment Bundle Basic $999 / Standard
// $1,799 / Premium $2,799. $1,200 / $600 / $300 in pastes are EXAMPLE.
"use client";

import { useMemo, useState } from "react";
import {
  BUNDLE_TEMPLATES,
  FAMILY_ADJUSTMENT_BUNDLE,
  SERVICE_CATALOG_ORDER,
} from "@/lib/bundles";
import {
  CATALOG_COUNT_NOTE,
  CATALOG_STANDALONE_FORM_COUNT,
} from "@/lib/catalogAudit";

export default function ServiceCatalog() {
  const ordered = useMemo(
    () =>
      SERVICE_CATALOG_ORDER.map((code) =>
        BUNDLE_TEMPLATES.find((b) => b.formCode === code)
      ).filter((b): b is NonNullable<typeof b> => Boolean(b)),
    []
  );
  const [selected, setSelected] = useState(ordered[0]?.formCode ?? "I-130");
  const bundle = ordered.find((b) => b.formCode === selected) ?? ordered[0];

  if (!bundle) return null;

  return (
    <section
      aria-labelledby="service-catalog-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="service-catalog-heading" className="text-base font-semibold">
        Master Form &amp; Service Bundle Catalog
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Select a service to load its required documents, family slots, and
        fee breakdown. Only locked prices / fees are shown as locked;
        everything else is TO BE CONFIRMED. Family Adjustment Bundle
        (locked): Basic ${FAMILY_ADJUSTMENT_BUNDLE.price.basic} / Standard $
        {FAMILY_ADJUSTMENT_BUNDLE.price.standard} / Premium $
        {FAMILY_ADJUSTMENT_BUNDLE.price.premium} —{" "}
        {FAMILY_ADJUSTMENT_BUNDLE.forms.join(", ")}. $1,200 / $600 / $300
        figures in pastes are EXAMPLE, not locked prices.
      </p>
      <p className="mt-1 text-sm text-slate-600">
        Full form directory (audited Nov 19, 2026):{" "}
        <strong>{CATALOG_STANDALONE_FORM_COUNT} forms listed.</strong>{" "}
        {CATALOG_COUNT_NOTE}
      </p>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Services">
        {ordered.map((b) => (
          <button
            key={b.formCode}
            type="button"
            onClick={() => setSelected(b.formCode)}
            aria-pressed={b.formCode === selected}
            className={`rounded px-3 py-1.5 text-sm font-semibold ${
              b.formCode === selected
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            {b.formCode}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded border border-slate-200 p-3">
        <h3 className="text-sm font-semibold">
          {bundle.formCode} — {bundle.name}
        </h3>
        <p className="mt-1 text-sm">
          <span className="font-semibold">Family slots: </span>
          {bundle.familySlots ?? "TO BE CONFIRMED"}
        </p>
        <p className="mt-1 text-sm">
          <span className="font-semibold">Clerical prep fee: </span>
          {bundle.serviceFee ? (
            "basic" in bundle.serviceFee ? (
              <>
                Basic ${bundle.serviceFee.basic} / Standard $
                {bundle.serviceFee.standard} / Premium $
                {bundle.serviceFee.premium} (locked)
              </>
            ) : (
              <>${bundle.serviceFee.flat} (locked flat fee)</>
            )
          ) : (
            <span className="font-semibold text-amber-700">
              TO BE CONFIRMED — no locked service fee for this bundle yet.
            </span>
          )}
        </p>

        <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Fee breakdown (prep fee and government fees kept separate)
        </h4>
        {bundle.feeBreakdown ? (
          <ul className="mt-1 space-y-1 text-sm">
            {bundle.feeBreakdown.map((line) => (
              <li key={line.label} className="flex flex-wrap justify-between gap-2">
                <span>
                  {line.label}
                  {line.note ? (
                    <span className="block text-xs text-slate-500">
                      {line.note}
                    </span>
                  ) : null}
                </span>
                <span className={line.locked ? "" : "font-semibold text-amber-700"}>
                  {line.amount}
                  {line.locked ? " (locked)" : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm">{bundle.uscisFeeNote}</p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          USCIS fee note: {bundle.uscisFeeNote}
        </p>

        <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Required documents — auto-checklist
        </h4>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {bundle.checklist.map((c) => (
            <li key={c.label}>
              {c.label}{" "}
              {c.status === "to_be_confirmed" && (
                <span className="text-xs font-semibold text-amber-700">
                  (to be confirmed)
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
