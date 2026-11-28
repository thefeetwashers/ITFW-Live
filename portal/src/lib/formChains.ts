// Form chaining for the guided DIY filing flow.
//
// Founder addition (Nov 28, 2026): when a client completes one form,
// the system tells them the OTHER form to complete next, and the other
// after that, until they finish them all — and charges a fee for
// printing / saving each one. Copying / screenshots are deterred, never
// claimed impossible (see DIY_COPY_DETERRENT_LABEL in src/lib/diy.ts).
//
// WHAT THIS FILE IS (pure — no Supabase, no Stripe, no secrets):
//   * The chain definitions: which forms follow which, in filing order,
//     each step carrying a plain-English reason why that form is next.
//   * The progress math: which step is completed / current / locked,
//     what "Form 3 of 7 — I-864 next" means, and which form comes after
//     the one just completed.
//   * The per-form print / save / email decision, reusing the EXISTING
//     DIY pay gate (decideDiyUnlock in src/lib/diy.ts) — this file
//     does NOT build a second paywall. One $25 DIY payment unlocks
//     ONE form; the $99 DIY Bundle unlocks the bundle's forms.
//
// CHAIN ORDER — sources, because the order matters and the codebase
// does not state a filing order in one place:
//   * Green Card Bundle chain: I-130 → I-130A → I-864 → I-485 → I-765
//     → I-131 → I-693.
//     - The SET of 7 forms comes from FAMILY_ADJUSTMENT_BUNDLE.forms
//       in src/lib/bundles.ts ("Family Adjustment Bundle", Basic $999 /
//       Standard $1,799 / Premium $2,799; I-130A included free with
//       I-130). That list is a set, NOT a filing order — it lists I-485
//       second, before I-130A and I-864, which cannot be the filing
//       order: I-130A is the supplement to the I-130 and I-864 is filed
//       WITH the I-485. The chain below reorders the same 7 forms into
//       filing order; the smoke test asserts set equality with the
//       bundle definition, never a different set.
//     - The filing dependencies come from the codebase itself: the
//       I-485 checklist in bundles.ts requires the I-130 receipt /
//       approval and the I-864 (sponsor tax returns) with the I-485;
//       the I-693 is the sealed medical exam collected for the I-485
//       packet (formChecklists.ts template formsIncluded
//       [I-485, I-864, I-765, I-131, I-693]) and is completed by a
//       doctor, so it goes last as a "bring it to the doctor" step.
//     - The Path Finder routes (parsePathfinderRoute in
//       src/lib/nextStepEngine.ts) only distinguish inside_us
//       (adjustment) vs outside_us (consular / NVC) — they carry no
//       per-form order, so nothing in the Path Finder contradicts
//       this order.
//   * TPS + EAD chain: I-821 → I-765. Source: the "I-821+I-765"
//     bundle template in src/lib/bundles.ts.
//   * Consular / NVC chain: I-130 → I-864 → DS-260. Source: the
//     "I-130+NVC" bundle template in src/lib/bundles.ts (I-864 + IRS
//     transcripts, NVC case number, DS-260 confirmation page).
//
// HARD RULES (kept, not re-decided here):
//   * "Check the current USCIS form edition at uscis.gov before
//     filing" (DRAFT_SCHEMA_NOTICE) on every form — no verified
//     edition is stored anywhere in this codebase, so none is printed.
//   * Packet-audit-100% + balance-paid rule before a packet is marked
//     ready — enforced by /api/generate-packet and /api/diy/packet,
//     not here. This file never marks a packet ready.
//   * Platform is a document-preparation service, NOT a law firm,
//     NOT affiliated with USCIS. Only a licensed attorney or
//     DOJ-accredited representative gives legal advice (8 CFR 292.1).
//     No AI here decides relief / eligibility / evidence strength /
//     safe-to-leave. The system never files for the client; the user
//     must review and sign before anything is submitted.
//   * Locked prices and Stripe Price IDs never change here:
//     DIY $25/form price_1UfS5APfd9SRUcvh47Ks9Lw0, DIY Bundle $99
//     price_1UfS5iPfd9SRUcvhKEQxf0pj (src/lib/stripePrices.ts).
//   * DOB / A-Number / SSN / passport are masked, never logged.
//   * Email sending is AWS SES via src/lib/email.ts — never claimed
//     sent from here.
//
// I-693 HAS NO INTAKE QUESTIONS IN THIS PORTAL. It has no registry
// schema in src/lib/dynamicIntakeSchemas.ts (the 15-schema registry
// does not include it) and no DIY Stripe price. Its chain step is a
// "doctor" step: the client books a USCIS-designated civil surgeon,
// the doctor completes and seals the form, and the doctor's fee
// ($250–$500, paid to the doctor — free booking) is separate. The
// chain never asks questions for it and never gates it behind the
// DIY $25 pay gate (there is no portal packet to print for it).
//
// I-130A IS FREE WITH I-130. There is no I-130A Stripe price by
// design (src/lib/stripePrices.ts: "NOT created, by design: I-130A
// (free with I-130)"). So the I-130A step's print / save / email
// unlock follows the I-130 payment: payGateFormCode("I-130A") is
// "I-130". The DIY Bundle ($99) unlocks it too.

