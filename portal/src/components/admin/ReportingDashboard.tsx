// Reporting + Money Ladder dashboard — Founder/Admin + professional.
// Reads REAL tables only (cases, service_orders, order_invoices,
// payment_plans, invoices, preparer_leads, notification_logs,
// case_lifecycle, documents, inbox_items) via the anon Supabase client,
// so RLS scopes every number to what the signed-in account may see.
//
// Honest empty states: when a table has 0 rows the dashboard says "No
// records yet" and shows $0.00 — it never invents numbers. When
// Supabase is not connected, or a table does not exist yet (migration
// not run), the section says so instead of showing example numbers.
// This replaces the old in-page-demo Money Ladder $17,812 example
// table — that example is not used anywhere here.
"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import {
  formatCents,
  summarizeCasesByStage,
  summarizeLeads,
  summarizeMoney,
  summarizeNotifications,
  summarizeOperations,
  type DocumentRow,
  type InboxItemRow,
  type InvoiceRow,
  type LeadRow,
  type LifecycleRow,
  type NotificationLogRow,
  type OrderInvoiceRow,
  type PaymentPlanRow,
} from "@/lib/reporting";

function Empty({ children }: { children: string }) {
  return (
    <p role="status" className="mt-1 rounded border border-slate-200 bg-slate-50 p-2 text-sm text-slate-600">
      {children}
    </p>
  );
}

