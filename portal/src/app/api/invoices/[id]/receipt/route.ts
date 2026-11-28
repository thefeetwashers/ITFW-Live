// GET /api/invoices/[id]/receipt — printable per-case receipt.
// Reuses the invoices table (0001) and the Stripe webhook records
// (invoice.paid marks the row paid). The USCIS government fee is
// ALWAYS on its own line, never combined with our service fee — see
// buildReceipt() in src/lib/expertTools.ts. An unpaid invoice renders
// the amount DUE, labelled as not paid; the "PAID" stamp appears only
// when status is "paid" with a paid_at timestamp. Printable HTML
// (window.print + print CSS), same pattern as the portal's other
// printable pages — no new PDF generator. Returns 501 when Supabase
// is not configured, 404 when the invoice does not exist. No DOB /
// A-Number / SSN / passport number appears on a receipt.
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { buildReceipt, formatCents } from "@/lib/expertTools";
import { writeAuditLog } from "@/lib/auditLog";
import { createClient } from "@supabase/supabase-js";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Receipts not configured — Supabase env vars are not set, so no receipt was read.",
      },
      { status: 501 }
    );
  }
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id,description,form_code,service_fee_cents,uscis_fee_cents,status,due_at,paid_at,created_at,stripe_invoice_id,case_id,client_id"
    )
    .eq("id", params.id)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  const receipt = buildReceipt(data as Parameters<typeof buildReceipt>[0]);
  // Audit: receipt viewed (ids only — no amounts, no names).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const admin = createClient(url, key, { auth: { persistSession: false } });
    await writeAuditLog(admin, {
      actorId: (data as { client_id: string }).client_id,
      action: "invoice_receipt_viewed",
      entityType: "invoice",
      entityId: receipt.invoiceId,
      caseId: (data as { case_id: string }).case_id,
      detail: { status: receipt.status },
    });
  }
  const rows = receipt.lines
    .map(
      (line) =>
        `<tr><td>${esc(line.label)}</td><td style="text-align:right">${formatCents(line.cents)}</td></tr>`
    )
    .join("\n");
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Receipt — ${esc(receipt.invoiceId.slice(0, 8))}</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:2rem auto;padding:0 1rem;color:#111}table{width:100%;border-collapse:collapse;margin-top:1rem}td,th{border:1px solid #ccc;padding:.5rem;text-align:left}tfoot td{font-weight:700}.paid{color:#166534;font-weight:700}.due{color:#92400e;font-weight:700}@media print{button{display:none}}</style>
</head><body>
<h1>Immigration with NIPTEI — ${receipt.paid ? "Receipt" : "Amount due"}</h1>
<p class="${receipt.paid ? "paid" : "due"}">${receipt.paid ? "PAID" : "NOT PAID YET"}</p>
<p>${esc(receipt.description)}${receipt.formCode ? ` (${esc(receipt.formCode)})` : ""}</p>
<p>Invoice ${esc(receipt.invoiceId)}${receipt.stripeInvoiceId ? ` · Stripe ${esc(receipt.stripeInvoiceId)}` : ""}<br>
Status: ${esc(receipt.status)}${receipt.paidAt ? ` · Paid ${esc(receipt.paidAt.slice(0, 10))}` : ""}</p>
<table><thead><tr><th>Line</th><th style="text-align:right">Amount</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td>Total</td><td style="text-align:right">${formatCents(receipt.totalCents)}</td></tr></tfoot></table>
<p><small>${esc(receipt.note)} The USCIS government fee is always shown on its own line, separate from our service fee. Immigration with NIPTEI is a document-preparation service, not a law firm and not affiliated with USCIS.</small></p>
<button type="button" onclick="window.print()">Print / save as PDF</button>
</body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
