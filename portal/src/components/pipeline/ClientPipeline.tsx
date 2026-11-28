// Client Pipeline — ONE shared component for the Preparer, Attorney
// and DOJ pipeline views (role-specific columns/filters, not three
// copies). Rows come from GET /api/pipeline (real DB rows only).
//
// Per row: client name, DOB MASKED (••/••/1990 — never the full date),
// phone, email, case stage (6-stage lifecycle), next step, missing-
// document checklist (formChecklists + packet audit), payment status
// (derived from Stripe invoice records in the DB — paid / instalment
// due / unpaid; never a front-end flag).
//
// Missing-document email: the draft is built from the 7-language
// templates and SHOWN to the professional first. They click once,
// SES sends it, and delivery status is recorded in notification_logs.
// Drafts with legal content are labelled "Draft — for a licensed
// attorney to review before sending" and cannot be sent until an
// attorney has reviewed them. When SES is not configured the send
// returns 501 and nothing is claimed sent.
"use client";

import { useState } from "react";
import {
  buildMissingDocDraft,
  pipelineEmptyState,
  pipelineRowMatchesRole,
  PAYMENT_STATUS_LABELS,
  PIPELINE_ROLE_COLUMNS,
  type PipelineClientRow,
  type PipelineRole,
} from "@/lib/pipeline";
import { stageDef } from "@/lib/lifecycle";

interface ClientPipelineProps {
  role: PipelineRole;
  rows: PipelineClientRow[];
  /** True when the rows came from the live API (not example data). */
  live: boolean;
  /** Reload rows after a send (parent re-fetches /api/pipeline). */
  onRefresh?: () => void;
}

