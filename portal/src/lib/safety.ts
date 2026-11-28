// Safety content for vulnerable immigrant clients — expert additions,
// NOT asked for, added because they matter (founder's standing
// instruction, Nov 28, 2026).
//
// REAL ONLY — every hotline number below is locked in the frozen public
// site (~/workspace/itfw-live/index.html) and nowhere else:
//   * National Domestic Violence Hotline 1-800-799-7233, TTY
//     1-800-787-3224, text "START" to 88788 — index.html:3759, 4545.
//   * National Human Trafficking Hotline 1-888-373-7888 —
//     index.html:3769, 4733.
//   * 911 for immediate danger — index.html:626 and throughout.
// No other hotline number is used anywhere in this file. The USCIS
// tip line is NOT in the codebase, so no number for it is given here:
// reporting goes to the official pages linked below instead.
//
// TRANSLATIONS — the 7-language rule is locked
// (src/lib/lockedTranslations.ts): a translation is shown ONLY when it
// comes from a locked template string already in the codebase, and
// there is NO live machine translation. No locked translation exists
// yet for any string in this file, so every page renders the English
// original and shows TRANSLATION_PENDING_NOTE in the client's
// language. A human-written translation must be added to
// STOREFRONT_STRINGS before any non-English text for this content is
// shown — never a machine translation pasted in as if verified.
//
// DATA MINIMISATION — this feature adds NO new sensitive field, NO new
// table, and NO migration: it is content + navigation only. Nothing
// here collects, stores, or sends a DOB, A-Number, SSN, passport
// number, CEAC password, or case detail. The Quick Exit control logs
// nothing — no fetch, no analytics event, no console entry — by
// design; see src/components/safety/QuickExitButton.tsx.
//
// NOT A LAW FIRM — Immigration with NIPTEI is a document-preparation
// service, not a law firm, not USCIS. Only a licensed attorney or
// DOJ-accredited representative gives legal advice (8 CFR 292.1).
// Nothing here decides relief, eligibility, evidence strength, or
// whether it is safe to leave, and nothing here promises an approval
// or protection outcome.
import { TRANSLATION_PENDING_NOTE, type LanguageCode } from "./lockedTranslations";

/** Where Quick Exit goes: Google, exactly as the public site's
 *  Quick Exit links do (index.html:4541, 4661). */
export const QUICK_EXIT_URL = "https://www.google.com";

/** The public site's VAWA and U/T pages (frozen index.html) — the
 *  portal has no VAWA/U/T page of its own, so the safety hub links
 *  out to them instead of duplicating them. */
export const PUBLIC_VAWA_URL = "https://immigration.niptei.com/#vawa";
export const PUBLIC_U_VISA_URL = "https://immigration.niptei.com/#uvisa";

/** Official reporting pages. No phone number is given for either:
 *  the USCIS tip line is not locked anywhere in the codebase, and
 *  the FTC takes immigration-scam reports online. */
export const FTC_REPORT_FRAUD_URL = "https://reportfraud.ftc.gov";
export const USCIS_AVOID_SCAMS_URL = "https://www.uscis.gov/avoid-scams";
export const USCIS_VAWA_URL =
  "https://www.uscis.gov/humanitarian/abused-spouses-children-and-parents";
export const DOMESTIC_VIOLENCE_HOTLINE_URL = "https://www.thehotline.org";
export const TRAFFICKING_HOTLINE_URL = "https://humantraffickinghotline.org";

/** Contact already locked in the portal (src/app/page.tsx:93,
 *  src/app/onboarding/page.tsx:96) — used for data-deletion requests. */
export const PLATFORM_CONTACT_EMAIL = "nipteiapp@gmail.com";
export const PLATFORM_CONTACT_PHONE = "(772) 971-6129";

export type Hotline = {
  id: string;
  name: string;
  number: string;
  telHref: string;
  text?: string;
  tty?: string;
  ttyTelHref?: string;
  note: string;
  website?: string;
};

/** Every number here is copied from the frozen public site — see the
 *  header comment for the exact lines. Do not add a number without a
 *  locked source. */
export const EMERGENCY_HOTLINES: Hotline[] = [
  {
    id: "emergency-911",
    name: "Emergency — immediate danger",
    number: "911",
    telHref: "tel:911",
    note: "Call now if you are in danger right now.",
  },
  {
    id: "dv-hotline",
    name: "National Domestic Violence Hotline",
    number: "1-800-799-7233",
    telHref: "tel:+18007997233",
    text: "Text “START” to 88788",
    tty: "TTY 1-800-787-3224",
    ttyTelHref: "tel:+18007873224",
    note: "Free, confidential, 24/7, in many languages. They can help you make a safety plan and find shelter and local help.",
    website: DOMESTIC_VIOLENCE_HOTLINE_URL,
  },
  {
    id: "trafficking-hotline",
    name: "National Human Trafficking Hotline",
    number: "1-888-373-7888",
    telHref: "tel:+18883737888",
    note: "Free, confidential, 24/7, in more than 200 languages.",
    website: TRAFFICKING_HOTLINE_URL,
  },
];

