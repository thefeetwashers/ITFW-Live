// Lead Sheet & 6-Stage Lifecycle Engine — definitions only, no live data.
// Stages: 1 New Lead → 2 Consultation / Quote Sent → 3 Payment
// Arrangement / Invoice Sent → 4 Active Client (Docs & Drafting) →
// 5 Submitted to USCIS / Approved / NVC Guidance (sub-stages 5A At USCIS,
// 5B USCIS Approved → At NVC) → 6 Visa Approved, Travel & Flight Prep /
// Closed.
//
// CORRECTIONS / PRICE RULES (do not weaken these):
// - Names, phones and prices in the founder's pastes are EXAMPLE only.
//   Pasted examples ($1,200 / $600 / $300 Dec 1, $350 N-400, $550
//   N-400+I-90) are NOT used as prices anywhere in this file.
// - Locked bundle prices only: Family Adjustment Bundle Basic $999 /
//   Standard $1,799 / Premium $2,799. Locked single-form service fees
//   come from lib/bundles.ts. Anything else is EXAMPLE / TO BE CONFIRMED.
// - $675 I-130 USCIS fee is NOT verified — TO BE CONFIRMED. Never show
//   it as a locked fee.
// - NVC fees are shown separately, never as a lump: AOS $120 + IV $325.
//   Do not present a $445 total.
// - Locked payment plans only (lib/order.ts, lib/stripe.ts): Pay in Full
//   / Pay in 3 / Monthly 6 / Monthly 12. There is NO locked "50/50 Split"
//   plan for immigration bundles.
// - Service (preparer) fees and USCIS / NVC government fees are ALWAYS
//   separate, never combined into one total.
// - State here is local / EXAMPLE only. Shared Supabase state is to be
//   wired in a later step — do NOT claim live sync.
import type { LanguageCode } from "./i18n";
import { BUNDLE_TEMPLATES, FAMILY_ADJUSTMENT_BUNDLE } from "./bundles";
import type { PaymentPlanType } from "./order";
import { USCIS_FEE_SCHEDULE_URL } from "./fees";
import { CEAC_LOGIN_URL } from "./agency";

export { USCIS_FEE_SCHEDULE_URL, CEAC_LOGIN_URL };

export type LifecycleStageId =
  | "new_lead"
  | "consultation_quote"
  | "payment_arrangement"
  | "active_client"
  | "submitted_uscis"
  | "visa_approved_closed";

export type Stage5SubStage = "5A" | "5B";

export interface LifecycleStageDef {
  id: LifecycleStageId;
  number: string;
  title: string;
  shortLabel: string;
  /** What the preparer does / checks at this stage. */
  preparerNote: string;
  /** Plain-English heading shown to the client / family. */
  clientHeading: string;
  /** "Where your application is right now" — plain English. */
  clientWhere: string;
  /** "What happens next" — full guidance, one item per step. */
  clientNext: string[];
  /** What the client / family should do or watch for. */
  clientAction: string;
}

