// Daily home — built-in immigration news posts (Nov 28, 2026).
//
// There is NO live news feed connected to this platform. These posts are
// built into the code, each with a real publication date, a real official
// source (URL), and a plain-English summary. Nothing here is fetched live
// and nothing is presented as breaking news. When a live feed is connected
// in a future build, this file is replaced by that feed — until then the
// home screen says so honestly (see LIVE_FEED_NOTICE).
//
// HONESTY RULES for every post:
//   * Every fact in a post is either a locked value already in this
//     codebase (lib/fees.ts, lib/nvc.ts, lib/lifecycle.ts,
//     lib/visaBulletin.ts, lib/interviewPrep.ts) or a pointer to the
//     official page where the reader can check it themselves.
//   * No fee, date, or rule is stated as current beyond its source:
//     fees change — every fee post tells the reader to confirm on the
//     official fee page before paying anything.
//   * No post claims USCIS, the Department of State, or any government
//     body adopted, endorsed, or partnered with this platform. None
//     has. Immigration with NIPTEI is a document-preparation service,
//     not a law firm and not affiliated with USCIS.

export type DailyNewsKind = "bulletin" | "fee" | "guidance";

export interface DailyNewsPost {
  id: string;
  /** Publication date of the built-in post (YYYY-MM-DD). */
  publishedDate: string;
  kind: DailyNewsKind;
  title: string;
  summary: string;
  /** Official source — always a real government page. */
  sourceLabel: string;
  sourceUrl: string;
  /** Form codes this post is relevant to ("" = relevant to everyone). */
  relevantForms: string[];
}

/** Shown on the home screen next to the news list, always. */
export const LIVE_FEED_NOTICE =
  "No live news feed is connected yet — these are built-in posts from official sources, checked on 2026-11-28. " +
  "Always confirm fees, dates, and rules on the official page linked under each post before you act on them.";

