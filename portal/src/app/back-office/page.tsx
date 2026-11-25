"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import LanguagePicker from "@/components/LanguagePicker";
import {
  EXAMPLE_VERIFICATIONS,
  EXAMPLE_CHECKLIST,
  EXAMPLE_CASE,
  type VerificationRow,
} from "@/lib/example-data";
import EoirRosterLinks from "@/components/EoirRosterLinks";
import { EXAMPLE_ORDER, roadmapStages, formatCents, MISSED_PAYMENT_RULE } from "@/lib/order";
import { computePacketReadiness, EXAMPLE_AUDIT_ITEMS } from "@/lib/audit";
import { getSupabase } from "@/lib/supabase";
import ReportingDashboard from "@/components/admin/ReportingDashboard";
import TemplateVerification from "@/components/admin/TemplateVerification";
import UnifiedThread from "@/components/comms/UnifiedThread";
import DailyCommand from "@/components/comms/DailyCommand";
import CaseToolsPanel from "@/components/comms/CaseTools";
import CaseCommandPanel from "@/components/nextstep/CaseCommandPanel";
import PermissionsPanel from "@/components/comms/PermissionsPanel";
import ByoSettings from "@/components/comms/ByoSettings";
import AskNipteiByoSettings from "@/components/copilot/AskNipteiByoSettings";
import AskNipteiChat from "@/components/copilot/AskNipteiChat";
import type { MatrixRole } from "@/lib/permissions";

// ---------------------------------------------------------------------------
// Admin & Provider Back-Office — Immigration with NIPTEI
// EXAMPLE DATA ONLY. No real clients, providers, cases, or payments.
// All actions on this page are local state only: nothing is written to
// Supabase, nothing is charged, nothing is filed, nothing is approved
// for real. Live wiring (Supabase Auth role, messages table, Twilio,
// Stripe) is NOT connected in this build.
// ---------------------------------------------------------------------------

type Role = "preparer" | "attorney" | "nonprofit" | "law_student" | "platform_admin";

const ROLE_LABELS: Record<Role, string> = {
  preparer: "Document Preparer",
  attorney: "Licensed Attorney",
  nonprofit: "Nonprofit (DOJ-Accredited Organization)",
  law_student: "Supervised Law Student",
  platform_admin: "Platform Admin",
};

const ROLES: Role[] = ["preparer", "attorney", "nonprofit", "law_student", "platform_admin"];

// Example client list — generic labels only, no real people.
const EXAMPLE_CLIENTS = [
  { id: "client-1", label: "Example Client A", form: "I-130 — Family Petition", status: "Drafting in progress" },
  { id: "client-2", label: "Example Client B", form: "I-485 — Adjustment of Status", status: "Documents under review" },
];

type DocStatus = "accepted" | "under_review" | "retake_requested";

interface AuditLogEntry {
  id: number;
  time: string;
  text: string;
}

