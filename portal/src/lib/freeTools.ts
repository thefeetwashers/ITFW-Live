// Free tools hub — the five free lead magnets (Nov 28, 2026).
//
// WHAT THIS IS: one registry of the five free tools that bring people
// in daily. Each tool already exists — this file only gathers them
// into one public hub (/free-tools) with a one-line description and a
// call-to-action each. No tool is rebuilt here.
//
//   1. Packet Health Check — free audit, src/lib/diyHealthCheck.ts
//      + /api/diy/health-check. Entry: /diy (the check runs on the
//      draft the visitor has already typed; it changes nothing,
//      unlocks nothing, stores nothing).
//   2. Fee calculator — src/lib/diyFees.ts + /api/diy/fee-breakdown,
//      shown in src/components/diy/DiyExtras.tsx. Entry: /diy. Our
//      fee and the USCIS fee are never combined into one total.
//   3. Interview question of the day — src/lib/dailyHome.ts
//      questionOfTheDay(), from the existing question banks.
//      Entry: /today. HONEST LIMIT: the question is free once signed
//      in and interview-prep access is confirmed (see dailyHome.ts /
//      /api/today) — the hub says so instead of promising a free
//      question to a signed-out visitor.
//   4. Sponsor income checker — the locked 2026 qualifier
//      (src/lib/formChecklists.ts SPONSOR_125_2026 +
//      sponsorShortfallCheck). The LOGIC existed; no public UI
//      existed, so the UI is new here
//      (src/app/free-tools/sponsor-income + SponsorIncomeChecker):
//      it runs entirely in the browser, never stores the income, and
//      never posts it anywhere.
//   5. Visa Bulletin date checker — the matcher
//      (src/lib/visaBulletin.ts matchPriorityDate). The LOGIC existed;
//      no public UI existed, so the UI is new here
//      (src/app/free-tools/visa-bulletin + VisaBulletinChecker): the
//      visitor enters the cutoff from the official bulletin
//      (travel.state.gov) because NO cutoff dates are stored on the
//      platform — none is ever invented.
//
// FOLLOW-UP NUDGES — after a tool is used, the visitor is OFFERED
// (never forced) a lead capture: name, phone, email + service
// (src/components/leads/ToolLeadCapture.tsx). What happens next is
// stated on the form (TOOL_LEAD_CAPTURE_NOTE): one follow-up email
// or call about their enquiry, never spam, details never sold.
// The capture posts to the EXISTING /api/leads route — but that
// route deliberately refuses when no professional is identified
// (no ?provider=<slug> or ?ref=<code>): a lead is never assigned
// to a guessed preparer. toolLeadCaptureTarget() is the honest
// gate for that rule: with a referral/provider it returns the
// route; without one it returns null + the reason, and the form
// shows the visitor how to reach a professional instead of
// pretending the enquiry was saved. See the report / DEPLOY.md
// for the founder decision this leaves open (a platform intake
// fallback so search traffic can convert without a link).
//
// HONEST BOUNDARIES (do not weaken):
//   * SEO / free tools make the platform findable. They do NOT
//     guarantee a ranking, traffic, or clients — see SEO_NO_RANKING_NOTE.
//   * No tracking of individual searchers, no bought lists, no fake
//     reviews or testimonials to boost SEO (LEAD_BOUNDARY_NOTE).
//   * No tool decides relief, eligibility, evidence strength, or
//     safe-to-leave, and none promises an approval (8 CFR 292.1).
//   * No DOB, A-Number, SSN, or passport number is asked for by any
//     tool here, stored, logged, or put in an email subject.
import { SITE_URL } from "./seo";

/** The five free tools. `arrivalChannel` is the value stored on the
 *  lead (migration 0028 check values): the two tools with their own
 *  channel keep it; the three newer tools record "other" for the
 *  channel and their precise tool id in `tool_used` (migration 0033). */
export interface FreeTool {
  id: string;
  title: string;
  /** One line, shown on the hub. */
  oneLine: string;
  /** Public entry point (existing page, or the new thin UI page). */
  href: string;
  /** The call-to-action label on the hub card. */
  cta: string;
  /** Existing code this tool reuses — never a rebuild. */
  reuses: string;
  /** Honest limit shown under the card, or null. */
  limit: string | null;
  /** preparer_leads.arrival_channel value for leads from this tool. */
  arrivalChannel: string;
}

