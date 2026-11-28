// SEO foundation — Immigration with NIPTEI portal
// (ELEVENTH ADDITION, Nov 28, 2026).
//
// WHAT THIS IS: the findability foundation — a sitemap of PUBLIC pages
// only, per-form landing content from the locked form catalog, meta
// titles/descriptions, and JSON-LD (Organization + FAQ) built from
// content that already exists in this codebase.
//
// HONESTY RULES (do not weaken):
//   * SEO makes the platform FINDABLE. It does NOT guarantee a ranking,
//     a number-one spot, or any position on Google, Yahoo, Bing, or
//     any other search engine — and no one can promise that. That is
//     stated in SEO_NO_RANKING_NOTE, shown on the public landing
//     pages, and asserted by the smoke test.
//   * The sitemap contains ONLY public pages. Private/dashboard URLs
//     are NEVER in it — isPublicSitemapUrl() is the guard, and the
//     smoke test asserts every sitemap URL passes it and no private
//     path appears. Storefront URLs (/p/<slug>) are NOT listed until
//     a profile is actually published — no slug is ever invented.
//   * Per-form landing content comes ONLY from the locked catalog
//     (src/lib/bundles.ts BUNDLE_TEMPLATES + lifecycle): form name,
//     locked service-fee range or "TO BE CONFIRMED", the locked USCIS
//     fee note, and the checklist length. No invented claims, no
//     invented reviews, no invented processing times.
//   * FAQ answers come from the lifecycle stage definitions
//     (src/lib/lifecycle.ts) — the platform's own locked wording —
//     with the source named on every entry. Nothing here claims
//     USCIS or any government body adopted or endorsed the platform.
import { BUNDLE_TEMPLATES, type BundleTemplate } from "./bundles";
import { LIFECYCLE_STAGES } from "./lifecycle";
import { LANGUAGES, type LanguageCode } from "./i18n";
import { CHEATSHEET_ROLES, getCheatsheet } from "./cheatsheets";
import { SPOKEN_LABEL } from "./storefront";
import { leadLoopSteps } from "./leadLoop";

export const SITE_URL = "https://immigration.niptei.com";
export const SITE_NAME = "Immigration with NIPTEI";

/** Shown wherever SEO is mentioned in the product. Never soften it. */
export const SEO_NO_RANKING_NOTE =
  "Search engines list this platform so people can find it. That does not guarantee a ranking, a number-one spot, or any position on Google, Yahoo, Bing, or any other search engine — no one can promise that. What we promise is honest, findable pages about the help we actually offer.";

export const SEO_DISCLAIMER =
  "Immigration with NIPTEI is a document-preparation service, not a law firm, and is not affiliated with USCIS or the Department of State. We do not guarantee approval. Only a licensed attorney or a DOJ-Accredited Representative gives legal advice or represents you (8 CFR 292.1).";

// ---------------------------------------------------------------------------
// Public pages — the ONLY pages the sitemap may list.
// ---------------------------------------------------------------------------

/** Static public paths (no login, no private case data). Defined
 *  below, after TOPIC_PAGES / LANGUAGE_PAGES, so the spreads below
 *  never read a table before it exists. See PUBLIC_SITEMAP_PATHS. */

// ---------------------------------------------------------------------------
// Per-topic landing pages — from existing content only.
// ---------------------------------------------------------------------------

export interface SeoTopic {
  slug: string;
  title: string;
  description: string;
  /** Form codes in the locked catalog — every one must resolve via
   *  formLanding(), asserted by the smoke test. Never invent a form. */
  formCodes: string[];
  related: { href: string; label: string }[];
  /** Locked source in this codebase. */
  source: string;
}

/** Topics are groupings of pages that already exist — a topic page
 *  links to real form landings, the glossary, and the free tools.
 *  It adds no new claim: each description restates what the linked
 *  pages already say, and the source is named. */
