// PostSubmissionTracker — once a case is submitted to USCIS, the Client &
// Family Portal shows, at all times, in plain English:
//   (a) WHAT STAGE the application is on (Receipt → Biometrics → Review →
//       RFE if any → Approval / Denial), with the USCIS receipt number,
//       Service Center / Lockbox, and the current status AS ENTERED BY THE
//       PROFESSIONAL. Live USCIS lookup needs the Production key — NOT
//       built. Manual entry + Sandbox only, labelled.
//   (b) WHAT IS NEXT after USCIS — in TWO SEPARATE flows that NEVER mix:
//       outside US (consular / NVC) or inside US (adjustment of status).
//       The flow is chosen by the case's route (inside US vs outside US,
//       from the Path Finder route). A professional can switch it only
//       with a reason, logged to audit_log + case_route_changes
//       (migration 0016; local-only list until then).
// Reuses lib/nvc.ts CEAC steps/fees and the InterviewReadinessTracker
// data shape; it does NOT duplicate CeacTracker.
"use client";

import { useState } from "react";
import {
  ADJUSTMENT_NOT_NEEDED,
  ADJUSTMENT_STEPS,
  CONSULAR_STEPS,
  ROUTE_LABELS,
  USCIS_STAGES,
  govFeeTimeline,
  type CaseRoute,
  type InterviewSchedule,
  type UscisStage,
} from "@/lib/nextStepEngine";
import { CEAC_LOGIN_URL } from "@/lib/nvc";
import { ColourLegend } from "./ColourChecklist";
import { DOC_COLOURS } from "@/lib/nextStepEngine";

