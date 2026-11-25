// Pre-built form bundle templates (I-130, I-485, N-400, I-589, I-821)
// Prices / USCIS fees use ONLY the locked lists already in the project.
// Anything not in the locked lists is marked TO BE CONFIRMED — never
// invented. Service fee and USCIS fee are always separate.
export interface FeeBreakdownLine {
  label: string;
  // Display amount: "$120", "$999–$2,799", or "TO BE CONFIRMED".
  amount: string;
  locked: boolean;
  note?: string;
}

export interface BundleTemplate {
  formCode: string;
  name: string;
  // Our service fee only, Basic / Standard / Premium (locked).
  // OPTIONAL: new services with no locked service fee yet omit this
  // and are shown as TO BE CONFIRMED — never invent a service fee.
  serviceFee?: { basic: number; standard: number; premium: number } | { flat: number };
  uscisFeeNote: string; // locked fee, or TO BE CONFIRMED
  checklist: { label: string; status: "locked" | "to_be_confirmed" }[];
  // Family slots covered by this service (structural, not a price).
  familySlots?: string;
  // Full fee breakdown: prep fee + USCIS/DOS government fees, kept
  // separate. Unverifiable items are TO BE CONFIRMED, never invented.
  feeBreakdown?: FeeBreakdownLine[];
}