export const FREE_TOOLS: FreeTool[] = [
  {
    id: "packet_health_check",
    title: "Free Packet Health Check",
    oneLine:
      "See what is missing or wrong in your packet before you file — a free checklist score, not legal advice.",
    href: "/diy",
    cta: "Check my packet free →",
    reuses: "src/lib/diyHealthCheck.ts + /api/diy/health-check (runs on your draft; changes nothing, unlocks nothing, stores nothing)",
    limit: "The free check never unlocks print, save, or email — those stay paid until the server confirms payment.",
    arrivalChannel: "packet_health_check",
  },
  {
    id: "fee_calculator",
    title: "Fee calculator — what will this cost?",
    oneLine:
      "See our preparation fee and the USCIS government fee side by side — never combined into one total.",
    href: "/diy",
    cta: "Calculate my fees →",
    reuses: "src/lib/diyFees.ts + /api/diy/fee-breakdown, shown in src/components/diy/DiyExtras.tsx (locked Stripe prices only)",
    limit: "Government fees change — confirm the current USCIS fee at uscis.gov/fees before you pay.",
    arrivalChannel: "other",
  },
  {
    id: "interview_question",
    title: "Interview question of the day",
    oneLine:
      "One interview question a day — an official USCIS civics question six days out of seven, a practice question on the seventh.",
    href: "/today",
    cta: "See today's question →",
    reuses: "src/lib/dailyHome.ts questionOfTheDay() + /api/today (existing question banks, source labelled)",
    limit: "Free once you are signed in and interview-prep access is confirmed — sign in on the Today screen to see it.",
    arrivalChannel: "interview_question",
  },
  {
    id: "sponsor_income",
    title: "Sponsor income checker (Form I-864)",
    oneLine:
      "Check a sponsor's household income against the locked 2026 Form I-864P table — 125%, or 100% for active-duty military.",
    href: "/free-tools/sponsor-income",
    cta: "Check sponsor income →",
    reuses: "src/lib/formChecklists.ts SPONSOR_125_2026 + sponsorShortfallCheck() (locked 2026 table; runs in your browser)",
    limit: "A checklist check, not legal advice. Your income is never stored or sent anywhere — the check runs entirely in your browser.",
    arrivalChannel: "other",
  },
  {
    id: "visa_bulletin",
    title: "Visa Bulletin date checker",
    oneLine:
      "Check a priority date against a cutoff from the official Visa Bulletin — current, not current, or unavailable.",
    href: "/free-tools/visa-bulletin",
    cta: "Check my priority date →",
    reuses: "src/lib/visaBulletin.ts matchPriorityDate() (strictly-before rule, cross-chargeability, chart labelled)",
    limit: "No cutoff dates are stored here — you enter the cutoff from the official bulletin at travel.state.gov, and the result always tells you to verify it there before filing.",
    arrivalChannel: "other",
  },
];

export function freeToolById(id: string): FreeTool | null {
  return FREE_TOOLS.find((t) => t.id === id) ?? null;
}

/** The tool ids /api/leads accepts as `toolUsed`. Anything else is
 *  rejected by validateLeadCapture — a made-up tool id never lands
 *  on a lead. */
export const TOOL_USED_IDS: readonly string[] = FREE_TOOLS.map((t) => t.id);

/** What happens next, shown on every follow-up capture form.
 *  Never softened into a spam promise. */
export const TOOL_LEAD_CAPTURE_NOTE =
  "If you leave your details, we will contact you once by email or phone about this enquiry — to answer your question and, if you want it, send you a written quote. That is all: no daily emails, never spam, and your details are never sold or shared. You can ask us to delete them at any time.";

/**
 * Where a tool follow-up capture goes. /api/leads deliberately
 * refuses when no professional is identified (no provider slug and
 * no referral code) — a lead is never assigned to a guessed
 * preparer. With either one, the capture posts to /api/leads with
 * the tool id and arrival channel; without one, there is no route
 * and the caller must show the visitor how to reach a
 * professional instead of pretending the enquiry was saved.
 */
export function toolLeadCaptureTarget(args: {
  referralCode: string | null;
  providerSlug: string | null;
}):
  | { postTo: "/api/leads"; referralCode: string | null; providerSlug: string | null }
  | { postTo: null; reason: string } {
  if (args.referralCode || args.providerSlug) {
    return {
      postTo: "/api/leads",
      referralCode: args.referralCode,
      providerSlug: args.providerSlug,
    };
  }
  return {
    postTo: null,
    reason:
      "No professional was identified — open this tool from a professional's page (/p/[slug]) or a referral link (/r/[code]), or pick a verified professional first. A lead is never assigned to a guessed preparer, so this enquiry cannot be saved yet.",
  };
}

// ---------------------------------------------------------------------------
// Share — no tracking, no shortener, no analytics parameters.
// ---------------------------------------------------------------------------

export interface ShareLinks {
  /** The plain public URL being shared. */
  url: string;
  /** Copy-to-clipboard target (same URL). */
  copyText: string;
  whatsapp: string;
  email: string;
}

/** Share links for a public page. The URLs carry no tracking
 *  parameters (no utm_, no referrer id): sharing is a plain link
 *  to a public page, and nothing about the sharer is recorded. */
export function shareLinks(path: string, title: string): ShareLinks {
  const url = `${SITE_URL}${path}`;
  const text = `${title} — ${url}`;
  return {
    url,
    copyText: url,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`,
  };
}
