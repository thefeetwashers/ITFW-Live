// Lead follow-up: quote expiry, follow-up reminders, lost-lead reason.
// The DATABASE already has these fields (migration 0010 preparer_leads:
// quote_expires_at, lost_reason with the lost_reason_only_when_lost
// check) — this is the UI that was missing. Local example state only
// until the table is wired; nothing here claims a live Supabase write.
"use client";

import { useState } from "react";

interface FollowUpLead {
  id: string;
  name: string;
  service: string;
  quotedFee: string;
  quoteExpires: string;
  followUpDate: string;
  stage: "quote_sent" | "lost" | "converted";
  lostReason: string;
  reminder: string;
}

const LOST_REASONS = [
  "Chose another provider",
  "Price — could not afford the prep fee",
  "Decided not to file yet",
  "No response after 3 follow-ups",
  "Referred to an attorney (complex case)",
  "Other",
] as const;

export default function LeadFollowUp() {
  const [leads, setLeads] = useState<FollowUpLead[]>([
    {
      id: "lf-1",
      name: "Example Lead A",
      service: "I-130 Petition",
      quotedFee: "$999 prep fee (Basic) — USCIS $675 TO BE CONFIRMED, separate",
      quoteExpires: "2026-12-03",
      followUpDate: "2026-11-21",
      stage: "quote_sent",
      lostReason: "",
      reminder: "",
    },
    {
      id: "lf-2",
      name: "Example Lead B",
      service: "I-485 Adjustment",
      quotedFee: "$1,799 prep fee (Standard) — USCIS $1,440 locked, separate",
      quoteExpires: "2026-11-20",
      followUpDate: "2026-11-19",
      stage: "quote_sent",
      lostReason: "",
      reminder: "",
    },
  ]);
  const [notice, setNotice] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const update = (id: string, patch: Partial<FollowUpLead>) =>
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  return (
    <section
      aria-labelledby="lead-followup-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="lead-followup-heading" className="text-lg font-semibold">
        Quotes — Expiry, Follow-Up Reminders &amp; Lost-Lead Reasons
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Example leads, local only. A quote states the prep fee and,
        separately, the USCIS/NVC government fee (or TO BE CONFIRMED). Quote
        expiry and lost-lead reason live in preparer_leads (migration 0010:
        quote_expires_at, lost_reason) once wired.
      </p>
      <ul className="mt-3 space-y-3">
        {leads.map((l) => {
          const expired = l.stage === "quote_sent" && l.quoteExpires < today;
          const followUpDue = l.stage === "quote_sent" && l.followUpDate <= today;
          return (
            <li key={l.id} className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              <p>
                <strong>{l.name}</strong> — {l.service} — {l.quotedFee}
              </p>
              <p className="mt-1">
                Quote expires:{" "}
                <strong className={expired ? "text-red-700" : ""}>
                  {l.quoteExpires}
                  {expired ? " — EXPIRED (re-quote before converting; never invent a price)" : ""}
                </strong>{" "}
                · Follow-up date:{" "}
                <strong className={followUpDue ? "text-amber-800" : ""}>
                  {l.followUpDate}
                  {followUpDue ? " — due" : ""}
                </strong>{" "}
                · Stage: <strong>{l.stage === "quote_sent" ? "Quote sent" : l.stage === "lost" ? "Lost" : "Converted"}</strong>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-xs">
                  Quote expiry
                  <input
                    type="date"
                    value={l.quoteExpires}
                    onChange={(e) => update(l.id, { quoteExpires: e.target.value })}
                    className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                  />
                </label>
                <label className="flex items-center gap-1 text-xs">
                  Follow-up date
                  <input
                    type="date"
                    value={l.followUpDate}
                    onChange={(e) => update(l.id, { followUpDate: e.target.value })}
                    className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    update(l.id, { reminder: `Follow-up reminder queued (example — not sent): ${l.name}, quote expires ${l.quoteExpires}.` });
                    setNotice("Reminder queued only — Twilio / Resend are NOT connected, so nothing was sent.");
                  }}
                  className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white"
                >
                  Queue follow-up reminder
                </button>
                <select
                  value={l.lostReason}
                  onChange={(e) => {
                    const reason = e.target.value;
                    update(l.id, { lostReason: reason, stage: reason ? "lost" : "quote_sent" });
                  }}
                  aria-label="Lost-lead reason"
                  className="rounded border border-slate-300 bg-white px-1 py-0.5 text-xs"
                >
                  <option value="">Mark lost — choose a reason…</option>
                  {LOST_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {l.stage === "lost" && (
                  <button
                    type="button"
                    onClick={() => update(l.id, { stage: "quote_sent", lostReason: "" })}
                    className="rounded bg-slate-700 px-2 py-1 text-xs font-semibold text-white"
                  >
                    Reopen lead
                  </button>
                )}
              </div>
              {l.reminder && <p className="mt-1 text-xs text-amber-800">{l.reminder}</p>}
              {l.stage === "lost" && (
                <p className="mt-1 text-xs text-slate-600">
                  Lost reason recorded: {l.lostReason}. (preparer_leads.lost_reason is only set when pipeline_stage = &apos;lost&apos;.)
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {notice && (
        <p role="status" className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {notice}
        </p>
      )}
    </section>
  );
}
