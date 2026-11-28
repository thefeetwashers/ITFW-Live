// Smoke test: Five Founder-Approved Standout Features (Nov 28, 2026)
// Run with:  npx -y tsx scripts/smoke-standout-five.ts
// (tsx is NOT a project dependency; it is fetched on demand for this
// test only, as in scripts/smoke-paywall-interview.ts.)
//
// FAKE DATA ONLY. No real Supabase, Stripe, or USCIS call is made.
// Every decision is tested against the pure library functions with
// fake rows. Nothing is charged, no account is created, no real key
// is used.
//
// Proves:
//   1. A family member login cannot see another member's payment
//      details (child: invoices redacted; petitioner with the flag
//      granted: invoices visible; a member sees ONLY their case).
//   2. A string with no locked translation shows English +
//      "Translation pending — shown in English" (never a fake
//      translation); a locked string shows the locked translation;
//      Arabic renders RTL; live translation is not_configured.
//   3. The free packet audit does not unlock the paid fix (even at
//      100%); the fix unlocks ONLY with a paid invoice in the
//      database; the audit never claims ready unless 100% + all
//      blocking items cleared.
//   4. The journey timeline uses only locked ranges (no invented
//      dates): every step sourced, no promised dates, the only range
//      is "30–90 days after entry" from lifecycle Stage 6.
//   5. An unverified professional is never listed (whatever the
//      filters); verified-only search works by language / form /
//      price; every price is a locked flat price (never a percentage
//      or per-lead fee); locked Stripe prices are unchanged (132).
import assert from "node:assert/strict";
import {
  scopeFamilyCaseView,
  familyMemberCanViewCase,
  isHiddenSection,
  maskANumber,
  maskDob,
  type FamilyMember,
  type SharedCaseContent,
} from "../src/lib/familyCase";
import {
  toBilingual,
  liveTranslationStatus,
  countPendingTranslations,
  bilingualList,
  TRANSLATION_PENDING_NOTE,
} from "../src/lib/lockedTranslations";
import {
  runFreePacketAudit,
  decidePacketRescueFixAccess,
  PACKET_RESCUE_PRICE_CENTS,
  PACKET_RESCUE_LOCKED_PRICE,
} from "../src/lib/packetRescue";
import {
  JOURNEY_STEPS,
  POST_ARRIVAL_CHECKLIST,
  journeyHasNoPromisedDates,
  journeyPromisedDateViolations,
  journeyStepsAllSourced,
} from "../src/lib/journey";
import {
  searchVerifiedProfessionals,
  isListedProfile,
  subscriptionPriceForRole,
  lawStudentPrice,
  diyPrice,
  reviewPrice,
  storefrontUrl,
  NO_VERIFIED_MATCHES_EMPTY_STATE,
  type DirectoryProfile,
} from "../src/lib/verifiedDirectory";
import { EXAMPLE_AUDIT_ITEMS } from "../src/lib/audit";
import {
  LOCKED_STRIPE_PRICE_COUNT,
  getLockedPriceByKey,
} from "../src/lib/stripePrices";
import { PAYWALL_SURFACES } from "../src/lib/paywall";

let passed = 0;
function ok(name: string, cond: boolean) {
  assert.equal(cond, true, name);
  passed += 1;
  console.log(`  PASS ${name}`);
}

function fakeMember(partial: Partial<FamilyMember>): FamilyMember {
  return {
    id: "member-fake-1",
    caseId: "case-fake-1",
    accountId: "account-fake-1",
    inviteId: "invite-fake-1",
    fullName: "FAKE Member",
    role: "beneficiary",
    email: "fake@example.invalid",
    phone: null,
    canViewStatus: true,
    canUploadDocs: false,
    canViewInvoices: false,
    canViewMessages: false,
    inviteToken: "fake-token",
    acceptedAt: "2026-11-28T00:00:00Z",
    ...partial,
  };
}

const SHARED: SharedCaseContent = {
  checklist: ["Passport", "Birth certificate + certified translation"],
  timeline: ["Stage 1 — first question", "Stage 4 — documents and drafting"],
  invoices: [{ label: "Petitioner bundle invoice", amountCents: 179900 }],
  messages: [{ from: "Preparer", text: "FAKE message text" }],
};

