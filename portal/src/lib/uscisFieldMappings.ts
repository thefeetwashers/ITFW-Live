// USCIS AcroForm field mappings — DATA FILE ONLY.
// ============================================================================
// STATUS: EVERY entry below is UNVERIFIED — check against the actual USCIS
// PDF for this edition before use.
//
// The AcroForm field names here are GUESSES in the usual USCIS pattern
// (form1[0].#subform[0]...). They have NOT been checked against any real
// USCIS PDF, because no official USCIS template is in this repo or in any
// storage bucket. Do NOT present any of these names as verified, and do
// NOT treat a form as filled just because a mapping entry exists.
//
// What IS verified: the `fieldLabel` on each entry. It comes from the
// real `form_field_mappings` table seeded by migration 0005 (and mirrored
// in src/lib/questionnaire.ts FIELD_MAPPINGS) — the human-readable
// "Part X, Item Y" label for the question. The `questionKey` values are
// the real keys stored in `questionnaire_responses` (migration 0005:
// original_language + original_value + mapped_english_value +
// form_code + field_name).
//
// How the route uses this file (src/app/api/generate-packet/route.ts):
//   (a) it tries each candidate AcroForm name on the downloaded template,
//   (b) it logs every field that was NOT found on the template,
//   (c) it returns the full unfilled/missing-fields list in the response
//       AND on the packet cover sheet,
//   (d) it NEVER silently skips a missing field and calls the form complete.
// The route also returns the template's real field names
// (`templateFieldNames`) so a preparer can correct the mapping against
// the actual PDF for that edition.
//
// Templates: official USCIS PDFs are NOT in this repo. They must be
// downloaded from uscis.gov, per form edition, and uploaded to the
// private `vault` bucket at:
//   vault/templates/<form-code>/<edition>.pdf
// e.g. vault/templates/I-130/07-28-25.pdf (edition string is whatever
// the operator uploads — NO edition date is hardcoded here, because no
// current edition has been verified for this build).
// Packet output goes to: vault/packets/<case-id>/packet-<timestamp>.pdf
// Do NOT create a second bucket. The only bucket is `vault`.
//
// EXPANDED FORMS (2026-11-19): I-131, I-751, I-539, I-129F mappings
// are added below, ALL UNVERIFIED, on the same terms. Their
// `fieldLabel` values are DESCRIPTIVE placeholders for the intake
// question (e.g. "Travel document type") — they do NOT come from the
// seeded `form_field_mappings` table the way the I-130 labels do, and
// they must not be quoted as verified labels. The template upload
// workflow covers these four forms: upload the official PDF from
// uscis.gov to vault/templates/<form-code>/<edition>.pdf and check
// every AcroForm name against the real PDF for that edition before
// any of them is used.
// ============================================================================

export const VAULT_BUCKET = "vault";

export function templateStoragePath(formCode: string, edition: string): string {
  return `templates/${formCode}/${edition}.pdf`;
}

export function packetStoragePath(caseId: string, fileName: string): string {
  return `packets/${caseId}/${fileName}`;
}

export type UscisFieldMappingStatus = "UNVERIFIED";

export interface UscisFieldMapping {
  /** Key in questionnaire_responses.question_key (migration 0005). */
  questionKey: string;
  /** USCIS form code, e.g. "I-130". Matches cases.forms entries. */
  formCode: string;
  /** VERIFIED human-readable label (from form_field_mappings / questionnaire.ts). */
  fieldLabel: string;
  /**
   * GUESSED AcroForm field name on the USCIS PDF. Always unverified
   * until someone opens the real PDF for this edition and confirms it.
   */
  acroFormFieldName: string;
  /** Always "UNVERIFIED" in this file. Never change one entry to verified
   *  without recording the edition + the PDF it was checked against. */
  status: UscisFieldMappingStatus;
  verified: false;
  /** Why this entry is unverified, and what to check. */
  verificationNote: string;
}

const UNVERIFIED_GUESS =
  "UNVERIFIED — check against the actual USCIS PDF for this edition before use. " +
  "This AcroForm field name is a GUESS and has not been confirmed on any real USCIS PDF.";

