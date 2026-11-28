// One-click drafted emails / letters — template library for anything
// needed from the client (missing documents, appointments, deadlines).
//
// FLOW: the professional picks a template, sees the FULL draft, edits
// it if they wish, clicks once → POST /api/case-status/draft-email
// sends it via SES (+ in-app copy) and records delivery per channel.
// Nothing is sent from this file — it only renders drafts.
//
// PLACEHOLDERS (filled from the case):
//   {{firstName}} — client FIRST name only, in the greeting.
//   {{form}} — form / service label, e.g. "I-130".
//   {{missingItems}} — bulleted list of the missing items.
//   {{deadline}} — deadline date text, professional-entered.
//   {{appointmentDate}} / {{appointmentLocation}} — appointment details.
//   {{portalUrl}} — https://immigration.niptei.com.
//
// LANGUAGE: English first. Where a 7-language template already exists
// (the missing-document nudge, src/lib/notificationTemplates.ts —
// MISSING_DOCUMENT_NUDGE_TEMPLATES), it is REUSED for the general
// missing-document request instead of re-translating. Every other
// template is English only and carries translationStatus
// "en_only_pending" with the label "English only — translation pending"
// in the draft metadata the professional sees (the sent email stays
// clean client-facing English; the label is professional-facing).
//
// LEGAL CONTENT: templates that state a government deadline or tell
// the client what a government appointment / RFE means are labelled
// "Draft — for a licensed attorney to review before sending" and the
// send route requires the professional to confirm attorney review
// (confirmAttorneyReview: true) before it sends. Nothing here invents
// a legal letter: the RFE / interview drafts state only the deadline
// and appointment the professional entered, and tell the client to
// send the letter to us — they give no legal advice, no prediction
// about the outcome, and no statement about relief or eligibility.
import type { LanguageCode } from "./i18n";
import {
  PORTAL_URL,
  renderMissingDocumentNudge,
} from "./notificationTemplates";
import { firstNameOf } from "./caseStatusSync";

export const ATTORNEY_REVIEW_LABEL =
  "Draft — for a licensed attorney to review before sending";

export type DraftTemplateId =
  | "missing_birth_certificate"
  | "missing_passport_photos"
  | "missing_passport_bio_page"
  | "missing_marriage_certificate"
  | "missing_i864_income_evidence"
  | "missing_tax_transcript"
  | "missing_police_certificate"
  | "general_document_request"
  | "interview_appointment_details"
  | "rfe_deadline_reminder"
  | "biometrics_appointment_details"
  | "missing_summary"
  | "deadline_warning"
  | "file_complete"
  | "receipt_confirmation"
  | "interview_reminder";

export type DraftCategory =
  | "missing_document"
  | "appointment"
  | "deadline_reminder"
  | "general_request"
  | "lifecycle";

export interface DraftTemplateDef {
  id: DraftTemplateId;
  label: string;
  category: DraftCategory;
  /** True when the draft carries legal content (deadline / government
   *  appointment consequences) — attorney review required to send. */
  needsAttorneyReview: boolean;
  requiresDeadline: boolean;
  requiresMissingItems: boolean;
  requiresAppointment: boolean;
  /** "seven_languages" only where an existing 7-language template is
   *  reused; otherwise "en_only_pending". */
  translationStatus: "seven_languages" | "en_only_pending";
  /** Default missing items, used when the professional lists none. */
  defaultMissingItems: string[];
  subjectEn: string;
  bodyEn: string;
}

const FOOTER_EN =
  "\n\nQuestions? Write to nipteiapp@gmail.com.\n\nImmigration with NIPTEI is a document-preparation service. We are not a law firm and we are not affiliated with USCIS. Only a licensed attorney or a DOJ-accredited representative can give legal advice.\n\nImmigration with NIPTEI — https://immigration.niptei.com";

function docBody(intro: string): string {
  return (
    "Hello {{firstName}},\n\n" +
    intro +
    "\n\n{{missingItems}}\n\nPlease upload {{them}} in your portal so we can keep preparing your {{form}} case. If you do not have one of these documents, tell us — do not guess or send a document that is not yours.\n\nUpload them here: {{portalUrl}}" +
    FOOTER_EN
  );
}

