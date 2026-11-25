// USCIS template upload + verification — Founder/Admin + professional.
// Upload an official USCIS PDF template (downloaded from uscis.gov) to
// the private `vault` bucket at vault/templates/<form-code>/<edition>.pdf,
// record its form code + edition date + source URL + uploaded by/at, and
// run a FIELD-CHECK that lists every AcroForm field the template
// actually contains and compares it against
// src/lib/uscisFieldMappings.ts.
//
// Per-form status shown here:
//  * "Template uploaded — edition [date] — X of Y fields verified"
//  * "No template uploaded — PDF Auto-Fill will return an error for this form"
// NO template is included in this repo. Nothing here downloads a
// template, and no mapping is marked verified from a guess — only from
// a field-check against the uploaded PDF for that edition.
"use client";

import { useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import {
  SUPPORTED_FORMS,
  templateStoragePath,
  mappingsForForm,
} from "@/lib/uscisFieldMappings";

interface CheckResult {
  formCode: string;
  fileName: string;
  templateFieldCount: number;
  templateFieldNames: string[];
  mappingCount: number;
  matchedCount: number;
  matched: { questionKey: string; fieldLabel: string; acroFormFieldName: string }[];
  unmatchedTemplateFields: string[];
  unverifiedMappings: { questionKey: string; fieldLabel: string; acroFormFieldName: string }[];
}

interface StoredTemplate {
  formCode: string;
  edition: string;
  sourceUrl: string;
  storagePath: string;
  matchedCount: number;
  fieldCount: number;
}

const FORM_CODES = ["I-130", "I-485", "I-864", "I-821", "I-765", "N-400", "I-589", "I-90"];

export default function TemplateVerification() {
  const isLive = useMemo(() => getSupabase() !== null, []);
  const [formCode, setFormCode] = useState("I-130");
  const [edition, setEdition] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [checkError, setCheckError] = useState("");
  const [checking, setChecking] = useState(false);
  const [stored, setStored] = useState<StoredTemplate[]>([]);
  const [recordNote, setRecordNote] = useState("");

  const mappingCount = mappingsForForm(formCode).length;

  async function runCheck() {
    setCheckError("");
    setCheck(null);
    setRecordNote("");
    if (!file) {
      setCheckError("Choose a USCIS PDF template first (downloaded from uscis.gov).");
      return;
    }
    setChecking(true);
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("formCode", formCode);
      const res = await fetch("/api/templates/check", { method: "POST", body: data });
      const json = await res.json();
      if (!res.ok) {
        setCheckError(json.error ?? "Field-check failed.");
        return;
      }
      setCheck(json as CheckResult);
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : "Field-check failed.");
    } finally {
      setChecking(false);
    }
  }

  async function recordUpload() {
    setRecordNote("");
    if (!check || !file) {
      setRecordNote("Run the field-check first — a template is only recorded after its fields have been checked.");
      return;
    }
    if (!edition.trim()) {
      setRecordNote("Enter the edition date printed on the form (for example 07-28-25) before recording.");
      return;
    }
    if (!sourceUrl.trim()) {
      setRecordNote("Enter the uscis.gov source URL the template was downloaded from before recording.");
      return;
    }
    const storagePath = templateStoragePath(formCode, edition.trim());
    const supabase = getSupabase();
    if (!supabase) {
      setRecordNote(
        `Field-check done (${check.matchedCount} of ${check.mappingCount} fields matched), but Supabase is not connected — the file was NOT uploaded to the vault and this template was NOT recorded. Connect Supabase and upload again.`
      );
      return;
    }
    const { error: uploadError } = await supabase.storage
      .from("vault")
      .upload(storagePath, file, { upsert: true, contentType: "application/pdf" });
    if (uploadError) {
      setRecordNote(`Upload to the vault failed: ${uploadError.message}. The template was NOT recorded.`);
      return;
    }
    const { error: insertError } = await supabase.from("uscis_templates").upsert(
      {
        form_code: formCode,
        edition: edition.trim(),
        source_url: sourceUrl.trim(),
        storage_path: storagePath,
        field_count: check.templateFieldCount,
        matched_field_count: check.matchedCount,
        field_check: {
          matched: check.matched,
          unmatchedTemplateFields: check.unmatchedTemplateFields,
          unverifiedMappings: check.unverifiedMappings,
        },
      },
      { onConflict: "form_code,edition" }
    );
    if (insertError) {
      setRecordNote(`File uploaded to ${storagePath}, but the record could not be saved: ${insertError.message}. Check that migration 0018 has been run.`);
      return;
    }
    setStored((prev) => [
      ...prev.filter((s) => !(s.formCode === formCode && s.edition === edition.trim())),
      {
        formCode,
        edition: edition.trim(),
        sourceUrl: sourceUrl.trim(),
        storagePath,
        matchedCount: check.matchedCount,
        fieldCount: check.templateFieldCount,
      },
    ]);
    setRecordNote(`Recorded: ${formCode} edition ${edition.trim()} → ${storagePath}. ${check.matchedCount} of ${check.mappingCount} mapped fields matched this PDF.`);
  }

  function statusFor(form: string): string {
    const row = stored.find((s) => s.formCode === form);
    const total = mappingsForForm(form).length;
    if (!row) {
      return "No template uploaded — PDF Auto-Fill will return an error for this form.";
    }
    return `Template uploaded — edition ${row.edition} — ${row.matchedCount} of ${total} fields verified.`;
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="template-upload-heading" className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
        <h2 id="template-upload-heading" className="text-base font-semibold">
          USCIS Templates — Upload &amp; Field-Check
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Download the official PDF from uscis.gov (guide in DEPLOY.md, section 10), then
          upload it here. The field-check lists every AcroForm field the template actually
          contains and compares it with the mappings in{" "}
          <code>src/lib/uscisFieldMappings.ts</code>. Mappings are updated from check results
          only — never from guessed names. No template is included in this repo.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Form
            <select value={formCode} onChange={(e) => { setFormCode(e.target.value); setCheck(null); }} className="mt-1 w-full rounded border border-slate-300 px-2 py-1">
              {FORM_CODES.map((f) => (<option key={f} value={f}>{f}</option>))}
            </select>
          </label>
          <label className="text-sm">
            Edition date (printed on the form, e.g. 07-28-25)
            <input type="text" value={edition} onChange={(e) => setEdition(e.target.value)} placeholder="MM-DD-YY" className="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
          </label>
          <label className="text-sm sm:col-span-2">
            Source URL (the uscis.gov page the template was downloaded from)
            <input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://www.uscis.gov/..." className="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
          </label>
          <label className="text-sm sm:col-span-2">
            USCIS PDF template
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setCheck(null); }}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
            />
          </label>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Mappings on file for {formCode}: {mappingCount}. All are UNVERIFIED until a
          field-check against the real PDF for this edition confirms them.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={runCheck} disabled={!file || checking} className="rounded bg-blue-700 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50">
            {checking ? "Checking…" : "Run field-check"}
          </button>
          <button type="button" onClick={recordUpload} disabled={!check} className="rounded border border-blue-700 px-3 py-1 text-sm font-semibold text-blue-700 disabled:opacity-50">
            Upload to vault &amp; record
          </button>
        </div>
        {!isLive && (
          <p className="mt-2 text-sm text-amber-900">
            Supabase is not connected — field-checks run locally, but uploads and records cannot be stored yet.
          </p>
        )}
        {checkError && (
          <p role="alert" className="mt-2 rounded border border-red-400 bg-red-50 p-2 text-sm text-red-900">{checkError}</p>
        )}
        {recordNote && (
          <p role="status" className="mt-2 rounded border border-slate-300 bg-slate-50 p-2 text-sm">{recordNote}</p>
        )}

        {check && (
          <div className="mt-4 rounded border border-slate-300 bg-slate-50 p-3 text-sm" role="status">
            <p className="font-semibold">
              Field-check: {check.fileName} — {check.matchedCount} of {check.mappingCount} mapped fields found on this PDF
              ({check.templateFieldCount} AcroForm fields in total).
            </p>
            {check.matched.length > 0 && (
              <>
                <p className="mt-2 font-medium">Matched fields (exact name found on the PDF):</p>
                <ul className="list-disc pl-5">
                  {check.matched.map((m) => (
                    <li key={m.acroFormFieldName}>
                      <code>{m.acroFormFieldName}</code> — {m.fieldLabel}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {check.unverifiedMappings.length > 0 && (
              <>
                <p className="mt-2 font-medium">Mappings NOT found on this PDF — still unverified, do not use to fill this edition:</p>
                <ul className="list-disc pl-5">
                  {check.unverifiedMappings.map((m) => (
                    <li key={m.acroFormFieldName}>
                      <code>{m.acroFormFieldName}</code> — {m.fieldLabel}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {check.unmatchedTemplateFields.length > 0 && (
              <>
                <p className="mt-2 font-medium">Fields on the PDF with no mapping yet (write mappings from this list only):</p>
                <ul className="max-h-48 list-disc overflow-y-auto pl-5">
                  {check.unmatchedTemplateFields.map((n) => (
                    <li key={n}><code>{n}</code></li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="template-status-heading" className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
        <h2 id="template-status-heading" className="text-base font-semibold">Template status by form</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {SUPPORTED_FORMS.map((f) => (
            <li key={f.formCode} className="rounded border border-slate-200 px-3 py-2">
              <strong>{f.formCode}</strong> — {statusFor(f.formCode)}
              <span className="block text-xs text-slate-500">{f.note}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Status above reflects templates recorded in this session. After Supabase is connected
          and migration 0018 is run, recorded templates are read from the uscis_templates table.
        </p>
      </section>
    </div>
  );
}
