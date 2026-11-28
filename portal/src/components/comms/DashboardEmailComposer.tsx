// Dashboard Email Composer — the founder + any professional emails
// the client from inside the dashboard.
//
// This component talks ONLY to POST /api/dashboard-email (fetch). It
// never imports the server-only SES sender and never sends itself.
//   * Template picker: all 16 drafted emails + 16 cover letters
//     (GET /api/dashboard-email). Picking one previews the FULL draft
//     (POST previewOnly) — the professional edits it if they wish,
//     then sends with ONE click.
//   * Free-form compose: subject + body with no template.
//   * Sender source: platform SES (default) or the professional's own
//     connected email (BYO Resend / BYO SES). A source that is not
//     connected returns an honest not_configured — the UI shows the
//     per-channel delivery status the API returns, never a success it
//     did not earn.
//   * Legal-content drafts (cover letters, RFE / deadline / interview
//     drafts) show the attorney-review label and require the checkbox
//     before Send enables.
//   * No real case id → the composer still browses + previews
//     templates, but Send / Save draft stay disabled with an honest
//     note (no fake case, no send against an example id).
"use client";

import { useEffect, useState } from "react";

type TemplateEntry = {
  kind: "draft_email" | "cover_letter";
  id: string;
  label: string;
  category: string;
  needsAttorneyReview: boolean;
  translationStatus: "seven_languages" | "en_only_pending";
};

type Delivery = { channel: string; status: string; detail: string };

