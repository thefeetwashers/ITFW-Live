// Lead Sheet — CSV bulk importer for the preparer pipeline.
// Preparer-dashboard tab. CSV ONLY (no .xlsx library in package.json).
// Preview before import; per-row errors; a row with a missing name,
// phone, or email is never imported; blank fields are never filled in.
// Import writes preparer_leads rows owned by the logged-in preparer
// ONLY when Supabase is connected AND a preparer is signed in AND their
// accounts row resolves AND the insert succeeds (migration 0010 defines
// preparer_leads; it is not yet applied). Otherwise valid rows go to a
// clearly-labelled PENDING-IMPORT queue — nothing here claims a live
// Supabase import until one actually happens.
"use client";

import { useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import {
  LEAD_CSV_TEMPLATE,
  LEAD_IMPORT_LIMITS,
  LEAD_PAYMENT_PLANS,
  leadsToCsv,
  parseLeadCsv,
  toPreparerLeadInsert,
  type ParsedLeadRow,
  type LeadCsvParseResult,
} from "@/lib/leads";
import type { PaymentPlanType } from "@/lib/order";
import { formatCents } from "@/lib/order";

interface PendingBatch {
  queuedAt: string;
  reason: string;
  paymentPlan: PaymentPlanType;
  rows: ParsedLeadRow[];
}

export default function LeadSheet() {
  const supabaseLive = useMemo(() => getSupabase() !== null, []);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<LeadCsvParseResult | null>(null);
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlanType>("full_upfront");
  const [status, setStatus] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [pending, setPending] = useState<PendingBatch[]>([]);
  const [busy, setBusy] = useState(false);

  const validRows = parsed?.rows.filter((r) => r.valid) ?? [];
  const invalidRows = parsed?.rows.filter((r) => !r.valid) ?? [];
  const pendingRows = pending.flatMap((b) => b.rows);

  const download = (filename: string, text: string, type = "text/csv") => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setParsed(null);
      setFileName(file.name);
      setStatus(
        "That file is not a CSV. " + LEAD_IMPORT_LIMITS
      );
      return;
    }
    const text = await file.text();
    setFileName(file.name);
    setParsed(parseLeadCsv(text));
    setStatus(null);
  };

  const handleImport = async () => {
    if (validRows.length === 0 || busy) return;
    setBusy(true);
    setStatus(null);
    const supabase = getSupabase();

    const queueAsPending = (rows: ParsedLeadRow[], reason: string) => {
      setPending((prev) => [
        ...prev,
        { queuedAt: new Date().toISOString(), reason, paymentPlan, rows },
      ]);
      setStatus(
        `${rows.length} valid row(s) saved to the PENDING-IMPORT queue — NOT in Supabase yet. ${reason} They will write to preparer_leads once the table is wired and you re-import (or the queue is applied). Nothing was claimed as live.`
      );
    };

    if (!supabase) {
      queueAsPending(
        validRows,
        "Supabase is not connected in this build (no NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY), so no insert was attempted."
      );
      setBusy(false);
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const authUserId = userData?.user?.id ?? null;
    if (userError || !authUserId) {
      queueAsPending(
        validRows,
        "No preparer is signed in, so rows cannot be owned by a preparer yet."
      );
      setBusy(false);
      return;
    }

    // preparer_leads.preparer_id references public.accounts(id), not the
    // auth user id — resolve the preparer's accounts row first. RLS
    // requires preparer_id = current_account_id().
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("id")
      .eq("auth_user_id", authUserId)
      .single();
    const preparerId = (account as { id?: string } | null)?.id ?? null;
    if (accountError || !preparerId) {
      queueAsPending(
        validRows,
        "Signed in, but no preparer account row (accounts.auth_user_id) was found, so rows cannot be owned by a preparer yet."
      );
      setBusy(false);
      return;
    }

    const inserts = validRows.map((r) =>
      toPreparerLeadInsert(r, preparerId, paymentPlan)
    );
    const { error } = await supabase.from("preparer_leads").insert(inserts);
    if (error) {
      queueAsPending(
        validRows,
        `Supabase insert into preparer_leads failed (${error.message}). Migration 0010 defines the table but is not applied yet — apply it first, then re-import.`
      );
      setBusy(false);
      return;
    }

    setImportedCount((c) => c + validRows.length);
    setStatus(
      `Imported ${validRows.length} lead(s) into preparer_leads for the signed-in preparer. ${invalidRows.length} invalid row(s) were not imported.`
    );
    setBusy(false);
  };

  return (
    <section
      aria-label="Lead Sheet — bulk CSV import"
      className="space-y-4 rounded-lg border border-slate-300 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-slate-900">
        Lead Sheet — Bulk Import (CSV)
      </h2>
      <p className="text-sm text-slate-600">
        Bulk-upload existing leads into your pipeline. Preview first, fix
        per-row errors, then import. Rows are owned by the signed-in
        preparer only.
      </p>
      <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {LEAD_IMPORT_LIMITS} Columns: full_name, email, phone,
        preferred_language, lead_source, service_interested, quoted_fee,
        quote_expires_at (optional, YYYY-MM-DD), follow_up_date (YYYY-MM-DD),
        notes. Full name, phone, and email are required on every row — a row
        missing any of them is never imported (email is required because
        preparer_leads.email is NOT NULL in migration 0010; no email is ever
        invented). Blank fields stay blank; nothing is invented for them.
        Quoted fee is stored as integer cents.
      </p>
      {!supabaseLive && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Supabase is not connected in this build, so imports go to a
          clearly-labelled pending-import queue below — they are NOT live in
          Supabase until the table is wired and the queue is applied.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => download("lead-import-template.csv", LEAD_CSV_TEMPLATE)}
          className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Download CSV template
        </button>
        <label className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Choose CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
        {fileName && (
          <span className="text-sm text-slate-600">File: {fileName}</span>
        )}
      </div>

      <div>
        <label
          htmlFor="lead-payment-plan"
          className="block text-sm font-medium text-slate-700"
        >
          Payment plan offered for these leads (locked plans only)
        </label>
        <select
          id="lead-payment-plan"
          value={paymentPlan}
          onChange={(e) => setPaymentPlan(e.target.value as PaymentPlanType)}
          className="mt-1 w-full max-w-sm rounded border border-slate-300 bg-white px-3 py-2 text-sm sm:w-auto"
        >
          {LEAD_PAYMENT_PLANS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          No 50/50 Split — it is not a locked immigration payment plan (it
          belongs to the Florida Property Compliance OS).
        </p>
      </div>

      {parsed && parsed.fileErrors.length > 0 && (
        <div
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {parsed.fileErrors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      {parsed && parsed.ignoredColumns.length > 0 && (
        <p className="text-xs text-slate-500">
          Ignored unknown column(s): {parsed.ignoredColumns.join(", ")}.
        </p>
      )}

      {parsed && parsed.rows.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-800">
            Preview — {validRows.length} valid, {invalidRows.length} invalid
            (invalid rows will not be imported).
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-50">
                  <th className="px-2 py-1">Row</th>
                  <th className="px-2 py-1">Full name</th>
                  <th className="px-2 py-1">Phone</th>
                  <th className="px-2 py-1">Email</th>
                  <th className="px-2 py-1">Language</th>
                  <th className="px-2 py-1">Service</th>
                  <th className="px-2 py-1">Quoted fee</th>
                  <th className="px-2 py-1">Quote expires</th>
                  <th className="px-2 py-1">Follow-up</th>
                  <th className="px-2 py-1">Errors</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((r) => (
                  <tr
                    key={r.rowNumber}
                    className={
                      "border-b border-slate-200 align-top " +
                      (r.valid ? "" : "bg-red-50")
                    }
                  >
                    <td className="px-2 py-1">{r.rowNumber}</td>
                    <td className="px-2 py-1">{r.fullName || "—"}</td>
                    <td className="px-2 py-1">{r.phone || "—"}</td>
                    <td className="px-2 py-1">{r.email ?? "—"}</td>
                    <td className="px-2 py-1">{r.preferredLanguage ?? "—"}</td>
                    <td className="px-2 py-1">{r.serviceInterested ?? "—"}</td>
                    <td className="px-2 py-1">
                      {r.quotedFeeCents === null
                        ? "—"
                        : formatCents(r.quotedFeeCents)}
                    </td>
                    <td className="px-2 py-1">{r.quoteExpiresAt ?? "—"}</td>
                    <td className="px-2 py-1">{r.followUpDate ?? "—"}</td>
                    <td className="px-2 py-1 text-xs text-red-700">
                      {r.errors.length > 0 ? r.errors.join(" ") : "OK"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            disabled={validRows.length === 0 || busy}
            onClick={handleImport}
            className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy
              ? "Importing…"
              : `Import ${validRows.length} valid lead(s)`}
          </button>
          {validRows.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">
              No valid rows to import — fix the errors above and re-upload.
            </p>
          )}
        </div>
      )}

      {status && (
        <p
          role="status"
          className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800"
        >
          {status}
        </p>
      )}

      {importedCount > 0 && (
        <p className="text-sm text-green-800">
          Imported into preparer_leads this session: {importedCount} lead(s).
        </p>
      )}

      {pending.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">
            Pending-import queue — NOT in Supabase yet ({pendingRows.length}{" "}
            lead(s))
          </h3>
          <p className="mt-1 text-xs text-amber-800">
            These rows are queued in this page only until preparer_leads is
            wired and the import is applied. Download the queue to keep it,
            then re-import the file once the table exists.
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {pending.map((b, i) => (
              <li key={`${b.queuedAt}-${i}`}>
                {b.rows.length} lead(s) queued {b.queuedAt.slice(0, 10)} —{" "}
                {b.reason}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() =>
              download("pending-lead-import.csv", leadsToCsv(pendingRows))
            }
            className="mt-3 rounded border border-amber-400 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            Download pending queue as CSV
          </button>
        </div>
      )}
    </section>
  );
}
