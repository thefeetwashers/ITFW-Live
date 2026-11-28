"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import LanguagePicker from "@/components/LanguagePicker";
import LifecyclePipeline from "@/components/LifecyclePipeline";
import { getSupabase } from "@/lib/supabase";
import { EXAMPLE_ORDER, formatCents, type PaymentPlanType } from "@/lib/order";
import { splitInvoices } from "@/lib/stripe";
import { USCIS_FEE_SCHEDULE_URL } from "@/lib/fees";
import { LEAD_PAYMENT_PLANS } from "@/lib/leads";
import { CEAC_LOGIN_URL, lookupNvcPost } from "@/lib/nvc";
import type { LifecycleStageId } from "@/lib/lifecycle";
import PermissionsPanel from "@/components/comms/PermissionsPanel";
import ByoSettings from "@/components/comms/ByoSettings";
import AskNipteiByoSettings from "@/components/copilot/AskNipteiByoSettings";
import AskNipteiChat from "@/components/copilot/AskNipteiChat";
import CaseCommandPanel from "@/components/nextstep/CaseCommandPanel";

// ---------------------------------------------------------------------------
// Unified Company Back-Office — one screen for running the whole practice.
// Left rail: command / leads / pipeline / tracker / billing / public page /
// compliance / team. Center: client + case tools. Right rail: always-visible
// Omni-Channel Communication Hub.
// HONEST LABELLING (read before believing anything on this page):
//   * SMS / WhatsApp / Email are NOT live — Twilio / AWS SES are NOT
//     connected, no keys exist. The hub is a unified thread UI + queue only.
//     Every send attempt returns "not configured" and NEVER claims a message
//     was sent. Messages go through the Twilio number (placeholder until
//     set), never the founder's personal number.
//   * Video call is NOT built — "Start Video Call" is a placeholder labelled
//     "video room not connected yet".
//   * Auto-translate needs Google Cloud Translation — NOT connected.
//   * Document Vault: approve / reject with reason + request-new-document
//     work on local example state. Image-to-PDF + packet assembler are
//     SKELETONS: official USCIS PDF templates are NOT included, output is a
//     DRAFT for review, never auto-filed. No OCR library is loaded.
//   * E-Sign: the audit certificate logs IP + timestamp + document version,
//     but the E-Sign provider is NOT connected — labelled on the page.
//   * Billing: Pay in Full / Pay in 3 / Monthly 6 / 12 ONLY. There is NO
//     "50/50 Milestone Split" for immigration — do not offer it.
//   * Fee separation: prep fee is always separate from USCIS / NVC gov fees.
//     I-485 $1,440 locked; I-130 $675 TO BE CONFIRMED; $120 AOS + $325 IV;
//     $235 USCIS Immigrant Fee.
// EXAMPLE DATA ONLY. No real client, case, number, or payment appears here.
// ---------------------------------------------------------------------------

type RailSection =
  | "command"
  | "leads"
  | "pipeline"
  | "tracker"
  | "billing"
  | "public"
  | "compliance"
  | "team";

type CenterTool =
  | "intake"
  | "vault"
  | "numbers"
  | "esign"
  | "family"
  | "calls";

type Channel = "Portal Chat" | "SMS" | "WhatsApp" | "Email";

const RAIL: { id: RailSection; label: string }[] = [
  { id: "command", label: "Daily Command & Deadlines" },
  { id: "leads", label: "Lead Sheet & Quotes" },
  { id: "pipeline", label: "6-Stage Case Pipeline" },
  { id: "tracker", label: "USCIS & NVC Live Tracker" },
  { id: "billing", label: "Billing & Payment Plans" },
  { id: "public", label: "Public Page & Booking" },
  { id: "compliance", label: "Compliance & UPL Guardrails" },
  { id: "team", label: "Team / Staff / Student Seats" },
];

const TOOLS: { id: CenterTool; label: string }[] = [
  { id: "intake", label: "Intake & PDF Auto-Fill" },
  { id: "vault", label: "Document Vault & OCR" },
  { id: "numbers", label: "USCIS & NVC Numbers" },
  { id: "esign", label: "E-Sign & Packet Build" },
  { id: "family", label: "Family & Co-Sponsors" },
  { id: "calls", label: "Video/Call & Audit" },
];

