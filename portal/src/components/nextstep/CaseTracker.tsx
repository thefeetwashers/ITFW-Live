// CaseTracker — client + professional case-number tracking view
// (EIGHTH ADDITION, Nov 28, 2026).
//
// What it shows, honestly:
//   * The receipt number the client gave us (validated, MASKED —
//     prefix + last 4 digits only), and the public USCIS status for
//     it, with the date it was recorded, the plain-English meaning,
//     and what to do next. Every status change is logged, so the
//     client and the professional see the same history.
//   * The completeness view: what OUR packet contains vs the form
//     checklist, what is missing, what was submitted, what USCIS
//     receipted — from OUR records, labelled as such on every row.
//   * Approval help: the packet audit score (100% before filing),
//     the RFE / NOID decoder, interview prep, and deadline tracking
//     — never a promise of approval.
//   * NVC / consular: the CEAC steps, what to submit online to the
//     embassy, the DOS fees, DQ and interview steps, the CEAC link
//     out, and the official embassy directory link.
//
// What it does NOT do (deliberately):
//   * No live USCIS lookup (Production key not granted — Sandbox
//     only). Statuses are manual entry from uscis.gov / a USCIS
//     notice, or Sandbox / mock, and labelled as such.
//   * No officer-file view — there is no such API, and the honest
//     note at the top of this panel says so verbatim.
//   * No CEAC password field, anywhere. The panel warns never to
//     enter a CEAC password here.
//   * No embassy email address is shown — none is stored. The
//     panel links the official U.S. embassy directory instead.
//   * No approval is promised or implied.
//
// Local state until the case-status API persists it (the
// case_watch.milestones shape for that is buildCaseWatchMilestone
// in lib/caseTracking.ts). All data here is EXAMPLE / manually
// entered, labelled as such — nothing is presented as a real case.
"use client";

import { useState } from "react";
import {
  ATTORNEY_REVIEW_NOTICE,
  CEAC_PASSWORD_RULE,
  COMPLETENESS_SOURCE_LABEL,
  CONSULAR_ONLINE_SUBMISSIONS,
  EMBASSY_CONTACT_NOTE,
  HONEST_TRACKER_NOTE,
  NVC_PUBLIC_CONTACT,
  STATUS_SOURCE_LABEL,
  USCIS_CASE_STATUS_URL,
  USEMBASSY_DIRECTORY_URL,
  NVC_PAGE_URL,
  appendStatusChange,
  buildConsularChecklist,
  buildStatusLogEntry,
  buildCompletenessView,
  decodeRfeNotice,
  deadlineUrgency,
  explainPublicStatus,
  maskReceiptNumber,
  validateReceiptNumber,
  type CaseStatusLogEntry,
} from "@/lib/caseTracking";
import { CEAC_LOGIN_URL, EXAMPLE_DEADLINES } from "@/lib/nvc";
import { NO_GUARANTEE_NOTICE } from "@/lib/interviewPrep";

const EXAMPLE_RECEIPT = "IOE0928374651";

function exampleLog(): CaseStatusLogEntry[] {
  return [
    buildStatusLogEntry({
      id: "log-1",
      statusText: "Case Was Received",
      source: "sandbox_mock",
      receiptNumber: EXAMPLE_RECEIPT,
      recordedAt: "2026-11-19T10:00:00.000Z",
    }),
    buildStatusLogEntry({
      id: "log-2",
      statusText: "Biometrics Appointment Was Scheduled",
      source: "sandbox_mock",
      receiptNumber: EXAMPLE_RECEIPT,
      recordedAt: "2026-11-26T10:00:00.000Z",
    }),
  ];
}

