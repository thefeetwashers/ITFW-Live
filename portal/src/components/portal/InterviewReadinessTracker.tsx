// (c) Embassy Interview & Medical Exam Readiness Tracker (post-DQ).
// EXAMPLE dates / places only — no real appointment is booked here.
"use client";

import { useState } from "react";
import {
  EXAMPLE_INTERVIEW_READINESS,
  EXAMPLE_VAC,
} from "@/lib/nvc";
import { daysUntil } from "@/lib/shipments";

export default function InterviewReadinessTracker() {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of EXAMPLE_INTERVIEW_READINESS) {
      initial[item.id] = item.status === "done";
    }
    return initial;
  });

  const doneCount = EXAMPLE_INTERVIEW_READINESS.filter(
    (i) => checked[i.id]
  ).length;
  const vacDays = daysUntil(EXAMPLE_VAC.dateIso);

  return (
    <section
      aria-labelledby="interview-readiness-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="interview-readiness-heading" className="text-base font-semibold">
        Embassy Interview &amp; Medical Exam Readiness Tracker
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        For use after NVC marks the case Documentarily Qualified (DQ).
        EXAMPLE data only — {doneCount} of{" "}
        {EXAMPLE_INTERVIEW_READINESS.length} items checked (manual entry).
      </p>

      <p className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
        <span className="font-semibold">VAC biometrics (EXAMPLE): </span>
        {EXAMPLE_VAC.location} — {EXAMPLE_VAC.dateIso} (
        {vacDays >= 0
          ? `in ${vacDays} day${vacDays === 1 ? "" : "s"} (computed from the stored date)`
          : `${Math.abs(vacDays)} day${Math.abs(vacDays) === 1 ? "" : "s"} ago (computed from the stored date)`}
        ).
      </p>

      <ul className="mt-3 space-y-2">
        {EXAMPLE_INTERVIEW_READINESS.map((item) => (
          <li key={item.id} className="flex items-start gap-2 rounded border border-slate-200 p-3 text-sm">
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
              <span className={checked[item.id] ? "line-through text-slate-500" : "font-medium"}>
                {item.label}
              </span>
              {item.note ? (
                <span className="block text-xs text-slate-500">{item.note}</span>
              ) : null}
              {item.status === "to_be_confirmed" && (
                <span className="block text-xs font-semibold text-amber-700">
                  TO BE CONFIRMED
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        Panel-physician medical exam: the sealed envelope goes to the
        embassy unopened. Bring originals of every civil document uploaded
        to CEAC, plus their certified translations, in the binder.
      </p>
    </section>
  );
}
