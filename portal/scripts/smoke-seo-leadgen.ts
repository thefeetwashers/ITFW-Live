// Smoke test: SEO optimization + free-tools lead generator
// (Nov 28, 2026).
// Run with:  npx -y tsx scripts/smoke-seo-leadgen.ts
// (tsx is NOT a project dependency; it is fetched on demand for this
// test only, as in scripts/smoke-surprise-seo.ts.)
//
// FAKE DATA ONLY. No real Supabase, Stripe, or USCIS call is made.
// Every decision is tested against the pure library functions with
// fake rows. Nothing is charged, no account is created, no real key
// is used.
//
// Proves:
//   1. The sitemap lists ONLY public pages (every entry passes
//      isPublicSitemapUrl; no dashboard/portal/family/API path
//      appears) and covers the new pages: /free-tools + both tool
//      pages, all /topics/<slug>, all /lang/<code>, all
//      /cheatsheets/<role>, /for-professionals, /intake, /backbone,
//      /safety + sub-pages, /interview-prep, /reviews/new.
//   2. Every public landing page has a meta title + description
//      (metaForPublicPath returns both for every sitemap path;
//      private paths return null).
//   3. The free-tools hub lists all five tools, each with a
//      one-line description and a CTA, and each reuses existing
//      code (no rebuilt tool).
//   4. A tool use OFFERS lead capture (not forced): with a referral
//      code or provider slug the capture posts to the existing
//      /api/leads route with toolUsed + arrivalChannel; without
//      either there is no route and the reason says so honestly.
//      validateLeadCapture accepts the tool fields and rejects an
//      unknown tool id. The capture note states what happens next
//      and that details are never sold / never spam.
//   5. No page claims a ranking guarantee: the SEO note states no
//      ranking is guaranteed, and no marketing string (tool
//      one-liners, topic descriptions, language descriptions, page
//      meta descriptions) promises a ranking, traffic, or clients.
//   6. The two new public tool UIs reuse locked logic only:
//      sponsor income (locked 2026 table — household 4 contiguous
//      requires $41,250) and Visa Bulletin matching (user-entered
//      cutoff, strictly-before rule).
//   7. Referral + professional-side leads are wired on the
//      dashboard homes: the preparer home and the attorney home
//      both render ClientInviteCard + ReferralCard (checked by
//      reading the source files — no second invite system).
//   8. Share links carry no tracking parameters.
//   9. Locked Stripe prices are unchanged (132) — this addition
//      touches no price.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FREE_TOOLS,
  TOOL_LEAD_CAPTURE_NOTE,
  TOOL_USED_IDS,
  shareLinks,
  toolLeadCaptureTarget,
} from "../src/lib/freeTools";
import {
  LANGUAGE_PAGES,
  PRIVATE_PATH_PREFIXES,
  PUBLIC_PAGE_META,
  PUBLIC_SITEMAP_PATHS,
  SEO_NO_RANKING_NOTE,
  TOPIC_PAGES,
  buildHowToJsonLd,
  formLanding,
  isPublicSitemapUrl,
  languageLanding,
  metaForPublicPath,
  sitemapEntries,
  topicLanding,
} from "../src/lib/seo";
import { validateLeadCapture } from "../src/lib/leadScoring";
import { sponsorShortfallCheck } from "../src/lib/formChecklists";
import { matchPriorityDate } from "../src/lib/visaBulletin";
import { leadLoopSteps } from "../src/lib/leadLoop";
import {
  LOCKED_STRIPE_PRICE_COUNT,
  getLockedPriceByKey,
} from "../src/lib/stripePrices";

let passed = 0;
function ok(name: string, cond: boolean) {
  assert.equal(cond, true, name);
  passed++;
  console.log(`ok ${passed} - ${name}`);
}

