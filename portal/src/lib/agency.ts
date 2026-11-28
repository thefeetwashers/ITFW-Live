// USCIS & NVC Agency Numbers + Bundle Checklists (Preparer hub)
// A-Number is SENSITIVE: mask it in the UI (A-***-***-123), never show
// it in full in lists, never put a real A-Number in mock data or logs.
// USCIS live status needs the Production key + worker — NOT built.
// NVC has NO API — CEAC tracking is manual (link out, never store a
// CEAC password). "Sync" in this build = one Supabase row, visible in
// preparer + client + family portals (shared state), manual entry
// until the APIs exist.
export const CEAC_LOGIN_URL = "https://ceac.state.gov/IV/Login.aspx";

export function maskANumber(aNumber: string | null | undefined): string {
  if (!aNumber) return "—";
  const digits = aNumber.replace(/\D/g, "");
  if (digits.length < 3) return "A-***-***-***";
  return `A-***-***-${digits.slice(-3)}`;
}

export type Agency = "USCIS" | "NVC" | "EOIR" | "DOL";

export interface AgencyNumber {
  id: string;
  agency: Agency;
  formOrStage: string;
  caseNumber: string; // example only in UI
  nvcInvoiceId?: string;
  agencyStatus: string;
  missingFromAgency?: string;
  agencyDeadline?: string;
  visibleToClient: boolean;
  visibleToFamily: boolean;
}

// Example agency numbers only — never present as a real case.
export const EXAMPLE_AGENCY_NUMBERS: AgencyNumber[] = [
  {
    id: "agency-1",
    agency: "USCIS",
    formOrStage: "I-130",
    caseNumber: "IOE0928374651 (example)",
    agencyStatus: "Case Was Received (example)",
    visibleToClient: true,
    visibleToFamily: true,
  },
  {
    id: "agency-2",
    agency: "NVC",
    formOrStage: "Consular — I-130",
    caseNumber: "CRS2026144002 (example)",
    nvcInvoiceId: "42117188 (example)",
    agencyStatus: "What NVC Says Is Missing: Police Certificate & 2025 IRS Tax Transcript (example)",
    missingFromAgency: "Police Certificate & 2025 IRS Tax Transcript",
    agencyDeadline: "2027-01-15",
    visibleToClient: true,
    visibleToFamily: true,
  },
];

// Agency-number slots + required documents per bundle, using ONLY the
// locked lists in lib/bundles.ts (service fees / USCIS fees there).
// Items not verifiable from the locked lists are marked to_be_confirmed.
export const AGENCY_CHECKLISTS: Record<
  string,
  { agencySlots: string[]; documents: string[] }
> = {
  "I-130": {
    agencySlots: ["USCIS Receipt Number (IOE... / EAC... / SRC...)", "NVC Case Number (CRS...) + Invoice ID (if consular)"],
    documents: ["Petitioner passport / ID", "Beneficiary passport / ID", "Proof of relationship", "5-year address & work history", "Passport photos (2x2)"],
  },
  "I-485": {
    agencySlots: ["USCIS Receipt Number (IOE... / EAC... / SRC...)", "Biometrics appointment letter"],
    documents: ["Birth certificate + certified translation if foreign", "Passport bio page + photos", "I-693 medical exam", "I-864 + sponsor tax returns"],
  },
  "N-400": {
    agencySlots: ["USCIS Receipt Number (IOE... / EAC... / SRC...)"],
    documents: ["Green card (front and back)", "5-year address, work & travel history", "Tax returns"],
  },
  "I-821": {
    agencySlots: ["USCIS Receipt Number (IOE... / EAC... / SRC...)"],
    documents: ["Passport / identity documents", "Proof of nationality + continuous residence"],
  },
  "I-589": {
    agencySlots: ["USCIS Receipt Number (IOE... / EAC... / SRC...)", "Immigration Court / EOIR number (if in proceedings — to be confirmed)"],
    documents: ["Passport / identity documents", "Detailed asylum statement"],
  },
  "I-130+NVC": {
    agencySlots: ["USCIS Receipt Number (IOE... / EAC... / SRC...)", "NVC Case Number (e.g. PHP...) + Invoice ID"],
    documents: ["DS-260 confirmation page", "I-864 + IRS transcripts", "Civil documents uploaded to CEAC", "Police clearance from every country lived in 6+ months since age 16"],
  },
  "I-821+I-765": {
    agencySlots: ["USCIS Receipt Number (IOE... / EAC... / SRC...) — I-821", "USCIS Receipt Number (IOE... / EAC... / SRC...) — I-765"],
    documents: ["Passport / identity documents", "Proof of nationality + continuous residence", "Prior EAD (if renewing)"],
  },
  "I-90": {
    agencySlots: ["USCIS Receipt Number (IOE... / EAC... / SRC...)"],
    documents: ["Current green card (front and back) or proof of LPR status", "Passport / government-issued ID", "Passport photos (2x2)"],
  },
  "I-131": {
    agencySlots: ["USCIS Receipt Number (IOE... / EAC... / SRC...)"],
    documents: ["Passport bio page", "Green card / receipt notice", "Purpose of travel + travel dates"],
  },
  "I-864": {
    agencySlots: ["NVC Case Number (if consular) + Invoice ID", "USCIS Receipt Number of the underlying petition"],
    documents: ["IRS tax transcripts", "W-2s / 1099s", "Proof of U.S. citizen / LPR status", "Joint Sponsor I-864A (if below 125% HHS Poverty Guidelines)"],
  },
};
