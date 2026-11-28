// Document Preparer Command Center — client-side composition.
// Preparer role only. All data on this page is example data until
// Supabase is connected; the banner in the page states that.
"use client";

import { useState } from "react";
import ClientIdentityCard from "@/components/preparer/ClientIdentityCard";
import BillingPipeline from "@/components/preparer/BillingPipeline";
import AgencyNumberHub from "@/components/preparer/AgencyNumberHub";
import FamilyInviteManager from "@/components/preparer/FamilyInviteManager";
import ComplianceGuardrails from "@/components/preparer/ComplianceGuardrails";
import AgencyChecklists from "@/components/preparer/AgencyChecklists";
import LeadSheet from "@/components/preparer/LeadSheet";
import LeadLifecycle from "@/components/preparer/LeadLifecycle";
import LeadFollowUp from "@/components/preparer/LeadFollowUp";
import DailyCommand from "@/components/preparer/DailyCommand";
import CaseTodoNotes from "@/components/preparer/CaseTodoNotes";
import RfeTracker from "@/components/preparer/RfeTracker";
import MissingItemsTracker from "@/components/preparer/MissingItemsTracker";
import InvoiceActions from "@/components/preparer/InvoiceActions";
import BusinessToolsPanel from "@/components/preparer/BusinessToolsPanel";
import AppointmentsRenewals from "@/components/preparer/AppointmentsRenewals";
import ReferralCard from "@/components/portal/ReferralCard";
import PreparerProfileCard from "@/components/preparer/PreparerProfileCard";
import CommunicationHubPreparer from "@/components/preparer/CommunicationHubPreparer";
import DashboardEmailComposer from "@/components/comms/DashboardEmailComposer";
import AttorneyHandoff from "@/components/preparer/AttorneyHandoff";
import StudentSupervisionGuardrail from "@/components/preparer/StudentSupervisionGuardrail";
import VisaBulletinManager from "@/components/preparer/VisaBulletinManager";
import TemplateVerification from "@/components/admin/TemplateVerification";
import { UplBadge } from "@/components/preparer/UplBadge";
import CeacTracker from "@/components/portal/CeacTracker";
import ServiceCatalog from "@/components/portal/ServiceCatalog";
import NvcDualTrackChecklist from "@/components/portal/NvcDualTrackChecklist";
import InterviewReadinessTracker from "@/components/portal/InterviewReadinessTracker";
import PostArrivalTracker from "@/components/portal/PostArrivalTracker";
import DeadlineRadar from "@/components/portal/DeadlineRadar";
import TranslationPhotoTracker from "@/components/portal/TranslationPhotoTracker";
import TranslationOrders from "@/components/portal/TranslationOrders";
import FamilyTreeRoster from "@/components/portal/FamilyTreeRoster";
import UnifiedThread from "@/components/comms/UnifiedThread";
import PermissionsPanel from "@/components/comms/PermissionsPanel";
import CaseCommandPanel from "@/components/nextstep/CaseCommandPanel";
import OneClickActions from "@/components/nextstep/OneClickActions";
import NotificationInbox from "@/components/nextstep/NotificationInbox";
import AskNipteiChat from "@/components/copilot/AskNipteiChat";
import AskNipteiByoSettings from "@/components/copilot/AskNipteiByoSettings";
import GoogleConnectionsPanel from "@/components/google/GoogleConnectionsPanel";
import ClientInviteCard from "@/components/pro/ClientInviteCard";
import RenewalRadarSection from "@/components/dashboard/RenewalRadarSection";
import FeeWaiverCheckerSection from "@/components/dashboard/FeeWaiverCheckerSection";
import TotalCostEstimatorSection from "@/components/dashboard/TotalCostEstimatorSection";
import VaultExpirySection from "@/components/dashboard/VaultExpirySection";
import {
  LeadsPipelineSummary,
  TodayRemindersBanner,
} from "@/components/dashboard/DashboardEmbeds";

type TabId = "command" | "leads" | "visa" | "profile" | "communicate" | "escalate";

const TABS: { id: TabId; label: string }[] = [
  { id: "command", label: "Command Center" },
  { id: "leads", label: "Lead Sheet" },
  { id: "visa", label: "Visa Bulletin & Templates" },
  { id: "profile", label: "My Public Profile" },
  { id: "communicate", label: "Communication Hub" },
  { id: "escalate", label: "Escalation & Handoff" },
];

