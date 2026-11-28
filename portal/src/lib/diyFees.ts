// DIY fee calculator — shown BEFORE the client pays.
//
// WHY THIS FILE EXISTS: a DIY client is about to pay two different
// parties — us (the document-preparation fee) and USCIS (the
// government filing fee). Showing one combined number hides which
// money goes where, so this calculator NEVER combines them. There is
// deliberately NO `totalCents` / `total` field on the result: the
// caller cannot render a single combined total from this module.
//
// SOURCES (locked, reused — nothing invented here):
//   * Our fee: locked Stripe Prices in src/lib/stripePrices.ts —
//     DIY $25/form (diy_form, price_1UfS5APfd9SRUcvh47Ks9Lw0) and
//     DIY Bundle $99 (diy_bundle, price_1UfS5iPfd9SRUcvhKEQxf0pj).
//   * Government fees: the checklist template for the form in
//     src/lib/formChecklists.ts — LOCKED lines carry cents, TO BE
//     CONFIRMED lines carry no cents and are never counted.
//   * Fee-waiver pointer: USCIS Form I-912 exists in the locked price
//     list (i-912_basic $39) — the note below only says the form
//     exists and to check uscis.gov. This platform does NOT decide
//     whether anyone qualifies for a waiver.
//
// Every result carries GOV_FEE_DISCLAIMER: confirm the current USCIS
// fee at uscis.gov/fees before paying.

import {
  getTemplate,
  templateIdForDynamicForm,
  templateIdForService,
  type FormChecklistTemplate,
  type GovFeeLine,
} from "./formChecklists";
import { getLockedPriceByKey } from "./stripePrices";
import { USCIS_FEE_SCHEDULE_URL } from "./fees";

export { USCIS_FEE_SCHEDULE_URL };

export const GOV_FEE_DISCLAIMER =
  "Government fees change. Confirm the current USCIS fee at uscis.gov/fees before you pay.";

export const DIY_FEE_WAIVER_NOTE =
  "If you cannot afford the USCIS fee, USCIS Form I-912 (Request for Fee Waiver) exists — " +
  "check whether it applies to your form at uscis.gov. This platform does not decide whether you qualify for a fee waiver.";

/** Checklist template id for a DIY form code. Shared templates are
 *  labelled — e.g. I-765 alone has no own template, so it reuses the
 *  I-821 + I-765 template and the result says so. Null = no template
 *  in the codebase for this form (never guess one). */
export function diyTemplateIdForForm(formCode: string): string | null {
  switch (formCode) {
    case "I-130":
      return templateIdForService("I-130");
    case "I-485":
      return templateIdForService("I-485");
    case "N-400":
      return templateIdForService("N-400");
    case "I-589":
      return templateIdForService("I-589");
    case "I-821":
      return templateIdForService("I-821");
    case "I-131":
      return templateIdForDynamicForm("I-131");
    case "I-751":
      return templateIdForDynamicForm("I-751");
    case "I-539":
      return templateIdForDynamicForm("I-539");
    case "I-129F":
      return templateIdForDynamicForm("I-129F");
    // Shared templates — the result names the template it came from.
    case "I-765":
      return "i821-i765"; // I-821 TPS + I-765 EAD template
    case "I-864":
      return "i864";
    case "I-90":
      return "i90";
    case "DS-260":
    case "I-130A":
      return "i130-nvc"; // I-130 + NVC Consular template
    case "I-864A":
      return "i864";
    default:
      return null;
  }
}

export interface DiyFeeLine {
  kind: "our_fee" | "uscis_government" | "other_government";
  label: string;
  /** Integer cents. Null = TO BE CONFIRMED — never counted, never charged. */
  amountCents: number | null;
  locked: boolean;
  note?: string;
}