export const LIFECYCLE_STAGES: LifecycleStageDef[] = [
  {
    id: "new_lead",
    number: "1",
    title: "New Lead (Inquiry)",
    shortLabel: "New Lead",
    preparerNote:
      "A person asked about help. Record name, phone/WhatsApp, email, preferred language, referral source and what they need. Reply promptly in their preferred language. Nothing is filed and no fee is promised yet.",
    clientHeading: "Where Your Application Is Right Now & What Happens Next — Stage 1: We Have Your Inquiry",
    clientWhere:
      "You asked us about immigration help and we have your name and contact details. Nothing has been filed with USCIS yet, and no government case number exists yet. That is normal at this stage.",
    clientNext: [
      "We will contact you by phone, WhatsApp, or email — whichever you gave us — to learn what you need.",
      "We will ask a few simple questions: who is petitioning for whom, where each person lives now, and what immigration status each person has today.",
      "We will tell you honestly whether this is a form we can help prepare, and what documents we would need from you.",
      "If we cannot help with your type of case, we will say so plainly instead of taking your money.",
    ],
    clientAction:
      "Keep your phone nearby and check your email and WhatsApp. Have your passport and any immigration papers you already have close by, so you can answer our first questions. Do not pay anyone anything yet — no fee is due at the inquiry stage.",
  },
  {
    id: "consultation_quote",
    number: "2",
    title: "Consultation / Quote Sent",
    shortLabel: "Consultation / Quote",
    preparerNote:
      "Consultation done, written quote sent. The quote states the preparer service fee and, separately, the USCIS government fee (or TO BE CONFIRMED where the locked list does not state it). Follow up on the follow-up date on the Lead Sheet.",
    clientHeading: "Where Your Application Is Right Now & What Happens Next — Stage 2: You Have Our Quote",
    clientWhere:
      "We talked with you and sent you a written quote. The quote shows two separate amounts: (1) our preparation service fee, and (2) the USCIS government filing fee, which is paid separately to the U.S. Department of Homeland Security. No case has been filed yet.",
    clientNext: [
      "Read the quote carefully. Our service fee pays only for preparation help. The government fee is separate and is never mixed into our fee.",
      "The locked Family Adjustment Bundle prices are Basic $999, Standard $1,799, and Premium $2,799. Single-form service fees are quoted from the locked list for that form.",
      "If a government fee is not on the locked list — for example, the I-130 USCIS fee — the quote says TO BE CONFIRMED and we check the official USCIS fee page before you pay anything to the government.",
      "Ask us any question about the quote before you decide. There is no charge for asking, and saying no costs you nothing.",
      "If you accept, we move to Stage 3 and send you an invoice and a payment arrangement. If you need time, tell us your follow-up date and we will check back then.",
    ],
    clientAction:
      "Compare the quote with what you can afford, and ask about the payment plans (Pay in Full, Pay in 3, or Monthly 6 / 12 months). Do not send money to USCIS yet — the government fee is only paid when the forms are ready to file.",
  },
  {
    id: "payment_arrangement",
    number: "3",
    title: "Payment Arrangement / Invoice Sent",
    shortLabel: "Payment Arrangement",
    preparerNote:
      "Invoice sent with a locked plan only: Pay in Full / Pay in 3 / Monthly 6 / Monthly 12 (lib/order.ts, lib/stripe.ts). No 50/50 Split plan exists for immigration bundles. Intake and document work unlock when the first payment is made; E-Sign unlocks only when the balance is paid in full.",
    clientHeading: "Where Your Application Is Right Now & What Happens Next — Stage 3: Invoice & Payment Arrangement Sent",
    clientWhere:
      "You accepted the quote and we sent you an invoice with a payment arrangement. Your forms are not filed yet. Work on your documents starts once your first payment is made.",
    clientNext: [
      "Your payment plan is one of the locked plans only: Pay in Full (one payment), Pay in 3 (three payments), or Monthly — 6 months or Monthly — 12 months.",
      "Your invoice lists each payment, its amount, and its due date. The first payment unlocks your intake forms and document checklist.",
      "The final balance must be paid before you can e-sign the finished packet. That is the rule for every plan, and it is shown on your invoice.",
      "If you miss a payment, the rule on your order is: 50% is added to the total amount. If you think you will miss a payment, tell us before the due date so we can talk about it.",
      "Government fees are still separate. You do not pay USCIS at this stage.",
    ],
    clientAction:
      "Pay the first invoice amount by its due date, using the payment link on the invoice. Keep your receipt. If the amount or the dates look wrong, stop and message us before paying.",
  },
  {
    id: "active_client",
    number: "4",
    title: "Active Client (Docs & Drafting)",
    shortLabel: "Active Client",
    preparerNote:
      "Converted lead: invoice + payment schedule + form checklist generated from the Lead Sheet without re-typing contact details. Collect documents, run the packet audit to 100%, draft forms, then e-sign once the balance is paid. Clerical help only — no legal advice, no approval guarantee.",
    clientHeading: "Where Your Application Is Right Now & What Happens Next — Stage 4: We Are Preparing Your Forms",
    clientWhere:
      "You are now an active client. We are collecting your documents and drafting your forms. Nothing has been sent to USCIS yet, so there is still no USCIS receipt number.",
    clientNext: [
      "Upload or bring each document on your checklist: passports, birth and marriage certificates (with certified translations if they are not in English), passport photos, and your 5-year address, work, and travel history.",
      "If a document is blurry or missing a page, we will ask you to send it again. That is normal — a clean packet is what avoids delays later.",
      "We draft your forms from the information you gave us. Read every draft carefully before you sign it. If a name, date, or address is wrong, tell us — do not sign a draft with a mistake in it.",
      "Your packet must pass a full audit (100%) before it can be signed and filed. We will tell you exactly what is still missing, if anything.",
      "Once the balance is paid and the audit is 100%, you e-sign the packet. Then we file it and you move to Stage 5.",
    ],
    clientAction:
      "Finish your checklist as fast as you can — missing documents are the most common reason a filing is late. Answer our messages the same day if you can, and tell us right away if your address, phone number, or marital status changes.",
  },
  {
    id: "submitted_uscis",
    number: "5",
    title: "Submitted to USCIS / Approved / NVC Guidance",
    shortLabel: "Submitted — USCIS / NVC",
    preparerNote:
      "Filed with USCIS. Track the receipt number, biometrics, and any RFE. On approval, the case moves to NVC (consular cases): guide the client through the 4 CEAC steps. Never store a CEAC password. NVC has no API — CEAC tracking is manual.",
    clientHeading: "Where Your Application Is Right Now & What Happens Next — Stage 5: Filed — At USCIS, Then At NVC",
    clientWhere:
      "Your packet has been filed. USCIS has it now, or — if USCIS already approved it and your family member is outside the United States — the National Visa Center (NVC) has it now. Which sub-stage you are in is shown below: 5A means USCIS, 5B means NVC.",
    clientNext: [
      "See sub-stage 5A below if your case is still at USCIS, and sub-stage 5B below if USCIS approved it and it is now at NVC.",
      "Keep every letter USCIS or NVC sends you, and send us a photo of each letter the same day you receive it.",
      "Tell us immediately if you move, change your phone number, or change your email — USCIS and NVC send time-sensitive letters to the address on file.",
    ],
    clientAction:
      "Do not miss a biometrics appointment or an NVC deadline. If you receive a letter you do not understand, do not guess — send it to us and wait for our reply before you act.",
  },
  {
    id: "visa_approved_closed",
    number: "6",
    title: "Visa Approved, Travel & Flight Prep / Closed",
    shortLabel: "Visa Approved / Closed",
    preparerNote:
      "Visa issued. Give the client the pre-travel checklist before they fly: $235 USCIS Immigrant Fee at my.uscis.gov BEFORE flying, passport with visa, flight / transit rules, sealed packet + medical records in carry-on, Green Card & SSN mailed 30–90 days after entry. Then close the case.",
    clientHeading: "Where Your Application Is Right Now & What Happens Next — Stage 6: Visa Approved — Get Ready to Travel",
    clientWhere:
      "Your visa was approved. You are now getting ready to travel to the United States. Your case closes once you have travelled and we have confirmed the final steps below.",
    clientNext: [
      "Pay the $235 USCIS Immigrant Fee online at my.uscis.gov BEFORE you fly. Do this before your travel date — do not wait until after you arrive.",
      "Pick up your passport with the visa inside it. Check that your name, date of birth, and visa dates are correct before you leave the pickup location.",
      "Book your flight, and check the transit rules for every country you will pass through. Some transit countries need a transit visa even if you only change planes there.",
      "Carry your sealed immigration packet and your medical records in your carry-on bag — never in checked luggage. Do not open the sealed packet. Hand it to the officer when you arrive, exactly as it was given to you.",
      "After you enter the United States, your Green Card and your Social Security Number (SSN) are mailed to your U.S. address, usually 30–90 days after entry. Make sure the address USCIS has is correct, and tell us if you move during those 90 days.",
    ],
    clientAction:
      "Pay the $235 fee before flying, keep the sealed packet unopened in your carry-on, and keep your passport and visa safe. If your flight is delayed or cancelled, tell us so we can update your records.",
  },
];