export default function PreparerDashboard() {
  const [tab, setTab] = useState<TabId>("command");

  return (
    <div className="space-y-6">
      <UplBadge />
      <div role="tablist" aria-label="Preparer dashboard sections" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={
              "rounded-lg border px-4 py-2 text-sm font-medium " +
              (tab === t.id
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-blue-400")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "command" ? (
        <div className="space-y-6">
          {/* Final sweep (Nov 28, 2026): next step FIRST. The
              CaseCommandPanel (next step -> colour checklist -> payment)
              now leads this tab; the thread, Daily Command and
              permissions follow it instead of burying it. */}
          <CaseCommandPanel
            role="preparer"
            route="outside_us"
            clientLanguage="es"
            showDailyCommand={false}
            showComms={false}
            canEditRoute
            guide="professional"
          />
          {/* One-click actions + notification inbox, beside the panel.
              No real case id exists in this example build, so the
              draft-email / status-update actions honestly say they need
              an open case instead of posting against the example id;
              chat and checklist links work. Pass a real case id here
              once the command tab loads a real case. */}
          <OneClickActions caseLabel="Example Client A — I-130 (EXAMPLE — no real case id yet)" />
          <NotificationInbox />
          {/* EXPERT FEATURES, INSIDE THE DASHBOARD (Nov 28, 2026) —
              on the Command Center tab itself (the default tab), never
              hidden in a submenu: Renewal & Expiry Radar for every
              client in the pipeline (soonest first), the I-912 fee
              waiver check result per client, the Total Cost Estimator
              per case, vault expiry flags, and the live leads +
              pipeline summary. No rows are invented: with nothing on
              file each section shows its honest empty state. */}
          <TodayRemindersBanner />
          <LeadsPipelineSummary role="preparer" />
          <RenewalRadarSection renewals={[]} audience="professional" />
          <FeeWaiverCheckerSection audience="professional" />
          <TotalCostEstimatorSection audience="professional" />
          <VaultExpirySection documents={[]} audience="professional" />
          <PermissionsPanel role="preparer" />
          <UnifiedThread
            caseId="example-case-1"
            caseLabel="Example Client A — I-130 (EXAMPLE)"
            viewerRole="preparer"
            viewerName="You (Document Preparer)"
            clientLanguage="es"
          />
          <DailyCommand />
          <ClientIdentityCard />
          <CaseTodoNotes />
          <RfeTracker />
          <MissingItemsTracker />
          <BillingPipeline />
          <InvoiceActions />
          {/* Business tools (Nov 28, 2026) — own-Stripe status, calendar,
              e-sign, per-client vault, unread-per-case, invoice list,
              client search, monthly summary. No live account is wired
              in here yet, so every section shows its honest empty /
              not-connected state until real rows exist. */}
          <BusinessToolsPanel />
          <AgencyNumberHub />
          <FamilyInviteManager />
          {/* Invite your own client — reuses the family_invites magic
              invite + 6-digit code system (POST
              /api/professionals/invite-client). No account id is
              known in this example build, so the card shows its
              signed-in prompt until a real account id is passed. */}
          <ClientInviteCard invitedBy="" referralCode={null} />
          {/* Google Calendar / Drive / Gmail — connection UI + code
              paths only. Google Cloud OAuth is not set up yet, so
              every product shows "Not connected". */}
          <GoogleConnectionsPanel accountId="" profileId="" />
          <ComplianceGuardrails />
          <AgencyChecklists />
          {/* Part 2 — NVC & Consular Processing Engine + 6 extra modules */}
          <CeacTracker />
          <ServiceCatalog />
          <NvcDualTrackChecklist />
          <InterviewReadinessTracker />
          <PostArrivalTracker />
          <DeadlineRadar />
          <TranslationPhotoTracker />
          <TranslationOrders />
          <FamilyTreeRoster />
          <AppointmentsRenewals />
          {/* Refer-a-Family — counts from REAL preparer_leads rows only.
              No leads are loaded in this example build, so the card shows
              0 referred / 0 became clients with the honest empty state,
              and "Referral reward: to be announced by the founder". */}
          <ReferralCard
            leads={[]}
            referrerAccountId={null}
            referralCode={null}
            storefrontSlug={null}
          />
        </div>
      ) : tab === "leads" ? (
        <div className="space-y-6">
          <LeadSheet />
          <LeadFollowUp />
          <LeadLifecycle />
        </div>
      ) : tab === "visa" ? (
        <div className="space-y-6">
          <VisaBulletinManager />
          <TemplateVerification />
        </div>
      ) : tab === "profile" ? (
        <PreparerProfileCard />
      ) : tab === "communicate" ? (
        <div className="space-y-6">
          <CommunicationHubPreparer />
          {/* In-dashboard email (Nov 28, 2026) — email the client from
              this dashboard, or send a one-click system draft. No real
              case is loaded in this example build, so the composer
              browses templates and explains that sending needs a real
              open case; pass a real caseId once the tab loads one. */}
          <DashboardEmailComposer caseId={null} professionalId={null} />
          {/* Ask NIPTEI copilot — professional view: BYO Chat AI
              settings + copilot preview. Non-AI FAQ answers in this
              build (OpenRouter NOT connected). */}
          <AskNipteiByoSettings profileLabel="Document Preparer — your own chat AI (BYO). Example profile only." />
          <AskNipteiChat context="professional" caseId="example-case-1" />
        </div>
      ) : (
        <div className="space-y-6">
          <AttorneyHandoff />
          <StudentSupervisionGuardrail />
        </div>
      )}
    </div>
  );
}
