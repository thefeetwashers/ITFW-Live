// Plain-language question help for the DIY flow.
//
// WHY THIS FILE EXISTS: USCIS forms ask questions in official wording
// that many clients do not understand on first reading. As the client
// answers each question, the DIY page shows a plain-language
// explanation of what the question is asking — in the client's own
// words, next to the field.
//
// SOURCE RULE (hard): the codebase carries NO official USCIS
// instruction text per question. The explanations here are built ONLY
// from the plain-English `help` / section descriptions already in
// src/lib/dynamicIntakeSchemas.ts (the Dynamic Intake Engine's own
// field help), plus the checklist template summaries in
// src/lib/formChecklists.ts. Every explanation is therefore labelled
// "platform explanation, not USCIS text" — platform wording is NEVER
// presented as official USCIS wording. Where the codebase has no
// per-question help for a form, the result says so honestly instead
// of inventing an explanation.
//
// Each group links to the form's official instructions at uscis.gov
// (https://www.uscis.gov/forms) so the client can read the official
// text themselves.

export const USCIS_FORMS_URL = "https://www.uscis.gov/forms";
import {
  DYNAMIC_INTAKE_SCHEMAS,
  getDynamicSchema,
  isDynamicFormCode,
} from "./dynamicIntakeSchemas";
import { getTemplate } from "./formChecklists";
import { diyTemplateIdForForm } from "./diyFees";

export const QUESTION_HELP_SOURCE_LABEL =
  "Platform explanation, not USCIS text";

export interface DiyQuestionHelp {
  formCode: string;
  groupId: string;
  groupTitle: string;
  /** Plain-language explanation of what this group of questions asks. */
  explanation: string;
  /** Per-field help inside the group, where the schema has it. */
  fields: { key: string; label: string; explanation: string }[];
  /** "platform" always — no official USCIS instruction text per
   *  question exists in the codebase. */
  source: "platform";
  sourceLabel: string;
  /** Where the client reads the official instructions. */
  uscisUrl: string;
}

/** Question groups for one form, with plain-language explanations.
 *  Dynamic-schema forms (I-131 / I-751 / I-539 / I-129F) get one
 *  group per intake section with per-field help. Other forms get a
 *  single group from their checklist template summary, labelled as
 *  such — per-question help for those forms does not exist in the
 *  codebase yet and is not invented. */
export function questionGroupsForForm(formCode: string): DiyQuestionHelp[] {
  const uscisUrl = USCIS_FORMS_URL;
  if (isDynamicFormCode(formCode)) {
    const schema = getDynamicSchema(formCode);
    if (!schema) return [];
    return schema.sections.map((section) => ({
      formCode,
      groupId: section.id,
      groupTitle: section.title,
      explanation:
        section.description ??
        `Questions about ${section.title.toLowerCase()} for Form ${formCode}.`,
      fields: section.fields
        .filter((field) => field.help)
        .map((field) => ({
          key: field.key,
          label: field.label,
          explanation: field.help as string,
        })),
      source: "platform" as const,
      sourceLabel: QUESTION_HELP_SOURCE_LABEL,
      uscisUrl,
    }));
  }

  const templateId = diyTemplateIdForForm(formCode);
  const template = templateId ? getTemplate(templateId) : null;
  if (!template) return [];
  return [
    {
      formCode,
      groupId: `checklist-${template.id}`,
      groupTitle: template.name,
      explanation:
        `${template.summary} ` +
        "Per-question plain-language help for this form does not exist in the codebase yet — " +
        "the checklist below is what the form asks for, in plain English. Read the official " +
        "instructions at uscis.gov for the exact wording of each question.",
      fields: template.checklist.map((item) => ({
        key: item.id,
        label: item.title,
        explanation:
          `Assigned to: ${item.assignedTo}.` +
          (item.translationRequired
            ? " Certified English translation required if the document is not in English."
            : "") +
          (item.condition ? ` Applies: ${item.condition}.` : ""),
      })),
      source: "platform" as const,
      sourceLabel: QUESTION_HELP_SOURCE_LABEL,
      uscisUrl,
    },
  ];
}

/** Plain-language help for one field, or null when the codebase has
 *  no help for it. Never invents an explanation. */
export function questionHelpForField(
  formCode: string,
  fieldKey: string
): { label: string; explanation: string; sourceLabel: string; uscisUrl: string } | null {
  if (!isDynamicFormCode(formCode)) return null;
  const schema = getDynamicSchema(formCode);
  if (!schema) return null;
  for (const section of schema.sections) {
    const field = section.fields.find((f) => f.key === fieldKey);
    if (field?.help) {
      return {
        label: field.label,
        explanation: field.help,
        sourceLabel: QUESTION_HELP_SOURCE_LABEL,
        uscisUrl: USCIS_FORMS_URL,
      };
    }
  }
  return null;
}

/** Form codes with per-question help in the codebase (dynamic schemas). */
export const DIY_FORMS_WITH_FIELD_HELP = DYNAMIC_INTAKE_SCHEMAS.map(
  (s) => s.formCode
);
