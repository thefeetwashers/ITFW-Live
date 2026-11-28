// Professional cover letters — one per form / bundle (draft, plain English).
//
// REUSES the existing DIY cover letter (src/lib/diySubmission.ts
// buildDiyCoverLetter) — it does NOT build a second letter engine.
// The professional letter adds a preparer header (who prepared it,
// which bundle, which forms) and the fee lines from the locked
// checklist template, then reuses the DIY letter's enclosure list
// (checklistTitlesForForm) and submission rules verbatim.
//
// LEGAL CONTENT: a cover letter travels with a filing, so EVERY
// professional cover letter here is labelled
// "DRAFT — for a licensed attorney to review before sending" and the
// send route requires confirmAttorneyReview: true. Nothing here is
// legal advice, nothing promises an approval, and nothing files the
// case — the letter is a draft the professional (and, where legal
// content is involved, an attorney) reviews before it is used.
//
// COVERAGE: every form in the 15-schema DIY registry
// (src/lib/dynamicIntakeSchemas.ts ALL_REGISTRY_FORM_CODES) plus the
// Family Adjustment Bundle (I-130 + I-485 + I-130A + I-864 + I-765 +
// I-131 + I-693). A form with no registry schema has no cover letter
// here — it is reported as missing, never invented.
//
// NO FILING ADDRESS is printed anywhere (none is stored in this
// codebase) and no USCIS fee is presented as verified when the
// checklist template marks it TO BE CONFIRMED — see
// src/lib/diySubmission.ts for the same honest limits.
import {
  ALL_REGISTRY_FORM_CODES,
  getRegistrySchema,
} from "./dynamicIntakeSchemas";
import {
  buildDiyCoverLetter,
  checklistTitlesForForm,
  checklistTemplateForForm,
  DIY_COVER_LETTER_LABEL,
  DIY_SUBMISSION_CONFIRM_LINE,
} from "./diySubmission";
import { ATTORNEY_REVIEW_LABEL } from "./draftedEmails";
import { FAMILY_ADJUSTMENT_BUNDLE } from "./bundles";

export { ATTORNEY_REVIEW_LABEL, DIY_COVER_LETTER_LABEL };

/** The Family Adjustment Bundle's forms, from the locked bundle def. */
export const FAMILY_ADJUSTMENT_FORM_CODES: string[] = [
  ...FAMILY_ADJUSTMENT_BUNDLE.forms,
];

/** Every form code a professional cover letter exists for. */
export const COVER_LETTER_FORM_CODES: string[] = [
  ...ALL_REGISTRY_FORM_CODES,
];

export interface CoverLetterDef {
  /** "cover_letter:I-485" or "cover_letter:family-adjustment". */
  id: string;
  /** Form codes the letter covers. */
  formCodes: string[];
  label: string;
  /** Always true for professional cover letters (filing document). */
  needsAttorneyReview: boolean;
  attorneyReviewLabel: string;
}

export interface RenderedCoverLetter {
  id: string;
  formCodes: string[];
  label: string;
  needsAttorneyReview: boolean;
  attorneyReviewLabel: string;
  subject: string;
  body: string;
}

function defFor(formCodes: string[], label: string): CoverLetterDef {
  const id =
    formCodes.length === FAMILY_ADJUSTMENT_FORM_CODES.length &&
    FAMILY_ADJUSTMENT_FORM_CODES.every((f) => formCodes.includes(f))
      ? "cover_letter:family-adjustment"
      : `cover_letter:${formCodes.join("+").toLowerCase()}`;
  return {
    id,
    formCodes,
    label,
    needsAttorneyReview: true,
    attorneyReviewLabel: ATTORNEY_REVIEW_LABEL,
  };
}

/** One cover-letter def per registry form, plus the bundle. */
export function listCoverLetters(): CoverLetterDef[] {
  const out: CoverLetterDef[] = COVER_LETTER_FORM_CODES.map((code) => {
    const schema = getRegistrySchema(code);
    return defFor(
      [code],
      `Cover letter — Form ${code}${schema ? ` (${schema.title})` : ""}`
    );
  });
  out.push(
    defFor(
      [...FAMILY_ADJUSTMENT_FORM_CODES],
      "Cover letter — Family Adjustment Bundle (I-130 + I-485 + I-130A + I-864 + I-765 + I-131 + I-693)"
    )
  );
  return out;
}

export function getCoverLetterDef(id: string): CoverLetterDef | null {
  return listCoverLetters().find((d) => d.id === id) ?? null;
}