const TEMPLATES = [
  "Request Missing Doc",
  "NVC Fee Reminder",
  "Booking Link",
  "Payment Link",
] as const;

interface QueuedMessage {
  id: number;
  channel: Channel;
  body: string;
  status: "queued_not_sent";
}

export default function CompanyBackOfficePage() {
  const isLive = useMemo(() => getSupabase() !== null, []);
  const [rail, setRail] = useState<RailSection>("command");
  const [tool, setTool] = useState<CenterTool>("intake");
  const [stage, setStage] = useState<LifecycleStageId>("active_client");

  // --- Leads (example, local only; live rows live in preparer_leads) ---
  const [leads, setLeads] = useState([
    { id: "lead-1", name: "Example Lead A", service: "I-130 Petition", plan: "installments_3" as PaymentPlanType, stage: "New Lead" },
    { id: "lead-2", name: "Example Lead B", service: "I-485 Adjustment", plan: "full_upfront" as PaymentPlanType, stage: "Quote Sent" },
  ]);
  const [quoteName, setQuoteName] = useState("");
  const [quoteService, setQuoteService] = useState("I-130 Petition");
  const [quotePlan, setQuotePlan] = useState<PaymentPlanType>("full_upfront");

  // --- Document Vault (example, local only) ---
  const [docReviews, setDocReviews] = useState<Record<string, string>>({});
  const [rejectReason, setRejectReason] = useState("");
  const vaultDocs = [
    { id: "doc-passport", label: "Petitioner Passport" },
    { id: "doc-marriage", label: "Marriage Certificate" },
    { id: "doc-bank", label: "Joint Bank Statement" },
  ];

  // --- USCIS / NVC numbers (manual entry only — no example numbers shown) ---
  const [receipt, setReceipt] = useState("");
  const [nvcCase, setNvcCase] = useState("");
  const [nvcPost, setNvcPost] = useState("");
  const post = nvcPost.trim() ? lookupNvcPost(nvcPost.trim()) : null;

  // --- E-Sign (provider NOT connected) ---
  const [esignLog, setEsignLog] = useState<string[]>([]);

  // --- Omni-Channel Hub (queue only — nothing is ever sent) ---
  const [channel, setChannel] = useState<Channel>("Portal Chat");
  const [draft, setDraft] = useState("");
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [hubNotice, setHubNotice] = useState<string | null>(null);

  const sendAttempt = () => {
    const body = draft.trim();
    if (!body) return;
    setQueue((q) => [...q, { id: q.length + 1, channel, body, status: "queued_not_sent" }]);
    setDraft("");
    setHubNotice(
      `${channel}: NOT CONFIGURED — Twilio / AWS SES are not connected, so nothing was sent. The message is queued only (see queue below). Messages go through the Twilio number (placeholder until set), never the founder's personal number.`
    );
  };

  const insertTemplate = (t: (typeof TEMPLATES)[number]) => {
    const text =
      t === "Request Missing Doc"
        ? "Hello — we are missing a document for your case. Please upload it in your portal when you can. Thank you."
        : t === "NVC Fee Reminder"
          ? "Reminder: your NVC fees ($120 AOS + $325 IV per applicant) are paid in CEAC, separate from our preparation fee. See uscis.gov/fees for USCIS fees."
          : t === "Booking Link"
            ? "You can request a phone / video consultation here: https://immigration.niptei.com/p/your-name (booking calendar not connected — requests are collected, not auto-booked)."
            : "Here is your payment link for your preparation fee (USCIS / NVC government fees are separate and paid directly to the government).";
    setDraft(text);
  };

  const planOptions: { id: PaymentPlanType; label: string }[] = [
    { id: "full_upfront", label: "Pay in Full" },
    { id: "installments_3", label: "Pay in 3" },
    { id: "monthly_6", label: "Monthly — 6 months" },
    { id: "monthly_12", label: "Monthly — 12 months" },
  ];
  // NOTE: no "50/50 Milestone Split" — it is not a locked immigration plan.
  const [billingPlan, setBillingPlan] = useState<PaymentPlanType>("installments_3");
  const split = useMemo(
    () => splitInvoices(EXAMPLE_ORDER.totalServiceFeeCents, billingPlan),
    [billingPlan]
  );

  const [auditLog, setAuditLog] = useState<string[]>([
    "Example audit entry: Example Client A intake completed (example — local state only).",
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold">Company Back-Office — Immigration with NIPTEI</h1>
          <p className="mt-1 text-sm text-slate-600">
            One screen for running the whole practice. nipteiapp@gmail.com · (772) 971-6129 ·
            Clerical / educational help only — not a law firm.
          </p>
        </div>
        <LanguagePicker />
      </header>

      <p className="mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
        Example data — not live{!isLive ? ". Supabase is not connected in this build" : ""}. SMS /
        WhatsApp / Email are NOT live (Twilio / AWS SES not connected), video calls are NOT built,
        and the E-Sign provider is NOT connected. Nothing on this page sends, charges, or files
        anything.
      </p>

      <div className="mt-6 grid gap-6 xl:grid-cols-[210px_1fr_320px]">
        {/* ---- Left rail ---- */}
        <nav aria-label="Company back-office sections" className="h-fit rounded border border-slate-300 bg-white p-3 xl:sticky xl:top-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Run the practice</h2>
          <ul className="mt-2 space-y-1">
            {RAIL.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setRail(item.id)}
                  aria-current={rail === item.id ? "page" : undefined}
                  className={
                    "w-full rounded px-3 py-2 text-left text-sm font-medium " +
                    (rail === item.id ? "bg-blue-600 text-white" : "bg-white text-slate-800 hover:bg-slate-100")
                  }
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Legal tools (G-28 / EOIR-28) live in the{" "}
            <Link href="/legal-back-office" className="font-semibold text-blue-700 underline">
              Legal Back Office
            </Link>{" "}
            — preparers never see G-28.
          </p>
        </nav>

        {/* ---- Center workspace ---- */}
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Case tools">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tool === t.id}
                onClick={() => setTool(t.id)}
                className={
                  "rounded-full border px-3 py-1 text-sm font-medium " +
                  (tool === t.id
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100")
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {rail === "command" && (
            <section aria-label="Daily command and deadlines">
              <h2 className="text-xl font-bold">Daily Command &amp; Deadlines</h2>
              <p className="mt-1 text-sm text-slate-600">
                Active client: <strong>Example Client A</strong> — I-130 + I-485 (Family Adjustment
                Bundle, Standard $1,799 prep fee — locked price; USCIS fees separate).
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="rounded border border-slate-300 bg-white px-3 py-2">
                  <strong>Today (example):</strong> Review Example Client A&apos;s joint bank
                  statement retake.
                </li>
                <li className="rounded border border-slate-300 bg-white px-3 py-2">
                  <strong>This week (example):</strong> Send NVC fee reminder to Example Client B
                  (consular case — $120 AOS + $325 IV in CEAC).
                </li>
                <li className="rounded border border-slate-300 bg-white px-3 py-2">
                  <strong>Follow-up (example):</strong> Example Lead A — quote sent, follow up in 2
                  days.
                </li>
              </ul>
              <p className="mt-2 text-xs text-slate-500">
                Deadlines above are examples only. Live deadlines come from cases / reminder nudges
                once Supabase is connected.
              </p>
              {/* Next Step + Stage + Payment + Communication engine (one
                  screen). The unified thread lives in the always-visible
                  right rail, so the panel does not repeat it. EXAMPLE
                  client here is the Family Adjustment Bundle (I-130 +
                  I-485), so the route is inside_us. */}
              <div className="mt-4">
                <CaseCommandPanel
                  role="back_office"
                  route="inside_us"
                  clientLanguage="es"
                  showComms={false}
                  canEditRoute
                  guide="professional"
                />
              </div>
            </section>
          )}

          {rail === "leads" && (
            <section aria-label="Lead sheet and quotes">
              <h2 className="text-xl font-bold">Lead Sheet &amp; Quotes</h2>
              <p className="mt-1 text-sm text-slate-600">
                Example leads, local state only. Live leads live in{" "}
                <code>preparer_leads</code> (migration 0010) once wired — never claim an import is
                live until a Supabase insert actually succeeds.
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {leads.map((l) => (
                  <li key={l.id} className="rounded border border-slate-300 bg-white px-3 py-2">
                    <strong>{l.name}</strong> — {l.service} —{" "}
                    {LEAD_PAYMENT_PLANS.find((p) => p.id === l.plan)?.label ?? l.plan} — {l.stage}
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded border border-slate-300 bg-white p-4">
                <h3 className="font-bold">New quote (example — local only)</h3>
                <label className="mt-3 block text-sm">
                  <span className="font-medium">Full name</span>
                  <input type="text" value={quoteName} onChange={(e) => setQuoteName(e.target.value)} placeholder="Example Lead C" className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                </label>
                <label className="mt-3 block text-sm">
                  <span className="font-medium">Service</span>
                  <select value={quoteService} onChange={(e) => setQuoteService(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm">
                    <option>I-130 Petition</option>
                    <option>I-485 Adjustment</option>
                    <option>I-130 + NVC Consular Bundle</option>
                    <option>N-400 Naturalization</option>
                  </select>
                </label>
                <label className="mt-3 block text-sm">
                  <span className="font-medium">Payment plan (immigration only — no 50/50 split)</span>
                  <select value={quotePlan} onChange={(e) => setQuotePlan(e.target.value as PaymentPlanType)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm">
                    {LEAD_PAYMENT_PLANS.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (!quoteName.trim()) return;
                    setLeads((ls) => [...ls, { id: `lead-${ls.length + 1}`, name: quoteName.trim(), service: quoteService, plan: quotePlan, stage: "New Lead" }]);
                    setQuoteName("");
                  }}
                  className="mt-3 rounded bg-blue-700 px-3 py-1 text-sm font-semibold text-white"
                >
                  Add lead (example)
                </button>
              </div>
            </section>
          )}

          {rail === "pipeline" && (
            <section aria-label="Six-stage case pipeline">
              <h2 className="text-xl font-bold">6-Stage Case Pipeline</h2>
              <LifecyclePipeline
                currentStage={stage}
                caseLabel="Example Client A — I-130 + I-485"
                onStageChange={setStage}
              />
            </section>
          )}

          {rail === "tracker" && (
            <section aria-label="USCIS and NVC tracker">
              <h2 className="text-xl font-bold">USCIS &amp; NVC Live Tracker</h2>
              <p className="mt-1 text-sm text-slate-600">
                NVC has NO API — CEAC status is manual entry + a link out to CEAC. USCIS live status
                needs the Production key + worker — NOT built. Receipt / case numbers below are
                manual entry only; no example numbers are shown and none are stored here.
              </p>
              <div className="mt-4 rounded border border-slate-300 bg-white p-4">
                <label className="block text-sm">
                  <span className="font-medium">USCIS receipt number (13 chars — enter the real one; never store a CEAC password)</span>
                  <input type="text" value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder="e.g. IOE followed by 10 digits" className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                </label>
                {receipt.trim() && (
                  <p className="mt-2 text-sm">
                    Receipt entered (local only, not checked): <strong>{receipt.trim()}</strong> — check
                    status at{" "}
                    <a href="https://egov.uscis.gov/casestatus/landing.do" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">
                      USCIS Case Status
                    </a>
                    .
                  </p>
                )}
                <label className="mt-4 block text-sm">
                  <span className="font-medium">NVC case number (13 chars: 3-letter post + 4-digit year + 3-digit Julian day + 3-digit sequence)</span>
                  <input type="text" value={nvcCase} onChange={(e) => setNvcCase(e.target.value)} placeholder="e.g. PHP + year + day + sequence" className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                </label>
                <label className="mt-4 block text-sm">
                  <span className="font-medium">NVC post code (lookup)</span>
                  <input type="text" value={nvcPost} onChange={(e) => setNvcPost(e.target.value)} placeholder="e.g. PHP" className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                </label>
                {nvcPost.trim() && (
                  <p className="mt-2 text-sm">
                    Post:{" "}
                    <strong>
                      {post ? `${post.city}, ${post.country}` : "Post code not in lookup — verify with NVC"}
                    </strong>
                  </p>
                )}
                <p className="mt-3 text-sm">
                  CEAC (manual — NVC has no API):{" "}
                  <a href={CEAC_LOGIN_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">
                    CEAC Immigrant Visa login
                  </a>
                </p>
              </div>
            </section>
          )}

          {rail === "billing" && (
            <section aria-label="Billing and payment plans">
              <h2 className="text-xl font-bold">Billing &amp; Payment Plans</h2>
              <p className="mt-1 text-sm text-slate-600">
                Example order: {EXAMPLE_ORDER.packageTitle} — prep fee{" "}
                <strong>{formatCents(EXAMPLE_ORDER.totalServiceFeeCents)}</strong> (Standard $1,799,
                locked). USCIS government fee{" "}
                <strong>{formatCents(EXAMPLE_ORDER.estimatedUscisGovFeeCents)}</strong> is shown
                separately and never added to the service total.
              </p>
              <p className="mt-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold">
                Payment plans — Pay in Full / Pay in 3 / Monthly 6 / 12 ONLY. There is NO 50/50
                Milestone Split for immigration.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {planOptions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setBillingPlan(p.id)}
                    aria-pressed={billingPlan === p.id}
                    className={
                      "rounded-full border px-3 py-1 text-sm font-medium " +
                      (billingPlan === p.id ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white hover:bg-slate-100")
                    }
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {split.map((s) => (
                  <li key={s.label} className="rounded border border-slate-300 bg-white px-3 py-2">
                    <strong>{s.label}</strong> — {formatCents(s.amountCents)} — due {s.dueDate}
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded border border-slate-300 bg-white p-4">
                <h3 className="font-bold">Fee separation — prep fee vs government fees</h3>
                <ul className="mt-2 list-disc pl-5 text-sm">
                  <li>Preparation fee: separate, per the order above. Never combined with gov fees.</li>
                  <li>USCIS — I-485 (paper): <strong>$1,440 — locked</strong>.</li>
                  <li>USCIS — I-130: <strong>$675 — TO BE CONFIRMED</strong> (confirm at uscis.gov/fees before paying).</li>
                  <li>NVC / DOS (CEAC): <strong>$120 AOS + $325 IV</strong> per applicant, paid in CEAC.</li>
                  <li>USCIS Immigrant Fee: <strong>$235</strong>.</li>
                </ul>
                <p className="mt-2 text-sm">
                  Confirm USCIS fees at{" "}
                  <a href={USCIS_FEE_SCHEDULE_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">
                    uscis.gov/fees
                  </a>
                  .
                </p>
              </div>
            </section>
          )}

          {rail === "public" && (
            <section aria-label="Public page and booking">
              <h2 className="text-xl font-bold">Public Page &amp; Booking</h2>
              <p className="mt-1 text-sm text-slate-600">
                Your public profile (once verified + subscribed):{" "}
                <Link href="/p/your-name" className="font-semibold text-blue-700 underline">
                  immigration.niptei.com/p/your-name
                </Link>{" "}
                — replace “your-name” with your real slug. Unverified profiles are NOT listed.
              </p>
              <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                Booking calendar NOT connected — consultation requests are collected, not auto-booked.
                A client who asks for a phone / video consultation gets a request logged here; you
                confirm the time yourself.
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="rounded border border-slate-300 bg-white px-3 py-2">
                  <strong>Example booking request:</strong> Example Client B — video consultation
                  requested (example — local only, no calendar event created).
                </li>
              </ul>
            </section>
          )}

          {rail === "compliance" && (
            <section aria-label="Compliance and UPL guardrails">
              <h2 className="text-xl font-bold">Compliance &amp; UPL Guardrails</h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="rounded border border-red-300 bg-red-50 px-3 py-2 font-semibold text-red-900">
                  Non-attorney clerical assistance only. No legal advice or representation — only a
                  licensed attorney or DOJ-Accredited Representative gives legal advice or represents
                  a client (8 CFR 292.1).
                </li>
                <li className="rounded border border-slate-300 bg-white px-3 py-2">
                  Form G-28 / EOIR-28 is attorney / DOJ-representative only — preparers never see it
                  (see the Legal Back Office).
                </li>
                <li className="rounded border border-slate-300 bg-white px-3 py-2">
                  Law students work supervised only: no independent advice, no G-28, no direct
                  filing, no client messages without supervisor visibility.
                </li>
                <li className="rounded border border-slate-300 bg-white px-3 py-2">
                  Prep fees and USCIS / NVC government fees are always shown separately — never
                  combined into one total.
                </li>
                <li className="rounded border border-slate-300 bg-white px-3 py-2">
                  Never store a CEAC password. NVC case numbers are manual entry + CEAC link only.
                </li>
              </ul>
            </section>
          )}

          {rail === "team" && (
            <section aria-label="Team staff and student seats">
              <h2 className="text-xl font-bold">Team / Staff / Student Seats</h2>
              <p className="mt-1 text-sm text-slate-600">Example seats, local state only.</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="rounded border border-slate-300 bg-white px-3 py-2">
                  <strong>Example Preparer</strong> — Document Preparer (clerical only)
                </li>
                <li className="rounded border border-slate-300 bg-white px-3 py-2">
                  <strong>Example Attorney</strong> — Licensed Attorney (verification pending in this example)
                </li>
                <li className="rounded border border-slate-300 bg-white px-3 py-2">
                  <strong>Example Student (3L)</strong> — Supervised only, assigned cases only
                </li>
              </ul>
              <p className="mt-2 text-sm text-slate-600">
                Student seats are assigned by a verified attorney / DOJ representative only, and a
                student sees only cases explicitly assigned to them.
              </p>
            </section>
          )}

          {/* ---- Center tools ---- */}
          {tool === "intake" && (
            <section aria-label="Intake and PDF auto-fill" className="rounded border border-slate-300 bg-white p-4">
              <h2 className="text-lg font-bold">Intake &amp; PDF Auto-Fill</h2>
              <p className="mt-1 text-sm text-slate-600">
                Intake for Example Client A is complete. PDF auto-fill is a SKELETON: the{" "}
                <code>/api/pdf/autofill</code> route returns 501 until pdf-lib + official USCIS PDF
                templates exist. Output is always a DRAFT for review — never auto-filed.
              </p>
              <p className="mt-2 text-sm">
                Full intake questionnaire:{" "}
                <Link href="/portal/questionnaire" className="font-semibold text-blue-700 underline">
                  /portal/questionnaire
                </Link>
              </p>
            </section>
          )}

          {tool === "vault" && (
            <section aria-label="Document vault and OCR" className="rounded border border-slate-300 bg-white p-4">
              <h2 className="text-lg font-bold">Document Vault &amp; OCR</h2>
              <p className="mt-1 text-sm text-slate-600">
                Approve / reject with a reason, or request a new document. Image-to-PDF + packet
                assembler are SKELETONS (official USCIS PDF templates NOT included; output is a DRAFT
                for review, never auto-filed). OCR is not available until the library is pinned:
                no OCR library is loaded in this build, and no unpinned CDN is loaded — see
                DEPLOY.md §13 and src/lib/expertTools.ts OCR_STATUS. Pinning the npm package
                alone would not pin what runs: tesseract.js downloads its worker script and
                trained language data from a CDN at runtime by default. Do not add a Tesseract
                (or any OCR) CDN script without a pinned version + SRI integrity hash, and do
                not install the package until the worker + traineddata are self-hosted.
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {vaultDocs.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2">
                    <span>
                      <strong>{d.label}</strong> —{" "}
                      {docReviews[d.id] ?? "under review"}
                    </span>
                    <span className="flex gap-2">
                      <button type="button" onClick={() => setDocReviews((r) => ({ ...r, [d.id]: "accepted" }))} className="rounded bg-green-700 px-3 py-1 text-sm font-semibold text-white">
                        Approve
                      </button>
                      <button type="button" onClick={() => setDocReviews((r) => ({ ...r, [d.id]: `retake requested — ${rejectReason.trim() || "no reason entered"}` }))} className="rounded bg-amber-600 px-3 py-1 text-sm font-semibold text-white">
                        Reject with reason
                      </button>
                      <button type="button" onClick={() => setDocReviews((r) => ({ ...r, [d.id]: "new document requested" }))} className="rounded bg-slate-700 px-3 py-1 text-sm font-semibold text-white">
                        Request new document
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <label className="mt-3 block text-sm">
                <span className="font-medium">Reject / retake reason (example)</span>
                <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Previous upload was blurry" className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
              </label>
              <p className="mt-3 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold">
                Image-to-PDF + packet assembler: SKELETON — not built. Official USCIS PDF templates
                are NOT included.
              </p>
            </section>
          )}

          {tool === "numbers" && (
            <section aria-label="USCIS and NVC numbers" className="rounded border border-slate-300 bg-white p-4">
              <h2 className="text-lg font-bold">USCIS &amp; NVC Numbers</h2>
              <p className="mt-1 text-sm text-slate-600">
                See the USCIS &amp; NVC Live Tracker in the left rail. Numbers are entered manually;
                no example receipt, NVC case, or invoice numbers are shown on this page.
              </p>
              <p className="mt-2 text-sm">
                USCIS fees: I-485 $1,440 (locked) · I-130 $675 (TO BE CONFIRMED) · NVC $120 AOS +
                $325 IV · USCIS Immigrant Fee $235. Confirm at{" "}
                <a href={USCIS_FEE_SCHEDULE_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">
                  uscis.gov/fees
                </a>
                .
              </p>
            </section>
          )}

          {tool === "esign" && (
            <section aria-label="E-Sign and packet build" className="rounded border border-slate-300 bg-white p-4">
              <h2 className="text-lg font-bold">E-Sign &amp; Packet Build</h2>
              <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                E-Sign provider NOT connected — no signature is collected here. The audit certificate
                below is the format that WILL be logged once a provider is connected: IP + timestamp
                + document version.
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Packet build is a DRAFT for review — never auto-filed. A packet unlocks for E-Sign
                only when the audit score is 100% and every blocking item is cleared.
              </p>
              <button
                type="button"
                onClick={() =>
                  setEsignLog((l) => [
                    ...l,
                    `E-Sign certificate (EXAMPLE — provider not connected): ${new Date().toLocaleString("en-US")} · IP not recorded in this demo · document version v1 · no signature collected.`,
                  ])
                }
                className="mt-3 rounded bg-blue-700 px-3 py-1 text-sm font-semibold text-white"
              >
                Preview audit certificate format (example)
              </button>
              {esignLog.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {esignLog.map((e, i) => (
                    <li key={i} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">{e}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {tool === "family" && (
            <section aria-label="Family and co-sponsors" className="rounded border border-slate-300 bg-white p-4">
              <h2 className="text-lg font-bold">Family &amp; Co-Sponsors</h2>
              <p className="mt-1 text-sm text-slate-600">
                Example family members, local state only. Co-sponsor / joint-sponsor invites go
                through token-gated family invites — never by sharing a case link.
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="rounded border border-slate-200 px-3 py-2">
                  <strong>Example Family Member A</strong> — spouse of Example Client A — invite sent (example)
                </li>
                <li className="rounded border border-slate-200 px-3 py-2">
                  <strong>Example Joint Sponsor</strong> — I-864 joint sponsor — invite pending (example)
                </li>
              </ul>
            </section>
          )}

          {tool === "calls" && (
            <section aria-label="Video call and audit" className="rounded border border-slate-300 bg-white p-4">
              <h2 className="text-lg font-bold">Video/Call &amp; Audit</h2>
              <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                Start Video Call is a placeholder — video room not connected yet. No call is started
                from this page.
              </p>
              <button
                type="button"
                onClick={() => setAuditLog((l) => [...l, `Example audit entry: video-call placeholder viewed at ${new Date().toLocaleString("en-US")} (example — local state only).`])}
                className="mt-3 rounded bg-slate-700 px-3 py-1 text-sm font-semibold text-white"
              >
                Start Instant Video Call (placeholder — video room not connected yet)
              </button>
              <h3 className="mt-4 font-bold">Audit log (example — local state only)</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {auditLog.map((e, i) => (
                  <li key={i} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">{e}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ---- Right rail: Omni-Channel Communication Hub (always visible) ---- */}
        <aside aria-label="Omni-channel communication hub" className="h-fit rounded border border-slate-300 bg-white p-4 xl:sticky xl:top-4">
          <h2 className="text-lg font-bold">Communication Hub</h2>
          <p className="mt-1 text-xs text-slate-600">
            Unified thread UI + queue only. SMS / WhatsApp / Email are NOT live — Twilio / AWS SES
            are NOT connected. Nothing sent from here is ever claimed as sent.
          </p>
          <div className="mt-3 flex flex-wrap gap-1" role="tablist" aria-label="Channel">
            {(["Portal Chat", "SMS", "WhatsApp", "Email"] as Channel[]).map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={channel === c}
                onClick={() => setChannel(c)}
                className={
                  "rounded-full border px-2 py-1 text-xs font-medium " +
                  (channel === c ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white hover:bg-slate-100")
                }
              >
                {c}
              </button>
            ))}
          </div>
          {(channel === "SMS" || channel === "WhatsApp" || channel === "Email") && (
            <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
              {channel} NOT configured — Twilio / AWS SES not connected. Messages queue only.
            </p>
          )}
          <label className="mt-3 flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">Auto-translate</span>
            <input type="checkbox" checked={autoTranslate} onChange={(e) => setAutoTranslate(e.target.checked)} />
          </label>
          <p className="text-xs text-slate-500">
            Auto-translate needs Google Cloud Translation — NOT connected. Toggle is a placeholder;
            no translation happens.
          </p>
          <label className="mt-3 block text-sm">
            <span className="font-medium">Message ({channel}) — Example Client A</span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              placeholder="Type a message… (it will queue only — nothing is sent)"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <div className="mt-2">
            <p className="text-xs font-medium text-slate-600">Quick templates:</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {TEMPLATES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => insertTemplate(t)}
                  className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-medium hover:bg-slate-100"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={sendAttempt}
            className="mt-3 w-full rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white"
          >
            Queue message (NOT sent — not configured)
          </button>
          <button
            type="button"
            onClick={() =>
              setHubNotice(
                "Start Video Call is a placeholder — video room not connected yet. No call was started."
              )
            }
            className="mt-2 w-full rounded bg-slate-700 px-3 py-2 text-sm font-semibold text-white"
          >
            Start Instant Video Call (placeholder — video room not connected yet)
          </button>
          {hubNotice && (
            <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
              {hubNotice}
            </p>
          )}
          <h3 className="mt-4 font-bold text-sm">Message queue (queued — NOT sent)</h3>
          {queue.length === 0 ? (
            <p className="mt-1 text-xs text-slate-500">No messages queued yet.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs">
              {queue.map((m) => (
                <li key={m.id} className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                  <strong>{m.channel} — queued, NOT sent:</strong> {m.body}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Privacy: messages go through the Twilio number (placeholder until set), never the
            founder&apos;s personal number.
          </p>
        </aside>
      </div>

      {/* Unified layer — "What you can do" + BYO. The Communication Hub
          in the right rail above is this page's own unified thread (kept
          as built by its owner); this layer adds the permissions panel
          and BYO settings here rather than replacing that hub. */}
      <div className="mt-6 space-y-6">
        <PermissionsPanel role="preparer" />
        <ByoSettings profileLabel="Company back-office — your own accounts (BYO). Example profile only." />
        <AskNipteiByoSettings profileLabel="Company back-office — your own chat AI for Ask NIPTEI (BYO). Example profile only." />
        <AskNipteiChat context="professional" caseId="example-case-1" />
      </div>

      <footer className="mt-8 border-t border-slate-200 pt-4 text-sm text-slate-600">
        <p>
          Immigration with NIPTEI is not a law firm and is not affiliated with USCIS. No outcome or
          approval is guaranteed. Only a licensed attorney or DOJ-Accredited Representative gives
          legal advice or represents a client (8 CFR 292.1).
        </p>
        <p className="mt-1">Contact: nipteiapp@gmail.com · (772) 971-6129</p>
      </footer>
    </main>
  );
}