import { FAMILY_ADJUSTMENT_BUNDLE } from "./bundles";
import {
  DRAFT_SCHEMA_NOTICE,
  getRegistrySchema,
} from "./dynamicIntakeSchemas";
import {
  decideDiyUnlock,
  type DiyUnlockDecision,
  type DiyUnlockEvidence,
} from "./diy";
import { getLockedPriceByKey } from "./stripePrices";

export { DRAFT_SCHEMA_NOTICE };

/** "Check the current USCIS form edition at uscis.gov before filing" —
 *  shown on every form in the chain, same wording as the DIY flow. */
export const CHAIN_EDITION_NOTICE =
  "Check the current USCIS form edition at uscis.gov before filing.";

export const CHAIN_NOT_LAW_FIRM_NOTICE =
  "Immigration with NIPTEI is a document-preparation service, not a law firm, and is not affiliated with USCIS. " +
  "Only a licensed attorney or DOJ-accredited representative gives legal advice (8 CFR 292.1). " +
  "This system never files for you — you review and sign before anything is submitted.";

// ---------------------------------------------------------------------------
// Chain definitions
// ---------------------------------------------------------------------------

export type ChainStepKind = "questions" | "doctor";

/** One step of a chain. */
export interface FormChainStep {
  formCode: string;
  /** Plain-English title (from the registry, or the I-693 doctor note). */
  title: string;
  /** Plain-English reason why THIS form is next. Shown to the client. */
  reason: string;
  /** "questions" = answered in the Dynamic Intake Engine; "doctor" =
   *  completed by a USCIS-designated civil surgeon, no questions here. */
  kind: ChainStepKind;
  /** True when the Dynamic Intake Engine has a question set for it. */
  hasIntakeSchema: boolean;
  /** Form this step is included free with, e.g. I-130A with I-130. */
  freeWith?: string;
  /** Extra plain-English note for doctor steps (no questions here). */
  doctorNote?: string;
}

export interface FormChain {
  id: string;
  name: string;
  /** Source of this chain, named so the order can be checked. */
  source: string;
  steps: FormChainStep[];
}

function step(
  formCode: string,
  reason: string,
  extra?: Partial<FormChainStep>
): FormChainStep {
  const schema = getRegistrySchema(formCode);
  return {
    formCode,
    title: schema?.title ?? `Form ${formCode}`,
    reason,
    kind: "questions",
    hasIntakeSchema: schema !== null,
    ...extra,
  };
}