export default function ClientPipeline({ role, rows, live, onRefresh }: ClientPipelineProps) {
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [legalContent, setLegalContent] = useState(false);
  const [attorneyReviewed, setAttorneyReviewed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  const visible = rows.filter((r) => pipelineRowMatchesRole(r, role));
  const extraColumns = PIPELINE_ROLE_COLUMNS[role];
  const draftRow = draftFor ? visible.find((r) => r.caseId === draftFor) ?? null : null;
  const draft = draftRow
    ? buildMissingDocDraft({
        clientName: draftRow.clientName,
        clientEmail: draftRow.email,
        service: draftRow.service,
        missingDocuments: draftRow.missingDocuments,
        language: draftRow.preferredLanguage,
        caseId: draftRow.caseId,
        legalContent,
        attorneyReviewed,
      })
    : null;

  async function sendDraft() {
    if (!draftRow || !draft || !draft.sendable) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/pipeline/draft-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId: draftRow.caseId,
          to: draftRow.email,
          clientName: draftRow.clientName,
          service: draftRow.service,
          missingDocuments: draftRow.missingDocuments,
          language: draftRow.preferredLanguage,
          legalContent,
          attorneyReviewed,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        ok?: boolean;
        status?: string;
        notConfigured?: boolean;
      };
      if (!res.ok) {
        setSendResult(
          data.error ??
            "The email could not be sent. Nothing was claimed sent."
        );
        return;
      }
      setSendResult(
        `Email sent via SES (status recorded: ${data.status ?? "sent"}). The client was emailed about ${draftRow.missingCount} missing document(s).`
      );
      setDraftFor(null);
      onRefresh?.();
    } catch {
      setSendResult("Could not reach the server. No email was sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      aria-labelledby="client-pipeline-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="client-pipeline-heading" className="text-lg font-semibold">
        Client Pipeline —{" "}
        {role === "preparer"
          ? "Preparer"
          : role === "attorney"
            ? "Attorney"
            : "DOJ-Accredited Representative"}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        One row per client case. Dates of birth are masked (••/••/year) —
        the full date is never shown here. Payment status comes from the
        invoice records in the database, never from a front-end flag.
      </p>
      {!live && (
        <p
          role="status"
          className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm font-medium text-amber-900"
        >
          Example data — not live. Supabase is not connected, so no live
          login, sync, or payment is claimed on this page.
        </p>
      )}

      {visible.length === 0 ? (
        <p role="status" className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          {pipelineEmptyState(role)}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left">
                <th className="p-2">Client</th>
                <th className="p-2">DOB (masked)</th>
                <th className="p-2">Phone</th>
                <th className="p-2">Email</th>
                <th className="p-2">Case stage</th>
                <th className="p-2">Next step</th>
                <th className="p-2">Missing documents</th>
                <th className="p-2">Payment</th>
                {extraColumns.map((c) => (
                  <th key={c.id} className="p-2">
                    {c.label}
                  </th>
                ))}
                <th className="p-2">Email draft</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.caseId} className="border-b border-slate-200 align-top">
                  <td className="p-2 font-medium">{row.clientName}</td>
                  <td className="p-2 font-mono">{row.dateOfBirthMasked}</td>
                  <td className="p-2">{row.phone ?? "Not provided"}</td>
                  <td className="p-2">{row.email}</td>
                  <td className="p-2">
                    Stage {row.stageNumber}: {stageDef(row.stage).shortLabel}
                    {row.stage5SubStage ? ` (${row.stage5SubStage})` : ""}
                  </td>
                  <td className="p-2">
                    {row.nextStep}
                    {row.nextStepByWhen ? (
                      <span className="block text-xs text-slate-500">{row.nextStepByWhen}</span>
                    ) : null}
                  </td>
                  <td className="p-2">
                    {row.missingCount === 0 ? (
                      <span className="text-green-700">None — checklist complete</span>
                    ) : (
                      <span>
                        {row.missingCount} missing
                        {row.packetReadinessPercent !== null
                          ? ` (${row.packetReadinessPercent}% ready)`
                          : ""}
                        <span className="block text-xs text-slate-500">
                          {row.missingDocuments.slice(0, 3).join("; ")}
                          {row.missingDocuments.length > 3
                            ? `; +${row.missingDocuments.length - 3} more`
                            : ""}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    {PAYMENT_STATUS_LABELS[row.paymentStatus]}
                    <span className="block text-xs text-slate-500">{row.paymentDetail}</span>
                  </td>
                  {role === "preparer" && (
                    <>
                      <td className="p-2">{row.missingCount} open item(s)</td>
                      <td className="p-2">
                        {row.missingCount > 0 ? "Follow up" : "Up to date"}
                      </td>
                    </>
                  )}
                  {role === "attorney" && (
                    <>
                      <td className="p-2">
                        {row.stageNumber >= 4
                          ? "Review the packet before filing"
                          : "Not at review stage yet"}
                      </td>
                      <td className="p-2">
                        Attorney review is required before any filing or
                        legal letter is sent.
                      </td>
                    </>
                  )}
                  {role === "doj" && (
                    <>
                      <td className="p-2">
                        Accreditation must be current before representing
                        this client.
                      </td>
                      <td className="p-2">
                        DOJ-recognised organisation only; no private
                        practice.
                      </td>
                    </>
                  )}
                  <td className="p-2">
                    {row.missingCount === 0 ? (
                      <span className="text-xs text-slate-500">Nothing to chase</span>
                    ) : (
                      <button
                        type="button"
                        className="rounded border border-blue-700 px-2 py-1 text-xs font-semibold text-blue-700"
                        onClick={() => {
                          setDraftFor(row.caseId);
                          setLegalContent(false);
                          setAttorneyReviewed(false);
                          setSendResult(null);
                        }}
                      >
                        Draft email
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {draftRow && draft && (
        <div className="mt-4 rounded border border-blue-700 bg-blue-50 p-4">
          <h3 className="text-sm font-semibold">
            Draft email — {draftRow.clientName} ({draftRow.email})
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Review this draft before sending. It is sent once, by AWS SES,
            only when you click “Send via SES” below. Nothing is sent
            automatically.
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {draft.labels.map((label) => (
              <li key={label} className="font-medium text-slate-700">
                {label}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-medium">Subject: {draft.subject}</p>
          <pre className="mt-2 whitespace-pre-wrap rounded border border-slate-200 bg-white p-3 text-sm">
            {draft.body}
          </pre>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={legalContent}
              onChange={(e) => setLegalContent(e.target.checked)}
            />
            This draft contains legal content (a letter, not just a document request)
          </label>
          {legalContent && (
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={attorneyReviewed}
                onChange={(e) => setAttorneyReviewed(e.target.checked)}
              />
              A licensed attorney has reviewed this draft
            </label>
          )}
          {!draft.sendable && draft.blockedReason && (
            <p role="alert" className="mt-2 text-sm font-medium text-red-700">
              {draft.blockedReason}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={!draft.sendable || sending}
              onClick={() => void sendDraft()}
              className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send via SES"}
            </button>
            <button
              type="button"
              onClick={() => setDraftFor(null)}
              className="rounded border border-slate-300 px-4 py-2 text-sm"
            >
              Discard draft
            </button>
          </div>
        </div>
      )}

      {sendResult && (
        <p role="status" className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          {sendResult}
        </p>
      )}
    </section>
  );
}
