// Service → tier → features → permissions mapping (service-linked sync).
// Source of truth for what a client gets when they order a service at a
// tier. Wired into the case creator (createCaseFromOrder), the client
// portal (TierSummary), and the permissions matrix.
//
// LOCKED PRICES (do not invent others):
//  * Family Adjustment Bundle: Basic $999 / Standard $1,799 / Premium
//    $2,799 (src/lib/order.ts, src/lib/bundles.ts — locked).
//  * Single-form tiers, from the locked price list in
//    src/lib/formChecklists.ts: I-130 $299/$499/$750 · I-485
//    $750/$1,200/$1,500 · I-821 $189/$295/$400 · I-765 $129/$249/$350 ·
//    N-400 $199/$400/$600 · I-589 $900/$1,050/$1,200 · I-90 $129/$240/$350
//    · I-864 $99/$175/$250 · I-131 $250/$325/$400 · I-751 $139/$295/$449
//    · I-539 $250/$375/$500 · I-129F $750/$925/$1,095 (expanded forms,
//    locked tiers per src/lib/dynamicIntakeSchemas.ts — the paste's
//    example tiers are NOT used). FLAG: bundles.ts still marks I-765, I-90 and
//    I-864 service fees TO BE CONFIRMED — reconcile bundles.ts before
//    quoting those three from anywhere else; this file uses the
//    formChecklists locked list and says so.
//  * DIY $25 / Review $99 / Human Review $199 / Member $9.80/mo: given
//    in the task brief for this build (2026-11-19). No earlier locked
//    list in the repo confirms them — they are recorded here as
//    brief-given, not repo-locked, and must not be presented as verified
//    anywhere else until the founder confirms them in the price list.
//  * Payment plans (locked, order.ts): Pay in Full / Pay in 3 /
//    Monthly 6 / Monthly 12. No 50/50 split for immigration.
//  * USCIS government fees are ALWAYS separate, never added to the
//    service total. Locked gov fees only: I-485 paper $1,440 · I-821
//    TPS $520 · I-589 $100 + $105/year · NVC AOS $120 + IV $325 (CEAC)
//    · I-751 paper $750. Everything else is TO BE CONFIRMED.
//
// PREMIUM HONESTY RULE: no Premium-only feature is defined in the
// locked tier definitions anywhere in this repo. Basic, Standard and
// Premium differ in the locked definitions ONLY by price (same 7-form
// bundle). This file therefore gives them the SAME feature set and
// marks Premium extras "TO BE CONFIRMED by the founder" — it does NOT
// invent Premium perks.
import { FORM_CHECKLIST_TEMPLATES, type FormChecklistTemplate } from "./formChecklists";
import { FAMILY_ADJUSTMENT_BUNDLE } from "./bundles";
import type { PaymentPlanType } from "./order";
import type { LanguageCode } from "./i18n";

export type ServiceTierId =
  | "diy"
  | "review"
  | "human_review"
  | "basic"
  | "standard"
  | "premium"
  | "member";

export type BundleTierId = "basic" | "standard" | "premium";

export interface TierFeature {
  id: string;
  label: string;
}

export const ALL_FEATURES: TierFeature[] = [
  { id: "self_serve_forms", label: "Self-serve forms and checklists" },
  { id: "document_checklist", label: "Document checklist from lib/formChecklists" },
  { id: "packet_audit", label: "Packet audit (filing ready only at 100%)" },
  { id: "provider_document_review", label: "Provider document review (one review pass)" },
  { id: "human_review", label: "Human review by your assigned professional" },
  { id: "provider_messaging", label: "Message your professional in the unified thread" },
  { id: "assigned_professional", label: "Assigned professional for your case" },
  { id: "interview_prep", label: "Interview preparation checklist" },
  { id: "esign", label: "E-Sign your packet (after the balance is paid in full)" },
  { id: "payment_plan", label: "Payment plan (Pay in Full / Pay in 3 / Monthly 6 / 12)" },
  { id: "family_invites", label: "Family member / co-sponsor invites (scoped slots only)" },
  { id: "renewal_reminders", label: "Renewal reminders (EAD / Green Card / N-400 eligibility date)" },
];

export interface ServiceTierDef {
  id: ServiceTierId;
  label: string;
  /** Dollars, or null when the price is not a locked service price. */
  priceUsd: number | null;
  priceNote: string;
  /** "bundle" = Family Adjustment Bundle tiers; "self_serve" = DIY/Review/
   *  Human Review; "single_form" = priced per form in formChecklists;
   *  "subscription" = Member $9.80/mo. */
  kind: "bundle" | "self_serve" | "single_form" | "subscription";
  features: string[];
  /** What the client does NOT get at this tier — shown in plain English. */
  notIncluded: string[];
  /** Which professional type is assigned for this service/tier. */
  professionalType: "none" | "preparer" | "attorney" | "nonprofit";
  professionalTypeNote: string;
}