/** The numbers above, for the smoke test: every hotline number shown
 *  in the UI must be in this list, and this list must contain only
 *  numbers locked in the public site. */
export const LOCKED_HOTLINE_NUMBERS = EMERGENCY_HOTLINES.map((h) => h.number);

export type ScamRedFlag = {
  id: string;
  title: string;
  whatItLooksLike: string;
  whatToDo: string;
};

/** Plain-language immigration-scam guide. English originals only —
 *  see the header comment on translations. */
export const SCAM_RED_FLAGS: ScamRedFlag[] = [
  {
    id: "notario",
    title: "“Notario” fraud — someone who is not a lawyer gives legal advice",
    whatItLooksLike:
      "In many countries a “notario” is a lawyer. In the United States a notary public is NOT a lawyer and cannot give legal advice, choose your form, or tell you what you qualify for. A notario who files the wrong form, misses a deadline, or takes your money and files nothing can destroy a case that could have been won.",
    whatToDo:
      "Only a licensed attorney or a DOJ-accredited representative gives legal advice (8 CFR 292.1). A document preparer can only do clerical work — type what you tell them, exactly as you say it. Ask anyone who offers legal help to show their licence or DOJ accreditation, and check it before you pay.",
  },
  {
    id: "fake-job-offer",
    title: "Fake job offers — pay first, then the job disappears",
    whatItLooksLike:
      "A “job offer” in the United States that asks you to pay a fee first — for the offer letter, for “processing”, for a visa, for travel — before you have a signed job and a real employer. Real employers in the United States do not charge workers for a job.",
    whatToDo:
      "Never pay for a job offer. Check the employer: a real business name, a real address, a real phone number you can call. If you already paid, keep every receipt, message, and name, and report it (see below).",
  },
  {
    id: "fee-scam",
    title: "Fee scams — extra fees, or fees paid the wrong way",
    whatItLooksLike:
      "Someone asks for a USCIS or government fee in cash, by gift card, by wire transfer, by cryptocurrency, or to a personal account — or adds a “special fee” USCIS never charges. Government fees are paid to USCIS or the Department of State, in the way the official instructions say, and no one can make USCIS work faster by paying extra to a person.",
    whatToDo:
      "Check every fee against the official USCIS fee page or your receipt notice before you pay. Never pay a government fee by gift card, wire, or cryptocurrency. Keep the receipt for every fee you pay.",
  },
  {
    id: "fake-uscis-contact",
    title: "Fake USCIS calls, emails, and texts asking for money",
    whatItLooksLike:
      "A call, email, or text that says it is from USCIS, ICE, or another government office, says there is a problem with your case, and tells you to pay right now — by gift card, wire transfer, or cryptocurrency — or you will be arrested or deported. USCIS does not call, email, or text you to demand payment that way.",
    whatToDo:
      "Do not pay, and do not give your case number, A-Number, date of birth, or bank details to a caller. Hang up and call USCIS yourself from the number on uscis.gov, or ask your preparer or attorney. Keep the message and the number that called you, and report it (see below).",
  },
  {
    id: "fake-expedited",
    title: "Fake “expedited” or “guaranteed approval” promises",
    whatItLooksLike:
      "Someone promises your case will be approved, promises it will be faster if you pay extra, or promises a green card or a visa no one can promise. No one outside USCIS or the consulate decides your case, and no payment to a private person makes USCIS decide faster or approve a case.",
    whatToDo:
      "Walk away from any guarantee. Only USCIS (or the consulate, for a visa abroad) decides your case. If someone took your money on a guarantee, keep every receipt and message, and report it (see below).",
  },
  {
    id: "document-theft",
    title: "Someone keeps your passport or your original documents",
    whatItLooksLike:
      "An employer, a “sponsor”, a preparer, or a partner keeps your passport, your birth certificate, or your other original documents and will not give them back, or uses them to control you.",
    whatToDo:
      "No one has the right to keep your passport to control you. Ask for your documents back in writing and keep a copy of what you asked. If they will not return them, tell a trusted person, call the trafficking hotline (1-888-373-7888) if it is forced labour or trafficking, and get legal help — a licensed attorney or DOJ-accredited representative.",
  },
];

