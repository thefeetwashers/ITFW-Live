// DIY submission-order guide + cover letter (draft, plain English).
//
// Built ONLY from data already locked in this codebase:
//   * Document checklist rows: src/lib/formChecklists.ts via
//     checklistSlotsForForm() in src/lib/dynamicIntakeSchemas.ts
//     (never duplicated here).
//   * Government fee lines: the FormChecklistTemplate whose
//     formsIncluded lists the form (locked vs TO BE CONFIRMED —
//     never presented as verified when it is not).
//   * Fee payment rule: GOV_PAYMENT_RULE in
//     src/lib/dynamicIntakeSchemas.ts — paper filings require
//     Form G-1450 (card) or Form G-1650 (ACH bank debit); no
//     personal checks or money orders. One separate payment per
//     form (each form's USCIS fee is paid separately — never one
//     combined payment for several forms).
//   * Fee schedule link: https://www.uscis.gov/fees (src/lib/fees.ts).
//
// HONEST LIMITS — stated in the guide itself, never hidden:
//   * No filing (lockbox) address is stored anywhere in this
//     codebase, so this guide NEVER prints one. It tells the client
//     to confirm the address on that form's USCIS instructions page
//     before sending anything.
//   * No verified per-form online-filing list exists in this
//     codebase, so the guide NEVER claims a form can (or cannot)
//     be filed online. It tells the client to check the form's
//     page at uscis.gov — online at my.uscis.gov where the form
//     allows it, paper by mail where it does not.
//   * No USCIS form edition is invented. Every guide carries
//     "confirm the current fee, edition and filing address at
//     uscis.gov before you pay/send".
//   * The cover letter is a DRAFT in plain English. The client must
//     review it, correct it and sign the real forms before anything
//     is submitted. Nothing here is legal advice and nothing here
//     files the case.

import {
  DRAFT_SCHEMA_NOTICE,
  checklistSlotsForForm,
  getRegistrySchema,
} from "./dynamicIntakeSchemas";
import {
  FORM_CHECKLIST_TEMPLATES,
  type FormChecklistTemplate,
  type GovFeeLine,
} from "./formChecklists";
import { USCIS_FEE_SCHEDULE_URL } from "./fees";
import { GOV_PAYMENT_RULE } from "./dynamicIntakeSchemas";

export { DRAFT_SCHEMA_NOTICE, GOV_PAYMENT_RULE, USCIS_FEE_SCHEDULE_URL };

export const DIY_SUBMISSION_CONFIRM_LINE =
  "Confirm the current fee, form edition and filing address at uscis.gov before you pay or send anything.";

export const DIY_COVER_LETTER_LABEL =
  "DRAFT cover letter — plain English. Review it, correct it, and sign the real forms before you submit anything. This letter does not file your case.";

/** Checklist template whose formsIncluded lists this form, or null. */
export function checklistTemplateForForm(formCode: string): FormChecklistTemplate | null {
  return (
    FORM_CHECKLIST_TEMPLATES.find((t) => t.formsIncluded.includes(formCode)) ?? null
  );
}

/** Government fee lines for a form (locked vs TO BE CONFIRMED, as stored). */
export function govFeeLinesForForm(formCode: string): GovFeeLine[] {
  return checklistTemplateForForm(formCode)?.govFees ?? [];
}

/** Document checklist titles for a form, in checklist order. */
export function checklistTitlesForForm(formCode: string): string[] {
  return checklistSlotsForForm(formCode).map((s) => s.title);
}

// ---------------------------------------------------------------------------
// Cover letter (draft)
// ---------------------------------------------------------------------------

export interface DiyCoverLetterInput {
  /** Client full legal name, or null when unknown (placeholder used). */
  clientName: string | null;
  formCodes: string[];
  /** How the USCIS fee will be paid, if chosen in the flow. */
  govPaymentMethod?: string | null;
  /** Today's date, YYYY-MM-DD, or null (placeholder used). */
  dateIso?: string | null;
}

