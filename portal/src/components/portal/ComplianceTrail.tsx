"use client";

import { useState } from "react";
import { EXAMPLE_ACTIVITY, canTransfer, type EscalationRequest } from "@/lib/activity";

export default function ComplianceTrail() {
  const [consented, setConsented] = useState(false);
  const [attorneyAccepted, setAttorneyAccepted] = useState(false);
  const [attorneyId, setAttorneyId] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  const req: EscalationRequest = {
    caseId: "example-case-i130",
    fromProviderRole: "preparer",
    toAttorneyId: attorneyId,
    clientConsented: consented,
    attorneyAccepted,
    status: requested
      ? canTransfer({ caseId: "example-case-i130", fromProviderRole: "preparer", toAttorneyId: attorneyId, clientConsented: consented, attorneyAccepted, status: "not_requested" })
        ? "transferred"
        : "awaiting_attorney"
      : "not_requested",
  };
  const transferable = canTransfer(req);

  return (
    <section
      aria-labelledby="compliance-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="compliance-heading" className="text-base font-semibold">
        Compliance, Security &amp; Audit Trail
      </h2>

      <h3 className="mt-3 text-sm font-semibold">Timestamped Activity Log</h3>
      <p className="text-xs text-slate-500">
        Example entries — real log is audit_log (0001) + 0003 trigger, view
        client_activity_log in migration 0006.
      </p>
      <ul className="mt-2 space-y-2 text-sm">
        {EXAMPLE_ACTIVITY.map((a) => (
          <li key={a.id} className="rounded border border-slate-200 px-3 py-2">
            <p className="font-medium">{a.label}</p>
            <p className="text-xs text-slate-500">
              Action: {a.action} · Actor: {a.actor} · IP: {a.ipAddress} ·{" "}
              {a.at}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded border border-blue-300 bg-blue-50 p-3">
        <h3 className="text-sm font-semibold">
          Provider Role Lock &amp; Escalation
        </h3>
        <p className="mt-1 text-sm">
          Your case is with a document preparer (clerical only). You can
          ask for it to be upgraded / referred to a licensed attorney.
        </p>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input
            id="escalation-consent"
            type="checkbox"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
            className="mt-0.5"
          />
          I consent to my case being transferred to a licensed attorney.
          (Explicit client consent is required — no auto-transfer.)
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input
            id="escalation-attorney-accept"
            type="checkbox"
            checked={attorneyAccepted}
            onChange={(e) => {
              setAttorneyAccepted(e.target.checked);
              setAttorneyId(e.target.checked ? "example-attorney" : null);
            }}
            className="mt-0.5"
          />
          Example Attorney has accepted the case (example only — no real
          attorney is assigned; attorney acceptance is required).
        </label>
        <p className="mt-2 text-xs text-slate-600">
          Documents move only within the case. The preparer loses access
          once transferred unless the attorney re-assigns them. Transfer
          allowed now (canTransfer):{" "}
          <strong>{transferable ? "Yes" : "No"}</strong> — needs both your
          consent and attorney acceptance.
        </p>
        <button
          type="button"
          disabled={!transferable}
          onClick={() => setRequested(true)}
          className="mt-2 rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
        >
          {requested
            ? "Escalation requested (example only — nothing was transferred)"
            : "Upgrade / Refer to Licensed Attorney"}
        </button>
        {requested && (
          <p role="status" className="mt-2 text-sm font-semibold text-green-700">
            Example only — this records a request in local state. No case
            was transferred, because transfer is never automatic.
          </p>
        )}
      </div>
    </section>
  );
}