export const GREEN_CARD_BUNDLE_CHAIN: FormChain = {
  id: "green-card-bundle",
  name: "Green Card Bundle — Family Adjustment",
  source:
    "Set of 7 forms: FAMILY_ADJUSTMENT_BUNDLE.forms in src/lib/bundles.ts " +
    "(I-130, I-485, I-130A, I-864, I-765, I-131, I-693). Filing order: " +
    "founder's addition Nov 28, 2026 + the codebase's own dependencies " +
    "(I-485 checklist needs the I-130 receipt and the I-864 with the I-485; " +
    "I-130A is the supplement to the I-130; I-693 is the doctor's sealed exam).",
  steps: [
    step(
      "I-130",
      "This petition starts your green card case — it proves the family relationship that USCIS must approve first."
    ),
    step(
      "I-130A",
      "This supplement goes with the I-130 — it gives USCIS the beneficiary spouse's background. It is included free with your I-130, so there is no extra DIY fee for it.",
      { freeWith: "I-130" }
    ),
    step(
      "I-864",
      "This proves your sponsor can support you financially — USCIS needs it with your I-485."
    ),
    step(
      "I-485",
      "This is the application to become a permanent resident — it is filed once the I-130 and the I-864 are ready."
    ),
    step(
      "I-765",
      "This asks for a work permit while your I-485 is pending, so you can work legally while you wait."
    ),
    step(
      "I-131",
      "This asks for permission to travel outside the United States and return while your I-485 is pending."
    ),
    {
      formCode: "I-693",
      title: "Form I-693 — Report of Immigration Medical Examination and Vaccination Record",
      reason:
        "This is the sealed medical exam for your I-485 packet — a USCIS-designated doctor completes it, so it comes last, after your forms are answered.",
      kind: "doctor",
      hasIntakeSchema: false,
      doctorNote:
        "There are no questions to answer for Form I-693 in this portal. Book a USCIS-designated civil surgeon — the doctor completes and seals the form. The doctor's fee ($250–$500) is paid to the doctor, not here, and booking is free.",
    },
  ],
};

export const TPS_EAD_CHAIN: FormChain = {
  id: "tps-ead",
  name: "TPS + Work Permit (I-821 + I-765)",
  source:
    'Bundle template "I-821+I-765" in src/lib/bundles.ts (I-821 TPS + I-765 EAD).',
  steps: [
    step(
      "I-821",
      "This applies for Temporary Protected Status — it is the main application, so it comes first."
    ),
    step(
      "I-765",
      "This asks for a work permit based on your TPS — file it with or after your I-821."
    ),
  ],
};

export const CONSULAR_NVC_CHAIN: FormChain = {
  id: "consular-nvc",
  name: "Consular / NVC (I-130 + I-864 + DS-260)",
  source:
    'Bundle template "I-130+NVC" in src/lib/bundles.ts (I-864 + IRS transcripts, NVC case number, DS-260 confirmation page).',
  steps: [
    step(
      "I-130",
      "This petition starts your case — it proves the family relationship that USCIS must approve first, before the case moves to the National Visa Center."
    ),
    step(
      "I-864",
      "This proves your sponsor can support you financially — the National Visa Center needs it before your visa interview."
    ),
    step(
      "DS-260",
      "This is the immigrant visa application you complete online in CEAC after the National Visa Center asks for it."
    ),
  ],
};

export const FORM_CHAINS: FormChain[] = [
  GREEN_CARD_BUNDLE_CHAIN,
  TPS_EAD_CHAIN,
  CONSULAR_NVC_CHAIN,
];

export function getChain(chainId: string): FormChain | null {
  return FORM_CHAINS.find((c) => c.id === chainId) ?? null;
}

/** The chain containing this form, or null for standalone forms
 *  (N-400, I-589, I-90, I-751, I-539, I-129F, I-864A) that have no
 *  next form. When a form is in more than one chain (I-130 is in the
 *  Green Card chain and the consular chain), the caller picks the
 *  chain — this helper returns the Green Card chain first. */
export function chainForForm(formCode: string): FormChain | null {
  return FORM_CHAINS.find((c) => c.steps.some((s) => s.formCode === formCode)) ?? null;
}

// ---------------------------------------------------------------------------
// Progress — pure, from a set of completed form codes
// ---------------------------------------------------------------------------

export type ChainStepStatus = "completed" | "current" | "locked";

export interface ChainStepView extends FormChainStep {
  /** 1-based position in the chain. */
  position: number;
  status: ChainStepStatus;
}

export interface ChainProgress {
  chainId: string;
  chainName: string;
  total: number;
  completedCount: number;
  /** Form codes completed, in chain order, restricted to this chain. */
  completedFormCodes: string[];
  /** First uncompleted step, or null when every step is done. */
  currentStep: FormChainStep | null;
  /** 1-based position of the current step, or null when complete. */
  currentPosition: number | null;
  /** "Form 3 of 7 — I-864 next" / "All 7 forms complete". */
  label: string;
  complete: boolean;
  steps: ChainStepView[];
}

