"use client";

import { useMemo, useState } from "react";
import {
  EXAMPLE_VERIFICATIONS,
  type VerificationRow,
} from "@/lib/example-data";
import EoirRosterLinks from "@/components/EoirRosterLinks";

type Filter = "all" | "pending" | "verified" | "rejected" | "expired";

interface AuditEntry {
  id: number;
  actor: string;
  action: string;
  rowName: string;
  reason: string;
  timestamp: string;
}

interface RowState extends VerificationRow {
  rejectReason?: string;
  moreInfoNote?: string;
}

// Local example row demonstrating the self-verification block.
// Not a real person and not a real admin identity.
const SELF_ROW: RowState = {
  id: "ver-self",
  name: "Example Admin (you)",
  role: "attorney",
  submitted: "2026-11-19",
  barNumber: "FL-000002 (example)",
  barStates: ["Florida"],
  status: "pending",
  notes:
    "Example row for the signed-in admin. Self-approval is blocked — see the notice below.",
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "verified", label: "Verified" },
  { id: "rejected", label: "Rejected" },
  { id: "expired", label: "Expired" },
];

export default function VerificationQueue() {
  const [rows, setRows] = useState<RowState[]>([
    ...EXAMPLE_VERIFICATIONS,
    SELF_ROW,
  ]);
  const [filter, setFilter] = useState<Filter>("all");
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const visibleRows = useMemo(
    () =>
      filter === "all" ? rows : rows.filter((r) => r.status === filter),
    [filter, rows]
  );

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: rows.length,
      pending: 0,
      verified: 0,
      rejected: 0,
      expired: 0,
    };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const log = (action: string, row: RowState, reason: string) => {
    setAudit((prev) => [
      {
        id: prev.length + 1,
        actor: "Example Admin",
        action,
        rowName: row.name,
        reason,
        timestamp: new Date().toLocaleString(),
      },
      ...prev,
    ]);
  };

  const updateRow = (
    id: string,
    patch: Partial<RowState>,
    action: string,
    reason: string
  ) => {
    setRows((prev) => {
      const row = prev.find((r) => r.id === id);
      if (row) log(action, row, reason);
      return prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
    });
  };

  const approve = (row: RowState) =>
    updateRow(row.id, { status: "verified" }, "Approve", "—");
  const requestMoreInfo = (row: RowState) =>
    updateRow(
      row.id,
      { moreInfoNote: "More info requested by Example Admin." },
      "Request more info",
      "—"
    );
  const confirmReject = (row: RowState) => {
    const reason = rejectReason.trim();
    if (!reason) return;
    updateRow(
      row.id,
      { status: "rejected", rejectReason: reason },
      "Reject",
      reason
    );
    setRejectingId(null);
    setRejectReason("");
  };

  return (
    <div className="space-y-6">
      <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Example queue — no real verification is performed in this build.
        Approvals here update local state only until wired to Supabase.
      </div>

      <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
        <strong>Self-verification is blocked.</strong> You cannot approve your
        own account — the database trigger in migration 0001 blocks non-admin
        verification changes and an admin cannot self-approve. The Approve
        button on the “Example Admin (you)” row below is disabled for this
        reason.
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">
          Check the official source before approving a nonprofit:
        </p>
        <EoirRosterLinks compact />
      </div>

      <div
        role="group"
        aria-label="Filter verification queue"
        className="flex flex-wrap gap-2"
      >
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={
              "rounded-full border px-3 py-1.5 text-sm font-medium " +
              (filter === f.id
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-blue-400")
            }
          >
            {f.label} ({counts[f.id]})
          </button>
        ))}
      </div>

      {visibleRows.length === 0 ? (
        <p className="rounded border border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
          No rows match this filter.
        </p>
      ) : (
        <ul className="space-y-4">
          {visibleRows.map((row) => {
            const isSelf = row.id === SELF_ROW.id;
            const isPending = row.status === "pending";
            return (
              <li
                key={row.id}
                className="rounded-lg border border-slate-300 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {row.name}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {row.role === "attorney"
                        ? "Licensed Attorney"
                        : "DOJ-Accredited Nonprofit"}{" "}
                      · Submitted {row.submitted}
                    </p>
                  </div>
                  <span
                    className={
                      "rounded-full px-2.5 py-1 text-xs font-semibold " +
                      (row.status === "verified"
                        ? "bg-green-100 text-green-800"
                        : row.status === "rejected"
                          ? "bg-red-100 text-red-800"
                          : row.status === "expired"
                            ? "bg-slate-200 text-slate-700"
                            : "bg-amber-100 text-amber-800")
                    }
                  >
                    {row.status}
                  </span>
                </div>

                <dl className="mt-3 space-y-1 text-sm text-slate-700">
                  {row.barNumber && (
                    <>
                      <div className="flex gap-2">
                        <dt className="font-medium">Bar number:</dt>
                        <dd>{row.barNumber}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="font-medium">State(s):</dt>
                        <dd>{(row.barStates ?? []).join(", ")}</dd>
                      </div>
                    </>
                  )}
                  {row.eoirNumber && (
                    <>
                      <div className="flex gap-2">
                        <dt className="font-medium">EOIR number:</dt>
                        <dd>{row.eoirNumber}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="font-medium">Accreditation level:</dt>
                        <dd>{row.accreditationLevel}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="font-medium">Accreditation expiry:</dt>
                        <dd>{row.accreditationExpiry}</dd>
                      </div>
                    </>
                  )}
                  <div className="flex gap-2">
                    <dt className="font-medium">Notes:</dt>
                    <dd>{row.notes}</dd>
                  </div>
                  {row.rejectReason && (
                    <div className="flex gap-2 text-red-800">
                      <dt className="font-medium">Rejection reason:</dt>
                      <dd>{row.rejectReason}</dd>
                    </div>
                  )}
                  {row.moreInfoNote && (
                    <div className="flex gap-2 text-amber-800">
                      <dt className="font-medium">Follow-up:</dt>
                      <dd>{row.moreInfoNote}</dd>
                    </div>
                  )}
                </dl>

                {isPending && (
                  <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isSelf}
                        title={
                          isSelf
                            ? "You cannot approve your own account — the database trigger in migration 0001 blocks non-admin verification changes and an admin cannot self-approve."
                            : undefined
                        }
                        onClick={() => approve(row)}
                        className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingId(row.id);
                          setRejectReason("");
                        }}
                        className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => requestMoreInfo(row)}
                        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Request more info
                      </button>
                    </div>
                    {isSelf && (
                      <p className="text-xs text-red-700">
                        Approve is disabled: you cannot approve your own
                        account — the database trigger in migration 0001 blocks
                        non-admin verification changes and an admin cannot
                        self-approve.
                      </p>
                    )}
                    {rejectingId === row.id && (
                      <div className="space-y-2 rounded border border-red-200 bg-red-50 p-3">
                        <label className="block text-sm font-medium text-slate-700">
                          Reason for rejection (required)
                          <input
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="e.g. Bar number could not be confirmed"
                          />
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={!rejectReason.trim()}
                            onClick={() => confirmReject(row)}
                            className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Confirm rejection
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectingId(null)}
                            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <section aria-label="Audit log" className="rounded-lg border border-slate-300 bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Audit Log</h2>
        <p className="mb-3 text-xs text-slate-500">
          Local state only in this build — entries are not saved to Supabase
          until the dashboard is wired to it.
        </p>
        {audit.length === 0 ? (
          <p className="text-sm text-slate-500">
            No actions yet. Approve, reject, or request more info on a pending
            row and it will appear here.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {audit.map((entry) => (
              <li
                key={entry.id}
                className="rounded border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <span className="font-medium">{entry.actor}</span> —{" "}
                <span className="font-medium">{entry.action}</span> —{" "}
                {entry.rowName}
                {entry.reason !== "—" && (
                  <>
                    {" "}
                    — Reason: <span>{entry.reason}</span>
                  </>
                )}{" "}
                <span className="text-slate-500">({entry.timestamp})</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