export const SERVICE_TIERS: ServiceTierDef[] = [
  {
    id: "diy", label: "DIY — $25", priceUsd: 25,
    priceNote: "Per task brief 2026-11-19; not in an earlier repo locked list.",
    kind: "self_serve",
    features: ["self_serve_forms", "document_checklist", "packet_audit"],
    notIncluded: [
      "No assigned professional — the Preparer section stays blank.",
      "No messaging with a professional.",
      "No provider document review and no human review.",
      "No provider E-Sign packet — you sign your own forms yourself.",
    ],
    professionalType: "none",
    professionalTypeNote: "DIY is self-serve. No preparer, attorney, or nonprofit is assigned.",
  },
  {
    id: "review", label: "Review — $99", priceUsd: 99,
    priceNote: "Per task brief 2026-11-19; not in an earlier repo locked list.",
    kind: "self_serve",
    features: ["self_serve_forms", "document_checklist", "packet_audit", "provider_document_review"],
    notIncluded: [
      "One provider document-review pass only — the review findings are shown in your portal.",
      "No live messaging with a professional.",
      "No human drafting and no assigned professional for ongoing help.",
      "No E-Sign packet from a provider.",
    ],
    professionalType: "preparer",
    professionalTypeNote: "A preparer reviews your documents once. No legal advice, no G-28.",
  },
  {
    id: "human_review", label: "Human Review — $199", priceUsd: 199,
    priceNote: "Per task brief 2026-11-19; not in an earlier repo locked list.",
    kind: "self_serve",
    features: ["self_serve_forms", "document_checklist", "packet_audit", "provider_document_review", "human_review", "provider_messaging"],
    notIncluded: [
      "Human review of your documents and forms — not full preparation or filing.",
      "No assigned professional for ongoing case work.",
      "No E-Sign packet from a provider.",
    ],
    professionalType: "preparer",
    professionalTypeNote: "A preparer reviews your work and messages you in the thread. No legal advice, no G-28.",
  },
  {
    id: "basic", label: "Basic — $999", priceUsd: 999,
    priceNote: "Locked Family Adjustment Bundle price (order.ts / bundles.ts).",
    kind: "bundle",
    features: ["self_serve_forms", "document_checklist", "packet_audit", "provider_document_review", "human_review", "provider_messaging", "assigned_professional", "interview_prep", "esign", "payment_plan", "family_invites", "renewal_reminders"],
    notIncluded: [
      "USCIS government fees are separate — never included in the $999.",
      "No Premium-tier service: a Basic-tier client cannot get Premium-tier services.",
    ],
    professionalType: "preparer",
    professionalTypeNote: "A preparer is assigned by default (clerical help only). Attorney / nonprofit only if the client chooses that service option.",
  },
  {
    id: "standard", label: "Standard — $1,799", priceUsd: 1799,
    priceNote: "Locked Family Adjustment Bundle price (order.ts / bundles.ts).",
    kind: "bundle",
    features: ["self_serve_forms", "document_checklist", "packet_audit", "provider_document_review", "human_review", "provider_messaging", "assigned_professional", "interview_prep", "esign", "payment_plan", "family_invites", "renewal_reminders"],
    notIncluded: [
      "USCIS government fees are separate — never included in the $1,799.",
      "No Premium-tier service: a Standard-tier client cannot get Premium-tier services.",
      "No Premium-only feature is defined in the locked tier definitions — Standard and Basic share the same feature set; they differ by price.",
    ],
    professionalType: "preparer",
    professionalTypeNote: "A preparer is assigned by default (clerical help only). Attorney / nonprofit only if the client chooses that service option.",
  },
  {
    id: "premium", label: "Premium — $2,799", priceUsd: 2799,
    priceNote: "Locked Family Adjustment Bundle price (order.ts / bundles.ts).",
    kind: "bundle",
    features: ["self_serve_forms", "document_checklist", "packet_audit", "provider_document_review", "human_review", "provider_messaging", "assigned_professional", "interview_prep", "esign", "payment_plan", "family_invites", "renewal_reminders"],
    notIncluded: [
      "USCIS government fees are separate — never included in the $2,799.",
      "Premium extras are TO BE CONFIRMED by the founder. No Premium-only feature is defined in the locked tier definitions in this repo, so none is invented here.",
    ],
    professionalType: "preparer",
    professionalTypeNote: "A preparer is assigned by default (clerical help only). Attorney / nonprofit only if the client chooses that service option.",
  },
  {
    id: "member", label: "Member — $9.80/mo or $98/yr", priceUsd: 9.8,
    priceNote: "Per task brief 2026-11-19; $9.80/mo or $98/yr (locked). What membership includes is TO BE CONFIRMED by the founder.",
    kind: "subscription",
    features: ["self_serve_forms", "document_checklist"],
    notIncluded: [
      "Membership features beyond self-serve forms and checklists are TO BE CONFIRMED — nothing else is promised at $9.80/mo.",
      "No assigned professional, no messaging, no review, no E-Sign packet unless the founder confirms it.",
    ],
    professionalType: "none",
    professionalTypeNote: "Membership alone assigns no professional. A service tier (DIY / Review / Human Review / Basic / Standard / Premium) is what assigns one.",
  },
];