/**
 * Progress across the whole chain. A form already completed can be
 * revisited (status "completed"); a form not yet reached is "locked"
 * — never shown as completed. Completion is only ever read from the
 * completed set passed in (server: saved answers / submitted drafts;
 * session: the form just finished in the DIY flow) — never guessed.
 */
export function chainProgress(
  chain: FormChain,
  completedFormCodes: string[]
): ChainProgress {
  const completedSet = new Set(
    completedFormCodes.filter((c) => chain.steps.some((s) => s.formCode === c))
  );
  const steps: ChainStepView[] = chain.steps.map((s, i) => ({
    ...s,
    position: i + 1,
    status: completedSet.has(s.formCode)
      ? "completed"
      : i === chain.steps.findIndex((x) => !completedSet.has(x.formCode))
        ? "current"
        : "locked",
  }));
  const currentIndex = chain.steps.findIndex((s) => !completedSet.has(s.formCode));
  const currentStep = currentIndex === -1 ? null : chain.steps[currentIndex];
  const completedCount = completedSet.size;
  const total = chain.steps.length;
  return {
    chainId: chain.id,
    chainName: chain.name,
    total,
    completedCount,
    completedFormCodes: chain.steps
      .filter((s) => completedSet.has(s.formCode))
      .map((s) => s.formCode),
    currentStep,
    currentPosition: currentIndex === -1 ? null : currentIndex + 1,
    label:
      currentStep === null
        ? `All ${total} forms complete`
        : `Form ${currentIndex + 1} of ${total} — ${currentStep.formCode} next`,
    complete: currentIndex === -1,
    steps,
  };
}

/**
 * The step that follows the form just completed — the "what's next"
 * prompt. When the just-completed form is not the last uncompleted
 * step (e.g. the client revisited an earlier form), the next step is
 * still the first uncompleted step in chain order, so the client is
 * never sent backwards. Returns null when the chain is complete.
 */
export function nextStepAfter(
  chain: FormChain,
  completedFormCodes: string[]
): FormChainStep | null {
  return chainProgress(chain, completedFormCodes).currentStep;
}

/** True when every chain step is in the completed set. */
export function isChainComplete(chain: FormChain, completedFormCodes: string[]): boolean {
  return chainProgress(chain, completedFormCodes).complete;
}

// ---------------------------------------------------------------------------
// Per-form print / save / email unlock — REUSES the existing DIY gate
// ---------------------------------------------------------------------------

/**
 * Which form code the DIY pay gate is checked against. I-130A is free
 * with I-130, so its unlock follows the I-130 payment (there is no
 * I-130A Stripe price by design). I-693 has no portal packet — the
 * doctor completes and seals it — so there is no DIY gate for it.
 */
export function payGateFormCode(formCode: string): string | null {
  if (formCode === "I-130A") return "I-130";
  if (formCode === "I-693") return null;
  return formCode;
}

export interface ChainFormUnlock {
  formCode: string;
  /** False for I-693: no DIY print / save / email exists for it. */
  applicable: boolean;
  unlocked: boolean;
  reason: string;
  unlockedBy: DiyUnlockDecision["unlockedBy"];
  /** Locked Stripe price key that unlocks it, or null when no payment
   *  is needed / not applicable. */
  unlockPriceKey: "diy_form" | "diy_bundle" | null;
  unlockLabel: string | null;
}

/**
 * Per-form print / save / email decision. Delegates to decideDiyUnlock
 * (src/lib/diy.ts) — the same gate /api/diy/packet enforces — so a
 * form whose DIY fee is unpaid stays locked for print / save / email
 * even if it is completed. Payment is confirmed in the database, never
 * a front-end flag: the evidence here is read server-side by
 * /api/diy/chain-status from getDiyUnlockForCase().
 */