export interface DiyFeeBreakdown {
  formCode: string;
  templateId: string | null;
  templateName: string | null;
  /** Our fee only — DIY $25/form or DIY Bundle $99 (locked). */
  ourFee: DiyFeeLine;
  /** Government fee lines — USCIS (and DOS, where the template lists
   *  one) — each its own line, never folded into our fee. */
  governmentFees: DiyFeeLine[];
  /** Sum of LOCKED government lines only. Null when no government
   *  line is locked — there is then no verified government total. */
  lockedGovernmentTotalCents: number | null;
  /** True when any government line is TO BE CONFIRMED. */
  hasUnconfirmedGovernmentFee: boolean;
  feeWaiverNote: string;
  disclaimer: string;
  /** Deliberately absent: no combined total. Our fee and government
   *  fees are paid to different parties and are never added together
   *  into one charge. */
}

function govLineKind(line: GovFeeLine): DiyFeeLine["kind"] {
  return line.label.startsWith("DOS fee") ? "other_government" : "uscis_government";
}

/**
 * Fee breakdown for one DIY form. `bundle=true` prices the DIY
 * Bundle ($99, covers the form as part of the bundle) instead of
 * the per-form DIY price ($25). Government fees are identical either
 * way — the bundle covers our preparation fee only, never USCIS fees.
 */
export function diyFeeBreakdown(
  formCode: string,
  opts: { bundle?: boolean } = {}
): DiyFeeBreakdown {
  const bundle = opts.bundle === true;
  const ourPrice = getLockedPriceByKey(bundle ? "diy_bundle" : "diy_form");
  const ourFee: DiyFeeLine = {
    kind: "our_fee",
    label: bundle
      ? "Our fee — DIY Bundle (preparation only)"
      : `Our fee — DIY, Form ${formCode} (preparation only)`,
    amountCents: ourPrice?.amountCents ?? null,
    locked: Boolean(ourPrice),
    note: bundle
      ? "DIY Bundle $99 (locked) — covers our preparation fee for the forms in the bundle. USCIS government fees are separate and are NOT included."
      : "DIY $25 per form (locked) — our preparation fee only. USCIS government fees are separate and are NOT included.",
  };

  const templateId = diyTemplateIdForForm(formCode);
  const template: FormChecklistTemplate | null = templateId
    ? getTemplate(templateId)
    : null;
  const governmentFees: DiyFeeLine[] = (template?.govFees ?? []).map((line) => ({
    kind: govLineKind(line),
    label: line.label,
    amountCents: line.amountCents,
    locked: line.locked,
    note: line.note,
  }));
  const lockedSum = governmentFees.reduce(
    (sum, line) =>
      line.locked && line.amountCents !== null ? sum + line.amountCents : sum,
    0
  );
  const hasLocked = governmentFees.some(
    (line) => line.locked && line.amountCents !== null
  );
  return {
    formCode,
    templateId,
    templateName: template?.name ?? null,
    ourFee,
    governmentFees,
    lockedGovernmentTotalCents: hasLocked ? lockedSum : null,
    hasUnconfirmedGovernmentFee: governmentFees.some((line) => !line.locked),
    feeWaiverNote: DIY_FEE_WAIVER_NOTE,
    disclaimer: GOV_FEE_DISCLAIMER,
  };
}

/** Bundle vs per-form comparison, locked prices only. Pure arithmetic:
 *  n forms at $25 each vs the $99 bundle. Never a recommendation —
 *  the client picks. */
export function diyBundleComparison(formCount: number): {
  perFormCents: number;
  bundleCents: number;
  bundleSavesCents: number;
  note: string;
} {
  const perForm = getLockedPriceByKey("diy_form")?.amountCents ?? 2500;
  const bundle = getLockedPriceByKey("diy_bundle")?.amountCents ?? 9900;
  const perFormCents = Math.max(0, Math.floor(formCount)) * perForm;
  return {
    perFormCents,
    bundleCents: bundle,
    bundleSavesCents: perFormCents - bundle,
    note:
      "DIY $25 per form vs DIY Bundle $99 (locked prices). " +
      "Both cover our preparation fee only — USCIS government fees are separate either way.",
  };
}

export function formatDiyCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US")}`;
}
