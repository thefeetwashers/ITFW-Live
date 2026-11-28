// GET /api/export/case?caseId=<uuid> — one-click export of a client's
// whole file as a printable packet manifest.
// Reuses the packet generation route (/api/generate-packet) for the
// packet itself and the printable-page pattern (window.print + print
// CSS) for the manifest — no new PDF generator. The manifest lists
// exactly what is included and what is NOT (see buildCaseExportManifest
// in src/lib/expertTools.ts): vault file contents are NOT embedded
// (download via signed links), and DOB / A-Number / SSN / passport
// numbers NEVER appear in an export. Every export writes an audit_log
// entry (action "case_exported", ids only). Returns 501 when Supabase
// is not configured, 400 without caseId, 404 when the case does not
// exist. Lists come from real rows only — an empty case exports an
// honest empty manifest, never invented entries.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { buildCaseExportManifest } from "@/lib/expertTools";
import { writeAuditLog } from "@/lib/auditLog";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(req: Request) {
  const caseId = new URL(req.url).searchParams.get("caseId");
  if (!caseId) {
    return NextResponse.json({ error: "caseId is required." }, { status: 400 });
  }
  const supabase = getSupabase();
  const admin = serviceClient();
  if (!supabase || !admin) {
    return NextResponse.json(
      {
        error:
          "Export not configured — Supabase env vars are not set, so nothing was exported.",
      },
      { status: 501 }
    );
  }
  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id,client_id")
    .eq("id", caseId)
    .single();
  if (caseError || !caseRow) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }
  const [docs, sigs, invs] = await Promise.all([
    supabase
      .from("documents")
      .select("file_name,review_status")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
    supabase
      .from("signatures")
      .select("form_code,signer_full_name,signed_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
    supabase
      .from("invoices")
      .select("id,description,status")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
  ]);
  // Forms: the packet route derives the form list from the case's
  // quoted forms; here we list what the case row itself carries. When
  // no form rows exist the list is honestly empty — never invented.
  const { data: caseForms } = await supabase
    .from("cases")
    .select("form_code")
    .eq("id", caseId)
    .single();
  const manifest = buildCaseExportManifest({
    caseId,
    forms:
      caseForms && (caseForms as { form_code: string | null }).form_code
        ? [{ formCode: (caseForms as { form_code: string }).form_code, status: "on file" }]
        : [],
    documents: ((docs.data ?? []) as { file_name: string; review_status: string }[]).map(
      (d) => ({ fileName: d.file_name, reviewStatus: d.review_status })
    ),
    timelineEvents: [],
    signatures: ((sigs.data ?? []) as {
      form_code: string;
      signer_full_name: string;
      signed_at: string | null;
    }[]).map((s) => ({
      formCode: s.form_code,
      signerFullName: s.signer_full_name,
      signedAt: s.signed_at,
    })),
    invoices: ((invs.data ?? []) as { id: string; description: string; status: string }[]).map(
      (i) => ({ id: i.id, description: i.description, status: i.status })
    ),
    generatedAtIso: new Date().toISOString(),
  });
  await writeAuditLog(admin, {
    actorId: (caseRow as { client_id: string }).client_id,
    action: "case_exported",
    entityType: "case",
    entityId: caseId,
    caseId,
    detail: { status: "exported" },
  });
  const section = (title: string, items: string[]) =>
    `<h2>${esc(title)}</h2>${items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "<p>None on file.</p>"}`;
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Case export — ${esc(caseId.slice(0, 8))}</title>
<style>body{font-family:system-ui,sans-serif;max-width:680px;margin:2rem auto;padding:0 1rem;color:#111}@media print{button{display:none}}</style>
</head><body>
<h1>Case file export</h1>
<p>Case ${esc(manifest.caseId)} · Generated ${esc(manifest.generatedAt)}</p>
${section("Included in this export", manifest.included)}
${section("NOT included in this export", manifest.notIncluded)}
${section("Forms", manifest.forms.map((f) => `${f.formCode} — ${f.status}`))}
${section("Documents (names + review status only)", manifest.documents.map((d) => `${d.fileName} — ${d.reviewStatus}`))}
${section("Signatures", manifest.signatures.map((s) => `${s.formCode} — signed ${s.signedAt ? s.signedAt.slice(0, 10) : "not signed yet"}`))}
${section("Invoices", manifest.invoices.map((i) => `${i.description} — ${i.status}`))}
<p><small>Vault file contents are not embedded — download them separately via signed links. No DOB, A-Number, SSN, or passport number appears in this export. This export was recorded in the audit log. Immigration with NIPTEI is a document-preparation service, not a law firm and not affiliated with USCIS.</small></p>
<button type="button" onclick="window.print()">Print / save as PDF</button>
</body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
