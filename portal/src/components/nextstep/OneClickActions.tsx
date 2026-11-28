// OneClickActions — one click, one thing, visible result.
//
// The four actions every dashboard offers, each doing exactly one thing
// and showing its result in plain language:
//   1. Draft email (preview only) — POST /api/case-status/draft-email
//      with previewOnly: true. Renders the draft, sends NOTHING.
//   2. Send status update — POST /api/case-status. Writes the status to
//      the case + case_lifecycle + notification_logs and sends it to the
//      client (SES email + in-app thread). SES not configured means the
//      email is honestly reported "not_configured", never claimed sent.
//   3. Open chat — jumps to the case chat / unified thread.
//   4. Open checklist — opens the packet audit / document checklist.
//
// A caseId is required for actions 1–2 (they write to a real case). With
// no case open, those two buttons explain that instead of pretending to
// act. Actions 3–4 are links and always work. No DOB / A-Number / SSN /
// passport number is ever sent — the status text field is free text the
// professional types, and the API rejects payloads containing one.
"use client";

import { useState } from "react";
import Link from "next/link";

export default function OneClickActions(props: {
  caseId?: string | null;
  caseLabel?: string;
}) {
  const caseId = props.caseId ?? null;
  const [statusText, setStatusText] = useState("");
  const [draftResult, setDraftResult] = useState<string | null>(null);
  const [statusResult, setStatusResult] = useState<string | null>(null);
  const [busy, setBusy] = useState<"draft" | "status" | null>(null);

  async function draftEmail() {
    if (!caseId) return;
    setBusy("draft");
    setDraftResult(null);
    try {
      const res = await fetch("/api/case-status/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          templateId: "general_document_request",
          previewOnly: true,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        subject?: string;
        body?: string;
      };
      if (!res.ok || !body.ok) {
        setDraftResult(
          `Draft could not be rendered: ${body.error ?? `request failed (${res.status})`}. Nothing was sent.`
        );
      } else {
        setDraftResult(
          `Draft ready (preview only — nothing sent). Subject: ${body.subject ?? "(no subject)"}`
        );
      }
    } catch {
      setDraftResult("Draft could not be rendered. Nothing was sent.");
    }
    setBusy(null);
  }

  async function sendStatusUpdate() {
    if (!caseId) return;
    if (!statusText.trim()) {
      setStatusResult("Write the status update first — one or two sentences in plain language.");
      return;
    }
    setBusy("status");
    setStatusResult(null);
    try {
      const res = await fetch("/api/case-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, statusText: statusText.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        deliveries?: { email?: { status?: string } };
      };
      if (!res.ok || !body.ok) {
        setStatusResult(
          `Status update was not saved: ${body.error ?? `request failed (${res.status})`}. Nothing was sent.`
        );
      } else {
        const email = body.deliveries?.email?.status;
        setStatusResult(
          email === "sent"
            ? "Status update saved and emailed to the client. A copy is in the case thread."
            : email === "not_configured"
              ? "Status update saved and added to the case thread. Email was NOT sent — SES is not configured yet, so the email is recorded as not_configured."
              : "Status update saved. See the case thread for delivery details."
        );
        setStatusText("");
      }
    } catch {
      setStatusResult("Status update could not be saved. Nothing was sent.");
    }
    setBusy(null);
  }

  return (
    <section
      aria-labelledby="one-click-actions-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="one-click-actions-heading" className="text-base font-semibold">
        One-click actions
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Each action does one thing and shows its result here. Drafts never
        send; status updates are saved to the case first, then sent.
        {props.caseLabel ? ` Case: ${props.caseLabel}.` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!caseId || busy !== null}
          onClick={() => void draftEmail()}
          className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
        >
          {busy === "draft" ? "Rendering draft…" : "Draft email (preview only)"}
        </button>
        <Link
          href="/portal#chat-heading"
          className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold"
        >
          Open chat →
        </Link>
        <Link
          href="/portal/packet-audit"
          className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold"
        >
          Open checklist →
        </Link>
      </div>
      {!caseId && (
        <p className="mt-2 text-xs text-slate-500">
          Draft email and status update need an open case — open a case in
          the portal first. Chat and checklist links work without one.
        </p>
      )}
      {draftResult && (
        <p role="status" className="mt-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          {draftResult}
        </p>
      )}
      {caseId && (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <label htmlFor="one-click-status-text" className="text-sm font-semibold">
            Send a status update to the client
          </label>
          <textarea
            id="one-click-status-text"
            value={statusText}
            onChange={(e) => setStatusText(e.target.value)}
            rows={2}
            placeholder="E.g. Your packet is drafted and ready for your review."
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">
            Never include a date of birth, A-Number, SSN, or passport
            number — the update is rejected if it contains one.
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void sendStatusUpdate()}
            className="mt-2 rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy === "status" ? "Sending…" : "Send status update"}
          </button>
          {statusResult && (
            <p role="status" className="mt-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              {statusResult}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