export const TOPIC_PAGES: SeoTopic[] = [
  {
    slug: "getting-started",
    title: "Getting started — how to get immigration help",
    description:
      "How getting help works here, step by step: arrive, tell us what you need, get a written quote, then documents and drafting. Document-preparation help only — not a law firm, no approval is guaranteed.",
    formCodes: [],
    related: [
      { href: "/leads", label: "Get immigration help — tell us what you need" },
      { href: "/free-tools", label: "Free tools — check your packet, fees, and dates first" },
      { href: "/journey", label: "Your journey — first question to green card in hand" },
    ],
    source: "Locked: src/lib/lifecycle.ts (lifecycle stages) + src/lib/leadLoop.ts (lead loop steps)",
  },
  {
    slug: "family",
    title: "Family petitions — bring a relative to the United States",
    description:
      "Petitions for a spouse or relative (Form I-130), adjusting status inside the United States (Form I-485), and the Affidavit of Support (Form I-864). Preparation fees are shown separately from government fees on every form page.",
    formCodes: ["I-130", "I-485", "I-864"],
    related: [
      { href: "/forms/I-130", label: "Form I-130 — Petition for Alien Relative" },
      { href: "/forms/I-485", label: "Form I-485 — Adjust Status" },
      { href: "/forms/I-864", label: "Form I-864 — Affidavit of Support" },
      { href: "/free-tools/sponsor-income", label: "Free sponsor income checker (Form I-864)" },
    ],
    source: "Locked: src/lib/bundles.ts (form catalog) + src/lib/formChecklists.ts (I-864 qualifier)",
  },
  {
    slug: "citizenship",
    title: "Citizenship — naturalization (Form N-400)",
    description:
      "Application for Naturalization (Form N-400), with interview preparation from the official civics questions. A practice question a day is free on the Today screen once signed in.",
    formCodes: ["N-400"],
    related: [
      { href: "/forms/N-400", label: "Form N-400 — Application for Naturalization" },
      { href: "/free-tools", label: "Free tools — interview question of the day" },
    ],
    source: "Locked: src/lib/bundles.ts (form catalog) + src/lib/interviewPrep.ts (question banks)",
  },
  {
    slug: "asylum",
    title: "Asylum — Form I-589 (clerical preparation only)",
    description:
      "Application for Asylum and for Withholding of Removal (Form I-589), prepared as a document-preparation service. Only a licensed attorney or a DOJ-Accredited Representative gives legal advice or represents you.",
    formCodes: ["I-589"],
    related: [{ href: "/forms/I-589", label: "Form I-589 — Application for Asylum" }],
    source: "Locked: src/lib/bundles.ts (form catalog)",
  },
  {
    slug: "tps",
    title: "Temporary Protected Status — TPS (Forms I-821 and I-765)",
    description:
      "Application for Temporary Protected Status (Form I-821), with employment authorization (Form I-765) where it applies. The checklist on each form page says exactly which documents we ask for.",
    formCodes: ["I-821", "I-821+I-765"],
    related: [
      { href: "/forms/I-821", label: "Form I-821 — Temporary Protected Status" },
      { href: "/forms/I-821+I-765", label: "Form I-821 + I-765 — TPS + Employment Authorization" },
    ],
    source: "Locked: src/lib/bundles.ts (form catalog)",
  },
  {
    slug: "travel",
    title: "Travel documents — Form I-131",
    description:
      "Application for Travel Document (Form I-131). Nothing here decides whether it is safe to travel — only a licensed attorney or a DOJ-Accredited Representative advises on travel.",
    formCodes: ["I-131"],
    related: [{ href: "/forms/I-131", label: "Form I-131 — Application for Travel Document" }],
    source: "Locked: src/lib/bundles.ts (form catalog)",
  },
  {
    slug: "green-card-replacement",
    title: "Replace a Green Card — Form I-90",
    description:
      "Application to Replace Permanent Resident Card (Form I-90). The form page shows the locked preparation fee, the government fee note, and the document checklist.",
    formCodes: ["I-90"],
    related: [{ href: "/forms/I-90", label: "Form I-90 — Replace Permanent Resident Card" }],
    source: "Locked: src/lib/bundles.ts (form catalog)",
  },
  {
    slug: "affidavit-of-support",
    title: "Affidavit of Support — sponsor income (Form I-864)",
    description:
      "The Affidavit of Support (Form I-864) and the 2026 sponsor income qualifier: 125% of the Federal Poverty Guidelines (100% for active-duty military). Check your household income against the locked 2026 table with the free sponsor income checker.",
    formCodes: ["I-864"],
    related: [
      { href: "/forms/I-864", label: "Form I-864 — Affidavit of Support" },
      { href: "/free-tools/sponsor-income", label: "Free sponsor income checker" },
    ],
    source: "Locked: src/lib/formChecklists.ts (SPONSOR_125_2026, 2026 Form I-864P)",
  },
  {
    slug: "fee-waiver",
    title: "Fee waiver — Form I-912 checklist, not a decision",
    description:
      "The Form I-912 fee-waiver checklist: the questions USCIS asks, and the 150% income figure derived from the locked 2026 table. Answering yes lets you ask for a waiver — only USCIS decides whether you get one.",
    formCodes: [],
    related: [
      { href: "/fee-waiver", label: "Fee waiver (Form I-912) — checklist" },
      { href: "/free-tools", label: "Free tools" },
    ],
    source: "Locked: src/lib/feeWaiverChecklist.ts + src/lib/feeWaiverChecker.ts (150% derived from the locked 2026 I-864P 100% column)",
  },
];

