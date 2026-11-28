"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PortalShell, { type PortalViewAs } from "@/components/portal/PortalShell";
import TranslationOrders from "@/components/portal/TranslationOrders";
import CoSponsorInviteCard from "@/components/portal/CoSponsorInviteCard";
import { CaseChat, InterviewPrep } from "@/components/portal/CaseChat";
import InstantAnswerChat from "@/components/copilot/InstantAnswerChat";
import RoleCheatsheet from "@/components/cheatsheets/RoleCheatsheet";
import AskNipteiChat from "@/components/copilot/AskNipteiChat";
import UnifiedThread from "@/components/comms/UnifiedThread";
import TierSummary from "@/components/comms/TierSummary";
import PermissionsPanel from "@/components/comms/PermissionsPanel";
import {
  OrderSummary,
  ProcessRoadmap,
  FormsIncluded,
} from "@/components/portal/OrderSections";
import GuestInviteCard from "@/components/portal/GuestInviteCard";
import LifecyclePipeline from "@/components/LifecyclePipeline";
import MailVault from "@/components/portal/MailVault";
import ComplianceTrail from "@/components/portal/ComplianceTrail";
import CeacTracker from "@/components/portal/CeacTracker";
import ReviewsSection from "@/components/portal/ReviewsSection";
import RenewalsSection from "@/components/portal/RenewalsSection";
import FeeWaiverCheckerSection from "@/components/dashboard/FeeWaiverCheckerSection";
import TotalCostEstimatorSection from "@/components/dashboard/TotalCostEstimatorSection";
import VaultExpirySection from "@/components/dashboard/VaultExpirySection";
import InterviewMedicalCard from "@/components/portal/InterviewMedicalCard";
import ReferralCard from "@/components/portal/ReferralCard";
import ServiceCatalog from "@/components/portal/ServiceCatalog";
import NvcDualTrackChecklist from "@/components/portal/NvcDualTrackChecklist";
import InterviewReadinessTracker from "@/components/portal/InterviewReadinessTracker";
import PostArrivalTracker from "@/components/portal/PostArrivalTracker";
import DeadlineRadar from "@/components/portal/DeadlineRadar";
import TranslationPhotoTracker from "@/components/portal/TranslationPhotoTracker";
import FamilyTreeRoster from "@/components/portal/FamilyTreeRoster";
import CaseCommandPanel from "@/components/nextstep/CaseCommandPanel";
import OneClickActions from "@/components/nextstep/OneClickActions";
import NotificationInbox from "@/components/nextstep/NotificationInbox";
import {
  EXAMPLE_CASE,
  EXAMPLE_CHECKLIST,
  EXAMPLE_PRIORITY_ACTIONS,
  EXAMPLE_PROVIDER,
  EXAMPLE_SMART_FORMS,
  EXAMPLE_USCIS,
} from "@/lib/example-data";
import { validateTimeline, EXAMPLE_TIMELINE } from "@/lib/validator";
import { computePacketReadiness, EXAMPLE_AUDIT_ITEMS } from "@/lib/audit";
import { NUDGE_INTERVAL_HOURS, EXAMPLE_NUDGE, shouldNudge } from "@/lib/nudges";
import VisaBulletinMatcher from "@/components/portal/VisaBulletinMatcher";
import SmartIntakeCalculator from "@/components/SmartIntakeCalculator";
import { getSupabase } from "@/lib/supabase";

const STEPS = ["Intake", "Docs", "Drafting", "E-Sign", "USCIS Filed"] as const;

const PRIORITY_ICONS: Record<string, string> = {
  "action-gap": "[!]",
  "action-bank2": "[!]",
  "action-sign": "[✍]",
};

