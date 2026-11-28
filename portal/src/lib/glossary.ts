// Glossary of immigration terms — plain language, from the codebase.
// ---------------------------------------------------------------------------
// WHY: the founder wants this system to be the bible for anyone who
// needs immigration and has an immigration document filed. A client
// who cannot decode the words on their own letters cannot follow
// their own case. Every term below is already defined or used in this
// codebase (the source note on each entry names where), explained in
// plain language, and sourced to the official site that publishes it
// (uscis.gov, travel.state.gov, or justice.gov/eoir). Nothing here
// decides relief, eligibility, or an outcome — a definition is not
// legal advice, and each page that shows the glossary says so.
//
// Sourcing rule: definitions are written from the platform's own
// locked wording where it exists (interview prep, checklists,
// bundles, the Ask NIPTEI engine) and from the official source named
// on the entry. No term is invented as official, and no definition
// promises an outcome.

export interface GlossaryTerm {
  term: string;
  /** Short plain-language definition. */
  definition: string;
  /** Where the term is defined or used in this codebase. */
  definedIn: string;
  sourceLabel: string;
  sourceUrl: string;
}

const USCIS = { label: "uscis.gov", url: "https://www.uscis.gov" };
const TRAVEL_STATE = {
  label: "travel.state.gov",
  url: "https://travel.state.gov",
};
const EOIR = { label: "justice.gov/eoir", url: "https://www.justice.gov/eoir" };

