// /client-dashboard — Client dashboard (Role 1).
//
// NEW (2026-11-28). The full client workspace lives in /portal; this
// page is the client role's own front door to it: your own cases and
// your next step, in one place, with links into the portal. It does
// NOT duplicate the portal — it summarises it.
//   * Own cases + next step (no case-list API exists yet, so the
//     honest empty state shows and the portal link is the live path).
//   * Membership / payment status (Member $9.80/mo, checked
//     server-side via /api/access).
//   * Paid tools: Interview Preparation and Smart Forms.
//   * EXPERT FEATURES, INSIDE THE DASHBOARD (Nov 28, 2026): Renewal
//     & Expiry Radar, Fee Waiver Checker (I-912), Total Cost
//     Estimator, Document Vault expiry warnings, and the earlier
//     additions embedded as live summaries (Today, DIY, interview
//     question of the day, news, family case, Packet Rescue, case
//     tracker) — all on this home page, not on separate pages.
// No cases are invented here: when nothing is on file, the page says
// so and points to the portal, where the case is created.
"use client";

import Link from "next/link";
import AccessStatus from "@/components/paywall/AccessStatus";
import DashboardTop from "@/components/nextstep/DashboardTop";
import EmergencyHelpSection from "@/components/safety/EmergencyHelpSection";
import JourneyMap from "@/components/journey/JourneyMap";
import ReferralCard from "@/components/portal/ReferralCard";
import RenewalRadarSection from "@/components/dashboard/RenewalRadarSection";
import FeeWaiverCheckerSection from "@/components/dashboard/FeeWaiverCheckerSection";
import TotalCostEstimatorSection from "@/components/dashboard/TotalCostEstimatorSection";
import VaultExpirySection from "@/components/dashboard/VaultExpirySection";
import {
  CaseTrackerSummarySection,
  DiyProgressSummary,
  FamilyCaseSummarySection,
  InterviewQuestionSection,
  NewsAlertsSection,
  PacketRescueSummarySection,
  TodayRemindersBanner,
} from "@/components/dashboard/DashboardEmbeds";

export default function ClientDashboardPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">My Cases</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your cases, your next step, and your paid tools — in one place.
          Your full workspace is the Client Portal.
        </p>
      </header>

      {/* Emergency help (Nov 28, 2026): the hotlines the platform
          already cites, on the dashboard home where a client in
          danger will actually see them. Numbers are locked in
          src/lib/safety.ts — copied from the public site, never
          invented. */}
      <EmergencyHelpSection />

      {/* Final sweep (Nov 28, 2026): next step first, then the colour-coded
          checklist, one-click actions, deadline countdown, and the
          notification inbox — in that order. No case is open on this
          front-door page, so the next step honestly says the route is
          not set yet and the checklist shows its empty state. */}
      <div className="mt-6">
        <DashboardTop
          nextStepInput={{ route: null, uscisStage: null, blockingItems: [], language: "en" }}
        />
      </div>

      {/* Eleventh addition (Nov 28, 2026): the Immigration Journey Map
          is the home screen of this dashboard. No case is open on this
          front-door page, so the map honestly shows its empty state
          (no invented journey) and points to the portal, where the
          case is created and the map fills in from the real case file. */}
      <div className="mt-6">
        <JourneyMap map={null} />
      </div>

      {/* Tell-a-friend: your referral link, on your dashboard home.
          No referral rows are loaded on this front-door page, so the
          card shows 0 / 0 with the honest empty state and the reward
          "to be announced by the founder" — no amount invented. */}
      <div className="mt-6">
        <ReferralCard
          leads={[]}
          referrerAccountId={null}
          referralCode={null}
          storefrontSlug={null}
        />
      </div>

      {/* EXPERT FEATURES, INSIDE THE DASHBOARD (Nov 28, 2026): Renewal
          & Expiry Radar, Fee Waiver Checker (I-912), Total Cost
          Estimator, and Document Vault expiry warnings — all on this
          home page, not on separate pages. Plus the earlier additions
          embedded as live summaries: Today reminders, DIY progress,
          interview question of the day, news alerts, family case,
          Packet Rescue, and the case tracker. No rows are invented:
          with nothing on file each section shows its honest empty
          state. */}
      <div className="mt-4">
        <TodayRemindersBanner />
      </div>

      <div className="mt-4">
        <RenewalRadarSection renewals={[]} audience="client" />
      </div>

      <div className="mt-4">
        <FeeWaiverCheckerSection audience="client" />
      </div>

      <div className="mt-4">
        <TotalCostEstimatorSection audience="client" />
      </div>

      <div className="mt-4">
        <VaultExpirySection documents={[]} audience="client" />
      </div>

      <div className="mt-4">
        <DiyProgressSummary />
      </div>

      <div className="mt-4">
        <InterviewQuestionSection />
      </div>

      <div className="mt-4">
        <NewsAlertsSection />
      </div>

      <div className="mt-4">
        <FamilyCaseSummarySection />
      </div>

      <div className="mt-4">
        <PacketRescueSummarySection />
      </div>

      <div className="mt-4">
        <CaseTrackerSummarySection />
      </div>

      <section aria-label="Membership" className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Your membership — Member $9.80/mo or $98/yr</h2>
        <div className="mt-2">
          <AccessStatus surface="interview_prep" />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Membership and bundle purchases unlock Interview Preparation and
          Smart Forms. USCIS government fees are separate and are never
          part of these payments.
        </p>
      </section>

      <section aria-label="Own cases" className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Your cases</h2>
        <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          Your daily home is the Today screen — your cases at a glance,
          today&apos;s next step, what changed today, and your timelines.
        </p>
        <Link
          href="/today"
          className="mt-3 inline-block rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
        >
          Open Today →
        </Link>{" "}
        <Link
          href="/portal"
          className="mt-3 inline-block rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800"
        >
          Open the Client Portal →
        </Link>
      </section>

      <section aria-label="Next step" className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Your next step</h2>
        <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          Your next step is on the Today screen, computed from your
          case&apos;s stage and its blocking items. The usual first steps
          are: finish the questionnaire, upload the blocking documents,
          and pay the first instalment if you chose a payment plan.
        </p>
        <Link href="/today" className="mt-3 inline-block rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
          See today&apos;s next step →
        </Link>{" "}
        <Link href="/portal/questionnaire" className="mt-3 inline-block text-sm font-semibold text-blue-700 underline">
          Open the Questionnaire →
        </Link>
      </section>

      <section aria-label="Paid tools" className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Your paid tools</h2>
        <ul className="mt-2 space-y-2 text-sm">
          <li>
            <Link href="/interview-prep" className="font-semibold text-blue-700 underline">
              Interview Preparation →
            </Link>{" "}
            — mock question banks (N-400 civics + personal, I-485,
            consular), what to bring, how to conduct yourself, and video
            scripts. Paid access, checked server-side.
          </li>
          <li>
            <Link href="/portal/smart-forms" className="font-semibold text-blue-700 underline">
              Smart Forms — Dynamic Intake Engine →
            </Link>{" "}
            — answer the questions for your form; only your form&apos;s
            sections, timeline checks, and document slots load. Paid
            access, checked server-side.
          </li>
          <li>
            <Link href="/portal/packet-audit" className="font-semibold text-blue-700 underline">
              Packet Audit →
            </Link>{" "}
            — filing readiness, computed from your checklist (example data
            in this build; real audit loads once Supabase is wired).
          </li>
        </ul>
      </section>

      <footer className="mt-8 text-xs text-slate-500">
        <Link href="/" className="text-blue-600 underline">← Back to home</Link>
      </footer>
    </main>
  );
}