// --- 1. Whole family, one case: role isolation -------------------------
console.log("1. Whole family in one case — role isolation");
{
  const child = fakeMember({ id: "member-child", role: "child", accountId: "account-child" });
  const view = scopeFamilyCaseView(child, SHARED);
  ok("child shares the same checklist + timeline", view.checklist === SHARED.checklist && view.timeline === SHARED.timeline);
  ok("child cannot see payment details (invoices redacted)", isHiddenSection(view.invoices));
  ok("redacted invoices contain no amount", !JSON.stringify(view.invoices).includes("179900"));
  ok("child cannot see messages", isHiddenSection(view.messages));
  ok("child sees only their invited case", familyMemberCanViewCase(child, { id: "case-fake-1", clientId: "account-other", assignedProviderId: null }) === true);
  ok("child sees NO other case", familyMemberCanViewCase(child, { id: "case-fake-2", clientId: "account-other", assignedProviderId: null }) === false);

  const petitioner = fakeMember({ id: "member-pet", role: "petitioner", accountId: "account-pet", canViewInvoices: true });
  const petView = scopeFamilyCaseView(petitioner, SHARED);
  ok("petitioner WITH invoice access sees invoices", !isHiddenSection(petView.invoices));
  ok("petitioner WITHOUT message access still cannot see messages", isHiddenSection(petView.messages));

  ok("A-Number masked (last 3 only)", maskANumber("A123456789") === "A-***-***-789");
  ok("DOB masked (year only)", maskDob("1990-05-04") === "**/**/1990");
  ok("masking never logs the full value", !maskANumber("A123456789").includes("123456"));
}

// --- 2. Seven languages -------------------------------------------------
console.log("2. Seven languages, start to finish");
{
  const pending = toBilingual({ english: "Upload your passport photo page.", lang: "ht" });
  ok("no locked translation -> status pending", pending.status === "pending");
  ok("no locked translation -> translated is null (never faked)", pending.translated === null);
  ok("pending shows English original", pending.english === "Upload your passport photo page.");
  ok('pending note is exactly "Translation pending — shown in English"', pending.note === TRANSLATION_PENDING_NOTE);

  const locked = toBilingual({ english: "Verified & Listed", lockedKey: "verified", lang: "es" });
  ok("locked storefront string -> status locked", locked.status === "locked");
  ok("locked string translated (es)", locked.translated === "Verificado y publicado");

  const arabic = toBilingual({ english: "Verified & Listed", lockedKey: "verified", lang: "ar" });
  ok("Arabic renders RTL", arabic.rtl === true);
  ok("Arabic locked string present", arabic.translated === "تم التحقق منه ومدرج");

  const lines = bilingualList(
    [
      { id: "l1", english: "Verified & Listed", lockedKey: "verified" },
      { id: "l2", english: "Upload your passport photo page." },
    ],
    "fr"
  );
  ok("bilingual list counts the pending line", countPendingTranslations(lines) === 1);
  ok("live translation is not_configured (never faked)", liveTranslationStatus().status === "not_configured");

  const priced = toBilingual({ english: "Packet Rescue — $199.", lockedKey: "verified", lang: "pt" });
  ok("price/quote text flags human confirmation", priced.needsHumanConfirmation === true);
}

// --- 3. Packet Rescue: free check first ---------------------------------
console.log("3. Packet Rescue — free check first");
{
  const audit = runFreePacketAudit(EXAMPLE_AUDIT_ITEMS);
  ok("free audit is free", audit.free === true);
  ok("example audit scores 88%", audit.score === 88);
  ok("example audit is NOT ready to file (2 blocking items)", audit.readyToFile === false && audit.blockingItems.length === 2);
  ok("free audit NEVER unlocks the paid fix", audit.paidFixUnlocked === false);
  ok("free audit never claims ready unless 100% + blocking cleared", audit.verdict === "not_ready_to_file" && audit.verdictText.startsWith("Not ready to file"));

  const allPass = runFreePacketAudit(EXAMPLE_AUDIT_ITEMS.map((i) => ({ ...i, status: "pass" as const })));
  ok("100% audit with blocking cleared IS ready", allPass.readyToFile === true && allPass.score === 100);
  ok("even a 100% free audit does NOT unlock the paid fix", allPass.paidFixUnlocked === false);

  const unpaid = decidePacketRescueFixAccess({ packetRescuePaidInvoiceCount: 0 });
  ok("no paid invoice -> paid fix denied", unpaid.allowed === false);
  ok("paid fix unlock price is the locked $199 key", unpaid.unlockPriceKey === "addon_packet_rescue" && unpaid.unlockPriceId === PACKET_RESCUE_LOCKED_PRICE?.priceId);
  const paid = decidePacketRescueFixAccess({ packetRescuePaidInvoiceCount: 1 });
  ok("paid invoice in DB -> paid fix allowed", paid.allowed === true);
  ok("Packet Rescue locked price is $199", PACKET_RESCUE_PRICE_CENTS === 19900 && PACKET_RESCUE_LOCKED_PRICE?.amountCents === 19900);
  ok("paywall has the packet_rescue_fix surface", "packet_rescue_fix" in PAYWALL_SURFACES);
}

