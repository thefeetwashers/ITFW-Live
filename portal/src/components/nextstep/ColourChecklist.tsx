// ColourChecklist — the ONE colour-coded document system, used on every
// dashboard. Same colours, same legend, everywhere:
//   green  Approved · amber Pending Review / In Progress ·
//   red    Missing / Rejected / Overdue · blue Uploaded — Awaiting Review ·
//   grey   Not Started.
// Packet readiness % is derived from these colours (colourReadiness in
// lib/nextStepEngine.ts) — NOT from the audit-weight score in lib/audit.ts,
// and the label says which one it is.
"use client";

import {
  DOC_COLOURS,
  DOC_COLOUR_LEGEND,
  colourReadiness,
  type ColourItem,
} from "@/lib/nextStepEngine";

export function ColourLegend() {
  return (
    <ul
      aria-label="Document status colour legend"
      className="mt-2 flex flex-wrap gap-2 text-xs"
    >
      {DOC_COLOUR_LEGEND.map((status) => {
        const c = DOC_COLOURS[status];
        return (
          <li
            key={status}
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${c.chipClass}`}
          >
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${c.dotClass}`} />
            {c.label}
          </li>
        );
      })}
    </ul>
  );
}

export default function ColourChecklist(props: {
  items: ColourItem[];
  title?: string;
}) {
  const readiness = colourReadiness(props.items);
  return (
    <section
      aria-labelledby="colour-checklist-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="colour-checklist-heading" className="text-base font-semibold">
        {props.title ?? "Document Checklist"} — Packet Readiness:{" "}
        {readiness.score}% (from document colours)
      </h2>
      <ColourLegend />
      <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full bg-green-600"
          style={{ width: `${readiness.score}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {readiness.approved} of {readiness.total} Approved. Readiness is
        counted from the colours above: Approved counts fully, Uploaded —
        Awaiting Review / Pending Review counts half, In Progress counts a
        quarter, Missing / Rejected / Overdue / Not Started counts zero.
        Filing is not ready until 100% and every blocking item is cleared.{" "}
        {readiness.blockingOpen.length > 0 && (
          <span className="font-semibold text-red-700">
            Blocking items still open:{" "}
            {readiness.blockingOpen.map((i) => i.label).join(", ")}.
          </span>
        )}
      </p>
      {/* Computed, never hardcoded: the items below are why the count is
          what it is. E.g. the example checklist shows 4 of 6 because
          Birth Certificate is In Review and the Joint Bank Statement
          needs a retake — the founder's brief said "5 of 6 Approved",
          but the data gives 4 of 6. Which item should count as approved
          to make 5 of 6 is a founder decision (DEPLOY.md §13); this
          component never hardcodes 5 of 6. */}
      {(() => {
        const notApproved = props.items.filter((i) => i.status !== "approved");
        if (notApproved.length === 0) return null;
        return (
          <p className="mt-1 text-xs text-slate-600">
            Not yet approved:{" "}
            {notApproved
              .map((i) => `${i.label} (${DOC_COLOURS[i.status].label})`)
              .join(", ")}
            . That is why the count above is {readiness.approved} of{" "}
            {readiness.total}, not higher.
          </p>
        );
      })()}
      <ul className="mt-3 space-y-2 text-sm">
        {props.items.map((item) => {
          const c = DOC_COLOURS[item.status];
          return (
            <li
              key={item.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 ${c.rowClass}`}
            >
              <span className="font-medium">
                <span aria-hidden="true" className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${c.dotClass}`} />
                {item.label}
                {item.blocking && (
                  <span className="ml-2 text-xs font-semibold text-red-700">
                    (blocking)
                  </span>
                )}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${c.chipClass}`}>
                {c.label}
              </span>
              {item.note && (
                <span className="w-full text-xs text-slate-600">{item.note}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
