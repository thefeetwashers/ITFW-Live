// DeadlineCountdown — RFE / NOID / interview / biometrics countdowns.
//
// Counts down from REAL STORED DATES ONLY (the dates on the client's
// actual notices), via deadlineCountdown (lib/finalSweep.ts). No date
// is ever invented: a deadline with no stored date shows "No date on
// file", and with no deadlines at all the honest empty state shows.
// This is the compact countdown the dashboards show; the full radar
// with stored-date basis text lives in DeadlineRadar.
"use client";

import {
  deadlineCountdown,
  DEADLINE_KIND_LABELS,
  type DeadlineKind,
} from "@/lib/finalSweep";

export interface StoredDeadline {
  id: string;
  kind: DeadlineKind;
  label: string;
  /** ISO date from the actual notice — null when no date is on file. */
  dueIso: string | null;
  action?: string;
}

export default function DeadlineCountdown(props: {
  deadlines?: StoredDeadline[];
}) {
  const deadlines = props.deadlines ?? [];
  return (
    <section
      aria-labelledby="deadline-countdown-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="deadline-countdown-heading" className="text-base font-semibold">
        Deadline Countdown — RFE / NOID / Interview / Biometrics
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Counted from the dates on your actual notices — not a live USCIS
        lookup. A deadline with no date on file is shown as such, never
        guessed.
      </p>
      {deadlines.length === 0 ? (
        <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          No deadlines on file yet. RFE, NOID, interview, and biometrics
          deadlines appear here — with a countdown — once the dates from
          your notices are entered by you or your provider.
        </p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {deadlines.map((d) => {
            const c = deadlineCountdown(d.dueIso);
            const tone =
              c.state === "overdue"
                ? "border-red-400 bg-red-50"
                : c.state === "due_today" || c.state === "due_soon"
                  ? "border-amber-400 bg-amber-50"
                  : c.state === "no_date"
                    ? "border-slate-200 bg-slate-50"
                    : "border-green-300 bg-green-50";
            return (
              <li key={d.id} className={`rounded border px-3 py-2 ${tone}`}>
                <p className="font-medium">
                  {d.label}{" "}
                  <span className="text-xs font-semibold text-slate-500">
                    ({DEADLINE_KIND_LABELS[d.kind]})
                  </span>
                </p>
                <p className="mt-0.5">
                  <strong
                    className={
                      c.state === "overdue" ? "text-red-700" : undefined
                    }
                  >
                    {c.label}
                  </strong>
                  {d.dueIso ? ` — ${d.dueIso}` : ""}
                </p>
                {d.action && (
                  <p className="mt-0.5 text-xs text-slate-600">{d.action}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
