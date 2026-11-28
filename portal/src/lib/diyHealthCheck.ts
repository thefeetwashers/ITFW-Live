// Free Packet Health Check — run the packet audit on a client's DIY
// draft BEFORE they pay, so they see what is wrong or missing first.
//
// WHY THIS FILE EXISTS: the pay-to-print gate charges $25/form before
// the client can print, save or email. A client who pays and only then
// learns their packet is missing half its documents has paid to be
// told no. The health check is FREE and runs on the draft they have
// already typed — it changes nothing, unlocks nothing, and stores
// nothing. Print / save / email still require payment (see
// src/lib/diy.ts (decideDiyUnlock) — this module never grants access).
//
// WHAT IT REUSES (nothing invented):
//   * Checklist audit items: auditItemsForTemplate() in
//     src/lib/formChecklists.ts — the same items the paid packet audit
//     scores. An item counts as cleared only when its id is in
//     `clearedItemIds` (a document the client marked uploaded, or a
//     section the engine marked complete).
//   * Score: computePacketReadiness() in src/lib/audit.ts — the same
//     scoring the packet audit uses. Ready only at 100% with every
//     blocking item cleared.
//   * Timeline validators: runTimelineValidators() in
//     src/lib/dynamicIntakeSchemas.ts for I-131 / I-751 / I-539 /
//     I-129F (90-day window, I-94 expiry, 2-year meeting rule,
//     departure in future). A failed timeline check is reported as a
//     blocking fix, never as a legal determination.
//   * Missing answers: every required field in the intake schema with
//     no answer is listed as an unanswered question.
//
// The result is a CHECKLIST score, not a legal determination. It does
// not decide eligibility, relief, evidence strength, or whether it is
// safe to file — only a licensed attorney or DOJ-accredited
// representative gives legal advice (8 CFR 292.1).

import { computePacketReadiness, type AuditItem } from "./audit";
import {
  auditItemsForTemplate,
} from "./formChecklists";
import { diyTemplateIdForForm } from "./diyFees";
import { DIY_FORM_CODES } from "./diy";
function isDiyFormCode(value: string): boolean {
  return DIY_FORM_CODES.includes(value);
}

import {
  getDynamicSchema,
  isDynamicFormCode,
  runTimelineValidators,
  type DynamicField,
} from "./dynamicIntakeSchemas";

export interface DiyHealthFix {
  /** "missing_document" | "unanswered_question" | "timeline" */
  kind: "missing_document" | "unanswered_question" | "timeline";
  label: string;
  detail: string;
  blocking: boolean;
}

export interface DiyHealthCheckResult {
  formCode: string;
  templateId: string | null;
  /** Free — this check never charges and never unlocks anything. */
  free: true;
  /** ALWAYS false. A passing health check does NOT unlock print /
   *  save / email — payment is still required (src/lib/diy.ts decideDiyUnlock). */
  unlocksPrint: false;
  score: number;
  totalWeight: number;
  earnedWeight: number;
  readyToFile: boolean;
  blockingItems: { label: string; rule: string; detail?: string }[];
  /** Plain-English fix list, blocking items first. */
  fixes: DiyHealthFix[];
  unansweredRequiredQuestions: { key: string; label: string }[];
  timelineChecks: { label: string; ok: boolean; message: string }[];
  disclaimer: string;
}

export const DIY_HEALTH_CHECK_DISCLAIMER =
  "Free checklist check, not legal advice. This score counts missing documents and " +
  "unanswered questions only — it does not decide eligibility, relief, evidence strength, " +
  "or whether it is safe to file. Only a licensed attorney or DOJ-accredited representative " +
  "gives legal advice. The packet is still a draft until you review and sign it, and nothing here files anything with USCIS.";

/** Required fields for a form, from its dynamic intake schema where
 *  one exists. Forms without a dynamic schema have no per-question
 *  list in the codebase — the checklist items still apply. */
function requiredFieldsForForm(formCode: string): DynamicField[] {
  if (!isDynamicFormCode(formCode)) return [];
  const schema = getDynamicSchema(formCode);
  if (!schema) return [];
  return schema.sections.flatMap((section) => section.fields);
}

export function runDiyHealthCheck(args: {
  formCode: string;
  /** Draft answers so far: question key -> typed value. */
  answers: Record<string, string>;
  /** Checklist item ids the client has cleared (document uploaded /
   *  section completed). Anything not listed counts as missing. */
  clearedItemIds?: string[];
}): DiyHealthCheckResult {
  const { formCode, answers } = args;
  const cleared = new Set(args.clearedItemIds ?? []);
  const templateId = diyTemplateIdForForm(formCode);

  // Checklist audit items: "pass" only when cleared by the client.
  const items: AuditItem[] = auditItemsForTemplate(templateId ?? "").map(
    (item) => ({
      ...item,
      status: cleared.has(item.id.replace(/^audit-/, ""))
        ? "pass"
        : item.status,
    })
  );
  const readiness = computePacketReadiness(items);

  // Unanswered required questions (dynamic-schema forms only).
  const unanswered = requiredFieldsForForm(formCode)
    .filter((field) => field.required)
    .filter((field) => {
      // A conditional field only counts when its showWhen condition holds.
      if (field.showWhen) {
        const current = answers[field.showWhen.field] ?? "";
        if (!field.showWhen.equals.includes(current)) return false;
      }
      const value = (answers[field.key] ?? "").trim();
      return value === "";
    })
    .map((field) => ({ key: field.key, label: field.label }));

  // Timeline validators (dynamic-schema forms only).
  const timelineChecks = isDynamicFormCode(formCode)
    ? runTimelineValidators(getDynamicSchema(formCode)!, answers)
    : [];

  const fixes: DiyHealthFix[] = [
    ...readiness.blockingItems.map((item) => ({
      kind: "missing_document" as const,
      label: item.label,
      detail:
        item.detail ??
        "This document or section is still missing — upload it or complete it before filing.",
      blocking: true,
    })),
    ...unanswered.map((q) => ({
      kind: "unanswered_question" as const,
      label: q.label,
      detail: "This required question has no answer yet.",
      blocking: true,
    })),
    ...timelineChecks
      .filter((t) => !t.ok)
      .map((t) => ({
        kind: "timeline" as const,
        label: t.label,
        detail: t.message,
        blocking: true,
      })),
  ];
  // Non-blocking failed items (warnings) go after the blocking fixes.
  for (const item of items) {
    if (!item.blocking && item.status !== "pass") {
      fixes.push({
        kind: "missing_document",
        label: item.label,
        detail: item.detail ?? "Open item — not blocking, but still to do.",
        blocking: false,
      });
    }
  }

  const timelineOk = timelineChecks.every((t) => t.ok);
  return {
    formCode,
    templateId,
    free: true,
    unlocksPrint: false,
    score: readiness.score,
    totalWeight: readiness.totalWeight,
    earnedWeight: readiness.earnedWeight,
    readyToFile:
      readiness.readyToFile && unanswered.length === 0 && timelineOk,
    blockingItems: readiness.blockingItems.map((item) => ({
      label: item.label,
      rule: item.rule,
      detail: item.detail,
    })),
    fixes,
    unansweredRequiredQuestions: unanswered,
    timelineChecks,
    disclaimer: DIY_HEALTH_CHECK_DISCLAIMER,
  };
}