export function buildDiyCoverLetter(input: DiyCoverLetterInput): string {
  const name = input.clientName?.trim() || "[Your full legal name]";
  const date = input.dateIso?.trim() || "[Date]";
  const forms = input.formCodes.length > 0 ? input.formCodes : ["[Form]"];
  const lines: string[] = [];
  lines.push(DIY_COVER_LETTER_LABEL);
  lines.push("");
  lines.push(date);
  lines.push("");
  lines.push("U.S. Citizenship and Immigration Services");
  lines.push("[Confirm the filing address for each form below at uscis.gov before you send anything — no filing address is printed here.]");
  lines.push("");
  lines.push(`Re: ${forms.map((f) => `Form ${f}`).join(", ")} — ${name}`);
  lines.push("");
  lines.push("Dear USCIS Officer,");
  lines.push("");
  lines.push(
    `I am filing ${forms.map((f) => `Form ${f}`).join(", ")} for myself. ` +
      "I prepared this application myself with the Immigration with NIPTEI guided DIY flow. " +
      "Immigration with NIPTEI is a document-preparation service, not a law firm, and it is not affiliated with USCIS. " +
      "No attorney prepared this filing for me."
  );
  lines.push("");
  lines.push("Enclosed with this letter, in order:");
  forms.forEach((formCode, i) => {
    lines.push(`${i + 1}. Form ${formCode} (completed and signed by me).`);
    for (const title of checklistTitlesForForm(formCode)) {
      lines.push(`   - ${title}`);
    }
  });
  lines.push("");
  lines.push(
    "USCIS fee payment: " +
      (input.govPaymentMethod?.trim()
        ? input.govPaymentMethod.trim()
        : "[Choose one: USCIS online account (Pay.gov), or paper filing with Form G-1450 (card) or Form G-1650 (ACH bank debit).]") +
      " One separate payment per form — no personal checks or money orders. " +
      DIY_SUBMISSION_CONFIRM_LINE +
      ` Current fees: ${USCIS_FEE_SCHEDULE_URL}.`
  );
  lines.push("");
  lines.push(
    "I have reviewed every page of this application. Everything in it is true and correct to the best of my knowledge. " +
      "Please contact me at the address and phone number on the form if you need anything else."
  );
  lines.push("");
  lines.push("Thank you,");
  lines.push("");
  lines.push(name);
  lines.push("[Signature — sign the real forms before you submit them]");
  lines.push("");
  lines.push(DRAFT_SCHEMA_NOTICE + ".");
  lines.push(DIY_SUBMISSION_CONFIRM_LINE);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Submission-order guide
// ---------------------------------------------------------------------------

export interface DiySubmissionStep {
  step: number;
  title: string;
  detail: string;
}

export interface DiySubmissionGuide {
  formCodes: string[];
  title: string;
  steps: DiySubmissionStep[];
  /** Fee lines, verbatim from the locked checklist template. */
  govFees: GovFeeLine[];
  govTotalNote: string | null;
  confirmLine: string;
  draftNotice: string;
}

function govFeeLineText(line: GovFeeLine): string {
  const amount = line.amountCents !== null
    ? `$${(line.amountCents / 100).toLocaleString("en-US")}`
    : (line.label.includes("—") ? "" : "");
  return line.locked
    ? `${line.label}: ${amount || "see note"} — LOCKED. ${line.note ?? ""}`.trim()
    : `${line.label} — TO BE CONFIRMED. ${line.note ?? "Confirm at uscis.gov/fees before paying."}`.trim();
}

export function submissionGuideForForms(formCodes: string[]): DiySubmissionGuide {
  const forms = formCodes.length > 0 ? formCodes : ["[Form]"];
  const govFees: GovFeeLine[] = [];
  const govNotes: string[] = [];
  for (const code of forms) {
    govFees.push(...govFeeLinesForForm(code));
    const template = checklistTemplateForForm(code);
    if (template?.govTotalNote) govNotes.push(`[${code}] ${template.govTotalNote}`);
    const schema = getRegistrySchema(code);
    if (schema?.redFlag) {
      govNotes.push(
        `[${code}] This is a red-flag case type. We strongly recommend talking to a licensed attorney or a DOJ-accredited representative before you file. This is a warning, not a lock — you can still file DIY.`
      );
    }
  }
  const feeSummary =
    govFees.length > 0
      ? govFees.map((f) => `  - ${govFeeLineText(f)}`).join("\n")
      : "  - No government fee line is stored for this form in this system. Confirm the fee at uscis.gov/fees before you pay — do not guess it.";

  const steps: DiySubmissionStep[] = [
    {
      step: 1,
      title: "Review everything, then sign",
      detail:
        "Read every page of the completed form(s) and the cover letter. Correct any mistake. " +
        "Sign the forms where the form asks for a signature. Do NOT send anything unsigned, " +
        "and do NOT send anything you have not read. This system does not file for you — you submit it yourself.",
    },
    {
      step: 2,
      title: "Pay the USCIS fee — one separate payment per form",
      detail:
        GOV_PAYMENT_RULE +
        " One separate payment per form — pay each form's USCIS fee separately, never one combined payment for several forms. " +
        "Online filing: pay through your USCIS online account (Pay.gov) — you get an instant receipt. " +
        "Paper filing: attach Form G-1450 to authorise a card charge, or Form G-1650 to authorise an ACH bank debit. " +
        "The preparer/DIY fee you paid here is separate from the USCIS fee and is never part of the USCIS payment.\n" +
        feeSummary,
    },
    {
      step: 3,
      title: "Put the packet together in this order",
      detail:
        "Top to bottom: (1) the cover letter (draft above — review it first); " +
        "(2) the fee payment form (G-1450 or G-1650) if you are filing on paper — skip this if you paid online; " +
        "(3) the completed, signed form itself; (4) the supporting documents from the checklist for that form, in checklist order. " +
        "If you are filing more than one form, make one separate packet per form, each with its own fee payment — do not mix forms into one envelope.",
    },
    {
      step: 4,
      title: "File online or by mail — check the form's USCIS page first",
      detail:
        "This guide does not list a filing address and does not say which forms accept online filing — " +
        "no verified filing-address list or online-filing list exists in this system, and both change. " +
        "For each form, open its page at uscis.gov, confirm the current edition, the current fee and the filing address, " +
        "and file online at my.uscis.gov where that form allows it. Otherwise mail the paper packet to the address on that form's USCIS instructions page. " +
        DIY_SUBMISSION_CONFIRM_LINE,
    },
    {
      step: 5,
      title: "Keep copies and proof of sending",
      detail:
        "Keep a full copy of everything you send (forms, cover letter, fee payment, supporting documents). " +
        "Send paper packets by a tracked method (USPS, FedEx or UPS) and keep the tracking number. " +
        "Keep the Pay.gov receipt if you paid online. Do not send originals unless the form instructions tell you to — send copies unless told otherwise.",
    },
    {
      step: 6,
      title: "Wait for the receipt notice, then track your case",
      detail:
        "USCIS sends a receipt notice with a receipt number for each form you file. " +
        "If a receipt notice does not arrive within a few weeks, check the case status with the receipt number (once you have it) " +
        "and contact USCIS. Keep the receipt number safe — it is how you track the case. " +
        "If USCIS asks for more evidence (RFE) or schedules biometrics or an interview, read the notice carefully and meet its deadline.",
    },
  ];

  return {
    formCodes: forms,
    title: `How to submit ${forms.map((f) => `Form ${f}`).join(", ")} — in order`,
    steps,
    govFees,
    govTotalNote: govNotes.length > 0 ? govNotes.join("\n") : null,
    confirmLine: DIY_SUBMISSION_CONFIRM_LINE,
    draftNotice: DRAFT_SCHEMA_NOTICE,
  };
}
