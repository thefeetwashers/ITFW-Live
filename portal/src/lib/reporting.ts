// Reporting + Money Ladder — PURE aggregation over REAL table rows.
// ============================================================================
// Sources (migrations in ../supabase/migrations/):
//  * cases (0001) + case_lifecycle (0010, is_current row = stage 1–6)
//  * service_orders + order_invoices (0006)
//  * invoices (0001) + payment_plans (0002/0003)
//  * preparer_leads (0010)
//  * notification_logs (0010)
//  * documents (0001, review_status) + inbox_items (0001, follow-up due dates)
//
// Rules:
//  * Money is integer cents. Service fees and USCIS government fees are
//    ALWAYS reported separately, never combined into one total.
//  * Every function takes the rows it aggregates. Empty input returns
//    zeros with `isEmpty: true` — the dashboard shows an honest empty
//    state and NEVER invents numbers.
//  * Notifications: only rows in notification_logs count. A notification
//    is "sent" only when a row has status 'sent'. No send is ever claimed
//    from a queue, a plan, or an intention.
//  * This file replaces the old in-page-demo Money Ladder example table
//    ($17,812). That example table is NOT copied anywhere in the portal.
// ============================================================================

/** Row shapes — only the columns the aggregations read. */
export interface InvoiceRow {
  id: string;
  provider_id: string | null;
  form_code: string | null;
  service_fee_cents: number;
  uscis_fee_cents: number;
  status: string; // invoice_status: draft | open | pending | paid | void | refunded | past_due
  due_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface OrderInvoiceRow {
  id: string;
  order_id: string;
  amount_cents: number;
  status: string; // paid | unpaid | overdue | void
  paid_at: string | null;
  created_at: string;
}

export interface PaymentPlanRow {
  id: string;
  provider_id: string | null;
  total_service_fee_cents: number;
  paid_cents: number;
  status: string;
  created_at: string;
}

export interface LifecycleRow {
  case_id: string;
  stage: number; // 1–6
  is_current: boolean;
}

export interface LeadRow {
  id: string;
  preparer_id: string | null;
  lead_source: string | null;
  pipeline_stage: string; // new_lead | quote_sent | payment_pending | converted | lost
  follow_up_date: string | null;
  created_at: string;
}

export interface NotificationLogRow {
  id: string;
  channel: string; // sms | whatsapp | email
  status: string; // sent | failed | not_configured
  created_at: string;
}

export interface DocumentRow {
  id: string;
  review_status: string; // uploaded | under_review | accepted | retake_requested
}

export interface InboxItemRow {
  id: string;
  type: string;
  status: string;
  due_at: string | null;
}

export const LIFECYCLE_STAGE_LABELS: Record<number, string> = {
  1: "1 — New Lead",
  2: "2 — Consultation / Quote Sent",
  3: "3 — Payment Arrangement / Invoice Sent",
  4: "4 — Active Client (Docs & Drafting)",
  5: "5 — Submitted to USCIS / At NVC",
  6: "6 — Visa Approved / Closed",
};

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function monthKey(iso: string): string {
  return iso ? iso.slice(0, 7) : "unknown";
}

export interface MoneySummary {
  /** Service fees actually paid (invoices paid + order milestones paid). */
  paidServiceCents: number;
  /** USCIS government fees on paid invoices (reported separately). */
  paidGovCents: number;
  /** Still owed on open/pending invoices + unpaid milestones. */
  dueServiceCents: number;
  /** Past due (invoices past_due + milestones overdue). */
  overdueServiceCents: number;
  paidByMonth: { month: string; cents: number }[];
  paidByService: { formCode: string; cents: number }[];
  paidByProfessional: { providerId: string; cents: number }[];
  invoiceCount: number;
  isEmpty: boolean;
}

export function summarizeMoney(
  invoices: InvoiceRow[],
  orderInvoices: OrderInvoiceRow[],
  plans: PaymentPlanRow[]
): MoneySummary {
  const byMonth = new Map<string, number>();
  const byService = new Map<string, number>();
  const byProfessional = new Map<string, number>();
  let paidService = 0;
  let paidGov = 0;
  let dueService = 0;
  let overdueService = 0;

  const addPaid = (cents: number, at: string, formCode: string | null, providerId: string | null) => {
    paidService += cents;
    byMonth.set(monthKey(at), (byMonth.get(monthKey(at)) ?? 0) + cents);
    byService.set(formCode ?? "unspecified", (byService.get(formCode ?? "unspecified") ?? 0) + cents);
    byProfessional.set(providerId ?? "unassigned", (byProfessional.get(providerId ?? "unassigned") ?? 0) + cents);
  };

  for (const inv of invoices) {
    if (inv.status === "paid") {
      addPaid(inv.service_fee_cents, inv.paid_at ?? inv.created_at, inv.form_code, inv.provider_id);
      paidGov += inv.uscis_fee_cents;
    } else if (inv.status === "past_due") {
      overdueService += inv.service_fee_cents;
    } else if (inv.status === "open" || inv.status === "pending") {
      dueService += inv.service_fee_cents;
    }
    // draft / void / refunded: not due, not paid.
  }
  for (const oi of orderInvoices) {
    if (oi.status === "paid") {
      // Milestone slices of service_orders; provider/service are not
      // stored on the slice, so they count toward the total and the
      // month only — never attributed to a service or professional.
      paidService += oi.amount_cents;
      byMonth.set(monthKey(oi.paid_at ?? oi.created_at), (byMonth.get(monthKey(oi.paid_at ?? oi.created_at)) ?? 0) + oi.amount_cents);
    } else if (oi.status === "overdue") {
      overdueService += oi.amount_cents;
    } else if (oi.status === "unpaid") {
      dueService += oi.amount_cents;
    }
  }
  // Payment plans are a second view of the same money (0002): their
  // paid_cents are already counted once an invoice/milestone flips to
  // paid, so they are NOT added again here. They are reported as a
  // count only, to avoid double-counting.
  const paidByMonth = Array.from(byMonth.entries())
    .map(([month, cents]) => ({ month, cents }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));
  const paidByService = Array.from(byService.entries())
    .map(([formCode, cents]) => ({ formCode, cents }))
    .sort((a, b) => b.cents - a.cents);
  const paidByProfessional = Array.from(byProfessional.entries())
    .map(([providerId, cents]) => ({ providerId, cents }))
    .sort((a, b) => b.cents - a.cents);

  return {
    paidServiceCents: paidService,
    paidGovCents: paidGov,
    dueServiceCents: dueService,
    overdueServiceCents: overdueService,
    paidByMonth,
    paidByService,
    paidByProfessional,
    invoiceCount: invoices.length + orderInvoices.length,
    isEmpty: invoices.length === 0 && orderInvoices.length === 0 && plans.length === 0,
  };
}

export interface CasesByStage {
  counts: { stage: number; label: string; count: number }[];
  total: number;
  unclassified: number; // cases with no current lifecycle row
  isEmpty: boolean;
}

export function summarizeCasesByStage(rows: LifecycleRow[], totalCases: number): CasesByStage {
  const counts = [1, 2, 3, 4, 5, 6].map((stage) => ({
    stage,
    label: LIFECYCLE_STAGE_LABELS[stage],
    count: rows.filter((r) => r.is_current && r.stage === stage).length,
  }));
  const classified = counts.reduce((n, c) => n + c.count, 0);
  return {
    counts,
    total: totalCases,
    unclassified: Math.max(0, totalCases - classified),
    isEmpty: totalCases === 0,
  };
}

export interface LeadsSummary {
  bySource: { source: string; total: number; converted: number }[];
  total: number;
  converted: number;
  /** Converted / total, null when there are no leads. */
  conversionRate: number | null;
  followUpsOverdue: number;
  isEmpty: boolean;
}

export function summarizeLeads(leads: LeadRow[], todayIso: string): LeadsSummary {
  const bySourceMap = new Map<string, { total: number; converted: number }>();
  let converted = 0;
  let followUpsOverdue = 0;
  for (const lead of leads) {
    const source = lead.lead_source?.trim() || "unspecified";
    const entry = bySourceMap.get(source) ?? { total: 0, converted: 0 };
    entry.total += 1;
    if (lead.pipeline_stage === "converted") {
      entry.converted += 1;
      converted += 1;
    }
    bySourceMap.set(source, entry);
    if (
      lead.follow_up_date &&
      lead.follow_up_date < todayIso &&
      lead.pipeline_stage !== "converted" &&
      lead.pipeline_stage !== "lost"
    ) {
      followUpsOverdue += 1;
    }
  }
  return {
    bySource: Array.from(bySourceMap.entries())
      .map(([source, v]) => ({ source, ...v }))
      .sort((a, b) => b.total - a.total),
    total: leads.length,
    converted,
    conversionRate: leads.length === 0 ? null : converted / leads.length,
    followUpsOverdue,
    isEmpty: leads.length === 0,
  };
}

export interface NotificationsSummary {
  sent: number;
  failed: number;
  notConfigured: number;
  total: number;
  byChannel: { channel: string; sent: number; failed: number; notConfigured: number }[];
  isEmpty: boolean;
}

export function summarizeNotifications(logs: NotificationLogRow[]): NotificationsSummary {
  const byChannelMap = new Map<string, { sent: number; failed: number; notConfigured: number }>();
  let sent = 0;
  let failed = 0;
  let notConfigured = 0;
  for (const log of logs) {
    const entry = byChannelMap.get(log.channel) ?? { sent: 0, failed: 0, notConfigured: 0 };
    if (log.status === "sent") { sent += 1; entry.sent += 1; }
    else if (log.status === "failed") { failed += 1; entry.failed += 1; }
    else { notConfigured += 1; entry.notConfigured += 1; }
    byChannelMap.set(log.channel, entry);
  }
  return {
    sent,
    failed,
    notConfigured,
    total: logs.length,
    byChannel: Array.from(byChannelMap.entries()).map(([channel, v]) => ({ channel, ...v })),
    isEmpty: logs.length === 0,
  };
}

export interface OperationsSummary {
  documentsPendingReview: number;
  followUpsOverdueInbox: number;
  isEmpty: boolean;
}

export function summarizeOperations(documents: DocumentRow[], inboxItems: InboxItemRow[], todayIso: string): OperationsSummary {
  return {
    documentsPendingReview: documents.filter(
      (d) => d.review_status === "uploaded" || d.review_status === "under_review"
    ).length,
    followUpsOverdueInbox: inboxItems.filter(
      (i) => i.due_at && i.due_at.slice(0, 10) < todayIso && i.status !== "accepted"
    ).length,
    isEmpty: documents.length === 0 && inboxItems.length === 0,
  };
}