export const SCAM_REPORT_STEPS: string[] = [
  "Stop paying. Do not send more money, gift cards, or documents.",
  "Keep everything: receipts, messages, emails, names, phone numbers, and the website or office address. Take photos or screenshots.",
  "Report it to the Federal Trade Commission at ReportFraud.ftc.gov — the FTC takes reports about immigration scams online.",
  "Tell USCIS about the scam at uscis.gov/avoid-scams, which also explains how USCIS really contacts people.",
  "Tell your preparer or attorney, so your real case is protected and no wrong form is filed for you.",
];

export const SCAM_DISCLAIMER =
  "Educational information only, not legal advice. Immigration with NIPTEI is a document-preparation service, not a law firm, and is not USCIS. Only a licensed attorney or DOJ-accredited representative gives legal advice (8 CFR 292.1).";

/** VAWA / U / T signpost — every fact here is copied from the frozen
 *  public site (index.html:626, 3759, 4529, 4620, 4663, 4733), not
 *  written fresh. The full pages live on the public site. */
export const VAWA_SIGNPOST = {
  heading: "If someone is hurting you at home — you may have a way forward on your own",
  points: [
    "Under VAWA, an abused spouse of a U.S. citizen or of a green card holder can self-petition on Form I-360 (USCIS fee $0) and then apply for a green card — without the abuser's help, signature, or knowledge. The same self-petition exists for an abused child and an abused parent of a U.S. citizen.",
    "USCIS keeps the case confidential and never tells the abuser. Filing VAWA does not automatically arrest the abuser or take their green card or citizenship — it is about your immigration status, not a criminal case against them.",
    "Information in a U visa, T visa, or VAWA case is strictly confidential and protected by law (8 U.S.C. §1367). You may use a safe mailing address on your petition — you do not have to live there.",
    "If the abuser is not a spouse, parent, or child — a boyfriend or girlfriend, a sibling, an employer — VAWA does not fit, but a U visa (crime victims) or T visa (trafficking) may. The T visa (Form I-914) has no USCIS fee, lasts 4 years with a work permit, and a green card can follow after 3 years.",
    "These cases involve legal analysis and legal help is strongly recommended — the choice is yours: DIY, a document preparer (clerical only), a licensed attorney, or a DOJ-accredited nonprofit.",
  ],
  disclaimer:
    "General information, not legal advice, and promises no outcome. In danger now? Call 911.",
};

export type PrivacySection = { id: string; heading: string; body: string[] };

/** Plain-language privacy page content. What the platform stores is
 *  stated from what this codebase actually holds (accounts, cases,
 *  questionnaire answers, uploaded documents in the vault, messages
 *  about the case); what it never stores is locked in the codebase —
 *  "Never store a CEAC password" (src/lib/agency.ts:5-6,
 *  src/lib/lifecycle.ts:147) — and no SSN field exists anywhere in
 *  the portal or its migrations. */
export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    id: "what-we-store",
    heading: "What we store about you",
    body: [
      "Your contact details — your name, phone number, and email address — so we can reach you about your case.",
      "Your questionnaire answers and the case information you give us, so your forms are prepared correctly.",
      "The documents you upload to your Document Vault, so your preparer can use them for your case.",
      "Messages about your case between you and the people working on it.",
    ],
  },
  {
    id: "what-we-never-store",
    heading: "What we never store",
    body: [
      "We never store your Social Security Number (SSN). Do not type your SSN into the portal.",
      "We never store your CEAC password. The government site CEAC is where consular fees are paid — log in there yourself, and never share that password with anyone, including us.",
      "We never store your USCIS online account password or your bank password. Never share a password with anyone.",
      "We do not ask for, and do not store, your full bank account number.",
    ],
  },
  {
    id: "who-can-see",
    heading: "Who can see your file",
    body: [
      "Only the people working on your case — your preparer and the staff who help with it — can see your file.",
      "We never share your file with the person you are filing about, or with anyone else, unless you ask us to in writing.",
      "We never sell your data. We never sell your name, your contact details, or your case information to anyone.",
    ],
  },
  {
    id: "delete-your-data",
    heading: "How to ask for your data to be deleted",
    body: [
      `Write to us at ${PLATFORM_CONTACT_EMAIL} or call ${PLATFORM_CONTACT_PHONE} and say “please delete my data”. Tell us the name and email address on your account so we find the right file.`,
      "We will confirm what was deleted. Some records — for example, a receipt for a payment you made — may have to be kept for accounting or legal reasons; if so, we will tell you what is kept and why.",
      "Deleting your data does not delete a case already filed with USCIS or the consulate. Only USCIS or the consulate holds that file.",
    ],
  },
  {
    id: "protect-yourself",
    heading: "How to protect yourself while you use this site",
    body: [
      "Use a device only you control, if you can. On a shared phone or computer, use a private or incognito window.",
      "Do not save your password in a shared browser, and log out when you finish.",
      "Never send your SSN, your CEAC password, or your bank details by email or chat — not to us, not to anyone.",
    ],
  },
];