export const STAGE_5A_GUIDANCE: {
  heading: string;
  where: string;
  next: string[];
  action: string;
} = {
  heading: "Stage 5A — At USCIS",
  where:
    "USCIS has your filed packet. Your case is with a USCIS Service Center or Lockbox — the Lockbox is the office that first receives mailed filings, and the Service Center is the office that reviews the case. You should have a USCIS receipt number.",
  next: [
    "Receipt: after filing, USCIS sends a receipt notice with your receipt number. Keep that number safe — it is how you and we check your case status.",
    "Biometrics: most people are called for a biometrics appointment (fingerprints and a photo). Go to the appointment on the date and at the place on the letter. Bring the letter and your photo ID.",
    "Review: a USCIS officer reviews your forms and documents. This takes time. Waiting without news is normal — it does not mean something is wrong.",
    "RFE alerts: USCIS may send a Request for Evidence (RFE) — a letter asking for one more document or a clearer copy. An RFE is not a denial. It has a deadline, and we must answer it before that deadline. If you receive an RFE, send us a photo of every page the same day.",
    "Decision: USCIS will approve, deny, or ask for more evidence. If your family member is outside the United States, an approval sends the case to the National Visa Center (NVC) — that is Stage 5B.",
  ],
  action:
    "Check your mail every day, go to your biometrics appointment, and send us every USCIS letter the same day you receive it. Never ignore a letter because it looks routine — the deadline on it matters.",
};

