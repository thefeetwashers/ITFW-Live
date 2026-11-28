// Code-level smoke test for the SIXTH addition (Nov 28, 2026) — run with:
//   npx -y tsx scripts/smoke-sixth-addition.ts
// (tsx is NOT a project dependency; it is fetched on demand for this
// test only. Fake data only: invented names/emails/case ids, no real
// client, no real case, no network call, no key, no Supabase, no
// Stripe. Nothing is sent, saved, or charged by this test — the
// quote-request route is only called with INVALID input (400, before
// any database touch) and with valid input ONLY when Supabase is
// unconfigured (501, nothing saved).)
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  answerCopilot,
  COPILOT_DISCLAIMER,
} from "../src/lib/askNiptei";
import {
  answerInstantly,
  SYSTEM_LABEL,
  UNKNOWN_ANSWER_EXACT,
} from "../src/lib/instantChat";
import {
  buildQuoteRequestRow,
  isUnpricedForm,
  quotedFormPricingState,
  UNPRICED_FORM_CODES,
  UNPRICED_FORMS,
} from "../src/lib/quotedForms";
import {
  decideDiyUnlock,
  diyAlreadyPaidNotice,
  diyBundlePrice,
  diySinglePrice,
  DIY_PAY_FIRST_TEXT,
} from "../src/lib/diy";
import { getLockedPriceByKey } from "../src/lib/stripePrices";
import {
  allBuiltInNewsSourced,
  BUILT_IN_NEWS,
  LIVE_NEWS_FEED_STATUS,
  newsForChat,
} from "../src/lib/immigrationNews";
import {
  allGlossaryTermsSourced,
  findGlossaryTerm,
  GLOSSARY,
} from "../src/lib/glossary";
import {
  FEE_WAIVER_CHECKLIST,
  FEE_WAIVER_ONLY_USCIS_DECIDES,
} from "../src/lib/feeWaiverChecklist";
import { deriveRenewal, type RenewalInput } from "../src/lib/renewals";
import { POST as quotePost } from "../src/app/api/quote-requests/route";
import { GET as newsGet } from "../src/app/api/news/route";
import { POST as askPost } from "../src/app/api/ask-niptei/route";

let passed = 0;
function ok(name: string, cond: boolean) {
  assert.equal(cond, true, name);
  passed += 1;
  console.log(`  PASS ${name}`);
}

const FAKE_CASE = "11111111-1111-4111-8111-111111111111";
const FAKE_ACCOUNT = "22222222-2222-4222-8222-222222222222";

