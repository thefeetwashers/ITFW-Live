// Smoke test for the immigration backbone — USCIS / NVC / Embassy
// (NINTH ADDITION, Nov 28, 2026: src/lib/backbone.ts,
// src/app/backbone/page.tsx, migration 0027, docs/backbone-2026-11-28.md).
//
// Code-level only, FAKE data only — no network, no DB, no send. Run with:
//   npx -y tsx scripts/smoke-backbone.ts
//
// Asserts:
//   1. USCIS: receipt validation (prefix + mask) reuses lib/nvc.ts;
//      filing guide carries G-1450 / G-1650 + one payment per form.
//   2. RFE / NOID: the decoder from lib/caseTracking.ts is REUSED
//      (not rebuilt); the NEW countdown computes the deadline only
//      from the notice date + the window printed on the notice.
//   3. NVC: 13-character validation + $120 AOS / $325 IV shown
//      separately (never a combined total); consular checklist
//      carries no embassy email (null by design).
//   4. Embassy: post lookup resolves BGT = Bogotá and rejects BOG;
//      12 posts, every one with an official instructions link, 3
//      verified emails and 9 explicitly unverified; the embassy
//      table matches the NVC post table.
//   5. Travel prep: $235 immigrant fee shown, 30–90 day window shown.
//   6. No page claims a live government connection or an endorsement:
//      the three new files are scanned for affirmative claim phrases.
//   7. Migration 0027 adds the tracking columns and never stores a
//      CEAC password.
//
// This script is excluded from tsc (see tsconfig.json "exclude").
import assert from "node:assert";
import { readFileSync } from "node:fs";

import {
  BACKBONE_COVERAGE,
  EMBASSY_POSTS,
  NVC_CIVIL_DOCUMENTS,
  TRAVEL_PREP,
  USCIS_FILING_GUIDE,
  USCIS_IMMIGRANT_FEE_USD,
  backboneCoverageSummary,
  embassyPostForNvcCase,
  embassyPostsMatchNvcPosts,
  lookupEmbassyPost,
  rfeNoidDeadlineCountdown,
} from "../src/lib/backbone";
import {
  buildConsularChecklist,
  decodeRfeNotice,
  validateReceiptNumber,
} from "../src/lib/caseTracking";
import {
  CEAC_FEE_AMOUNTS,
  EXAMPLE_NVC_CASE,
  NVC_POSTS,
  POST_ARRIVAL_WINDOW_DAYS,
  parseNvcCaseNumber,
} from "../src/lib/nvc";

