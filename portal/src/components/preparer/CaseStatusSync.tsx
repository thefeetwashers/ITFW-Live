// Case-status sync + one-click drafted emails — preparer view.
// "Save & Sync" enters the status ONCE: POST /api/case-status writes it
// to the case + case_lifecycle, links it to the client account, and
// sends it automatically (SES email + in-app thread), recording delivery
// per channel. The draft picker below renders the full draft from
// src/lib/draftedEmails.ts; the professional edits it if they wish and
// clicks once to send via POST /api/case-status/draft-email.
//
// HONEST LABELS (shown in the UI, do not remove):
//   * A manually-entered status / receipt number is NOT a live USCIS
//     lookup — USCIS live status needs a Production key, not connected.
//   * If SES is not configured the email is recorded as not_configured
//     and the in-app copy is how the client sees the update.
//   * Legal-content drafts are labelled "Draft — for a licensed
//     attorney to review before sending" and need attorney-review
//     confirmation before they send.
"use client";

import { useMemo, useState } from "react";
import {
  DRAFT_TEMPLATES,
  renderDraft,
  type DraftTemplateId,
  type RenderedDraft,
} from "@/lib/draftedEmails";
import {
  CASE_STATUSES,
  type CaseStatusSyncResponse,
  type ChannelDelivery,
} from "@/lib/caseStatusSync";

const LIFECYCLE_STAGES = [
  { n: 1, label: "1 — New Lead" },
  { n: 2, label: "2 — Consultation / Quote" },
  { n: 3, label: "3 — Payment Arrangement" },
  { n: 4, label: "4 — Active Client (Docs & Drafting)" },
  { n: 5, label: "5 — Submitted to USCIS / NVC" },
  { n: 6, label: "6 — Visa Approved / Closed" },
] as const;

function DeliveryList({ deliveries }: { deliveries: ChannelDelivery[] }) {
  if (deliveries.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {deliveries.map((d) => (
        <li key={d.channel}>
          <strong>{d.channel === "email" ? "Email" : "In-app message"}:</strong>{" "}
          <span>{d.status}</span> — {d.detail}
        </li>
      ))}
    </ul>
  );
}

