// /doj-dashboard — DOJ-Accredited Nonprofit dashboard (Role 4).
//
// NEW (2026-11-28). Before this page, DOJ-accredited representatives
// shared the generic /back-office and /legal-back-office with
// attorneys, preparers and students behind demo role switchers. This
// page is nonprofit-only content:
//   * I-912 fee-waiver queue (Form I-912, Request for Fee Waiver).
//   * EOIR tracker: the official roster of recognized organizations
//     and accredited representatives, and the partial / full
//     accreditation boundary (partial = DHS/USCIS & NVC only; full =
//     USCIS and Court, including EOIR-28).
//   * Accreditation status (expiry, tier).
//   * Subscription status (Standard $24.50/mo / Full $49.50/mo).
// No I-912 requests, accreditation rows, or cases exist in this
// build's data layer yet — every section shows its honest empty state
// instead of invented rows. Only an accredited representative acts
// within the accreditation.
"use client";

import Link from "next/link";
import EoirRosterLinks from "@/components/EoirRosterLinks";
import AccessStatus from "@/components/paywall/AccessStatus";
import RenewalRadarSection from "@/components/dashboard/RenewalRadarSection";
import FeeWaiverCheckerSection from "@/components/dashboard/FeeWaiverCheckerSection";
import TotalCostEstimatorSection from "@/components/dashboard/TotalCostEstimatorSection";
import VaultExpirySection from "@/components/dashboard/VaultExpirySection";
import {
  LeadsPipelineSummary,
  TodayRemindersBanner,
} from "@/components/dashboard/DashboardEmbeds";
import DashboardTop from "@/components/nextstep/DashboardTop";

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
      {children}
    </p>
  );
}

export default function DojDashboardPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">DOJ Nonprofit Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          DOJ-Accredited Nonprofit — Role 4 (Standard $24.50/mo / Full
          $49.50/mo). Accredited representatives act only within their
          accreditation: Partial covers DHS/USCIS &amp; NVC only; Full
          covers USCIS and Court.
        </p>
      </header>

      {/* Final sweep (Nov 28, 2026): next step first, then checklist,
          one-click actions, deadline countdown, notification inbox. No
          case is assigned on this front-door page, so the next step
          honestly says the route is not set yet. */}
      <div className="mt-6">
        <DashboardTop
          nextStepInput={{ route: null, uscisStage: null, blockingItems: [], language: "en" }}
        />
      </div>

      <section aria-label="Subscription" className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Your subscription — Standard $24.50/mo / Full $49.50/mo</h2>
        <div className="mt-2">
          <AccessStatus surface="interview_prep" />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Your directory listing stays off until the Stripe webhook confirms
          an active subscription AND verification is approved — payment
          alone never turns it on. Full accreditation is a separate
          approval from the Full plan price.
        </p>
      </section>

      <section aria-label="I-912 queue" className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">I-912 Fee-Waiver Queue</h2>
        <p className="mt-1 text-sm text-slate-600">
          Form I-912, Request for Fee Waiver — clients who cannot afford
          the USCIS fee ask for a waiver, with proof of income, benefits,
          or hardship. A waiver is decided by USCIS, never by this
          platform.
        </p>
        <div className="mt-3">
          <Empty>
            No I-912 fee-waiver requests are on file. Requests will appear
            here once clients file Form I-912 through the portal — there
            is no filed-request queue table yet (migration 0029 stores
            guided check results in fee_waiver_checks, not filed
            requests), so this queue cannot be loaded from the database
            today.
          </Empty>
        </div>
        <div className="mt-3">
          <FeeWaiverCheckerSection audience="professional" />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Guided waiver checks a client runs on their dashboard are
          stored in fee_waiver_checks (migration 0029) and their result
          shows above. A check result is never a decision — only USCIS
          decides, and an attorney or DOJ-accredited representative
          should confirm any &ldquo;may qualify&rdquo; result.
        </p>
      </section>

      {/* EXPERT FEATURES, INSIDE THE DASHBOARD (Nov 28, 2026): the
          renewal radar for every client in your pipeline (soonest
          first), the total cost estimate per case, vault expiry
          flags, and the live leads + pipeline summary — on this home
          page, not on separate pages. */}
      <div className="mt-4">
        <TodayRemindersBanner />
      </div>

      <div className="mt-4">
        <LeadsPipelineSummary role="doj" />
      </div>

      <div className="mt-4">
        <RenewalRadarSection renewals={[]} audience="professional" />
      </div>

      <div className="mt-4">
        <TotalCostEstimatorSection audience="professional" />
      </div>

      <div className="mt-4">
        <VaultExpirySection documents={[]} audience="professional" />
      </div>

      <section aria-label="EOIR tracker" className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">EOIR Tracker — Recognized Organizations &amp; Accredited Representatives</h2>
        <p className="mt-1 text-sm text-slate-600">
          Check the official EOIR roster before approving any DOJ
          credential. Partial accreditation = DHS/USCIS &amp; NVC only —
          EOIR Court tools (including EOIR-28) stay locked until Full
          accreditation is verified.
        </p>
        <div className="mt-3">
          <EoirRosterLinks />
        </div>
      </section>

      <section aria-label="Accreditation" className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Your accreditation</h2>
        <div className="mt-3">
          <Empty>
            No accreditation record is loaded for your organization yet.
            Your DOJ recognition date, EOIR number, accreditation tier
            (Partial / Full) and expiry date are on your registration —
            they appear here once the accreditation record is wired to
            the database. Until then, do not claim a tier or an expiry
            date from this page.
          </Empty>
        </div>
        <Link href="/legal-back-office" className="mt-3 inline-block text-sm font-semibold text-blue-700 underline">
          Accreditation tools in the Legal Back Office →
        </Link>
      </section>

      <section aria-label="Case pipeline" className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Your case pipeline</h2>
        <p className="mt-1 text-sm text-slate-600">
          Cases where your organization is the assigned provider
          (cases.assigned_provider_id, role nonprofit), by status.
        </p>
        <div className="mt-3">
          <Empty>
            No cases are assigned to your organization yet. Cases appear
            here once clients choose nonprofit help and you are assigned —
            there is no nonprofit case-list API yet, so this pipeline
            cannot be loaded from the database today.
          </Empty>
        </div>
      </section>

      <section aria-label="Paid tools" className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Paid tools</h2>
        <ul className="mt-2 space-y-2 text-sm">
          <li>
            <Link href="/interview-prep" className="font-semibold text-blue-700 underline">
              Interview Preparation →
            </Link>{" "}
            — mock banks, what to bring, and video scripts for your clients (paid access, checked server-side).
          </li>
          <li>
            <Link href="/portal/smart-forms" className="font-semibold text-blue-700 underline">
              Smart Forms — Dynamic Intake Engine →
            </Link>{" "}
            — the 15-schema intake engine (paid access, checked server-side).
          </li>
        </ul>
      </section>

      <footer className="mt-8 text-xs text-slate-500">
        <Link href="/" className="text-blue-600 underline">← Back to home</Link>
      </footer>
    </main>
  );
}