export function topicLanding(slug: string): SeoTopic | null {
  return TOPIC_PAGES.find((t) => t.slug === slug) ?? null;
}

// ---------------------------------------------------------------------------
// Per-language landing pages — honest about translation status.
// ---------------------------------------------------------------------------

export interface SeoLanguagePage {
  code: LanguageCode;
  label: string;
  native: string;
  /** Locked "I speak …" line from the storefront strings. */
  spokenLine: string;
  title: string;
  description: string;
}

/** One page per supported language. The page states plainly that
 *  help is offered in that language, shows the locked "I speak …"
 *  line, and links to the intake form and the free tools. It does
 *  NOT present machine-translated copy as verified: where no locked
 *  translation exists for a string, the page shows English with the
 *  note "Translation pending — shown in English"
 *  (src/lib/lockedTranslations.ts). No hreflang is emitted until a
 *  real translated version of a page exists — claiming one now
 *  would be inventing it. */
export const LANGUAGE_PAGES: SeoLanguagePage[] = LANGUAGES.map((l) => ({
  code: l.code,
  label: l.label,
  native: l.native,
  spokenLine: SPOKEN_LABEL[l.code],
  title: `Immigration help in ${l.label} (${l.native}) | Immigration with NIPTEI`,
  description:
    `Immigration with NIPTEI offers document-preparation help in ${l.label}. ` +
    `Tell us what you need in your preferred language — nothing is filed and no fee is due at the enquiry stage. ` +
    `Not a law firm, not affiliated with USCIS, no approval is guaranteed.`,
}));

export function languageLanding(code: string): SeoLanguagePage | null {
  return LANGUAGE_PAGES.find((l) => l.code === code) ?? null;
}

/** Static public paths (no login, no private case data). */
export const PUBLIC_SITEMAP_PATHS: string[] = [
  "/",
  "/leads",
  "/free-tools",
  "/free-tools/sponsor-income",
  "/free-tools/visa-bulletin",
  "/professionals",
  "/for-professionals",
  "/glossary",
  "/journey",
  "/your-rights",
  "/cheatsheets",
  ...CHEATSHEET_ROLES.map((r) => `/cheatsheets/${r.role}`),
  "/fee-waiver",
  "/packet-rescue",
  "/intake",
  "/onboarding",
  "/diy",
  "/interview-prep",
  "/backbone",
  "/safety",
  "/safety/privacy",
  "/safety/scam-guide",
  "/safety/printable-guide",
  "/reviews/new",
  ...TOPIC_PAGES.map((t) => `/topics/${t.slug}`),
  ...LANGUAGE_PAGES.map((l) => `/lang/${l.code}`),
  ...BUNDLE_TEMPLATES.map((t) => `/forms/${t.formCode}`),
];

/** Path prefixes that are private and must NEVER appear in a sitemap,
 *  robots allow-list, or any public index. */
