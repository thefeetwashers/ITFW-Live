"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import LanguagePicker from "@/components/LanguagePicker";
import { getSupabase } from "@/lib/supabase";
import EoirRosterLinks from "@/components/EoirRosterLinks";
import UnifiedThread from "@/components/comms/UnifiedThread";
import PermissionsPanel from "@/components/comms/PermissionsPanel";
import ByoSettings from "@/components/comms/ByoSettings";
import AskNipteiByoSettings from "@/components/copilot/AskNipteiByoSettings";
import AskNipteiChat from "@/components/copilot/AskNipteiChat";
import RoleCheatsheet from "@/components/cheatsheets/RoleCheatsheet";
import CaseCommandPanel from "@/components/nextstep/CaseCommandPanel";

// ---------------------------------------------------------------------------
// Role-Gated Legal Back Office — Roles 3, 4, 5 ONLY.
//   Role 3 — Licensed Immigration Attorney ($99/mo)
//   Role 4 — DOJ-Accredited Nonprofit (Standard $24.50/mo / Full $49.50/mo)
//   Role 5 — Law Student — Supervised Only ($35/mo)
// SEPARATE from the preparer back-office (/back-office): preparers never
// see G-28 and must not use this page. Real role comes from Supabase Auth /
// public.accounts — never from a client-side switch. The "Preview As Role"
// switch below is DEMO-only and labelled as such; the "Simulate Verified
// Credential" checkbox was REMOVED (Nov 19–20 consolidation) — nothing
// on this page may pretend an account is verified.
// EXAMPLE DATA ONLY. All actions are local state only: nothing is written
// to Supabase, nothing is charged, nothing is filed, no credential is
// really verified. No real person, bar number, school, or client appears
// here — generic example labels only.
// ---------------------------------------------------------------------------

type LegalRole = "attorney" | "nonprofit" | "student";

const ROLE_LABELS: Record<LegalRole, string> = {
  attorney: "Licensed Immigration Attorney (Role 3)",
  nonprofit: "DOJ-Accredited Nonprofit (Role 4)",
  student: "Law Student — Supervised Only (Role 5)",
};

const ROLE_PLANS: Record<LegalRole, string> = {
  attorney: "$99/mo",
  nonprofit: "$24.50/mo", // Standard; Full is $49.50/mo (tier switch below)
  student: "$35/mo",
};

const UNVERIFIED_BANNER =
  "Pending Bar/DOJ/Supervisor Verification — You can set up your profile, but directory listing and live client assignments unlock once verified.";

type Section = "overview" | "g28" | "supervision" | "research" | "billing" | "student-queue";

interface AuditEntry {
  id: number;
  time: string;
  text: string;
}

