// Translation orders — POST /api/translation-orders, GET ?caseId=.
// Certified document translation at the LOCKED $45/page
// (addon_translation_page, 4500 cents — portal src/lib/stripePrices.ts).
// Page counts come ONLY from document_translations rows (migration
// 0030) via translationEstimate() in src/lib/moreAdded.ts — 0 pages
// means "not counted yet", never guessed.
//
// POST { caseId, clientId, items: [{ documentType, pages, status }] }
//   -> records a translation_orders row (migration 0033) with status
//      "pending" and payment_status "unpaid", and returns the Stripe
//      Checkout payload { priceKey: "addon_translation_page", quantity:
//      totalPages } for the caller to post to POST /api/checkout
//      (which accepts items[].quantity). The order stays "pending"
//      until Google Cloud Translation is connected and a real
//      translation is delivered — NO translation is ever claimed done.
//      Payment is confirmed only by the Stripe webhook
//      (checkout.session.completed, metadata.translation_order_id),
//      which flips payment_status to "paid". The order status itself
//      stays "pending" after payment until delivery.
// GET ?caseId=<uuid> — that case's orders, newest first.
// Returns 501 when Supabase is not configured. No DOB / A-Number /
// SSN / passport number is accepted or stored by this route.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { buildTranslationOrder, TRANSLATION_ORDER_STATUS } from "@/lib/expertTools";
import { writeAuditLog } from "@/lib/auditLog";
import type { TranslationItem } from "@/lib/moreAdded";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function notConfigured() {
  return NextResponse.json(
    {
      error:
        "Translation orders not configured — Supabase env vars are not set, so no order was stored. Run migration 0033 first.",
      providerStatus: TRANSLATION_ORDER_STATUS.note,
    },
    { status: 501 }
  );
}

export async function GET(req: Request) {
  const caseId = new URL(req.url).searchParams.get("caseId");
  if (!caseId) {
    return NextResponse.json({ error: "caseId is required." }, { status: 400 });
  }
  const supabase = getSupabase();
  if (!supabase) return notConfigured();
  const { data, error } = await supabase
    .from("translation_orders")
    .select("id,case_id,document_types,total_pages,total_cents,price_per_page_cents,status,provider,provider_connected,payment_status,created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      { error: `Could not read translation orders: ${error.message}. Migration 0033 may not have run yet.` },
      { status: 500 }
    );
  }
  return NextResponse.json({
    orders: data ?? [],
    isEmpty: (data ?? []).length === 0,
    providerStatus: TRANSLATION_ORDER_STATUS.note,
  });
}

export async function POST(req: Request) {
  const admin = serviceClient();
  if (!admin) return notConfigured();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const items = Array.isArray(body.items)
    ? (body.items as TranslationItem[]).map((i) => ({
        documentType: typeof i?.documentType === "string" ? i.documentType : "",
        pages: typeof i?.pages === "number" && i.pages >= 0 ? Math.floor(i.pages) : 0,
        status: i?.status ?? "needed",
      }))
    : [];
  const built = buildTranslationOrder({
    caseId: typeof body.caseId === "string" ? body.caseId : "",
    clientId: typeof body.clientId === "string" ? body.clientId : "",
    items,
  });
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }
  const { data, error } = await admin
    .from("translation_orders")
    .insert(built.row)
    .select("id")
    .single();
  if (error) {
    return NextResponse.json(
      { error: `Translation order was NOT recorded: ${error.message}. Migration 0033 may not have run yet.` },
      { status: 500 }
    );
  }
  await writeAuditLog(admin, {
    actorId: built.row.client_id,
    action: "translation_order_placed",
    entityType: "translation_order",
    entityId: data?.id ?? "",
    caseId: built.row.case_id,
    detail: { provider: "google_cloud_translation", status: "pending" },
  });
  return NextResponse.json(
    {
      ok: true,
      orderId: data?.id ?? null,
      status: "pending",
      paymentStatus: "unpaid",
      totalPages: built.row.total_pages,
      totalCents: built.row.total_cents,
      pricePerPageCents: built.row.price_per_page_cents,
      estimate: built.estimate,
      // Pay via the existing checkout route — locked Price, quantity =
      // total pages. Include translation_order_id in the checkout
      // metadata so the webhook can confirm payment on this order.
      checkout: {
        ...built.checkout,
        metadata: { translation_order_id: data?.id ?? null, case_id: built.row.case_id },
      },
      providerStatus: built.providerStatus,
    },
    { status: 201 }
  );
}