export const GLOSSARY: GlossaryTerm[] = [
  {
    term: "Adjustment of Status (Form I-485)",
    definition:
      "Applying for a green card from inside the United States, instead of going through a U.S. embassy abroad. You file Form I-485 with USCIS while you are in the U.S.",
    definedIn: "src/lib/interviewPrep.ts (I-485 interview bank) and src/lib/formChecklists.ts (I-485 template)",
    sourceLabel: USCIS.label,
    sourceUrl: "https://www.uscis.gov/green-card/green-card-processes-and-procedures/adjustment-of-status",
  },
  {
    term: "Affidavit of Support (Form I-864)",
    definition:
      "A signed promise by a sponsor that they will financially support the person coming to the U.S. The sponsor must show income at 125% of the poverty guidelines, or a joint sponsor is needed.",
    definedIn: "src/lib/interviewPrep.ts (I-485 what-to-bring + delay reasons) and src/lib/formChecklists.ts (I-864 template)",
    sourceLabel: USCIS.label,
    sourceUrl: USCIS.url,
  },
  {
    term: "A-Number (Alien Registration Number)",
    definition:
      "The number USCIS gives to a noncitizen's immigration file. It appears on USCIS letters and on a green card. This platform masks it in the screen — it is never shown in full, never logged, and never put in an email subject.",
    definedIn: "src/lib/diy.ts (sensitive values: DOB, A-Number, SSN, passport number are masked)",
    sourceLabel: USCIS.label,
    sourceUrl: USCIS.url,
  },
  {
    term: "Biometrics",
    definition:
      "A USCIS appointment where your fingerprints, photo and signature are taken so USCIS can run background checks. The appointment notice tells you where and when to go.",
    definedIn: "src/lib/formChecklists.ts (biometrics fee lines in the checklist templates)",
    sourceLabel: USCIS.label,
    sourceUrl: USCIS.url,
  },
  {
    term: "CEAC (Consular Electronic Application Center)",
    definition:
      "The U.S. Department of State's online system where consular (embassy) cases pay fees and submit the DS-260 visa application and civil documents.",
    definedIn: "src/lib/formChecklists.ts (I-130 + NVC template — CEAC fees, DS-260)",
    sourceLabel: TRAVEL_STATE.label,
    sourceUrl: TRAVEL_STATE.url,
  },
  {
    term: "Civil surgeon",
    definition:
      "A doctor USCIS has designated to do the immigration medical exam (Form I-693) inside the United States. Only a civil surgeon can complete and seal the I-693 — not your own doctor.",
    definedIn: "src/lib/formChains.ts (I-693: book a USCIS-designated civil surgeon)",
    sourceLabel: USCIS.label,
    sourceUrl: USCIS.url,
  },
  {
    term: "Conditional green card",
    definition:
      "A green card that lasts 2 years, given through a marriage that is less than 2 years old when residence is granted. Before it expires you file Form I-751 to remove the conditions — in the 90-day window before expiry.",
    definedIn: "src/lib/renewals.ts (conditional_green_card — I-751, 90-day filing window)",
    sourceLabel: USCIS.label,
    sourceUrl: USCIS.url,
  },
  {
    term: "Consular processing",
    definition:
      "Getting an immigrant visa through a U.S. embassy or consulate abroad, after USCIS approves the petition and the National Visa Center (NVC) finishes its steps — instead of adjusting status inside the U.S.",
    definedIn: "src/lib/formChecklists.ts (I-130 + NVC Consular template) and src/lib/interviewPrep.ts (consular interview bank)",
    sourceLabel: TRAVEL_STATE.label,
    sourceUrl: TRAVEL_STATE.url,
  },
  {
    term: "Derivative",
    definition:
      "A family member (usually a spouse or unmarried child) who is included on the main applicant's case, rather than filing a separate petition of their own.",
    definedIn: "src/lib/bundles.ts (familySlots: principal applicant + derivatives)",
    sourceLabel: USCIS.label,
    sourceUrl: USCIS.url,
  },
  {
    term: "DOJ-accredited representative",
    definition:
      "A person at a recognised nonprofit organisation whom the U.S. Department of Justice has accredited to give immigration legal help. Only a licensed attorney or a DOJ-accredited representative gives legal advice on this platform's rules (8 CFR 292.1).",
    definedIn: "src/lib/askNiptei.ts (escalation: Find Attorney / Find DOJ roster)",
    sourceLabel: EOIR.label,
    sourceUrl: "https://www.justice.gov/eoir/recognition-and-accreditation-program",
  },
  {
    term: "EAD (Employment Authorization Document)",
    definition:
      "A work permit — the card that shows you are allowed to work in the United States while your case is pending or while you hold a status that allows work. Applied for on Form I-765.",
    definedIn: "src/lib/renewals.ts (ead — EAD renewal, Form I-765)",
    sourceLabel: USCIS.label,
    sourceUrl: USCIS.url,
  },
  {
    term: "EOIR (Executive Office for Immigration Review)",
    definition:
      "The part of the U.S. Department of Justice that runs the immigration courts and the Board of Immigration Appeals. If your case is in court, EOIR — not USCIS — is handling it.",
    definedIn: "src/lib/askNiptei.ts (sources: justice.gov/eoir)",
    sourceLabel: EOIR.label,
    sourceUrl: EOIR.url,
  },
  {
    term: "Green card (Lawful Permanent Resident card)",
    definition:
      "The card that proves you are a lawful permanent resident of the United States. A 10-year card is replaced on Form I-90; file 6 months before it expires.",
    definedIn: "src/lib/renewals.ts (green_card — I-90, file 6 months before expiry)",
    sourceLabel: USCIS.label,
    sourceUrl: USCIS.url,
  },
  {
    term: "I-693 sealed envelope",
    definition:
      "The envelope the civil surgeon seals after your immigration medical exam. Do not open it — an opened envelope is not accepted. Bring it sealed to your interview.",
    definedIn: "src/lib/interviewPrep.ts (I-485 what-to-bring: sealed I-693 envelope — DO NOT OPEN IT)",
    sourceLabel: USCIS.label,
    sourceUrl: USCIS.url,
  },
  {
    term: "NVC (National Visa Center)",
    definition:
      "The U.S. Department of State office that handles your case after USCIS approves the petition and before the embassy interview — collecting fees, the DS-260, and civil documents through CEAC.",
    definedIn: "src/lib/formChecklists.ts (I-130 + NVC template)",
    sourceLabel: TRAVEL_STATE.label,
    sourceUrl: TRAVEL_STATE.url,
  },
  {
    term: "Panel physician",
    definition:
      "A doctor the U.S. embassy names to do the medical exam abroad, before a consular interview. Not your own doctor — the embassy tells you which doctor to use.",
    definedIn: "src/lib/interviewPrep.ts (consular what-to-bring: medical exam from the embassy's panel physician)",
    sourceLabel: TRAVEL_STATE.label,
    sourceUrl: TRAVEL_STATE.url,
  },
  {
    term: "Petitioner and beneficiary",
    definition:
      "The petitioner is the person who files the petition (for example, the U.S. citizen or resident spouse). The beneficiary is the person the petition is filed for.",
    definedIn: "src/lib/formChecklists.ts (petitioning spouse / sponsor language in the I-864 and I-130 templates)",
    sourceLabel: USCIS.label,
    sourceUrl: USCIS.url,
  },
  {
    term: "Priority date",
    definition:
      "The date that sets your place in line for a visa number. Your priority date must be current in the monthly Visa Bulletin before a visa can be issued.",
    definedIn: "src/lib/visaBulletin.ts (cutoff dates by chargeability area) and src/lib/interviewPrep.ts (visa not yet available)",
    sourceLabel: TRAVEL_STATE.label,
    sourceUrl: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html",
  },
  {
    term: "Receipt notice",
    definition:
      "The letter USCIS sends after it receives your form, confirming it has your case and giving you a receipt number you can use to check the case. Keep every receipt notice.",
    definedIn: "src/lib/bundles.ts (receipt notice in the I-131 checklist) and src/lib/lifecycle.ts (case tracking)",
    sourceLabel: USCIS.label,
    sourceUrl: USCIS.url,
  },
  {
    term: "RFE (Request for Evidence)",
    definition:
      "A letter from USCIS asking for more documents or information before it can decide your case. It is not a denial. The letter lists exactly what is asked for and a deadline — use the date printed on the letter, never guess it.",
    definedIn: "src/lib/askNiptei.ts (RFE Decoder: the letter is scary, the fix is a checklist)",
    sourceLabel: USCIS.label,
    sourceUrl: USCIS.url,
  },
  {
    term: "Sponsor and joint sponsor",
    definition:
      "The sponsor is the petitioner who signs the Affidavit of Support (I-864). If the sponsor's income is below 125% of the poverty guidelines, a joint sponsor — a second person who meets the income rule — signs a separate I-864.",
    definedIn: "src/lib/interviewPrep.ts (sponsor income too low — a joint sponsor is needed) and src/lib/formChecklists.ts (I-864 template)",
    sourceLabel: USCIS.label,
    sourceUrl: USCIS.url,
  },
  {
    term: "TPS (Temporary Protected Status)",
    definition:
      "A temporary immigration status for people from a country USCIS has designated for TPS. You apply on Form I-821, and can apply for a work permit (EAD) on Form I-765 with it.",
    definedIn: "src/lib/bundles.ts (I-821 TPS + I-765 EAD) and src/lib/renewals.ts (tps renewal)",
    sourceLabel: USCIS.label,
    sourceUrl: USCIS.url,
  },
  {
    term: "USCIS",
    definition:
      "U.S. Citizenship and Immigration Services — the government agency that receives and decides most immigration applications inside the United States (petitions, green cards, work permits, naturalization). Immigration with NIPTEI is not USCIS and is not affiliated with it.",
    definedIn: "src/lib/askNiptei.ts (sources: uscis.gov on every answer)",
    sourceLabel: USCIS.label,
    sourceUrl: USCIS.url,
  },
  {
    term: "Visa Bulletin",
    definition:
      "The U.S. Department of State's monthly list of cutoff dates for family-based and employment-based immigrant visas. When your priority date is earlier than the cutoff date for your category, a visa number is available.",
    definedIn: "src/lib/visaBulletin.ts (November 2026 bulletin) and src/lib/immigrationNews.ts (built-in news)",
    sourceLabel: TRAVEL_STATE.label,
    sourceUrl: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html",
  },
];

