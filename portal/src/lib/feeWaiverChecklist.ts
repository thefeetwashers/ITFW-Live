// Fee-waiver (Form I-912) eligibility CHECKLIST — not a decision.
// ---------------------------------------------------------------------------
// USCIS Form I-912 is the Request for Fee Waiver. This file is a
// CHECKLIST of the questions USCIS asks on that form — it does NOT
// decide whether anyone qualifies, and it says so on every line.
// ONLY USCIS DECIDES. If any answer below is unclear, or if the form
// you are filing is not one I-912 covers, ask a licensed attorney or
// DOJ-accredited representative — never guess, and never file a
// waiver you do not understand.
//
// Sourcing: the three grounds below are the three grounds USCIS
// lists for a fee waiver on Form I-912 (see the I-912 form and its
// instructions on uscis.gov — the form index at uscis.gov/forms).
// The platform's locked I-912 preparation price is Basic $39 (see
// src/lib/stripePrices.ts key "i-912_basic") — that is the price of
// the platform preparing the I-912 request, NOT the USCIS fee being
// waived. No income figure, poverty-guideline dollar amount, or
// approval outcome is stated here: the guidelines change yearly, so
// the checklist points to the current figures on uscis.gov instead
// of printing a number that could go stale.
//
// Pure module (no Supabase, no Stripe, no secrets).

export interface FeeWaiverChecklistItem {
  id: string;
  /** The question USCIS asks, in plain language. */
  question: string;
  /** What counts as proof, in plain language. */
  whatToShow: string;
}

export const FEE_WAIVER_SOURCE = {
  label: "uscis.gov — Form I-912 (Request for Fee Waiver)",
  url: "https://www.uscis.gov/forms",
} as const;

export const FEE_WAIVER_ONLY_USCIS_DECIDES =
  "Only USCIS decides whether you get a fee waiver. This checklist cannot tell you that you qualify, and filing Form I-912 does not guarantee a waiver. If USCIS denies the waiver, it will tell you what to do next — read that letter the day it arrives.";

export const FEE_WAIVER_CHECKLIST: FeeWaiverChecklistItem[] = [
  {
    id: "means-tested-benefit",
    question:
      "Are you (or your spouse, or the head of your household) currently receiving a means-tested benefit?",
    whatToShow:
      "For example: Medicaid, Supplemental Nutrition Assistance Program (SNAP / food stamps), Supplemental Security Income (SSI), Temporary Assistance for Needy Families (TANF), or a similar state or federal means-tested benefit. Bring the benefit letter that shows you receive it now — USCIS checks the current benefit, not an old one.",
  },
  {
    id: "household-income",
    question:
      "Is your household income at or below 150% of the Federal Poverty Guidelines?",
    whatToShow:
      "Count everyone in your household and all household income. The poverty-guideline figures change every year — check the current figures on uscis.gov before you answer. Bring tax returns, pay stubs, or other proof of what the household earns.",
  },
  {
    id: "financial-hardship",
    question:
      "Do you have a financial hardship that makes paying the USCIS fee difficult?",
    whatToShow:
      "For example: unemployment, a medical emergency or ongoing medical bills, or other extraordinary expenses. Describe the hardship plainly and bring proof of it (bills, letters, records) — a statement with no proof is weaker than a statement with proof.",
  },
];

export const FEE_WAIVER_HOW_TO_USE: string[] = [
  "Answer each question honestly. If you answer yes to any one of the three, USCIS lets you ask for a waiver on Form I-912 — that is the start of the request, not an approval.",
  "Gather the proof listed for each question you answered yes to, and attach it to the I-912.",
  "File the I-912 with the form it covers, exactly as the I-912 instructions on uscis.gov say. Do not pay the USCIS fee for that form while the waiver is pending — the instructions say what to send instead.",
  "If USCIS denies the waiver, read its letter the day it arrives: it says what to do next and by when.",
  "If you are not sure which of the three grounds fits you, or whether I-912 covers your form at all, ask a licensed attorney or DOJ-accredited representative before you file.",
];

export const FEE_WAIVER_PREP_PRICE_NOTE =
  "Preparing a Form I-912 request on this platform is Basic $39 (locked price, key i-912_basic in src/lib/stripePrices.ts). That is the platform's preparation fee — it is not the USCIS fee, and paying it does not buy a waiver. Only USCIS decides.";