export default function ReportingDashboard() {
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [tableErrors, setTableErrors] = useState<string[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [orderInvoices, setOrderInvoices] = useState<OrderInvoiceRow[]>([]);
  const [plans, setPlans] = useState<PaymentPlanRow[]>([]);
  const [lifecycle, setLifecycle] = useState<LifecycleRow[]>([]);
  const [totalCases, setTotalCases] = useState(0);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [logs, setLogs] = useState<NotificationLogRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [inboxItems, setInboxItems] = useState<InboxItemRow[]>([]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setNotConfigured(true);
      setLoading(false);
      return;
    }
    (async () => {
      const errors: string[] = [];
      const fetchTable = async <T,>(table: string, columns: string): Promise<T[]> => {
        const { data, error } = await supabase.from(table).select(columns);
        if (error) {
          errors.push(`${table}: ${error.message}`);
          return [];
        }
        return (data ?? []) as T[];
      };
      const [inv, ord, pln, life, caseRows, leadRows, logRows, docRows, inboxRows] =
        await Promise.all([
          fetchTable<InvoiceRow>("invoices", "id,provider_id,form_code,service_fee_cents,uscis_fee_cents,status,due_at,paid_at,created_at"),
          fetchTable<OrderInvoiceRow>("order_invoices", "id,order_id,amount_cents,status,paid_at,created_at"),
          fetchTable<PaymentPlanRow>("payment_plans", "id,provider_id,total_service_fee_cents,paid_cents,status,created_at"),
          fetchTable<LifecycleRow>("case_lifecycle", "case_id,stage,is_current"),
          fetchTable<{ id: string }>("cases", "id"),
          fetchTable<LeadRow>("preparer_leads", "id,preparer_id,lead_source,pipeline_stage,follow_up_date,created_at"),
          fetchTable<NotificationLogRow>("notification_logs", "id,channel,status,created_at"),
          fetchTable<DocumentRow>("documents", "id,review_status"),
          fetchTable<InboxItemRow>("inbox_items", "id,type,status,due_at"),
        ]);
      setInvoices(inv);
      setOrderInvoices(ord);
      setPlans(pln);
      setLifecycle(life);
      setTotalCases(caseRows.length);
      setLeads(leadRows);
      setLogs(logRows);
      setDocuments(docRows);
      setInboxItems(inboxRows);
      setTableErrors(errors);
      setLoading(false);
    })();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const money = summarizeMoney(invoices, orderInvoices, plans);
  const stages = summarizeCasesByStage(lifecycle, totalCases);
  const leadSummary = summarizeLeads(leads, today);
  const notifications = summarizeNotifications(logs);
  const ops = summarizeOperations(documents, inboxItems, today);

  return (
    <section aria-labelledby="reporting-heading" className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
      <h2 id="reporting-heading" className="text-base font-semibold">
        Reporting &amp; Money Ladder — Real Records Only
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Every number below comes from a real table (cases, invoices, order invoices, payment
        plans, leads, notification logs). Service fees and USCIS government fees are always
        separate. When there are no records yet, the dashboard shows $0.00 and says so — it
        never invents numbers.
      </p>

      {loading && <p role="status" className="mt-3 text-sm text-slate-600">Loading real records…</p>}

      {!loading && notConfigured && (
        <Empty>
          Supabase is not connected, so no live records can be read. Connect Supabase and run
          migrations 0001–0020 — until then this dashboard shows no numbers at all, not example numbers.
        </Empty>
      )}

      {!loading && !notConfigured && tableErrors.length > 0 && (
        <div role="alert" className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Some tables could not be read (their sections show no numbers):</p>
          <ul className="mt-1 list-disc pl-5">
            {tableErrors.map((e) => (<li key={e}>{e}</li>))}
          </ul>
          <p className="mt-1">A table that does not exist yet usually means its migration has not been run live.</p>
        </div>
      )}

      {!loading && !notConfigured && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded border border-slate-200 p-3">
            <h3 className="font-semibold">Money in — service fees</h3>
            {money.isEmpty ? (
              <Empty>No invoices, order invoices, or payment plans yet — $0.00 paid, $0.00 due, $0.00 overdue.</Empty>
            ) : (
              <dl className="mt-1 space-y-1 text-sm">
                <div className="flex justify-between"><dt>Paid (service fees)</dt><dd className="font-semibold">{formatCents(money.paidServiceCents)}</dd></div>
                <div className="flex justify-between"><dt>Due (not yet paid)</dt><dd>{formatCents(money.dueServiceCents)}</dd></div>
                <div className="flex justify-between"><dt>Overdue</dt><dd>{formatCents(money.overdueServiceCents)}</dd></div>
                <div className="flex justify-between"><dt>USCIS gov fees on paid invoices (separate)</dt><dd>{formatCents(money.paidGovCents)}</dd></div>
                <div className="flex justify-between"><dt>Payment plans on file</dt><dd>{plans.length}</dd></div>
              </dl>
            )}
            {money.paidByMonth.length > 0 && (
              <>
                <h4 className="mt-3 font-medium">Paid by month</h4>
                <ul className="mt-1 space-y-1 text-sm">
                  {money.paidByMonth.map((m) => (
                    <li key={m.month} className="flex justify-between"><span>{m.month}</span><span>{formatCents(m.cents)}</span></li>
                  ))}
                </ul>
              </>
            )}
            {money.paidByService.length > 0 && (
              <>
                <h4 className="mt-3 font-medium">Paid by service (form)</h4>
                <ul className="mt-1 space-y-1 text-sm">
                  {money.paidByService.map((s) => (
                    <li key={s.formCode} className="flex justify-between"><span>{s.formCode}</span><span>{formatCents(s.cents)}</span></li>
                  ))}
                </ul>
              </>
            )}
            {money.paidByProfessional.length > 0 && (
              <>
                <h4 className="mt-3 font-medium">Paid by professional (account id)</h4>
                <ul className="mt-1 space-y-1 text-sm">
                  {money.paidByProfessional.map((p) => (
                    <li key={p.providerId} className="flex justify-between"><span className="break-all">{p.providerId}</span><span>{formatCents(p.cents)}</span></li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="rounded border border-slate-200 p-3">
            <h3 className="font-semibold">Cases by lifecycle stage (1–6)</h3>
            {stages.isEmpty ? (
              <Empty>No cases yet.</Empty>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {stages.counts.map((c) => (
                  <li key={c.stage} className="flex justify-between"><span>{c.label}</span><span>{c.count}</span></li>
                ))}
                <li className="flex justify-between"><span>No current stage recorded</span><span>{stages.unclassified}</span></li>
                <li className="flex justify-between font-semibold"><span>Total cases</span><span>{stages.total}</span></li>
              </ul>
            )}
          </div>

          <div className="rounded border border-slate-200 p-3">
            <h3 className="font-semibold">Leads by source &amp; conversion</h3>
            {leadSummary.isEmpty ? (
              <Empty>No leads yet — conversion rate cannot be calculated from 0 leads.</Empty>
            ) : (
              <>
                <ul className="mt-1 space-y-1 text-sm">
                  {leadSummary.bySource.map((s) => (
                    <li key={s.source} className="flex justify-between">
                      <span>{s.source}</span><span>{s.total} lead(s), {s.converted} converted</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm">
                  Conversion rate:{" "}
                  <strong>
                    {leadSummary.conversionRate === null
                      ? "—"
                      : `${(leadSummary.conversionRate * 100).toFixed(1)}% (${leadSummary.converted} of ${leadSummary.total})`}
                  </strong>
                </p>
                <p className="mt-1 text-sm">Follow-ups overdue: <strong>{leadSummary.followUpsOverdue}</strong></p>
              </>
            )}
          </div>

          <div className="rounded border border-slate-200 p-3">
            <h3 className="font-semibold">Follow-ups &amp; documents</h3>
            {ops.isEmpty ? (
              <Empty>No documents or inbox items yet.</Empty>
            ) : (
              <dl className="mt-1 space-y-1 text-sm">
                <div className="flex justify-between"><dt>Documents pending review</dt><dd className="font-semibold">{ops.documentsPendingReview}</dd></div>
                <div className="flex justify-between"><dt>Inbox follow-ups overdue</dt><dd className="font-semibold">{ops.followUpsOverdueInbox}</dd></div>
                <div className="flex justify-between"><dt>Lead follow-ups overdue</dt><dd className="font-semibold">{leadSummary.followUpsOverdue}</dd></div>
              </dl>
            )}
          </div>

          <div className="rounded border border-slate-200 p-3 md:col-span-2">
            <h3 className="font-semibold">Notifications — sent / failed / not configured</h3>
            <p className="mt-1 text-xs text-slate-500">
              Counted only from notification_logs rows. A notification counts as sent only when
              a row has status &apos;sent&apos;. Nothing here claims a send that did not happen.
            </p>
            {notifications.isEmpty ? (
              <Empty>No notification log rows yet — 0 sent, 0 failed, 0 not configured.</Empty>
            ) : (
              <>
                <dl className="mt-1 space-y-1 text-sm">
                  <div className="flex justify-between"><dt>Sent</dt><dd className="font-semibold">{notifications.sent}</dd></div>
                  <div className="flex justify-between"><dt>Failed</dt><dd>{notifications.failed}</dd></div>
                  <div className="flex justify-between"><dt>Not configured</dt><dd>{notifications.notConfigured}</dd></div>
                  <div className="flex justify-between"><dt>Total logged</dt><dd>{notifications.total}</dd></div>
                </dl>
                <ul className="mt-2 space-y-1 text-sm">
                  {notifications.byChannel.map((c) => (
                    <li key={c.channel} className="flex justify-between">
                      <span>{c.channel}</span>
                      <span>{c.sent} sent · {c.failed} failed · {c.notConfigured} not configured</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
