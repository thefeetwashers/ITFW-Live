// /attorney-dashboard — Licensed Attorney dashboard (Role 3, $99/mo).
//
// NEW (2026-11-28). Before this page, attorneys shared the generic
// /back-office with preparers, nonprofits, students and admins behind
// a demo role switcher. This page is attorney-only content:
//   * G-28 workspace (the real workspace lives in /legal-back-office;
//     this page links there — G-28 drafts are not duplicated here).
//   * Supervision of law students assigned to this attorney.
//   * The attorney's own case pipeline (cases where this attorney is
//     the assigned provider).
//   * Subscription status ($99/mo, checked server-side via /api/access).
// No real cases, students, or G-28 drafts exist in this build's data
// layer yet — every section shows its honest empty state instead of
// invented rows. Only a licensed attorney gives legal advice.
"use client";

import Link from "next/link";
import AccessStatus from "@/components/paywall/AccessStatus";
import ClientInviteCard from "@/components/pro/ClientInviteCard";
import ReferralCard from "@/components/portal/ReferralCard";
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

export default function AttorneyDashboardPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">Attorney Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Licensed Immigration Attorney — Role 3 ($99/mo). Only a licensed
          attorney gives legal advice or files a G-28. Immigration with
          NIPTEI is not a law firm and is not affiliated with USCIS.
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
        <h2 className="text-base font-semibold">Your subscription — $99/mo</h2>
        <div className="mt-2">
          <AccessStatus surface="interview_prep" />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Your directory listing stays off until the Stripe webhook confirms
          an active subscription AND verification is approved — payment
          alone never turns it on.
        </p>
      </section>

      <section aria-label="G-28 workspace" className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">G-28 Workspace</h2>
        <p className="mt-1 text-sm text-slate-600">
          Notice of Entry of Appearance as Attorney (Form G-28) — attorney
          only. Preparers never see it. Your G-28 drafts live in the Legal
          Back Office; this dashboard links there so drafts are kept in
          one place and never duplicated.
        </p>
        <Link
          href="/legal-back-office"
          className="mt-3 inline-block rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
        >
          Open G-28 Workspace →
        </Link>
        <div className="mt-3">
          <Empty>
            No G-28 drafts are stored on this dashboard. Open the workspace
            above — G-28 drafts are local example state there until the
            workspace is wired to Supabase.
          </Empty>
        </div>
      </section>

      <section aria-label="Supervision" className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Law students you supervise</h2>
        <p className="mt-1 text-sm text-slate-600">
          A law student works supervised only, and sees a case only when
          you — the case&apos;s verified attorney — assign it to them
          (public.case_student_assignments, migration 0004).
        </p>
        <div className="mt-3">
          <Empty>
            No students are assigned to your supervision yet. Students appear
            here once they name you as their supervising attorney at
            registration and a founder verifies them — there is no
            supervision-assignment API yet, so this list cannot be loaded
            from the database today.
          </Empty>
        </div>
        <Link href="/legal-back-office" className="mt-3 inline-block text-sm font-semibold text-blue-700 underline">
          Supervision tools in the Legal Back Office →
        </Link>
      </section>

      <section aria-label="Case pipeline" className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Your case pipeline</h2>
        <p className="mt-1 text-sm text-slate-600">
          Cases where you are the assigned provider
          (cases.assigned_provider_id, role attorney), by status.
        </p>
        <div className="mt-3">
          <Empty>
            No cases are assigned to you yet. Cases appear here once clients
            choose attorney help and you are assigned — there is no
            attorney case-list API yet, so this pipeline cannot be loaded
            from the database today.
          </Empty>
        </div>
      </section>

      {/* EXPERT FEATURES, INSIDE THE DASHBOARD (Nov 28, 2026): the
          renewal radar for every client in your pipeline (soonest
          first), each client's I-912 waiver-check result, the total
          cost estimate per case, vault expiry flags, and the live
          leads + pipeline summary — on this home page, not on
          separate pages. */}
      <div className="mt-4">
        <TodayRemindersBanner />
      </div>

      <div className="mt-4">
        <LeadsPipelineSummary role="attorney" />
      </div>

      <div className="mt-4">
        <RenewalRadarSection renewals={[]} audience="professional" />
      </div>

      <div className="mt-4">
        <FeeWaiverCheckerSection audience="professional" />
      </div>

      <div className="mt-4">
        <TotalCostEstimatorSection audience="professional" />
      </div>

      <div className="mt-4">
        <VaultExpirySection documents={[]} audience="professional" />
      </div>

      {/* Bring your own clients (Nov 28, 2026) — the invitation card
          and the tell-a-friend card sit on this home page itself, not
          in a tab: the preparer home already had them; the attorney
          home did not. Same honest empty states as the preparer home:
          no account id is known on this front-door page, so the
          invite card shows its signed-in prompt and the referral card
          shows 0 referred / 0 became clients until real rows exist.
          Referral reward: to be announced by the founder. */}
      <div className="mt-4">
        <ClientInviteCard invitedBy="" referralCode={null} />
      </div>

      <div className="mt-4">
        <ReferralCard
          leads={[]}
          referrerAccountId={null}
          referralCode={null}
          storefrontSlug={null}
        />
      </div>

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
            — the 15-schema intake engine, preparer-assisted mode included (paid access, checked server-side).
          </li>
        </ul>
      </section>

      <footer className="mt-8 text-xs text-slate-500">
        <Link href="/" className="text-blue-600 underline">← Back to home</Link>
      </footer>
    </main>
  );
}
