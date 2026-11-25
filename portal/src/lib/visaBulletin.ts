// Visa Bulletin priority-date matcher — PURE LOGIC, no live data.
// ============================================================================
// Data source: the U.S. Department of State Visa Bulletin, published
// monthly at travel.state.gov. URL pattern VERIFIED against the live
// November 2026 bulletin (Nov 19, 2026):
//   https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2027/visa-bulletin-for-november-2026.html
// The bulletin month October–December belongs to the NEXT fiscal year
// (November 2026 = Fiscal Year 2027), which visaBulletinUrl() handles.
//
// This file contains NO cutoff dates. Cutoffs are entered by a
// professional from the official bulletin (see VisaBulletinManager) and
// stored in visa_bulletin_months / visa_bulletin_cutoffs (migration
// 0018 — renumbered from 0012 by the Nov 19–20 consolidation).
// NEVER invent a cutoff date, and NEVER present a result as verified
// unless the stored month + source URL are shown with it.
// verified unless the stored month + source URL are shown with it.
//
// Locked rules:
//  * "C" (Current) = a visa number is available; "U" (Unavailable) =
//    none available that month.
//  * A priority date is current only when it is STRICTLY BEFORE the
//    cutoff date for that category + chargeability country. A priority
//    date EQUAL to the cutoff is NOT current.
//  * Chargeability = country of BIRTH, not citizenship.
//  * Cross-chargeability: a principal may be charged to the spouse's
//    country of birth when the spouse was born in a different country.
//    The matcher evaluates both countries and reports the more
//    favorable result, labelled with which chargeability was used.
//  * Adjustment-of-status cases use the USCIS "Dates for Filing"
//    chart; consular cases use the Department of State Final Action
//    Dates chart. The chart used is always labelled on the result.
//    Which chart USCIS accepts for adjustment in a given month is
//    announced at uscis.gov/visabulletininfo — the professional must
//    confirm it; this matcher does not decide it.
//  * NO live scraping. Label on every result:
//    "Cutoff dates entered from the official Visa Bulletin, month [X]
//    — verify at travel.state.gov before filing."
// ============================================================================

export type VisaCategory =
  | "F1"
  | "F2A"
  | "F2B"
  | "F3"
  | "F4"
  | "EB-1"
  | "EB-2"
  | "EB-3"
  | "EB-3 Other Workers"
  | "EB-4"
  | "EB-5 Unreserved"
  | "EB-5 Rural"
  | "EB-5 High Unemployment"
  | "EB-5 Infrastructure";

export const VISA_CATEGORIES: { code: VisaCategory; label: string }[] = [
  { code: "F1", label: "F1 — Unmarried sons/daughters (21+) of U.S. citizens" },
  { code: "F2A", label: "F2A — Spouses and unmarried children (under 21) of permanent residents" },
  { code: "F2B", label: "F2B — Unmarried sons/daughters (21+) of permanent residents" },
  { code: "F3", label: "F3 — Married sons/daughters of U.S. citizens" },
  { code: "F4", label: "F4 — Brothers/sisters of U.S. citizens" },
  { code: "EB-1", label: "EB-1 — Priority workers" },
  { code: "EB-2", label: "EB-2 — Advanced degree / exceptional ability" },
  { code: "EB-3", label: "EB-3 — Skilled workers / professionals" },
  { code: "EB-3 Other Workers", label: "EB-3 Other Workers" },
  { code: "EB-4", label: "EB-4 — Certain special immigrants" },
  { code: "EB-5 Unreserved", label: "EB-5 Unreserved" },
  { code: "EB-5 Rural", label: "EB-5 Rural set-aside" },
  { code: "EB-5 High Unemployment", label: "EB-5 High-unemployment set-aside" },
  { code: "EB-5 Infrastructure", label: "EB-5 Infrastructure set-aside" },
];

/** Chargeability areas in the bulletin. "WORLDWIDE" = "All Chargeability
 *  Areas Except Those Listed". Country of BIRTH decides which column. */
export type ChargeabilityCountry =
  | "WORLDWIDE"
  | "CHINA"
  | "INDIA"
  | "MEXICO"
  | "PHILIPPINES";

export const CHARGEABILITY_COUNTRIES: {
  code: ChargeabilityCountry;
  label: string;
}[] = [
  { code: "WORLDWIDE", label: "All other countries (born anywhere else)" },
  { code: "CHINA", label: "China — mainland born" },
  { code: "INDIA", label: "India" },
  { code: "MEXICO", label: "Mexico" },
  { code: "PHILIPPINES", label: "Philippines" },
];