export default function PortalPage() {
  const [viewAs, setViewAs] = useState<PortalViewAs>("preparer");
  // Honest live check: getSupabase() returns null when env vars are unset.
  const isLive = useMemo(() => getSupabase() !== null, []);
  // Landing from /api/confirm-intake-order: /portal?caseId=...
  // The case id is shown, never claimed as loaded: this page still
  // shows EXAMPLE data until Supabase is wired, and the invoice +
  // checklist for the new case load here once it is.
  const [landedCaseId, setLandedCaseId] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("caseId");
    if (id) setLandedCaseId(id);
  }, []);

  // Computed, not hardcoded: gap label + readiness score come from the libs.
  const timeline = useMemo(() => validateTimeline(EXAMPLE_TIMELINE), []);
  const gapLabel =
    timeline.gaps.find((g) => g.kind === "address")?.label ??
    timeline.gaps[0]?.label ??
    "No gaps found";
  const readiness = useMemo(
    () => computePacketReadiness(EXAMPLE_AUDIT_ITEMS),
    []
  );
  const approvedCount = EXAMPLE_CHECKLIST.filter(
    (i) => i.status === "accepted"
  ).length;
  const nudgeCheck = shouldNudge({
    actionItemCleared: false,
    notificationPreference: "sms",
    optedOutSms: false,
    nextDueAt: EXAMPLE_NUDGE.nextDueAt,
  });

  return (
    <PortalShell
      active="nav-home"
      viewAs={viewAs}
      onViewAsChange={setViewAs}
      isLive={isLive}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main column — 68% */}
        <div className="space-y-4 lg:col-span-2">
          <h1 className="text-xl font-bold">
            Client Portal — Form I-130 (Family Petition)
          </h1>
          <p className="text-sm text-slate-600">{EXAMPLE_CASE.statusLine}</p>
          {/* Daily home — the screen clients land on every day: status at
              a glance, today's next step, what changed today, reminders,
              the interview question of the day, and everything saved. */}
          <p className="text-sm">
            <Link
              href="/today"
              className="font-semibold text-blue-700 underline"
            >
              Today — your daily home: what changed, what is next, and what you saved →
            </Link>
          </p>
          {landedCaseId && (
            <p className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm font-semibold text-green-900">
              Your new application was started — case {landedCaseId}. Your
              invoice and document checklist load here once Supabase is
              connected; until then this page still shows EXAMPLE data.
              No payment was taken — Stripe checkout is NOT connected.
            </p>
          )}

          {/* Start here — client cheatsheet: first 5 things to do, in order. */}
          <RoleCheatsheet role="client" compact />

          {/* Final sweep (Nov 28, 2026): next step FIRST. The
              CaseCommandPanel (next step -> colour checklist -> payment)
              now leads the main column, ahead of the order summary and
              the new-application calculator, so a returning client sees
              what to do next before anything else. */}
          <CaseCommandPanel
            role="client"
            route="inside_us"
            clientLanguage="es"
            showComms={false}
            canEditRoute={false}
            guide="client"
          />

          {/* One-click actions: draft email (preview only), send status
              update, open chat, open checklist. No real case id is
              loaded in this example build, so the two write actions
              honestly say they need an open case. */}
          <OneClickActions caseLabel="Form I-130 — Family Petition (EXAMPLE)" />

          {/* ADDITION 1 — Order, Invoice & Process Roadmap (above tracker) */}
          <OrderSummary />
          <ProcessRoadmap />
          <FormsIncluded />

          {/* Smart Guided Intake — start a NEW application. Prefer the
              guided sequence? Start at /intake: Path Finder → fee
              estimate → checklist preview (first 2 free) → register →
              pay → case created. */}
          <p className="text-sm">
            <Link
              href="/intake"
              className="font-semibold text-blue-700 underline"
            >
              Guided intake — Path Finder → fee estimate → checklist preview → register → pay →
            </Link>
          </p>
          <SmartIntakeCalculator />

          {/* Unified layer — what this tier includes, in plain English. */}
          <TierSummary tier="standard" serviceLabel="Family Adjustment Bundle (I-130 & I-485)" clientLanguage="es" />
          <PermissionsPanel role="client" tierLabel="Standard — $1,799" />

          {/* Lifecycle — read-only guidance (EXAMPLE case is drafting). */}
          <LifecyclePipeline
            currentStage="active_client"
            readOnly
            caseLabel="Your case (EXAMPLE): Form I-130 — Family Petition. Your provider is currently drafting your forms."
          />

          {/* 4. CASE & USCIS STATUS TRACKER — example data, not a live lookup.
            Live USCIS lookup needs the Production key + worker (NOT built). */}
          <section
            aria-labelledby="tracker-heading"
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h2 id="tracker-heading" className="text-base font-semibold">
              4. Case &amp; USCIS Status Tracker (example — not a live lookup)
            </h2>
            <ol className="mt-3 flex flex-wrap items-center gap-1 text-sm">
              {STEPS.map((step, i) => {
                const done = i < EXAMPLE_CASE.currentStepIndex;
                const current = i === EXAMPLE_CASE.currentStepIndex;
                return (
                  <li key={step} className="flex items-center gap-1">
                    <span
                      className={
                        done
                          ? "text-green-700"
                          : current
                            ? "text-amber-600"
                            : "text-slate-400"
                      }
                    >
                      {done ? "●" : current ? "◐" : "○"} {step}
                    </span>
                    {i < STEPS.length - 1 && (
                      <span className="text-slate-300">—</span>
                    )}
                  </li>
                );
              })}
            </ol>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="font-semibold">USCIS Receipt # (EXAMPLE):</dt>
                <dd>{EXAMPLE_USCIS.receiptNumber}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold">Status (EXAMPLE):</dt>
                <dd>{EXAMPLE_USCIS.status}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold">Next Deadline (EXAMPLE):</dt>
                <dd>{EXAMPLE_USCIS.nextDeadline}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-slate-500">{EXAMPLE_USCIS.note}</p>
          </section>

          {/* NVC & Consular Processing — CEAC 6-step tracker (Part 2) */}
          <CeacTracker />

          {/* Interview & Medical Exam appointments — consular cases only.
              The example case here is inside-US (adjustment), so the card
              is blank: no date is invented, every date is entered or left
              blank. Reminders 24h + 1h are queued, not sent. */}
          <InterviewMedicalCard appointment={null} />

          {/* Your renewals — derived from REAL expiry dates only. No
              renewal dates are on file for the example case, so the
              section shows its honest empty state. The fuller Renewal
              & Expiry Radar (advance parole + visa, 180/90/30/7-day
              ladder, locked prep prices) lives on the Client Dashboard
              home — see /client-dashboard. */}
          <RenewalsSection renewals={[]} />

          {/* EXPERT FEATURES, INSIDE THE DASHBOARD (Nov 28, 2026):
              the Fee Waiver Checker, Total Cost Estimator, and Vault
              expiry warnings also live on the Client Dashboard home —
              they are embedded here too so a client working in the
              portal never has to hunt for them. */}
          <FeeWaiverCheckerSection audience="client" />
          <TotalCostEstimatorSection audience="client" />
          <VaultExpirySection documents={[]} audience="client" />

          {/* Reviews — real rows only. No real reviews exist for the
              example case, so the honest empty state shows. The example
              case is still drafting (not stage 6), so the review prompt
              below says reviews open only after the case closes. */}
          <ReviewsSection
            reviews={[]}
            professionalName={EXAMPLE_PROVIDER.name}
            caseClosed={false}
          />

          {/* Refer a Family — counts from REAL referral rows only. No
              referral rows are loaded in this example build, so the card
              shows 0 / 0 with the honest empty state and the reward
              "to be announced by the founder". */}
          <ReferralCard
            leads={[]}
            referrerAccountId={null}
            referralCode={null}
            storefrontSlug={null}
          />

          {/* 2. PRIORITY ACTION ITEMS */}
          <section
            aria-labelledby="priority-heading"
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h2 id="priority-heading" className="text-base font-semibold">
              5. Priority Action Items (Blocking Your Filing)
            </h2>
            <ul className="mt-3 space-y-3">
              {EXAMPLE_PRIORITY_ACTIONS.map((a) => {
                const isGap = a.id === "action-gap";
                const inner = (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {PRIORITY_ICONS[a.id] ?? "[!]"} {a.title}
                      </p>
                      <span className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                        {a.cta}
                      </span>
                    </div>
                    {isGap && (
                      <p className="mt-1 text-sm font-semibold text-red-700">
                        Computed gap: {gapLabel} — validated from your
                        5-year timeline (validateTimeline). Coverage:{" "}
                        {timeline.coveragePercent}%.
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      Reminder: text every {NUDGE_INTERVAL_HOURS}h until
                      cleared — nudge logic ready, sending needs Twilio (not
                      connected, no message actually sent). Nudge check:{" "}
                      {nudgeCheck.reason}
                    </p>
                  </>
                );
                const cls = isGap
                  ? "block rounded-lg border-2 border-red-600 bg-red-50 p-3"
                  : "block rounded-lg border border-slate-200 p-3 hover:bg-slate-50";
                return (
                  <li key={a.id}>
                    {a.href === "/portal/questionnaire" ||
                    a.href === "/portal/packet-audit" ? (
                      <Link href={a.href} className={cls}>
                        {inner}
                      </Link>
                    ) : (
                      <div className={cls} role="group">
                        {inner}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* 3. SMART FORMS & CHECKLISTS */}
          <section
            aria-labelledby="forms-heading"
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h2 id="forms-heading" className="text-base font-semibold">
              6. Smart Forms &amp; Checklists — Packet Readiness:{" "}
              {readiness.score}% (computed)
            </h2>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-green-600"
                style={{ width: `${readiness.score}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Score computed by computePacketReadiness: {readiness.earnedWeight}
              / {readiness.totalWeight} weight passed. Filing is not ready
              until 100% and all blocking items are cleared.{" "}
              <Link href="/portal/packet-audit" className="underline">
                Open Packet Audit →
              </Link>
            </p>

            <h3 className="mt-4 text-sm font-semibold">Smart Forms</h3>
            <ul className="mt-2 space-y-2">
              {EXAMPLE_SMART_FORMS.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{f.label}</span>
                  <span>
                    {f.pct}% Complete{" "}
                    {f.state === "Complete"
                      ? "✓"
                      : f.state === "1 Gap Found"
                        ? "— 1 Gap Found !"
                        : `— ${f.state}`}
                  </span>
                  {f.id === "sf-address" && (
                    <Link
                      href="/portal/questionnaire"
                      className="rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-white"
                    >
                      Fix in Questionnaire →
                    </Link>
                  )}
                </li>
              ))}
            </ul>

            <h3 className="mt-4 text-sm font-semibold">
              Required Documents &amp; Translations
            </h3>
            <ul className="mt-2 space-y-2 text-sm">
              <li className="rounded border border-slate-200 px-3 py-2">
                Passport Bio Page — <strong>Approved ✓</strong>
              </li>
              <li className="rounded border border-slate-200 px-3 py-2">
                Birth Certificate (Foreign) — <strong>Approved ✓</strong> +{" "}
                <strong>Certified Translation ✓</strong>
              </li>
              <li className="rounded border border-slate-200 px-3 py-2">
                Passport Photos (2x2) —{" "}
                <span className="font-semibold">Upload or Take Selfie →</span>{" "}
                <span className="text-xs text-slate-500">
                  (Example only — no upload is live in this build.)
                </span>
              </li>
            </ul>

            <div className="mt-4">
              <h3 className="text-sm font-semibold">
                Certified Translations — Order
              </h3>
              <div className="mt-2">
                <TranslationOrders />
              </div>
            </div>

            <h3 className="mt-4 text-sm font-semibold">
              Document Checklist — {approvedCount} of {EXAMPLE_CHECKLIST.length}{" "}
              Approved (counted from the checklist data)
            </h3>
            <ul className="mt-2 space-y-2 text-sm">
              {EXAMPLE_CHECKLIST.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2"
                >
                  <span className="font-medium">{item.label}</span>
                  <span>
                    {item.status === "accepted" && "Approved ✓"}
                    {item.status === "under_review" && "Under Review"}
                    {item.status === "retake_requested" &&
                      "Retake Requested — re-upload needed"}
                    {item.status === "uploaded" && "Uploaded"}
                    {item.note ? ` — ${item.note}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-slate-500">
              Note: the checklist data has {approvedCount} items with status
              “accepted”; the Birth Certificate is under review and the Joint
              Bank Statement needs a retake. The brief said “5 of 6
              Approved” but the data gives 4 of 6, so the computed 4 of 6 is
              shown — not 5 of 6. Founder decision: which item should count
              as approved to make 5 of 6? (See DEPLOY.md §13.)
            </p>
          </section>

          {/* Sponsor (I-864) — Founder check #4 */}
          <CoSponsorInviteCard />

          {/* Document Vault — guest upload invites (Layer 2) */}
          <section id="document-vault" aria-labelledby="vault-heading">
            <h2 id="vault-heading" className="sr-only">
              Document Vault
            </h2>
            <GuestInviteCard />
          </section>

          {/* Layer 3 — Mail & USCIS Receipt Proof Vault */}
          <MailVault />

          {/* Layer 4 — Compliance, Security & Audit Trail */}
          <ComplianceTrail />

          {/* Part 2 — Service catalog + consular modules */}
          <ServiceCatalog />
          {/* Visa Bulletin priority-date matcher — cutoffs entered by the
              preparer from the official bulletin; no bulletin entered yet
              means the section says so and checks nothing. */}
          <VisaBulletinMatcher />
          <NvcDualTrackChecklist />
          <InterviewReadinessTracker />
          <PostArrivalTracker />
          <DeadlineRadar />
          <TranslationPhotoTracker />
          <FamilyTreeRoster />

          {/* Attorney-only section (hidden in preparer view) */}
          {viewAs === "attorney" && (
            <section
              aria-labelledby="attorney-tools-heading"
              className="rounded-lg border border-blue-300 bg-blue-50 p-4 shadow-sm"
            >
              <h2 id="attorney-tools-heading" className="text-base font-semibold">
                Legal advice tools (attorney only)
              </h2>
              <p className="mt-1 text-sm text-slate-700">
                Shown only in the Licensed Attorney example view. A preparer
                never sees this section.
              </p>
              <Link
                href="/back-office"
                className="mt-2 inline-block rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
              >
                G-28 Workspace →
              </Link>
              <p className="mt-2 text-xs text-slate-500">
                Example link only — the G-28 workspace lives in the back
                office (attorney / nonprofit roles) and is local example
                state in this build.
              </p>
            </section>
          )}
        </div>

        {/* Right panel — 32% */}
        <aside className="space-y-4">
          <section
            aria-labelledby="team-heading"
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h2 id="team-heading" className="text-base font-semibold">
              Case Team
            </h2>
            <div className="mt-3 flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-lg font-bold text-white"
              >
                JD
              </span>
              <div>
                <p className="font-semibold">{EXAMPLE_PROVIDER.name}</p>
                <p className="text-xs text-slate-500">(EXAMPLE name)</p>
                <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                  {EXAMPLE_PROVIDER.badge.label}
                </span>
              </div>
            </div>
            <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              <strong>Compliance Notice:</strong> Non-attorney clerical prep
              only. No legal advice or G-28.
            </p>
            <p className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
              <strong>Clear Fee Separation:</strong> Preparer service fee
              vs. USCIS government filing fees. Service fees pay for
              preparation help only; USCIS fees are paid separately to the
              U.S. Department of Homeland Security and are never combined
              into the service total.
            </p>
            <button
              type="button"
              className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              onClick={() =>
                alert("Example only — agreement download is a placeholder until the signed-agreement vault is wired.")
              }
            >
              Download Signed Service Agreement (PDF)
            </button>
            <p className="mt-1 text-xs text-slate-500">
              Example button — agreement download is a placeholder until the
              signed-agreement vault is wired.
            </p>
            <p className="mt-2 text-sm">
              Assigned Law Student (if any):{" "}
              <strong>{EXAMPLE_PROVIDER.assistedBy} (Supervised by Esq.)</strong>{" "}
              — EXAMPLE name
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                onClick={() =>
                  document
                    .getElementById("chat-draft")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
              >
                Message Team
              </button>
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                onClick={() =>
                  alert("Example only — booking is not connected in this build. No video call is started here.")
                }
              >
                Book a call / office visit
              </button>
            </div>
          </section>

          {/* Ask NIPTEI copilot — non-AI FAQ answers in this build
              (OpenRouter NOT connected); wired to the packet audit +
              5-year timeline computed above. */}
          <div className="mt-4">
            <AskNipteiChat
              context="client"
              caseId="example-case-1"
              auditItems={EXAMPLE_AUDIT_ITEMS}
              timelineGaps={timeline.gaps}
            />
          </div>

          <section
            aria-labelledby="chat-heading"
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h2 id="chat-heading" className="text-base font-semibold">
              Direct Case Chat &amp; Payment Updates
            </h2>
            <div className="mt-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <p className="text-xs font-semibold">
                System (example) · Payment update
              </p>
              <p>
                Payment received — invoice INV-2049-2, $599.67 (example).
                Balance remaining: $599.66. No payment on Nov 19, 2026 is
                real.
              </p>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Shared Supabase state — realtime subscription to be enabled.
              Portal and back-office read the same tables (cases, documents,
              invoices, payment_plans, service_orders / order_invoices,
              messages, case_shipments_and_notices, audit_log). Chat here is
              local demo state until wired to the messages table + Twilio
              (not connected).
            </p>
            <div className="mt-3">
              <CaseChat />
            </div>
            {/* Instant-answer chat — ask in the case chat, the system
                answers right now from the locked guides (no waiting for
                a person). Unknown / legal questions are flagged to the
                professional in the unified thread below. */}
            <div className="mt-3">
              <InstantAnswerChat caseId="example-case-1" viewerRole="client" />
            </div>
            <div className="mt-3">
              <UnifiedThread
                caseId="example-case-1"
                caseLabel="Form I-130 — Family Petition (EXAMPLE)"
                viewerRole="client"
                viewerName="You (Example Client)"
                clientLanguage="es"
              />
            </div>
            {/* Final sweep (Nov 28, 2026): notification inbox — every
                stored status / email / message event in one place. */}
            <div className="mt-3">
              <NotificationInbox />
            </div>
          </section>

          <section
            aria-labelledby="packet-heading"
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h2 id="packet-heading" className="text-base font-semibold">
              Interview Prep &amp; Final Packet Download
            </h2>
            <button
              type="button"
              disabled
              className="mt-3 w-full cursor-not-allowed rounded bg-slate-300 px-3 py-2 text-sm font-semibold text-slate-600"
              title="Locked until filing"
            >
              🔒 Unlocks at Filing — Download Complete Copy of Submitted USCIS
              Packet (PDF)
            </button>
            <p className="mt-1 text-xs text-slate-500">
              Locked until filing. No packet has been submitted in this
              example.
            </p>
            <div className="mt-4 border-t border-slate-200 pt-3">
              <InterviewPrep />
            </div>
          </section>
        </aside>
      </div>
    </PortalShell>
  );
}
