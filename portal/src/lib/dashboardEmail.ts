// In-dashboard email composer engine — the founder + any professional
// emails the client from inside the dashboard, and the system already
// drafts everything missing before the professional has to ask.
//
// WHAT THIS FILE DOES (pure logic — no I/O, no send):
//   1. Composer validation: free-form subject + body, or a template
//      render. Rejects DOB / A-Number / SSN / passport values and any
//      approval promise before anything is sent.
//   2. Sender source: platform SES by default; the professional's OWN
//      connected email (BYO Resend / BYO SES) only when their
//      provider_settings row says connected + test passed. A BYO send
//      with no connected + tested provider is "not_configured", never
//      a fake "sent". The actual send lives in the API route.
//   3. Auto-drafts for EVERY missing checklist item, per form:
//      draftForChecklistItem() maps each FormChecklistItem to one of
//      the 8 missing-document templates — a missing item ALWAYS
//      produces a draft (specific template where one exists, the
//      general request otherwise). draftsForMissingChecklist() does
//      this for a whole template at once, plus the one-email summary.
//   4. Auto-drafts for EVERY missing form answer, per form:
//      draftsForMissingAnswers() maps each unanswered required
//      registry field to a draft. A SENSITIVE field (SSN / A-Number /
//      passport number — RegistryField.sensitive) is NEVER asked for
//      by email: its draft tells the client to enter it in the portal
//      only. A non-sensitive field is asked for by name.
//   5. Lifecycle drafts (missing summary, deadline warning, file
//      complete, receipt confirmation, interview reminder) — thin
//      wrappers over src/lib/draftedEmails.ts renderDraft().
//   6. Cover letters — thin wrappers over src/lib/coverLetters.ts.
//
// WHAT THIS FILE DOES NOT DO: it never sends (see
// src/app/api/dashboard-email/route.ts), never invents a translation
// (English first; the 7-language nudge is reused only where it
// already exists, in draftedEmails.ts), never decides relief /
// eligibility / evidence strength, and never promises an approval.
//
// LANGUAGE: drafts render in the client's language where a locked
// 7-language template exists (the general single-document request);
// every other draft is English with translationStatus
// "en_only_pending" — see draftedEmails.ts.
import {
  getDraftTemplate,
  listDraftTemplates,
  renderDraft,
  type DraftTemplateDef,
  type DraftTemplateId,
  type DraftVars,
  type RenderedDraft,
} from "./draftedEmails";
import {
  FORM_CHECKLIST_TEMPLATES,
  getTemplate,
  type FormChecklistItem,
} from "./formChecklists";
import {
  requiredFieldsForSchemas,
  schemasForSelectedForms,
  type RegistryField,
} from "./dynamicIntakeSchemas";
import {
  getCoverLetterDef,
  listCoverLetters,
  renderCoverLetter,
  type CoverLetterDef,
  type RenderedCoverLetter,
} from "./coverLetters";
import { containsSensitiveIdentifier } from "./caseStatusSync";
import type { LanguageCode } from "./i18n";

// ---------------------------------------------------------------------------
// Sender source
// ---------------------------------------------------------------------------

export type EmailSenderSource = "platform_ses" | "byo_resend" | "byo_aws_ses";

export const SENDER_SOURCE_LABELS: Record<EmailSenderSource, string> = {
  platform_ses: "Platform email (AWS SES — updates@niptei.com)",
  byo_resend: "My own email (Resend — BYO)",
  byo_aws_ses: "My own email (AWS SES — BYO)",
};

/** What the composer needs to know about a professional's BYO provider. */
export interface ByoProviderState {
  providerKey: "resend" | "aws_ses";
  /** provider_settings.status */
  status: "connected" | "not_connected";
  /** provider_settings.test_status */
  testStatus: "not_tested" | "passed" | "failed" | "not_configured";
  /** Last 4 only — never a full key. */
  keyLast4: string | null;
}