/** Which chart the match was run against. */
export type BulletinChartKind = "dates_for_filing" | "final_action";

export const CHART_LABELS: Record<
  BulletinChartKind,
  { short: string; long: string }
> = {
  dates_for_filing: {
    short: "Dates for Filing",
    long: "USCIS Dates for Filing chart — for adjustment-of-status (I-485) cases. Confirm USCIS accepts this chart this month at uscis.gov/visabulletininfo.",
  },
  final_action: {
    short: "Final Action Dates",
    long: "Department of State Final Action Dates chart — for consular (NVC / immigrant-visa) cases. This chart also decides when a visa can be approved.",
  },
};

/** One cutoff as entered from the official bulletin. Exactly one of
 *  isCurrent / isUnavailable / cutoffDate applies. */
export interface BulletinCutoff {
  category: VisaCategory;
  chargeabilityCountry: ChargeabilityCountry;
  chartKind: BulletinChartKind;
  /** "C" in the bulletin. */
  isCurrent: boolean;
  /** "U" in the bulletin. */
  isUnavailable: boolean;
  /** Cutoff date, YYYY-MM-DD, when neither C nor U. */
  cutoffDate: string | null;
}

export interface BulletinMonth {
  /** "YYYY-MM", e.g. "2026-11". */
  bulletinMonth: string;
  sourceUrl: string;
  cutoffs: BulletinCutoff[];
}

export type MatchOutcome = "current" | "not_current" | "unavailable";

export interface PriorityDateMatch {
  outcome: MatchOutcome;
  /** Plain-English result, in the requested language. */
  message: string;
  /** Which chargeability country decided the result. */
  chargeabilityUsed: ChargeabilityCountry;
  /** True when the spouse's birth country gave the better result. */
  usedCrossChargeability: boolean;
  chartKind: BulletinChartKind;
  cutoff: BulletinCutoff | null;
  /** Shown under every result — never omit. */
  sourceNote: string;
}

export type MatcherLanguage = "en" | "es" | "ht";

const RESULT_TEXT: Record<
  MatchOutcome,
  Record<MatcherLanguage, string>
> = {
  current: {
    en: "Current — you may file.",
    es: "Actual — usted puede presentar la solicitud.",
    ht: "Kouran — ou ka depoze aplikasyon an.",
  },
  not_current: {
    en: "Not current — please wait. Your priority date has not come up yet.",
    es: "No actual — por favor espere. Su fecha de prioridad aún no ha llegado.",
    ht: "Li poko kouran — tanpri tann. Dat priorite ou la poko rive.",
  },
  unavailable: {
    en: "Unavailable — no visa numbers are available in this category this month.",
    es: "No disponible — no hay números de visa disponibles en esta categoría este mes.",
    ht: "Li pa disponib — pa gen okenn nimewo viza disponib nan kategori sa a mwa sa a.",
  },
};

export function sourceNoteFor(month: string): string {
  return (
    `Cutoff dates entered from the official Visa Bulletin, month ${month} ` +
    `— verify at travel.state.gov before filing.`
  );
}

/** Fiscal year for a bulletin month: Oct–Dec belong to the next year. */
export function fiscalYearForBulletin(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return m >= 10 ? y + 1 : y;
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * Official bulletin URL for a month ("YYYY-MM").
 * Verified pattern — November 2026:
 * travel.state.gov/.../visa-bulletin/2027/visa-bulletin-for-november-2026.html
 */
export function visaBulletinUrl(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const monthName = MONTH_NAMES[(m || 1) - 1] ?? "january";
  return (
    `https://travel.state.gov/content/travel/en/legal/visa-law0/` +
    `visa-bulletin/${fiscalYearForBulletin(month)}/` +
    `visa-bulletin-for-${monthName}-${y}.html`
  );
}

/** Strictly-before comparison on YYYY-MM-DD dates (string compare is
 *  safe for this format; invalid dates return false). */
export function isStrictlyBefore(a: string, b: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) {
    return false;
  }
  return a < b;
}

function matchAgainstCutoff(
  priorityDate: string,
  cutoff: BulletinCutoff
): MatchOutcome {
  if (cutoff.isUnavailable) return "unavailable";
  if (cutoff.isCurrent) return "current";
  if (!cutoff.cutoffDate) return "unavailable";
  return isStrictlyBefore(priorityDate, cutoff.cutoffDate)
    ? "current"
    : "not_current";
}

function rankOutcome(o: MatchOutcome): number {
  // For cross-chargeability, "current" beats "not_current" beats "unavailable".
  return o === "current" ? 2 : o === "not_current" ? 1 : 0;
}