export function decideChainFormUnlock(
  evidence: DiyUnlockEvidence,
  formCode: string
): ChainFormUnlock {
  if (formCode === "I-693") {
    return {
      formCode,
      applicable: false,
      unlocked: false,
      reason:
        "Form I-693 has no print / save / email unlock here — a USCIS-designated doctor completes and seals it, and the doctor's fee ($250–$500) is paid to the doctor.",
      unlockedBy: null,
      unlockPriceKey: null,
      unlockLabel: null,
    };
  }
  const gateCode = payGateFormCode(formCode) ?? formCode;
  const decision = decideDiyUnlock(evidence, gateCode);
  const unlockPriceKey: "diy_form" | "diy_bundle" | null =
    decision.unlocked || decision.unlockedBy === "admin_founder_support"
      ? null
      : "diy_form";
  return {
    formCode,
    applicable: true,
    unlocked: decision.unlocked,
    reason:
      formCode === "I-130A" && decision.unlocked
        ? `DIY payment confirmed for Form I-130 (I-130A is included free with I-130) — print, save and email are unlocked for Form I-130A.`
        : formCode === "I-130A"
          ? `Pay first to print, save or email Form I-130A — it is included free with I-130, so paying the DIY $25 for Form I-130 (or the $99 DIY Bundle) unlocks it.`
          : decision.reason,
    unlockedBy: decision.unlockedBy,
    unlockPriceKey,
    unlockLabel: unlockPriceKey
      ? "DIY — $25/form (or DIY Bundle $99)"
      : null,
  };
}

/** Locked DIY prices, from src/lib/stripePrices.ts — never changed here. */
export function chainDiyPrices(): {
  single: { priceId: string; label: string; amountCents: number };
  bundle: { priceId: string; label: string; amountCents: number };
} {
  const single = getLockedPriceByKey("diy_form");
  const bundle = getLockedPriceByKey("diy_bundle");
  if (!single || !bundle) {
    throw new Error(
      "Locked DIY prices diy_form / diy_bundle are missing from src/lib/stripePrices.ts — do not guess Price IDs."
    );
  }
  return {
    single: { priceId: single.priceId, label: single.label, amountCents: single.amountCents },
    bundle: { priceId: bundle.priceId, label: bundle.label, amountCents: bundle.amountCents },
  };
}

// ---------------------------------------------------------------------------
// Chain validation — the smoke test asserts these
// ---------------------------------------------------------------------------

export interface ChainValidationIssue {
  chainId: string;
  issue: string;
}

export function validateChains(): ChainValidationIssue[] {
  const issues: ChainValidationIssue[] = [];
  for (const chain of FORM_CHAINS) {
    const codes = chain.steps.map((s) => s.formCode);
    if (new Set(codes).size !== codes.length) {
      issues.push({ chainId: chain.id, issue: `duplicate form code in chain ${chain.id}` });
    }
    for (const s of chain.steps) {
      if (!s.reason || s.reason.trim().length < 20) {
        issues.push({ chainId: chain.id, issue: `step ${s.formCode} has no plain-English reason` });
      }
      if (s.kind === "questions" && !s.hasIntakeSchema) {
        issues.push({
          chainId: chain.id,
          issue: `step ${s.formCode} is a questions step but has no Dynamic Intake Engine schema`,
        });
      }
      if (s.kind === "doctor" && s.hasIntakeSchema) {
        issues.push({
          chainId: chain.id,
          issue: `step ${s.formCode} is a doctor step but claims an intake schema`,
        });
      }
    }
  }
  // Green Card chain must contain exactly the bundle's 7 forms (set).
  const bundleSet = new Set(FAMILY_ADJUSTMENT_BUNDLE.forms);
  const chainSet = new Set(GREEN_CARD_BUNDLE_CHAIN.steps.map((s) => s.formCode));
  if (
    bundleSet.size !== chainSet.size ||
    Array.from(bundleSet).some((f) => !chainSet.has(f))
  ) {
    issues.push({
      chainId: GREEN_CARD_BUNDLE_CHAIN.id,
      issue: `Green Card chain set does not match FAMILY_ADJUSTMENT_BUNDLE.forms (${FAMILY_ADJUSTMENT_BUNDLE.forms.join(", ")})`,
    });
  }
  return issues;
}

export function allChainsValid(): boolean {
  return validateChains().length === 0;
}