/**
 * Resolve which sender the composer will use. Platform SES is the
 * default. A BYO source is used ONLY when that provider is connected
 * AND its test-send passed; anything else falls back to an honest
 * "not_configured" result the route returns — never a silent switch
 * to platform SES behind the professional's back, and never a claim
 * that the BYO send happened.
 */
export function resolveSenderSource(args: {
  requested: EmailSenderSource;
  byo: ByoProviderState | null;
}): {
  source: EmailSenderSource;
  usable: boolean;
  reason: string | null;
} {
  if (args.requested === "platform_ses") {
    return { source: "platform_ses", usable: true, reason: null };
  }
  const byo = args.byo;
  if (!byo) {
    return {
      source: args.requested,
      usable: false,
      reason:
        "Your own email is not connected — connect it in BYO settings first. Nothing was sent.",
    };
  }
  if (byo.status !== "connected") {
    return {
      source: args.requested,
      usable: false,
      reason:
        "Your own email is not connected — connect it in BYO settings first. Nothing was sent.",
    };
  }
  if (byo.testStatus !== "passed") {
    return {
      source: args.requested,
      usable: false,
      reason:
        "Your own email is connected but its test-send has not passed — send a test to your own email first. Nothing was sent.",
    };
  }
  return { source: args.requested, usable: true, reason: null };
}

// ---------------------------------------------------------------------------
// Approval-promise guard + composer validation
// ---------------------------------------------------------------------------

/** Phrases that promise or imply an approval. Checked case-insensitively. */
const APPROVAL_PROMISE_PATTERNS: RegExp[] = [
  /your case will be approved/i,
  /you will be approved/i,
  /guarantee[sd]? (approval|you will|your case)/i,
  /guaranteed approval/i,
  /we guarantee (approval|a green card|a visa|your case)/i,
  /approval is guaranteed/i,
  /you are guaranteed/i,
  /you will (definitely|certainly) get (a green card|a visa|approval)/i,
  /your (green card|visa) is (approved|guaranteed)/i,
];

/** True when the text promises or implies a government approval. */
export function containsApprovalPromise(text: string): boolean {
  return APPROVAL_PROMISE_PATTERNS.some((re) => re.test(text));
}

export interface ComposerInput {
  subject: string;
  body: string;
}