export default function PostSubmissionTracker(props: {
  route: CaseRoute | null;
  uscisStage: UscisStage | null;
  /** Manual entry by the professional — EXAMPLE values, never a live lookup. */
  receiptNumber?: string | null;
  serviceCenter?: string | null;
  lockbox?: string | null;
  manualStatus?: string | null;
  interview?: InterviewSchedule | null;
  applicantCount?: number;
  /** Professionals only. Clients / family never switch the route. */
  canEditRoute?: boolean;
}) {
  const [route, setRoute] = useState<CaseRoute | null>(props.route);
  const [reason, setReason] = useState("");
  const [routeLog, setRouteLog] = useState<string[]>([]);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const stage = props.uscisStage;
  const stageIndex = stage
    ? USCIS_STAGES.findIndex((s) => s.id === stage)
    : -1;
  const fees = route ? govFeeTimeline(route) : [];

  const switchRoute = (next: CaseRoute) => {
    if (next === route) return;
    if (!reason.trim()) {
      setSwitchError(
        "A reason is required to switch the route — it is logged to audit_log + case_route_changes."
      );
      return;
    }
    setSwitchError(null);
    setRouteLog((l) => [
      ...l,
      `Route switched ${route ?? "not set"} → ${ROUTE_LABELS[next]}. Reason: ${reason.trim()} (local list only — written to audit_log + case_route_changes once migration 0016 is live.)`,
    ]);
    setRoute(next);
    setReason("");
  };

  return (
    <section
      aria-labelledby="post-submission-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="post-submission-heading" className="text-base font-semibold">
        After Submission — Where Your Case Is &amp; What Happens Next
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Status below is entered by your provider (manual entry + Sandbox
        only). Live USCIS lookup needs the Production key — NOT built. Never
        a live USCIS or CEAC feed.
      </p>

      {/* (a) USCIS stage */}
      <h3 className="mt-4 text-sm font-semibold">USCIS stage</h3>
      <ol className="mt-2 flex flex-wrap items-center gap-1 text-sm">
        {USCIS_STAGES.map((s, i) => {
          const done = stageIndex >= 0 && i < stageIndex;
          const current = i === stageIndex;
          return (
            <li key={s.id} className="flex items-center gap-1">
              <span
                className={
                  done
                    ? "font-semibold text-green-700"
                    : current
                      ? "font-semibold text-amber-700"
                      : "text-slate-400"
                }
              >
                {done ? "●" : current ? "◐" : "○"} {s.label}
              </span>
              {i < USCIS_STAGES.length - 1 && (
                <span className="text-slate-300">—</span>
              )}
            </li>
          );
        })}
      </ol>
      {stage && (
        <p className="mt-2 text-sm text-slate-700">
          {USCIS_STAGES.find((s) => s.id === stage)?.plainEnglish}
        </p>
      )}
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="font-semibold">USCIS Receipt # (manual entry):</dt>
          <dd className="font-mono">{props.receiptNumber ?? "Not entered yet"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold">Service Center / Lockbox:</dt>
          <dd>
            {props.serviceCenter ?? props.lockbox ?? "Not entered yet"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold">Current status (as entered by the professional):</dt>
          <dd>{props.manualStatus ?? "Not entered yet"}</dd>
        </div>
      </dl>

      {/* Route — chosen by the Path Finder route, switchable only with a reason */}
      <h3 className="mt-4 text-sm font-semibold">Your route</h3>
      <p className="mt-1 text-sm">
        {route ? (
          <strong>{ROUTE_LABELS[route]}</strong>
        ) : (
          <strong className="text-red-700">
            Route not set yet — your provider sets it from your Path Finder answers.
          </strong>
        )}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Only one flow is ever shown for your case. An adjustment client never
        sees NVC steps; a consular client never sees adjustment steps.
      </p>
      {props.canEditRoute && (
        <div className="mt-2 rounded border border-slate-200 p-3 text-sm">
          <p className="font-semibold">Switch route (professional only — reason required)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["inside_us", "outside_us"] as CaseRoute[]).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={route === r}
                onClick={() => switchRoute(r)}
                className={
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold " +
                  (route === r
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 bg-white hover:border-blue-400")
                }
              >
                {ROUTE_LABELS[r]}
              </button>
            ))}
            <label className="flex min-w-56 flex-1 items-center gap-2 text-xs">
              Reason (required):
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. beneficiary moved abroad"
                className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          {switchError && (
            <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{switchError}</p>
          )}
          {routeLog.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {routeLog.map((entry, i) => (
                <li key={i} className="rounded border border-slate-200 bg-slate-50 px-2 py-1">{entry}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* (b) Route-specific flow — NEVER both */}
      {route === "outside_us" && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">
            What is next — Outside the US (consular / NVC)
          </h3>
          <ol className="mt-2 space-y-2">
            {CONSULAR_STEPS.map((step, i) => (
              <li key={step.id} className="rounded border border-slate-200 px-3 py-2 text-sm">
                <p className="font-medium">
                  {i + 1}. {step.title}
                </p>
                <p className="text-slate-700">{step.detail}</p>
                {step.needed && (
                  <p className="mt-1 text-xs text-slate-600">
                    <strong>Needed:</strong> {step.needed}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-sm">
            Check your CEAC case at{" "}
            <a href={CEAC_LOGIN_URL} target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline">
              ceac.state.gov
            </a>{" "}
            — manual tracking only. Never store a CEAC password here, and never
            share your CEAC password with anyone.
          </p>

          <h3 className="mt-4 text-sm font-semibold">Interview scheduling tracker</h3>
          {props.interview ? (
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex gap-2"><dt className="font-semibold">Interview date:</dt><dd>{props.interview.interviewDate ?? "Not scheduled yet — no date invented"}</dd></div>
              <div className="flex gap-2"><dt className="font-semibold">Embassy post:</dt><dd>{props.interview.embassyPost ?? "Not set yet"}</dd></div>
              <div className="flex gap-2"><dt className="font-semibold">Medical exam:</dt><dd>{props.interview.medicalExamStatus}</dd></div>
              <div className="flex gap-2"><dt className="font-semibold">VAC biometrics appointment:</dt><dd>{props.interview.vacDate ? `${props.interview.vacDate}${props.interview.vacLocation ? ` — ${props.interview.vacLocation}` : ""}` : "Not scheduled yet"}</dd></div>
            </dl>
          ) : (
            <p className="mt-1 text-sm text-slate-600">
              No interview is scheduled yet. When NVC schedules it, your
              provider enters the date, embassy, medical exam status, and VAC
              appointment here.
            </p>
          )}
          <h4 className="mt-3 text-sm font-semibold">Original documents binder — pack these originals</h4>
          <ColourLegend />
          <ul className="mt-2 space-y-2 text-sm">
            {(props.interview?.binderItems ?? []).map((item) => {
              const c = DOC_COLOURS[item.status];
              return (
                <li key={item.id} className={`flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 ${c.rowClass}`}>
                  <span className="font-medium">{item.label}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${c.chipClass}`}>{c.label}</span>
                </li>
              );
            })}
            {(!props.interview || props.interview.binderItems.length === 0) && (
              <li className="rounded border border-slate-200 px-3 py-2 text-slate-600">
                Binder checklist appears here once your provider lists the originals to pack (every civil document uploaded to CEAC + certified translations).
              </li>
            )}
          </ul>
        </div>
      )}

      {route === "inside_us" && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">
            What is next — Inside the US (adjustment of status)
          </h3>
          <ol className="mt-2 space-y-2">
            {ADJUSTMENT_STEPS.map((step, i) => (
              <li key={step.id} className="rounded border border-slate-200 px-3 py-2 text-sm">
                <p className="font-medium">
                  {i + 1}. {step.title}
                </p>
                <p className="text-slate-700">{step.detail}</p>
                {step.needed && (
                  <p className="mt-1 text-xs text-slate-600">
                    <strong>Needed:</strong> {step.needed}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <h3 className="mt-4 text-sm font-semibold">
            What you do NOT need for an adjustment case
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {ADJUSTMENT_NOT_NEEDED.map((line) => (
              <li key={line} className="rounded border border-green-300 bg-green-50 px-3 py-2">
                ✓ {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* "When should I pay?" — each government fee at its correct step */}
      {route && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">
            When should I pay? — government fees, one step at a time
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Each fee is paid at the step where it is actually due — never all
            at once, and never combined with the prep fee. {props.applicantCount
              ? `Shown for ${props.applicantCount} applicant(s) where a fee is per applicant.`
              : ""}
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            {fees.map((fee) => (
              <li key={fee.id} className="rounded border border-slate-200 px-3 py-2">
                <p className="font-medium">
                  {fee.stepTitle}: {fee.feeLabel} —{" "}
                  <strong>
                    {fee.amountUsd === null
                      ? "Amount on your invoice / uscis.gov/fees (to be confirmed)"
                      : `$${fee.amountUsd}${fee.id === "iv-fee" ? " per applicant" : ""}`}
                  </strong>
                </p>
                <p className="text-slate-700">
                  Pay to: {fee.payTo}. {fee.when}
                </p>
                <p className="text-xs text-slate-600">{fee.note}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