// --- 1. Sitemap: public-only, and covers the new pages ------------------
const entries = sitemapEntries();
ok("sitemap has public entries", entries.length > 0);
ok(
  "every sitemap URL passes the public-only guard",
  entries.every((e) => isPublicSitemapUrl(new URL(e.url).pathname))
);
ok(
  "no sitemap URL is a dashboard/portal/family/API path",
  entries.every(
    (e) =>
      !PRIVATE_PATH_PREFIXES.some((p) =>
        new URL(e.url).pathname.startsWith(p)
      )
  )
);
for (const p of [
  "/portal",
  "/today",
  "/client-dashboard",
  "/preparer-dashboard",
  "/attorney-dashboard",
  "/family-case",
  "/api/leads",
  "/login",
  "/register",
  "/admin/verifications",
  "/back-office",
]) {
  ok(`private path ${p} is rejected by the sitemap guard`, !isPublicSitemapUrl(p));
}
const paths = entries.map((e) => new URL(e.url).pathname);
for (const p of [
  "/free-tools",
  "/free-tools/sponsor-income",
  "/free-tools/visa-bulletin",
  "/for-professionals",
  "/intake",
  "/backbone",
  "/safety",
  "/safety/privacy",
  "/safety/scam-guide",
  "/safety/printable-guide",
  "/interview-prep",
  "/reviews/new",
]) {
  ok(`sitemap covers ${p}`, paths.includes(p));
}
for (const t of TOPIC_PAGES) {
  ok(`sitemap covers topic /topics/${t.slug}`, paths.includes(`/topics/${t.slug}`));
}
for (const l of LANGUAGE_PAGES) {
  ok(`sitemap covers language /lang/${l.code}`, paths.includes(`/lang/${l.code}`));
}
for (const role of ["client", "preparer", "attorney", "doj", "law_student", "teacher"]) {
  ok(`sitemap covers cheatsheet /cheatsheets/${role}`, paths.includes(`/cheatsheets/${role}`));
}
ok(
  "every PUBLIC_SITEMAP_PATHS entry is itself public",
  PUBLIC_SITEMAP_PATHS.every((p) => isPublicSitemapUrl(p))
);
ok("sitemap lists the per-form landings", paths.includes("/forms/I-130") && paths.includes("/forms/N-400"));

// --- 2. Every public landing page has a meta title + description --------
for (const p of paths) {
  const meta = metaForPublicPath(p);
  ok(
    `${p} has a meta title + description`,
    meta !== null && meta.title.length > 0 && meta.description.length > 0
  );
}
for (const p of ["/portal", "/client-dashboard", "/api/leads", "/login"]) {
  ok(`private path ${p} has no public metadata`, metaForPublicPath(p) === null);
}
ok("unknown form has no metadata", metaForPublicPath("/forms/I-999") === null);
ok("unknown topic has no metadata", metaForPublicPath("/topics/nope") === null);
ok("unknown language has no metadata", metaForPublicPath("/lang/xx") === null);
ok(
  "every static PUBLIC_PAGE_META entry has a title + description",
  Object.values(PUBLIC_PAGE_META).every((m) => m.title.length > 0 && m.description.length > 0)
);
ok(
  "topic form codes all resolve in the locked catalog",
  TOPIC_PAGES.every((t) => t.formCodes.every((c) => formLanding(c) !== null))
);
ok(
  "every topic names its locked source",
  TOPIC_PAGES.every((t) => t.source.startsWith("Locked:"))
);
ok(
  "every language page has its locked spoken line",
  LANGUAGE_PAGES.every((l) => l.spokenLine.length > 0) &&
    languageLanding("es")?.spokenLine === "Se habla español"
);
ok(
  "topic lookup returns null for an unknown slug",
  topicLanding("no-such-topic") === null
);

// --- 3. Free-tools hub: all five tools, one line + CTA each -------------
ok("hub lists exactly five tools", FREE_TOOLS.length === 5);
ok(
  "hub lists the five expected tools",
  FREE_TOOLS.map((t) => t.id).join(",") ===
    "packet_health_check,fee_calculator,interview_question,sponsor_income,visa_bulletin"
);
ok(
  "every tool has a one-line description, an entry link, and a CTA",
  FREE_TOOLS.every(
    (t) => t.oneLine.length > 0 && t.href.startsWith("/") && t.cta.length > 0
  )
);
ok(
  "every tool names the existing code it reuses (no rebuilt tool)",
  FREE_TOOLS.every((t) => t.reuses.length > 0)
);
ok(
  "every tool states its honest limit",
  FREE_TOOLS.every((t) => t.limit !== null && t.limit.length > 0)
);
ok(
  "tool ids match the validated list exactly",
  JSON.stringify([...TOOL_USED_IDS].sort()) ===
    JSON.stringify(FREE_TOOLS.map((t) => t.id).sort())
);
const howTo = buildHowToJsonLd();
ok(
  "HowTo JSON-LD is built from the existing lead-loop steps (5 steps)",
  howTo["@type"] === "HowTo" &&
    Array.isArray(howTo.step) &&
    (howTo.step as unknown[]).length === leadLoopSteps().length &&
    (howTo.step as unknown[]).length === 5
);
ok(
  "HowTo JSON-LD promises no time and no outcome",
  !JSON.stringify(howTo).match(/totalTime|guarantee.*approv/i)
);

