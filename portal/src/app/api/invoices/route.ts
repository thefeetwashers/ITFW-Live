// /api/invoices — professional invoice list + send-via-SES.
// GET  ?providerId=<account id> — that professional's invoices
//        (invoices, 0001), newest first, with the locked missed-payment
//        rule shown per open/past-due invoice ("If you miss a payment,
//        50% is added to the total amount" — src/lib/order.ts).
// POST { invoiceId, toEmail } — send the invoice by platform AWS SES
//        (src/lib/email.ts). When SES is not configured this returns
//        501 and the invoice is NOT sent — nothing is ever claimed
//        sent. No DOB / A-Number / SSN / passport number in the subject
//        or body; only the invoice description and amounts from the row.
//        The platform never charges here — sending an invoice is not a
//        payment, and payment is confirmed only by the Stripe webhook.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import {
  invoiceSendBlockedReason,
  listProfessionalInvoices,
} from "@/lib/businessTools";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  const providerId = new URL(req.url).searchParams.get("providerId");
  if (!providerId) {
    return NextResponse.json({ error: "providerId is required." }, { status: 400 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Invoices not configured — Supabase env vars are not set, so no invoices were read.",
        invoices: [],
      },
      { status: 501 }
    );
  }
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      { error: `Could not read invoices: ${error.message}. Migration 0001 may not have run yet.` },
      { status: 500 }
    );
  }
  const invoices = listProfessionalInvoices(
    (data ?? []) as Parameters<typeof listProfessionalInvoices>[0],
    providerId
  );
  return NextResponse.json({
    invoices,
    isEmpty: invoices.length === 0,
    emptyMessage:
      invoices.length === 0
        ? "No invoices yet. Invoices you create for your clients will appear here."
        : undefined,
    emailConfigured: isEmailConfigured(),
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId : "";
  const toEmail = typeof body.toEmail === "string" ? body.toEmail.trim() : "";
  if (!invoiceId || !toEmail || !toEmail.includes("@")) {
    return NextResponse.json(
      { error: "invoiceId and a valid toEmail are required." },
      { status: 400 }
    );
  }
  const blocked = invoiceSendBlockedReason(isEmailConfigured());
  if (blocked) {
    return NextResponse.json({ error: blocked, sent: false }, { status: 501 });
  }
  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Invoices not configured — Supabase env vars are not set, so the invoice was NOT sent.", sent: false },
      { status: 501 }
    );
  }
  const { data, error } = await admin
    .from("invoices")
    .select("id,description,form_code,service_fee_cents,uscis_fee_cents,status,due_at")
    .eq("id", invoiceId)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "Invoice not found.", sent: false }, { status: 404 });
  }
  const result = await sendEmail({
    to: toEmail,
    subject: `Your invoice — ${data.description}`,
    text: [
      `Invoice: ${data.description}`,
      data.form_code ? `Form: ${data.form_code}` : null,
      `Service fee: $${(data.service_fee_cents / 100).toFixed(2)}`,
      `USCIS government fee: $${(data.uscis_fee_cents / 100).toFixed(2)}`,
      `Status: ${data.status}`,
      data.due_at ? `Due: ${data.due_at.slice(0, 10)}` : null,
      `If you miss a payment, 50% is added to the total amount.`,
      `Immigration with NIPTEI — document preparation only, not a law firm, not affiliated with USCIS.`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, sent: false }, { status: 501 });
  }
  return NextResponse.json({ sent: true, messageId: result.messageId });
}