export default function DashboardEmailComposer(props: {
  caseId?: string | null;
  professionalId?: string | null;
  caseLabel?: string;
  /** Checklist item ids still missing, for the one-click per-item drafts. */
  missingItemIds?: string[];
}) {
  const [templates, setTemplates] = useState<TemplateEntry[]>([]);
  const [sesConfigured, setSesConfigured] = useState<boolean | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [senderSource, setSenderSource] = useState("platform_ses");
  const [attorneyConfirmed, setAttorneyConfirmed] = useState(false);
  const [varsJson, setVarsJson] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [busy, setBusy] = useState(false);

  const selected = templates.find((t) => t.id === templateId) ?? null;
  const needsReview = selected?.needsAttorneyReview ?? false;
  const hasRealCase = Boolean(props.caseId);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard-email")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setTemplates(Array.isArray(j.templates) ? j.templates : []);
        setSesConfigured(typeof j.platformSesConfigured === "boolean" ? j.platformSesConfigured : null);
      })
      .catch(() => {
        if (!cancelled) setStatus("Could not load the email templates. Try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function preview() {
    setBusy(true);
    setStatus(null);
    setDeliveries([]);
    try {
      let vars: Record<string, unknown> = {};
      if (varsJson.trim()) {
        try {
          vars = JSON.parse(varsJson) as Record<string, unknown>;
        } catch {
          setStatus("The details box is not valid JSON — fix it and try again.");
          setBusy(false);
          return;
        }
      }
      const res = await fetch("/api/dashboard-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: props.caseId,
          templateId: templateId || undefined,
          vars,
          previewOnly: true,
        }),
      });
      const j = await res.json();
      if (!res.ok || j.ok === false) {
        setStatus(j.error ?? "Could not preview this draft.");
        return;
      }
      setSubject(j.subject ?? "");
      setBody(j.body ?? "");
      setStatus("Preview — nothing was sent and nothing was stored.");
    } catch {
      setStatus("Preview failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function send(saveDraftOnly: boolean) {
    if (!hasRealCase) return;
    setBusy(true);
    setStatus(null);
    setDeliveries([]);
    try {
      let vars: Record<string, unknown> = {};
      if (varsJson.trim()) {
        try {
          vars = JSON.parse(varsJson) as Record<string, unknown>;
        } catch {
          setStatus("The details box is not valid JSON — fix it and try again.");
          setBusy(false);
          return;
        }
      }
      const res = await fetch("/api/dashboard-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: props.caseId,
          professionalId: props.professionalId ?? undefined,
          senderSource,
          templateId: templateId || undefined,
          subject: subject || undefined,
          body: body || undefined,
          vars,
          confirmAttorneyReview: needsReview ? attorneyConfirmed : undefined,
          saveDraft: saveDraftOnly || undefined,
        }),
      });
      const j = await res.json();
      setDeliveries(Array.isArray(j.deliveries) ? j.deliveries : []);
      if (saveDraftOnly) {
        setStatus(j.ok ? "Draft saved — nothing was sent." : (j.error ?? "Draft could not be saved."));
      } else if (j.ok) {
        setStatus("Sent — see the delivery status below for each channel.");
      } else {
        setStatus(j.error ?? "Nothing was delivered — see the delivery status below.");
      }
    } catch {
      setStatus("Send failed — try again. Nothing was claimed sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Email the client — from this dashboard</h2>
      <p className="mt-1 text-sm text-slate-600">
        {props.caseLabel ?? "Compose and send an email to the client, or pick a draft the system already wrote for you."}{" "}
        {sesConfigured === false
          ? "Platform email (AWS SES) is not connected right now — sends will report not_configured and nothing will be sent."
          : sesConfigured === true
            ? "Platform email (AWS SES) is connected."
            : ""}
      </p>
      {!hasRealCase ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No open case is loaded here yet — browse and preview the templates below. Sending needs a real open case; nothing is sent against an example id.
        </p>
      ) : null}

      <label className="mt-4 block text-sm font-medium">
        Template (or leave blank to write a free-form email)
        <select
          value={templateId}
          onChange={(e) => {
            setTemplateId(e.target.value);
            setSubject("");
            setBody("");
            setAttorneyConfirmed(false);
            setStatus(null);
            setDeliveries([]);
          }}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">— Free-form email (no template) —</option>
          <optgroup label="Drafted emails">
            {templates
              .filter((t) => t.kind === "draft_email")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                  {t.needsAttorneyReview ? " — attorney review" : ""}
                  {t.translationStatus === "en_only_pending" ? " (English only)" : ""}
                </option>
              ))}
          </optgroup>
          <optgroup label="Cover letters (draft — attorney review)">
            {templates
              .filter((t) => t.kind === "cover_letter")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
          </optgroup>
        </select>
      </label>
      {selected?.needsAttorneyReview ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Draft — for a licensed attorney to review before sending. This draft carries legal content; confirm an attorney has reviewed it before you send.
        </p>
      ) : null}
      {selected?.translationStatus === "en_only_pending" ? (
        <p className="mt-2 text-sm text-slate-500">English only — translation pending.</p>
      ) : null}

      <label className="mt-4 block text-sm font-medium">
        Details (optional JSON — e.g. {`{"missingItems": ["Birth certificate"], "deadline": "December 2, 2026", "appointmentDate": "December 10, 2026 at 9:00 AM", "appointmentLocation": "USCIS Field Office"}`})
        <textarea
          value={varsJson}
          onChange={(e) => setVarsJson(e.target.value)}
          rows={2}
          placeholder='{"missingItems": ["Birth certificate"]}'
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
        />
      </label>
      <p className="mt-1 text-xs text-slate-500">
        Never put a date of birth, A-Number, SSN or passport number in this box, the subject, or the message — they are rejected and never sent or logged.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={preview}
          disabled={busy || !templateId || !hasRealCase}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Preview draft
        </button>
        {!hasRealCase ? (
          <span className="self-center text-xs text-slate-500">Preview needs a real open case (it fills in the client&apos;s name).</span>
        ) : null}
      </div>

      <label className="mt-4 block text-sm font-medium">
        Subject
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Subject — no DOB, A-Number, SSN or passport number"
        />
      </label>
      <label className="mt-4 block text-sm font-medium">
        Message
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Write the email, or preview a template first — then edit it here before you send."
        />
      </label>

      <label className="mt-4 block text-sm font-medium">
        Send from
        <select
          value={senderSource}
          onChange={(e) => setSenderSource(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="platform_ses">Platform email (AWS SES — updates@niptei.com)</option>
          <option value="byo_resend">My own email (Resend — BYO, must be connected + tested)</option>
          <option value="byo_aws_ses">My own email (AWS SES — BYO, must be connected + tested)</option>
        </select>
      </label>

      {needsReview ? (
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={attorneyConfirmed}
            onChange={(e) => setAttorneyConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          <span>A licensed attorney has reviewed this draft and approved sending it.</span>
        </label>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => send(false)}
          disabled={busy || !hasRealCase || !subject.trim() || !body.trim() || (needsReview && !attorneyConfirmed)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Send email
        </button>
        <button
          type="button"
          onClick={() => send(true)}
          disabled={busy || !hasRealCase || !subject.trim() || !body.trim()}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Save draft (don&apos;t send)
        </button>
      </div>

      {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
      {deliveries.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm">
          {deliveries.map((d, i) => (
            <li key={i} className="rounded-lg border border-slate-200 px-3 py-2">
              <strong>{d.channel}</strong> — {d.status}: {d.detail}
            </li>
          ))}
        </ul>
      ) : null}
      {props.missingItemIds && props.missingItemIds.length > 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          {props.missingItemIds.length} item{props.missingItemIds.length === 1 ? "" : "s"} still missing on this
          case — pick the matching missing-document template above to send its one-click draft.
        </p>
      ) : null}
    </section>
  );
}