export const USCIS_FIELD_MAPPINGS: UscisFieldMapping[] = [
  {
    questionKey: "petitioner_full_name",
    formCode: "I-130",
    fieldLabel: "Part 1, Item 1 — Petitioner's full legal name",
    acroFormFieldName: "form1[0].#subform[0].P1_Line1a_FamilyName[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote:
      `${UNVERIFIED_GUESS} The full legal name may also span separate ` +
      `family / given / middle-name fields on the real form — a single-field ` +
      `candidate may be wrong even if a field with a similar name exists.`,
  },
  {
    questionKey: "beneficiary_full_name",
    formCode: "I-130",
    fieldLabel: "Part 2, Item 1 — Beneficiary's full legal name",
    acroFormFieldName: "form1[0].#subform[0].P2_Line1a_FamilyName[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote:
      `${UNVERIFIED_GUESS} The full legal name may also span separate ` +
      `family / given / middle-name fields on the real form.`,
  },
  {
    questionKey: "petitioner_address_history_5y",
    formCode: "I-130",
    fieldLabel: "Part 1 — Address history (last 5 years)",
    acroFormFieldName: "form1[0].#subform[0].P1_AddrHist_Street[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote:
      `${UNVERIFIED_GUESS} A 5-year address history spans many dated ` +
      `address rows on the real form — one candidate field cannot hold it. ` +
      `This entry needs a multi-field mapping once the real PDF is checked.`,
  },
  {
    questionKey: "marriage_date_place",
    formCode: "I-130",
    fieldLabel: "Part 2 — Date and place of marriage",
    acroFormFieldName: "form1[0].#subform[0].P2_LineMarriageDate[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote:
      `${UNVERIFIED_GUESS} Date and place of marriage are likely ` +
      `separate fields on the real form — one candidate field cannot hold both.`,
  },
  {
    questionKey: "beneficiary_passport_number",
    formCode: "I-130",
    fieldLabel: "Part 2 — Beneficiary passport number",
    acroFormFieldName: "form1[0].#subform[0].P2_LinePassportNumber[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  // --- I-131 Travel Document / Advance Parole (UNVERIFIED) ---
  {
    questionKey: "i131_applicant_name",
    formCode: "I-131",
    fieldLabel: "Applicant full legal name (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P1_Line1a_FamilyName[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  {
    questionKey: "i131_document_type",
    formCode: "I-131",
    fieldLabel: "Travel document type — Advance Parole / Reentry Permit / Refugee Travel Document / Emergency Advance Parole (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P1_DocumentType[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  {
    questionKey: "i131_departure_date",
    formCode: "I-131",
    fieldLabel: "Intended departure date (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P1_DepartureDate[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  {
    questionKey: "i131_trip_purpose",
    formCode: "I-131",
    fieldLabel: "Purpose of the trip (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P1_TripPurpose[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  {
    questionKey: "i131_countries",
    formCode: "I-131",
    fieldLabel: "Countries to be visited (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P1_CountriesVisited[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  // --- I-751 Remove Conditions (UNVERIFIED) ---
  {
    questionKey: "i751_conditional_resident_name",
    formCode: "I-751",
    fieldLabel: "Conditional resident full legal name (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P1_Line1a_FamilyName[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  {
    questionKey: "i751_card_expiry",
    formCode: "I-751",
    fieldLabel: "Conditional green card expiry date (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P1_CardExpiryDate[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  {
    questionKey: "i751_filing_basis",
    formCode: "I-751",
    fieldLabel: "Filing basis — Joint / Waiver-Divorce / Waiver-Battery-Cruelty / Waiver-Hardship (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P1_FilingBasis[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  {
    questionKey: "i751_petitioning_spouse_name",
    formCode: "I-751",
    fieldLabel: "Petitioning spouse full legal name (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P1_SpouseName[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  {
    questionKey: "i751_shared_addresses",
    formCode: "I-751",
    fieldLabel: "Shared addresses timeline (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P1_SharedAddresses[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote:
      `${UNVERIFIED_GUESS} A shared-addresses timeline spans many ` +
      `dated address rows on the real form — one candidate field cannot hold it. ` +
      `This entry needs a multi-field mapping once the real PDF is checked.`,
  },
  // --- I-539 Extend / Change Nonimmigrant Status (UNVERIFIED) ---
  {
    questionKey: "i539_applicant_name",
    formCode: "I-539",
    fieldLabel: "Applicant full legal name (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P1_Line1a_FamilyName[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  {
    questionKey: "i539_action_type",
    formCode: "I-539",
    fieldLabel: "Action type — Extend / Change / Reinstate (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P1_ActionType[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  {
    questionKey: "i539_current_status_code",
    formCode: "I-539",
    fieldLabel: "Current nonimmigrant status code (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P1_CurrentStatus[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  {
    questionKey: "i539_i94_expiry",
    formCode: "I-539",
    fieldLabel: "Current I-94 expiry date (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P1_I94ExpiryDate[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  {
    questionKey: "i539_requested_until",
    formCode: "I-539",
    fieldLabel: "Requested-until date (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P1_RequestedUntilDate[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  {
    questionKey: "i539_coapplicants_count",
    formCode: "I-539",
    fieldLabel: "Number of co-applicants (Form I-539A) (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P1_CoApplicantsCount[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  // --- I-129F Fiancé(e) K-1 (UNVERIFIED) ---
  {
    questionKey: "i129f_petitioner_name",
    formCode: "I-129F",
    fieldLabel: "Petitioner full legal name (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P1_Line1a_FamilyName[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  {
    questionKey: "i129f_petitioner_citizenship_proof",
    formCode: "I-129F",
    fieldLabel: "Petitioner citizenship proof (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P1_CitizenshipProof[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  {
    questionKey: "i129f_fiance_name",
    formCode: "I-129F",
    fieldLabel: "Fiancé(e) full legal name (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P2_Line1a_FamilyName[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  {
    questionKey: "i129f_embassy_city",
    formCode: "I-129F",
    fieldLabel: "Embassy city for the K-1 interview (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P2_EmbassyCity[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  {
    questionKey: "i129f_last_meeting_date",
    formCode: "I-129F",
    fieldLabel: "Last in-person meeting date (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P2_LastMeetingDate[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
  {
    questionKey: "i129f_how_met",
    formCode: "I-129F",
    fieldLabel: "How and where you met (descriptive — check against the real PDF)",
    acroFormFieldName: "form1[0].#subform[0].P2_HowMet[0]",
    status: "UNVERIFIED",
    verified: false,
    verificationNote: UNVERIFIED_GUESS,
  },
];

export function mappingsForForm(formCode: string): UscisFieldMapping[] {
  return USCIS_FIELD_MAPPINGS.filter((m) => m.formCode === formCode);
}

/**
 * Forms the packet builder knows about. I-485 is planned (see the
 * skeleton at src/app/api/pdf/autofill/route.ts) but has NO field
 * mappings yet: no questionnaire question maps to I-485, so the route
 * includes its template pages blank and lists the whole form as
 * unfilled rather than pretending it filled anything.
 */
export const SUPPORTED_FORMS: {
  formCode: string;
  mappingCount: number;
  note: string;
}[] = [
  {
    formCode: "I-130",
    mappingCount: mappingsForForm("I-130").length,
    note: "5 question mappings, all UNVERIFIED — see above.",
  },
  {
    formCode: "I-485",
    mappingCount: 0,
    note:
      "No field mappings defined yet — no questionnaire answers map to " +
      "I-485. Template pages are included blank and the form is listed " +
      "as unfilled on the cover sheet until mappings are verified.",
  },
  {
    formCode: "I-131",
    mappingCount: mappingsForForm("I-131").length,
    note: "5 question mappings, all UNVERIFIED — check against the real USCIS PDF for this edition (template: vault/templates/I-131/<edition>.pdf, from uscis.gov only).",
  },
  {
    formCode: "I-751",
    mappingCount: mappingsForForm("I-751").length,
    note: "5 question mappings, all UNVERIFIED — check against the real USCIS PDF for this edition (template: vault/templates/I-751/<edition>.pdf, from uscis.gov only).",
  },
  {
    formCode: "I-539",
    mappingCount: mappingsForForm("I-539").length,
    note: "6 question mappings, all UNVERIFIED — check against the real USCIS PDF for this edition (template: vault/templates/I-539/<edition>.pdf, from uscis.gov only).",
  },
  {
    formCode: "I-129F",
    mappingCount: mappingsForForm("I-129F").length,
    note: "6 question mappings, all UNVERIFIED — check against the real USCIS PDF for this edition (template: vault/templates/I-129F/<edition>.pdf, from uscis.gov only).",
  },
];