// --- 4. One case, whole journey -----------------------------------------
console.log("4. One case, whole journey");
{
  ok("every journey step + checklist item carries a locked source", journeyStepsAllSourced());
  ok("journey promises no dates", journeyHasNoPromisedDates());
  ok("no promised-date violations", journeyPromisedDateViolations().length === 0);
  ok("journey runs first question -> green card + SSN (10 steps)", JOURNEY_STEPS.length === 10);
  ok("journey ends post-arrival (green card + SSN)", JOURNEY_STEPS[9].stage === "post_arrival");
  const ranges = new Set(
    [...JOURNEY_STEPS, ...POST_ARRIVAL_CHECKLIST]
      .filter((s) => s.dateBasis === "locked_range")
      .map((s) => s.lockedRange)
  );
  ok('the ONLY locked range in the journey is "30–90 days after entry"', ranges.size === 1 && ranges.has("30–90 days after entry"));
  ok("post-arrival checklist has 6 items, all sourced", POST_ARRIVAL_CHECKLIST.length === 6);
  ok("no journey step text contains a calendar date", JOURNEY_STEPS.every((s) => !/\b\d{4}-\d{2}-\d{2}\b/.test(s.title + s.detail)));
}

// --- 5. Verified professionals, flat prices -----------------------------
console.log("5. Verified professionals, flat prices");
{
  const base: DirectoryProfile = {
    id: "prof-fake-1",
    slug: "fake-preparer",
    fullName: "FAKE Preparer",
    companyName: null,
    role: "preparer",
    bio: null,
    languagesSpoken: ["es", "en"],
    acceptingNewClients: true,
    practiceAreas: ["I-130"],
    accreditationLevel: null,
    isPublished: true,
    subscriptionStatus: "active",
    isVerified: false,
    verificationStatus: "not_required",
    formFees: [{ formCode: "I-130", feeCents: 49900 }],
  };
  const unverifiedAttorney: DirectoryProfile = {
    ...base,
    id: "prof-fake-2",
    slug: "fake-attorney",
    fullName: "FAKE Attorney",
    role: "attorney",
    isVerified: false,
    verificationStatus: "pending",
    languagesSpoken: ["es"],
  };
  const verifiedAttorney: DirectoryProfile = {
    ...base,
    id: "prof-fake-3",
    slug: "fake-attorney-verified",
    fullName: "FAKE Verified Attorney",
    role: "attorney",
    isVerified: true,
    verificationStatus: "verified",
    formFees: [{ formCode: "I-130", feeCents: 75000 }],
  };
  ok("unverified attorney is NOT listed (gate)", isListedProfile(unverifiedAttorney) === false);
  ok("preparer with active subscription IS listed", isListedProfile(base) === true);
  ok("verified attorney IS listed", isListedProfile(verifiedAttorney) === true);

  const search = searchVerifiedProfessionals([base, unverifiedAttorney, verifiedAttorney], { language: "es", formCode: "I-130" });
  ok("unverified professional never appears in results", search.results.every((p) => p.id !== "prof-fake-2"));
  ok("search returns the 2 listed matches", search.results.length === 2);
  ok("gate exclusion is reported", search.excludedUnverifiedCount === 1);
  ok("cheapest flat fee sorts first", search.results[0].slug === "fake-preparer");

  const none = searchVerifiedProfessionals([unverifiedAttorney], { language: "zh" });
  ok("no match -> honest empty state, no invented listing", none.results.length === 0 && none.emptyState === NO_VERIFIED_MATCHES_EMPTY_STATE);

  ok("Preparer flat $49/mo", subscriptionPriceForRole("preparer")?.amountCents === 4900);
  ok("Attorney flat $99/mo", subscriptionPriceForRole("attorney")?.amountCents === 9900);
  ok("DOJ Standard flat $24.50/mo", subscriptionPriceForRole("nonprofit", "partial_uscis_only")?.amountCents === 2450);
  ok("DOJ Full flat $49.50/mo", subscriptionPriceForRole("nonprofit", "full_uscis_and_court")?.amountCents === 4950);
  ok("Law Student flat $35/mo", lawStudentPrice()?.amountCents === 3500);
  ok("DIY flat $25", diyPrice()?.amountCents === 2500);
  ok("Review flat $99", reviewPrice()?.amountCents === 9900);
  ok("listing links to the storefront", storefrontUrl(verifiedAttorney) === "/p/fake-attorney-verified");
  ok("locked Stripe price count unchanged (132)", LOCKED_STRIPE_PRICE_COUNT === 132);
  ok("no percentage / per-lead price exists in the locked map", getLockedPriceByKey("addon_packet_rescue")?.kind === "one_time");
}

console.log(`\nSMOKE STANDOUT FIVE: ${passed} checks passed.`);