async function main() {
  let passed = 0;
  function check(name: string, cond: boolean) {
    assert.ok(cond, name);
    passed += 1;
    console.log(`PASS ${name}`);
  }

  // 1. USCIS receipt validation + filing guide.
  const goodReceipt = validateReceiptNumber("IOE0928374651");
  check("valid IOE receipt is accepted", goodReceipt.valid === true);
  check("receipt is masked (prefix + last 4)", goodReceipt.masked === "IOE••••••4651");
  check("invalid receipt prefix XXX is rejected", validateReceiptNumber("XXX0928374651").valid === false);
  check("short receipt number is rejected", validateReceiptNumber("IOE123").valid === false);
  const guideText = USCIS_FILING_GUIDE.map((s) => `${s.title} ${s.detail}`).join(" ");
  check("filing guide names G-1450", guideText.includes("G-1450"));
  check("filing guide names G-1650", guideText.includes("G-1650"));
  check(
    "filing guide says one separate fee payment per form",
    guideText.toLowerCase().includes("one separate fee payment per form")
  );
  check(
    "filing guide says no personal checks or money orders",
    guideText.includes("Do NOT send a personal check or a money order")
  );
  check("filing guide says confirm fees at uscis.gov/fees", guideText.includes("uscis.gov/fees"));

  // 2. RFE / NOID decoder (reused) + NEW deadline countdown.
  const rfe = decodeRfeNotice("We need more bona fide marriage evidence and your birth certificate.");
  check("RFE text is recognised by the reused decoder", rfe.recognised === true);
  check("RFE decoder matches the marriage rule", rfe.matched.some((m) => m.meaning.includes("marriage is real")));
  check("RFE decoder matches the birth certificate rule", rfe.matched.some((m) => m.meaning.includes("birth certificate")));
  const noid = decodeRfeNotice("This is a notice of intent to deny your case.");
  check("NOID text is recognised", noid.recognised === true);
  check("NOID needs attorney review", noid.needsAttorneyReview === true);
  const countdown = rfeNoidDeadlineCountdown({
    noticeDateIso: "2026-11-01",
    responseWindowDays: 84,
    todayIso: "2026-11-28",
  });
  check("deadline is notice date + window (2027-01-24)", countdown.deadlineIso === "2027-01-24");
  check("days left counts from the fixed today (57)", countdown.daysLeft === 57);
  check("deadline urgency is upcoming", countdown.urgency === "upcoming");
  const unknown = rfeNoidDeadlineCountdown({ noticeDateIso: "2026-11-01", responseWindowDays: null });
  check("missing window means no guessed deadline", unknown.deadlineIso === null);
  check(
    "missing window explains the deadline is on the notice",
    (unknown.deadlineUnknownReason ?? "").includes("printed on the notice")
  );

  // 3. NVC: 13-character validation + fees shown separately.
  // Regression (fixed by this task): the old example numbers
  // PHP2026514009 (Julian day 514) and CRS2026600002 (Julian day 600)
  // FAILED this validator — the Julian day must be 001–366. The
  // canonical examples are now PHP2026144009 / CRS2026144002.
  check("old example PHP2026514009 is rejected (Julian day 514)", parseNvcCaseNumber("PHP2026514009").valid === false);
  check("valid NVC case number is accepted", parseNvcCaseNumber("PHP2026144009").valid === true);
  check("canonical example case number is valid", EXAMPLE_NVC_CASE.caseNumber === "PHP2026144009" && parseNvcCaseNumber(EXAMPLE_NVC_CASE.caseNumber).valid === true);
  check("short NVC case number is rejected", parseNvcCaseNumber("PHP2026").valid === false);
  check("NVC AOS fee is $120", CEAC_FEE_AMOUNTS.aos === 120);
  check("NVC IV fee is $325", CEAC_FEE_AMOUNTS.iv === 325);
  const consular = buildConsularChecklist("PHP2026144009");
  check("consular checklist accepts the valid case number", consular.nvcCaseValid === true);
  check("consular checklist resolves Port-au-Prince", consular.post?.city === "Port-au-Prince");
  check("consular checklist fees are separate ($120 / $325)", consular.fees.aosUsd === 120 && consular.fees.ivUsdPerApplicant === 325);
  check("consular checklist stores no embassy email (null)", consular.embassyEmail === null);
  check("NVC civil documents list is present", NVC_CIVIL_DOCUMENTS.length >= 8);

  // 4. Embassy: post lookup, BGT vs BOG, verified emails, official links.
  const bogota = lookupEmbassyPost("BGT");
  check("BGT resolves to Bogotá", bogota?.city === "Bogotá");
  check("BOG is NOT Bogotá (lookup returns null)", lookupEmbassyPost("BOG") === null);
  const fromCase = embassyPostForNvcCase("BGT2026015001");
  check("NVC case number resolves to the Bogotá embassy entry", fromCase.valid === true && fromCase.embassy?.city === "Bogotá");
  check("embassy directory has all 12 posts", EMBASSY_POSTS.length === 12);
  const verifiedEmails = EMBASSY_POSTS.filter((p) => p.emailVerified);
  check("exactly 3 embassy emails are verified", verifiedEmails.length === 3);
  check(
    "Port-au-Prince email is the verified official one",
    lookupEmbassyPost("PHP")?.contactEmail === "Haiti.Visas@gdit-gss.com"
  );
  check(
    "Santo Domingo email is the verified official one",
    lookupEmbassyPost("SDO")?.contactEmail === "DominicanRepublic.Visas@gdit-gss.com"
  );
  check(
    "Manila email is the verified official one",
    lookupEmbassyPost("MNL")?.contactEmail === "supportphilippines@usvisascheduling.com"
  );
  check(
    "9 posts carry no email (official page link instead)",
    EMBASSY_POSTS.filter((p) => !p.emailVerified && p.contactEmail === null).length === 9
  );
  check(
    "every post links to an official instructions page",
    EMBASSY_POSTS.every((p) => p.instructionsUrl.startsWith("https://") && p.instructionsUrl.toLowerCase().includes("state.gov"))
  );
  const match = embassyPostsMatchNvcPosts();
  check("embassy table matches the NVC post table", match.ok === true);
  check(
    "every embassy code exists in the NVC post table",
    EMBASSY_POSTS.every((p) => NVC_POSTS.some((n) => n.code === p.nvcCode))
  );
  check(
    "Bogotá entry flags the $275 K-visa fee vs the $265 TO BE CONFIRMED figure",
    (lookupEmbassyPost("BGT")?.specialNote ?? "").includes("$275")
  );

  // 5. Travel prep: $235 immigrant fee + 30–90 day window.
  check("USCIS Immigrant Fee is $235", USCIS_IMMIGRANT_FEE_USD === 235);
  check(
    "post-arrival window is 30–90 days",
    POST_ARRIVAL_WINDOW_DAYS.min === 30 && POST_ARRIVAL_WINDOW_DAYS.max === 90
  );
  const travelText = TRAVEL_PREP.map((t) => `${t.item} ${t.detail}`).join(" ");
  check("travel prep shows the $235 fee before flying", travelText.includes("$235") && travelText.includes("BEFORE flying"));
  check("travel prep shows the 30–90 day range", travelText.includes("30–90 days"));
  check("travel prep says sealed packet in carry-on", travelText.includes("carry-on"));

  // 6. Coverage table + no live-connection / endorsement claims.
  const summary = backboneCoverageSummary();
  check("coverage summary has all three sections", summary.length === 3);
  for (const s of summary) {
    check(`${s.section} coverage has at least 5 items`, s.total >= 5);
  }
  check(
    "every coverage row has a section, item, status, and source",
    BACKBONE_COVERAGE.every((r) => r.section && r.item && r.status && r.source)
  );
  check(
    "coverage has gap-filled rows (this check filled gaps)",
    BACKBONE_COVERAGE.some((r) => r.status === "gap-filled")
  );

  const backboneSrc = readFileSync(new URL("../src/lib/backbone.ts", import.meta.url), "utf8");
  const pageSrc = readFileSync(new URL("../src/app/backbone/page.tsx", import.meta.url), "utf8");
  const docSrc = readFileSync(new URL("../docs/backbone-2026-11-28.md", import.meta.url), "utf8");
  // Affirmative claim phrases only — the files' own honest negations
  // ("no live connection", "not affiliated") must NOT trip these.
  const BANNED_CLAIM_PATTERNS = [
    "live USCIS",
    "live NVC",
    "live CEAC",
    "real-time USCIS",
    "real-time NVC",
    "real-time CEAC",
    "directly connected to USCIS",
    "directly connected to NVC",
    "endorsed by USCIS",
    "endorsed by NVC",
    "endorsed by the State Department",
    "official partner",
    "USCIS partner",
    "in partnership with USCIS",
    "guarantee approval",
    "guaranteed approval",
    "will be approved",
  ];
  for (const [file, src] of [
    ["backbone.ts", backboneSrc],
    ["backbone/page.tsx", pageSrc],
    ["backbone doc", docSrc],
  ] as const) {
    for (const phrase of BANNED_CLAIM_PATTERNS) {
      check(`${file}: no claim "${phrase}"`, !src.toLowerCase().includes(phrase.toLowerCase()));
    }
  }
  check("backbone lib states the manual-tracking rule", backboneSrc.includes("no live connection"));
  check("backbone lib states not affiliated", backboneSrc.includes("not affiliated"));
  check("backbone doc states the manual step", docSrc.toLowerCase().includes("manual"));

  // 7. Migration 0027 — tracking columns, never a CEAC password.
  const migration = readFileSync(
    new URL("../../supabase/migrations/0027_itfw_backbone_tracking.sql", import.meta.url),
    "utf8"
  );
  check("migration adds rfe_uploads kind", migration.includes("rfe_uploads") && migration.includes("kind text"));
  check("migration adds nvc_trackers embassy post code", migration.includes("embassy_post_code"));
  check("migration adds immigrant_fee_paid", migration.includes("immigrant_fee_paid"));
  check("migration adds us_entry_at", migration.includes("us_entry_at"));
  check("migration never creates a CEAC password column", !/ceac_password/i.test(migration) && !/password\s+text/i.test(migration));

  console.log(`\nSMOKE-BACKBONE: ${passed} checks passed.`);
}

main().catch((err) => {
  console.error("SMOKE-BACKBONE FAILED:", err);
  process.exit(1);
});
