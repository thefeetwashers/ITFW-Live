// Post-Arrival — Green Card / SSN tracking + Case Close-Out checklist.
// Stage 6, after entry to the United States. Green Card and SSN are
// mailed to the U.S. address on file, usually 30–90 days after entry.
// EXAMPLE dates only — countdowns are computed from stored dates, not
// live USCIS data. The case closes only when every close-out item is
// checked; closing is a deliberate act, never automatic.
"use client";

import { useState } from "react";
import {
  CASE_CLOSE_OUT_CHECKLIST,
  EXAMPLE_ENTRY_DATE_ISO,
  EXAMPLE_POST_ARRIVAL,
  POST_ARRIVAL_WINDOW_DAYS,
} from "@/lib/nvc";
import { daysUntil } from "@/lib/shipments";

const STATUS_LABEL: Record<string, string> = {
  not_due: "Not due yet",
  waiting: "Waiting",
  received: "Received ✓",
  overdue_follow_up: "Overdue — follow up",
};

export default function PostArrivalTracker() {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of EXAMPLE_POST_ARRIVAL) {
      initial[item.id] = item.status === "received";
    }
    return initial;
  });
  const [closeOut, setCloseOut] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of CASE_CLOSE_OUT_CHECKLIST) initial[item.id] = false;
    return initial;
  });

  const doneCount = EXAMPLE_POST_ARRIVAL.filter((i) => checked[i.id]).length;
  const closeOutDone = CASE_CLOSE_OUT_CHECKLIST.filter((i) => closeOut[i.id]).length;
  const allClosedOut = closeOutDone === CASE_CLOSE_OUT_CHECKLIST.length;
  const entryDays = daysUntil(EXAMPLE_ENTRY_DATE_ISO);
  const windowEndDays = daysUntil("2027-06-08");

  return (
    <section
      aria-labelledby="post-arrival-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="post-arrival-heading" className="text-base font-semibold">
        Post-Arrival — Green Card &amp; SSN Tracking
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Stage 6, after entry to the United States. EXAMPLE data only —{" "}
        {doneCount} of {EXAMPLE_POST_ARRIVAL.length} items received (manual
        entry). Green Card and SSN are mailed to the U.S. address USCIS has
        on file, usually {POST_ARRIVAL_WINDOW_DAYS.min}–
        {POST_ARRIVAL_WINDOW_DAYS.max} days after entry.
      </p>

      <p className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
        <span className="font-semibold">Entry (EXAMPLE): </span>
        {EXAMPLE_ENTRY_DATE_ISO} (
        {entryDays >= 0
          ? `in ${entryDays} day${entryDays === 1 ? "" : "s"}`
          : `${Math.abs(entryDays)} day${Math.abs(entryDays) === 1 ? "" : "s"} ago`}
        ). Expected Green Card / SSN window: 2027-04-09 to 2027-06-08 —{" "}
        {windowEndDays >= 0
          ? `day 90 is in ${windowEndDays} day${windowEndDays === 1 ? "" : "s"}`
          : `day 90 passed ${Math.abs(windowEndDays)} day${Math.abs(windowEndDays) === 1 ? "" : "s"} ago — follow up with USCIS`}
        . Countdowns computed from stored dates, not live USCIS data.
      </p>

      <ul className="mt-3 space-y-2">
        {EXAMPLE_POST_ARRIVAL.map((item) => {
          const due = item.dueIso ? daysUntil(item.dueIso) : null;
          return (
            <li
              key={item.id}
              className="flex items-start gap-2 rounded border border-slate-200 p-3 text-sm"
            >
              <input
                type="checkbox"
                checked={Boolean(checked[item.id])}
                onChange={() =>
                  setChecked((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                }
                aria-label={item.label}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span
                  className={
                    checked[item.id]
                      ? "font-medium text-slate-500 line-through"
                      : "font-medium"
                  }
                >
                  {item.label}
                </span>
                <span className="block text-xs text-slate-500">{item.detail}</span>
                {item.dueIso && (
                  <span className="block text-xs font-semibold text-slate-600">
                    {STATUS_LABEL[item.status] ?? item.status} · due {item.dueIso}
                    {due !== null && !checked[item.id]
                      ? due >= 0
                        ? ` — in ${due} day${due === 1 ? "" : "s"}`
                        : ` — ${Math.abs(due)} day${Math.abs(due) === 1 ? "" : "s"} overdue`
                      : ""}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        If the Green Card or SSN has not arrived by day 90 after entry, follow
        up with USCIS — and for a missing SSN, visit a Social Security office
        with the passport + visa and the I-551 stamp. Tell us right away if
        the client moves during the 90 days.
      </p>

      {/* Case close-out checklist */}
      <h3 className="mt-5 text-sm font-semibold">
        Case Close-Out Checklist — {closeOutDone} of{" "}
        {CASE_CLOSE_OUT_CHECKLIST.length} done
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        The case closes only when every item below is done. Closing is a
        deliberate act — no item is checked by default, and a case with a
        wrong Green Card or an unpaid invoice must not be closed.
      </p>
      <ul className="mt-2 space-y-2">
        {CASE_CLOSE_OUT_CHECKLIST.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-2 rounded border border-slate-200 p-3 text-sm"
          >
            <input
              type="checkbox"
              checked={Boolean(closeOut[item.id])}
              onChange={() =>
                setCloseOut((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
              }
              aria-label={item.label}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span
                className={
                  closeOut[item.id]
                    ? "font-medium text-slate-500 line-through"
                    : "font-medium"
                }
              >
                {item.label}
              </span>
              <span className="block text-xs text-slate-500">{item.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      {allClosedOut ? (
        <p className="mt-3 rounded border border-green-300 bg-green-50 p-3 text-sm font-semibold text-green-800">
          ✓ Every close-out item is done — this case can be closed (example
          checklist only; closing is recorded by the preparer, not automatic).
        </p>
      ) : (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          Case stays open — {CASE_CLOSE_OUT_CHECKLIST.length - closeOutDone}{" "}
          close-out item
          {CASE_CLOSE_OUT_CHECKLIST.length - closeOutDone === 1 ? "" : "s"}{" "}
          still open.
        </p>
      )}
    </section>
  );
}
