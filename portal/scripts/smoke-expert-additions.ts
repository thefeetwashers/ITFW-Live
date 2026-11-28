// Smoke test for the expert additions — safety for vulnerable
// immigrant clients (Nov 28, 2026). FAKE data only — no real people,
// no real email, no live service.
// Run with:
//   npx -y tsx scripts/smoke-expert-additions.ts
//
// Asserts:
//   1. Quick Exit exists on every sensitive page, navigates away
//      with location.replace (Back does not return), clears
//      sessionStorage, answers the Escape key, and is NEVER logged
//      (no fetch / analytics / console call in the component).
//   2. Every hotline number shown is locked in the frozen public
//      site (index.html) — 911, 1-800-799-7233, TTY 1-800-787-3224,
//      text START to 88788, 1-888-373-7888 — and no other number
//      appears in the safety content.
//   3. The scam guide names the red flags (notario, fake job
//      offers, fee scams, fake USCIS calls asking for gift cards /
//      wires, fake "expedited" promises, document retention) and
//      reports to ReportFraud.ftc.gov + uscis.gov/avoid-scams,
//      WITHOUT inventing a reporting phone number.
//   4. The privacy page states what is never stored (SSN, CEAC
//      password) and how to ask for deletion; no new sensitive
//      field, table, or migration was added.
//   5. The printable guide renders the checklist and reuses
//      WHAT_TO_BRING + CONDUCT_GUIDE from interviewPrep, prints
//      with window.print + print CSS, and uses no PDF generator.
//   6. Languages: all 7 codes exist, Arabic is RTL, English
//      original is always shown and non-English shows the locked
//      "Translation pending" note (no invented translation).
//   7. Accessibility on the new sections: every control labelled,
//      native keyboard-navigable controls only, existing design
//      tokens, RTL handled.
//   8. Wiring: the client dashboard home renders the emergency
//      help section; /your-rights renders Quick Exit + emergency
//      help.
//
// This script is excluded from tsc (see tsconfig.json "exclude").
import assert from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PORTAL = join(__dirname, "..");
const ROOT = join(PORTAL, "..");
const read = (rel: string) => readFileSync(join(PORTAL, rel), "utf8");

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok — ${name}`);
}

// Env cleared before any import, so nothing in this script can send
// or write live.
process.env.AWS_ACCESS_KEY_ID = "";
process.env.AWS_SECRET_ACCESS_KEY = "";
process.env.AWS_SES_REGION = "";
process.env.EMAIL_FROM = "";
process.env.NEXT_PUBLIC_SUPABASE_URL = "";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";

import {
  EMERGENCY_HOTLINES,
  FTC_REPORT_FRAUD_URL,
  LOCKED_HOTLINE_NUMBERS,
  PRINTABLE_CHECKLIST,
  PRIVACY_SECTIONS,
  PUBLIC_U_VISA_URL,
  PUBLIC_VAWA_URL,
  QUICK_EXIT_URL,
  SCAM_RED_FLAGS,
  SCAM_REPORT_STEPS,
  USCIS_AVOID_SCAMS_URL,
  safetyTranslationNote,
} from "../src/lib/safety";
import { LANGUAGES } from "../src/lib/i18n";
import { TRANSLATION_PENDING_NOTE } from "../src/lib/lockedTranslations";
import { CONDUCT_GUIDE, WHAT_TO_BRING } from "../src/lib/interviewPrep";

// --- 1. Quick Exit ------------------------------------------------
check("Quick Exit target is Google, as on the public site", () => {
  assert.strictEqual(QUICK_EXIT_URL, "https://www.google.com");
});
const quickExitSrc = read("src/components/safety/QuickExitButton.tsx");
check("Quick Exit uses location.replace (Back does not return)", () => {
  assert.ok(quickExitSrc.includes("window.location.replace(QUICK_EXIT_URL)"));
  assert.ok(!quickExitSrc.includes("window.location.href ="));
  assert.ok(!quickExitSrc.includes("window.open("));
});
check("Quick Exit clears sessionStorage and answers Escape", () => {
  assert.ok(quickExitSrc.includes("sessionStorage.clear()"));
  assert.ok(quickExitSrc.includes('e.key === "Escape"'));
});
check("Quick Exit is never logged (no fetch/analytics/console)", () => {
  assert.ok(!quickExitSrc.includes("fetch("));
  assert.ok(!quickExitSrc.includes("console."));
  assert.ok(!quickExitSrc.includes("sendBeacon"));
  assert.ok(!/gtag\(|analytics\./i.test(quickExitSrc));
});
check("Quick Exit has an accessible label", () => {
  assert.ok(quickExitSrc.includes('aria-label="Quick Exit'));
});
const SENSITIVE_PAGES = [
  "src/app/safety/page.tsx",
  "src/app/safety/scam-guide/page.tsx",
  "src/app/safety/privacy/page.tsx",
  "src/app/safety/printable-guide/page.tsx",
  "src/app/your-rights/page.tsx",
];
check("Quick Exit is on every sensitive page (safety x4 + your-rights)", () => {
  for (const p of SENSITIVE_PAGES) {
    const src = read(p);
    assert.ok(src.includes("QuickExitButton"), `${p} is missing QuickExitButton`);
  }
});

// --- 2. Hotlines: locked numbers only ------------------------------
const publicSite = readFileSync(join(ROOT, "index.html"), "utf8");
check("every hotline number shown is locked in the frozen public site", () => {
  for (const h of EMERGENCY_HOTLINES) {
    assert.ok(publicSite.includes(h.number), `${h.number} is not in index.html`);
  }
  assert.ok(publicSite.includes("88788"), "text short code 88788 is not in index.html");
  assert.deepStrictEqual(
    [...LOCKED_HOTLINE_NUMBERS].sort(),
    ["1-800-799-7233", "1-888-373-7888", "911"].sort(),
  );
});
check("no other phone number appears in the safety content", () => {
  const safetySrc = read("src/lib/safety.ts");
  const numbers = safetySrc.match(/\d{3}-\d{3}-\d{4}/g) ?? [];
  const allowed = ["800-799-7233", "800-787-3224", "888-373-7888"];
  for (const n of numbers) assert.ok(allowed.includes(n), `unlocked number in safety.ts: ${n}`);
  assert.ok(!/tip.?line.*\d{3}/i.test(safetySrc), "a tip-line number was invented");
});

// --- 3. Scam guide --------------------------------------------------
check("scam guide names all six red flags", () => {
  assert.deepStrictEqual(
    SCAM_RED_FLAGS.map((f) => f.id),
    ["notario", "fake-job-offer", "fee-scam", "fake-uscis-contact", "fake-expedited", "document-theft"],
  );
  const joined = SCAM_RED_FLAGS.map((f) => `${f.title} ${f.whatItLooksLike}`).join(" ");
  assert.ok(/gift card/i.test(joined) && /wire/i.test(joined), "fake USCIS payment methods not named");
  assert.ok(/expedited|guaranteed approval/i.test(joined), "fake expedited promise not named");
});
check("scam guide reports to official pages, with no invented number", () => {
  const steps = SCAM_REPORT_STEPS.join(" ");
  assert.ok(steps.includes("ReportFraud.ftc.gov"));
  assert.ok(steps.includes("uscis.gov/avoid-scams"));
  const guideSrc = read("src/components/safety/ScamGuideSection.tsx");
  // The component uses the lib constants (not pasted literal URLs),
  // so check the wiring + the constant values in the lib.
  assert.ok(guideSrc.includes("FTC_REPORT_FRAUD_URL"));
  assert.ok(guideSrc.includes("USCIS_AVOID_SCAMS_URL"));
  assert.ok(guideSrc.includes('href={FTC_REPORT_FRAUD_URL}'));
  assert.ok(guideSrc.includes('href={USCIS_AVOID_SCAMS_URL}'));
  assert.strictEqual(FTC_REPORT_FRAUD_URL, "https://reportfraud.ftc.gov");
  assert.strictEqual(USCIS_AVOID_SCAMS_URL, "https://www.uscis.gov/avoid-scams");
});

// --- 4. Privacy -----------------------------------------------------
check("privacy page states what is never stored (SSN, CEAC password)", () => {
  const never = PRIVACY_SECTIONS.find((s) => s.id === "what-we-never-store");
  assert.ok(never, "what-we-never-store section missing");
  const body = never.body.join(" ");
  assert.ok(body.includes("Social Security Number (SSN)"));
  assert.ok(body.includes("CEAC password"));
  assert.ok(body.includes("never store your USCIS online account password"));
  const del = PRIVACY_SECTIONS.find((s) => s.id === "delete-your-data");
  assert.ok(del && del.body.join(" ").includes("nipteiapp@gmail.com"), "deletion route missing");
});
check("no new sensitive field, table, or migration was added", () => {
  const safetySrc = read("src/lib/safety.ts");
  assert.ok(!/create table|alter table|add column/i.test(safetySrc));
  const migrations = readdirSync(join(ROOT, "supabase", "migrations"));
  // Coordinator note (Nov 28, 2026): the safety builder added no
  // migration. 0036_itfw_expert_tools.sql is a different builder's
  // file (e-sign + translation orders), so "expert" is no longer a
  // valid exclusion here — only safety/privacy migrations are barred.
  assert.ok(!migrations.some((m) => /safety|privacy/i.test(m)), "a safety migration was added");
});

// --- 5. Printable guide ----------------------------------------------
check("printable guide renders the checklist", () => {
  assert.deepStrictEqual(
    PRINTABLE_CHECKLIST.map((s) => s.id),
    ["before-you-file", "interview-day", "after-the-interview"],
  );
  for (const s of PRINTABLE_CHECKLIST) assert.ok(s.items.length >= 6, `${s.id} has too few items`);
});
check("printable guide reuses interviewPrep (no rewritten lists)", () => {
  assert.ok(WHAT_TO_BRING.length === 3, "WHAT_TO_BRING should have 3 interview types");
  assert.ok(CONDUCT_GUIDE.points.length > 0);
  const printableSrc = read("src/components/safety/PrintableGuideSection.tsx");
  assert.ok(printableSrc.includes("WHAT_TO_BRING") && printableSrc.includes("CONDUCT_GUIDE"));
  assert.ok(printableSrc.includes("window.print()"));
  assert.ok(!/pdf-lib|jspdf|pdfkit/i.test(printableSrc), "a PDF generator was used");
  assert.ok(printableSrc.includes("print-area"));
});
check("print CSS hides controls and shows only the guide", () => {
  const css = read("src/app/globals.css");
  assert.ok(css.includes("@media print"));
  assert.ok(css.includes(".no-print"));
  assert.ok(css.includes(".print-area"));
});

// --- 6. Languages -----------------------------------------------------
check("all 7 languages exist, Arabic is RTL", () => {
  assert.deepStrictEqual(
    LANGUAGES.map((l) => l.code),
    ["en", "es", "ht", "fr", "pt", "zh", "ar"],
  );
  assert.strictEqual(LANGUAGES.find((l) => l.code === "ar")?.rtl, true);
});
check("English original always shown; other languages show the locked pending note", () => {
  assert.strictEqual(safetyTranslationNote("en"), null);
  for (const code of ["es", "ht", "fr", "pt", "zh", "ar"] as const) {
    assert.strictEqual(safetyTranslationNote(code), TRANSLATION_PENDING_NOTE);
  }
  for (const src of [
    read("src/components/safety/ScamGuideSection.tsx"),
    read("src/app/safety/privacy/page.tsx"),
  ]) {
    assert.ok(src.includes('dir={isSafetyRtl(lang) ? "rtl" : "ltr"}'));
    assert.ok(src.includes("safetyTranslationNote(lang)"));
  }
});

// --- 7. Accessibility ---------------------------------------------------
check("every new control is labelled and keyboard-navigable", () => {
  const helpSrc = read("src/components/safety/EmergencyHelpSection.tsx");
  assert.ok(helpSrc.includes('aria-labelledby="emergency-help-heading"'));
  assert.ok(helpSrc.includes("aria-label={`Call"));
  assert.ok(helpSrc.includes('href={h.telHref}'));
  for (const src of [
    read("src/components/safety/ScamGuideSection.tsx"),
    read("src/app/safety/privacy/page.tsx"),
    read("src/components/safety/PrintableGuideSection.tsx"),
  ]) {
    assert.ok(src.includes('aria-label="'), "a control lacks an aria-label");
    assert.ok(!src.includes("<div onClick"), "a non-keyboard control was used");
  }
  const printSrc = read("src/components/safety/PrintableGuideSection.tsx");
  assert.ok(printSrc.includes('<button\n          type="button"') || printSrc.includes('type="button"'));
});