export interface ProfessionalCoverLetterInput {
  /** Client full legal name, or null (placeholder used). */
  clientName: string | null;
  /** Name of the preparer / professional sending it, or null. */
  preparerName?: string | null;
  formCodes: string[];
  govPaymentMethod?: string | null;
  dateIso?: string | null;
}

/**
 * Render a professional cover letter. Reuses buildDiyCoverLetter for
 * the enclosure list and filing rules; adds the preparer header, the
 * locked gov-fee lines per form, and the attorney-review label.
 * Returns an error string (never throws) when a form has no registry
 * schema — that form has no cover letter, and the caller must say so.
 */
export function renderCoverLetter(
  input: ProfessionalCoverLetterInput
): { letter: RenderedCoverLetter | null; error?: string } {
  const formCodes = input.formCodes.length > 0 ? input.formCodes : [];
  if (formCodes.length === 0) {
    return { letter: null, error: "At least one form code is required for a cover letter." };
  }
  const unknown = formCodes.filter(
    (c) => !getRegistrySchema(c) && !checklistTemplateForForm(c)
  );
  if (unknown.length > 0) {
    return {
      letter: null,
      error:
        `No cover letter exists for ${unknown.join(", ")} — no registry schema or checklist template for that form. ` +
        "Add the form to the intake registry first; do not invent a cover letter.",
    };
  }
  const def = defFor(formCodes, "");
  const label =
    formCodes.length === 1
      ? `Cover letter — Form ${formCodes[0]}`
      : `Cover letter — ${formCodes.map((f) => `Form ${f}`).join(", ")}`;
  const name = input.clientName?.trim() || "[Client full legal name]";
  const date = input.dateIso?.trim() || "[Date]";
  const preparer = input.preparerName?.trim() || "[Preparer name]";

  const feeLines: string[] = [];
  for (const code of formCodes) {
    const template = checklistTemplateForForm(code);
    if (!template) {
      feeLines.push(`[${code}] No government fee line is stored for this form. Confirm the fee at uscis.gov/fees before you pay.`);
      continue;
    }
    for (const line of template.govFees) {
      feeLines.push(
        line.locked && line.amountCents !== null
          ? `[${code}] ${line.label}: $${(line.amountCents / 100).toLocaleString("en-US")} — LOCKED. ${line.note ?? ""}`.trim()
          : `[${code}] ${line.label} — TO BE CONFIRMED. ${line.note ?? "Confirm at uscis.gov/fees before paying."}`.trim()
      );
    }
  }

  const diyLetter = buildDiyCoverLetter({
    clientName: input.clientName,
    formCodes,
    govPaymentMethod: input.govPaymentMethod,
    dateIso: input.dateIso,
  });
  // The DIY letter already carries its own DRAFT label; the
  // professional letter replaces it with the attorney-review label so
  // there is exactly one label and it is the stricter one.
  const diyBody = diyLetter.replace(DIY_COVER_LETTER_LABEL, "").trimStart();

  const lines: string[] = [];
  lines.push(ATTORNEY_REVIEW_LABEL + ".");
  lines.push("");
  lines.push(date);
  lines.push("");
  lines.push(`Prepared for ${name} by ${preparer}, Immigration with NIPTEI (document preparation).`);
  lines.push(
    "Immigration with NIPTEI is a document-preparation service, not a law firm, and it is not affiliated with USCIS. " +
      "Only a licensed attorney or a DOJ-accredited representative can give legal advice."
  );
  lines.push("");
  lines.push("Government fees for the enclosed forms (from the locked checklist — never combined into one total):");
  for (const line of feeLines) lines.push(`- ${line}`);
  lines.push("");
  lines.push(diyBody);
  lines.push("");
  lines.push("Enclosures (in checklist order):");
  for (const code of formCodes) {
    for (const title of checklistTitlesForForm(code)) {
      lines.push(`- [${code}] ${title}`);
    }
  }
  lines.push("");
  lines.push(DIY_SUBMISSION_CONFIRM_LINE);
  const body = lines.join("\n");

  return {
    letter: {
      id: def.id,
      formCodes,
      label,
      needsAttorneyReview: true,
      attorneyReviewLabel: ATTORNEY_REVIEW_LABEL,
      subject: `Cover letter (DRAFT) — ${formCodes.map((f) => `Form ${f}`).join(", ")} — ${name}`,
      body,
    },
  };
}