/** Validate a composed (free-form or edited-template) email. Pure. */
export function validateComposerInput(input: ComposerInput): {
  ok: boolean;
  error?: string;
} {
  const subject = (input.subject ?? "").trim();
  const body = (input.body ?? "").trim();
  if (!subject) return { ok: false, error: "A subject is required." };
  if (!body) return { ok: false, error: "A message body is required." };
  if (containsSensitiveIdentifier(subject) || containsSensitiveIdentifier(body)) {
    return {
      ok: false,
      error:
        "The message contains an A-Number or SSN pattern. Remove it and retry — DOB, A-Numbers, SSNs and passport numbers are never put in emails.",
    };
  }
  if (containsApprovalPromise(subject) || containsApprovalPromise(body)) {
    return {
      ok: false,
      error:
        "The message promises or implies an approval. We never promise an approval — only the government decides a case. Reword it and retry.",
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Missing-document drafts — every checklist item maps to a draft
// ---------------------------------------------------------------------------

/** The 8 missing-document templates (7 specific + the general request). */
export const MISSING_DOCUMENT_TEMPLATE_IDS: DraftTemplateId[] = [
  "missing_birth_certificate",
  "missing_passport_photos",
  "missing_passport_bio_page",
  "missing_marriage_certificate",
  "missing_i864_income_evidence",
  "missing_tax_transcript",
  "missing_police_certificate",
  "general_document_request",
];

export function getMissingDocumentTemplates(): DraftTemplateDef[] {
  return MISSING_DOCUMENT_TEMPLATE_IDS.map(
    (id) => getDraftTemplate(id) as DraftTemplateDef
  ).filter(Boolean);
}

type KeywordRule = { re: RegExp; templateId: DraftTemplateId };

/** Keyword rules, checked in order — first match wins. The fallback
 *  (no match) is always general_document_request, so a missing item
 *  NEVER ends up without a draft. */
const CHECKLIST_ITEM_TEMPLATE_RULES: KeywordRule[] = [
  { re: /birth certificate/i, templateId: "missing_birth_certificate" },
  { re: /marriage certificate/i, templateId: "missing_marriage_certificate" },
  { re: /police (certificate|clearance|report)/i, templateId: "missing_police_certificate" },
  { re: /passport[- ]style photos|passport photos|photos \(2x2\)/i, templateId: "missing_passport_photos" },
  { re: /passport bio page|passport \/ id|passport \/ identity/i, templateId: "missing_passport_bio_page" },
  { re: /tax transcript|irs tax transcript|tax returns/i, templateId: "missing_tax_transcript" },
  {
    re: /i-864|affidavit of support|income evidence|pay stubs|employment (letter|proof|verification)|sponsor.*income|household.*125%/i,
    templateId: "missing_i864_income_evidence",
  },
];

/**
 * Which missing-document template asks for this checklist item.
 * Specific template where one exists; general_document_request
 * otherwise — so EVERY missing item produces a draft.
 */
export function templateIdForChecklistItem(item: FormChecklistItem): DraftTemplateId {
  const haystack = `${item.title} ${item.formCode}`;
  for (const rule of CHECKLIST_ITEM_TEMPLATE_RULES) {
    if (rule.re.test(haystack)) return rule.templateId;
  }
  return "general_document_request";
}

/**
 * Render the one-click draft for one missing checklist item, in the
 * client's language. Returns an error string (never throws) when the
 * template cannot render.
 */
export function draftForChecklistItem(
  item: FormChecklistItem,
  vars: Omit<DraftVars, "missingItems">,
  language: LanguageCode = "en"
): { draft: RenderedDraft | null; error?: string } {
  const templateId = templateIdForChecklistItem(item);
  const missingItems = [
    item.condition ? `${item.title} (${item.condition})` : item.title,
  ];
  return renderDraft(
    templateId,
    { ...vars, missingItems },
    language
  );
}

/**
 * One-click drafts for EVERY missing item on a checklist template.
 * `missingItemIds` are the checklist item ids still missing (from
 * inbox_items status 'missing' or the packet audit). One draft per
 * missing item, in checklist order — each is independently sendable
 * with one click — plus the single summary draft that lists them all
 * (template "missing_summary"). Items whose id is unknown are skipped
 * and reported, never silently rendered as something else.
 */
export function draftsForMissingChecklist(args: {
  templateId: string;
  missingItemIds: string[];
  firstName: string;
  form?: string;
  language?: LanguageCode;
}): {
  templateId: string;
  templateName: string;
  perItem: Array<{ item: FormChecklistItem; draft: RenderedDraft }>;
  summary: RenderedDraft | null;
  unknownItemIds: string[];
  errors: string[];
} {
  const template = getTemplate(args.templateId);
  const language = args.language ?? "en";
  const out: {
    templateId: string;
    templateName: string;
    perItem: Array<{ item: FormChecklistItem; draft: RenderedDraft }>;
    summary: RenderedDraft | null;
    unknownItemIds: string[];
    errors: string[];
  } = {
    templateId: args.templateId,
    templateName: template?.name ?? args.templateId,
    perItem: [],
    summary: null,
    unknownItemIds: [],
    errors: [],
  };
  if (!template) {
    out.errors.push(`Unknown checklist template: ${args.templateId}.`);
    return out;
  }
  const byId = new Map(template.checklist.map((i) => [i.id, i]));
  const missingItems: FormChecklistItem[] = [];
  for (const id of args.missingItemIds) {
    const item = byId.get(id);
    if (!item) {
      out.unknownItemIds.push(id);
      continue;
    }
    missingItems.push(item);
  }
  for (const item of missingItems) {
    const { draft, error } = draftForChecklistItem(
      item,
      { firstName: args.firstName, form: args.form ?? template.formsIncluded[0] ?? template.name },
      language
    );
    if (draft) out.perItem.push({ item, draft });
    else out.errors.push(error ?? `Could not draft a message for "${item.title}".`);
  }
  if (missingItems.length > 0) {
    const { draft, error } = renderDraft(
      "missing_summary",
      {
        firstName: args.firstName,
        form: args.form ?? template.formsIncluded[0] ?? template.name,
        missingItems: missingItems.map((i) =>
          i.condition ? `${i.title} (${i.condition})` : i.title
        ),
      },
      language
    );
    if (draft) out.summary = draft;
    else out.errors.push(error ?? "Could not render the missing-items summary.");
  }
  return out;
}

/**
 * Drafts for EVERY missing item on EVERY checklist template — the
 * full coverage check. Used by the smoke test: for each of the 12
 * templates, every checklist row must map to a draft template.
 */
export function draftsForAllChecklists(
  firstName: string,
  language: LanguageCode = "en"
): Array<{
  templateId: string;
  templateName: string;
  itemCount: number;
  draftedCount: number;
  unmappedItemIds: string[];
}> {
  return FORM_CHECKLIST_TEMPLATES.map((template) => {
    const result = draftsForMissingChecklist({
      templateId: template.id,
      missingItemIds: template.checklist.map((i) => i.id),
      firstName,
      language,
    });
    const draftedIds = new Set(result.perItem.map((p) => p.item.id));
    return {
      templateId: template.id,
      templateName: template.name,
      itemCount: template.checklist.length,
      draftedCount: result.perItem.length,
      unmappedItemIds: template.checklist
        .filter((i) => !draftedIds.has(i.id))
        .map((i) => i.id),
    };
  });
}

// ---------------------------------------------------------------------------
// Missing form-answer drafts — every unanswered required field, per form
// ---------------------------------------------------------------------------

export interface MissingAnswerDraft {
  formCode: string;
  fieldName: string;
  fieldLabel: string;
  /** True when the field is a sensitive identifier: the draft tells
   *  the client to enter it in the portal ONLY, never by email. */
  sensitive: boolean;
  draft: RenderedDraft;
}

/**
 * Drafts for every unanswered required field on the given forms.
 * `unanswered` is the list of required field names not yet answered
 * (from the questionnaire / DIY draft, e.g. requiredFieldsForSchemas
 * minus the answered keys). Unknown field names are reported, never
 * guessed. Sensitive fields get a portal-only draft — the value is
 * never requested by email, and the draft text never contains a
 * sensitive value.
 */
export function draftsForMissingAnswers(args: {
  formCodes: string[];
  /** Required field names still unanswered, per form code. */
  unansweredByForm: Record<string, string[]>;
  firstName: string;
  language?: LanguageCode;
}): {
  drafts: MissingAnswerDraft[];
  unknownFormCodes: string[];
  unknownFieldNames: Array<{ formCode: string; fieldName: string }>;
  errors: string[];
} {
  const language = args.language ?? "en";
  const schemas = schemasForSelectedForms(args.formCodes);
  const knownForms = new Set(schemas.map((s) => s.formCode));
  const out: {
    drafts: MissingAnswerDraft[];
    unknownFormCodes: string[];
    unknownFieldNames: Array<{ formCode: string; fieldName: string }>;
    errors: string[];
  } = { drafts: [], unknownFormCodes: [], unknownFieldNames: [], errors: [] };

  for (const code of args.formCodes) {
    if (!knownForms.has(code)) out.unknownFormCodes.push(code);
  }
  const required = requiredFieldsForSchemas(schemas);
  const requiredByForm = new Map<string, Map<string, RegistryField>>();
  for (const { formCode, field } of required) {
    if (!requiredByForm.has(formCode)) requiredByForm.set(formCode, new Map());
    requiredByForm.get(formCode)?.set(field.name, field);
  }

  for (const [formCode, fieldNames] of Object.entries(args.unansweredByForm)) {
    const fields = requiredByForm.get(formCode);
    for (const fieldName of fieldNames) {
      const field = fields?.get(fieldName);
      if (!field) {
        out.unknownFieldNames.push({ formCode, fieldName });
        continue;
      }
      const sensitive = field.sensitive === true;
      const missingItems = sensitive
        ? [
            `Form ${formCode} — ${field.label}: please enter this in your portal. Do not send it by email or chat — enter it directly in the form in your portal, where it stays private.`,
          ]
        : [
            `Form ${formCode} — ${field.label}: please answer this in your portal${field.help ? ` (${field.help})` : ""}.`,
          ];
      const { draft, error } = renderDraft(
        "general_document_request",
        { firstName: args.firstName, form: formCode, missingItems },
        language
      );
      if (draft) {
        out.drafts.push({
          formCode,
          fieldName: field.name,
          fieldLabel: field.label,
          sensitive,
          draft,
        });
      } else {
        out.errors.push(error ?? `Could not draft a message for ${formCode} / ${field.name}.`);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lifecycle + cover-letter helpers (thin wrappers — the templates live
// in draftedEmails.ts / coverLetters.ts, never duplicated here)
// ---------------------------------------------------------------------------

export const LIFECYCLE_TEMPLATE_IDS: DraftTemplateId[] = [
  "missing_summary",
  "deadline_warning",
  "file_complete",
  "receipt_confirmation",
  "interview_reminder",
];

/** Render one lifecycle draft. */
export function lifecycleDraft(
  templateId: (typeof LIFECYCLE_TEMPLATE_IDS)[number],
  vars: DraftVars,
  language: LanguageCode = "en"
): { draft: RenderedDraft | null; error?: string } {
  return renderDraft(templateId, vars, language);
}

/** Render a cover letter for one form or a bundle. */
export function coverLetterDraft(args: {
  formCodes: string[];
  clientName: string | null;
  preparerName?: string | null;
  govPaymentMethod?: string | null;
  dateIso?: string | null;
}): { letter: RenderedCoverLetter | null; error?: string } {
  return renderCoverLetter(args);
}

/** Every template the composer picker offers: drafted emails (16) +
 *  cover letters (15 registry forms + Family Adjustment Bundle). */
export interface ComposerTemplateEntry {
  kind: "draft_email" | "cover_letter";
  id: string;
  label: string;
  category: string;
  needsAttorneyReview: boolean;
  translationStatus: "seven_languages" | "en_only_pending";
}

export function listComposerTemplates(): ComposerTemplateEntry[] {
  const emails: ComposerTemplateEntry[] = listDraftTemplates().map((t) => ({
    kind: "draft_email" as const,
    id: t.id,
    label: t.label,
    category: t.category,
    needsAttorneyReview: t.needsAttorneyReview,
    translationStatus: t.translationStatus,
  }));
  const letters: ComposerTemplateEntry[] = listCoverLetters().map(
    (l: CoverLetterDef) => ({
      kind: "cover_letter" as const,
      id: l.id,
      label: l.label,
      category: "cover_letter",
      needsAttorneyReview: l.needsAttorneyReview,
      translationStatus: "en_only_pending" as const,
    })
  );
  return [...emails, ...letters];
}

/** Resolve a composer template id to its kind (draft email vs cover letter). */
export function composerTemplateKind(
  templateId: string
): "draft_email" | "cover_letter" | null {
  if (templateId.startsWith("cover_letter:")) {
    return getCoverLetterDef(templateId) ? "cover_letter" : null;
  }
  return getDraftTemplate(templateId) ? "draft_email" : null;
}

/** Registry form codes that have a cover letter (all 15 + bundle). */
export function coverLetterFormCodes(): string[] {
  return Array.from(new Set(listCoverLetters().flatMap((l) => l.formCodes)));
}