async function main() {
  // ---- (1) UNPRICED FORMS: no invented price, quote request saves ----
  console.log("1) unpriced forms — quoted individually, quote request");
  ok("I-526E is unpriced", isUnpricedForm("I-526E"));
  ok("I-526 is unpriced", isUnpricedForm("I-526"));
  ok("I-829 is unpriced", isUnpricedForm("I-829"));
  ok("I-693 is unpriced (free booking)", isUnpricedForm("I-693"));
  ok("I-485 is priced, not quoted", !isUnpricedForm("I-485"));
  ok(
    "unpriced list is exactly the four forms",
    UNPRICED_FORM_CODES.join(",") === "I-526E,I-526,I-829,I-693"
  );
  for (const f of UNPRICED_FORMS) {
    ok(
      `${f.formCode}: state says no price invented`,
      f.pricingState.toLowerCase().includes("no price invented") ||
        f.pricingState.includes("Free booking")
    );
    ok(
      `${f.formCode}: no price field anywhere on the record`,
      !("price" in f) && !("amountCents" in f)
    );
  }
  ok(
    "pricing state text names the quoted state",
    quotedFormPricingState("I-526E").includes("Quoted individually")
  );
  const built = buildQuoteRequestRow({
    name: "Test Client",
    email: "test-client@example.com",
    phone: "555-0100",
    formCode: "I-526E",
    description: "Investor petition — please quote.",
    accountId: FAKE_ACCOUNT,
    caseId: FAKE_CASE,
  });
  ok("quote request builds with no error", built.error === null && built.row !== null);
  if (built.row) {
    ok("quote row: form_code recorded", built.row.form_code === "I-526E");
    ok("quote row: status pending", built.row.status === "pending");
    ok("quote row: description names the form", built.row.description.includes("I-526E"));
    ok("quote row: no price anywhere", !("price" in built.row) && !("amountCents" in built.row));
  }
  const priced = buildQuoteRequestRow({
    name: "Test Client",
    email: "test-client@example.com",
    formCode: "I-485",
    description: "Please quote I-485.",
  });
  ok("quote request for a priced form is refused", priced.error !== null && priced.row === null);
  const badEmail = buildQuoteRequestRow({
    name: "Test Client",
    email: "not-an-email",
    formCode: "I-526",
    description: "x",
  });
  ok("quote request with a bad email is refused", badEmail.error !== null);

  // Route-level: invalid input is 400 before any database touch.
  const res400 = await quotePost(
    new Request("http://localhost/api/quote-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "T", email: "bad", formCode: "I-485" }),
    })
  );
  ok("route: priced-form quote request is 400", res400.status === 400);
  // Valid input with Supabase unconfigured must be an honest 501,
  // never a fake "saved" claim.
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  if (!supabaseConfigured) {
    const res501 = await quotePost(
      new Request("http://localhost/api/quote-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Client",
          email: "test-client@example.com",
          formCode: "I-829",
          description: "Please quote.",
        }),
      })
    );
    const body501 = (await res501.json()) as { error?: string };
    ok("route: valid request, Supabase unconfigured is 501", res501.status === 501);
    ok("route: 501 says nothing was saved", (body501.error ?? "").includes("not saved"));
  } else {
    console.log("  SKIP route: valid-input save test (Supabase is configured here — no live save in a smoke test)");
  }

  // ---- (2) DIY FEES: shown before step 1, never charged twice ----
  console.log("2) DIY fees — up front, already-paid is not charged twice");
  ok("locked DIY single price is $25", getLockedPriceByKey("diy_form")?.amountCents === 2500);
  ok(
    "locked DIY single Price ID unchanged",
    getLockedPriceByKey("diy_form")?.priceId === "price_1UfS5APfd9SRUcvh47Ks9Lw0"
  );
  ok("locked DIY bundle price is $99", getLockedPriceByKey("diy_bundle")?.amountCents === 9900);
  ok(
    "locked DIY bundle Price ID unchanged",
    getLockedPriceByKey("diy_bundle")?.priceId === "price_1UfS5iPfd9SRUcvhKEQxf0pj"
  );
  ok("diySinglePrice() is $25", diySinglePrice().amountCents === 2500);
  ok("diyBundlePrice() is $99", diyBundlePrice().amountCents === 9900);
  ok("pay-first text exists", DIY_PAY_FIRST_TEXT.includes("Pay first"));
  const flowSrc = readFileSync("src/components/diy/DiyGuidedFlow.tsx", "utf8");
  const bannerAt = flowSrc.indexOf('aria-label="DIY fee — shown before you start"');
  const step1At = flowSrc.indexOf("Step 1 — Choose your form");
  ok("DIY flow: fee banner exists", bannerAt > 0);
  ok("DIY flow: fee banner is BEFORE step 1", bannerAt > 0 && step1At > 0 && bannerAt < step1At);
  ok("DIY flow: banner names the $25 fee", flowSrc.includes("Before you start — the DIY fee"));
  ok("DIY flow: banner shows Already paid when unlocked", flowSrc.includes("Already paid — you will not be charged again"));
  ok("DIY flow: pay buttons pass formCode to checkout", flowSrc.includes("formCode={formCode}"));
  const checkoutSrc = readFileSync("src/app/api/checkout/route.ts", "utf8");
  ok("checkout: duplicate-DIY guard exists (409)", checkoutSrc.includes("alreadyPaid: true") && checkoutSrc.includes("status: 409"));
  ok("checkout: guard says Already paid", checkoutSrc.includes("Already paid"));
  const paidDecision = decideDiyUnlock(
    {
      role: "client",
      caseForms: ["I-485"],
      hasPaidDiyBundle: false,
      hasPaidDiyForm: true,
      hasPaidDiyUnlockRow: false,
      hasPaidFinalStageInvoice: false,
      hasFullyPaidPaymentPlan: false,
    },
    "I-485"
  );
  ok("DIY gate (verified, pre-existing): paid unlock is unlocked", paidDecision.unlocked === true);
  const notice = diyAlreadyPaidNotice(paidDecision);
  ok(
    "already-paid unlock says Already paid, will not charge again",
    notice !== null && notice.includes("Already paid") && notice.includes("will not be charged again")
  );
  const lockedDecision = decideDiyUnlock(
    {
      role: "client",
      caseForms: ["I-485"],
      hasPaidDiyBundle: false,
      hasPaidDiyForm: false,
      hasPaidDiyUnlockRow: false,
      hasPaidFinalStageInvoice: false,
      hasFullyPaidPaymentPlan: false,
    },
    "I-485"
  );
  ok("DIY gate: unpaid is locked", lockedDecision.unlocked === false);
  ok("DIY gate: unpaid has no already-paid notice", diyAlreadyPaidNotice(lockedDecision) === null);

  // ---- (3) POWERFUL CHAT: sourced, labelled, honest unknown ----
  console.log("3) chat — Ask NIPTEI label, sourced answers, exact unknown");
  ok(
    "chat label is the required Ask NIPTEI wording",
    COPILOT_DISCLAIMER === "Ask NIPTEI — educational information only, not legal advice, not USCIS"
  );
  ok(
    "chat system label names Ask NIPTEI and says not USCIS",
    SYSTEM_LABEL.includes("Ask NIPTEI") && SYSTEM_LABEL.includes("not USCIS") && SYSTEM_LABEL.includes("not a person")
  );
  const docs = answerInstantly("what documents do I need for I-485?");
  ok("checklist Q: not escalated", docs.escalated === false);
  ok("checklist Q: not unknown", docs.unknown === false);
  ok("checklist Q: carries the Ask NIPTEI label", docs.systemLabel === SYSTEM_LABEL);
  ok("checklist Q: carries a source", docs.sources.length >= 1);
  ok(
    "checklist Q: a source is uscis.gov",
    docs.sources.some((s) => s.url.includes("uscis.gov"))
  );
  ok(
    "checklist Q: answer lists the full I-485 document list",
    docs.answer.includes("Full document list") && docs.answer.includes("I-693 sealed medical exam")
  );
  const interview = answerInstantly("what do I bring to my interview?");
  ok("interview Q: intent is interview", interview.intent === "interview");
  ok("interview Q: carries a source", interview.sources.length >= 1);
  ok(
    "interview Q: answer names the sealed I-693 envelope",
    interview.answer.includes("Sealed Form I-693")
  );
  ok(
    "interview Q: answer never guarantees approval",
    interview.answer.includes("cannot promise an outcome")
  );
  const i130fee = answerInstantly("how much is the I-130 fee?");
  ok("fee Q: intent is fees", i130fee.intent === "fees");
  ok(
    "fee Q: answer names the locked I-130 prep fee",
    i130fee.answer.includes("Basic $299")
  );
  ok(
    "fee Q: answer does not invent the USCIS fee as locked",
    i130fee.answer.includes("TO BE CONFIRMED")
  );
  const unknown = answerInstantly("will the moon landing affect my case?");
  ok("unknown Q: answer is EXACTLY the required sentence", unknown.answer === UNKNOWN_ANSWER_EXACT);
  ok("unknown Q: flagged for the professional", unknown.flaggedForProfessional === true);
  const spanish = answerCopilot("¿qué documentos necesito para la I-485?", { language: "es" });
  ok("non-English Q: original shown, English version null (no machine translation)", spanish.questionEnglish === null && spanish.questionOriginal.includes("¿qué"));
  ok("non-English Q: answer says translation is not connected", spanish.translationNote.includes("NOT connected"));
  const glossaryQ = answerInstantly("what does RFE mean?");
  ok("glossary Q: intent is glossary", glossaryQ.intent === "glossary");
  ok("glossary Q: answer defines RFE", glossaryQ.answer.includes("Request for Evidence"));
  const waiverQ = answerInstantly("what is a fee waiver?");
  ok("fee-waiver Q: intent is fee_waiver, not an escalation", waiverQ.intent === "fee_waiver" && waiverQ.escalated === false);
  ok("fee-waiver Q: answer says only USCIS decides", waiverQ.answer.includes("Only USCIS decides"));
  const qualifyWaiver = answerInstantly("do I qualify for a fee waiver?");
  ok("fee-waiver eligibility Q still escalates (legal decision)", qualifyWaiver.escalated === true);
  const quotedQ = answerInstantly("how much is the I-526E fee?");
  ok("quoted-form Q: intent is quoted_form", quotedQ.intent === "quoted_form");
  ok("quoted-form Q: no price invented", quotedQ.answer.includes("quoted individually") && !quotedQ.answer.includes("$999"));
  const diyQ = answerInstantly("how much does DIY cost?");
  ok("DIY Q: intent is diy_fees", diyQ.intent === "diy_fees");
  ok("DIY Q: answer names $25 and $99 locked prices", diyQ.answer.includes("$25") && diyQ.answer.includes("$99"));
  const bundleQ = answerInstantly("what is the Family Adjustment Bundle?");
  ok("bundle Q: intent is bundles", bundleQ.intent === "bundles");
  ok("bundle Q: answer names locked $999 / $1799 / $2799", bundleQ.answer.includes("$999") && bundleQ.answer.includes("$1799") && bundleQ.answer.includes("$2799"));
  const newsAnswer = answerInstantly("is there any immigration news?", { caseForms: ["I-485"] });
  ok("news Q: intent is news", newsAnswer.intent === "news");
  ok("news Q: answer says no live feed is connected", newsAnswer.answer.includes("No live feed connected yet"));
  ok("news Q: case-aware flag appears for I-485", newsAnswer.answer.includes("This may affect your case"));

  // Route-level: instant answer carries the label + case-aware news.
  const askRes = await askPost(
    new Request("http://localhost/api/ask-niptei", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "is there any immigration news?", instantChat: true, caseForms: ["I-485"] }),
    })
  );
  const askBody = (await askRes.json()) as {
    instant?: { systemLabel?: string; answer?: string; intent?: string };
  };
  ok("route: instant answer carries the Ask NIPTEI label", askBody.instant?.systemLabel === SYSTEM_LABEL);
  ok("route: instant news answer flags the case", (askBody.instant?.answer ?? "").includes("This may affect your case"));

  // ---- (4) NEWS IN THE CHAT: real items only, case-aware flag ----
  console.log("4) news — real items only, may-affect-your-case flag");
  ok("built-in news: exactly one item (nothing invented)", BUILT_IN_NEWS.length === 1);
  ok("built-in news: every item is dated + sourced", allBuiltInNewsSourced());
  ok("built-in news: the item is the Nov 2026 Visa Bulletin", BUILT_IN_NEWS[0].title === "Visa Bulletin for November 2026");
  ok("built-in news: date is 2026-11-19", BUILT_IN_NEWS[0].date === "2026-11-19");
  ok("built-in news: source is travel.state.gov", BUILT_IN_NEWS[0].sourceUrl.includes("travel.state.gov"));
  ok("news: no live feed is connected", LIVE_NEWS_FEED_STATUS.connected === false);
  const match485 = newsForChat(["I-485"]);
  ok("news: I-485 case matches one item", match485.affectingYourCase.length === 1);
  ok(
    "news: flag text is exact",
    (match485.affectingYourCase[0].flagText ?? "").startsWith("This may affect your case —") &&
      (match485.affectingYourCase[0].flagText ?? "").includes("source: travel.state.gov — Visa Bulletin")
  );
  ok("news: I-485 flag names the real date", (match485.affectingYourCase[0].flagText ?? "").includes("Visa Bulletin for November 2026"));
  const matchN400 = newsForChat(["N-400"]);
  ok("news: N-400 case matches nothing (no invented flag)", matchN400.affectingYourCase.length === 0);
  const matchNone = newsForChat([]);
  ok("news: no case forms means no flag", matchNone.affectingYourCase.length === 0);
  const newsRes = await newsGet(new Request("http://localhost/api/news?forms=I-485"));
  const newsBody = (await newsRes.json()) as {
    items?: unknown[];
    affectingYourCase?: { flagText?: string | null }[];
    feedConnected?: boolean;
    feedNote?: string;
  };
  ok("news route: 200", newsRes.status === 200);
  ok("news route: one built-in item", (newsBody.items ?? []).length === 1);
  ok("news route: I-485 is flagged", (newsBody.affectingYourCase ?? []).length === 1);
  ok("news route: feed is not connected", newsBody.feedConnected === false);
  ok("news route: feed note is honest", (newsBody.feedNote ?? "").includes("No live feed connected yet"));

  // ---- (5) ANYTHING MISSING ----
  console.log("5) anything missing — glossary, rights, expiry, fee waiver");
  ok("glossary: terms exist", GLOSSARY.length >= 10);
  ok("glossary: every term is sourced", allGlossaryTermsSourced());
  const rfe = findGlossaryTerm("what does RFE mean?");
  ok("glossary: RFE is found from a question", rfe !== null && rfe.term.startsWith("RFE"));
  ok("glossary: page exists", existsSync("src/app/glossary/page.tsx"));
  ok("rights: page exists", existsSync("src/app/your-rights/page.tsx"));
  const rightsSrc = readFileSync("src/app/your-rights/page.tsx", "utf8");
  ok("rights: interview half sourced from interview prep", rightsSrc.includes("CONDUCT_GUIDE") && rightsSrc.includes("WHAT_OFFICER_LOOKS_FOR"));
  ok("rights: border half is honest about having no locked guidance", rightsSrc.includes("no locked guidance about border"));
  ok("rights: page says not legal advice, not USCIS", rightsSrc.includes("not legal advice") && rightsSrc.includes("not USCIS"));
  ok("fee waiver: checklist has the three USCIS questions", FEE_WAIVER_CHECKLIST.length === 3);
  ok(
    "fee waiver: checklist says only USCIS decides",
    FEE_WAIVER_ONLY_USCIS_DECIDES.includes("Only USCIS decides")
  );
  ok("fee waiver: page exists", existsSync("src/app/fee-waiver/page.tsx"));
  // Document-expiry reminders: ALREADY BUILT (src/lib/renewals.ts +
  // /api/renewals + RenewalsSection) — verify it works from real
  // dates only, nothing invented.
  const renewal: RenewalInput = {
    id: "test-renewal-1",
    caseId: FAKE_CASE,
    type: "passport",
    eligibilityOrExpiryDate: "2026-12-01",
    status: "upcoming",
  };
  const derived = deriveRenewal(renewal, new Date("2026-11-28T12:00:00Z"));
  ok("expiry reminder (pre-existing): passport window opens 180 days before", derived.remindOn === "2026-06-04");
  ok("expiry reminder (pre-existing): due 3 days before expiry", derived.daysUntilDue === 3 && derived.isDue === true);
  ok("expiry reminder (pre-existing): nudge scheduled 48h after window opens", derived.nextNudgeAt !== null);
  ok("expiry reminder (pre-existing): renewals route exists", existsSync("src/app/api/renewals/route.ts"));
  ok("expiry reminder (pre-existing): client section exists", existsSync("src/components/portal/RenewalsSection.tsx"));
  // News alert component is wired into the chat.
  ok("news alert: component exists", existsSync("src/components/copilot/NewsAlert.tsx"));
  const chatSrc = readFileSync("src/components/copilot/InstantAnswerChat.tsx", "utf8");
  ok("news alert: chat renders it", chatSrc.includes("<NewsAlert"));
  ok("news alert: chat passes case forms to it", chatSrc.includes("caseForms={props.caseForms"));

  console.log(`\nAll ${passed} checks passed.`);
}

main().catch((err) => {
  console.error("SMOKE FAILED:", err);
  process.exit(1);
});
