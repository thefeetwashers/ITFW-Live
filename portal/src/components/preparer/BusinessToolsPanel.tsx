// Business Tools panel — the professional's "run my business online"
// view, mounted on the Preparer Command Center tab. Every section
// renders from the rows passed in; with no rows it shows an honest
// empty state and NEVER invents clients, revenue or connections.
// All props are optional and default to empty / not-connected, because
// the dashboard in this build has no live account wired in yet.
// Document preparation only — not a law firm, not USCIS-affiliated;
// only a licensed attorney or DOJ-accredited representative gives
// legal advice (8 CFR 292.1). No approval is ever promised.
"use client";

import { useState } from "react";
import type { ProviderConnection } from "@/lib/byo";
import {
  BYO_STRIPE_NOT_CONNECTED,
  CALENDAR_NOT_CONNECTED,
  ESIGN_PROVIDER_STATUS,
  SMS_WHATSAPP_NOT_CONNECTED,
  describeByoStripe,
  filterPipelineClients,
  groupVaultByClient,
  listProfessionalInvoices,
  unreadForCase,
  type CalendarEvent,
  type ProfessionalMonthlySummary,
} from "@/lib/businessTools";
import { formatCents } from "@/lib/reporting";
import { MISSED_PAYMENT_RULE } from "@/lib/order";
import type { PipelineClientRow, PaymentStatus } from "@/lib/pipeline";
import type { InvoiceRow } from "@/lib/reporting";
import type { VaultDocumentInput } from "@/lib/vaultExpiry";

export interface BusinessToolsPanelProps {
  providerId?: string | null;
  stripeConnection?: ProviderConnection | null;
  calendarEvents?: CalendarEvent[];
  invoices?: InvoiceRow[];
  monthlySummary?: ProfessionalMonthlySummary | null;
  /** Unread portal-chat counts per case id (messages.is_read). */
  unreadByCase?: Record<string, number>;
  vaultDocuments?: VaultDocumentInput[];
  pipelineRows?: PipelineClientRow[];
}

