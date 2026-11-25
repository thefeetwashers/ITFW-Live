// LifecyclePipeline — the 6-stage lifecycle engine, shared by the
// preparer back-office (interactive) and the Client & Family Portal
// (read-only guidance).
// - Preparer: clicking a stage moves the case to that stage; Stage 5
//   offers the 5A / 5B toggle. State lives in the parent (local state /
//   EXAMPLE data for now). Shared Supabase state — to be wired.
// - Client / family: readOnly — the same stages render as plain text,
//   with full plain-English "Where Your Application Is Right Now &
//   What Happens Next" guidance for EVERY stage, including 5A, 5B and 6.
// Clerical help only — not a law firm, no approval guarantee.
"use client";

import {
  CEAC_LOGIN_URL,
  LIFECYCLE_STAGES,
  STAGE_5A_GUIDANCE,
  STAGE_5B_GUIDANCE,
  USCIS_FEE_SCHEDULE_URL,
  stageDef,
  type LifecycleStageId,
  type Stage5SubStage,
} from "@/lib/lifecycle";

interface LifecyclePipelineProps {
  currentStage: LifecycleStageId;
  currentSubStage?: Stage5SubStage | null;
  /** Interactive (preparer) when provided; read-only when omitted. */
  onStageChange?: (stage: LifecycleStageId) => void;
  onSubStageChange?: (subStage: Stage5SubStage) => void;
  readOnly?: boolean;
  /** Label shown above the pipeline, e.g. the EXAMPLE case name. */
  caseLabel?: string;
  /** Optional per-stage counts (preparer view). */
  stageCounts?: Partial<Record<LifecycleStageId, number>>;
}

