// Form chain progress panel for the guided DIY flow — client component.
//
// Shows, for the chain the current form belongs to:
//   * Progress across the whole chain ("Form 3 of 7 — I-864 next").
//   * Every step: completed (revisitable), current (the next form),
//     locked (not yet reached — never shown as completed).
//   * The plain-English reason why the next form is next.
//   * Per-form print / save / email state: what is paid (unlocked) and
//     what is still locked, per form — from the server (/api/diy/chain-status),
//     never from a front-end flag. The buttons here are NOT the gate:
//     the gate is server-side in src/lib/diy.ts and enforced by
//     /api/diy/packet and /api/diy/email-packet.
//
// The copy / screenshot deterrent on the form preview (disabled text
// selection / copy / print shortcuts + watermark) is a deterrent, not
// a guarantee — see DIY_COPY_DETERRENT_LABEL in src/lib/diy.ts. A phone
// camera can still capture a screen. That label is shown on the
// preview itself (DiyGuidedFlow step 3), not repeated here.
//
// Sensitive values (DOB, A-Number, SSN, passport number) are never
// shown here at all — this panel shows form codes and statuses only.
"use client";

import type { ChainProgress, ChainFormUnlock, FormChainStep } from "@/lib/formChains";
import {
  CHAIN_EDITION_NOTICE,
  CHAIN_NOT_LAW_FIRM_NOTICE,
} from "@/lib/formChains";

export interface ChainUnlockByForm {
  [formCode: string]: ChainFormUnlock;
}

export default function FormChainProgress({
  progress,
  unlockByForm,
  justCompletedFormCode,
  onSelectForm,
  onPayForForm,
  onStartNext,
}: {
  /** Progress from chainProgress() (server chain-status or local). */
  progress: ChainProgress;
  /** Per-form unlock decisions, keyed by form code. Missing = unknown. */
  unlockByForm: ChainUnlockByForm;
  /** Form just completed in this session, for the "what's next" banner. */
  justCompletedFormCode?: string | null;
  /** Jump to a completed / current form's questions. Locked forms are never selectable. */
  onSelectForm: (formCode: string) => void;
  /** Go to pay-to-unlock for a locked form. */
  onPayForForm: (formCode: string) => void;
  /** Start the next form in the chain. */
  onStartNext: (formCode: string) => void;
}) {
  const next: FormChainStep | null = progress.currentStep;
  const justCompleted =
    justCompletedFormCode != null
      ? progress.steps.find((s) => s.formCode === justCompletedFormCode) ?? null
      : null;

  return (
    <section
      aria-labelledby="form-chain-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="form-chain-heading" className="text-base font-semibold">
        Your forms — {progress.chainName}
      </h2>
      <p className="mt-1 text-sm font-semibold text-slate-800" role="status">
        {progress.label}
        {progress.completedCount > 0
          ? ` · ${progress.completedCount} of ${progress.total} complete`
          : ""}
      </p>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={progress.completedCount}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-label={`Chain progress: ${progress.completedCount} of ${progress.total} forms complete`}
      >
        <div
          className="h-full bg-green-600"
          style={{ width: `${Math.round((progress.completedCount / progress.total) * 100)}%` }}
        />
      </div>

      {/* "What's next" banner — shown after a form is completed. */}
      {justCompleted && next && next.formCode !== justCompleted.formCode ? (
        <div className="mt-3 rounded border border-green-600 bg-green-50 px-3 py-2 text-sm text-green-900">
          <p className="font-semibold">
            You finished Form {justCompleted.formCode} — next is Form {next.formCode}.
          </p>
          <p className="mt-1">{next.reason}</p>
          <button
            type="button"
            onClick={() => onStartNext(next.formCode)}
            className="mt-2 rounded bg-green-700 px-4 py-2 text-sm font-semibold text-white"
          >
            Start Form {next.formCode} →
          </button>
        </div>
      ) : null}
      {justCompleted && !next ? (
        <p className="mt-3 rounded border border-green-600 bg-green-50 px-3 py-2 text-sm font-semibold text-green-900">
          You finished Form {justCompleted.formCode} — that was the last form in this chain.
          Print, save and email stay per form: pay the DIY $25 for each form you still need to
          unlock, or the $99 DIY Bundle.
        </p>
      ) : null}

      {/* Next-form reason, always visible while the chain is incomplete. */}
      {!justCompleted && next ? (
        <p className="mt-3 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <strong>Next: Form {next.formCode}.</strong> {next.reason}
        </p>
      ) : null}

      <ol className="mt-3 space-y-2">
        {progress.steps.map((s) => {
          const unlock = unlockByForm[s.formCode];
          const selectable = s.status === "completed" || s.status === "current";
          return (
            <li
              key={s.formCode}
              className={`rounded border px-3 py-2 text-sm ${
                s.status === "completed"
                  ? "border-green-300 bg-green-50"
                  : s.status === "current"
                    ? "border-blue-600 bg-blue-50"
                    : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  <strong>
                    {s.position}. Form {s.formCode}
                  </strong>{" "}
                  <span className="text-slate-600">— {s.title}</span>
                </span>
                <span
                  className={`text-xs font-semibold ${
                    s.status === "completed"
                      ? "text-green-800"
                      : s.status === "current"
                        ? "text-blue-800"
                        : "text-slate-500"
                  }`}
                >
                  {s.status === "completed"
                    ? "Completed — tap to revisit"
                    : s.status === "current"
                      ? "Next — start here"
                      : "Locked — not yet started"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600">{s.reason}</p>
              {s.freeWith ? (
                <p className="mt-1 text-xs font-semibold text-slate-700">
                  Included free with Form {s.freeWith} — no extra DIY fee for this form.
                </p>
              ) : null}
              {s.kind === "doctor" ? (
                <p className="mt-1 text-xs text-slate-700">{s.doctorNote}</p>
              ) : null}
              {/* Per-form pay state — from the server, never a front-end flag. */}
              {unlock ? (
                !unlock.applicable ? (
                  <p className="mt-1 text-xs text-slate-600">
                    No DIY print / save / email for this form — the doctor completes and seals it.
                  </p>
                ) : unlock.unlocked ? (
                  <p className="mt-1 text-xs font-semibold text-green-800">
                    Paid — print, save &amp; email unlocked. {unlock.reason}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-amber-900">
                    Locked — {unlock.reason}{" "}
                    <button
                      type="button"
                      onClick={() => onPayForForm(s.formCode)}
                      className="font-semibold text-blue-700 underline"
                    >
                      Pay $25 for this form (or $99 for the DIY Bundle) →
                    </button>
                  </p>
                )
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  Payment status not checked yet — open the flow from your case to check it.
                </p>
              )}
              {selectable ? (
                <button
                  type="button"
                  onClick={() => onSelectForm(s.formCode)}
                  className="mt-2 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
                >
                  {s.status === "completed"
                    ? `Revisit Form ${s.formCode}`
                    : `Start Form ${s.formCode}`}
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-xs text-slate-600">
        {CHAIN_EDITION_NOTICE} {CHAIN_NOT_LAW_FIRM_NOTICE}
      </p>
    </section>
  );
}