// --- 4. Tool follow-up capture: offered, never forced --------------------
const withRef = toolLeadCaptureTarget({ referralCode: "fake-code", providerSlug: null });
ok(
  "with a referral code the capture posts to the existing /api/leads route",
  withRef.postTo === "/api/leads"
);
const withProvider = toolLeadCaptureTarget({ referralCode: null, providerSlug: "fake-slug" });
ok(
  "with a provider slug the capture posts to the existing /api/leads route",
  withProvider.postTo === "/api/leads"
);
const withoutEither = toolLeadCaptureTarget({ referralCode: null, providerSlug: null });
ok(
  "with no professional identified there is no route (never a guessed preparer)",
  withoutEither.postTo === null
);
ok(
  "the no-route reason says how to reach a professional",
  withoutEither.postTo === null &&
    withoutEither.reason.includes("professional") &&
    withoutEither.reason.includes("/p/[slug]")
);
ok(
  "capture note states what happens next (one follow-up, never spam, never sold)",
  TOOL_LEAD_CAPTURE_NOTE.includes("contact you once") &&
    TOOL_LEAD_CAPTURE_NOTE.includes("never spam") &&
    TOOL_LEAD_CAPTURE_NOTE.includes("never sold")
);
const baseLead = {
  fullName: "Fake Person",
  phone: "+1-772-555-0100",
  email: "fake@example.com",
  preferredLanguage: "en",
  serviceRequested: "family_bundle",
  serviceTier: "standard",
  beneficiaryLocation: null,
  documentsReady: false,
  interviewDate: "",
  urgency: null,
  referralCode: "fake-code",
  providerSlug: null,
  toolUsed: "sponsor_income",
  arrivalChannel: "other",
};
const validated = validateLeadCapture(baseLead);
ok(
  "validateLeadCapture accepts toolUsed + arrivalChannel",
  validated.toolUsed === "sponsor_income" && validated.arrivalChannel === "other"
);
let rejectedUnknownTool = false;
try {
  validateLeadCapture({ ...baseLead, toolUsed: "made_up_tool" });
} catch {
  rejectedUnknownTool = true;
}
ok("validateLeadCapture rejects an unknown tool id", rejectedUnknownTool);
let rejectedUnknownChannel = false;
try {
  validateLeadCapture({ ...baseLead, arrivalChannel: "watched_searchers" });
} catch {
  rejectedUnknownChannel = true;
}
ok("validateLeadCapture rejects an unknown arrival channel", rejectedUnknownChannel);
ok(
  "validateLeadCapture without tool fields still works (nulls)",
  (() => {
    const { toolUsed, arrivalChannel, ...rest } = baseLead;
    void toolUsed;
    void arrivalChannel;
    const v = validateLeadCapture(rest);
    return v.toolUsed === null && v.arrivalChannel === null;
  })()
);