export const DRAFT_TEMPLATES: DraftTemplateDef[] = [
  {
    id: "missing_birth_certificate",
    label: "Missing birth certificate",
    category: "missing_document",
    needsAttorneyReview: false,
    requiresDeadline: false,
    requiresMissingItems: false,
    requiresAppointment: false,
    translationStatus: "en_only_pending",
    defaultMissingItems: [
      "Birth certificate (long form, showing both parents' names) — original language plus a certified English translation if it is not in English",
    ],
    subjectEn: "We still need your birth certificate — {{form}}",
    bodyEn: docBody(
      "We are preparing your {{form}} case, and we still need the following document from you:"
    ),
  },
  {
    id: "missing_passport_photos",
    label: "Missing passport photos",
    category: "missing_document",
    needsAttorneyReview: false,
    requiresDeadline: false,
    requiresMissingItems: false,
    requiresAppointment: false,
    translationStatus: "en_only_pending",
    defaultMissingItems: [
      "Passport-style photos (2, recent, white background, no glasses, face looking straight at the camera)",
    ],
    subjectEn: "We still need your passport photos — {{form}}",
    bodyEn: docBody(
      "We are preparing your {{form}} case, and we still need the following from you:"
    ),
  },
  {
    id: "missing_passport_bio_page",
    label: "Missing passport bio page",
    category: "missing_document",
    needsAttorneyReview: false,
    requiresDeadline: false,
    requiresMissingItems: false,
    requiresAppointment: false,
    translationStatus: "en_only_pending",
    defaultMissingItems: [
      "Passport bio page — a clear scan or photo of the page with your photo, name, and passport number",
    ],
    subjectEn: "We still need your passport bio page — {{form}}",
    bodyEn: docBody(
      "We are preparing your {{form}} case, and we still need the following document from you:"
    ),
  },
  {
    id: "missing_marriage_certificate",
    label: "Missing marriage certificate",
    category: "missing_document",
    needsAttorneyReview: false,
    requiresDeadline: false,
    requiresMissingItems: false,
    requiresAppointment: false,
    translationStatus: "en_only_pending",
    defaultMissingItems: [
      "Marriage certificate — original language plus a certified English translation if it is not in English",
    ],
    subjectEn: "We still need your marriage certificate — {{form}}",
    bodyEn: docBody(
      "We are preparing your {{form}} case, and we still need the following document from you:"
    ),
  },
  {
    id: "missing_i864_income_evidence",
    label: "Missing I-864 supporting income evidence",
    category: "missing_document",
    needsAttorneyReview: false,
    requiresDeadline: false,
    requiresMissingItems: false,
    requiresAppointment: false,
    translationStatus: "en_only_pending",
    defaultMissingItems: [
      "Most recent federal tax return or IRS tax transcript",
      "Recent pay stubs (last 6 months) or an employment letter stating your job title, start date, and salary",
      "Proof of any other income you want counted (for example, Social Security or pension statements)",
    ],
    subjectEn: "We still need your I-864 income evidence — {{form}}",
    bodyEn: docBody(
      "For the Affidavit of Support (Form I-864) in your {{form}} case, we still need the following income evidence from the sponsor:"
    ),
  },
  {
    id: "missing_tax_transcript",
    label: "Missing tax transcript",
    category: "missing_document",
    needsAttorneyReview: false,
    requiresDeadline: false,
    requiresMissingItems: false,
    requiresAppointment: false,
    translationStatus: "en_only_pending",
    defaultMissingItems: [
      "IRS tax transcript for the most recent tax year (download it at irs.gov, or send us the tax return you filed)",
    ],
    subjectEn: "We still need your tax transcript — {{form}}",
    bodyEn: docBody(
      "We are preparing your {{form}} case, and we still need the following from you:"
    ),
  },
  {
    id: "missing_police_certificate",
    label: "Missing police certificate",
    category: "missing_document",
    needsAttorneyReview: false,
    requiresDeadline: false,
    requiresMissingItems: false,
    requiresAppointment: false,
    translationStatus: "en_only_pending",
    defaultMissingItems: [
      "Police certificate from every country where you lived for 6 months or more since age 16",
    ],
    subjectEn: "We still need your police certificate — {{form}}",
    bodyEn: docBody(
      "We are preparing your {{form}} case, and we still need the following document from you:"
    ),
  },
  {
    id: "general_document_request",
    label: "General document request (any missing items)",
    category: "general_request",
    needsAttorneyReview: false,
    requiresDeadline: false,
    requiresMissingItems: true,
    requiresAppointment: false,
    // Reuses the existing 7-language missing-document nudge when the
    // request names exactly one document; a multi-item list is EN only.
    translationStatus: "seven_languages",
    defaultMissingItems: [],
    subjectEn: "We still need documents from you — {{form}}",
    bodyEn: docBody(
      "We are preparing your {{form}} case, and we still need the following from you:"
    ),
  },
  {
    id: "interview_appointment_details",
    label: "Interview appointment details",
    category: "appointment",
    needsAttorneyReview: true,
    requiresDeadline: false,
    requiresMissingItems: false,
    requiresAppointment: true,
    translationStatus: "en_only_pending",
    defaultMissingItems: [],
    subjectEn: "Your interview appointment — {{appointmentDate}}",
    bodyEn:
      "Hello {{firstName}},\n\nYour interview for your {{form}} case is scheduled for {{appointmentDate}} at {{appointmentLocation}}.\n\nPlease bring:\n- Your passport and the interview letter (the original letter, not a copy)\n- The originals of every document you uploaded for your case\n- A photo ID\n\nArrive early. If you cannot go on that date, tell us right away — do not miss the appointment without telling us.\n\nIf you receive any other letter about this interview, send us a photo of every page the same day you receive it, and wait for our reply before you act." +
      FOOTER_EN,
  },
  {
    id: "rfe_deadline_reminder",
    label: "RFE deadline reminder",
    category: "deadline_reminder",
    needsAttorneyReview: true,
    requiresDeadline: true,
    requiresMissingItems: false,
    requiresAppointment: false,
    translationStatus: "en_only_pending",
    defaultMissingItems: [],
    subjectEn: "Action needed by {{deadline}} — Request for Evidence for your {{form}} case",
    bodyEn:
      "Hello {{firstName}},\n\nUSCIS sent a Request for Evidence (RFE) for your {{form}} case. An RFE is a letter asking for one more document or a clearer copy. It is not a denial — but it has a deadline, and we must answer it before that deadline.\n\nDeadline: {{deadline}}.\n\n{{missingItems}}\n\nPlease send us what is listed above as soon as you can, and send us a photo of every page of the RFE letter if you have not already. Do not send anything to USCIS yourself — we will prepare the response together." +
      FOOTER_EN,
  },
  {
    id: "biometrics_appointment_details",
    label: "Biometrics appointment details",
    category: "appointment",
    needsAttorneyReview: false,
    requiresDeadline: false,
    requiresMissingItems: false,
    requiresAppointment: true,
    translationStatus: "en_only_pending",
    defaultMissingItems: [],
    subjectEn: "Your biometrics appointment — {{appointmentDate}}",
    bodyEn:
      "Hello {{firstName}},\n\nYour biometrics appointment (fingerprints and a photo) for your {{form}} case is scheduled for {{appointmentDate}} at {{appointmentLocation}}.\n\nPlease bring:\n- The biometrics appointment letter (the original letter, not a copy)\n- A photo ID\n\nGo to the appointment on the date and at the place on the letter. If you cannot go, tell us right away." +
      FOOTER_EN,
  },
  // --- Lifecycle emails (Nov 28, 2026 — dashboard-email build) --------
  // The system drafts these from the case itself; the professional
  // reviews and sends with one click. None of them promises or implies
  // an approval, and none of them decides relief or eligibility.
  {
    id: "missing_summary",
    label: "What is missing — summary email",
    category: "lifecycle",
    needsAttorneyReview: false,
    requiresDeadline: false,
    requiresMissingItems: true,
    requiresAppointment: false,
    translationStatus: "en_only_pending",
    defaultMissingItems: [],
    subjectEn: "What we still need from you — {{form}}",
    bodyEn:
      "Hello {{firstName}},\n\nHere is everything we still need from you for your {{form}} case, in one place:\n\n{{missingItems}}\n\nPlease upload {{them}} in your portal. If you do not have one of these documents, tell us — do not guess or send a document that is not yours.\n\nUpload them here: {{portalUrl}}" +
      FOOTER_EN,
  },
  {
    id: "deadline_warning",
    label: "Deadline warning",
    category: "lifecycle",
    needsAttorneyReview: true,
    requiresDeadline: true,
    requiresMissingItems: false,
    requiresAppointment: false,
    translationStatus: "en_only_pending",
    defaultMissingItems: [],
    subjectEn: "Deadline {{deadline}} — action needed for your {{form}} case",
    bodyEn:
      "Hello {{firstName}},\n\nThis is a reminder that your {{form}} case has a deadline: {{deadline}}.\n\n{{missingItems}}\n\nPlease send us what is listed above before that date, so we can prepare it in time. If you have already sent it, thank you — you can ignore this message. If you are not sure what the deadline is for, send us a photo of every page of the letter that gave you the deadline, and wait for our reply before you act." +
      FOOTER_EN,
  },
  {
    id: "file_complete",
    label: "Your file is complete",
    category: "lifecycle",
    needsAttorneyReview: false,
    requiresDeadline: false,
    requiresMissingItems: false,
    requiresAppointment: false,
    translationStatus: "en_only_pending",
    defaultMissingItems: [],
    subjectEn: "Your file is complete — {{form}}",
    bodyEn:
      "Hello {{firstName}},\n\nGood news: we now have everything we need for your {{form}} case. Your file is complete.\n\nWhat happens next: we will prepare your packet and ask you to read every page carefully before you sign it. We will tell you here and in your portal when it is ready to review.\n\nThis message does not mean your case is approved — only that your file with us is complete. The government decides your case." +
      FOOTER_EN,
  },
  {
    id: "receipt_confirmation",
    label: "Receipt confirmation — we received your documents",
    category: "lifecycle",
    needsAttorneyReview: false,
    requiresDeadline: false,
    requiresMissingItems: false,
    requiresAppointment: false,
    translationStatus: "en_only_pending",
    defaultMissingItems: [],
    subjectEn: "We received your documents — {{form}}",
    bodyEn:
      "Hello {{firstName}},\n\nThank you — we received the documents you sent for your {{form}} case.\n\nWe will check them and tell you in your portal if anything else is still missing. You do not need to send the same documents again.\n\nYou can see what we have received in your portal: {{portalUrl}}" +
      FOOTER_EN,
  },
  {
    id: "interview_reminder",
    label: "Interview reminder",
    category: "lifecycle",
    needsAttorneyReview: true,
    requiresDeadline: false,
    requiresMissingItems: false,
    requiresAppointment: true,
    translationStatus: "en_only_pending",
    defaultMissingItems: [],
    subjectEn: "Reminder: your interview is on {{appointmentDate}}",
    bodyEn:
      "Hello {{firstName}},\n\nThis is a reminder that your interview for your {{form}} case is on {{appointmentDate}} at {{appointmentLocation}}.\n\nPlease bring:\n- Your passport and the interview letter (the original letter, not a copy)\n- The originals of every document you uploaded for your case\n- A photo ID\n\nArrive early. If you cannot go on that date, tell us right away — do not miss the appointment without telling us.\n\nIf you receive any other letter about this interview, send us a photo of every page the same day you receive it, and wait for our reply before you act." +
      FOOTER_EN,
  },
];