export const STAGE_5B_GUIDANCE: {
  heading: string;
  ceacSteps: { step: string; title: string; detail: string }[];
  where: string;
  action: string;
} = {
  heading: "Stage 5B — USCIS Approved → At NVC",
  where:
    "USCIS approved the petition and sent the case to the National Visa Center (NVC). NVC now collects your fees, your visa application, and your civil documents, and then schedules the interview at the U.S. embassy or consulate. NVC fees and the visa application are handled on the CEAC website (ceac.state.gov). Never share or store a CEAC password with anyone.",
  ceacSteps: [
    {
      step: "Step 1",
      title: "Pay the NVC fees on CEAC — $120 + $325, shown separately",
      detail:
        "Pay the Affidavit of Support (AOS) fee of $120 and the Immigrant Visa (IV) fee of $325. These are two separate NVC government fees — pay them as two separate amounts on CEAC, and keep both receipts. They are paid to the U.S. Department of State, not to us, and they are separate from our preparation fee.",
    },
    {
      step: "Step 2",
      title: "Submit Form DS-260 (Immigrant Visa Application) on CEAC",
      detail:
        "Complete and submit the DS-260 online for the person immigrating. Check every name, date, and address before you submit — it must match your passport and your filed forms.",
    },
    {
      step: "Step 3",
      title: "Upload Form I-864 (Affidavit of Support) + civil documents on CEAC",
      detail:
        "Upload the I-864 with the sponsor's tax returns / tax transcripts, plus civil documents: birth certificate, marriage certificate, police certificate(s), passport bio page, and any other document CEAC asks for. Upload clear scans — blurry pages are rejected and delay the case.",
    },
    {
      step: "Step 4",
      title: "Wait for Documentarily Qualified (DQ) & the interview",
      detail:
        "When NVC accepts everything, your case becomes Documentarily Qualified (DQ). NVC then schedules the visa interview at the U.S. embassy or consulate and sends the interview letter. Go to the medical exam before the interview, as the letter instructs, and bring the originals of every document you uploaded.",
    },
  ],
  action:
    "Pay the two NVC fees separately, submit the DS-260, upload clear documents, and wait for DQ. If CEAC says a document is rejected, fix only that document and re-upload it — do not start over.",
};

// ---------------------------------------------------------------------------
// Lead Sheet types
// ---------------------------------------------------------------------------