// --- 5. No ranking guarantee anywhere in the product copy ----------------
ok(
  "SEO note says no ranking is guaranteed",
  SEO_NO_RANKING_NOTE.includes("does not guarantee a ranking") &&
    SEO_NO_RANKING_NOTE.includes("Google") &&
    SEO_NO_RANKING_NOTE.includes("Yahoo") &&
    SEO_NO_RANKING_NOTE.includes("Bing")
);
const marketingCopy = [
  ...FREE_TOOLS.map((t) => t.oneLine + " " + t.title + " " + t.cta),
  ...TOPIC_PAGES.map((t) => t.title + " " + t.description),
  ...LANGUAGE_PAGES.map((l) => l.title + " " + l.description),
  ...Object.values(PUBLIC_PAGE_META).map((m) => m.title + " " + m.description),
].join("\n");
ok(
  "no marketing string promises a ranking, traffic, or clients",
  !/guarantee.*(rank|traffic|client|#1|first page|top of google)/i.test(marketingCopy) &&
    !/#1 on google|top of google|guaranteed (traffic|clients|ranking)/i.test(marketingCopy)
);
ok(
  "no marketing string claims a number-one spot",
  !/number-one spot|#1 ranking/i.test(marketingCopy)
);

// --- 6. New tool UIs reuse locked logic only ------------------------------
const sponsorOk = sponsorShortfallCheck({
  householdSize: 4,
  region: "contiguous",
  military: false,
  income: 41250,
  assets: 0,
  isSpouseOrMinorChildOfUSC: true,
});
ok(
  "sponsor check: household 4 contiguous requires $41,250 (locked 2026 table)",
  sponsorOk.required === 41250 && sponsorOk.qualified === true && sponsorOk.shortfall === 0
);
const sponsorShort = sponsorShortfallCheck({
  householdSize: 4,
  region: "contiguous",
  military: false,
  income: 30000,
  assets: 0,
  isSpouseOrMinorChildOfUSC: true,
});
ok(
  "sponsor check: below the line names the Joint Sponsor next step, never an approval",
  sponsorShort.qualified === false &&
    sponsorShort.shortfall === 11250 &&
    sponsorShort.nextStep.includes("Joint Sponsor")
);
const bulletinMatch = matchPriorityDate({
  priorityDate: "2021-01-21",
  category: "F1",
  birthCountry: "WORLDWIDE",
  chartKind: "final_action",
  bulletin: {
    bulletinMonth: "2026-11",
    sourceUrl: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2027/visa-bulletin-for-november-2026.html",
    cutoffs: [
      {
        category: "F1",
        chargeabilityCountry: "WORLDWIDE",
        chartKind: "final_action",
        isCurrent: false,
        isUnavailable: false,
        cutoffDate: "2021-01-22",
      },
    ],
  },
});
ok(
  "Visa Bulletin check: user-entered cutoff, strictly-before rule (2021-01-21 vs 2021-01-22 is current)",
  bulletinMatch !== null && bulletinMatch.outcome === "current"
);
ok(
  "Visa Bulletin result always carries the verify-at-travel.state.gov source note",
  (bulletinMatch?.sourceNote ?? "").includes("verify at travel.state.gov before filing")
);

// --- 7. Referral + professional-side leads on the dashboard homes --------
const preparerHome = readFileSync("src/components/preparer/PreparerDashboard.tsx", "utf8");
ok(
  "preparer home renders the invitation card (ClientInviteCard)",
  preparerHome.includes("ClientInviteCard")
);
ok(
  "preparer home renders the tell-a-friend card (ReferralCard)",
  preparerHome.includes("ReferralCard")
);
const attorneyHome = readFileSync("src/app/attorney-dashboard/page.tsx", "utf8");
ok(
  "attorney home renders the invitation card (ClientInviteCard) — added Nov 28, was missing",
  attorneyHome.includes("ClientInviteCard")
);
ok(
  "attorney home renders the tell-a-friend card (ReferralCard) — added Nov 28, was missing",
  attorneyHome.includes("ReferralCard")
);
const clientHome = readFileSync("src/app/client-dashboard/page.tsx", "utf8");
ok(
  "client dashboard renders the tell-a-friend card (ReferralCard)",
  clientHome.includes("ReferralCard")
);
ok(
  "client dashboard renders the shareable Journey Map (family invite only, no public case link)",
  clientHome.includes("JourneyMap")
);

// --- 8. Share links carry no tracking parameters --------------------------
const links = shareLinks("/free-tools", "Free immigration tools — Immigration with NIPTEI");
ok(
  "share URL is the plain public URL",
  links.url === "https://immigration.niptei.com/free-tools"
);
ok(
  "share links carry no utm_ or tracking parameters",
  !/utm_|fbclid|gclid|ref=|tracking/i.test(links.whatsapp + links.email + links.url)
);
ok(
  "WhatsApp + email share links point at the same public URL",
  links.whatsapp.includes(encodeURIComponent(links.url)) &&
    links.email.includes(encodeURIComponent(links.url))
);

// --- 9. Locked prices unchanged -------------------------------------------
ok(
  "locked Stripe price count is still 132",
  LOCKED_STRIPE_PRICE_COUNT === 132
);
ok(
  "a locked bundle price still resolves",
  getLockedPriceByKey("bundle_standard") !== undefined
);

console.log(`\nAll ${passed} checks passed.`);