/** Single-form tier prices, from the locked list in formChecklists.ts
 *  (see the header flag about bundles.ts marking three of them TBC). */
export const SINGLE_FORM_TIER_PRICES: Record<string, { basic: number; standard: number; premium: number }> = {
  "I-130": { basic: 299, standard: 499, premium: 750 },
  "I-485": { basic: 750, standard: 1200, premium: 1500 },
  "I-821": { basic: 189, standard: 295, premium: 400 },
  "I-765": { basic: 129, standard: 249, premium: 350 },
  "N-400": { basic: 199, standard: 400, premium: 600 },
  "I-589": { basic: 900, standard: 1050, premium: 1200 },
  "I-90": { basic: 129, standard: 240, premium: 350 },
  "I-864": { basic: 99, standard: 175, premium: 250 },
  "I-131": { basic: 250, standard: 325, premium: 400 },
  "I-751": { basic: 139, standard: 295, premium: 449 },
  "I-539": { basic: 250, standard: 375, premium: 500 },
  "I-129F": { basic: 750, standard: 925, premium: 1095 },
};

/** Form code -> checklist template id (lib/formChecklists). This mapping
 *  is local to this file because templateIdForService() in
 *  formChecklists.ts only covers lead-sheet services (no I-765 / I-90 /
 *  I-864 case) — it is not edited here. */
export const TEMPLATE_ID_FOR_FORM: Record<string, string> = {
  "I-130": "i130-nvc",
  "I-485": "i485",
  "I-821": "i821-i765",
  "I-765": "i821-i765",
  "N-400": "n400",
  "I-589": "i589",
  "I-90": "i90",
  "I-864": "i864",
  "I-131": "i131",
  "I-751": "i751",
  "I-539": "i539",
  "I-129F": "i129f",
  "family-adjustment-bundle": "family-adjustment",
};

export function tierDef(id: ServiceTierId): ServiceTierDef {
  const found = SERVICE_TIERS.find((t) => t.id === id);
  if (!found) throw new Error(`Unknown service tier: ${id}`);
  return found;
}

export function featureLabels(ids: string[]): string[] {
  return ids.map((id) => ALL_FEATURES.find((f) => f.id === id)?.label ?? id);
}

/** Locked gov-fee estimate (cents) for a checklist template: locked,
 *  one-off, always-applicable gov fees only. TBC lines are excluded. */
export function lockedGovFeeCentsForTemplate(template: FormChecklistTemplate): number {
  return template.govFees.reduce(
    (sum, line) =>
      line.locked && !line.recurring && !line.appliesOnly && line.amountCents !== null
        ? sum + line.amountCents
        : sum,
    0
  );
}

export interface CaseSyncPlan {
  /** (a) Case created with these ordered forms + tier. */
  orderedForms: string[];
  tier: ServiceTierId;
  tierLabel: string;
  /** (b) Checklist template loaded from lib/formChecklists. */
  checklistTemplateId: string;
  checklistItemCount: number;
  /** (c) Payment plan + invoice (locked prices only). */
  paymentPlanType: PaymentPlanType;
  totalServiceFeeCents: number;
  estimatedUscisGovFeeCents: number;
  govFeeNote: string;
  /** (d) Dashboard features for this tier. */
  features: string[];
  featureLabels: string[];
  notIncluded: string[];
  /** (e) Professional type assigned for this service. */
  professionalType: ServiceTierDef["professionalType"];
  professionalTypeNote: string;
  /** (f) Plain-English summary for the client, in their language code
   *  (English text here; translated through the translate route when
   *  Google Cloud Translation is connected — never a fake translation). */
  plainEnglish: string;
  clientLanguage: LanguageCode;
}