export type ReferralSource =
  | "Walk-in"
  | "Directory Profile /p/your-name"
  | "Facebook"
  | "Referral";

export const REFERRAL_SOURCES: ReferralSource[] = [
  "Walk-in",
  "Directory Profile /p/your-name",
  "Facebook",
  "Referral",
];

export type ServiceRequested =
  | "family_bundle"
  | "I-130"
  | "I-485"
  | "N-400"
  | "I-589"
  | "I-821"
  | "other";

export const SERVICE_REQUESTED_LABELS: Record<ServiceRequested, string> = {
  family_bundle: "Family Adjustment Bundle (I-130, I-485, I-130A, I-864, I-765, I-131, I-693)",
  "I-130": "Form I-130 — Petition for Alien Relative",
  "I-485": "Form I-485 — Adjust Status",
  "N-400": "Form N-400 — Naturalization",
  "I-589": "Form I-589 — Asylum",
  "I-821": "Form I-821 — Temporary Protected Status (TPS)",
  other: "Other / TO BE CONFIRMED",
};

export type ServiceTier = "basic" | "standard" | "premium";

export interface Lead {
  id: string;
  fullName: string;
  phoneWhatsApp: string;
  email: string;
  preferredLanguage: LanguageCode;
  referralSource: ReferralSource;
  currentImmigrationStatus: string;
  serviceRequested: ServiceRequested;
  serviceTier: ServiceTier;
  /** Locked quoted service fee, in cents. Null = TO BE CONFIRMED. */
  quotedFeeCents: number | null;
  quotedFeeNote: string;
  /** Date the written quote expires (YYYY-MM-DD). Null = no expiry set.
   *  Mirrors preparer_leads.quote_expires_at (migration 0010). A quote
   *  past its expiry date must be re-confirmed before converting — the
   *  UI flags it "Quote expired" and blocks conversion until it is. */
  quoteExpiresAt: string | null;
  /** Set only when the lead is marked lost (pipeline_stage = 'lost').
   *  Mirrors preparer_leads.lost_reason (migration 0010), which has a
   *  CHECK that it is null unless the stage is 'lost'. */
  lostReason: LostReason | null;
  followUpDate: string;
  notes: string;
  stage: LifecycleStageId;
  stage5SubStage: Stage5SubStage | null;
  /** Set when "Convert Lead to Active Case" is used. */
  converted: boolean;
  convertedAt: string | null;
  paymentPlan: PaymentPlanType | null;
}

/** Locked lost-lead reasons — the only values the UI offers. No free-text
 *  reason is invented; "Other" keeps the preparer's own words. */
export type LostReason =
  | "No response"
  | "Chose another provider"
  | "Not eligible — cannot help"
  | "Price — could not afford"
  | "Withdrew"
  | "Other";

export const LOST_REASONS: LostReason[] = [
  "No response",
  "Chose another provider",
  "Not eligible — cannot help",
  "Price — could not afford",
  "Withdrew",
  "Other",
];

/** True when the quote expiry date has passed (compared by calendar date,
 *  in the preparer's local date — no time-of-day is stored). */
export function isQuoteExpired(quoteExpiresAt: string | null, todayIso?: string): boolean {
  if (!quoteExpiresAt) return false;
  const today = todayIso ?? new Date().toISOString().slice(0, 10);
  return quoteExpiresAt < today;
}