export const BUNDLE_TEMPLATES: BundleTemplate[] = [
  {
    formCode: "I-130",
    name: "Petition for Alien Relative",
    serviceFee: { basic: 299, standard: 499, premium: 750 },
    uscisFeeNote: "TO BE CONFIRMED — USCIS fee for I-130 is not in the locked fee list; $675 TO BE CONFIRMED. Confirm at uscis.gov/fees before paying.",
    checklist: [
      { label: "Petitioner passport / ID", status: "locked" },
      { label: "Beneficiary passport / ID", status: "locked" },
      { label: "Proof of relationship (birth / marriage certificate)", status: "locked" },
      { label: "5-year address & work history", status: "locked" },
      { label: "Passport photos (2x2)", status: "locked" },
    ],
    familySlots: "Petitioner + 1 principal beneficiary; derivatives listed in the Family Tree roster.",
    feeBreakdown: [
      { label: "Clerical prep fee (I-130)", amount: "Basic $299 / Standard $499 / Premium $750", locked: true },
      { label: "USCIS fee — I-130", amount: "$675 — TO BE CONFIRMED", locked: false, note: "Confirm at uscis.gov/fees before paying." },
    ],
  },
  {
    formCode: "I-130+NVC",
    name: "I-130 + NVC Consular Bundle",
    // No locked service fee for this bundle — TO BE CONFIRMED, never invented.
    uscisFeeNote: "I-130 USCIS fee $675 TO BE CONFIRMED. DOS fees paid in CEAC: $120 AOS + $325 IV per applicant (per the NVC brief) — separate from the prep fee.",
    checklist: [
      { label: "Petitioner passport / ID", status: "locked" },
      { label: "Beneficiary passport / ID", status: "locked" },
      { label: "Proof of relationship (birth / marriage certificate)", status: "locked" },
      { label: "5-year address & work history", status: "locked" },
      { label: "Passport photos (2x2)", status: "locked" },
      { label: "NVC case number + Invoice ID (CEAC)", status: "locked" },
      { label: "DS-260 confirmation page", status: "locked" },
      { label: "I-864 + IRS transcripts (petitioner; joint sponsor if below 125% HHS Poverty Guidelines)", status: "locked" },
      { label: "Civil documents uploaded to CEAC (birth / marriage / police clearance)", status: "locked" },
      { label: "Embassy interview + medical exam readiness", status: "to_be_confirmed" },
    ],
    familySlots: "Petitioner + principal beneficiary + derivative spouse / children (see Family Tree roster).",
    feeBreakdown: [
      { label: "Clerical prep fee (I-130 + NVC bundle)", amount: "TO BE CONFIRMED", locked: false, note: "No locked service fee for this bundle yet — $1,200 / $600 / $300 figures in pastes are EXAMPLE, not locked prices." },
      { label: "USCIS fee — I-130", amount: "$675 — TO BE CONFIRMED", locked: false, note: "Confirm at uscis.gov/fees before paying." },
      { label: "DOS fee — AOS (CEAC)", amount: "$120 per case", locked: true, note: "Paid in CEAC, separate from the prep fee." },
      { label: "DOS fee — IV (CEAC)", amount: "$325 per applicant", locked: true, note: "Paid in CEAC, separate from the prep fee." },
    ],
  },
  {
    formCode: "I-485",
    name: "Application to Register Permanent Residence / Adjust Status",
    serviceFee: { basic: 750, standard: 1200, premium: 1500 },
    uscisFeeNote: "USCIS fee $1,440 — Paper only, mandatory 09/18/26 edition (locked).",
    checklist: [
      { label: "I-130 receipt / approval (if filing together, I-130 checklist applies)", status: "locked" },
      { label: "Birth certificate + certified translation if foreign", status: "locked" },
      { label: "Passport bio page + photos (2x2)", status: "locked" },
      { label: "I-693 medical exam (doctor $250–$500 to doctor — free booking)", status: "locked" },
      { label: "I-864 Affidavit of Support + sponsor tax returns", status: "locked" },
      { label: "Employment / tax history", status: "to_be_confirmed" },
    ],
    familySlots: "Principal applicant + derivatives (spouse / unmarried children — confirm eligibility; clerical help only, not legal advice).",
    feeBreakdown: [
      { label: "Clerical prep fee (I-485)", amount: "Basic $750 / Standard $1,200 / Premium $1,500", locked: true },
      { label: "USCIS fee — I-485 (paper)", amount: "$1,440", locked: true, note: "Paper only, mandatory 09/18/26 edition." },
    ],
  },
  {
    formCode: "N-400",
    name: "Application for Naturalization",
    serviceFee: { basic: 199, standard: 400, premium: 600 },
    uscisFeeNote: "TO BE CONFIRMED — USCIS fee for N-400 is not in the locked fee list; confirm at uscis.gov/fees before paying.",
    checklist: [
      { label: "Green card (front and back)", status: "locked" },
      { label: "5-year address, work & travel history", status: "locked" },
      { label: "Tax returns", status: "locked" },
      { label: "Marriage / divorce certificates if applicable", status: "to_be_confirmed" },
    ],
    familySlots: "Applicant only (N-400 is an individual application).",
    feeBreakdown: [
      { label: "Clerical prep fee (N-400)", amount: "Basic $199 / Standard $400 / Premium $600", locked: true },
      { label: "USCIS fee — N-400", amount: "TO BE CONFIRMED", locked: false, note: "Confirm at uscis.gov/fees before paying." },
    ],
  },
  {
    formCode: "I-589",
    name: "Application for Asylum and for Withholding of Removal — Clerical Prep",
    serviceFee: { basic: 900, standard: 1050, premium: 1200 },
    uscisFeeNote: "USCIS fee $100 + $105/year (locked).",
    checklist: [
      { label: "Passport / identity documents", status: "locked" },
      { label: "Detailed asylum statement (plain-language questionnaire)", status: "locked" },
      { label: "Supporting evidence — country conditions, witness statements", status: "to_be_confirmed" },
      { label: "One-year filing deadline check", status: "to_be_confirmed" },
    ],
    familySlots: "Principal applicant + derivatives (spouse / unmarried children — confirm eligibility; clerical help only, not legal advice).",
    feeBreakdown: [
      { label: "Clerical prep fee (I-589)", amount: "Basic $900 / Standard $1,050 / Premium $1,200", locked: true },
      { label: "USCIS fee — I-589", amount: "$100 + $105/year", locked: true },
    ],
  },
  {
    formCode: "I-821",
    name: "Application for Temporary Protected Status",
    serviceFee: { basic: 189, standard: 295, premium: 400 },
    uscisFeeNote: "USCIS fee $520 — TPS (locked).",
    checklist: [
      { label: "Passport / identity documents", status: "locked" },
      { label: "Proof of nationality + continuous residence", status: "locked" },
      { label: "Proof of continuous physical presence", status: "to_be_confirmed" },
    ],
    familySlots: "Applicant only — each family member files their own I-821 (confirm eligibility; clerical help only).",
    feeBreakdown: [
      { label: "Clerical prep fee (I-821)", amount: "Basic $189 / Standard $295 / Premium $400", locked: true },
      { label: "USCIS fee — I-821 (TPS)", amount: "$520", locked: true },
    ],
  },
  {
    formCode: "I-821+I-765",
    name: "I-821 TPS + I-765 EAD (Employment Authorization)",
    // No locked combined service fee — TO BE CONFIRMED, never invented.
    uscisFeeNote: "USCIS fee $520 — TPS (locked). I-765 EAD fee TO BE CONFIRMED — confirm at uscis.gov/fees before paying.",
    checklist: [
      { label: "Passport / identity documents", status: "locked" },
      { label: "Proof of nationality + continuous residence (TPS)", status: "locked" },
      { label: "Proof of continuous physical presence", status: "to_be_confirmed" },
      { label: "I-765 eligibility category + prior EAD (if renewing)", status: "locked" },
      { label: "Passport photos (2x2) for EAD", status: "locked" },
      { label: "180-day EAD / TPS renewal window check (see Deadline Radar)", status: "locked" },
    ],
    familySlots: "Applicant only — each family member files their own I-821 + I-765 (confirm eligibility; clerical help only).",
    feeBreakdown: [
      { label: "Clerical prep fee (I-821 + I-765)", amount: "TO BE CONFIRMED", locked: false, note: "No locked combined service fee yet — $1,200 / $600 / $300 figures in pastes are EXAMPLE, not locked prices." },
      { label: "USCIS fee — I-821 (TPS)", amount: "$520", locked: true },
      { label: "USCIS fee — I-765 (EAD)", amount: "TO BE CONFIRMED", locked: false, note: "Confirm at uscis.gov/fees before paying." },
    ],
  },
  {
    formCode: "I-90",
    name: "Application to Replace Permanent Resident Card",
    // No locked service fee — TO BE CONFIRMED, never invented.
    uscisFeeNote: "TO BE CONFIRMED — USCIS fee for I-90 is not in the locked fee list; confirm at uscis.gov/fees before paying.",
    checklist: [
      { label: "Current green card (front and back) or proof of LPR status", status: "locked" },
      { label: "Passport / government-issued ID", status: "locked" },
      { label: "Reason for replacement (lost / stolen / expired / damaged)", status: "locked" },
      { label: "Passport photos (2x2)", status: "locked" },
      { label: "Police report (if card was stolen)", status: "to_be_confirmed" },
    ],
    familySlots: "Applicant only (I-90 is an individual application).",
    feeBreakdown: [
      { label: "Clerical prep fee (I-90)", amount: "TO BE CONFIRMED", locked: false },
      { label: "USCIS fee — I-90", amount: "TO BE CONFIRMED", locked: false, note: "Confirm at uscis.gov/fees before paying." },
    ],
  },
  {
    formCode: "I-131",
    name: "Application for Travel Document",
    // No locked service fee — TO BE CONFIRMED, never invented.
    uscisFeeNote: "TO BE CONFIRMED — USCIS fee for I-131 is not in the locked fee list; confirm at uscis.gov/fees before paying.",
    checklist: [
      { label: "Passport bio page", status: "locked" },
      { label: "Green card / receipt notice (front and back)", status: "locked" },
      { label: "Purpose of travel + travel dates", status: "locked" },
      { label: "Passport photos (2x2)", status: "locked" },
      { label: "Prior travel document (if re-applying)", status: "to_be_confirmed" },
    ],
    familySlots: "Applicant only — each traveller files their own I-131 (confirm eligibility; clerical help only).",
    feeBreakdown: [
      { label: "Clerical prep fee (I-131)", amount: "TO BE CONFIRMED", locked: false },
      { label: "USCIS fee — I-131", amount: "TO BE CONFIRMED", locked: false, note: "Confirm at uscis.gov/fees before paying." },
    ],
  },
  {
    formCode: "I-864",
    name: "I-864 Only — Affidavit of Support",
    // No locked service fee — TO BE CONFIRMED, never invented.
    uscisFeeNote: "No separate USCIS fee — the I-864 is filed with the underlying petition / submitted to NVC. Confirm at uscis.gov/fees before paying anything.",
    checklist: [
      { label: "IRS tax transcripts (petitioner / sponsor)", status: "locked" },
      { label: "W-2s / 1099s", status: "locked" },
      { label: "Proof of U.S. citizen / LPR status", status: "locked" },
      { label: "Employment / income evidence", status: "locked" },
      { label: "Joint Sponsor I-864A (only if below 125% HHS Poverty Guidelines)", status: "to_be_confirmed" },
    ],
    familySlots: "Petitioner / sponsor + household members counted on the I-864.",
    feeBreakdown: [
      { label: "Clerical prep fee (I-864 only)", amount: "TO BE CONFIRMED", locked: false },
      { label: "USCIS fee — I-864", amount: "No separate USCIS fee", locked: true, note: "Filed with the underlying petition / submitted to NVC." },
      { label: "DOS fee — AOS (CEAC, consular cases)", amount: "$120 per case", locked: true, note: "Paid in CEAC, separate from the prep fee." },
    ],
  },
];

// Display order for the Master Form & Service Bundle Catalog.
export const SERVICE_CATALOG_ORDER = [
  "I-130",
  "I-130+NVC",
  "I-485",
  "I-821+I-765",
  "I-589",
  "N-400",
  "I-90",
  "I-131",
  "I-864",
] as const;

// Family Adjustment Bundle (locked): Basic $999 / Standard $1,799 / Premium $2,799.
// 7 forms: I-130, I-485, I-130A, I-864, I-765, I-131, I-693. I-130A included free with I-130.
export const FAMILY_ADJUSTMENT_BUNDLE = {
  name: "Family Adjustment Bundle",
  forms: ["I-130", "I-485", "I-130A", "I-864", "I-765", "I-131", "I-693"],
  price: { basic: 999, standard: 1799, premium: 2799 },
};
