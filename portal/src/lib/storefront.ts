// Storefront shared constants — /p/<slug> (immigration.niptei.com).
// Everything here is either a LOCKED platform price (from the live site
// v33 / founder-locked lists) or a UI label. No real professional data,
// no keys, no invented prices. Custom add-on prices are the
// professional's own and are labelled as such on the storefront.
import type { LanguageCode } from "./i18n";

// ---------------------------------------------------------------------------
// Locked service levels (live site v33, price updated Nov 14, 2026).
// DIY $25/form, DIY Bundle $99 (all 6), Review $99/form,
// Review Bundle $399 (all 6), Human Review $199.
// Bundles Basic $999 / Standard $1,799 / Premium $2,799 (locked).
// ---------------------------------------------------------------------------
export const BUNDLE_TIER_CENTS = { basic: 99900, standard: 179900, premium: 279900 } as const;
export const DIY_PER_FORM_CENTS = 2500;
export const DIY_BUNDLE_CENTS = 9900;
export const REVIEW_PER_FORM_CENTS = 9900;
export const REVIEW_BUNDLE_CENTS = 39900;
export const HUMAN_REVIEW_CENTS = 19900;
export const FREE_CALL_MINUTES = 15;
export const CONSULTATION_30MIN_CENTS = 9900;

export type ServiceLevel =
  | "diy"
  | "review"
  | "human_review"
  | "basic"
  | "standard"
  | "premium";

export const SERVICE_LEVEL_LABEL: Record<ServiceLevel, string> = {
  diy: "DIY — $25 per form",
  review: "Review — $99 per form",
  human_review: "Human Review — $199",
  basic: "Basic — $999",
  standard: "Standard — $1,799",
  premium: "Premium — $2,799",
};

// ---------------------------------------------------------------------------
// Locked add-on prices (task-locked list). professional_addons rows with
// is_locked_price = true MUST use exactly one of these name/price pairs —
// migration 0014 enforces it with a CHECK. Anything else is a custom
// add-on (is_locked_price = false) and is labelled "their own service".
// Translation is $45 PER PAGE.
// ---------------------------------------------------------------------------
export interface LockedAddon {
  name: string;
  priceCents: number;
  blurb: string;
}

export const LOCKED_ADDONS: LockedAddon[] = [
  { name: "Certified Translation (per page)", priceCents: 4500, blurb: "Locked price — $45 per page." },
  { name: "Packet Rescue", priceCents: 19900, blurb: "Locked price — $199." },
  { name: "Consultation — 30 min", priceCents: 9900, blurb: "Locked price — $99 for 30 minutes. Not legal advice unless from a licensed attorney." },
  { name: "RFE Response — Basic", priceCents: 39900, blurb: "Locked price — $399." },
  { name: "RFE Response — Standard", priceCents: 79900, blurb: "Locked price — $799." },
  { name: "RFE Response — Premium", priceCents: 149900, blurb: "Locked price — $1,499." },
  { name: "FBI Background Check Prep", priceCents: 14900, blurb: "Locked price — $149." },
  { name: "FOIA Request Prep", priceCents: 14900, blurb: "Locked price — $149." },
  { name: "Mock Interview", priceCents: 19900, blurb: "Locked price — $199." },
];

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// USCIS / NVC government fees — SEPARATE line, never combined with the
// prep fee. Only figures already locked elsewhere in this repo are shown
// as amounts; everything else is TO BE CONFIRMED at uscis.gov/fees.
// ---------------------------------------------------------------------------
export const USCIS_FEES_URL = "https://www.uscis.gov/fees";
export const EOIR_ROSTER_URL =
  "https://www.justice.gov/eoir/recognition-and-accreditation-program";

export const GOV_FEE_NOTES: Record<string, string> = {
  "I-485": "USCIS fee — I-485 paper filing $1,440 (locked). Paid to U.S. Department of Homeland Security, separate from the prep fee.",
  "I-130": "USCIS fee — I-130 $675 TO BE CONFIRMED. Confirm the current fee at uscis.gov/fees before you pay.",
  "I-751": "USCIS fee — I-751 paper filing $750. Paid to U.S. Department of Homeland Security, separate from the prep fee.",
  "I-730": "USCIS fee — I-730 $0. Our prep fee is $299 flat.",
  "I-130+NVC":
    "DOS fees paid in CEAC: $120 AOS + $325 IV per applicant, plus $235 USCIS Immigrant Fee. Separate from the prep fee.",
  "N-400": "USCIS fee — N-400 TO BE CONFIRMED. Confirm the current fee at uscis.gov/fees before you pay.",
};

