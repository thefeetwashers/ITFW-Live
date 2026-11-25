// USCIS & NVC Case Number Hub — preparer view, synced to the Client &
// Family Portal. "Save & Sync" writes locally only (local state): the
// shared-state note below explains that real sync is one Supabase row
// once wired. Anything logged as "Missing from USCIS or NVC" appears
// here AND in the family portal view (both read the same shared source).
// NVC has NO API — CEAC tracking is manual; link out, never store a
// CEAC password. USCIS live status needs the Production key + worker —
// not built. No live USCIS / NVC sync is claimed anywhere.
"use client";

import { useMemo, useState } from "react";
import {
  CEAC_LOGIN_URL,
  EXAMPLE_AGENCY_NUMBERS,
  type AgencyNumber,
} from "@/lib/agency";

const LOGGABLE_MISSING = [
  "RFE (Request for Evidence)",
  "NVC CEAC civil-document rejection",
  "I-864 joint-sponsor tax transcript",
  "Police Certificate",
  "2025 IRS Tax Transcript",
] as const;

export default function AgencyNumberHub() {
  const [numbers, setNumbers] = useState<AgencyNumber[]>(
    EXAMPLE_AGENCY_NUMBERS
  );
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [newMissing, setNewMissing] = useState<string>(LOGGABLE_MISSING[0]);
  const [newMissingNote, setNewMissingNote] = useState("");

  const missingItems = useMemo(
    () =>
      numbers.flatMap((n) =>
        n.missingFromAgency
          ? [
              {
                id: n.id,
                agency: n.agency,
                formOrStage: n.formOrStage,
                item: n.missingFromAgency,
                deadline: n.agencyDeadline ?? null,
              },
            ]
          : []
      ),
    [numbers]
  );

  const updateNumber = (id: string, field: "caseNumber" | "nvcInvoiceId", value: string) =>
    setNumbers((prev) =>
      prev.map((n) => (n.id === id ? { ...n, [field]: value } : n))
    );

  const logMissing = () => {
    const target = numbers.find((n) => n.agency === "NVC") ?? numbers[0];
    if (!target) return;
    const label = newMissingNote.trim()
      ? `${newMissing} — ${newMissingNote.trim()}`
      : newMissing;
    setNumbers((prev) =>
      prev.map((n) =>
        n.id === target.id
          ? {
              ...n,
              missingFromAgency: n.missingFromAgency
                ? `${n.missingFromAgency}; ${label}`
                : label,
              agencyStatus: `What ${n.agency} Says Is Missing: ${label} (example)`,
            }
          : n
      )
    );
    setNewMissingNote("");
  };

  const saveAndSync = () => setSavedAt(new Date().toISOString());

  return (
    <section
      aria-labelledby="agency-hub-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="agency-hub-heading" className="text-lg font-semibold">
        USCIS &amp; NVC Case Number Hub
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Synced to the Client &amp; Family Portal. Example numbers only —
        no live USCIS / NVC sync. USCIS live status needs the Production
        key + worker (not built). NVC has no API: CEAC tracking is manual.
      </p>

      <div className="mt-4 space-y-3">
        {numbers.map((n) => (
          <article
            key={n.id}
            className="rounded border border-slate-200 bg-slate-50 p-3"
          >
            <p className="text-sm font-semibold">
              {n.agency} — {n.formOrStage}
            </p>
            <label className="mt-2 block text-xs font-medium text-slate-600">
              {n.agency === "NVC" ? "NVC Case Number" : "USCIS Receipt Number"}
              <input
                type="text"
                value={n.caseNumber}
                onChange={(e) =>
                  updateNumber(n.id, "caseNumber", e.target.value)
                }
                className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm"
              />
            </label>
            {n.agency === "NVC" && (
              <label className="mt-2 block text-xs font-medium text-slate-600">
                NVC Invoice ID
                <input
                  type="text"
                  value={n.nvcInvoiceId ?? ""}
                  onChange={(e) =>
                    updateNumber(n.id, "nvcInvoiceId", e.target.value)
                  }
                  className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                />
              </label>
            )}
            <p className="mt-2 text-sm text-slate-700">
              Status: {n.agencyStatus}
            </p>
            <p className="text-xs text-slate-500">
              Visible to client: {n.visibleToClient ? "yes" : "no"} · Visible
              to family: {n.visibleToFamily ? "yes" : "no"}
              {n.agencyDeadline ? ` · Agency deadline: ${n.agencyDeadline}` : ""}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={saveAndSync}
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Save &amp; Sync
        </button>
        {savedAt && (
          <p className="text-sm text-green-700" role="status">
            Saved locally at {new Date(savedAt).toLocaleString()} —
            visible_to_client = true, visible_to_family = true.
          </p>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Sync = one Supabase row, visible in preparer + client + family
        portals (shared state), manual entry until the APIs exist.
      </p>

      <h3 className="mt-5 text-sm font-semibold">
        Missing from USCIS or NVC — appears here and in the family portal
      </h3>
      {missingItems.length === 0 ? (
        <p className="mt-1 text-sm text-slate-600">
          Nothing logged as missing.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {missingItems.map((m) => (
            <li
              key={m.id}
              className="rounded border border-red-200 bg-red-50 p-3 text-sm"
            >
              <span className="font-medium">
                {m.agency} ({m.formOrStage}):
              </span>{" "}
              {m.item}
              {m.deadline && (
                <span className="block text-xs text-slate-600">
                  Deadline: {m.deadline}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 rounded border border-slate-200 p-3">
        <label className="block text-xs font-medium text-slate-600">
          Log a missing item (RFE, NVC CEAC rejection, I-864 tax transcript…)
          <span className="mt-1 flex flex-wrap gap-2">
            <select
              value={newMissing}
              onChange={(e) => setNewMissing(e.target.value)}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              {LOGGABLE_MISSING.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newMissingNote}
              onChange={(e) => setNewMissingNote(e.target.value)}
              placeholder="Optional note (example)"
              className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={logMissing}
              className="rounded bg-slate-700 px-3 py-1 text-sm font-medium text-white hover:bg-slate-800"
            >
              Log as missing
            </button>
          </span>
        </label>
        <p className="mt-2 text-xs text-slate-500">
          Logging here adds the item to this hub and to the family portal
          view (shared state once Supabase is wired; local state in this
          example build).
        </p>
      </div>

      <p className="mt-4 text-sm">
        NVC CEAC:{" "}
        <a
          href={CEAC_LOGIN_URL}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-blue-700 underline"
        >
          Open CEAC login (ceac.state.gov)
        </a>{" "}
        — manual tracking only. Never store a CEAC password here.
      </p>
    </section>
  );
}
