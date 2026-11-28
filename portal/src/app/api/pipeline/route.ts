// GET /api/pipeline?role=preparer|attorney|doj&providerId=<account id>
// — Client Pipeline rows for one professional.
//
// Assembles each row from tables migrations already provide — nothing
// new is stored:
//   cases (0001) + accounts.client (0001, incl. date_of_birth) +
//   case_lifecycle.is_current (0010, stages 1-6) +
//   case_next_steps.is_current (0016) or deriveNextStep (nextStepEngine)
//   inbox_items type 'missing_document' status 'missing' (0001) +
//   packet_audit_items status 'fail' (0005) for the checklist +
//   invoices.status (0001) + order_invoices.status (0006) for payment
//   status, derived by derivePaymentStatus (lib/pipeline.ts).
//
// PRIVACY: accounts.date_of_birth is read server-side and returned
// MASKED ONLY (••/••/1990, maskDob). The full date never leaves this
// route, is never in the JSON, and is never logged. No SSN exists
// anywhere in this data. Reads use the caller's session (Authorization
// header forwarded to the anon client) so RLS applies as that user —
// no service-role read. Returns 501 / notConfigured when Supabase env
// vars are missing. Empty result returns [] with an honest empty
// state, never invented rows.
//
// STAGE-NUMBER NOTE: lifecycle stage numbers are mapped in
// LIFECYCLE_STAGES order (lib/lifecycle.ts: 1 new_lead, 2
// consultation_quote, 3 payment_arrangement, 4 active_client, 5
// submitted_uscis, 6 visa_approved_closed). The confirm-intake-order
// header calls stage 2 "payment_plan" — that label disagrees with
// lifecycle.ts and is flagged in the build report; this route follows
// lifecycle.ts and does not silently rename either.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  derivePaymentStatus,
  maskDob,
  type InvoiceStatusRow,
  type PipelineClientRow,
  type PipelineRole,
} from "@/lib/pipeline";
import { deriveNextStep, parsePathfinderRoute } from "@/lib/nextStepEngine";
import { safeDbError } from "@/lib/apiErrors";
import { LIFECYCLE_STAGES, type LifecycleStageId } from "@/lib/lifecycle";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";

const STAGE_BY_NUMBER: LifecycleStageId[] = LIFECYCLE_STAGES.map((s) => s.id);

function notConfigured() {
  return NextResponse.json(
    {
      error:
        "Pipeline not configured — NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. No client rows were returned.",
      notConfigured: true,
    },
    { status: 501 }
  );
}