export default function LegalBackOfficePage() {
  const [role, setRole] = useState<LegalRole>("attorney");
  const [section, setSection] = useState<Section>("overview");
  // Verification is NEVER simulated on this page. It is an admin check
  // (bar / EOIR roster / supervisor confirmation) recorded in
  // public.accounts.verification_status. Until the portal is wired to
  // Supabase Auth, every verified-only tool on this page stays locked
  // and the status below always reads "Pending verification". The
  // "Simulate Verified Credential" checkbox that used to sit here was
  // removed (Nov 19–20 consolidation): nothing on this page may
  // pretend an account is verified.
  const verified = false;
  const [nonprofitTier, setNonprofitTier] = useState<"partial" | "full">("partial");
  const isLive = useMemo(() => getSupabase() !== null, []);

  const plan =
    role === "nonprofit" && nonprofitTier === "full" ? "$49.50/mo" : ROLE_PLANS[role];
  const isStudent = role === "student";
  const isNonprofit = role === "nonprofit";
  // EOIR-28: Full accreditation ONLY, and only once verified. Partial =
  // EOIR Court tools stay LOCKED (DHS/USCIS/NVC only).
  const eoir28Unlocked = isNonprofit
    ? verified && nonprofitTier === "full"
    : role === "attorney"
      ? verified
      : false;

  // --- Local state only: verification submissions (example) ---
  const [barNumber, setBarNumber] = useState("");
  const [barStates, setBarStates] = useState("");
  const [dojDate, setDojDate] = useState("");
  const [repNames, setRepNames] = useState("");
  const [supervisorEmail, setSupervisorEmail] = useState("");
  const [verificationNote, setVerificationNote] = useState<string | null>(null);

  // --- Local state only: audit log (example decisions) ---
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const logDecision = (text: string) =>
    setAuditLog((log) => [
      ...log,
      { id: log.length + 1, time: new Date().toLocaleString("en-US"), text },
    ]);

  // --- Local state only: G-28 / EOIR-28 drafts (example) ---
  const [g28Form, setG28Form] = useState<"G-28 DHS/USCIS" | "G-28 NVC" | "EOIR-28">(
    "G-28 DHS/USCIS"
  );
  const [g28Client, setG28Client] = useState("");
  const [g28Status, setG28Status] = useState<"not_started" | "draft">("not_started");

  // --- Local state only: RFE / NOID brief builder (attorney, example) ---
  const [briefType, setBriefType] = useState<"RFE Response" | "NOID Response" | "Legal Strategy Memo">(
    "RFE Response"
  );
  const [briefNotes, setBriefNotes] = useState("");

  // --- Local state only: supervision queues (attorney / nonprofit) ---
  const [confirmQueue, setConfirmQueue] = useState([
    { id: "stu-1", label: "Example Student A — 3L, Example Law School", status: "pending" },
  ]);
  const [draftQueue, setDraftQueue] = useState([
    { id: "draft-1", label: "Example Student A — I-130 draft checklist for Example Client A", status: "pending_review" },
  ]);

  // --- Local state only: nonprofit seats + sliding-scale tracker ---
  const [seatName, setSeatName] = useState("");
  const [seats, setSeats] = useState<string[]>(["Example Accredited Representative (Full)"]);
  const [grantNote, setGrantNote] = useState("");

  // --- Local state only: student drafts + research notes ---
  const [studentDraft, setStudentDraft] = useState("");
  const [draftSubmitted, setDraftSubmitted] = useState(false);
  const [researchNote, setResearchNote] = useState("");
  const [researchNotes, setResearchNotes] = useState<string[]>([
    "Example research note: 8 CFR 292.1 — only a licensed attorney or DOJ-Accredited Representative gives legal advice or represents a client.",
  ]);

  // --- Local state only: retainer / trust billing (DRAFT — not a ledger) ---
  const [retainerAmount, setRetainerAmount] = useState("");
  const [retainerNote, setRetainerNote] = useState("");

  const sidebar: { id: Section; label: string; roles: LegalRole[]; lockedForStudent?: boolean }[] = [
    { id: "overview", label: "Overview & Verification", roles: ["attorney", "nonprofit", "student"] },
    { id: "g28", label: "G-28 / EOIR-28 Forms", roles: ["attorney", "nonprofit"] },
    { id: "supervision", label: "Student Supervision", roles: ["attorney", "nonprofit"] },
    { id: "research", label: "Research & Memos", roles: ["attorney", "nonprofit", "student"] },
    { id: "billing", label: "Billing & Retainers", roles: ["attorney", "nonprofit"] },
    { id: "student-queue", label: "Assigned Cases (Student Queue)", roles: ["student"] },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold">Legal Back Office — Immigration with NIPTEI</h1>
          <p className="mt-1 text-sm text-slate-600">
            Roles 3, 4 and 5 only. Document Preparers use{" "}
            <Link href="/back-office" className="font-semibold text-blue-700 underline">
              /back-office
            </Link>{" "}
            and never see G-28. Clerical / legal help only — not a law firm, no approval guarantee.
          </p>
        </div>
        <LanguagePicker />
      </header>

      <p className="mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
        Example data — not live{!isLive ? ". Supabase is not connected in this build" : ""}. No real
        login, verification, charge, or filing happens here. All names below are generic examples;
        no bar number shown here is verified.
      </p>

      {/* ---- DEMO-only role preview (never the real gate) ---- */}
      <section className="mt-4 rounded border border-slate-300 bg-slate-50 px-4 py-3" aria-label="Preview as role">
        <label className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <span>Preview As Role (DEMO only):</span>
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value as LegalRole);
              setSection("overview");
            }}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            {(Object.keys(ROLE_LABELS) as LegalRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-sm font-bold">
          DEMO switcher only — the real role always comes from the logged-in account&apos;s role in
          Supabase Auth / public.accounts, never from a client-side dropdown in production.
        </p>
        <p className="mt-3 text-sm text-slate-700">
          <strong>Verification cannot be previewed here.</strong> It is an
          admin check (bar / EOIR roster / supervisor confirmation)
          recorded in public.accounts.verification_status. Until then
          every verified-only tool stays locked — nothing on this page
          may pretend an account is verified.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Viewing as: <strong>{ROLE_LABELS[role]}</strong> (example preview).
        </p>
        <p className="mt-2 text-sm text-slate-600">
          <strong>Role isolation:</strong> you only ever see the cases,
          documents, and tools for your own role. If you open a page, case,
          or tool that is not for your role — or you can see another
          client&apos;s information — stop, do not use it, and email{" "}
          <a href="mailto:nipteiapp@gmail.com" className="font-semibold text-blue-700 underline">
            nipteiapp@gmail.com
          </a>{" "}
          (do not use thefeetwashers@gmail.com for portal access issues).
        </p>
      </section>

      {/* ---- Verification banners (verbatim) ---- */}
      {!verified ? (
        <p className="mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900" role="status">
          {UNVERIFIED_BANNER}
        </p>
      ) : (
        <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm font-semibold text-green-900" role="status">
          Verified &amp; Listed at https://immigration.niptei.com/p/your-name | Active Plan: {plan}
          {" "}(DEMO preview — replace “your-name” with your real public slug once verified.)
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* ---- Sidebar: adapts by role ---- */}
        <nav aria-label="Legal back office sections" className="h-fit rounded border border-slate-300 bg-white p-3 lg:sticky lg:top-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Legal Back Office</h2>
          <ul className="mt-2 space-y-1">
            {sidebar
              .filter((item) => item.roles.includes(role))
              .map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSection(item.id)}
                    aria-current={section === item.id ? "page" : undefined}
                    className={
                      "w-full rounded px-3 py-2 text-left text-sm font-medium " +
                      (section === item.id
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-800 hover:bg-slate-100")
                    }
                  >
                    {item.label}
                  </button>
                </li>
              ))}
          </ul>
          {isStudent && (
            <div className="mt-4 border-t border-slate-200 pt-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Locked for students</h3>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                <li>🔒 G-28 / EOIR-28 — LOCKED</li>
                <li>🔒 Billing &amp; Retainers — LOCKED</li>
                <li>🔒 Independent legal advice — LOCKED</li>
                <li>🔒 Direct filing with USCIS / Court — LOCKED</li>
              </ul>
              <p className="mt-2 text-xs text-slate-500">
                Student drafts need supervisor review + approval before they unlock for client
                E-Sign / G-28 filing.
              </p>
            </div>
          )}
          <p className="mt-4 text-xs text-slate-500">
            Public profile (once verified):{" "}
            <span className="font-mono">immigration.niptei.com/p/your-name</span>
          </p>
        </nav>

        {/* ---- Main workspace ---- */}
        <div className="space-y-6">
          {section === "overview" && (
            <section aria-label="Overview and verification">
              <h2 className="text-xl font-bold">Overview &amp; Verification</h2>
              <p className="mt-1 text-sm text-slate-600">
                Role: <strong>{ROLE_LABELS[role]}</strong> · Plan: <strong>{plan}</strong> · Status:{" "}
                <strong>{verified ? "Verified" : "Pending verification"}</strong>
              </p>

              {/* Start here — cheatsheet for this role (attorney / DOJ /
                  law student, from the demo role switcher above). First
                  5 things to do, in order. */}
              <RoleCheatsheet
                role={role === "attorney" ? "attorney" : role === "nonprofit" ? "doj" : "law_student"}
                compact
              />

              {/* Unified layer — one thread per case + what you can do + BYO. */}
              <div className="mt-4 space-y-4">
                <PermissionsPanel
                  role={role === "attorney" ? "attorney" : role === "nonprofit" ? (nonprofitTier === "full" ? "doj_full" : "doj_standard") : "law_student"}
                  ctx={{ verified, dojLevel: nonprofitTier, supervisorConfirmed: false }}
                />
                <UnifiedThread
                  caseId="example-case-1"
                  caseLabel="Example Client A — I-130 (EXAMPLE)"
                  viewerRole={role === "attorney" ? "attorney" : role === "nonprofit" ? (nonprofitTier === "full" ? "doj_full" : "doj_standard") : "law_student"}
                  viewerName={`You (${ROLE_LABELS[role]})`}
                  clientLanguage="es"
                  canSend={role !== "student"}
                  sendDisabledReason={role === "student" ? "Law students cannot message a client without supervisor visibility." : undefined}
                />
                {role !== "student" && (
                  <>
                    <ByoSettings profileLabel={`${ROLE_LABELS[role]} — your own accounts (BYO). Example profile only.`} />
                    <AskNipteiByoSettings profileLabel={`${ROLE_LABELS[role]} — your own chat AI for Ask NIPTEI (BYO). Example profile only.`} />
                    <AskNipteiChat context="professional" caseId="example-case-1" />
                  </>
                )}
                {/* Next Step + Stage + Payment + Communication engine (one
                    screen). Unified thread already renders above, so the
                    panel does not repeat it. Law students get a read-only
                    panel: no payment editing, no route switching. */}
                <CaseCommandPanel
                  role={role === "attorney" ? "attorney" : role === "nonprofit" ? "nonprofit" : "law_student"}
                  route="inside_us"
                  clientLanguage="es"
                  showComms={false}
                  canEditPayment={role !== "student"}
                  canEditRoute={role !== "student"}
                  guide="professional"
                />
              </div>

              {role === "attorney" && (
                <div className="mt-4 rounded border border-slate-300 bg-white p-4">
                  <h3 className="font-bold">Attorney verification — State Bar # + jurisdiction</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    An admin approves before your public listing and G-28 tools go live. Your bar
                    number is never shown as verified until then.
                  </p>
                  <label className="mt-3 block text-sm">
                    <span className="font-medium">State Bar # (example — never presented as verified)</span>
                    <input
                      type="text"
                      value={barNumber}
                      onChange={(e) => setBarNumber(e.target.value)}
                      placeholder="e.g. FL-000000 (example)"
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="mt-3 block text-sm">
                    <span className="font-medium">Jurisdiction / state(s) admitted</span>
                    <input
                      type="text"
                      value={barStates}
                      onChange={(e) => setBarStates(e.target.value)}
                      placeholder="e.g. Florida"
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setVerificationNote(
                        "Bar verification submitted for admin review (example — local state only, nothing was checked or saved)."
                      )
                    }
                    className="mt-3 rounded bg-blue-700 px-3 py-1 text-sm font-semibold text-white"
                  >
                    Submit for admin approval (example)
                  </button>
                </div>
              )}

              {isNonprofit && (
                <div className="mt-4 rounded border border-slate-300 bg-white p-4">
                  <h3 className="font-bold">DOJ Nonprofit verification — EOIR roster check</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    An admin checks your recognition date and accredited representatives against the
                    official EOIR roster before approving.
                  </p>
                  <label className="mt-3 block text-sm">
                    <span className="font-medium">DOJ recognition date</span>
                    <input
                      type="date"
                      value={dojDate}
                      onChange={(e) => setDojDate(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="mt-3 block text-sm">
                    <span className="font-medium">Accredited Representative names (one per line)</span>
                    <textarea
                      value={repNames}
                      onChange={(e) => setRepNames(e.target.value)}
                      placeholder={"Example Accredited Representative"}
                      rows={3}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <fieldset className="mt-3">
                    <legend className="text-sm font-medium">Accreditation tier</legend>
                    <div className="mt-1 space-y-1 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="np-tier"
                          checked={nonprofitTier === "partial"}
                          onChange={() => setNonprofitTier("partial")}
                        />
                        Partial — DHS/USCIS &amp; NVC only · $24.50/mo (EOIR Court tools stay LOCKED)
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="np-tier"
                          checked={nonprofitTier === "full"}
                          onChange={() => setNonprofitTier("full")}
                        />
                        Full — USCIS and Court · $49.50/mo (EOIR-28 unlocks only if Full AND verified)
                      </label>
                    </div>
                  </fieldset>
                  <EoirRosterLinks />
                  <button
                    type="button"
                    onClick={() =>
                      setVerificationNote(
                        "DOJ verification submitted for EOIR roster check (example — local state only, nothing was checked or saved)."
                      )
                    }
                    className="mt-3 rounded bg-blue-700 px-3 py-1 text-sm font-semibold text-white"
                  >
                    Submit for roster check (example)
                  </button>
                </div>
              )}

              {isStudent && (
                <div className="mt-4 rounded border border-slate-300 bg-white p-4">
                  <h3 className="font-bold">Law Student verification — supervisor / clinic director</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    The system sends your supervisor / clinic director a 1-click verification link.
                    Your dashboard unlocks only after they confirm. Email sending is NOT connected
                    in this build, so the link is queued — never claimed as sent.
                  </p>
                  <label className="mt-3 block text-sm">
                    <span className="font-medium">Supervisor / clinic director email</span>
                    <input
                      type="email"
                      value={supervisorEmail}
                      onChange={(e) => setSupervisorEmail(e.target.value)}
                      placeholder="supervisor@example.edu"
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setVerificationNote(
                        supervisorEmail.trim()
                          ? `Supervisor verification link queued for ${supervisorEmail.trim()} (example — email sending is not connected, so no email was sent).`
                          : "Enter a supervisor / clinic director email first."
                      )
                    }
                    className="mt-3 rounded bg-blue-700 px-3 py-1 text-sm font-semibold text-white"
                  >
                    Queue supervisor verification link (example)
                  </button>
                </div>
              )}

              {verificationNote && (
                <p className="mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {verificationNote}
                </p>
              )}

              <div className="mt-4 rounded border border-slate-300 bg-white p-4">
                <h3 className="font-bold">Your exclusive tools</h3>
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {role === "attorney" && (
                    <>
                      <li>Form G-28 &amp; EOIR-28 Generator (draft only — never auto-filed)</li>
                      <li>Legal Strategy &amp; RFE/NOID Brief Builder</li>
                      <li>Law Student Supervision Hub (approve students &amp; assign cases)</li>
                      <li>Retainer &amp; Trust/Operating Billing — DRAFT, needs attorney review</li>
                    </>
                  )}
                  {isNonprofit && (
                    <>
                      <li>Form G-28 (DHS/USCIS &amp; NVC)</li>
                      <li>
                        Form EOIR-28 — {eoir28Unlocked ? "unlocked (Full + verified, DEMO preview)" : "LOCKED — requires Full Accreditation + verification (Partial = DHS/USCIS/NVC only)"}
                      </li>
                      <li>Multi-Staff Seat Manager</li>
                      <li>Sliding-Scale / Grant Fee Tracker</li>
                    </>
                  )}
                  {isStudent && (
                    <>
                      <li>Assigned-Cases-Only Queue</li>
                      <li>Clerical Form Drafting &amp; Checklists</li>
                      <li>Translation &amp; Legal Research Notes</li>
                      <li>Submit Draft for Supervisor Review</li>
                    </>
                  )}
                </ul>
              </div>

              {isStudent && (
                <div className="mt-4 rounded border border-red-300 bg-red-50 p-4">
                  <h3 className="font-bold text-red-900">Student guardrails — always on</h3>
                  <ul className="mt-2 list-disc pl-5 text-sm text-red-900">
                    <li>Cannot give independent legal advice.</li>
                    <li>Cannot sign or generate Form G-28 / EOIR-28.</li>
                    <li>Cannot message clients without supervisor visibility.</li>
                    <li>Cannot file directly with USCIS / Court.</li>
                  </ul>
                  <p className="mt-2 text-sm text-red-900">
                    Your drafts need supervisor review + approval before they unlock for client
                    E-Sign / G-28 filing.
                  </p>
                </div>
              )}
            </section>
          )}

          {section === "g28" && !isStudent && (
            <section aria-label="G-28 and EOIR-28 forms">
              <h2 className="text-xl font-bold">G-28 / EOIR-28 Forms</h2>
              <p className="mt-1 text-sm text-slate-600">
                Attorneys and DOJ-accredited nonprofit representatives only — preparers never see
                this. Drafts only: nothing here is filed with USCIS, NVC, or the Court.
              </p>
              {!verified && (
                <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                  {UNVERIFIED_BANNER}
                </p>
              )}
              <div className="mt-4 rounded border border-slate-300 bg-white p-4">
                <label className="block text-sm">
                  <span className="font-medium">Form</span>
                  <select
                    value={g28Form}
                    onChange={(e) =>
                      setG28Form(e.target.value as "G-28 DHS/USCIS" | "G-28 NVC" | "EOIR-28")
                    }
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  >
                    <option value="G-28 DHS/USCIS">Form G-28 — DHS / USCIS</option>
                    <option value="G-28 NVC">Form G-28 — NVC</option>
                    <option value="EOIR-28">Form EOIR-28 — Immigration Court</option>
                  </select>
                </label>
                {g28Form === "EOIR-28" && !eoir28Unlocked && (
                  <p className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900">
                    🔒 EOIR-28 is LOCKED.{" "}
                    {isNonprofit
                      ? "Partial accreditation covers DHS/USCIS & NVC only. EOIR Court tools unlock only with Full Accreditation AND verification."
                      : "Verify your bar credential first — verification is an admin check, not a checkbox."}
                  </p>
                )}
                <label className="mt-3 block text-sm">
                  <span className="font-medium">Client (example)</span>
                  <input
                    type="text"
                    value={g28Client}
                    onChange={(e) => setG28Client(e.target.value)}
                    placeholder="Example Client A"
                    disabled={g28Form === "EOIR-28" && !eoir28Unlocked}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
                  />
                </label>
                <p className="mt-3 text-sm">
                  Status: <strong>{g28Status === "draft" ? "Draft (example — local only)" : "Not started"}</strong>
                </p>
                <button
                  type="button"
                  disabled={g28Form === "EOIR-28" && !eoir28Unlocked}
                  onClick={() => {
                    setG28Status("draft");
                    logDecision(
                      `${g28Form} draft saved for ${g28Client.trim() || "Example Client A"} (example — local state only, not filed, not saved to Supabase)`
                    );
                  }}
                  className="mt-3 rounded bg-blue-700 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Save {g28Form} draft (example)
                </button>
                <p className="mt-2 text-xs text-slate-500">
                  G-28 is the Notice of Entry of Appearance as Attorney or Accredited
                  Representative. A student cannot file or sign it.
                </p>
              </div>

              {role === "attorney" && (
                <div className="mt-4 rounded border border-slate-300 bg-white p-4">
                  <h3 className="font-bold">Legal Strategy &amp; RFE/NOID Brief Builder (attorney only)</h3>
                  <label className="mt-3 block text-sm">
                    <span className="font-medium">Brief type</span>
                    <select
                      value={briefType}
                      onChange={(e) =>
                        setBriefType(e.target.value as "RFE Response" | "NOID Response" | "Legal Strategy Memo")
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="RFE Response">RFE Response</option>
                      <option value="NOID Response">NOID Response</option>
                      <option value="Legal Strategy Memo">Legal Strategy Memo</option>
                    </select>
                  </label>
                  <label className="mt-3 block text-sm">
                    <span className="font-medium">Strategy notes (example, local only)</span>
                    <textarea
                      value={briefNotes}
                      onChange={(e) => setBriefNotes(e.target.value)}
                      rows={4}
                      placeholder="Example strategy notes…"
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      logDecision(`${briefType} draft saved (example — local state only, not filed)`)
                    }
                    className="mt-3 rounded bg-blue-700 px-3 py-1 text-sm font-semibold text-white"
                  >
                    Save {briefType} draft (example)
                  </button>
                </div>
              )}

              {isNonprofit && (
                <>
                  <div className="mt-4 rounded border border-slate-300 bg-white p-4">
                    <h3 className="font-bold">Multi-Staff Seat Manager</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Staff seats under the same organization account. Local state only.
                    </p>
                    <ul className="mt-2 list-disc pl-5 text-sm">
                      {seats.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={seatName}
                        onChange={(e) => setSeatName(e.target.value)}
                        placeholder="Example staff member + role"
                        className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!seatName.trim()) return;
                          setSeats((s) => [...s, seatName.trim()]);
                          logDecision(`Staff seat added: ${seatName.trim()} (example — local state only)`);
                          setSeatName("");
                        }}
                        className="rounded bg-blue-700 px-3 py-1 text-sm font-semibold text-white"
                      >
                        Add seat (example)
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 rounded border border-slate-300 bg-white p-4">
                    <h3 className="font-bold">Sliding-Scale / Grant Fee Tracker</h3>
                    <label className="mt-3 block text-sm">
                      <span className="font-medium">Fee / grant note (example, local only)</span>
                      <textarea
                        value={grantNote}
                        onChange={(e) => setGrantNote(e.target.value)}
                        rows={3}
                        placeholder="Example: sliding-scale fee agreed, grant covers remainder…"
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => logDecision(`Sliding-scale / grant note saved (example — local state only)`)}
                      className="mt-3 rounded bg-blue-700 px-3 py-1 text-sm font-semibold text-white"
                    >
                      Save note (example)
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {section === "supervision" && !isStudent && (
            <section aria-label="Student supervision hub">
              <h2 className="text-xl font-bold">Law Student Supervision Hub</h2>
              <p className="mt-1 text-sm text-slate-600">
                Approve students and assign cases. Every decision below is written to the audit log
                shown at the bottom (example decisions in local state only — live writes go to
                public.audit_log via the server once wired).
              </p>
              <div className="mt-4 rounded border border-slate-300 bg-white p-4">
                <h3 className="font-bold">Confirm-student queue</h3>
                <ul className="mt-2 space-y-2">
                  {confirmQueue.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2 text-sm">
                      <span>
                        <strong>{s.label}</strong> — Status: <strong>{s.status}</strong>
                      </span>
                      {s.status === "pending" && (
                        <span className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmQueue((q) => q.map((x) => (x.id === s.id ? { ...x, status: "confirmed" } : x)));
                              logDecision(`Student confirmed: ${s.label} (example decision — local state only, not saved to Supabase)`);
                            }}
                            className="rounded bg-green-700 px-3 py-1 text-sm font-semibold text-white"
                          >
                            Confirm student
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmQueue((q) => q.map((x) => (x.id === s.id ? { ...x, status: "rejected" } : x)));
                              logDecision(`Student rejected: ${s.label} (example decision — local state only, not saved to Supabase)`);
                            }}
                            className="rounded bg-red-700 px-3 py-1 text-sm font-semibold text-white"
                          >
                            Reject
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 rounded border border-slate-300 bg-white p-4">
                <h3 className="font-bold">Student-draft approval queue</h3>
                <p className="mt-1 text-sm text-slate-600">
                  A student draft unlocks for client E-Sign / G-28 filing only after you approve it
                  here.
                </p>
                <ul className="mt-2 space-y-2">
                  {draftQueue.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2 text-sm">
                      <span>
                        <strong>{d.label}</strong> — Status: <strong>{d.status}</strong>
                      </span>
                      {d.status === "pending_review" && (
                        <span className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDraftQueue((q) => q.map((x) => (x.id === d.id ? { ...x, status: "approved — unlocked for E-Sign" } : x)));
                              logDecision(`Student draft APPROVED: ${d.label} — unlocked for client E-Sign (example decision — local state only)`);
                            }}
                            className="rounded bg-green-700 px-3 py-1 text-sm font-semibold text-white"
                          >
                            Approve draft
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDraftQueue((q) => q.map((x) => (x.id === d.id ? { ...x, status: "changes_requested" } : x)));
                              logDecision(`Student draft changes requested: ${d.label} (example decision — local state only)`);
                            }}
                            className="rounded bg-amber-600 px-3 py-1 text-sm font-semibold text-white"
                          >
                            Request changes
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 rounded border border-slate-300 bg-white p-4">
                <h3 className="font-bold">Audit log (on-screen, example decisions)</h3>
                {auditLog.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-600">
                    No decisions yet. Each Confirm / Reject / Approve / Request-changes decision
                    above appends here — and, once wired, to public.audit_log.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {auditLog.map((entry) => (
                      <li key={entry.id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <span className="text-slate-500">{entry.time} — </span>
                        {entry.text}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          {section === "research" && (
            <section aria-label="Research and memos">
              <h2 className="text-xl font-bold">Research &amp; Memos</h2>
              <p className="mt-1 text-sm text-slate-600">
                {isStudent
                  ? "Translation & legal research notes. Your notes are visible to your supervisor."
                  : "Legal research notes and memos. Local state only."}
              </p>
              <ul className="mt-4 space-y-2">
                {researchNotes.map((n, i) => (
                  <li key={i} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                    {n}
                  </li>
                ))}
              </ul>
              <label className="mt-4 block text-sm">
                <span className="font-medium">Add a research note (example, local only)</span>
                <textarea
                  value={researchNote}
                  onChange={(e) => setResearchNote(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!researchNote.trim()) return;
                  setResearchNotes((n) => [...n, researchNote.trim()]);
                  setResearchNote("");
                }}
                className="mt-2 rounded bg-blue-700 px-3 py-1 text-sm font-semibold text-white"
              >
                Save note (example)
              </button>
            </section>
          )}

          {section === "billing" && !isStudent && (
            <section aria-label="Billing and retainers">
              <h2 className="text-xl font-bold">Billing &amp; Retainers</h2>
              <p className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900">
                DRAFT — trust accounting is regulated and needs attorney review. This is NOT a
                compliant trust ledger. Do not use it as one.
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Retainer and trust/operating billing is a draft workspace only. Client money is
                never held or split by this platform; professionals connect their own Stripe (BYO).
              </p>
              <div className="mt-4 rounded border border-slate-300 bg-white p-4">
                <label className="block text-sm">
                  <span className="font-medium">Retainer amount (example, $)</span>
                  <input
                    type="text"
                    value={retainerAmount}
                    onChange={(e) => setRetainerAmount(e.target.value)}
                    placeholder="e.g. 1500"
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="mt-3 block text-sm">
                  <span className="font-medium">Retainer note (example, local only)</span>
                  <textarea
                    value={retainerNote}
                    onChange={(e) => setRetainerNote(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    logDecision(
                      `Retainer draft saved: $${retainerAmount.trim() || "—"} (DRAFT example — local state only, not a trust ledger)`
                    )
                  }
                  className="mt-3 rounded bg-blue-700 px-3 py-1 text-sm font-semibold text-white"
                >
                  Save retainer draft (example)
                </button>
              </div>
            </section>
          )}

          {section === "student-queue" && isStudent && (
            <section aria-label="Assigned cases only">
              <h2 className="text-xl font-bold">Assigned-Cases-Only Queue</h2>
              <p className="mt-1 text-sm text-slate-600">
                You see only cases explicitly assigned to you by a verified supervisor. Supervisor:{" "}
                <strong>Example Supervisor (attorney)</strong>.
              </p>
              <div className="mt-4 rounded border border-slate-300 bg-white p-4">
                <p className="font-semibold">Example Client A — I-130 (Family Petition)</p>
                <p className="text-sm text-slate-600">Assigned to you. Drafting in progress.</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">Other cases — hidden</p>
                <p className="text-sm text-slate-600">
                  No case details are shown for cases not assigned to you. Only your supervisor can
                  assign a case to you.
                </p>
              </div>
              <div className="mt-4 rounded border border-slate-300 bg-white p-4">
                <h3 className="font-bold">Clerical Form Drafting &amp; Checklists</h3>
                <label className="mt-3 block text-sm">
                  <span className="font-medium">Draft notes (example, local only)</span>
                  <textarea
                    value={studentDraft}
                    onChange={(e) => setStudentDraft(e.target.value)}
                    rows={4}
                    placeholder="Example clerical draft notes…"
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </label>
                <button
                  type="button"
                  disabled={draftSubmitted}
                  onClick={() => {
                    if (!studentDraft.trim()) return;
                    setDraftSubmitted(true);
                    logDecision(
                      "Student draft submitted for supervisor review (example — local state only; no E-Sign unlock until a supervisor approves)"
                    );
                  }}
                  className="mt-3 rounded bg-blue-700 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {draftSubmitted
                    ? "Submitted — waiting for supervisor review"
                    : "Submit Draft for Supervisor Review"}
                </button>
                {draftSubmitted && (
                  <p className="mt-2 text-sm font-semibold text-amber-800">
                    Pending supervisor review. This draft does NOT unlock for client E-Sign or G-28
                    filing until your supervisor approves it.
                  </p>
                )}
              </div>
            </section>
          )}
        </div>
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
