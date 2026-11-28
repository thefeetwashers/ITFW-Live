// "What happens after you file" timeline — per DIY form.
//
// WHY THIS FILE EXISTS: a DIY client files the packet themselves and
// then waits. The most common next question is "what happens now?" —
// and the worst answer is a guessed date. This module answers it with
// the process steps ALREADY in the codebase (src/lib/nextStepEngine.ts:
// USCIS_STAGES, CONSULAR_STEPS, ADJUSTMENT_STEPS — the same steps the
// PostSubmissionTracker shows), per form. Every step is labelled as
// the TYPICAL process. No dates, no promised timing, no promised
// outcome — USCIS processing times change, interviews are sometimes
// waived, and an RFE happens only if USCIS asks.
//
// ROUTE RULES (from the codebase, not invented):
//   * I-130 / I-129F are consular-track petitions: USCIS stages, then
//     the NVC / CEAC steps (CONSULAR_STEPS) — the beneficiary is
//     outside the United States.
//   * I-485 is adjustment of status: USCIS stages, then the
//     adjustment steps (ADJUSTMENT_STEPS) — the applicant is inside
//     the United States.
//   * Every other DIY form gets the USCIS stages only. The codebase
//     does not carry a verified post-filing tail for N-400, I-90,
//     I-821, I-765, I-589, I-131, I-751, I-539, I-864 or DS-260 /
//     I-130A / I-864A, so none is invented — the result says so and
//     points the client to their provider instead of guessing.

import {
  ADJUSTMENT_STEPS,
  CONSULAR_STEPS,
  USCIS_STAGES,
} from "./nextStepEngine";

export const AFTER_FILING_DISCLAIMER =
  "Typical process steps, not a promise. USCIS processing times change, an interview " +
  "may be scheduled or waived, and a Request for Evidence (RFE) happens only if USCIS asks. " +
  "No date or outcome is promised here. If you receive any letter from USCIS, send it to your " +
  "provider the same day you receive it and do not miss the deadline on it.";

export interface DiyAfterFilingStep {
  title: string;
  detail: string;
  /** "uscis" | "nvc" | "adjustment" — which part of the process. */
  stage: "uscis" | "nvc" | "adjustment";
}

export interface DiyAfterFilingTimeline {
  formCode: string;
  /** "consular" | "adjustment" | "uscis_only" */
  route: "consular" | "adjustment" | "uscis_only";
  routeNote: string;
  steps: DiyAfterFilingStep[];
  disclaimer: string;
}

export function diyAfterFilingTimeline(formCode: string): DiyAfterFilingTimeline {
  const uscisSteps: DiyAfterFilingStep[] = USCIS_STAGES.map((stage) => ({
    title: stage.label,
    detail: stage.plainEnglish,
    stage: "uscis" as const,
  }));

  if (formCode === "I-130" || formCode === "I-129F" || formCode === "DS-260") {
    return {
      formCode,
      route: "consular",
      routeNote:
        "Consular track — the beneficiary is outside the United States. After USCIS approves, " +
        "the case goes to the National Visa Center (NVC), then to the U.S. embassy or consulate for the interview.",
      steps: [
        ...uscisSteps,
        ...CONSULAR_STEPS.map((step) => ({
          title: step.title,
          detail: step.detail,
          stage: "nvc" as const,
        })),
      ],
      disclaimer: AFTER_FILING_DISCLAIMER,
    };
  }

  if (formCode === "I-485") {
    return {
      formCode,
      route: "adjustment",
      routeNote:
        "Adjustment track — the applicant is inside the United States. After USCIS approves, " +
        "the Green Card is mailed to the address on the case.",
      steps: [
        ...uscisSteps,
        ...ADJUSTMENT_STEPS.map((step) => ({
          title: step.title,
          detail: step.detail,
          stage: "adjustment" as const,
        })),
      ],
      disclaimer: AFTER_FILING_DISCLAIMER,
    };
  }

  return {
    formCode,
    route: "uscis_only",
    routeNote:
      "USCIS process steps for this form. What happens after a decision depends on the form " +
      "and on your case — no further steps are listed here because the codebase does not carry " +
      "a verified post-filing tail for this form. Ask your provider what happens next for your case.",
    steps: uscisSteps,
    disclaimer: AFTER_FILING_DISCLAIMER,
  };
}