export const PRIVATE_PATH_PREFIXES: string[] = [
  "/portal",
  "/today",
  "/client-dashboard",
  "/preparer-dashboard",
  "/attorney-dashboard",
  "/doj-dashboard",
  "/student-dashboard",
  "/teacher-dashboard",
  "/back-office",
  "/legal-back-office",
  "/company-back-office",
  "/admin/",
  "/family-case",
  "/family-portal/",
  "/api/",
  "/login",
  "/register",
  "/auth/",
];

/** Guard: true only for a public sitemap URL. A dashboard, portal,
 *  family, auth, or API path returns false. */
export function isPublicSitemapUrl(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (PRIVATE_PATH_PREFIXES.some((p) => path === p || path.startsWith(p))) {
    return false;
  }
  // Dynamic referral / storefront routes are public in principle, but
  // their URLs need a real code/slug — never listed without one.
  if (path.startsWith("/r/") || path.startsWith("/p/")) return false;
  return true;
}

export interface SitemapEntry {
  url: string;
  lastModified: string;
}

/** The sitemap entries. lastModified is the date this SEO foundation
 *  was built — it is a build date, not a claim that every page changed
 *  that day. */
export function sitemapEntries(): SitemapEntry[] {
  return PUBLIC_SITEMAP_PATHS.filter(isPublicSitemapUrl).map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: "2026-11-28",
  }));
}

// ---------------------------------------------------------------------------
// Per-form landing content — from the locked catalog only.
// ---------------------------------------------------------------------------

export interface FormLanding {
  formCode: string;
  name: string;
  title: string;
  description: string;
  /** Locked service-fee text, or "TO BE CONFIRMED". */
  serviceFeeText: string;
  /** Locked USCIS/government fee note (separate, never combined). */
  governmentFeeNote: string;
  checklistCount: number;
  checklistLabels: string[];
  /** True only when the catalog locks a service fee for this form. */
  feeLocked: boolean;
}

function serviceFeeTextFor(t: BundleTemplate): {
  text: string;
  locked: boolean;
} {
  if (!t.serviceFee) {
    return { text: "TO BE CONFIRMED", locked: false };
  }
  if ("flat" in t.serviceFee) {
    return { text: `$${t.serviceFee.flat}`, locked: true };
  }
  return {
    text: `Basic $${t.serviceFee.basic} / Standard $${t.serviceFee.standard} / Premium $${t.serviceFee.premium}`,
    locked: true,
  };
}

/** Landing content for one form code, or null when the code is not in
 *  the locked catalog. Never invents a form page. */
export function formLanding(formCode: string): FormLanding | null {
  const t = BUNDLE_TEMPLATES.find((b) => b.formCode === formCode);
  if (!t) return null;
  const fee = serviceFeeTextFor(t);
  return {
    formCode: t.formCode,
    name: t.name,
    title: `Form ${t.formCode} — ${t.name} | Immigration with NIPTEI`,
    description:
      `Immigration with NIPTEI prepares Form ${t.formCode} (${t.name}) as a document-preparation service — not a law firm, not affiliated with USCIS. ` +
      `Preparation fee: ${fee.text}. ${t.uscisFeeNote} ${SEO_DISCLAIMER}`,
    serviceFeeText: fee.text,
    governmentFeeNote: t.uscisFeeNote,
    checklistCount: t.checklist.length,
    checklistLabels: t.checklist.map((c) => c.label),
    feeLocked: fee.locked,
  };
}

export function allFormLandings(): FormLanding[] {
  return BUNDLE_TEMPLATES.map((t) => formLanding(t.formCode)).filter(
    (f): f is FormLanding => f !== null
  );
}

// ---------------------------------------------------------------------------
// Structured data (JSON-LD) — Organization + FAQ, from existing content.
// ---------------------------------------------------------------------------

export function buildOrganizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    description:
      "Immigration with NIPTEI is a document-preparation service, not a law firm, and is not affiliated with USCIS or the Department of State. Clerical and educational help with immigration forms, in 7 languages.",
    contactPoint: {
      "@type": "ContactPoint",
      email: "nipteiapp@gmail.com",
      telephone: "+1-772-971-6129",
      contactType: "customer service",
    },
  };
}