export default function BackOfficePage() {
  const [role, setRole] = useState<Role>("preparer");

  // Honest live check: getSupabase() returns null when env vars are unset.
  const isLive = useMemo(() => getSupabase() !== null, []);

  // --- Role gates (single source of truth for this page) ---
  const canSeeG28 = role === "attorney" || role === "nonprofit";
  const canSupervise = role === "attorney" || role === "nonprofit";
  const isStudent = role === "law_student";
  const isAdmin = role === "platform_admin";
  const isPreparer = role === "preparer";

  // --- Local state only: documents ---
  const [docStatuses, setDocStatuses] = useState<Record<string, DocStatus>>(() =>
    Object.fromEntries(EXAMPLE_CHECKLIST.map((d) => [d.id, d.status as DocStatus]))
  );
  const approveDoc = (id: string) =>
    setDocStatuses((s) => ({ ...s, [id]: "accepted" }));
  const requestRetake = (id: string) =>
    setDocStatuses((s) => ({ ...s, [id]: "retake_requested" }));

  // --- Local state only: payment milestones (EXAMPLE_ORDER) ---
  const [paidInvoices, setPaidInvoices] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(EXAMPLE_ORDER.invoices.map((i) => [i.invoiceNumber, i.status === "paid"]))
  );
  const markPaid = (invoiceNumber: string) =>
    setPaidInvoices((s) => ({ ...s, [invoiceNumber]: true }));
  const localOrder = useMemo(
    () => ({
      ...EXAMPLE_ORDER,
      invoices: EXAMPLE_ORDER.invoices.map((i) => ({
        ...i,
        status: paidInvoices[i.invoiceNumber] ? ("paid" as const) : i.status,
        paidAt: paidInvoices[i.invoiceNumber] ? (i.paidAt ?? "2026-11-19 (example)") : i.paidAt,
      })),
    }),
    [paidInvoices]
  );
  const stages = useMemo(() => roadmapStages(localOrder), [localOrder]);
  const totalPaidCents = localOrder.invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amountCents, 0);
  const balanceDueCents = localOrder.totalServiceFeeCents - totalPaidCents;

  // --- Packet readiness (computed from the audit lib, not hardcoded) ---
  const readiness = useMemo(() => computePacketReadiness(EXAMPLE_AUDIT_ITEMS), []);

  // --- Local state only: student supervision (attorney / nonprofit) ---
  const [assignedStudent, setAssignedStudent] = useState<string>("");
  const [supervisionNote, setSupervisionNote] = useState<string>("");

  // --- Local state only: G-28 workspace (attorney / nonprofit only) ---
  const [g28Status, setG28Status] = useState<"not_started" | "draft" | "signed_example">("draft");
  const [g28Note, setG28Note] = useState<string>("");

  // --- Local state only: nonprofit accredited-rep assignment ---
  const [accreditedRep, setAccreditedRep] = useState<string>("");

  // --- Local state only: verification queue (platform admin) ---
  const [verifications, setVerifications] = useState<VerificationRow[]>(EXAMPLE_VERIFICATIONS);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const logDecision = (text: string) =>
    setAuditLog((log) => [
      ...log,
      { id: log.length + 1, time: new Date().toLocaleString("en-US"), text },
    ]);
  const decideVerification = (
    id: string,
    decision: "verified" | "rejected" | "pending",
    detail: string
  ) => {
    setVerifications((rows) =>
      rows.map((r) => (r.id === id ? { ...r, status: decision } : r))
    );
    const row = verifications.find((r) => r.id === id);
    logDecision(
      `${row?.name ?? id} (${row?.role ?? "unknown"}): ${decision.toUpperCase()} — ${detail} (example decision, local state only — not saved to Supabase)`
    );
  };

  // --- Local state only: chat / messages (demo until wired to messages + Twilio) ---
  const [messages, setMessages] = useState<{ id: number; from: string; body: string }[]>([
    { id: 1, from: "Example Client A", body: "Example message: I re-uploaded my bank statement." },
  ]);
  const [draftMessage, setDraftMessage] = useState("");

  const sendMessage = () => {
    const body = draftMessage.trim();
    if (!body) return;
    setMessages((m) => [...m, { id: m.length + 1, from: `You (${ROLE_LABELS[role]})`, body }]);
    setDraftMessage("");
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-slate-900">
      {/* ---- Top bar ---- */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold">Immigration with NIPTEI — Admin &amp; Provider Back-Office</h1>
          <p className="mt-1 text-sm text-slate-600">
            nipteiapp@gmail.com · (772) 971-6129 · Clerical / educational help only.
          </p>
        </div>
        <LanguagePicker />
      </header>

      {/* ---- Example / not-live banner ---- */}
      {!isLive && (
        <p className="mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          Example data — not live. Supabase is not connected in this build, so no real login,
          approval, or payment is shown. All names below are generic examples.
        </p>
      )}
      {isLive && (
        <p className="mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          Example data — not live. This page still shows example data only; live login, approval,
          and payment are not wired in this build.
        </p>
      )}

      {/* ---- Role preview switcher ---- */}
      <section className="mt-4 rounded border border-slate-300 bg-slate-50 px-4 py-3" aria-label="Preview as role">
        <label className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <span>Preview As Role:</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-sm font-bold">
          DEMO switcher only — the real role always comes from the logged-in account&apos;s role in
          Supabase Auth / accounts table, never from a client-side dropdown in production.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Viewing as: <strong>{ROLE_LABELS[role]}</strong> (example preview).
        </p>
      </section>

      {/* ---- Role isolation ---- */}
      <p className="mt-4 rounded border border-slate-300 bg-white px-3 py-2 text-sm">
        <strong>Role isolation:</strong> you only ever see the cases,
        documents, and tools for your own role. If you open a page, case, or
        tool that is not for your role — or you can see another
        client&apos;s information — stop, do not use it, and email{" "}
        <a href="mailto:nipteiapp@gmail.com" className="font-semibold text-blue-700 underline">
          nipteiapp@gmail.com
        </a>{" "}
        (do not use thefeetwashers@gmail.com for portal access issues).
      </p>

      {/* ---- UPL compliance banner (preparer + law student) ---- */}
      {(isPreparer || isStudent) && (
        <p className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900">
          Non-attorney clerical assistance only. No legal advice or representation.
        </p>
      )}

      {/* ---- Shared state note ---- */}
      <p className="mt-4 rounded border border-slate-300 bg-white px-3 py-2 text-sm">
        Portal and back-office read the same Supabase tables (cases, documents, invoices,
        payment_plans, service_orders/order_invoices, messages, case_shipments_and_notices,
        audit_log) — shared Supabase state, realtime subscription to be enabled. Live sync is NOT
        claimed in this build.
      </p>

      {/* =============================================================== */}
      {/* UNIFIED LAYER — one thread per case + daily command + case tools */}
      {/* Founder/Admin sees the verification queue + audit log ONLY —    */}
      {/* never a client's thread, documents, or tools (see the matrix).  */}
      {/* =============================================================== */}
      {isAdmin ? (
        <div className="mt-6">
          <PermissionsPanel role="founder_admin" />
          <p className="mt-2 text-sm font-semibold">
            Founder / Admin: verification queue + audit log only. No client thread, documents,
            messages, or invoices are shown here — see docs/permissions-matrix.md §4 for the
            open database gap (migration 0003 §7a) that still needs a founder decision.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <PermissionsPanel
            role={
              (({ preparer: "preparer", attorney: "attorney", nonprofit: "doj_standard", law_student: "law_student" }) as Record<string, MatrixRole>)[role]
            }
            ctx={{ verified: false, supervisorConfirmed: false }}
          />
          <DailyCommand />
          <UnifiedThread
            caseId="example-case-1"
            caseLabel="Example Client A — I-130 (EXAMPLE)"
            viewerRole={
              (({ preparer: "preparer", attorney: "attorney", nonprofit: "doj_standard", law_student: "law_student" }) as Record<string, string>)[role] as "preparer" | "attorney" | "doj_standard" | "law_student"
            }
            viewerName={`You (${ROLE_LABELS[role]})`}
            clientLanguage="es"
            canSend={!isStudent}
            sendDisabledReason={isStudent ? "Law students cannot message a client without supervisor visibility." : undefined}
          />
          <CaseToolsPanel
            role={
              (({ preparer: "preparer", attorney: "attorney", nonprofit: "doj_standard", law_student: "law_student" }) as Record<string, MatrixRole>)[role]
            }
            caseLabel="Example Client A — I-130 (EXAMPLE)"
          />
          {/* Next Step + Stage + Payment + Communication engine (one
              screen). Daily Command + unified thread already render above,
              so the panel does not repeat them. Law students get a
              read-only panel: no payment editing, no route switching. */}
          <CaseCommandPanel
            role={
              (({ preparer: "preparer", attorney: "attorney", nonprofit: "nonprofit", law_student: "law_student" }) as Record<string, "preparer" | "attorney" | "nonprofit" | "law_student">)[role]
            }
            route="inside_us"
            clientLanguage="es"
            showDailyCommand={false}
            showComms={false}
            canEditPayment={!isStudent}
            canEditRoute={!isStudent}
            guide="professional"
          />
          {!isStudent && (
            <>
              <ByoSettings profileLabel={`${ROLE_LABELS[role]} — your own accounts (BYO). Example profile only.`} />
              <AskNipteiByoSettings profileLabel={`${ROLE_LABELS[role]} — your own chat AI for Ask NIPTEI (BYO). Example profile only.`} />
              <AskNipteiChat context="professional" caseId="example-case-1" />
            </>
          )}
        </div>
      )}

      {/* =============================================================== */}
      {/* PLATFORM ADMIN — verification queue only                         */}
      {/* =============================================================== */}
      {isAdmin && (
        <section className="mt-6" aria-label="Verification queue">
          <h2 className="text-xl font-bold">Verification Queue (EXAMPLE)</h2>
          <p className="mt-1 text-sm text-slate-600">
            Attorney bar-number and DOJ credential submissions. Example rows only — no real people.
            Decisions below are local state only and are not saved to Supabase.
          </p>
          <p className="mt-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold">
            Self-verification is blocked: an admin cannot approve their own account. A DB trigger
            in migration 0001 blocks non-admin verification changes.
          </p>
          <p className="mt-2 text-sm">
            Full queue:{" "}
            <Link href="/admin/verifications" className="font-semibold text-blue-700 underline">
              /admin/verifications
            </Link>
          </p>

          <ul className="mt-4 space-y-4">
            {verifications.map((v) => (
              <li key={v.id} className="rounded border border-slate-300 bg-white p-4">
                <p className="font-semibold">
                  {v.name} — {v.role === "attorney" ? "Attorney" : "Nonprofit (DOJ)"}
                </p>
                <p className="text-sm text-slate-600">Submitted: {v.submitted}</p>
                {v.barNumber && <p className="text-sm">Bar number (example): {v.barNumber}</p>}
                {v.barStates && <p className="text-sm">Bar state(s): {v.barStates.join(", ")}</p>}
                {v.eoirNumber && <p className="text-sm">EOIR number (example): {v.eoirNumber}</p>}
                {v.accreditationLevel && (
                  <p className="text-sm">Accreditation: {v.accreditationLevel}</p>
                )}
                {v.accreditationExpiry && (
                  <p className="text-sm">Accreditation expires: {v.accreditationExpiry}</p>
                )}
                <p className="text-sm">Status: <strong>{v.status}</strong></p>
                <p className="text-sm text-slate-600">{v.notes}</p>
                {v.status === "pending" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => decideVerification(v.id, "verified", "Approved (example)")}
                      className="rounded bg-green-700 px-3 py-1 text-sm font-semibold text-white"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        decideVerification(
                          v.id,
                          "rejected",
                          `Rejected — reason: ${rejectReason[v.id]?.trim() || "(no reason entered)"}`
                        )
                      }
                      className="rounded bg-red-700 px-3 py-1 text-sm font-semibold text-white"
                    >
                      Reject with reason
                    </button>
                    <button
                      type="button"
                      onClick={() => decideVerification(v.id, "pending", "More info requested (example)")}
                      className="rounded bg-slate-700 px-3 py-1 text-sm font-semibold text-white"
                    >
                      Request more info
                    </button>
                    <label className="text-sm">
                      <span className="sr-only">Reject reason</span>
                      <input
                        type="text"
                        value={rejectReason[v.id] ?? ""}
                        onChange={(e) =>
                          setRejectReason((r) => ({ ...r, [v.id]: e.target.value }))
                        }
                        placeholder="Reason for rejection (example)"
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </label>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <h3 className="mt-6 text-lg font-bold">Audit log (on-screen, example decisions)</h3>
          {auditLog.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">
              No decisions yet. Each Approve / Reject / Request-more-info decision above appends here.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {auditLog.map((entry) => (
                <li key={entry.id} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">
                  <span className="text-slate-500">{entry.time} — </span>
                  {entry.text}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* =============================================================== */}
      {/* LAW STUDENT — supervised-only workspace                         */}
      {/* =============================================================== */}
      {isStudent && (
        <section className="mt-6" aria-label="Supervised student workspace">
          <h2 className="text-xl font-bold">Supervised Law Student Workspace (EXAMPLE)</h2>
          <p className="mt-1 text-sm">
            Supervisor: <strong>Example Supervisor (attorney)</strong>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            You see only cases explicitly assigned to you by a verified supervisor.
          </p>

          <h3 className="mt-4 text-lg font-bold">Your assigned case</h3>
          <div className="mt-2 rounded border border-slate-300 bg-white p-4">
            <p className="font-semibold">
              Example Client A — {EXAMPLE_CASE.formCode} ({EXAMPLE_CASE.formName})
            </p>
            <p className="text-sm text-slate-600">{EXAMPLE_CASE.statusLine}</p>
            <p className="mt-2 text-sm">
              Packet readiness (example): <strong>{readiness.score}%</strong> —{" "}
              {readiness.readyToFile ? "Ready to file" : "Not ready to file"}.
              {readiness.blockingItems.length > 0 &&
                ` Blocking items: ${readiness.blockingItems.map((i) => i.label).join("; ")}.`}
            </p>
          </div>

          <h3 className="mt-4 text-lg font-bold">Other cases</h3>
          <div className="mt-2 rounded border border-slate-300 bg-slate-50 p-4">
            <p className="font-semibold">Example Client B — I-485</p>
            <p className="text-sm font-semibold text-slate-700">Not assigned to you — hidden</p>
            <p className="text-sm text-slate-600">
              No case details are shown. Only your supervisor can assign this case to you.
            </p>
          </div>

          <div className="mt-4 rounded border border-slate-300 bg-white p-4">
            <h3 className="text-lg font-bold">E-Sign — Disabled</h3>
            <p className="mt-1 text-sm">
              Disabled for supervised law students. E-Sign is available only after a verified
              supervisor reviews and releases the packet.
            </p>
            <h3 className="mt-4 text-lg font-bold">Form G-28 — Disabled</h3>
            <p className="mt-1 text-sm">
              Disabled for supervised law students. G-28 (Notice of Entry of Appearance as
              Attorney or Accredited Representative) is attorney / DOJ-accredited-representative
              only — a student cannot file or sign it.
            </p>
          </div>
        </section>
      )}

      {/* =============================================================== */}
      {/* PREPARER / ATTORNEY / NONPROFIT — case work                     */}
      {/* =============================================================== */}
      {!isAdmin && !isStudent && (
        <>
          <section className="mt-6" aria-label="Client list">
            <h2 className="text-xl font-bold">Clients (EXAMPLE)</h2>
            <ul className="mt-2 space-y-2">
              {EXAMPLE_CLIENTS.map((c) => (
                <li key={c.id} className="rounded border border-slate-300 bg-white px-3 py-2">
                  <p className="font-semibold">{c.label}</p>
                  <p className="text-sm text-slate-600">
                    {c.form} — {c.status}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* Document review */}
          <section className="mt-6" aria-label="Document review">
            <h2 className="text-xl font-bold">Document Review (EXAMPLE)</h2>
            <p className="mt-1 text-sm text-slate-600">
              Approve or request a retake. Local state only — nothing is saved or sent.
            </p>
            <ul className="mt-2 space-y-2">
              {EXAMPLE_CHECKLIST.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-300 bg-white px-3 py-2"
                >
                  <div>
                    <p className="font-semibold">{doc.label}</p>
                    <p className="text-sm text-slate-600">
                      Status: <strong>{docStatuses[doc.id]}</strong>
                      {doc.note ? ` — ${doc.note}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => approveDoc(doc.id)}
                      className="rounded bg-green-700 px-3 py-1 text-sm font-semibold text-white"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => requestRetake(doc.id)}
                      className="rounded bg-amber-600 px-3 py-1 text-sm font-semibold text-white"
                    >
                      Request retake
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Packet readiness */}
          <section className="mt-6" aria-label="Packet readiness">
            <h2 className="text-xl font-bold">Packet Readiness (EXAMPLE)</h2>
            <p className="mt-1 text-sm">
              Score: <strong>{readiness.score}%</strong> —{" "}
              {readiness.readyToFile ? "Ready to file" : "Not ready to file"} (filing cannot be
              marked ready until the score is 100 and every blocking item is cleared).
            </p>
            {readiness.blockingItems.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm">
                {readiness.blockingItems.map((item) => (
                  <li key={item.id}>
                    {item.label}
                    {item.detail ? ` — ${item.detail}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Payment milestones */}
          <section className="mt-6" aria-label="Payment milestones">
            <h2 className="text-xl font-bold">Payment Milestones (EXAMPLE)</h2>
            <p className="mt-1 text-sm text-slate-600">
              {EXAMPLE_ORDER.packageTitle} — {EXAMPLE_ORDER.paymentPlanType === "installments_3" ? "Pay in 3" : EXAMPLE_ORDER.paymentPlanType}.
              Total service fee {formatCents(EXAMPLE_ORDER.totalServiceFeeCents)}; estimated USCIS
              government fee {formatCents(EXAMPLE_ORDER.estimatedUscisGovFeeCents)} shown
              separately and never added to the service total. Paid so far{" "}
              {formatCents(totalPaidCents)}; balance due {formatCents(balanceDueCents)}.
            </p>
            <p className="mt-1 text-sm text-slate-600">{MISSED_PAYMENT_RULE}</p>
            <ul className="mt-2 space-y-2">
              {localOrder.invoices.map((inv) => (
                <li
                  key={inv.invoiceNumber}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-300 bg-white px-3 py-2"
                >
                  <div>
                    <p className="font-semibold">
                      {inv.invoiceNumber} — {inv.milestoneLabel}
                    </p>
                    <p className="text-sm text-slate-600">
                      {formatCents(inv.amountCents)} — Status: <strong>{inv.status}</strong>
                      {inv.paidAt ? ` (paid ${inv.paidAt})` : ""}
                    </p>
                  </div>
                  {inv.status !== "paid" && (
                    <button
                      type="button"
                      onClick={() => markPaid(inv.invoiceNumber)}
                      className="rounded bg-blue-700 px-3 py-1 text-sm font-semibold text-white"
                    >
                      Mark invoice paid (example — no Stripe charge)
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <h3 className="mt-4 text-lg font-bold">Roadmap stages</h3>
            <ol className="mt-2 list-decimal pl-5 text-sm">
              {stages.map((s) => (
                <li key={s.step}>
                  <strong>{s.label}</strong> — {s.unlocked ? "Unlocked" : "Locked"}: {s.detail}
                </li>
              ))}
            </ol>
          </section>

          {/* ---- G-28 ---- */}
          {canSeeG28 ? (
            <section className="mt-6 rounded border border-slate-300 bg-white p-4" aria-label="G-28 workspace">
              <h2 className="text-xl font-bold">Form G-28 Workspace (EXAMPLE)</h2>
              <p className="mt-1 text-sm text-slate-600">
                Notice of Entry of Appearance as Attorney or Accredited Representative. Visible to
                attorneys and DOJ-accredited nonprofit representatives only.
              </p>
              <p className="mt-2 text-sm">
                Status:{" "}
                <strong>
                  {g28Status === "not_started"
                    ? "Not started"
                    : g28Status === "draft"
                      ? "Draft (example)"
                      : "Signed (example — no real filing)"}
                </strong>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setG28Status("draft")}
                  className="rounded bg-slate-700 px-3 py-1 text-sm font-semibold text-white"
                >
                  Save G-28 draft (example)
                </button>
                <button
                  type="button"
                  onClick={() => setG28Status("signed_example")}
                  className="rounded bg-blue-700 px-3 py-1 text-sm font-semibold text-white"
                >
                  Mark signed (example — no real filing)
                </button>
              </div>
              <label className="mt-3 block text-sm">
                <span className="font-medium">G-28 note (example, local only):</span>
                <input
                  type="text"
                  value={g28Note}
                  onChange={(e) => setG28Note(e.target.value)}
                  placeholder="Example note"
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
            </section>
          ) : (
            <p className="mt-6 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold">
              G-28 is attorney-only — preparers never see it.
            </p>
          )}

          {/* ---- Attorney extras ---- */}
          {role === "attorney" && (
            <section className="mt-6" aria-label="Attorney tools">
              <h2 className="text-xl font-bold">Attorney Tools (EXAMPLE)</h2>
              <p className="mt-2 inline-block rounded border border-blue-300 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-900">
                Bar-verified badge (example only — never claim verified)
              </p>
              <p className="mt-2 text-sm text-slate-600">
                This badge is an example label. Real bar verification requires a manual/admin
                check against the state bar; no live bar lookup exists in this build.
              </p>
            </section>
          )}

          {/* ---- Student supervision (attorney + nonprofit) ---- */}
          {canSupervise && (
            <section className="mt-6 rounded border border-slate-300 bg-white p-4" aria-label="Student supervision">
              <h2 className="text-xl font-bold">Student Supervision (EXAMPLE)</h2>
              <p className="mt-1 text-sm text-slate-600">
                Assign a supervised law student to a case. Local state only. A student sees only
                cases explicitly assigned to them.
              </p>
              <label className="mt-3 block text-sm">
                <span className="font-medium">Assign student to Example Client A ({EXAMPLE_CASE.formCode}):</span>
                <input
                  type="text"
                  value={assignedStudent}
                  onChange={(e) => setAssignedStudent(e.target.value)}
                  placeholder="Example Student"
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="mt-3 block text-sm">
                <span className="font-medium">Supervision note (example, local only):</span>
                <input
                  type="text"
                  value={supervisionNote}
                  onChange={(e) => setSupervisionNote(e.target.value)}
                  placeholder="Example supervision note"
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
              {assignedStudent.trim() && (
                <p className="mt-2 text-sm">
                  Assigned (example, local only): <strong>{assignedStudent.trim()}</strong> — supervised
                  by Example Supervisor (attorney) — sees only Example Client A.
                </p>
              )}
            </section>
          )}

          {/* ---- Nonprofit extras ---- */}
          {role === "nonprofit" && (
            <section className="mt-6 rounded border border-slate-300 bg-white p-4" aria-label="Nonprofit tools">
              <h2 className="text-xl font-bold">Nonprofit (DOJ) Tools (EXAMPLE)</h2>
              <p className="mt-1 text-sm text-slate-600">
                Same G-28 access as an attorney (see above). Accredited representatives act under
                the organization&apos;s DOJ recognition — only a licensed attorney or
                DOJ-Accredited Representative gives legal advice or represents a client
                (8 CFR 292.1).
              </p>
              <label className="mt-3 block text-sm">
                <span className="font-medium">Assign accredited representative (example, local only):</span>
                <input
                  type="text"
                  value={accreditedRep}
                  onChange={(e) => setAccreditedRep(e.target.value)}
                  placeholder="Example Accredited Representative"
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
              {accreditedRep.trim() && (
                <p className="mt-2 text-sm">
                  Assigned (example, local only): <strong>{accreditedRep.trim()}</strong>
                </p>
              )}
              <EoirRosterLinks />
            </section>
          )}
        </>
      )}

      {/* ---- Chat / messages (all roles except admin queue view keeps it too) ---- */}
      <section className="mt-6 rounded border border-slate-300 bg-white p-4" aria-label="Messages">
        <h2 className="text-xl font-bold">Messages (Demo)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Demo only — local state, not sent. Wiring to the messages table + Twilio is not
          connected in this build.
        </p>
        <ul className="mt-3 space-y-2">
          {messages.map((m) => (
            <li key={m.id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <strong>{m.from}:</strong> {m.body}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="flex-1">
            <span className="sr-only">Message</span>
            <input
              type="text"
              value={draftMessage}
              onChange={(e) => setDraftMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
              placeholder="Type a demo message (not sent)"
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={sendMessage}
            className="rounded bg-blue-700 px-3 py-1 text-sm font-semibold text-white"
          >
            Send (demo)
          </button>
        </div>
      </section>

      {/* ---- Reporting (real records only) + USCIS templates ---- */}
      {(isAdmin || isPreparer) && (
        <>
          <div className="mt-6">
            <ReportingDashboard />
          </div>
          <div className="mt-6">
            <TemplateVerification />
          </div>
        </>
      )}

      {/* ---- Footer disclaimer ---- */}
      <footer className="mt-8 border-t border-slate-200 pt-4 text-sm text-slate-600">
        <p>
          Immigration with NIPTEI is not a law firm and is not affiliated with USCIS. No outcome
          or approval is guaranteed. Clerical / educational help only. Only a licensed attorney or
          DOJ-Accredited Representative gives legal advice or represents a client (8 CFR 292.1).
        </p>
        <p className="mt-1">
          Contact: nipteiapp@gmail.com · (772) 971-6129
        </p>
      </footer>
    </main>
  );
}
