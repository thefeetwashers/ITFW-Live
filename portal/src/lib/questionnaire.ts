// Multi-Language Intake Questionnaire -> USCIS form-field mapping (Build B)
// Client answers in their own language (7 languages); the answer is
// stored in the original language AND mapped to the English USCIS field.
// No AI deciding eligibility, relief, or evidence strength.
// Language labels below are the question prompt in each language;
// the mapped English value is what goes on the USCIS form.
import type { LanguageCode } from "./i18n";

export interface FieldMapping {
  questionKey: string;
  formCode: string;
  field: string;
  prompt: Partial<Record<LanguageCode, string>>;
}

export const FIELD_MAPPINGS: FieldMapping[] = [
  {
    questionKey: "petitioner_full_name",
    formCode: "I-130",
    field: "Part 1, Item 1 — Petitioner's full legal name",
    prompt: {
      en: "What is the petitioner's full legal name?",
      es: "¿Cuál es el nombre legal completo del peticionario?",
      ht: "Ki non legal konplè moun k ap fè demann lan?",
      fr: "Quel est le nom légal complet du pétitionnaire ?",
      pt: "Qual é o nome legal completo do peticionário?",
      zh: "申请人的法定全名是什么？",
      ar: "ما الاسم القانوني الكامل لمقدّم الطلب؟",
    },
  },
  {
    questionKey: "beneficiary_full_name",
    formCode: "I-130",
    field: "Part 2, Item 1 — Beneficiary's full legal name",
    prompt: {
      en: "What is the beneficiary's full legal name?",
      es: "¿Cuál es el nombre legal completo del beneficiario?",
      ht: "Ki non legal konplè benefisyè a?",
      fr: "Quel est le nom légal complet du bénéficiaire ?",
      pt: "Qual é o nome legal completo do beneficiário?",
      zh: "受益人的法定全名是什么？",
      ar: "ما الاسم القانوني الكامل للمستفيد؟",
    },
  },
  {
    questionKey: "petitioner_address_history_5y",
    formCode: "I-130",
    field: "Part 1 — Address history (last 5 years)",
    prompt: {
      en: "List every address where the petitioner lived in the last 5 years, with dates.",
      es: "Enumere cada dirección donde vivió el peticionario en los últimos 5 años, con fechas.",
      ht: "Mete tout adrès moun k ap fè demann lan te rete nan 5 dènye ane yo, ak dat yo.",
      fr: "Indiquez chaque adresse où le pétitionnaire a vécu au cours des 5 dernières années, avec les dates.",
      pt: "Liste todos os endereços onde o peticionário morou nos últimos 5 anos, com datas.",
      zh: "请列出申请人在过去 5 年内居住过的所有地址及日期。",
      ar: "اذكر كل عنوان أقام فيه مقدّم الطلب خلال السنوات الخمس الماضية، مع التواريخ.",
    },
  },
  {
    questionKey: "marriage_date_place",
    formCode: "I-130",
    field: "Part 2 — Date and place of marriage",
    prompt: {
      en: "When and where did you get married?",
      es: "¿Cuándo y dónde se casaron?",
      ht: "Kilè ak ki kote nou te marye?",
      fr: "Quand et où vous êtes-vous mariés ?",
      pt: "Quando e onde vocês se casaram?",
      zh: "你们何时、何地结婚？",
      ar: "متى وأين تزوجتما؟",
    },
  },
  {
    questionKey: "beneficiary_passport_number",
    formCode: "I-130",
    field: "Part 2 — Beneficiary passport number",
    prompt: {
      en: "What is the beneficiary's passport number?",
      es: "¿Cuál es el número de pasaporte del beneficiario?",
      ht: "Ki nimewo paspò benefisyè a?",
      fr: "Quel est le numéro de passeport du bénéficiaire ?",
      pt: "Qual é o número do passaporte do beneficiário?",
      zh: "受益人的护照号码是多少？",
      ar: "ما رقم جواز سفر المستفيد؟",
    },
  },
];

export interface QuestionnaireAnswer {
  questionKey: string;
  originalLanguage: LanguageCode;
  originalValue: string;
  mappedEnglishValue: string;
  formCode: string;
  field: string;
}

export function mapAnswer(
  questionKey: string,
  originalLanguage: LanguageCode,
  originalValue: string,
  mappedEnglishValue: string
): QuestionnaireAnswer | null {
  const m = FIELD_MAPPINGS.find((f) => f.questionKey === questionKey);
  if (!m) return null;
  return {
    questionKey,
    originalLanguage,
    originalValue,
    mappedEnglishValue,
    formCode: m.formCode,
    field: m.field,
  };
}

export const QUESTIONNAIRE_SECTIONS = [
  { id: "petitioner", title: "Petitioner & Beneficiary Info", formCode: "I-130" },
  { id: "address-work", title: "5-Year Address & Work History", formCode: "I-130" },
  { id: "marriage", title: "Bona Fide Marriage Questions", formCode: "I-130" },
] as const;
