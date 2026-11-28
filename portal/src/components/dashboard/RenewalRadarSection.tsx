// Renewal & Expiry Radar — DASHBOARD section (Nov 28, 2026).
// Green card, work permit (EAD), advance parole, TPS, passport and
// visa expiries, per client, with the 180/90/30/7-day reminder ladder
// (see src/lib/renewals.ts). Client dashboards show the client's own
// radar; professional dashboards show every client in the pipeline,
// soonest deadline first. Renewal forms link their locked Basic
// preparation price — the USCIS government fee is separate and is
// confirmed at uscis.gov/fees before paying. No date is ever
// invented: with no dates on file the honest empty state shows.
"use client";

import Link from "next/link";
import {
  deriveRenewals,
  RENEWAL_FORM_TO_FILE,
  RENEWAL_TYPE_LABEL,
  renewalPrepPrice,
  type RenewalInput,
} from "@/lib/renewals";

export default function RenewalRadarSection({
  renewals,
  audience,
  caseLabels,
}: {
  renewals: RenewalInput[];
  audience: "client" | "professional";
  /** Professional view: case id -> client label (name or case label —
   *  never an A-Number, SSN, DOB or passport number). */
  caseLabels?: Record<string, string>;
}) {
  const derived = deriveRenewals(renewals);
  const dueCount = derived.filter((r) => r.isDue && r.status !== "done").length;
  const soonest = derived.filter((r) => r.status !== "done")[0];

  return (
    <section
      aria-label="Renewal and expiry radar"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-base font-semibold">
        Renewal &amp; Expiry Radar
        {audience === "professional" && derived.length > 0
          ? ` — ${derived.length} date${derived.length === 1 ? "" : "s"} on file, soonest first`
          : ""}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {audience === "client"
          ? "Your green card, work permit, advance parole, TPS, passport and visa expiries — with reminders at 180, 90, 30 and 7 days before each date."
          : "Every client in your pipeline, soonest deadline first — with reminders at 180, 90, 30 and 7 days before each date."}
      </p>
      {derived.length === 0 ? (
        <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          No renewals due — no expiry or eligibility date is on file
          {audience === "professional" ? " for any client in your pipeline" : " for you"} yet.
          Add a date in the Client Portal and the reminder date is worked
          out from it. No date is guessed for you.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm">
            {dueCount > 0 ? (
              <strong className="text-amber-800">
                {dueCount} renewal{dueCount === 1 ? "" : "s"} in the reminder window now.
              </strong>
            ) : (
              <span className="text-slate-600">
                Nothing is in the reminder window yet.
                {soonest
                  ? ` Soonest: ${RENEWAL_TYPE_LABEL[soonest.type]} on ${soonest.eligibilityOrExpiryDate} (${soonest.daysUntilDue} days away).`
                  : ""}
              </span>
            )}
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            {derived.map((r) => {
              const prep = renewalPrepPrice(r.type);
              return (
                <li
                  key={r.id}
                  className="rounded border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <p>
                    <strong>{RENEWAL_TYPE_LABEL[r.type]}</strong>
                    {audience === "professional" && caseLabels?.[r.caseId]
                      ? ` — ${caseLabels[r.caseId]}`
                      : ""}
                    {" — "}file {RENEWAL_FORM_TO_FILE[r.type]}.
                  </p>
                  <p className="text-slate-600">
                    Expiry / eligibility: {r.eligibilityOrExpiryDate} (
                    {r.daysUntilDue} day{r.daysUntilDue === 1 ? "" : "s"} away).
                    Reminder window opens {r.remindOn}. Status:{" "}
                    {r.status === "done"
                      ? "Done"
                      : r.isDue
                        ? "Due — reminder queued every 48h until cleared (queued only — no message provider is connected, so nothing has been sent)"
                        : "Upcoming"}
                  </p>
                  {r.reminderRungsDue.length > 0 && r.status !== "done" && (
                    <p className="text-slate-600">
                      Reminder ladder reached:{" "}
                      {r.reminderRungsDue.map((d) => `${d}-day`).join(", ")}.
                    </p>
                  )}
                  {prep && (
                    <p className="text-slate-600">
                      Our preparation fee (Basic): $
                      {(prep.amountCents / 100).toLocaleString("en-US")} —{" "}
                      {prep.label}. The USCIS government fee is separate;
                      confirm it at uscis.gov/fees before paying.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className="mt-3 text-sm">
        <Link href="/today" className="font-semibold text-blue-700 underline">
          Today&apos;s reminders →
        </Link>{" "}
        <Link href="/portal" className="font-semibold text-blue-700 underline">
          Manage dates in the Client Portal →
        </Link>
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Green Card (I-90): file 6 months before expiry. Conditional Green
        Card (I-751): 90-day filing window. EAD / TPS / advance parole:
        180-day renewal window.
      </p>
    </section>
  );
}