export interface SeoFaq {
  question: string;
  answer: string;
  /** Locked source in this codebase. */
  source: string;
}

/** FAQs — answers are the platform's own locked lifecycle wording.
 *  No answer promises an outcome, a timeline, or legal advice. */
export const SEO_FAQS: SeoFaq[] = [
  {
    question: "Is Immigration with NIPTEI a law firm?",
    answer:
      "No. Immigration with NIPTEI is a document-preparation service, not a law firm, and is not affiliated with USCIS or the Department of State. We do not guarantee approval. Only a licensed attorney or a DOJ-Accredited Representative gives legal advice or represents you (8 CFR 292.1).",
    source: "Locked: src/app/page.tsx + src/lib/lifecycle.ts — platform disclaimer",
  },
  {
    question: "What happens after I ask for immigration help?",
    answer:
      LIFECYCLE_STAGES[0].clientWhere +
      " " +
      LIFECYCLE_STAGES[0].clientNext[0],
    source: "Locked: src/lib/lifecycle.ts Stage 1 — New Lead (Inquiry)",
  },
  {
    question: "What does a written quote show?",
    answer:
      "The quote shows two separate amounts: (1) our preparation service fee, and (2) the USCIS government filing fee, which is paid separately to the U.S. Department of Homeland Security. No case has been filed yet at the quote stage.",
    source: "Locked: src/lib/lifecycle.ts Stage 2 — Consultation / Quote Sent",
  },
  {
    question: "When is my packet filed with USCIS?",
    answer:
      "Your packet must pass a full audit (100%) before it can be signed and filed, and the final balance must be paid before you can e-sign the finished packet. Nothing is sent to USCIS before you have read every draft and signed it.",
    source: "Locked: src/lib/lifecycle.ts Stage 4 — Active Client (Docs & Drafting)",
  },
  {
    question: "How long does it take to get a Green Card after entering the United States?",
    answer:
      "After you enter the United States, your Green Card and your Social Security Number (SSN) are mailed to your U.S. address, usually 30–90 days after entry. That 30–90 day range is the only timing the platform states — no exact date is ever promised.",
    source: "Locked: src/lib/lifecycle.ts Stage 6 — Visa Approved, Travel & Flight Prep / Closed",
  },
];

export function buildFaqJsonLd(
  faqs: SeoFaq[] = SEO_FAQS
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

// ---------------------------------------------------------------------------
// HowTo JSON-LD — only where the steps already exist honestly.
// ---------------------------------------------------------------------------

/** HowTo structured data for "how to get immigration help", built
 *  from the existing lead-loop steps (src/lib/leadLoop.ts) — the
 *  platform's own labelled flow. No step promises an outcome, a
 *  timeline, or an approval, and no totalTime is given because no
 *  time is ever promised. Used on /free-tools and /topics/getting-started. */
export function buildHowToJsonLd(): Record<string, unknown> {
  const steps = leadLoopSteps();
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to get immigration help with Immigration with NIPTEI",
    description:
      "Arrive, tell us what you need, get a written quote, then documents and drafting. Document-preparation help only — not a law firm, not affiliated with USCIS, no approval is guaranteed.",
    step: steps.map((s) => ({
      "@type": "HowToStep",
      name: s.title,
      text: `${s.detail} (${s.reuses})`,
    })),
  };
}

// ---------------------------------------------------------------------------
// Page metadata — one title + description per public page.
// ---------------------------------------------------------------------------

export interface PublicPageMeta {
  title: string;
  description: string;
}

/** Static public pages. Every description states the not-a-law-firm
 *  boundary or the free/paid boundary where it applies, and none
 *  promises a ranking, traffic, or clients. */