export interface MatchInput {
  priorityDate: string; // YYYY-MM-DD
  category: VisaCategory;
  /** Country of BIRTH of the principal applicant. */
  birthCountry: ChargeabilityCountry;
  /** Country of BIRTH of the spouse, when different (cross-chargeability). */
  spouseBirthCountry?: ChargeabilityCountry | null;
  chartKind: BulletinChartKind;
  bulletin: BulletinMonth;
  language?: MatcherLanguage;
}

/**
 * Match a priority date against the stored cutoffs for one bulletin
 * month. Returns null when no cutoff was entered for that
 * category + country + chart (the UI must say "no cutoff entered",
 * never guess).
 */
export function matchPriorityDate(input: MatchInput): PriorityDateMatch | null {
  const language = input.language ?? "en";
  const find = (country: ChargeabilityCountry): BulletinCutoff | null =>
    input.bulletin.cutoffs.find(
      (c) =>
        c.category === input.category &&
        c.chargeabilityCountry === country &&
        c.chartKind === input.chartKind
    ) ?? null;

  const principalCutoff = find(input.birthCountry);
  if (!principalCutoff) return null;

  let best: PriorityDateMatch = {
    outcome: matchAgainstCutoff(input.priorityDate, principalCutoff),
    message: "",
    chargeabilityUsed: input.birthCountry,
    usedCrossChargeability: false,
    chartKind: input.chartKind,
    cutoff: principalCutoff,
    sourceNote: sourceNoteFor(input.bulletin.bulletinMonth),
  };

  const spouse = input.spouseBirthCountry;
  if (spouse && spouse !== input.birthCountry) {
    const spouseCutoff = find(spouse);
    if (spouseCutoff) {
      const spouseOutcome = matchAgainstCutoff(input.priorityDate, spouseCutoff);
      if (rankOutcome(spouseOutcome) > rankOutcome(best.outcome)) {
        best = {
          outcome: spouseOutcome,
          message: "",
          chargeabilityUsed: spouse,
          usedCrossChargeability: true,
          chartKind: input.chartKind,
          cutoff: spouseCutoff,
          sourceNote: sourceNoteFor(input.bulletin.bulletinMonth),
        };
      }
    }
  }

  best.message = RESULT_TEXT[best.outcome][language];
  return best;
}

// ---------------------------------------------------------------------------
// Self-tests — pure cases, no live data, no invented cutoffs. Each case
// states its own cutoff so the test does not depend on any bulletin.
// Run with: npx tsc src/lib/visaBulletin.ts --outDir /tmp/vb --module
// commonjs --target es2020 && node -e "const m=require('/tmp/vb/visaBulletin.js'); console.log(m.runVisaBulletinSelfTests())"
// ---------------------------------------------------------------------------

export interface VisaBulletinTestCase {
  name: string;
  input: MatchInput;
  expected: MatchOutcome | null;
  expectedChargeability?: ChargeabilityCountry;
  expectedCrossChargeability?: boolean;
}

function cutoff(
  category: VisaCategory,
  country: ChargeabilityCountry,
  chartKind: BulletinChartKind,
  partial: { isCurrent?: boolean; isUnavailable?: boolean; cutoffDate?: string | null }
): BulletinCutoff {
  return {
    category,
    chargeabilityCountry: country,
    chartKind,
    isCurrent: partial.isCurrent ?? false,
    isUnavailable: partial.isUnavailable ?? false,
    cutoffDate: partial.cutoffDate ?? null,
  };
}

const TEST_BULLETIN: BulletinMonth = {
  bulletinMonth: "2026-11",
  sourceUrl: visaBulletinUrl("2026-11"),
  cutoffs: [
    cutoff("F1", "WORLDWIDE", "final_action", { cutoffDate: "2021-01-22" }),
    cutoff("F2A", "WORLDWIDE", "dates_for_filing", { isCurrent: true }),
    cutoff("F2A", "MEXICO", "dates_for_filing", { isCurrent: true }),
    cutoff("EB-2", "INDIA", "final_action", { cutoffDate: "2013-11-01" }),
    cutoff("EB-2", "WORLDWIDE", "final_action", { cutoffDate: "2025-04-01" }),
    cutoff("EB-3", "PHILIPPINES", "final_action", { isUnavailable: true }),
    cutoff("EB-3", "WORLDWIDE", "final_action", { cutoffDate: "2024-06-15" }),
    cutoff("F4", "MEXICO", "final_action", { cutoffDate: "2001-04-22" }),
    cutoff("F4", "WORLDWIDE", "final_action", { cutoffDate: "2012-10-22" }),
  ],
};