export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return notConfigured();

  const params = new URL(req.url).searchParams;
  const role = (params.get("role") ?? "preparer") as PipelineRole;
  if (role !== "preparer" && role !== "attorney" && role !== "doj") {
    return NextResponse.json(
      { error: `Role "${role}" is not recognised — use preparer, attorney or doj.` },
      { status: 400 }
    );
  }
  const providerId = params.get("providerId");
  if (!providerId) {
    return NextResponse.json(
      { error: "providerId query parameter is required." },
      { status: 400 }
    );
  }
  // Assigned-provider role per pipeline role: preparer -> 'preparer',
  // attorney -> 'attorney', doj -> 'nonprofit' (DOJ-recognised orgs).
  const assignedRole = role === "preparer" ? "preparer" : role === "attorney" ? "attorney" : "nonprofit";

  const authHeader = req.headers.get("authorization") ?? undefined;
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });

  const { data: cases, error: casesError } = await client
    .from("cases")
    .select("id, client_id, assigned_provider_role, forms, status, pathfinder_route")
    .eq("assigned_provider_id", providerId)
    .eq("assigned_provider_role", assignedRole)
    .order("created_at", { ascending: false });
  if (casesError) {
    return NextResponse.json(
      { error: safeDbError("Could not list cases. No rows are shown.", undefined, casesError) },
      { status: 500 }
    );
  }
  const caseRows = (cases ?? []) as {
    id: string;
    client_id: string;
    assigned_provider_role: "preparer" | "attorney" | "nonprofit";
    forms: string[];
    status: string;
    pathfinder_route: Record<string, unknown> | null;
  }[];
  if (caseRows.length === 0) {
    return NextResponse.json({ ok: true, role, rows: [], emptyState: "No clients in this pipeline yet — convert a lead to create your first case." });
  }

  const caseIds = caseRows.map((c) => c.id);
  const clientIds = Array.from(new Set(caseRows.map((c) => c.client_id)));

  const [accountsRes, lifecycleRes, nextStepsRes, inboxRes, auditRes, invoicesRes, leadsRes] =
    await Promise.all([
      client.from("accounts").select("id, full_name, email, phone, preferred_language, date_of_birth").in("id", clientIds),
      client.from("case_lifecycle").select("case_id, stage, sub_stage").in("case_id", caseIds).eq("is_current", true),
      client.from("case_next_steps").select("case_id, what, by_when").in("case_id", caseIds).eq("is_current", true),
      client.from("inbox_items").select("case_id, title").in("case_id", caseIds).eq("type", "missing_document").eq("status", "missing"),
      client.from("packet_audit_items").select("case_id, status").in("case_id", caseIds),
      client.from("invoices").select("case_id, status, service_fee_cents, due_at").in("case_id", caseIds),
      client.from("preparer_leads").select("id, case_id").in("case_id", caseIds),
    ]);
  // order_invoices has no case_id column — it links via service_orders,
  // so fetch it through the orders of these cases.
  let orderInvoiceRows: { status: string; amount_cents: number; order_id: string }[] = [];
  const { data: orders } = await client
    .from("service_orders")
    .select("id, case_id")
    .in("case_id", caseIds);
  const orderIds = ((orders ?? []) as { id: string; case_id: string }[]).map((o) => o.id);
  if (orderIds.length > 0) {
    const { data: oi } = await client
      .from("order_invoices")
      .select("order_id, status, amount_cents")
      .in("order_id", orderIds);
    orderInvoiceRows = (oi ?? []) as typeof orderInvoiceRows;
  }
  const caseByOrderId = new Map(
    ((orders ?? []) as { id: string; case_id: string }[]).map((o) => [o.id, o.case_id])
  );

  const accountsById = new Map(
    ((accountsRes.data ?? []) as {
      id: string;
      full_name: string;
      email: string;
      phone: string | null;
      preferred_language: LanguageCode;
      date_of_birth: string | null;
    }[]).map((a) => [a.id, a])
  );
  const lifecycleByCase = new Map(
    ((lifecycleRes.data ?? []) as { case_id: string; stage: number; sub_stage: string | null }[]).map(
      (l) => [l.case_id, l]
    )
  );
  const nextStepByCase = new Map(
    ((nextStepsRes.data ?? []) as { case_id: string; what: string; by_when: string | null }[]).map(
      (n) => [n.case_id, n]
    )
  );
  const missingByCase = new Map<string, string[]>();
  for (const item of (inboxRes.data ?? []) as { case_id: string; title: string }[]) {
    const list = missingByCase.get(item.case_id) ?? [];
    list.push(item.title);
    missingByCase.set(item.case_id, list);
  }
  const auditByCase = new Map<string, { pass: number; total: number }>();
  for (const item of (auditRes.data ?? []) as { case_id: string; status: string }[]) {
    const agg = auditByCase.get(item.case_id) ?? { pass: 0, total: 0 };
    agg.total += 1;
    if (item.status === "pass") agg.pass += 1;
    auditByCase.set(item.case_id, agg);
  }
  const invoicesByCase = new Map<string, InvoiceStatusRow[]>();
  for (const inv of (invoicesRes.data ?? []) as {
    case_id: string;
    status: string;
    service_fee_cents: number;
    due_at: string | null;
  }[]) {
    const list = invoicesByCase.get(inv.case_id) ?? [];
    list.push({
      invoiceStatus: inv.status,
      orderInvoiceStatus: null,
      amountCents: inv.service_fee_cents,
      dueDate: inv.due_at,
    });
    invoicesByCase.set(inv.case_id, list);
  }
  // Map order invoices back to cases via service_orders.case_id.
  for (const oi of orderInvoiceRows) {
    const caseId = caseByOrderId.get(oi.order_id);
    if (!caseId) continue;
    const list = invoicesByCase.get(caseId) ?? [];
    list.push({
      invoiceStatus: null,
      orderInvoiceStatus: oi.status,
      amountCents: oi.amount_cents,
      dueDate: null,
    });
    invoicesByCase.set(caseId, list);
  }
  const leadIdByCase = new Map(
    ((leadsRes.data ?? []) as { id: string; case_id: string }[]).map((l) => [l.case_id, l.id])
  );

  const rows: PipelineClientRow[] = caseRows.map((c) => {
    const account = accountsById.get(c.client_id);
    const lifecycle = lifecycleByCase.get(c.id);
    const stageNumber =
      lifecycle && lifecycle.stage >= 1 && lifecycle.stage <= 6 ? lifecycle.stage : 1;
    const stage: LifecycleStageId = STAGE_BY_NUMBER[stageNumber - 1] ?? "new_lead";
    const nextStepRow = nextStepByCase.get(c.id);
    const missing = missingByCase.get(c.id) ?? [];
    const audit = auditByCase.get(c.id);
    const payment = derivePaymentStatus(invoicesByCase.get(c.id) ?? []);
    let nextStep = nextStepRow?.what ?? "";
    let nextStepByWhen = nextStepRow?.by_when ?? null;
    if (!nextStep) {
      // No professional-set step: derive one from the case (never invent).
      try {
        const parsedRoute = parsePathfinderRoute(c.pathfinder_route);
        const derived = deriveNextStep({
          route: parsedRoute,
          uscisStage: null,
          blockingItems: missing.map((title, i) => ({
            id: `missing-${i}`,
            label: title,
            status: "missing" as const,
            blocking: true,
          })),
          language: account?.preferred_language ?? "en",
        });
        nextStep = derived.title;
        nextStepByWhen = derived.byWhen;
      } catch {
        nextStep = "Your provider needs to confirm your route first";
      }
    }
    return {
      caseId: c.id,
      leadId: leadIdByCase.get(c.id) ?? null,
      clientName: account?.full_name ?? "Name not on file",
      dateOfBirthMasked: maskDob(account?.date_of_birth ?? null),
      phone: account?.phone ?? null,
      email: account?.email ?? "",
      preferredLanguage: account?.preferred_language ?? "en",
      service: (c.forms ?? []).join(", ") || c.status,
      stage,
      stageNumber,
      stage5SubStage:
        lifecycle?.sub_stage === "5A" || lifecycle?.sub_stage === "5B"
          ? lifecycle.sub_stage
          : null,
      nextStep,
      nextStepByWhen,
      missingDocuments: missing,
      missingCount: missing.length,
      packetReadinessPercent:
        audit && audit.total > 0 ? Math.round((audit.pass / audit.total) * 100) : null,
      paymentStatus: payment.status,
      paymentDetail: payment.detail,
      assignedProviderRole: c.assigned_provider_role,
    };
  });

  return NextResponse.json({
    ok: true,
    role,
    rows,
    emptyState:
      rows.length === 0
        ? "No clients in this pipeline yet — convert a lead to create your first case."
        : null,
  });
}
