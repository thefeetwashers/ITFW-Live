// (d) Expiration & Deadline Radar.
// Countdowns are COMPUTED FROM STORED DATES (daysUntil in
// lib/shipments.ts) — not live USCIS / NVC data. EXAMPLE dates only.
"use client";

import { DEADLINE_KIND_LABEL, EXAMPLE_DEADLINES } from "@/lib/nvc";
import { daysUntil } from "@/lib/shipments";

export default function DeadlineRadar() {
  return (
    <section
      aria-labelledby="deadline-radar-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="deadline-radar-heading" className="text-base font-semibold">
        Expiration &amp; Deadline Radar
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Countdowns computed from stored dates — not live USCIS / NVC data.
        EXAMPLE deadlines only; replace the stored dates with the dates on
        the client&apos;s actual notices.
      </p>
      <ul className="mt-3 space-y-2">
        {EXAMPLE_DEADLINES.map((d) => {
          const days = daysUntil(d.dueIso);
          const overdue = days < 0;
          const open = d.direction === "opens" && days <= 0;
          return (
            <li
              key={d.id}
              className={`rounded border p-3 text-sm ${
                overdue && d.direction === "due"
                  ? "border-red-400 bg-red-50"
                  : open
                    ? "border-green-400 bg-green-50"
                    : "border-slate-200 bg-slate-50"
              }`}
            >
              <p className="font-medium">
                {d.label}{" "}
                <span className="text-xs font-semibold text-slate-500">
                  ({DEADLINE_KIND_LABEL[d.kind]})
                </span>
              </p>
              <p className="mt-1">
                {d.direction === "due" ? (
                  overdue ? (
                    <strong className="text-red-700">
                      OVERDUE by {Math.abs(days)} day
                      {Math.abs(days) === 1 ? "" : "s"} — due {d.dueIso}
                    </strong>
                  ) : (
                    <strong>
                      Due in {days} day{days === 1 ? "" : "s"} — {d.dueIso}
                    </strong>
                  )
                ) : open ? (
                  <strong className="text-green-700">
                    Window is OPEN (opened {d.dueIso})
                  </strong>
                ) : (
                  <strong>
                    Opens in {days} day{days === 1 ? "" : "s"} — {d.dueIso}
                  </strong>
                )}
              </p>
              <p className="mt-1 text-xs text-slate-600">{d.action}</p>
              <p className="mt-1 text-xs text-slate-500">
                Basis (stored date): {d.basis}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        NVC 1-Year Contact Requirement (INA 203(g)): contact NVC at least
        once a year or the case can be terminated. EAD / TPS renewal
        windows are 180 days before expiry in this example — confirm the
        window on the actual renewal notice.
      </p>
    </section>
  );
}
