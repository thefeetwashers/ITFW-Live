// CaseCommandPanel — ONE screen per role that answers everything without
// hunting: Daily Command, Next Step card, colour-coded checklist, payment
// centre, communication thread, post-submission stage tracker, and a
// "What happens next" guide — all on the case page, all in the client's
// language, original + English side by side.
//
// REUSES (never duplicates): DailyCommand (comms), UnifiedThread via
// CommsComposer, LifecyclePipeline, DeadlineRadar, CeacTracker data
// (lib/nvc.ts). Dashboards that already render DailyCommand / the thread
// on the same screen pass showDailyCommand / showComms as false so the
// panel does not render a second copy.
"use client";

import DailyCommand from "@/components/comms/DailyCommand";
import DeadlineRadar from "@/components/portal/DeadlineRadar";
import LifecyclePipeline from "@/components/LifecyclePipeline";
import {
  EXAMPLE_CHECKLIST,
  EXAMPLE_USCIS,
} from "@/lib/example-data";
import {
  EXAMPLE_INTERVIEW_READINESS,
  EXAMPLE_VAC,
} from "@/lib/nvc";
import {
  colourForReviewStatus,
  type CaseRoute,
  type ColourItem,
  type DocColourStatus,
  type UscisStage,
} from "@/lib/nextStepEngine";
import type { IsolationRole } from "@/lib/isolation";
import type { LanguageCode } from "@/lib/i18n";
import NextStepCard from "./NextStepCard";
import ColourChecklist from "./ColourChecklist";
import PaymentCentre from "./PaymentCentre";
import CommsComposer from "./CommsComposer";
import PostSubmissionTracker from "./PostSubmissionTracker";
import CaseTracker from "./CaseTracker";
import { HowThisWorksClient, HowToServiceClient } from "./HowItWorks";

export type DashboardRole =
  | "client"
  | "family"
  | "preparer"
  | "attorney"
  | "nonprofit"
  | "law_student"
  | "back_office";

const THREAD_ROLE: Record<DashboardRole, IsolationRole> = {
  client: "client",
  family: "family",
  preparer: "preparer",
  attorney: "attorney",
  nonprofit: "doj_standard",
  law_student: "law_student",
  back_office: "preparer",
};

/** EXAMPLE checklist, mapped onto the colour system. The extra row shows
 *  the grey "Not Started" colour the example data does not otherwise have. */
export const EXAMPLE_COLOUR_ITEMS: ColourItem[] = [
  ...EXAMPLE_CHECKLIST.map((i) => ({
    id: i.id,
    label: i.label,
    status: colourForReviewStatus(i.status),
    note: i.note,
    blocking: true,
  })),
  {
    id: "doc-marriage-q",
    label: "Bona Fide Marriage Questions",
    status: "not_started" as DocColourStatus,
    note: "Not started yet — example item from the Smart Forms list.",
    blocking: false,
  },
];

function exampleInterview(route: CaseRoute) {
  if (route !== "outside_us") return null;
  const binder: ColourItem[] = EXAMPLE_INTERVIEW_READINESS.map((i) => ({
    id: i.id,
    label: i.label,
    note: i.note,
    status:
      i.status === "done"
        ? ("approved" as DocColourStatus)
        : i.status === "pending"
          ? ("in_progress" as DocColourStatus)
          : ("not_started" as DocColourStatus),
  }));
  return {
    interviewDate: null,
    embassyPost: "Port-au-Prince, Haiti (EXAMPLE — from NVC case PHP2026144009)",
    medicalExamStatus: "NOT SCHEDULED" as const,
    vacDate: EXAMPLE_VAC.dateIso,
    vacLocation: EXAMPLE_VAC.location,
    binderItems: binder,
  };
}

export default function CaseCommandPanel(props: {
  role: DashboardRole;
  route: CaseRoute;
  clientLanguage?: LanguageCode;
  caseLabel?: string;
  uscisStage?: UscisStage | null;
  /** False where the dashboard already shows Daily Command on this screen. */
  showDailyCommand?: boolean;
  /** False where the dashboard already shows the unified thread. */
  showComms?: boolean;
  showPayment?: boolean;
  canEditPayment?: boolean;
  canEditRoute?: boolean;
  guide?: "client" | "professional" | "both" | "none";
  viewerName?: string;
}) {
  const lang = props.clientLanguage ?? "es";
  const route = props.route;
  const uscisStage = props.uscisStage ?? "biometrics";
  const caseLabel =
    props.caseLabel ?? "Your case (EXAMPLE): Form I-130 — Family Petition.";
  const canEditPayment = props.canEditPayment ?? true;
  const canEditRoute = props.canEditRoute ?? false;
  const showDaily = props.showDailyCommand ?? true;
  const showComms = props.showComms ?? true;
  const showPayment = props.showPayment ?? true;
  const guide = props.guide ?? (props.role === "client" || props.role === "family" ? "client" : "professional");
  const blockingItems = EXAMPLE_COLOUR_ITEMS.filter((i) => i.blocking);

  return (
    <div className="space-y-4" aria-label="Case command panel — next step, stage, payment, communication">
      <NextStepCard
        input={{
          route,
          uscisStage,
          blockingItems,
          biometricsDate: "Dec 3, 2026 (EXAMPLE — from the USCIS tracker)",
          language: lang,
        }}
      />

      {showDaily && (
        <>
          <DailyCommand todayIso="2026-11-19" />
          {(props.role === "client" || props.role === "family") && <DeadlineRadar />}
        </>
      )}

      <ColourChecklist items={EXAMPLE_COLOUR_ITEMS} />

      {showPayment && (
        <PaymentCentre clientLanguage={lang} canEdit={canEditPayment} />
      )}

      <PostSubmissionTracker
        route={route}
        uscisStage={uscisStage}
        receiptNumber={EXAMPLE_USCIS.receiptNumber}
        serviceCenter="IOE — USCIS online filing (EXAMPLE — prefix IOE)"
        manualStatus={EXAMPLE_USCIS.status}
        interview={exampleInterview(route)}
        applicantCount={1}
        canEditRoute={canEditRoute}
      />

      {/* Case-number tracking + NVC/consular (EIGHTH ADDITION, Nov 28,
          2026). Reuses the receipt + status above; adds the masked
          receipt entry, the dated status-change log, the completeness
          view from our records, the RFE/NOID decoder, and the
          consular submission checklist. No live USCIS lookup, no
          officer-file view, no CEAC password field. */}
      <CaseTracker
        receiptNumber={EXAMPLE_USCIS.receiptNumber}
        formCode="I-130"
        templateId="i130-nvc"
        caseLabel="Form I-130 — Family Petition (EXAMPLE)"
        nvcCaseNumber="PHP2026144009"
      />

      {showComms && (
        <CommsComposer
          caseId="example-case-1"
          caseLabel="Form I-130 — Family Petition (EXAMPLE)"
          viewerRole={THREAD_ROLE[props.role]}
          viewerName={props.viewerName ?? `You (${props.role})`}
          clientLanguage={lang}
          canSend={props.role !== "law_student"}
          sendDisabledReason={
            props.role === "law_student"
              ? "Law students cannot message a client without supervisor visibility."
              : undefined
          }
        />
      )}

      <LifecyclePipeline
        currentStage="active_client"
        currentSubStage={route === "outside_us" ? "5B" : "5A"}
        readOnly
        caseLabel={caseLabel}
      />

      {(guide === "client" || guide === "both") && (
        <HowThisWorksClient language={lang} />
      )}
      {(guide === "professional" || guide === "both") && <HowToServiceClient />}
    </div>
  );
}
