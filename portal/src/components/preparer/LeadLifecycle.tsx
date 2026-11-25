// Lead Lifecycle — preparer back-office: single-lead capture, pipeline
// counts bar, lead list, interactive lifecycle, and one-click
// "Convert Lead to Active Case".
// NOTE: src/components/preparer/LeadSheet.tsx is the separate CSV bulk
// importer (sibling build). This file is the single-lead capture +
// lifecycle view and lives alongside it — it does not replace it.
// - Quoted fees come ONLY from the locked lists (lib/lifecycle.ts →
//   lib/bundles.ts): Family Adjustment Bundle $999 / $1,799 / $2,799 and
//   locked single-form service fees. Anything else is TO BE CONFIRMED.
// - Payment plans are the locked plans only (lib/order.ts, lib/stripe.ts):
//   Pay in Full / Pay in 3 / Monthly 6 / Monthly 12. No 50/50 Split.
// - Service fees and USCIS / NVC government fees are always separate.
// - Local state / EXAMPLE data only. Shared Supabase state — to be wired.
//   Nothing here sends an invoice, charges a card, or syncs live.
"use client";

import { useMemo, useState } from "react";
import LifecyclePipeline from "@/components/LifecyclePipeline";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";
import {
  EXAMPLE_LEADS,
  LOST_REASONS,
  REFERRAL_SOURCES,
  SERVICE_REQUESTED_LABELS,
  checklistForService,
  countLeadsByBucket,
  countLeadsByReferralSource,
  countLeadsByStage,
  followUpReminders,
  isQuoteExpired,
  resolveQuotedFee,
  type Lead,
  type LifecycleStageId,
  type LostReason,
  type ReferralSource,
  type ServiceRequested,
  type ServiceTier,
  type Stage5SubStage,
} from "@/lib/lifecycle";
import { formatCents, type PaymentPlanType } from "@/lib/order";
import { splitInvoices } from "@/lib/stripe";
import { USCIS_FEE_SCHEDULE_URL } from "@/lib/fees";

const PLAN_LABELS: Record<PaymentPlanType, string> = {
  full_upfront: "Pay in Full",
  installments_3: "Pay in 3",
  monthly_6: "Monthly — 6 months",
  monthly_12: "Monthly — 12 months",
};

const SERVICE_OPTIONS = Object.keys(SERVICE_REQUESTED_LABELS) as ServiceRequested[];

interface ConvertedCase {
  leadId: string;
  invoiceNumber: string;
  plan: PaymentPlanType;
  totalServiceFeeCents: number;
  schedule: { label: string; amountCents: number; dueDate: string }[];
  checklist: string[];
  uscisFeeNote: string;
}

const EMPTY_FORM = {
  fullName: "",
  phoneWhatsApp: "",
  email: "",
  preferredLanguage: "en" as LanguageCode,
  referralSource: "Walk-in" as ReferralSource,
  currentImmigrationStatus: "",
  serviceRequested: "family_bundle" as ServiceRequested,
  serviceTier: "standard" as ServiceTier,
  quoteExpiresAt: "",
  followUpDate: "",
  notes: "",
};

function stageNumber(stage: LifecycleStageId): string {
  return stage === "new_lead"
    ? "1"
    : stage === "consultation_quote"
      ? "2"
      : stage === "payment_arrangement"
        ? "3"
        : stage === "active_client"
          ? "4"
          : stage === "submitted_uscis"
            ? "5"
            : "6";
}

