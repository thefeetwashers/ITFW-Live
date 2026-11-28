// DashboardTop — the breathtaking dashboard order, in one component.
//
// Every role dashboard renders this at the top, in this exact order
// (lib/finalSweep.ts DASHBOARD_SECTION_ORDER):
//   1. Next step FIRST — the single most important action, from the
//      existing next-step engine (deriveNextStep). With no case / no
//      route yet, the engine honestly says the route is not set.
//   2. Colour-coded checklist — passed in by the host page (its own
//      ColourChecklist / CaseCommandPanel checklist). With no case
//      open, the honest empty state below shows instead — no example
//      items are ever invented as a real client's checklist.
//   3. One-click actions — draft email, send status update, open chat,
//      open checklist. Each does one thing and shows its result.
//   4. Deadline countdown — RFE / NOID / interview / biometrics, from
//      stored dates only.
//   5. Notification inbox — every stored status / email / message
//      event in one place.
// Then one compact row of links to the tools that already exist
// (payment centre, pipeline, chat, news, interview prep) — linked,
// never rebuilt, no clutter. Dashboards that already render a full
// CaseCommandPanel (preparer, /portal) do NOT render this component:
// the panel already orders next step → checklist → payment, and this
// sweep adds OneClickActions + NotificationInbox beside it instead.
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import NextStepCard from "./NextStepCard";
import OneClickActions from "./OneClickActions";
import DeadlineCountdown, { type StoredDeadline } from "./DeadlineCountdown";
import NotificationInbox from "./NotificationInbox";
import type { NextStepInput } from "@/lib/nextStepEngine";

export default function DashboardTop(props: {
  nextStepInput: NextStepInput;
  /** The host page's own checklist (ColourChecklist). Omit when no case
   *  is open — the honest empty state shows instead. */
  checklist?: ReactNode;
  caseId?: string | null;
  caseLabel?: string;
  deadlines?: StoredDeadline[];
}) {
  return (
    <div className="space-y-4" aria-label="Dashboard — next step, checklist, actions, deadlines, notifications">
      <NextStepCard input={props.nextStepInput} />

      {props.checklist ?? (
        <section
          aria-labelledby="dashboard-checklist-heading"
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 id="dashboard-checklist-heading" className="text-base font-semibold">
            Document checklist
          </h2>
          <p className="mt-2 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            No case is open yet, so there is no checklist to show. Your
            colour-coded checklist appears here — green Approved, amber
            Pending / In Progress, red Missing / Rejected / Overdue, blue
            Uploaded awaiting review, grey Not Started — once a case is
            created through intake.
          </p>
        </section>
      )}

      <OneClickActions caseId={props.caseId ?? null} caseLabel={props.caseLabel} />

      <DeadlineCountdown deadlines={props.deadlines ?? []} />

      <NotificationInbox />

      <nav
        aria-label="More tools"
        className="flex flex-wrap gap-2 text-sm"
      >
        <Link href="/pipeline" className="rounded border border-slate-300 bg-white px-3 py-2 font-semibold">
          Pipeline →
        </Link>
        <Link href="/portal" className="rounded border border-slate-300 bg-white px-3 py-2 font-semibold">
          Client Portal →
        </Link>
        <Link href="/interview-prep" className="rounded border border-slate-300 bg-white px-3 py-2 font-semibold">
          Interview Prep →
        </Link>
        <Link href="/today" className="rounded border border-slate-300 bg-white px-3 py-2 font-semibold">
          Today — news &amp; what changed →
        </Link>
      </nav>
    </div>
  );
}