export const PUBLIC_PAGE_META: Record<string, PublicPageMeta> = {
  "/": {
    title: "Immigration with NIPTEI — Document-preparation help with immigration forms",
    description:
      "Immigration with NIPTEI prepares immigration forms as a document-preparation service, in 7 languages. Not a law firm, not affiliated with USCIS. No approval is guaranteed.",
  },
  "/leads": {
    title: "Get immigration help — Immigration with NIPTEI",
    description:
      "Tell us what immigration help you need. We reply in your preferred language. Nothing is filed and no fee is due at this stage.",
  },
  "/free-tools": {
    title: "Free immigration tools — packet check, fee calculator, Visa Bulletin | Immigration with NIPTEI",
    description:
      "Five free tools: Packet Health Check, fee calculator, interview question of the day, sponsor income checker, and Visa Bulletin date checker. Free to use — nothing is filed and no fee is due to try them.",
  },
  "/free-tools/sponsor-income": {
    title: "Free sponsor income checker (Form I-864) | Immigration with NIPTEI",
    description:
      "Check a sponsor's household income against the locked 2026 Form I-864P table (125%, 100% for active-duty military). A checklist check, not legal advice — your income is never stored.",
  },
  "/free-tools/visa-bulletin": {
    title: "Free Visa Bulletin date checker | Immigration with NIPTEI",
    description:
      "Check a priority date against a cutoff from the official Visa Bulletin. No cutoff dates are stored here — you enter the cutoff from travel.state.gov and the matcher checks it.",
  },
  "/professionals": {
    title: "Find a verified immigration professional — Immigration with NIPTEI",
    description:
      "Verified document preparers, attorneys, DOJ-accredited nonprofits, and law students. Only verified and published profiles are listed.",
  },
  "/for-professionals": {
    title: "For professionals — bring your own clients | Immigration with NIPTEI",
    description:
      "Document preparers, attorneys, and DOJ-accredited nonprofits: invite your own clients, publish a storefront, and follow up every lead. Clerical help only — not a law firm.",
  },
  "/glossary": {
    title: "Immigration glossary — plain-language definitions | Immigration with NIPTEI",
    description:
      "Immigration words explained in plain language, with the official source for each term. Educational information only, not legal advice.",
  },
  "/journey": {
    title: "Your journey — first question to green card in hand | Immigration with NIPTEI",
    description:
      "One case, whole journey: from your first question to the interview, to the green card in hand. Every step names its locked source. No USCIS timeline is invented.",
  },
  "/your-rights": {
    title: "Your rights at the interview / at the border | Immigration with NIPTEI",
    description:
      "What to know at the immigration interview and at the border. Educational information only, not legal advice. Only a licensed attorney or DOJ-Accredited Representative gives legal advice.",
  },
  "/cheatsheets": {
    title: "Start here cheatsheets — Immigration with NIPTEI",
    description:
      "Short, task-ordered Start here guides for every role on Immigration with NIPTEI: client, document preparer, attorney, DOJ-accredited nonprofit, law student, and teacher.",
  },
  "/fee-waiver": {
    title: "Fee waiver (Form I-912) — checklist, not a decision | Immigration with NIPTEI",
    description:
      "The Form I-912 fee-waiver checklist. Answering yes lets you ask for a waiver — only USCIS decides whether you get one.",
  },
  "/packet-rescue": {
    title: "Packet Rescue — free check of a packet prepared elsewhere | Immigration with NIPTEI",
    description:
      "Upload a packet prepared elsewhere. We audit it free and show exactly what is missing or wrong before you file. A checklist calculation, not a legal determination.",
  },
  "/intake": {
    title: "Intake — start your immigration case | Immigration with NIPTEI",
    description:
      "Start your intake: tell us about your case and what help you need. Nothing is filed at this stage. Document-preparation help only — not a law firm.",
  },
  "/onboarding": {
    title: "Choose your role — Immigration with NIPTEI",
    description:
      "Choose your role to join Immigration with NIPTEI: client, document preparer, attorney, DOJ-accredited nonprofit, law student, or teacher.",
  },
  "/diy": {
    title: "Do it yourself — guided filing, questions free | Immigration with NIPTEI",
    description:
      "Guided do-it-yourself filing, one form at a time. The questions are free; print, save, and email unlock only after the server confirms payment.",
  },
  "/interview-prep": {
    title: "Interview preparation — Immigration with NIPTEI",
    description:
      "Interview preparation from the official civics questions and practice banks. One question a day is free on the Today screen once signed in. No outcome is guaranteed.",
  },
  "/backbone": {
    title: "The Backbone — USCIS · NVC · Embassy | Immigration with NIPTEI",
    description:
      "How USCIS, the National Visa Center, and the embassy fit together in your case. Educational information from the platform's own case tracking.",
  },
  "/safety": {
    title: "Safety — scams, privacy, and emergency help | Immigration with NIPTEI",
    description:
      "How to spot immigration scams, how your information is kept private, and where to get emergency help. Educational information only.",
  },
  "/safety/privacy": {
    title: "Privacy — how your information is handled | Immigration with NIPTEI",
    description:
      "How Immigration with NIPTEI handles your information. Sensitive numbers are masked, never logged, and never put in email subjects.",
  },
  "/safety/scam-guide": {
    title: "Scam guide — spot immigration fraud | Immigration with NIPTEI",
    description:
      "How to spot immigration scams and what to do if someone asks you to pay in a way that does not feel right. Educational information only.",
  },
  "/safety/printable-guide": {
    title: "Printable safety guide | Immigration with NIPTEI",
    description:
      "A printable safety guide: your rights, scam warnings, and emergency contacts. Educational information only, not legal advice.",
  },
  "/reviews/new": {
    title: "Leave a review — Immigration with NIPTEI",
    description:
      "Leave a review of Immigration with NIPTEI. Only real reviews from real clients are published — no review is ever invented.",
  },
};