export default function LeadLifecycle() {
  const [leads, setLeads] = useState<Lead[]>(EXAMPLE_LEADS);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedId, setSelectedId] = useState<string>(EXAMPLE_LEADS[0].id);
  const [convertPlan, setConvertPlan] = useState<PaymentPlanType>("installments_3");
  const [convertedCases, setConvertedCases] = useState<ConvertedCase[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaved, setFormSaved] = useState<string | null>(null);

  const selected = leads.find((l) => l.id === selectedId) ?? leads[0];
  const bucketCounts = useMemo(() => countLeadsByBucket(leads), [leads]);
  const stageCounts = useMemo(() => countLeadsByStage(leads), [leads]);
  const referralReport = useMemo(() => countLeadsByReferralSource(leads), [leads]);
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const reminders = useMemo(() => followUpReminders(leads, todayIso), [leads, todayIso]);
  const [lostReason, setLostReason] = useState<LostReason>("No response");
  const quoted = useMemo(
    () => resolveQuotedFee(form.serviceRequested, form.serviceTier),
    [form.serviceRequested, form.serviceTier]
  );
  const convertedForSelected = convertedCases.find((c) => c.leadId === selected?.id);

  const addLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) {
      setFormError("Full name is required.");
      setFormSaved(null);
      return;
    }
    if (!form.phoneWhatsApp.trim() && !form.email.trim()) {
      setFormError("Add a phone / WhatsApp number or an email so we can follow up.");
      setFormSaved(null);
      return;
    }
    const resolved = resolveQuotedFee(form.serviceRequested, form.serviceTier);
    const lead: Lead = {
      id: `lead-${Date.now()}`,
      fullName: form.fullName.trim(),
      phoneWhatsApp: form.phoneWhatsApp.trim(),
      email: form.email.trim(),
      preferredLanguage: form.preferredLanguage,
      referralSource: form.referralSource,
      currentImmigrationStatus: form.currentImmigrationStatus.trim(),
      serviceRequested: form.serviceRequested,
      serviceTier: form.serviceTier,
      quotedFeeCents: resolved.amountCents,
      quotedFeeNote: resolved.note,
      quoteExpiresAt: form.quoteExpiresAt || null,
      lostReason: null,
      followUpDate: form.followUpDate,
      notes: form.notes.trim(),
      stage: "new_lead",
      stage5SubStage: null,
      converted: false,
      convertedAt: null,
      paymentPlan: null,
    };
    setLeads((prev) => [lead, ...prev]);
    setSelectedId(lead.id);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormSaved(
      `Lead saved locally (EXAMPLE state only, not synced): ${lead.fullName} — Stage 1 New Lead.`
    );
  };

  const moveStage = (stage: LifecycleStageId) => {
    if (!selected) return;
    setLeads((prev) =>
      prev.map((l) =>
        l.id === selected.id
          ? { ...l, stage, stage5SubStage: stage === "submitted_uscis" ? (l.stage5SubStage ?? "5A") : null }
          : l
      )
    );
  };

  const moveSubStage = (sub: Stage5SubStage) => {
    if (!selected) return;
    setLeads((prev) =>
      prev.map((l) => (l.id === selected.id ? { ...l, stage5SubStage: sub } : l))
    );
  };

  const markLost = () => {
    if (!selected) return;
    if (selected.converted) {
      setFormError("This lead already converted to an Active Case — it cannot be marked lost.");
      return;
    }
    setLeads((prev) =>
      prev.map((l) => (l.id === selected.id ? { ...l, lostReason } : l))
    );
    setFormError(null);
    setFormSaved(
      `Marked lost (local / EXAMPLE only): ${selected.fullName} — reason: ${lostReason}. The reason is stored with the lead (preparer_leads.lost_reason) and counted in the referral-source report.`
    );
  };

  const reopenLead = () => {
    if (!selected) return;
    setLeads((prev) =>
      prev.map((l) => (l.id === selected.id ? { ...l, lostReason: null } : l))
    );
    setFormError(null);
    setFormSaved(`Reopened (local / EXAMPLE only): ${selected.fullName} — lost reason cleared.`);
  };

  const convertLead = () => {
    if (!selected) return;
    if (selected.lostReason !== null) {
      setFormError(
        `This lead is marked lost (${selected.lostReason}). Reopen it before converting — a lost lead cannot become an Active Case.`
      );
      return;
    }
    if (isQuoteExpired(selected.quoteExpiresAt, todayIso)) {
      setFormError(
        `This lead's quote expired on ${selected.quoteExpiresAt}. Re-confirm the quote (price and terms) with the client and set a new quote expiry date before converting — do not convert on an expired quote.`
      );
      return;
    }
    if (selected.quotedFeeCents === null) {
      setFormError(
        "This lead has no locked quoted fee (TO BE CONFIRMED). Confirm the price before converting — do not invent one."
      );
      return;
    }
    const invoiceNumber = `INV-EXAMPLE-${selected.id.replace("lead-example-", "").replace("lead-", "").toUpperCase()}`;
    const schedule = splitInvoices(selected.quotedFeeCents, convertPlan, new Date());
    const generated: ConvertedCase = {
      leadId: selected.id,
      invoiceNumber,
      plan: convertPlan,
      totalServiceFeeCents: selected.quotedFeeCents,
      schedule,
      checklist: checklistForService(selected.serviceRequested),
      uscisFeeNote:
        selected.serviceRequested === "family_bundle"
          ? "USCIS fee: I-485 Paper $1,440 (locked) — shown separately, never added to the service total. Other government fees: confirm at uscis.gov/fees."
          : selected.serviceRequested === "I-130"
            ? "USCIS fee for I-130: TO BE CONFIRMED — $675 is NOT verified. Confirm at uscis.gov/fees before paying."
            : "USCIS fee: see the locked fee note on the quote — confirm at uscis.gov/fees before paying.",
    };
    setConvertedCases((prev) => [
      ...prev.filter((c) => c.leadId !== selected.id),
      generated,
    ]);
    setLeads((prev) =>
      prev.map((l) =>
        l.id === selected.id
          ? { ...l, stage: "active_client", converted: true, convertedAt: new Date().toISOString().slice(0, 10), paymentPlan: convertPlan }
          : l
      )
    );
    setFormError(null);
    setFormSaved(
      `Converted to Active Case (local / EXAMPLE only — no invoice was sent and no charge was made): ${selected.fullName} → Stage 4 Active Client.`
    );
  };

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="lead-sheet-heading"
        className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
      >
        <h2 id="lead-sheet-heading" className="text-lg font-semibold">
          Lead Sheet — Capture &amp; Pipeline
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Capture a new lead, follow up on the follow-up date, and convert
          it to an Active Case in one click. For bulk CSV import, use the
          Lead Sheet (CSV) tab. Local / EXAMPLE state only — shared Supabase
          state is to be wired; nothing here sends an invoice, charges a
          card, or syncs live.
        </p>

        {/* Pipeline counts bar */}
        <div className="mt-4 grid gap-2 sm:grid-cols-5" role="list" aria-label="Pipeline counts">
          {bucketCounts.map((b) => (
            <div
              key={b.id}
              role="listitem"
              className="rounded border border-slate-200 bg-slate-50 p-3 text-center"
            >
              <span className="block text-2xl font-bold">{b.count}</span>
              <span className="block text-xs font-medium text-slate-600">{b.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          USCIS-NVC Filed counts Stage 4 Active Client (docs &amp; drafting,
          in progress toward filing) + Stage 5 Submitted. Stage 4 is still
          shown separately in the pipeline below.
        </p>

        {/* Capture form */}
        <form onSubmit={addLead} className="mt-5 space-y-3">
          <h3 className="text-sm font-semibold">Capture a new lead</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Full name *
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm font-normal"
                placeholder="Full name"
              />
            </label>
            <label className="block text-sm font-medium">
              Phone / WhatsApp *
              <input
                type="tel"
                value={form.phoneWhatsApp}
                onChange={(e) => setForm({ ...form, phoneWhatsApp: e.target.value })}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm font-normal"
                placeholder="(772) 971-6129"
              />
            </label>
            <label className="block text-sm font-medium">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm font-normal"
                placeholder="name@example.com"
              />
            </label>
            <label className="block text-sm font-medium">
              Preferred language
              <select
                value={form.preferredLanguage}
                onChange={(e) =>
                  setForm({ ...form, preferredLanguage: e.target.value as LanguageCode })
                }
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm font-normal"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label} — {l.native}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Referral source
              <select
                value={form.referralSource}
                onChange={(e) =>
                  setForm({ ...form, referralSource: e.target.value as ReferralSource })
                }
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm font-normal"
              >
                {REFERRAL_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Current immigration status
              <input
                type="text"
                value={form.currentImmigrationStatus}
                onChange={(e) =>
                  setForm({ ...form, currentImmigrationStatus: e.target.value })
                }
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm font-normal"
                placeholder="e.g. TPS, visitor, no status yet — as the client states it"
              />
            </label>
            <label className="block text-sm font-medium">
              Service / Form Requested
              <select
                value={form.serviceRequested}
                onChange={(e) =>
                  setForm({ ...form, serviceRequested: e.target.value as ServiceRequested })
                }
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm font-normal"
              >
                {SERVICE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {SERVICE_REQUESTED_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Bundle / service tier
              <select
                value={form.serviceTier}
                onChange={(e) =>
                  setForm({ ...form, serviceTier: e.target.value as ServiceTier })
                }
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm font-normal"
              >
                <option value="basic">Basic</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              Quote expires on
              <input
                type="date"
                value={form.quoteExpiresAt}
                onChange={(e) => setForm({ ...form, quoteExpiresAt: e.target.value })}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="block text-sm font-medium">
              Follow-up date
              <input
                type="date"
                value={form.followUpDate}
                onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm font-normal"
              />
            </label>
          </div>
          <label className="block text-sm font-medium">
            Notes
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm font-normal"
              placeholder="What they asked for, what was promised, anything to remember."
            />
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Quote expiry: a quote past its expiry date must be re-confirmed before the lead can
            convert — the list flags it “Quote expired”. Stored as preparer_leads.quote_expires_at
            (migration 0010).
          </p>
          <p className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <strong>Quoted fee (locked, from the quote):</strong>{" "}
            {quoted.amountCents !== null
              ? `${formatCents(quoted.amountCents)} — service fee only.`
              : "TO BE CONFIRMED — no locked price for this request."}{" "}
            <span className="text-slate-600">{quoted.note}</span>{" "}
            Locked bundle: Basic $999 / Standard $1,799 / Premium $2,799.
            USCIS government fees are always separate — confirm at{" "}
            <a href={USCIS_FEE_SCHEDULE_URL} target="_blank" rel="noreferrer" className="text-blue-700 underline">
              uscis.gov/fees
            </a>
            .
          </p>
          {formError && (
            <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              {formError}
            </p>
          )}
          {formSaved && (
            <p role="status" className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
              {formSaved}
            </p>
          )}
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Save lead (local / EXAMPLE only)
          </button>
        </form>

        {/* Lead list */}
        <h3 className="mt-6 text-sm font-semibold">
          Leads ({leads.length} — EXAMPLE data)
        </h3>
        <ul className="mt-2 space-y-2">
          {leads.map((lead) => (
            <li
              key={lead.id}
              className={`rounded border p-3 text-sm ${
                selected?.id === lead.id
                  ? "border-blue-600 bg-blue-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedId(lead.id)}
                  className="text-left font-medium text-blue-700 underline"
                >
                  {lead.fullName}
                </button>
                <span className="text-xs text-slate-600">
                  Stage {stageNumber(lead.stage)}
                  {lead.stage === "submitted_uscis" && lead.stage5SubStage ? ` (${lead.stage5SubStage})` : ""}
                  {lead.converted ? " · Converted to Active Case" : ""}
                </span>
              </div>
              <p className="mt-1 text-slate-700">
                {lead.phoneWhatsApp}
                {lead.email ? ` · ${lead.email}` : ""} ·{" "}
                {LANGUAGES.find((l) => l.code === lead.preferredLanguage)?.label ?? lead.preferredLanguage}{" "}
                · {lead.referralSource}
              </p>
              <p className="mt-1 text-slate-700">
                {SERVICE_REQUESTED_LABELS[lead.serviceRequested]} —{" "}
                {lead.serviceTier} · Quoted service fee:{" "}
                {lead.quotedFeeCents !== null
                  ? formatCents(lead.quotedFeeCents)
                  : "TO BE CONFIRMED"}
                {lead.quoteExpiresAt
                  ? isQuoteExpired(lead.quoteExpiresAt, todayIso)
                    ? ` · Quote expired ${lead.quoteExpiresAt} — re-confirm before converting`
                    : ` · Quote expires ${lead.quoteExpiresAt}`
                  : ""}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Status: {lead.currentImmigrationStatus || "—"} · Follow up:{" "}
                {lead.followUpDate || "—"}
                {lead.notes ? ` · Notes: ${lead.notes}` : ""}
              </p>
              {lead.lostReason !== null && (
                <p className="mt-1 text-xs font-semibold text-red-700">
                  Lost — reason: {lead.lostReason}
                </p>
              )}
            </li>
          ))}
        </ul>

        {/* Follow-up reminders — from the Lead Sheet follow-up dates */}
        <h3 className="mt-6 text-sm font-semibold">
          Follow-up reminders ({reminders.length} — today is {todayIso})
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Overdue and due-today follow-ups first, then the next 7 days. Lost and converted leads
          are not reminded. Reminders are computed from the follow-up date on each lead — no
          reminder is sent anywhere (Twilio / Resend are not connected); this list is the
          reminder.
        </p>
        {reminders.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No follow-ups due — nothing overdue, due today, or due in the next 7 days.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {reminders.map(({ lead, bucket, daysOverdue }) => (
              <li
                key={lead.id}
                className={`rounded border p-3 text-sm ${
                  bucket === "overdue"
                    ? "border-red-400 bg-red-50"
                    : bucket === "due_today"
                      ? "border-amber-400 bg-amber-50"
                      : "border-slate-200 bg-slate-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(lead.id)}
                  className="font-medium text-blue-700 underline"
                >
                  {lead.fullName}
                </button>{" "}
                —{" "}
                {bucket === "overdue"
                  ? `follow-up OVERDUE by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} (was ${lead.followUpDate})`
                  : bucket === "due_today"
                    ? `follow-up due TODAY (${lead.followUpDate})`
                    : `follow-up in ${Math.abs(daysOverdue)} day${Math.abs(daysOverdue) === 1 ? "" : "s"} (${lead.followUpDate})`}{" "}
                · {lead.phoneWhatsApp}
                {lead.email ? ` · ${lead.email}` : ""}
              </li>
            ))}
          </ul>
        )}

        {/* Referral-source report */}
        <h3 className="mt-6 text-sm font-semibold">Referral-source report (EXAMPLE data)</h3>
        <p className="mt-1 text-xs text-slate-500">
          Where leads came from, how many converted to Active Cases, and how many were lost.
          Counted from the leads above — no other source is used.
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-50">
                <th className="px-2 py-1">Referral source</th>
                <th className="px-2 py-1">Leads</th>
                <th className="px-2 py-1">Converted</th>
                <th className="px-2 py-1">Lost</th>
              </tr>
            </thead>
            <tbody>
              {referralReport.map((r) => (
                <tr key={r.source} className="border-b border-slate-200">
                  <td className="px-2 py-1">{r.source}</td>
                  <td className="px-2 py-1">{r.total}</td>
                  <td className="px-2 py-1">{r.converted}</td>
                  <td className="px-2 py-1">{r.lost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Interactive pipeline for the selected lead */}
      {selected && (
        <LifecyclePipeline
          currentStage={selected.stage}
          currentSubStage={selected.stage5SubStage}
          onStageChange={moveStage}
          onSubStageChange={moveSubStage}
          caseLabel={`Selected lead (EXAMPLE): ${selected.fullName} — ${SERVICE_REQUESTED_LABELS[selected.serviceRequested]}`}
          stageCounts={stageCounts}
        />
      )}

      {/* Convert to Active Case */}
      {selected && (
        <section
          aria-labelledby="convert-heading"
          className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
        >
          <h2 id="convert-heading" className="text-lg font-semibold">
            Convert Lead to Active Case
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            One click generates an invoice, a payment-arrangement schedule,
            and the form checklist from this lead&apos;s own details — no
            re-typing contact details. The lead moves to Stage 4 Active
            Client. Local / EXAMPLE only: no invoice is sent and no charge
            is made.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium">
              Payment plan (locked plans only)
              <select
                value={convertPlan}
                onChange={(e) => setConvertPlan(e.target.value as PaymentPlanType)}
                className="ml-2 rounded border border-slate-300 px-3 py-2 text-sm font-normal"
              >
                {(Object.keys(PLAN_LABELS) as PaymentPlanType[]).map((p) => (
                  <option key={p} value={p}>
                    {PLAN_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={convertLead}
              disabled={
                selected.quotedFeeCents === null ||
                selected.lostReason !== null ||
                isQuoteExpired(selected.quoteExpiresAt, todayIso)
              }
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Convert Lead to Active Case
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            No 50/50 Split plan exists for immigration bundles. Locked plans
            only: Pay in Full / Pay in 3 / Monthly 6 / Monthly 12.
          </p>
          {selected.lostReason !== null && (
            <p className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800">
              Lost — reason: {selected.lostReason}. A lost lead cannot convert. Reopen it below to
              work it again.
            </p>
          )}
          {selected.quoteExpiresAt && isQuoteExpired(selected.quoteExpiresAt, todayIso) && (
            <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              Quote expired {selected.quoteExpiresAt} — conversion is blocked until the quote is
              re-confirmed with the client and a new expiry date is set.
            </p>
          )}

          {/* Mark lost / reopen — local state; mirrors preparer_leads.lost_reason */}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-slate-50 p-3">
            <label className="text-sm font-medium">
              Lost reason
              <select
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value as LostReason)}
                className="ml-2 rounded border border-slate-300 px-3 py-2 text-sm font-normal"
              >
                {LOST_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            {selected.lostReason === null ? (
              <button
                type="button"
                onClick={markLost}
                disabled={selected.converted}
                className="rounded border border-red-600 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark lead lost
              </button>
            ) : (
              <button
                type="button"
                onClick={reopenLead}
                className="rounded border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Reopen lead (clear lost reason)
              </button>
            )}
            <span className="text-xs text-slate-500">
              Local / EXAMPLE only. Stored as preparer_leads.lost_reason (migration 0010) — the
              database only allows a reason when the stage is &lsquo;lost&rsquo;.
            </span>
          </div>

          {convertedForSelected && (
            <div className="mt-4 rounded border border-green-300 bg-green-50 p-4">
              <h3 className="text-sm font-semibold">
                Generated for {selected.fullName} (EXAMPLE — not sent, not charged)
              </h3>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex gap-2">
                  <dt className="font-semibold">Invoice:</dt>
                  <dd>
                    {convertedForSelected.invoiceNumber} —{" "}
                    {formatCents(convertedForSelected.totalServiceFeeCents)}{" "}
                    service fee ({PLAN_LABELS[convertedForSelected.plan]})
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-semibold">Contact reused:</dt>
                  <dd>
                    {selected.fullName} · {selected.phoneWhatsApp}
                    {selected.email ? ` · ${selected.email}` : ""} — no re-typing.
                  </dd>
                </div>
              </dl>
              <h4 className="mt-3 text-sm font-semibold">Payment-arrangement schedule</h4>
              <ul className="mt-1 space-y-1 text-sm">
                {convertedForSelected.schedule.map((s, i) => (
                  <li key={i}>
                    {s.label} — {formatCents(s.amountCents)} due {s.dueDate}
                  </li>
                ))}
              </ul>
              <h4 className="mt-3 text-sm font-semibold">Form checklist</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {convertedForSelected.checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-slate-700">
                <strong>USCIS government fee (separate):</strong>{" "}
                {convertedForSelected.uscisFeeNote}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