/** Resolve the locked quoted service fee for a service + tier. */
export function resolveQuotedFee(
  serviceRequested: ServiceRequested,
  tier: ServiceTier
): { amountCents: number | null; note: string } {
  if (serviceRequested === "family_bundle") {
    return {
      amountCents: FAMILY_ADJUSTMENT_BUNDLE.price[tier] * 100,
      note: `Locked Family Adjustment Bundle — ${tier}: $${FAMILY_ADJUSTMENT_BUNDLE.price[tier].toLocaleString("en-US")}.`,
    };
  }
  if (serviceRequested === "other") {
    return {
      amountCents: null,
      note: "TO BE CONFIRMED — no locked price for this request. Do not quote a price until it is confirmed.",
    };
  }
  const template = BUNDLE_TEMPLATES.find((b) => b.formCode === serviceRequested);
  if (!template) {
    return { amountCents: null, note: "TO BE CONFIRMED." };
  }
  const fee = template.serviceFee;
  // serviceFee is optional in lib/bundles.ts: a template with no locked
  // service fee is TO BE CONFIRMED — never invent one.
  if (!fee) {
    return { amountCents: null, note: `TO BE CONFIRMED — no locked service fee for ${template.formCode} in the locked list.` };
  }
  if ("flat" in fee) {
    return {
      amountCents: fee.flat * 100,
      note: `Locked ${template.formCode} service fee (flat): $${fee.flat}.`,
    };
  }
  return {
    amountCents: fee[tier] * 100,
    note: `Locked ${template.formCode} service fee — ${tier}: $${fee[tier]}. USCIS fee: ${template.uscisFeeNote}`,
  };
}

/** Form checklist for a service, from the locked bundle templates. */
export function checklistForService(serviceRequested: ServiceRequested): string[] {
  if (serviceRequested === "family_bundle") {
    const labels: string[] = [];
    for (const code of FAMILY_ADJUSTMENT_BUNDLE.forms) {
      const t = BUNDLE_TEMPLATES.find((b) => b.formCode === code);
      if (t) labels.push(...t.checklist.map((c) => `${code}: ${c.label}`));
    }
    return labels.length > 0
      ? labels
      : ["Petitioner passport / ID", "Beneficiary passport / ID", "Proof of relationship"];
  }
  if (serviceRequested === "other") return ["TO BE CONFIRMED — checklist to be confirmed for this request."];
  const template = BUNDLE_TEMPLATES.find((b) => b.formCode === serviceRequested);
  return template ? template.checklist.map((c) => c.label) : [];
}

// Pipeline counts bar buckets (task spec). Stage 4 Active Client leads
// are in progress toward filing, so they are counted in the
// USCIS–NVC Filed bucket together with Stage 5 — the pipeline below
// still shows Stage 4 separately.
export const PIPELINE_BUCKETS = [
  { id: "new_leads", label: "New Leads", stages: ["new_lead"] as LifecycleStageId[] },
  { id: "quote_sent", label: "Quote Sent", stages: ["consultation_quote"] as LifecycleStageId[] },
  { id: "payment_plan", label: "Payment Plan", stages: ["payment_arrangement"] as LifecycleStageId[] },
  {
    id: "uscis_nvc_filed",
    label: "USCIS-NVC Filed",
    stages: ["active_client", "submitted_uscis"] as LifecycleStageId[],
  },
  { id: "approved_closed", label: "Approved-Closed", stages: ["visa_approved_closed"] as LifecycleStageId[] },
] as const;

export function countLeadsByBucket(
  leads: Lead[]
): { id: string; label: string; count: number }[] {
  return PIPELINE_BUCKETS.map((b) => ({
    id: b.id,
    label: b.label,
    count: leads.filter((l) => (b.stages as readonly LifecycleStageId[]).includes(l.stage)).length,
  }));
}

export function countLeadsByStage(leads: Lead[]): Record<LifecycleStageId, number> {
  const counts: Record<LifecycleStageId, number> = {
    new_lead: 0,
    consultation_quote: 0,
    payment_arrangement: 0,
    active_client: 0,
    submitted_uscis: 0,
    visa_approved_closed: 0,
  };
  for (const lead of leads) counts[lead.stage] += 1;
  return counts;
}

/** Referral-source report — how many leads came from each source, and
 *  how many of them converted. Lost leads are counted separately so a
 *  source is never judged only by its raw count. */
export function countLeadsByReferralSource(
  leads: Lead[]
): { source: ReferralSource; total: number; converted: number; lost: number }[] {
  return REFERRAL_SOURCES.map((source) => {
    const rows = leads.filter((l) => l.referralSource === source);
    return {
      source,
      total: rows.length,
      converted: rows.filter((l) => l.converted).length,
      lost: rows.filter((l) => l.lostReason !== null).length,
    };
  });
}