/**
 * Title + description for any public path, or null when the path is
 * not a public page. Dynamic routes resolve from their own locked
 * source: /forms/<code> from the form catalog, /topics/<slug> from
 * TOPIC_PAGES, /lang/<code> from LANGUAGE_PAGES,
 * /cheatsheets/<role> from the cheatsheet library. Storefront
 * (/p/<slug>) and referral (/r/<code>) pages get generic metadata —
 * never a name, claim, or review invented for an unknown slug/code.
 * Private paths return null.
 */
/** Generic metadata for dynamic segments. Layouts import these directly —
    never via metaForPublicPath() with a made-up slug/code, because the
    sitemap guard rightly rejects /p/ and /r/ paths without a real one. */
export const STOREFRONT_META: PublicPageMeta = {
  title: "Professional storefront — Immigration with NIPTEI",
  description:
    "A verified professional's storefront on Immigration with NIPTEI. Only verified and published profiles are listed.",
};

export const REFERRAL_META: PublicPageMeta = {
  title: "Referral link — Immigration with NIPTEI",
  description:
    "You arrived through a referral link. Tell us what immigration help you need — nothing is filed and no fee is due at this stage.",
};

export function metaForPublicPath(path: string): PublicPageMeta | null {
  if (!isPublicSitemapUrl(path)) return null;
  const direct = PUBLIC_PAGE_META[path];
  if (direct) return direct;
  if (path.startsWith("/forms/")) {
    const landing = formLanding(path.slice("/forms/".length));
    if (!landing) return null;
    return { title: landing.title, description: landing.description };
  }
  if (path.startsWith("/topics/")) {
    const topic = topicLanding(path.slice("/topics/".length));
    if (!topic) return null;
    return { title: `${topic.title} | Immigration with NIPTEI`, description: topic.description };
  }
  if (path.startsWith("/lang/")) {
    const lang = languageLanding(path.slice("/lang/".length));
    if (!lang) return null;
    return { title: lang.title, description: lang.description };
  }
  if (path.startsWith("/cheatsheets/")) {
    const role = path.slice("/cheatsheets/".length);
    try {
      const sheet = getCheatsheet(role as Parameters<typeof getCheatsheet>[0]);
      return {
        title: `${sheet.title} | Immigration with NIPTEI`,
        description: sheet.intro,
      };
    } catch {
      return null;
    }
  }
  if (path.startsWith("/p/")) {
    return STOREFRONT_META;
  }
  if (path.startsWith("/r/")) {
    return REFERRAL_META;
  }
  return null;
}