export function govFeeNoteFor(formCode: string): string {
  return (
    GOV_FEE_NOTES[formCode] ??
    "USCIS / NVC government fee TO BE CONFIRMED. Confirm the current fee at uscis.gov/fees before you pay — government fees are always separate from the prep fee."
  );
}

// ---------------------------------------------------------------------------
// Readable "I speak …" labels for the 7 languages.
// ---------------------------------------------------------------------------
export const SPOKEN_LABEL: Record<LanguageCode, string> = {
  en: "I speak English",
  es: "Se habla español",
  ht: "Nou pale Kreyòl",
  fr: "Je parle français",
  pt: "Falo português",
  zh: "我说中文",
  ar: "أتحدث العربية",
};

// ---------------------------------------------------------------------------
// Free-form storefront sections (migration 0014: storefront_sections).
// 'reviews' may hold ONLY real reviews the professional has permission
// to show — never invented reviews or counts. Empty state is honest.
// ---------------------------------------------------------------------------
export const SECTION_TYPES = [
  "how_i_work",
  "reviews",
  "faqs",
  "documents_needed",
  "office_hours",
  "custom",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const SECTION_TYPE_LABEL: Record<SectionType, string> = {
  how_i_work: "How I work",
  reviews: "What clients say",
  faqs: "FAQs",
  documents_needed: "Documents I need from you",
  office_hours: "My office hours",
  custom: "Custom section",
};

// ---------------------------------------------------------------------------
// Storefront UI strings in all 7 languages. Whole-storefront language
// picker switches these; the professional's own bio / section text is
// shown as they wrote it (not machine-translated).
// ---------------------------------------------------------------------------
export type StorefrontStringKey =
  | "verified"
  | "pendingVerification"
  | "bookingDisabled"
  | "services"
  | "orderThisService"
  | "addons"
  | "addToOrder"
  | "requestQuote"
  | "freeCall"
  | "noNeedToCall"
  | "whatHappensNext"
  | "docsSafe"
  | "paySafely"
  | "checkReal"
  | "contact"
  | "languages"
  | "noReviewsYet"
  | "checkout"
  | "confirmOrder"
  | "preferredLanguage";

export const STOREFRONT_STRINGS: Record<StorefrontStringKey, Record<LanguageCode, string>> = {
  verified: {
    en: "Verified & Listed",
    es: "Verificado y publicado",
    ht: "Verifye epi pibliye",
    fr: "Vérifié et publié",
    pt: "Verificado e listado",
    zh: "已验证并已上架",
    ar: "تم التحقق منه ومدرج",
  },
  pendingVerification: {
    en: "Pending verification — booking disabled",
    es: "Verificación pendiente — reservas desactivadas",
    ht: "Verifikasyon an ap tann — rezèvasyon dezaktive",
    fr: "Vérification en attente — réservation désactivée",
    pt: "Verificação pendente — reservas desativadas",
    zh: "待验证——预订已禁用",
    ar: "بانتظار التحقق — الحجز معطّل",
  },
  bookingDisabled: {
    en: "Booking is disabled until this profile is verified.",
    es: "Las reservas están desactivadas hasta que se verifique este perfil.",
    ht: "Rezèvasyon dezaktive jiskaske pwofil sa a verifye.",
    fr: "La réservation est désactivée jusqu'à la vérification de ce profil.",
    pt: "Reservas desativadas até que este perfil seja verificado.",
    zh: "在验证此资料之前，预订处于禁用状态。",
    ar: "الحجز معطّل حتى يتم التحقق من هذا الملف.",
  },
  services: {
    en: "Services & ordering",
    es: "Servicios y pedidos",
    ht: "Sèvis ak kòmand",
    fr: "Services et commandes",
    pt: "Serviços e pedidos",
    zh: "服务与下单",
    ar: "الخدمات والطلب",
  },
  orderThisService: {
    en: "Order this service",
    es: "Pedir este servicio",
    ht: "Kòmande sèvis sa a",
    fr: "Commander ce service",
    pt: "Pedir este serviço",
    zh: "订购此服务",
    ar: "اطلب هذه الخدمة",
  },
  addons: {
    en: "Additional services",
    es: "Servicios adicionales",
    ht: "Lòt sèvis",
    fr: "Services supplémentaires",
    pt: "Serviços adicionais",
    zh: "附加服务",
    ar: "خدمات إضافية",
  },
  addToOrder: {
    en: "Add to order",
    es: "Añadir al pedido",
    ht: "Ajoute nan kòmand lan",
    fr: "Ajouter à la commande",
    pt: "Adicionar ao pedido",
    zh: "加入订单",
    ar: "أضف إلى الطلب",
  },
  requestQuote: {
    en: "Request a quote",
    es: "Solicitar un presupuesto",
    ht: "Mande yon pri",
    fr: "Demander un devis",
    pt: "Solicitar um orçamento",
    zh: "请求报价",
    ar: "اطلب عرض سعر",
  },
  freeCall: {
    en: "Free 15-minute call",
    es: "Llamada gratis de 15 minutos",
    ht: "Apèl gratis 15 minit",
    fr: "Appel gratuit de 15 minutes",
    pt: "Ligação gratuita de 15 minutos",
    zh: "免费 15 分钟电话",
    ar: "مكالمة مجانية لمدة 15 دقيقة",
  },
  noNeedToCall: {
    en: "You do not need to call — just order",
    es: "No necesita llamar — solo pida",
    ht: "Ou pa bezwen rele — jis kòmande",
    fr: "Pas besoin d'appeler — commandez directement",
    pt: "Não precisa ligar — é só pedir",
    zh: "无需打电话——直接下单即可",
    ar: "لا حاجة للاتصال — فقط اطلب",
  },
  whatHappensNext: {
    en: "What happens next",
    es: "Qué pasa después",
    ht: "Kisa k ap pase apre",
    fr: "Ce qui se passe ensuite",
    pt: "O que acontece depois",
    zh: "接下来会发生什么",
    ar: "ماذا يحدث بعد ذلك",
  },
  docsSafe: {
    en: "Your documents are safe",
    es: "Sus documentos están seguros",
    ht: "Dokiman ou yo an sekirite",
    fr: "Vos documents sont en sécurité",
    pt: "Seus documentos estão seguros",
    zh: "您的文件是安全的",
    ar: "مستنداتك آمنة",
  },
  paySafely: {
    en: "Pay safely",
    es: "Pague con seguridad",
    ht: "Peye an sekirite",
    fr: "Payez en sécurité",
    pt: "Pague com segurança",
    zh: "安全付款",
    ar: "ادفع بأمان",
  },
  checkReal: {
    en: "Check we are real",
    es: "Compruebe que somos reales",
    ht: "Tcheke nou se moun tout bon",
    fr: "Vérifiez que nous sommes réels",
    pt: "Confira se somos reais",
    zh: "核实我们的真实性",
    ar: "تحقق من أننا حقيقيون",
  },
  contact: {
    en: "Contact",
    es: "Contacto",
    ht: "Kontak",
    fr: "Contact",
    pt: "Contato",
    zh: "联系方式",
    ar: "تواصل",
  },
  languages: {
    en: "Languages",
    es: "Idiomas",
    ht: "Lang",
    fr: "Langues",
    pt: "Idiomas",
    zh: "语言",
    ar: "اللغات",
  },
  noReviewsYet: {
    en: "No reviews yet — be our first.",
    es: "Aún no hay reseñas — sea el primero.",
    ht: "Poko revizyon — vin premye a.",
    fr: "Aucun avis pour l'instant — soyez le premier.",
    pt: "Ainda não há avaliações — seja o primeiro.",
    zh: "暂无评价——成为第一位评价者。",
    ar: "لا توجد مراجعات بعد — كن أول من يقيّم.",
  },
  checkout: {
    en: "Checkout",
    es: "Pagar",
    ht: "Kesye",
    fr: "Commander",
    pt: "Finalizar pedido",
    zh: "结账",
    ar: "إتمام الطلب",
  },
  confirmOrder: {
    en: "Confirm order",
    es: "Confirmar pedido",
    ht: "Konfime kòmand lan",
    fr: "Confirmer la commande",
    pt: "Confirmar pedido",
    zh: "确认订单",
    ar: "تأكيد الطلب",
  },
  preferredLanguage: {
    en: "What language do you speak?",
    es: "¿Qué idioma habla?",
    ht: "Ki lang ou pale?",
    fr: "Quelle langue parlez-vous ?",
    pt: "Que idioma você fala?",
    zh: "您说什么语言？",
    ar: "ما اللغة التي تتحدثها؟",
  },
};

export function t(key: StorefrontStringKey, lang: LanguageCode): string {
  return STOREFRONT_STRINGS[key][lang] ?? STOREFRONT_STRINGS[key].en;
}
