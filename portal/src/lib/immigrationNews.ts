// Immigration news inside the chat — real official items only.
// ---------------------------------------------------------------------------
// There is NO live news feed connected in this build, and this module
// NEVER invents a news item or a change. The items below are the ONLY
// built-in news posts in this codebase: dated official items already
// recorded in the platform's own locked data — the November 2026 Visa
// Bulletin reference in src/lib/visaBulletin.ts (the one dated,
// sourced official update the codebase holds). No other built-in news
// post exists anywhere in the portal: a grep for news content across
// src/, docs/ and the migrations finds nothing else, so nothing else
// is listed. When a live feed is connected later, it replaces this
// list — until then the chat shows these items with their dates and
// sources plus the honest note "No live feed connected yet".
//
// Case-aware news: matchNewsForCase() compares a news item's forms /
// topics against the client's own case forms. A match is flagged
// "This may affect your case — [plain-English summary] — source:
// [official source]". A match is a flag to read, not a decision:
// it never says the client's case WILL change, and it never decides
// relief, eligibility, or whether it is safe to travel.
//
// Pure module (no Supabase, no fetch, no secrets) so the chat engine,
// the API route and the smoke test can all use it.

export interface NewsItem {
  id: string;
  title: string;
  /** Publication / bulletin date, YYYY-MM-DD, as recorded in the codebase. */
  date: string;
  /** Plain-English summary — what changed, in one or two sentences. */
  summary: string;
  sourceLabel: string;
  sourceUrl: string;
  /** Form codes this item can relate to (case-aware matching). */
  forms: string[];
  /** Topics this item relates to (case-aware matching). */
  topics: string[];
}

/**
 * The built-in news posts — the only dated official items already in
 * this codebase. ONE item: the Visa Bulletin for November 2026, noted
 * in src/lib/visaBulletin.ts ("November 2026 bulletin (Nov 19,
 * 2026)") with its travel.state.gov URL. Nothing here is invented:
 * no cutoff dates are listed (they live in the bulletin itself),
 * and no other item is claimed.
 */
export const BUILT_IN_NEWS: NewsItem[] = [
  {
    id: "visa-bulletin-nov-2026",
    title: "Visa Bulletin for November 2026",
    date: "2026-11-19",
    summary:
      "The U.S. Department of State published the Visa Bulletin for November 2026. " +
      "It lists the cutoff dates for family-based and employment-based immigrant visas. " +
      "A visa can only be issued when your priority date is current in the bulletin — " +
      "check your own priority date against the bulletin itself.",
    sourceLabel: "travel.state.gov — Visa Bulletin",
    sourceUrl:
      "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2027/visa-bulletin-for-november-2026.html",
    forms: ["I-485", "DS-260"],
    topics: ["visa-bulletin", "priority-date"],
  },
];

/** Honest live-feed status — no feed is connected in this build. */
export const LIVE_NEWS_FEED_STATUS = {
  connected: false,
  note: "No live feed connected yet — the items below are the built-in posts already in this codebase, with their dates and sources. Nothing here is live news, and no item has been invented.",
} as const;

export interface CaseNewsFlag {
  item: NewsItem;
  /** True when the item's forms/topics match the client's case. */
  affectsYourCase: boolean;
  /** The exact flag shown to the client for a match. */
  flagText: string | null;
  /** Why it matched (form codes / topics), for the professional. */
  matchedOn: string[];
}

export function flagTextFor(item: NewsItem): string {
  return (
    `This may affect your case — ${item.summary} ` +
    `— source: ${item.sourceLabel} (${item.sourceUrl})`
  );
}

/**
 * Match built-in news against the client's case forms. A match needs
 * an overlap on forms OR topics. Case forms are matched case-insensitively
 * ("i-485" matches "I-485"). No match = affectsYourCase false and no
 * flag — the item is still listed, unflagged, with its date and source.
 */
export function matchNewsForCase(
  items: NewsItem[],
  caseForms: string[],
  caseTopics: string[] = []
): CaseNewsFlag[] {
  const forms = new Set(caseForms.map((f) => f.trim().toUpperCase()));
  const topics = new Set(caseTopics.map((t) => t.trim().toLowerCase()));
  return items.map((item) => {
    const matchedForms = item.forms.filter((f) => forms.has(f.toUpperCase()));
    const matchedTopics = item.topics.filter((t) =>
      topics.has(t.toLowerCase())
    );
    const matchedOn = [
      ...matchedForms.map((f) => `form ${f}`),
      ...matchedTopics.map((t) => `topic ${t}`),
    ];
    const affectsYourCase = matchedOn.length > 0;
    return {
      item,
      affectsYourCase,
      flagText: affectsYourCase ? flagTextFor(item) : null,
      matchedOn,
    };
  });
}

/** The news payload the chat shows: built-in items, case flags, feed status. */
export function newsForChat(caseForms: string[], caseTopics: string[] = []): {
  items: NewsItem[];
  flags: CaseNewsFlag[];
  affectingYourCase: CaseNewsFlag[];
  feedConnected: boolean;
  feedNote: string;
} {
  const flags = matchNewsForCase(BUILT_IN_NEWS, caseForms, caseTopics);
  return {
    items: BUILT_IN_NEWS,
    flags,
    affectingYourCase: flags.filter((f) => f.affectsYourCase),
    feedConnected: LIVE_NEWS_FEED_STATUS.connected,
    feedNote: LIVE_NEWS_FEED_STATUS.note,
  };
}

/** True when every built-in item carries a real date, source label and source URL. */
export function allBuiltInNewsSourced(): boolean {
  return BUILT_IN_NEWS.every(
    (n) =>
      /^\d{4}-\d{2}-\d{2}$/.test(n.date) &&
      n.sourceLabel.length > 0 &&
      n.sourceUrl.startsWith("https://")
  );
}