export default function CaseTracker(props: {
  /** Manually-entered receipt number (EXAMPLE unless a real one is passed). */
  receiptNumber?: string | null;
  formCode?: string;
  /** Form-checklist template id, e.g. "i130-nvc". */
  templateId?: string;
  caseLabel?: string;
  /** NVC case number for the consular panel (EXAMPLE unless real). */
  nvcCaseNumber?: string | null;
}) {
  const formCode = props.formCode ?? "I-130";
  const templateId = props.templateId ?? "i130-nvc";
  const [receiptInput, setReceiptInput] = useState("");
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [savedReceipt, setSavedReceipt] = useState<string | null>(
    props.receiptNumber ?? EXAMPLE_RECEIPT
  );
  const [log, setLog] = useState<CaseStatusLogEntry[]>(exampleLog());
  const [statusInput, setStatusInput] = useState("");
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [decoderText, setDecoderText] = useState("");
  const decoded = decoderText.trim() ? decodeRfeNotice(decoderText) : null;
  const [nvcInput, setNvcInput] = useState(props.nvcCaseNumber ?? "");
  const consular =
    nvcInput.trim() !== "" ? buildConsularChecklist(nvcInput) : null;

  const completeness = buildCompletenessView({
    templateId,
    clearedItemIds: [],
    submittedItemIds: [],
    receiptedItemIds: [],
  });

  const saveReceipt = () => {
    const result = validateReceiptNumber(receiptInput);
    if (!result.valid || !result.normalized) {
      setReceiptError(
        result.errors.join(" ") ||
          "That receipt number does not look right — check the 3-letter prefix (IOE, EAC, WAC, LIN, SRC, NBC, MSC) and the 10 digits."
      );
      return;
    }
    setReceiptError(null);
    setSavedReceipt(result.normalized);
    setStatusNote(
      `Receipt number saved (shown masked: ${result.masked}). The status below is still manual entry — check it on the USCIS page and log it here.`
    );
  };

  const logStatus = () => {
    if (!statusInput.trim()) return;
    const explained = explainPublicStatus(statusInput);
    const entry = buildStatusLogEntry({
      id: `log-${Date.now()}`,
      statusText: statusInput.trim(),
      source: "professional_manual",
      receiptNumber: savedReceipt ?? "",
    });
    setLog((prev) => appendStatusChange(prev, entry));
    setStatusNote(
      explained.known
        ? `Status logged: ${entry.statusText}.`
        : "Status logged, but those words are not in our list of USCIS public status words — check the exact words on the USCIS page."
    );
    setStatusInput("");
  };

  return (
    <section
      aria-labelledby="case-tracker-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="case-tracker-heading" className="text-base font-semibold">
        Case Tracker — {props.caseLabel ?? `Form ${formCode} (EXAMPLE)`}
      </h2>

      {/* The honest note — required verbatim on the tracker. */}
      <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        {HONEST_TRACKER_NOTE}
      </p>
      <p className="mt-2 text-xs text-slate-500">
        {NO_GUARANTEE_NOTICE} Preparing well helps you answer clearly and
        completely — it does not guarantee approval.
      </p>

      {/* Receipt number */}
      <h3 className="mt-4 text-sm font-semibold">Your receipt number</h3>
      <p className="mt-1 text-sm text-slate-600">
        {savedReceipt
          ? `On file (masked): ${maskReceiptNumber(savedReceipt)} — only the prefix and last 4 digits are shown.`
          : "No receipt number on file yet. Enter the 13-character number from your USCIS receipt notice (Form I-797C)."}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="case-tracker-receipt">
          USCIS receipt number
        </label>
        <input
          id="case-tracker-receipt"
          type="text"
          value={receiptInput}
          onChange={(e) => setReceiptInput(e.target.value)}
          placeholder="e.g. IOE0928374651 (EXAMPLE)"
          autoComplete="off"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={saveReceipt}
          className="rounded bg-slate-800 px-3 py-1 text-sm font-medium text-white"
        >
          Save receipt number
        </button>
      </div>
      {receiptError && (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {receiptError}
        </p>
      )}
      <p className="mt-2 text-sm text-slate-600">
        Check the public status yourself on{" "}
        <a
          href={USCIS_CASE_STATUS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-blue-700 underline"
        >
          USCIS Case Status Online
        </a>{" "}
        (opens uscis.gov), then log what it says below. There is no live
        USCIS lookup in this portal — the USCIS Case Status API is
        Sandbox-only and Production access has not been granted.
      </p>

      {/* Status history */}
      <h3 className="mt-4 text-sm font-semibold">
        Status history — every change, with the date and what it means
      </h3>
      {log.length === 0 ? (
        <p className="mt-1 text-sm text-slate-600">
          No status changes logged yet.
        </p>
      ) : (
        <ol className="mt-2 space-y-2">
          {log.map((entry) => (
            <li
              key={entry.id}
              className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <p className="font-medium">
                {entry.statusText}{" "}
                <span className="font-normal text-slate-500">
                  — {new Date(entry.recordedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </p>
              <p className="mt-1 text-slate-700">{entry.plainEnglish}</p>
              <p className="mt-1 text-slate-700">
                <span className="font-medium">Next step: </span>
                {entry.nextStep}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Source: {STATUS_SOURCE_LABEL[entry.source]} Receipt:{" "}
                {entry.receiptNumberMasked}.
              </p>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="case-tracker-status">
          Public USCIS status, exactly as shown on uscis.gov
        </label>
        <input
          id="case-tracker-status"
          type="text"
          value={statusInput}
          onChange={(e) => setStatusInput(e.target.value)}
          placeholder="Paste the status words from uscis.gov"
          autoComplete="off"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={logStatus}
          className="rounded bg-slate-800 px-3 py-1 text-sm font-medium text-white"
        >
          Log status change
        </button>
      </div>
      {statusNote && (
        <p className="mt-1 text-sm text-slate-600">{statusNote}</p>
      )}

      {/* Completeness view — our records only */}
      <h3 className="mt-4 text-sm font-semibold">
        Is the file complete? — from our records
      </h3>
      <p className="mt-1 text-sm text-slate-600">{COMPLETENESS_SOURCE_LABEL}</p>
      <p className="mt-1 text-sm text-slate-700">
        Packet audit score: <strong>{completeness.readinessScore}%</strong>{" "}
        {completeness.readyToFile
          ? "— ready to file (100% and every blocking item cleared)."
          : "— not ready to file yet. Filing needs 100% with every blocking item cleared."}
      </p>
      <ul className="mt-2 space-y-1">
        {completeness.rows.map((row) => (
          <li key={row.id} className="text-sm text-slate-700">
            <span className="font-medium">{row.label}</span> —{" "}
            {row.state === "missing" ? "Missing" : row.state === "submitted" ? "Submitted" : "Receipted"}
            {row.blocking ? " (blocking)" : ""}
            <span className="text-xs text-slate-500">
              {" "}
              · {row.sourceNote}
            </span>
          </li>
        ))}
      </ul>

      {/* RFE / NOID decoder */}
      <h3 className="mt-4 text-sm font-semibold">
        RFE / NOID decoder — what the words on the notice mean
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        Paste the words from the notice. This translates the words into
        plain English and the clerical next step only — it never writes
        the legal response and never predicts the outcome.
      </p>
      <label className="sr-only" htmlFor="case-tracker-rfe">
        Words from the RFE or NOID notice
      </label>
      <textarea
        id="case-tracker-rfe"
        value={decoderText}
        onChange={(e) => setDecoderText(e.target.value)}
        placeholder="Paste the notice words here (nothing you paste is stored)"
        rows={3}
        className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      {decoded && (
        <div className="mt-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <p>{decoded.guidance}</p>
          {decoded.matched.map((rule) => (
            <div key={rule.matchPhrases[0]} className="mt-2">
              <p className="font-medium">{rule.meaning}</p>
              <p className="mt-1 text-slate-700">{rule.clericalNextStep}</p>
            </div>
          ))}
          {decoded.needsAttorneyReview && (
            <p className="mt-2 font-medium text-amber-900">
              {ATTORNEY_REVIEW_NOTICE}
            </p>
          )}
        </div>
      )}

      {/* Deadlines — stored dates only */}
      <h3 className="mt-4 text-sm font-semibold">
        Deadlines — from the dates on your notices
      </h3>
      <ul className="mt-1 space-y-1">
        {EXAMPLE_DEADLINES.slice(0, 3).map((d) => (
          <li key={d.id} className="text-sm text-slate-700">
            {d.label} — due {d.dueIso} (
            {deadlineUrgency(d.dueIso, d.direction, "2026-11-28")}).{" "}
            {d.action} (EXAMPLE dates.)
          </li>
        ))}
      </ul>

      {/* NVC / consular */}
      <h3 className="mt-4 text-sm font-semibold">
        NVC / consular — what to submit online to the embassy
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        NVC has no API — CEAC is manual. {CEAC_PASSWORD_RULE}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="case-tracker-nvc">
          NVC case number
        </label>
        <input
          id="case-tracker-nvc"
          type="text"
          value={nvcInput}
          onChange={(e) => setNvcInput(e.target.value)}
          placeholder="NVC case number, e.g. PHP2026144009 (EXAMPLE)"
          autoComplete="off"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <a
          href={CEAC_LOGIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded bg-slate-800 px-3 py-1 text-sm font-medium text-white"
        >
          Open CEAC (official site)
        </a>
      </div>
      {consular && !consular.nvcCaseValid && (
        <p role="alert" className="mt-1 text-sm text-red-700">
          That NVC case number does not look right — it must be 13
          characters: 3-letter post code + 4-digit year + 3-digit Julian
          day + 3-digit sequence.
        </p>
      )}
      {consular && consular.nvcCaseValid && consular.post && (
        <p className="mt-1 text-sm text-slate-700">
          Embassy post: {consular.post.city}, {consular.post.country} (
          {consular.post.code}).
        </p>
      )}
      {consular && consular.nvcCaseValid && !consular.postKnown && (
        <p className="mt-1 text-sm text-slate-700">
          Post code not in lookup — verify with NVC.
        </p>
      )}
      <ol className="mt-2 space-y-1">
        {CONSULAR_ONLINE_SUBMISSIONS.map((s) => (
          <li key={s.id} className="text-sm text-slate-700">
            <span className="font-medium">{s.title}</span> — {s.detail}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-sm text-slate-700">
        DOS fees in CEAC: $120 Affidavit of Support fee per case + $325
        Immigrant Visa fee per applicant. Questions for NVC:{" "}
        {NVC_PUBLIC_CONTACT.email} or {NVC_PUBLIC_CONTACT.phone} (NVC&apos;s
        public contact details, published by the U.S. Department of State
        — see the{" "}
        <a
          href={NVC_PAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-blue-700 underline"
        >
          NVC page on travel.state.gov
        </a>
        ).
      </p>
      <p className="mt-2 text-sm text-slate-600">{EMBASSY_CONTACT_NOTE}</p>
      <p className="mt-1 text-sm">
        <a
          href={USEMBASSY_DIRECTORY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-blue-700 underline"
        >
          U.S. embassy directory (usembassy.gov — official)
        </a>{" "}
        — find your embassy&apos;s immigrant-visa email address and
        mailing address on its official page.
      </p>
    </section>
  );
}