export function getDraftTemplate(id: string): DraftTemplateDef | null {
  return DRAFT_TEMPLATES.find((t) => t.id === id) ?? null;
}

export interface DraftVars {
  firstName: string;
  form?: string;
  missingItems?: string[];
  deadline?: string;
  appointmentDate?: string;
  appointmentLocation?: string;
  portalUrl?: string;
}

export interface RenderedDraft {
  templateId: DraftTemplateId;
  label: string;
  category: DraftCategory;
  language: LanguageCode;
  translationStatus: "seven_languages" | "en_only_pending";
  /** Professional-facing note; "English only — translation pending"
   *  when no translated version exists. */
  translationNote: string | null;
  needsAttorneyReview: boolean;
  /** Shown to the professional on every legal-content draft. */
  attorneyReviewLabel: string | null;
  subject: string;
  body: string;
}

type FilledVars = {
  firstName: string;
  form: string;
  portalUrl: string;
  missingItems?: string[];
  deadline?: string;
  appointmentDate?: string;
  appointmentLocation?: string;
};

function fill(text: string, vars: FilledVars): string {
  const missingList = (vars.missingItems ?? []).map((m) => `- ${m}`).join("\n");
  // "{{them}}" reads naturally for one item ("it") vs several ("them").
  const them = (vars.missingItems ?? []).length === 1 ? "it" : "them";
  return text
    .split("{{firstName}}").join(vars.firstName)
    .split("{{form}}").join(vars.form ?? "Immigration with NIPTEI")
    .split("{{missingItems}}").join(missingList)
    .split("{{them}}").join(them)
    .split("{{deadline}}").join(vars.deadline ?? "")
    .split("{{appointmentDate}}").join(vars.appointmentDate ?? "")
    .split("{{appointmentLocation}}").join(vars.appointmentLocation ?? "")
    .split("{{portalUrl}}").join(vars.portalUrl ?? PORTAL_URL);
}