export default function BusinessToolsPanel(props: BusinessToolsPanelProps) {
  const providerId = props.providerId ?? null;
  const stripe = describeByoStripe(props.stripeConnection ?? null);
  const events = props.calendarEvents ?? [];
  const invoices = providerId
    ? listProfessionalInvoices(props.invoices ?? [], providerId)
    : [];
  const monthly = props.monthlySummary ?? null;
  const unreadByCase = props.unreadByCase ?? {};
  const vaultGroups = groupVaultByClient(props.vaultDocuments ?? []);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<number | null>(null);
  const [payment, setPayment] = useState<PaymentStatus | "">("");
  const clients = filterPipelineClients(props.pipelineRows ?? [], {
    query,
    stage,
    paymentStatus: payment === "" ? null : payment,
  });

  return (
    <section
      aria-labelledby="business-tools-heading"
      className="space-y-4 rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="business-tools-heading" className="text-lg font-semibold">
        Business Tools — run your practice online
      </h2>
      <p className="text-sm text-slate-600">
        Document preparation only — not a law firm, not affiliated with
        USCIS. Only a licensed attorney or DOJ-accredited representative
        gives legal advice (8 CFR 292.1). No approval is promised.
      </p>

      <h3 className="text-sm font-semibold">Your own Stripe (payments)</h3>
      <p className="text-sm">
        {stripe.canTakePayments
          ? stripe.label
          : BYO_STRIPE_NOT_CONNECTED}
        {stripe.keyLast4 ? ` Last 4: ••••${stripe.keyLast4.slice(-4)}.` : ""}
      </p>
      <p className="text-xs text-slate-500">
        Platform bundle checkout (locked prices) is separate — it is paid
        to the platform, never to you, and is confirmed only by the Stripe
        webhook, never by a front-end flag.
      </p>

      <h3 className="text-sm font-semibold">Calendar — appointments &amp; requests</h3>
      <p className="text-xs text-slate-500">{CALENDAR_NOT_CONNECTED}</p>
      {events.length === 0 ? (
        <p className="text-sm">No appointments or consultation requests yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {events.map((e) => (
            <li key={e.id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
              {e.label} — {e.startsAt ? e.startsAt.slice(0, 16).replace("T", " ") : "no date yet"} —{" "}
              {e.kind === "confirmed" ? "Confirmed" : "Requested — awaiting your answer"} — {e.status}
            </li>
          ))}
        </ul>
      )}

      <h3 className="text-sm font-semibold">E-signature</h3>
      <p className="text-xs text-slate-500">{ESIGN_PROVIDER_STATUS}</p>
      <p className="text-sm">
        Signature requests are recorded in the signatures table as
        &ldquo;requested — not signed yet&rdquo; (POST /api/signatures/request).
        The client signs in-platform by typing their name and confirming
        review. No request exists yet in this view.
      </p>

      <h3 className="text-sm font-semibold">Document vault — per client</h3>
      {vaultGroups.length === 0 ? (
        <p className="text-sm">
          No vault documents on file yet. Expiry flags (passport, medical
          exam, police clearance; translations never expire) appear here
          per client once documents are uploaded.
        </p>
      ) : (
        <ul className="space-y-1 text-sm">
          {vaultGroups.map((g) => (
            <li key={g.caseId} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
              {g.clientLabel} — {g.documents.length} document(s): {g.expiredCount} expired,{" "}
              {g.expiringSoonCount} expiring soon, {g.noExpiryOnFileCount} with no expiry date on file.
            </li>
          ))}
        </ul>
      )}

      <h3 className="text-sm font-semibold">Messaging — unread per case</h3>
      <p className="text-xs text-slate-500">{SMS_WHATSAPP_NOT_CONNECTED}</p>
      {Object.keys(unreadByCase).length === 0 ? (
        <p className="text-sm">No unread portal-chat messages. SMS / WhatsApp are not connected.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {Object.entries(unreadByCase).map(([caseId, n]) => (
            <li key={caseId}>
              Case {caseId}: {n} unread message(s)
            </li>
          ))}
        </ul>
      )}

      <h3 className="text-sm font-semibold">Invoices</h3>
      <p className="text-xs text-slate-500">{MISSED_PAYMENT_RULE}</p>
      {!providerId ? (
        <p className="text-sm">
          Sign in as a professional to see your invoices. Sending an
          invoice uses platform AWS SES; when SES is not configured the
          send returns 501 and nothing is claimed sent.
        </p>
      ) : invoices.length === 0 ? (
        <p className="text-sm">No invoices yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {invoices.map((inv) => (
            <li key={inv.id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
              {inv.description} — {formatCents(inv.service_fee_cents)} service fee — {inv.status}
              {inv.missedPaymentTotalCents !== null
                ? ` — if missed: ${formatCents(inv.missedPaymentTotalCents)}`
                : ""}
            </li>
          ))}
        </ul>
      )}

      <h3 className="text-sm font-semibold">Clients — search &amp; filter</h3>
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, phone or service"
          aria-label="Search clients"
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <select
          value={stage === null ? "" : String(stage)}
          onChange={(e) => setStage(e.target.value === "" ? null : Number(e.target.value))}
          aria-label="Filter by stage"
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="">All stages</option>
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <option key={s} value={s}>Stage {s}</option>
          ))}
        </select>
        <select
          value={payment}
          onChange={(e) => setPayment(e.target.value as PaymentStatus | "")}
          aria-label="Filter by payment status"
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="">All payment statuses</option>
          <option value="paid">Paid</option>
          <option value="instalment_due">Instalment due</option>
          <option value="unpaid">Unpaid</option>
          <option value="no_invoice">No invoice yet</option>
        </select>
      </div>
      {(props.pipelineRows ?? []).length === 0 ? (
        <p className="text-sm">No clients in the pipeline yet.</p>
      ) : clients.length === 0 ? (
        <p className="text-sm">No clients match this search / filter.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {clients.map((c) => (
            <li key={c.caseId} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
              {c.clientName} — Stage {c.stageNumber} — {c.paymentStatus}
              {unreadForCase(unreadByCase, c.caseId) > 0
                ? ` — ${unreadForCase(unreadByCase, c.caseId)} unread message(s)`
                : ""}
            </li>
          ))}
        </ul>
      )}

      <h3 className="text-sm font-semibold">Monthly summary</h3>
      {!monthly || monthly.isEmpty ? (
        <p className="text-sm">
          No monthly summary yet — no cases opened or closed and no revenue
          collected in this period. Figures here come only from real
          invoice and case rows; order-invoice milestones are never
          attributed to a professional (they carry no provider id).
        </p>
      ) : (
        <p className="text-sm">
          {monthly.month}: {monthly.casesOpened} case(s) opened, {monthly.casesClosed} closed,{" "}
          {formatCents(monthly.revenueCollectedCents)} service fees collected,{" "}
          {formatCents(monthly.govFeesCollectedCents)} USCIS government fees collected separately,{" "}
          {monthly.invoicesPaidCount} invoice(s) paid.
        </p>
      )}
    </section>
  );
}