export const GLOSSARY_DISCLAIMER =
  "Educational information only, not legal advice. Immigration with NIPTEI is a document-preparation service, not a law firm, and is not USCIS. Only a licensed attorney or DOJ-accredited representative gives legal advice (8 CFR 292.1).";

/** Find a term by a word in the question ("what does rfe mean").
 *  Deliberately strict: a single common word is NOT a match
 *  ("adjustment" alone must not match "Adjustment of Status" when
 *  the question is about the Family Adjustment Bundle). A term
 *  matches when the question contains its acronym / first token
 *  (RFE, TPS, EAD, NVC, CEAC, EOIR, USCIS) or at least TWO of its
 *  distinctive words ("visa bulletin", "affidavit of support").
 *  Longest match wins so "affidavit of support" beats "support". */
export function findGlossaryTerm(question: string): GlossaryTerm | null {
  const q = question.toLowerCase();
  const scored = GLOSSARY.map((g) => {
    const firstToken = g.term.split(/[^A-Za-z0-9]+/)[0] ?? "";
    const isAcronym =
      firstToken.length >= 2 &&
      firstToken.length <= 5 &&
      firstToken === firstToken.toUpperCase() &&
      /[A-Z]/.test(firstToken);
    const keys = g.term
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2);
    const shared = keys.filter((k) => q.includes(k)).length;
    const acronymHit = isAcronym && q.includes(firstToken.toLowerCase());
    return { term: g, shared, match: acronymHit || shared >= 2 };
  }).filter((s) => s.match);
  if (scored.length === 0) return null;
  scored.sort((a, b) => b.shared - a.shared || b.term.term.length - a.term.term.length);
  return scored[0].term;
}

/** True when every glossary entry carries a definition, a codebase source and an official source. */
export function allGlossaryTermsSourced(): boolean {
  return GLOSSARY.every(
    (g) =>
      g.definition.length > 0 &&
      g.definedIn.length > 0 &&
      g.sourceLabel.length > 0 &&
      g.sourceUrl.startsWith("https://")
  );
}