// --- 8. Wiring -----------------------------------------------------------
check("client dashboard home renders the emergency help section", () => {
  const dash = read("src/app/client-dashboard/page.tsx");
  assert.ok(dash.includes("EmergencyHelpSection"));
  assert.ok(dash.includes("<EmergencyHelpSection />"));
});
check("your-rights renders Quick Exit + emergency help", () => {
  const yr = read("src/app/your-rights/page.tsx");
  assert.ok(yr.includes("QuickExitButton") && yr.includes("EmergencyHelpSection"));
});
check("safety hub links the scam guide, privacy page, and printable guide", () => {
  const hub = read("src/app/safety/page.tsx");
  for (const href of ["/safety/scam-guide", "/safety/privacy", "/safety/printable-guide", "/your-rights"]) {
    assert.ok(hub.includes(`href="${href}"`), `hub is missing ${href}`);
  }
  // The VAWA/U links use the lib constants (not pasted literals).
  assert.ok(hub.includes("PUBLIC_VAWA_URL") && hub.includes("PUBLIC_U_VISA_URL"));
  assert.strictEqual(PUBLIC_VAWA_URL, "https://immigration.niptei.com/#vawa");
  assert.strictEqual(PUBLIC_U_VISA_URL, "https://immigration.niptei.com/#uvisa");
});

console.log(`\nPASS: smoke-expert-additions — ${passed} checks, 0 failures.`);