/**
 * Render a draft. Returns an error string (instead of throwing) when a
 * required field is missing, so the route can return a clean 400.
 * firstName is taken from the client's full name via firstNameOf() by
 * the caller — pass the full name and it is reduced here too.
 */
export function renderDraft(
  templateId: string,
  vars: DraftVars,
  language: LanguageCode = "en"
): { draft: RenderedDraft | null; error?: string } {
  const tpl = getDraftTemplate(templateId);
  if (!tpl) return { draft: null, error: `Unknown template: ${templateId}.` };
  const firstName = firstNameOf(vars.firstName);
  if (!firstName) return { draft: null, error: "Client first name is required to render a draft." };
  const missingItems =
    vars.missingItems && vars.missingItems.length > 0
      ? vars.missingItems
      : tpl.defaultMissingItems;
  if (tpl.requiresMissingItems && missingItems.length === 0) {
    return { draft: null, error: "List at least one missing item for this template." };
  }
  if (tpl.requiresDeadline && !vars.deadline?.trim()) {
    return { draft: null, error: "A deadline is required for this template — enter the deadline date." };
  }
  if (tpl.requiresAppointment && !vars.appointmentDate?.trim()) {
    return { draft: null, error: "An appointment date is required for this template." };
  }
  const fullVars: DraftVars & { firstName: string } = {
    ...vars,
    firstName,
    form: vars.form ?? "Immigration with NIPTEI",
    missingItems,
    portalUrl: vars.portalUrl ?? PORTAL_URL,
  };

  // Reuse the existing 7-language missing-document nudge for the
  // general single-document request — never re-translate it here.
  if (
    tpl.id === "general_document_request" &&
    language !== "en" &&
    missingItems.length === 1
  ) {
    const nudge = renderMissingDocumentNudge(language, {
      name: firstName,
      service: fullVars.form,
      missingDocument: missingItems[0],
    });
    return {
      draft: {
        templateId: tpl.id,
        label: tpl.label,
        category: tpl.category,
        language,
        translationStatus: "seven_languages",
        translationNote: null,
        needsAttorneyReview: false,
        attorneyReviewLabel: null,
        subject: nudge.emailSubject,
        body: nudge.emailBody,
      },
    };
  }

  const translationNote =
    tpl.translationStatus === "en_only_pending"
      ? "English only — translation pending"
      : null;
  // The general request reuses the 7-language nudge only for a single
  // document (handled above). A multi-item list has no translation,
  // so it is English only even though the template def says
  // seven_languages.
  const effectiveTranslationStatus =
    tpl.id === "general_document_request" && missingItems.length !== 1
      ? "en_only_pending"
      : tpl.translationStatus;
  const effectiveTranslationNote =
    effectiveTranslationStatus === "en_only_pending"
      ? "English only — translation pending"
      : translationNote;
  const filled: FilledVars = {
    ...fullVars,
    firstName,
    form: fullVars.form ?? "Immigration with NIPTEI",
    portalUrl: fullVars.portalUrl ?? PORTAL_URL,
  };
  return {
    draft: {
      templateId: tpl.id,
      label: tpl.label,
      category: tpl.category,
      language: effectiveTranslationStatus === "seven_languages" ? language : "en",
      translationStatus: effectiveTranslationStatus,
      translationNote: effectiveTranslationNote,
      needsAttorneyReview: tpl.needsAttorneyReview,
      attorneyReviewLabel: tpl.needsAttorneyReview ? ATTORNEY_REVIEW_LABEL : null,
      subject: fill(tpl.subjectEn, filled),
      body: fill(tpl.bodyEn, filled),
    },
  };
}

/** Metadata list for the professional's template picker (no PII). */
export function listDraftTemplates(): Omit<DraftTemplateDef, "subjectEn" | "bodyEn" | "defaultMissingItems">[] {
  return DRAFT_TEMPLATES.map(
    ({ subjectEn: _s, bodyEn: _b, defaultMissingItems: _d, ...meta }) => meta
  );
}