export const DAILY_NEWS: DailyNewsPost[] = [
  {
    id: "news-2026-11-visa-bulletin",
    publishedDate: "2026-11-28",
    kind: "bulletin",
    title: "November 2026 Visa Bulletin is out — check your category and priority date",
    summary:
      "The U.S. Department of State publishes a Visa Bulletin every month. It lists the cutoff dates for each family- and employment-based category. Your visa can only be issued when your priority date is earlier than the cutoff for your category. Check the Final Action Dates chart for your category, and the Dates for Filing chart if you are adjusting status inside the United States — USCIS says each month which chart you may use.",
    sourceLabel: "U.S. Department of State — Visa Bulletin for November 2026",
    sourceUrl:
      "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2027/visa-bulletin-for-november-2026.html",
    relevantForms: ["I-130", "I-485", "I-140"],
  },
  {
    id: "news-2026-11-i485-fee",
    publishedDate: "2026-11-28",
    kind: "fee",
    title: "I-485 paper filing fee in our fee list: $1,440 — confirm it before you pay",
    summary:
      "The locked fee in this platform for a paper-filed Form I-485 is $1,440. Government fees change, and other USCIS fees are not locked in our list — they are TO BE CONFIRMED. Never pay a government fee from memory or from a screenshot: check the amount on the official USCIS fee schedule and on your own invoice first. Government fees are always separate from our preparation fee.",
    sourceLabel: "USCIS — Fee Schedule",
    sourceUrl: "https://www.uscis.gov/fees",
    relevantForms: ["I-485"],
  },
  {
    id: "news-2026-11-nvc-fees",
    publishedDate: "2026-11-28",
    kind: "fee",
    title: "NVC fees are two separate payments: $120 + $325 — never one lump sum",
    summary:
      "When your case reaches the National Visa Center, you pay two separate U.S. Department of State fees in CEAC: the Affidavit of Support (AOS) fee of $120 per case, and the Immigrant Visa (IV) fee of $325 per applicant. Pay them as two separate amounts and keep both receipts. They are paid to the Department of State, not to us, and they are separate from USCIS fees and from our preparation fee.",
    sourceLabel: "U.S. Department of State — CEAC (Consular Electronic Application Center)",
    sourceUrl: "https://ceac.state.gov/",
    relevantForms: ["I-130", "DS-260"],
  },
  {
    id: "news-2026-11-immigrant-fee",
    publishedDate: "2026-11-28",
    kind: "fee",
    title: "After your visa is issued: pay the $235 USCIS Immigrant Fee BEFORE you fly",
    summary:
      "If your immigrant visa is issued abroad, pay the $235 USCIS Immigrant Fee online before your flight. USCIS will not make your Green Card until this fee is paid. Pay it before you travel — not at the airport, and not after you arrive. Your Green Card and Social Security Number are then mailed to your U.S. address, usually 30–90 days after entry.",
    sourceLabel: "USCIS — USCIS Immigrant Fee",
    sourceUrl: "https://www.uscis.gov/green-card/after-we-grant-your-green-card/uscis-immigrant-fee",
    relevantForms: ["I-130", "DS-260"],
  },
  {
    id: "news-2026-11-civics-100",
    publishedDate: "2026-11-28",
    kind: "guidance",
    title: "Taking the N-400 civics test? Study all 100 official questions — not just a sample",
    summary:
      "The civics test asks up to 10 questions from the official list of 100, and you must answer 6 correctly to pass. Our Interview Preparation has a sample of 25 of the 100 with their official answers — that sample is not the whole test. Study all 100 on the official USCIS page, and learn the answers that depend on where you live (your senators, your representative, your governor) for YOUR state, not someone else's.",
    sourceLabel: "USCIS — Study for the Test (official 100 civics questions)",
    sourceUrl:
      "https://www.uscis.gov/citizenship/find-study-materials-and-resources/study-for-the-test",
    relevantForms: ["N-400"],
  },
  {
    id: "news-2026-11-ar11",
    publishedDate: "2026-11-28",
    kind: "guidance",
    title: "Moved? Tell USCIS within 10 days (Form AR-11) — and tell us the same day",
    summary:
      "USCIS asks you to report a change of address within 10 days of moving, using Form AR-11. USCIS and NVC send time-sensitive letters — biometrics appointments, interview notices, Requests for Evidence — to the address on file. A letter sent to an old address can still count as delivered, and a missed deadline can delay or close a case. Update your address with USCIS and send us your new address the same day you move.",
    sourceLabel: "USCIS — Change of Address (Form AR-11)",
    sourceUrl: "https://www.uscis.gov/addresschange",
    relevantForms: [],
  },
  {
    id: "news-2026-11-rfe-deadline",
    publishedDate: "2026-11-28",
    kind: "guidance",
    title: "A Request for Evidence (RFE) is not a denial — but its deadline is real",
    summary:
      "USCIS sometimes asks for one more document or a clearer copy. That letter is a Request for Evidence (RFE). It is not a denial, and it does not mean your case is in trouble — but it has a deadline printed on it, and missing that deadline can lead to a denial. If you receive an RFE, send us a photo of every page the same day, and send only what your provider lists in the reply.",
    sourceLabel: "USCIS — All Forms (an RFE is issued for the form you filed; its deadline is printed on the letter itself)",
    sourceUrl: "https://www.uscis.gov/forms/all-forms",
    relevantForms: ["I-130", "I-485", "N-400"],
  },
];

/** Posts relevant to a client's forms. A post with no relevantForms
 *  applies to everyone. Pure — no I/O. */
export function newsForForms(
  posts: DailyNewsPost[],
  forms: string[]
): DailyNewsPost[] {
  if (forms.length === 0) return posts;
  return posts.filter(
    (p) =>
      p.relevantForms.length === 0 ||
      p.relevantForms.some((f) => forms.includes(f))
  );
}

/** News published on one calendar date (YYYY-MM-DD) and relevant to
 *  the client's forms — the "new news" slice of the what-changed feed. */
export function newsPublishedOn(
  posts: DailyNewsPost[],
  dateIso: string,
  forms: string[]
): DailyNewsPost[] {
  return newsForForms(posts, forms).filter(
    (p) => p.publishedDate === dateIso
  );
}

/** True only when every post carries a real official source URL and a
 *  date, and no post claims a government endorsement. */
export function allNewsPostsSourced(): boolean {
  return DAILY_NEWS.every(
    (p) =>
      p.publishedDate.length === 10 &&
      p.sourceLabel.trim().length > 0 &&
      (p.sourceUrl.startsWith("https://www.uscis.gov/") ||
        p.sourceUrl.startsWith("https://travel.state.gov/") ||
        p.sourceUrl.startsWith("https://ceac.state.gov/")) &&
      !/adopt|endors|partner/i.test(p.title + " " + p.summary)
  );
}
