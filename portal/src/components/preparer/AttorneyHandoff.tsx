// Escalation + handoff — preparer dashboard.
// "Upgrade / Refer to Licensed Attorney": needs EXPLICIT client consent
// AND attorney acceptance. Documents move only within the case; the
// preparer LOSES ACCESS on transfer unless the attorney re-assigns them.
// Warm referral inbox (example, local only). Attorney / DOJ directory is
// OPT-IN ONLY, bar / DOJ verified, no per-lead or percentage fees.
// A referral is NEVER a lock on the client.
"use client";

import { useState } from "react";
import { GetAnAttorneyButtons } from "@/components/preparer/UplBadge";

const DIRECTORY_EXAMPLE = [
  {
    name: "Example Attorney A (example — opt-in directory entry, not a real person)",
    detail: "Licensed attorney — bar verification pending in this example. Accepts I-601 / I-601A / complex RFE referrals.",
  },
  {
    name: "Example DOJ-Accredited Representative (example — opt-in directory entry, not a real person)",
    detail: "DOJ-accredited representative, recognised organisation — DOJ verification pending in this example.",
  },
] as const;

export default function AttorneyHandoff() {
  const [clientConsent, setClientConsent] = useState(false);
  const [attorneyAccepted, setAttorneyAccepted] = useState(false);
  const [transferred, setTransferred] = useState(false);
  const [inbox, setInbox] = useState<string[]>([
    "Example warm referral (example): Example Attorney A accepted a complex-RFE referral on 2026-11-18 — documents moved within the case only.",
  ]);
  const [note, setNote] = useState("");

  const canTransfer = clientConsent && attorneyAccepted && !transferred;

  return (
    <section
      aria-labelledby="handoff-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="handoff-heading" className="text-lg font-semibold">
        Escalation &amp; Handoff — Upgrade / Refer to Licensed Attorney
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        For I-601, I-601A, I-212, I-589, complex RFE/NOID, and red-flag /
        VAWA / U / T cases. The client is never locked out — they keep full
        access while a referral is pending.
      </p>
      <div className="mt-3">
        <GetAnAttorneyButtons reason="a case that needs legal help" />
      </div>

      <h3 className="mt-5 text-sm font-semibold">Transfer checklist — both steps required</h3>
      <label className="mt-2 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={clientConsent}
          onChange={(e) => setClientConsent(e.target.checked)}
        />
        <span>
          <strong>Explicit client consent</strong> — the client agreed in
          writing to transfer their case to a licensed attorney / DOJ
          representative.
        </span>
      </label>
      <label className="mt-2 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={attorneyAccepted}
          onChange={(e) => setAttorneyAccepted(e.target.checked)}
        />
        <span>
          <strong>Attorney acceptance</strong> — the receiving attorney /
          DOJ representative accepted the case.
        </span>
      </label>
      <button
        type="button"
        disabled={!canTransfer}
        onClick={() => {
          setTransferred(true);
          setInbox((items) => [
            ...items,
            `Example transfer (example — local only): Example Client A transferred on ${new Date().toISOString().slice(0, 10)} with client consent + attorney acceptance. Documents moved only within the case.`,
          ]);
        }}
        className="mt-3 rounded bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        Transfer case to attorney (example)
      </button>
      {!canTransfer && !transferred && (
        <p className="mt-1 text-xs text-slate-500">
          Transfer stays disabled until BOTH consent and acceptance are
          checked. No transfer happens without them.
        </p>
      )}
      {transferred && (
        <p role="status" className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900">
          Case transferred (example). You have LOST ACCESS to this case —
          documents moved only within the case, and access returns only if
          the attorney re-assigns you. This is enforced in migration 0012
          (preparer_attorney_referrals + RLS) once applied.
        </p>
      )}

      <h3 className="mt-5 text-sm font-semibold">Warm referral inbox (example — local only)</h3>
      <ul className="mt-2 space-y-1">
        {inbox.map((item, i) => (
          <li key={i} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{item}</li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Log a referral reply (example)"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            if (!note.trim()) return;
            setInbox((items) => [...items, note.trim()]);
            setNote("");
          }}
          className="rounded bg-slate-700 px-3 py-1 text-sm font-medium text-white"
        >
          Add to inbox
        </button>
      </div>

      <h3 className="mt-5 text-sm font-semibold">
        Attorney / DOJ directory — opt-in only, bar / DOJ verified
      </h3>
      <p className="mt-1 text-xs text-slate-600">
        No per-lead or percentage fees are ever charged for a referral.
        Directory entries appear only after the attorney / representative
        opts in and verification is confirmed.
      </p>
      <ul className="mt-2 space-y-2">
        {DIRECTORY_EXAMPLE.map((d) => (
          <li key={d.name} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <strong>{d.name}</strong>
            <p className="mt-1 text-xs text-slate-600">{d.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
