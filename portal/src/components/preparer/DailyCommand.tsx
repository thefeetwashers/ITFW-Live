// Daily Command view — preparer dashboard.
// Everything below is EXAMPLE data, local state only, labelled as such:
// today's deadlines, overdue items, new messages, new uploads, and
// follow-ups due. Live rows come from cases / reminder_nudges /
// preparer_leads once Supabase is connected — nothing here claims live.
"use client";

import { useState } from "react";
import {
  deriveRenewals,
  RENEWAL_FORM_TO_FILE,
  RENEWAL_TYPE_LABEL,
  type RenewalInput,
} from "@/lib/renewals";

interface CommandRow {
  id: string;
  kind: "deadline" | "overdue" | "message" | "upload" | "follow_up";
  label: string;
  detail: string;
  due: string;
}

const EXAMPLE_ROWS: CommandRow[] = [
  { id: "c1", kind: "deadline", label: "Review joint bank statement retake", detail: "Example Client A — I-130 + I-485", due: "Today" },
  { id: "c2", kind: "overdue", label: "I-864 joint-sponsor tax transcript still missing", detail: "Example Client A — logged in USCIS & NVC hub", due: "Overdue — was due 2026-11-18" },
  { id: "c3", kind: "message", label: "New portal message", detail: "Example Client A: “I re-uploaded my bank statement.”", due: "Today" },
  { id: "c4", kind: "upload", label: "New upload to review", detail: "Example Client A — joint bank statement (retake)", due: "Today" },
  { id: "c5", kind: "follow_up", label: "Follow up Example Lead A", detail: "Quote sent — Pay in 3 offered", due: "Today" },
  { id: "c6", kind: "deadline", label: "NVC fee reminder — Example Client B", detail: "Consular case — $120 AOS + $325 IV in CEAC", due: "This week" },
];

const KIND_LABEL: Record<CommandRow["kind"], string> = {
  deadline: "Today's deadline",
  overdue: "Overdue",
  message: "New message",
  upload: "New upload",
  follow_up: "Follow-up due",
};

export default function DailyCommand({
  liveRenewals = [],
}: {
  /** Real case_renewals rows (migration 0014/0017). Empty = none on file. */
  liveRenewals?: RenewalInput[];
}) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const open = EXAMPLE_ROWS.filter((r) => !done[r.id]);
  const counts = (kind: CommandRow["kind"]) =>
    open.filter((r) => r.kind === kind).length;
  const renewals = deriveRenewals(liveRenewals);

  return (
    <section
      aria-labelledby="daily-command-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="daily-command-heading" className="text-lg font-semibold">
        Daily Command — Today
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Example data — not live. {open.length} open item(s):{" "}
        {counts("deadline")} deadline(s) · {counts("overdue")} overdue ·{" "}
        {counts("message")} new message(s) · {counts("upload")} new upload(s)
        · {counts("follow_up")} follow-up(s) due.
      </p>
      <ul className="mt-3 space-y-2">
        {open.map((r) => (
          <li
            key={r.id}
            className={`flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-sm ${
              r.kind === "overdue"
                ? "border-red-300 bg-red-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <span>
              <strong>{KIND_LABEL[r.kind]}:</strong> {r.label} — {r.detail}{" "}
              <span className="text-xs text-slate-500">({r.due})</span>
            </span>
            <button
              type="button"
              onClick={() => setDone((d) => ({ ...d, [r.id]: true }))}
              className="rounded bg-slate-700 px-2 py-1 text-xs font-semibold text-white"
            >
              Mark done (example)
            </button>
          </li>
        ))}
      </ul>
      {open.length === 0 && (
        <p className="mt-2 text-sm text-green-700">
          All example items done for today.
        </p>
      )}

      {/* Renewals coming up — derived from REAL case_renewals rows
          (migration 0014, types widened in 0017) once Supabase is
          connected. Until then these are example rows only, labelled
          as such — no renewal date is invented. Green Card (I-90):
          6 months before expiry. Conditional Green Card (I-751):
          90-day window. EAD / TPS: 180-day window. */}
      <h3 className="mt-5 text-sm font-semibold">Renewals coming up</h3>
      {renewals.length > 0 ? (
        <ul className="mt-2 space-y-2 text-sm">
          {renewals.map((r) => (
            <li key={r.id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
              {RENEWAL_TYPE_LABEL[r.type]} — file {RENEWAL_FORM_TO_FILE[r.type]}.
              Expiry / eligibility {r.eligibilityOrExpiryDate}; reminder window
              opens {r.remindOn};{" "}
              {r.status === "done"
                ? "done."
                : r.isDue
                  ? "due — nudge queued every 48h in the client's language (queued only, nothing sent)."
                  : `${r.daysUntilDue} day(s) until the date.`}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          <li className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
            No renewals coming up — no real renewal dates are on file for your
            cases yet.
          </li>
          <li className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
            Example Client C — TPS renewal window (I-821 + I-765) opens in
            180 days (example — confirm the current TPS dates at uscis.gov
            before telling a client anything).
          </li>
          <li className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
            Example Client D — Green Card renewal (I-90) due 6 months before
            the card&apos;s expiry date (example — check the card&apos;s expiry
            date, never guess it).
          </li>
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Live rows come from case_renewals once Supabase is connected; a
        nudge is queued every 48h in the client&apos;s language once a
        renewal is due (queued only — Twilio/Resend are NOT connected, so
        nothing has been sent).
      </p>
    </section>
  );
}