export default function CaseStatusSync({
  caseId,
  clientFullName,
  formLabel,
  professionalId,
}: {
  caseId: string;
  clientFullName?: string;
  formLabel?: string;
  /** accounts.id of the signed-in professional — needed to store the
   *  in-app copy (messages.sender_id). Without it the email is still
   *  attempted but no in-app copy is stored. */
  professionalId?: string;
}) {
  const [lifecycleStage, setLifecycleStage] = useState<number>(5);
  const [subStage, setSubStage] = useState<"5A" | "5B" | "">("");
  const [caseStatus, setCaseStatus] = useState<string>("");
  const [statusText, setStatusText] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CaseStatusSyncResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [templateId, setTemplateId] = useState<DraftTemplateId>("general_document_request");
  const [missingItemsText, setMissingItemsText] = useState("");
  const [deadline, setDeadline] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentLocation, setAppointmentLocation] = useState("");
  const [preview, setPreview] = useState<RenderedDraft | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [attorneyConfirmed, setAttorneyConfirmed] = useState(false);
  const [sendingDraft, setSendingDraft] = useState(false);
  const [draftResult, setDraftResult] = useState<{
    deliveries: ChannelDelivery[];
    error?: string;
  } | null>(null);

  const selectedTemplate = useMemo(
    () => DRAFT_TEMPLATES.find((t) => t.id === templateId) ?? DRAFT_TEMPLATES[0],
    [templateId]
  );

  async function saveStatus() {
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/case-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          lifecycleStage,
          stage5SubStage: lifecycleStage === 5 && subStage ? subStage : null,
          caseStatus: caseStatus || undefined,
          statusText,
          receiptNumber: receiptNumber.trim() || undefined,
          formCode: formLabel,
          changedBy: professionalId,
        }),
      });
      const data = (await res.json()) as CaseStatusSyncResponse & { error?: string };
      if (!res.ok && !data.deliveries) {
        setError(data.error ?? "Case-status sync failed.");
        return;
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Case-status sync failed.");
    } finally {
      setSaving(false);
    }
  }

  function showDraft() {
    const missingItems = missingItemsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const { draft, error: renderError } = renderDraft(
      templateId,
      {
        firstName: clientFullName ?? "",
        form: formLabel,
        missingItems,
        deadline: deadline || undefined,
        appointmentDate: appointmentDate || undefined,
        appointmentLocation: appointmentLocation || undefined,
      },
      "en"
    );
    if (!draft) {
      setError(renderError ?? "Could not render the draft.");
      setPreview(null);
      return;
    }
    setError(null);
    setPreview(draft);
    setEditedSubject(draft.subject);
    setEditedBody(draft.body);
    setDraftResult(null);
  }

  async function sendDraft() {
    if (!preview) return;
    setSendingDraft(true);
    setError(null);
    setDraftResult(null);
    try {
      const res = await fetch("/api/case-status/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          templateId,
          vars: {
            form: formLabel,
            missingItems: missingItemsText.split("\n").map((s) => s.trim()).filter(Boolean),
            deadline: deadline || undefined,
            appointmentDate: appointmentDate || undefined,
            appointmentLocation: appointmentLocation || undefined,
          },
          subject: editedSubject,
          body: editedBody,
          professionalId,
          confirmAttorneyReview: preview.needsAttorneyReview ? attorneyConfirmed : undefined,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        deliveries?: ChannelDelivery[];
      };
      setDraftResult({
        deliveries: data.deliveries ?? [],
        error: data.ok ? undefined : (data.error ?? "Draft send failed."),
      });
    } catch (e) {
      setDraftResult({
        deliveries: [],
        error: e instanceof Error ? e.message : "Draft send failed.",
      });
    } finally {
      setSendingDraft(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Case Status — Enter Once, Send Automatically</h2>
      <p className="mt-1 text-sm text-slate-600">
        Enter the status once. It is saved to the case, linked to the client
        account, and sent to the client automatically (email + in-app
        message). Manual entry — <strong>not a live USCIS lookup</strong>.
        USCIS live status needs a Production key, which is not connected yet.
      </p>

      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="font-medium">Stage</span>
          <select
            className="mt-1 block w-full rounded border border-slate-300 p-2"
            value={lifecycleStage}
            onChange={(e) => setLifecycleStage(Number(e.target.value))}
          >
            {LIFECYCLE_STAGES.map((s) => (
              <option key={s.n} value={s.n}>{s.label}</option>
            ))}
          </select>
        </label>
        {lifecycleStage === 5 && (
          <label className="block text-sm">
            <span className="font-medium">Stage 5 sub-stage</span>
            <select
              className="mt-1 block w-full rounded border border-slate-300 p-2"
              value={subStage}
              onChange={(e) => setSubStage(e.target.value as "5A" | "5B" | "")}
            >
              <option value="">—</option>
              <option value="5A">5A — At USCIS</option>
              <option value="5B">5B — USCIS Approved, at NVC</option>
            </select>
          </label>
        )}
        <label className="block text-sm">
          <span className="font-medium">Case status (optional — defaults from the stage)</span>
          <select
            className="mt-1 block w-full rounded border border-slate-300 p-2"
            value={caseStatus}
            onChange={(e) => setCaseStatus(e.target.value)}
          >
            <option value="">— use stage default —</option>
            {CASE_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Status update (plain English — this is what the client sees)</span>
          <textarea
            className="mt-1 block w-full rounded border border-slate-300 p-2"
            rows={3}
            value={statusText}
            onChange={(e) => setStatusText(e.target.value)}
            placeholder="e.g. USCIS received your packet. Your biometrics appointment letter should arrive by mail in the next 2–3 weeks."
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">USCIS receipt number, if any (manually entered — EXAMPLE / labelled until a Production USCIS key exists)</span>
          <input
            className="mt-1 block w-full rounded border border-slate-300 p-2"
            value={receiptNumber}
            onChange={(e) => setReceiptNumber(e.target.value)}
            placeholder="e.g. IOE… (leave blank if none yet)"
          />
        </label>
        <p className="text-xs text-slate-500">
          Never enter a DOB, A-Number, SSN or passport number here — they are
          rejected and never appear in subjects or logs.
        </p>
        <button
          type="button"
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={saving || !statusText.trim()}
          onClick={saveStatus}
        >
          {saving ? "Saving & sending…" : "Save & Sync — send to client"}
        </button>
        {error && <p className="text-sm text-red-700">{error}</p>}
        {result && (
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm">
              Saved to case <strong>{result.caseStatus ?? "—"}</strong>
              {result.lifecycleStage ? `, stage ${result.lifecycleStage}` : ""}.
              Stored: case {result.stored.caseUpdated ? "yes" : "no"}, lifecycle{" "}
              {result.stored.lifecycleRow ? "yes" : "no"}, receipt{" "}
              {result.stored.receiptRecorded ? "yes" : "not given"}, in-app{" "}
              {result.stored.inAppMessage ? "yes" : "no"}, email log{" "}
              {result.stored.emailLog ? "yes" : "no"}.
            </p>
            <DeliveryList deliveries={result.deliveries} />
            {result.warnings.map((w) => (
              <p key={w} className="mt-1 text-sm text-amber-800">{w}</p>
            ))}
          </div>
        )}
      </div>

      <hr className="my-6 border-slate-200" />

      <h3 className="text-base font-semibold">One-Click Drafted Email</h3>
      <p className="mt-1 text-sm text-slate-600">
        Pick a template, see the full draft, edit it if you wish, click once
        to send. The client is greeted by first name only.
      </p>
      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="font-medium">Template</span>
          <select
            className="mt-1 block w-full rounded border border-slate-300 p-2"
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value as DraftTemplateId);
              setPreview(null);
              setDraftResult(null);
            }}
          >
            {DRAFT_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
                {t.needsAttorneyReview ? " — attorney review required" : ""}
                {t.translationStatus === "en_only_pending" ? " (English only — translation pending)" : ""}
              </option>
            ))}
          </select>
        </label>
        {(selectedTemplate.requiresMissingItems || selectedTemplate.category === "missing_document") && (
          <label className="block text-sm">
            <span className="font-medium">Missing items (one per line)</span>
            <textarea
              className="mt-1 block w-full rounded border border-slate-300 p-2"
              rows={3}
              value={missingItemsText}
              onChange={(e) => setMissingItemsText(e.target.value)}
              placeholder="e.g. Birth certificate (long form)"
            />
          </label>
        )}
        {selectedTemplate.requiresDeadline && (
          <label className="block text-sm">
            <span className="font-medium">Deadline</span>
            <input
              className="mt-1 block w-full rounded border border-slate-300 p-2"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              placeholder="e.g. December 20, 2026"
            />
          </label>
        )}
        {selectedTemplate.requiresAppointment && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Appointment date & time</span>
              <input
                className="mt-1 block w-full rounded border border-slate-300 p-2"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                placeholder="e.g. December 15, 2026 at 9:00 AM"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Location</span>
              <input
                className="mt-1 block w-full rounded border border-slate-300 p-2"
                value={appointmentLocation}
                onChange={(e) => setAppointmentLocation(e.target.value)}
                placeholder="e.g. USCIS Application Support Center, Fort Pierce"
              />
            </label>
          </div>
        )}
        <button
          type="button"
          className="rounded border border-slate-900 px-4 py-2 text-sm font-medium"
          onClick={showDraft}
        >
          Show draft
        </button>
        {preview && (
          <div className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3">
            {preview.attorneyReviewLabel && (
              <p className="text-sm font-semibold text-amber-800">{preview.attorneyReviewLabel}</p>
            )}
            {preview.translationNote && (
              <p className="text-sm text-slate-600">{preview.translationNote}</p>
            )}
            <label className="block text-sm">
              <span className="font-medium">Subject (edit if you wish)</span>
              <input
                className="mt-1 block w-full rounded border border-slate-300 bg-white p-2"
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Body (edit if you wish)</span>
              <textarea
                className="mt-1 block w-full rounded border border-slate-300 bg-white p-2"
                rows={10}
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
              />
            </label>
            {preview.needsAttorneyReview && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={attorneyConfirmed}
                  onChange={(e) => setAttorneyConfirmed(e.target.checked)}
                />
                <span>A licensed attorney has reviewed this draft before sending.</span>
              </label>
            )}
            <button
              type="button"
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={sendingDraft || (preview.needsAttorneyReview && !attorneyConfirmed)}
              onClick={sendDraft}
            >
              {sendingDraft ? "Sending…" : "Send — one click"}
            </button>
            {draftResult && (
              <div>
                {draftResult.error && <p className="text-sm text-red-700">{draftResult.error}</p>}
                <DeliveryList deliveries={draftResult.deliveries} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