export const VISA_BULLETIN_TEST_CASES: VisaBulletinTestCase[] = [
  {
    name: "C (Current): F2A Dates for Filing, worldwide — any priority date is current",
    input: { priorityDate: "2026-10-01", category: "F2A", birthCountry: "WORLDWIDE", chartKind: "dates_for_filing", bulletin: TEST_BULLETIN },
    expected: "current",
  },
  {
    name: "U (Unavailable): EB-3 Philippines Final Action — unavailable even with an old priority date",
    input: { priorityDate: "2010-01-01", category: "EB-3", birthCountry: "PHILIPPINES", chartKind: "final_action", bulletin: TEST_BULLETIN },
    expected: "unavailable",
  },
  {
    name: "Strictly before cutoff: F1 priority 2021-01-21 vs cutoff 2021-01-22 — current",
    input: { priorityDate: "2021-01-21", category: "F1", birthCountry: "WORLDWIDE", chartKind: "final_action", bulletin: TEST_BULLETIN },
    expected: "current",
  },
  {
    name: "Equal to cutoff is NOT current: F1 priority 2021-01-22 vs cutoff 2021-01-22",
    input: { priorityDate: "2021-01-22", category: "F1", birthCountry: "WORLDWIDE", chartKind: "final_action", bulletin: TEST_BULLETIN },
    expected: "not_current",
  },
  {
    name: "After cutoff: EB-2 India priority 2020-01-01 vs cutoff 2013-11-01 — not current",
    input: { priorityDate: "2020-01-01", category: "EB-2", birthCountry: "INDIA", chartKind: "final_action", bulletin: TEST_BULLETIN },
    expected: "not_current",
  },
  {
    name: "Cross-chargeability: EB-2 principal born in India (cutoff 2013-11-01, not current) with spouse born worldwide (cutoff 2025-04-01) and priority 2020-01-01 — current via spouse's country",
    input: { priorityDate: "2020-01-01", category: "EB-2", birthCountry: "INDIA", spouseBirthCountry: "WORLDWIDE", chartKind: "final_action", bulletin: TEST_BULLETIN },
    expected: "current",
    expectedChargeability: "WORLDWIDE",
    expectedCrossChargeability: true,
  },
  {
    name: "Cross-chargeability does not help when both are not current: F4 principal born in Mexico (2001-04-22) with spouse born worldwide (2012-10-22), priority 2020-01-01 — not current, principal chargeability kept",
    input: { priorityDate: "2020-01-01", category: "F4", birthCountry: "MEXICO", spouseBirthCountry: "WORLDWIDE", chartKind: "final_action", bulletin: TEST_BULLETIN },
    expected: "not_current",
    expectedChargeability: "MEXICO",
    expectedCrossChargeability: false,
  },
  {
    name: "No cutoff entered for that category/country/chart — returns null, never guesses",
    input: { priorityDate: "2020-01-01", category: "F3", birthCountry: "WORLDWIDE", chartKind: "final_action", bulletin: TEST_BULLETIN },
    expected: null,
  },
  {
    name: "Chart matters: F2A is Current on Dates for Filing but has no Final Action cutoff entered here — Final Action returns null",
    input: { priorityDate: "2026-10-01", category: "F2A", birthCountry: "WORLDWIDE", chartKind: "final_action", bulletin: TEST_BULLETIN },
    expected: null,
  },
];

export function runVisaBulletinSelfTests(): {
  passed: number;
  failed: number;
  failures: string[];
} {
  const failures: string[] = [];
  for (const t of VISA_BULLETIN_TEST_CASES) {
    const result = matchPriorityDate(t.input);
    const got = result ? result.outcome : null;
    if (got !== t.expected) {
      failures.push(`${t.name} — expected ${t.expected}, got ${got}`);
      continue;
    }
    if (result && t.expectedChargeability && result.chargeabilityUsed !== t.expectedChargeability) {
      failures.push(`${t.name} — expected chargeability ${t.expectedChargeability}, got ${result.chargeabilityUsed}`);
    }
    if (
      result &&
      t.expectedCrossChargeability !== undefined &&
      result.usedCrossChargeability !== t.expectedCrossChargeability
    ) {
      failures.push(`${t.name} — expected cross-chargeability ${t.expectedCrossChargeability}, got ${result.usedCrossChargeability}`);
    }
  }
  return {
    passed: VISA_BULLETIN_TEST_CASES.length - failures.length,
    failed: failures.length,
    failures,
  };
}