/**
 * Service-linked sync: given what the client ordered, build the whole
 * case plan in one place. Pure function — no Supabase, no Stripe, no
 * sending. The caller that writes the real case / service_orders rows
 * (once Supabase is live) must use exactly this plan.
 *
 * service: a form code ("I-130", "I-485", …) or
 * "family-adjustment-bundle". tier: the tier ordered. plan: the locked
 * payment plan. serviceOption: the help the client asked for
 * ("diy" | "preparer" | "attorney" | "nonprofit") — attorney/nonprofit
 * override the default preparer assignment for bundle tiers.
 */
export function createCaseFromOrder(args: {
  service: string;
  tier: ServiceTierId;
  paymentPlanType: PaymentPlanType;
  serviceOption?: "diy" | "preparer" | "attorney" | "nonprofit";
  clientLanguage?: LanguageCode;
}): CaseSyncPlan {
  const { service, tier, paymentPlanType } = args;
  const serviceOption = args.serviceOption ?? "preparer";
  const clientLanguage = args.clientLanguage ?? "en";
  const def = tierDef(tier);
  const isBundle = service === "family-adjustment-bundle";
  const templateId = TEMPLATE_ID_FOR_FORM[service];
  if (!templateId) throw new Error(`No form checklist template for service: ${service} — TO BE CONFIRMED, never invented.`);
  const template = FORM_CHECKLIST_TEMPLATES.find((t) => t.id === templateId);
  if (!template) throw new Error(`No form checklist template for service: ${service}`);

  const orderedForms = isBundle ? [...FAMILY_ADJUSTMENT_BUNDLE.forms] : [...template.formsIncluded];
  let totalServiceFeeCents: number;
  if (isBundle) {
    if (tier !== "basic" && tier !== "standard" && tier !== "premium") {
      throw new Error(`Family Adjustment Bundle needs a Basic / Standard / Premium tier, not ${tier}.`);
    }
    totalServiceFeeCents = FAMILY_ADJUSTMENT_BUNDLE.price[tier] * 100;
  } else if (tier === "basic" || tier === "standard" || tier === "premium") {
    const prices = SINGLE_FORM_TIER_PRICES[service];
    if (!prices) throw new Error(`No locked single-form tier price for ${service} — TO BE CONFIRMED, never invented.`);
    totalServiceFeeCents = prices[tier] * 100;
  } else {
    if (def.priceUsd === null) throw new Error(`No locked price for tier ${tier}.`);
    totalServiceFeeCents = Math.round(def.priceUsd * 100);
  }

  let professionalType = def.professionalType;
  let professionalTypeNote = def.professionalTypeNote;
  if (tier === "basic" || tier === "standard" || tier === "premium") {
    if (serviceOption === "attorney") {
      professionalType = "attorney";
      professionalTypeNote = "Client chose attorney help — a verified licensed attorney is assigned. Only an attorney gives legal advice.";
    } else if (serviceOption === "nonprofit") {
      professionalType = "nonprofit";
      professionalTypeNote = "Client chose nonprofit help — a DOJ-accredited representative is assigned, within the accreditation.";
    } else if (serviceOption === "diy") {
      throw new Error("A Basic / Standard / Premium bundle cannot be DIY — DIY has no assigned professional. Use the DIY tier instead.");
    }
  }

  const govCents = lockedGovFeeCentsForTemplate(template);
  const plainEnglish =
    `Your ${isBundle ? "Family Adjustment Bundle" : template.name} at ${def.label} includes: ` +
    `${featureLabels(def.features).join("; ")}. ` +
    `It does not include: ${def.notIncluded.join(" ")} ` +
    `Your service fee is $${(totalServiceFeeCents / 100).toLocaleString("en-US")}. ` +
    `Government (USCIS) fees are separate — estimated locked government fees on this service: $${(govCents / 100).toLocaleString("en-US")}. ` +
    `Any government fee not on the locked list is TO BE CONFIRMED at uscis.gov/fees before you pay it.`;

  return {
    orderedForms,
    tier,
    tierLabel: def.label,
    checklistTemplateId: template.id,
    checklistItemCount: template.checklist.length,
    paymentPlanType,
    totalServiceFeeCents,
    estimatedUscisGovFeeCents: govCents,
    govFeeNote: template.govTotalNote,
    features: [...def.features],
    featureLabels: featureLabels(def.features),
    notIncluded: [...def.notIncluded],
    professionalType,
    professionalTypeNote,
    plainEnglish,
    clientLanguage,
  };
}