export const PRIVACY_DISCLAIMER =
  "Educational information only, not legal advice. Immigration with NIPTEI is a document-preparation service, not a law firm, and is not USCIS. Only a licensed attorney or DOJ-accredited representative gives legal advice (8 CFR 292.1).";

/** Safe-browsing tips shown on the safety hub. The honest limit is
 *  stated, not hidden: Quick Exit changes the page you are looking
 *  at — it does not erase your browser history. */
export const SAFE_BROWSING_TIPS: string[] = [
  "If someone may check your phone or computer later, use a private or incognito window, and clear your browser history when you finish.",
  "Quick Exit opens Google instead of this page and does not go back to it — but it does NOT erase your browser history. Clear your history yourself, or use a private window.",
  "If you can, use a device only you control — a friend's phone, a library computer, or a phone the other person cannot check.",
  "Do not save your password in a shared browser, and log out when you finish.",
  "Your appointment notice and your USCIS receipt notice list exactly what to bring and what happens next — they override any general list on this site.",
];

/** Printable guide — the checklist half is new and general; the
 *  what-to-bring and interview-conduct halves are REUSED from
 *  src/lib/interviewPrep.ts (WHAT_TO_BRING, CONDUCT_GUIDE), not
 *  rewritten, so the printed page can never disagree with the
 *  interview-prep pages. No PDF generator is used: the page prints
 *  with the browser (window.print) and the print CSS in
 *  src/app/globals.css. */
export const PRINTABLE_CHECKLIST: { id: string; heading: string; items: string[] }[] = [
  {
    id: "before-you-file",
    heading: "Before you file — checklist",
    items: [
      "Your appointment notice or receipt notice, if you have one — read it first, it overrides this list.",
      "A government photo ID and your passport(s), including expired ones.",
      "Your birth certificate (original) and a certified English translation if it is not in English.",
      "Marriage / divorce certificates, if any apply, with certified translations.",
      "Tax returns or IRS transcripts for the last 3–5 years, if your form asks for them.",
      "Proof of where you live now — lease, bills, or a state ID.",
      "Court records for any arrest or charge, if any apply — certified dispositions, not summaries.",
      "Your USCIS receipt number, if you have one — keep it somewhere safe, not on this page.",
    ],
  },
  {
    id: "interview-day",
    heading: "On interview day — checklist",
    items: [
      "Arrive early. Bring the appointment notice and a photo ID.",
      "Bring originals AND copies, organised by date.",
      "Bring the sealed medical exam envelope (Form I-693) — do not open it.",
      "Answer clearly and completely. If you do not understand a question, say so and ask the officer to repeat it.",
      "Tell the truth about everything, including arrests and travel. Hiding something hurts your case more than the fact itself.",
      "If you do not understand English well, ask for an interpreter before the interview — do not guess at the questions.",
    ],
  },
  {
    id: "after-the-interview",
    heading: "After the interview — checklist",
    items: [
      "Keep every paper the officer gives you, and every letter USCIS sends you after.",
      "If USCIS asks for more evidence (a Request for Evidence), read the deadline on the notice — the deadline is on the notice itself.",
      "Tell us the same day if you move, change your phone number, or change your email address — USCIS sends time-sensitive letters to the address on file.",
      "Never pay anyone who calls, emails, or texts saying your case has a problem and you must pay now by gift card or wire. USCIS does not contact you that way.",
      "Keep your own copies of everything you filed, separate from the originals you sent — if a paper is lost, your copy is your proof.",
      "If USCIS sends a notice for someone else in your family, check whose name is on it before you act — do not assume it is yours.",
    ],
  },
];

/**
 * Language handling for the new safety pages. The pages keep a
 * language picker (the same 7 codes as src/lib/i18n.ts) and always
 * show the English original. A translation is shown only when a
 * locked template string exists for it — none exists for this
 * content — so for every language other than English this returns
 * the locked "Translation pending" note. Arabic is RTL: callers set
 * dir="rtl" lang="ar" on the content wrapper when lang is "ar".
 */
export function safetyTranslationNote(lang: LanguageCode): string | null {
  return lang === "en" ? null : TRANSLATION_PENDING_NOTE;
}

export function isSafetyRtl(lang: LanguageCode): boolean {
  return lang === "ar";
}