export type FollowUpBucket = "overdue" | "due_today" | "upcoming";

/** Follow-up reminders, from the Lead Sheet follow-up dates. A lead
 *  needs a reminder when it has a follow-up date, is not converted and
 *  is not lost. "Overdue" = date passed, "due today" = today,
 *  "upcoming" = within the next 7 days. Dates are calendar dates
 *  (YYYY-MM-DD) — no time-of-day is stored. */
export function followUpReminders(
  leads: Lead[],
  todayIso?: string
): { lead: Lead; bucket: FollowUpBucket; daysOverdue: number }[] {
  const today = todayIso ?? new Date().toISOString().slice(0, 10);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const out: { lead: Lead; bucket: FollowUpBucket; daysOverdue: number }[] = [];
  for (const lead of leads) {
    if (!lead.followUpDate || lead.converted || lead.lostReason !== null) continue;
    const dueMs = Date.parse(`${lead.followUpDate}T00:00:00Z`);
    if (Number.isNaN(dueMs)) continue;
    const diffDays = Math.round((todayMs - dueMs) / 86400000);
    if (diffDays > 0) out.push({ lead, bucket: "overdue", daysOverdue: diffDays });
    else if (diffDays === 0) out.push({ lead, bucket: "due_today", daysOverdue: 0 });
    else if (diffDays >= -7) out.push({ lead, bucket: "upcoming", daysOverdue: diffDays });
  }
  out.sort((a, b) => (a.lead.followUpDate < b.lead.followUpDate ? -1 : 1));
  return out;
}

export function stageDef(id: LifecycleStageId): LifecycleStageDef {
  return LIFECYCLE_STAGES.find((s) => s.id === id) ?? LIFECYCLE_STAGES[0];
}

