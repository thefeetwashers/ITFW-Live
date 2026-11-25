// "Your renewals" — client portal. Every row is derived from a REAL
// expiry/eligibility date entered for the case (see src/lib/renewals.ts).
// No date is invented: with no dates on file the section says so.
// Nudges are queued every 48h once due, in the client's language —
// Twilio/Resend are NOT connected, so nothing is claimed sent.
"use client";

import { useState } from "react";
import {
  deriveRenewals,
  RENEWAL_FORM_TO_FILE,
  RENEWAL_TYPE_LABEL,
  type RenewalInput,
  type RenewalType,
} from "@/lib/renewals";

const TYPE_OPTIONS: { value: RenewalType; label: string }[] = [
  { value: "green_card", label: "Green Card (I-90) — 10-year card" },
  { value: "conditional_green_card", label: "Conditional Green Card (I-751)" },
  { value: "ead", label: "Work permit / EAD (I-765)" },
  { value: "tps", label: "TPS (I-821 + I-765)" },
  { value: "passport", label: "Passport" },
  { value: "n400", label: "Citizenship eligibility (N-400)" },
];

export default function RenewalsSection({
  renewals,
}: {
  renewals: RenewalInput[];
}) {
  const [local, setLocal] = useState<RenewalInput[]>([]);
  const [type, setType] = useState<RenewalType>("green_card");
  const [date, setDate] = useState("");
  const all = deriveRenewals([...renewals, ...local]);

  return (
    <section
      aria-labelledby="renewals-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="renewals-heading" className="text-base font-semibold">
        Your renewals
      </h2>
      {all.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">
          No renewals on file yet — add your green card, work permit, TPS,
          or passport expiry date below and the reminder date is worked out
          from it. No date is guessed for you.
        </p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {all.map((r) => (
            <li
              key={r.id}
              className="rounded border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <strong>{RENEWAL_TYPE_LABEL[r.type]}</strong> — file{" "}
              {RENEWAL_FORM_TO_FILE[r.type]}. Expiry / eligibility:{" "}
              {r.eligibilityOrExpiryDate}. Reminder window opens{" "}
              {r.remindOn} ({r.daysUntilDue} day
              {r.daysUntilDue === 1 ? "" : "s"} until the date). Status:{" "}
              {r.status === "done"
                ? "Done"
                : r.isDue
                  ? "Due — a nudge is queued every 48h in your language until this is cleared (queued only — no message provider is connected, so nothing has been sent)"
                  : "Upcoming"}
              {r.nextNudgeAt && r.status !== "done" && (
                <> Next nudge queued for {new Date(r.nextNudgeAt).toLocaleString()}.</>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as RenewalType)}
          aria-label="Renewal type"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Expiry or eligibility date"
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            if (!date) return;
            setLocal((rows) => [
              ...rows,
              {
                id: `local-${rows.length + 1}`,
                caseId: "example-case",
                type,
                eligibilityOrExpiryDate: date,
                status: "upcoming",
              },
            ]);
            setDate("");
          }}
          className="rounded bg-slate-900 px-3 py-1 text-sm font-semibold text-white"
        >
          Add renewal (example — local only)
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Dates you add here are example / local-only until Supabase is
        connected — they are not saved to a case yet. Green Card (I-90):
        file 6 months before expiry. Conditional Green Card (I-751):
        90-day filing window. EAD / TPS: 180-day renewal window.
      </p>
    </section>
  );
}