export default function LifecyclePipeline({
  currentStage,
  currentSubStage = null,
  onStageChange,
  onSubStageChange,
  readOnly = false,
  caseLabel,
  stageCounts,
}: LifecyclePipelineProps) {
  const interactive = !readOnly && typeof onStageChange === "function";
  const currentIndex = LIFECYCLE_STAGES.findIndex((s) => s.id === currentStage);
  const def = stageDef(currentStage);
  const show5A = currentStage === "submitted_uscis" && currentSubStage !== "5B";
  const show5B = currentStage === "submitted_uscis" && currentSubStage === "5B";

  return (
    <section
      aria-labelledby="lifecycle-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="lifecycle-heading" className="text-lg font-semibold">
        Where Your Application Is Right Now &amp; What Happens Next
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        6-stage lifecycle: New Lead → Consultation / Quote Sent → Payment
        Arrangement → Active Client → Submitted to USCIS / NVC → Visa
        Approved &amp; Closed. Clerical help only — not a law firm, not
        affiliated with USCIS, no approval guarantee.
      </p>
      {caseLabel && (
        <p className="mt-1 text-sm font-medium text-slate-700">{caseLabel}</p>
      )}
      <p className="mt-1 text-xs text-slate-500">
        Shared Supabase state — to be wired. This view uses local / EXAMPLE
        state only; moving a stage here does not update any live record yet.
      </p>

      {/* Stage stepper */}
      <ol className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {LIFECYCLE_STAGES.map((stage, i) => {
          const done = i < currentIndex;
          const current = stage.id === currentStage;
          const count = stageCounts?.[stage.id];
          const inner = (
            <>
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Stage {stage.number}
              </span>
              <span className="mt-1 block text-sm font-medium leading-snug">
                {done ? "✓ " : current ? "● " : "○ "}
                {stage.title}
              </span>
              {typeof count === "number" && (
                <span className="mt-1 block text-xs text-slate-500">
                  {count} {count === 1 ? "lead" : "leads"}
                </span>
              )}
              {stage.id === "submitted_uscis" && current && currentSubStage && (
                <span className="mt-1 block text-xs font-semibold text-blue-800">
                  Sub-stage {currentSubStage}
                  {currentSubStage === "5A" ? " — At USCIS" : " — At NVC"}
                </span>
              )}
            </>
          );
          const cls = `rounded border p-3 text-left text-sm ${
            current
              ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
              : done
                ? "border-green-600 bg-green-50"
                : "border-slate-200 bg-slate-50"
          }`;
          return (
            <li key={stage.id}>
              {interactive ? (
                <button
                  type="button"
                  onClick={() => onStageChange(stage.id)}
                  className={`${cls} w-full hover:border-blue-600`}
                  aria-current={current ? "step" : undefined}
                  title={
                    current
                      ? `Current stage: ${stage.title}`
                      : `Move this case to Stage ${stage.number}: ${stage.title}`
                  }
                >
                  {inner}
                </button>
              ) : (
                <div className={cls} aria-current={current ? "step" : undefined}>
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {interactive && (
        <p className="mt-2 text-xs text-slate-500">
          Preparer: click a stage to move this case to it. The change is
          local / EXAMPLE only until Supabase is wired.
        </p>
      )}

      {/* Stage 5 sub-stage toggle */}
      {currentStage === "submitted_uscis" && (
        <div className="mt-4 rounded border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm font-semibold">Stage 5 sub-stage</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["5A", "5B"] as const).map((sub) => {
              const active = (currentSubStage ?? "5A") === sub;
              const label =
                sub === "5A" ? "5A — At USCIS" : "5B — USCIS Approved → At NVC";
              if (!interactive || !onSubStageChange) {
                return (
                  <span
                    key={sub}
                    className={`rounded px-3 py-1.5 text-sm font-medium ${
                      active ? "bg-slate-900 text-white" : "bg-white text-slate-600"
                    }`}
                  >
                    {label}
                  </span>
                );
              }
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => onSubStageChange(sub)}
                  aria-pressed={active}
                  className={`rounded px-3 py-1.5 text-sm font-medium ${
                    active
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Guidance for the current stage */}
      <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-base font-semibold">{def.clientHeading}</h3>
        <p className="mt-2 text-sm text-slate-700">
          <strong>Where you are now:</strong> {def.clientWhere}
        </p>
        <h4 className="mt-3 text-sm font-semibold">What happens next</h4>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {def.clientNext.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-700">
          <strong>What you should do:</strong> {def.clientAction}
        </p>
        {!readOnly && (
          <p className="mt-3 rounded border border-slate-200 bg-white p-2 text-xs text-slate-600">
            <strong>Preparer note (Stage {def.number}):</strong>{" "}
            {def.preparerNote}
          </p>
        )}
      </div>

      {/* Stage 5A guidance */}
      {currentStage === "submitted_uscis" && show5A && (
        <div className="mt-4 rounded border border-blue-200 bg-blue-50 p-4">
          <h3 className="text-base font-semibold">{STAGE_5A_GUIDANCE.heading}</h3>
          <p className="mt-2 text-sm text-slate-700">
            <strong>Where you are now:</strong> {STAGE_5A_GUIDANCE.where}
          </p>
          <h4 className="mt-3 text-sm font-semibold">What happens next</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {STAGE_5A_GUIDANCE.next.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-slate-700">
            <strong>What you should do:</strong> {STAGE_5A_GUIDANCE.action}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Check your USCIS case status only with your receipt number, on
            the official USCIS site. The USCIS filing fee for a form is
            confirmed at{" "}
            <a href={USCIS_FEE_SCHEDULE_URL} target="_blank" rel="noreferrer" className="text-blue-700 underline">
              uscis.gov/fees
            </a>
            . The I-130 USCIS fee is TO BE CONFIRMED — it is not $675 in
            this build.
          </p>
        </div>
      )}

      {/* Stage 5B guidance — the 4 CEAC steps */}
      {currentStage === "submitted_uscis" && show5B && (
        <div className="mt-4 rounded border border-blue-200 bg-blue-50 p-4">
          <h3 className="text-base font-semibold">{STAGE_5B_GUIDANCE.heading}</h3>
          <p className="mt-2 text-sm text-slate-700">
            <strong>Where you are now:</strong> {STAGE_5B_GUIDANCE.where}
          </p>
          <h4 className="mt-3 text-sm font-semibold">
            The 4 CEAC steps (do them in order)
          </h4>
          <ol className="mt-1 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            {STAGE_5B_GUIDANCE.ceacSteps.map((s) => (
              <li key={s.step}>
                <strong>{s.title}.</strong> {s.detail}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-slate-700">
            <strong>What you should do:</strong> {STAGE_5B_GUIDANCE.action}
          </p>
          <p className="mt-2 text-sm">
            NVC CEAC:{" "}
            <a href={CEAC_LOGIN_URL} target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline">
              Open CEAC login (ceac.state.gov)
            </a>{" "}
            — manual tracking only; never share or store a CEAC password.
          </p>
        </div>
      )}

      {/* Stage 6 reminder — the $235 fee must be paid BEFORE flying */}
      {currentStage === "visa_approved_closed" && (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          Before you fly: pay the $235 USCIS Immigrant Fee at my.uscis.gov,
          pick up your passport with the visa, and carry the sealed packet
          and medical records in your carry-on — never in checked luggage.
          Green Card &amp; SSN are mailed 30–90 days after entry.
        </p>
      )}
    </section>
  );
}