// EXAMPLE leads only — generic EXAMPLE labels, no real people, no pasted
// names/phones, and only locked prices. Used so the counts bar and the
// pipeline have rows to show before Supabase is wired.
export const EXAMPLE_LEADS: Lead[] = [
  {
    id: "lead-example-1",
    fullName: "EXAMPLE Lead 1 (I-130)",
    phoneWhatsApp: "(555) 010-0001 (EXAMPLE)",
    email: "example-lead-1@example.invalid",
    preferredLanguage: "es",
    referralSource: "Facebook",
    currentImmigrationStatus: "EXAMPLE — status to be confirmed at consultation",
    serviceRequested: "I-130",
    serviceTier: "standard",
    quotedFeeCents: 49900,
    quotedFeeNote: "Locked I-130 service fee — standard: $499. USCIS fee: TO BE CONFIRMED.",
    quoteExpiresAt: "2026-12-21",
    lostReason: null,
    followUpDate: "2026-11-21",
    notes: "EXAMPLE lead — first contact, consultation not yet held.",
    stage: "new_lead",
    stage5SubStage: null,
    converted: false,
    convertedAt: null,
    paymentPlan: null,
  },
  {
    id: "lead-example-2",
    fullName: "EXAMPLE Lead 2 (Family Adjustment Bundle)",
    phoneWhatsApp: "(555) 010-0002 (EXAMPLE)",
    email: "example-lead-2@example.invalid",
    preferredLanguage: "ht",
    referralSource: "Referral",
    currentImmigrationStatus: "EXAMPLE — status to be confirmed at consultation",
    serviceRequested: "family_bundle",
    serviceTier: "standard",
    quotedFeeCents: 179900,
    quotedFeeNote: "Locked Family Adjustment Bundle — standard: $1,799.",
    // Quote expired 2026-11-18 (today is 2026-11-19 in this example) —
    // shown flagged "Quote expired" and conversion is blocked until the
    // quote is re-confirmed.
    quoteExpiresAt: "2026-11-18",
    lostReason: null,
    followUpDate: "2026-11-20",
    notes: "EXAMPLE lead — quote sent, awaiting decision.",
    stage: "consultation_quote",
    stage5SubStage: null,
    converted: false,
    convertedAt: null,
    paymentPlan: null,
  },
  {
    id: "lead-example-3",
    fullName: "EXAMPLE Lead 3 (Family Adjustment Bundle)",
    phoneWhatsApp: "(555) 010-0003 (EXAMPLE)",
    email: "example-lead-3@example.invalid",
    preferredLanguage: "en",
    referralSource: "Walk-in",
    currentImmigrationStatus: "EXAMPLE — status to be confirmed at consultation",
    serviceRequested: "family_bundle",
    serviceTier: "standard",
    quotedFeeCents: 179900,
    quotedFeeNote: "Locked Family Adjustment Bundle — standard: $1,799.",
    quoteExpiresAt: "2026-12-19",
    lostReason: null,
    followUpDate: "2026-11-19",
    notes: "EXAMPLE lead — invoice sent, Pay in 3 arrangement.",
    stage: "payment_arrangement",
    stage5SubStage: null,
    converted: false,
    convertedAt: null,
    paymentPlan: "installments_3",
  },
  {
    id: "lead-example-4",
    fullName: "EXAMPLE Lead 4 (I-485)",
    phoneWhatsApp: "(555) 010-0004 (EXAMPLE)",
    email: "example-lead-4@example.invalid",
    preferredLanguage: "fr",
    referralSource: "Directory Profile /p/your-name",
    currentImmigrationStatus: "EXAMPLE — status to be confirmed at consultation",
    serviceRequested: "I-485",
    serviceTier: "standard",
    quotedFeeCents: 120000,
    quotedFeeNote: "Locked I-485 service fee — standard: $1,200. USCIS fee $1,440 — Paper only (locked), shown separately.",
    quoteExpiresAt: null,
    lostReason: null,
    followUpDate: "2026-11-19",
    notes: "EXAMPLE active client — documents and drafting in progress.",
    stage: "active_client",
    stage5SubStage: null,
    converted: true,
    convertedAt: "2026-11-18",
    paymentPlan: "installments_3",
  },
  {
    id: "lead-example-5",
    fullName: "EXAMPLE Lead 5 (I-130, consular)",
    phoneWhatsApp: "(555) 010-0005 (EXAMPLE)",
    email: "example-lead-5@example.invalid",
    preferredLanguage: "es",
    referralSource: "Referral",
    currentImmigrationStatus: "EXAMPLE — status to be confirmed at consultation",
    serviceRequested: "I-130",
    serviceTier: "standard",
    quotedFeeCents: 49900,
    quotedFeeNote: "Locked I-130 service fee — standard: $499. USCIS fee: TO BE CONFIRMED.",
    quoteExpiresAt: null,
    lostReason: null,
    followUpDate: "2026-11-19",
    notes: "EXAMPLE case — USCIS approved, now at NVC (Stage 5B).",
    stage: "submitted_uscis",
    stage5SubStage: "5B",
    converted: true,
    convertedAt: "2026-11-10",
    paymentPlan: "full_upfront",
  },
  {
    id: "lead-example-6",
    fullName: "EXAMPLE Lead 6 (I-130) — lost",
    phoneWhatsApp: "(555) 010-0006 (EXAMPLE)",
    email: "example-lead-6@example.invalid",
    preferredLanguage: "en",
    referralSource: "Walk-in",
    currentImmigrationStatus: "EXAMPLE — status to be confirmed at consultation",
    serviceRequested: "I-130",
    serviceTier: "standard",
    quotedFeeCents: 49900,
    quotedFeeNote: "Locked I-130 service fee — standard: $499. USCIS fee: TO BE CONFIRMED.",
    quoteExpiresAt: "2026-11-15",
    lostReason: "No response",
    followUpDate: "2026-11-12",
    notes: "EXAMPLE lost lead — quote sent, no reply after two follow-ups. Kept so the lost-lead reason and referral report have a row to show.",
    stage: "consultation_quote",
    stage5SubStage: null,
    converted: false,
    convertedAt: null,
    paymentPlan: null,
  },
];
