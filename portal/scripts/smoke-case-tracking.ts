// Smoke test for case-number tracking + NVC / consular
// (src/lib/caseTracking.ts, src/components/nextstep/CaseTracker.tsx).
//
// Code-level only, FAKE data only — no real case, no DB, no network,
// no email, no live USCIS lookup. Run with:
//   npx -y tsx scripts/smoke-case-tracking.ts
//
// Asserts:
//   1. An invalid receipt prefix is rejected; a valid IOE receipt is
//      accepted and masked (prefix + last 4 only).
//   2. A status change is logged with a date + plain-English meaning
//      + next step; logging the same status twice does not duplicate
//      it; an unknown status is never guessed.
//   3. The completeness view labels its data as our records on every
//      row (never as USCIS's internal file).
//   4. The tracker component carries the honest "cannot see inside
//      the officer's file" note, verbatim.
//   5. No CEAC password field exists anywhere in the new code — only
//      the warning never to enter one.
//   6. The RFE / NOID decoder flags attorney review for a NOID and
//      admits when it does not recognise notice words.
//   7. The consular checklist reuses the NVC engine (post lookup,
//      $120 AOS + $325 IV, CEAC link), stores NO embassy email, and
//      rejects an invalid NVC case number.
//   8. The case_watch milestone carries the masked receipt only —
//      never the full number.
//
// This script is excluded from tsc (see tsconfig.json "exclude").
import assert from "node:assert";
import { readFileSync } from "node:fs";

import {
  HONEST_TRACKER_NOTE,
  appendStatusChange,
  buildCaseWatchMilestone,
  buildCompletenessView,
  buildConsularChecklist,
  buildStatusLogEntry,
  decodeRfeNotice,
  deadlineUrgency,
  explainPublicStatus,
  maskReceiptNumber,
  validateReceiptNumber,
  COMPLETENESS_SOURCE_LABEL,
} from "../src/lib/caseTracking";

async function main() {
  let passed = 0;
  function check(name: string, cond: boolean) {
    assert.ok(cond, name);
    passed += 1;
    console.log(`PASS ${name}`);
  }

  // 1. Receipt validation + masking.
  const badPrefix = validateReceiptNumber("XXX1234567890");
  check("invalid receipt prefix XXX is rejected", !badPrefix.valid);
  check(
    "invalid prefix error names the recognised prefixes",
    badPrefix.errors.join(" ").includes("IOE")
  );
  const tooShort = validateReceiptNumber("IOE123");
  check("short receipt number is rejected", !tooShort.valid);
  const good = validateReceiptNumber("IOE0928374651");
  check("valid IOE receipt is accepted", good.valid);
  check(
    "valid receipt normalises to itself",
    good.normalized === "IOE0928374651"
  );
  check(
    "receipt is masked to prefix + last 4",
    good.masked === "IOE••••••4651" && maskReceiptNumber("IOE0928374651") === "IOE••••••4651"
  );
  check(
    "masked receipt never contains the middle digits",
    !good.masked.includes("092837")
  );

  // 2. Status-change log: date + plain-English meaning + next step.
  const entry = buildStatusLogEntry({
    id: "smoke-1",
    statusText: "Case Was Received",
    source: "sandbox_mock",
    receiptNumber: "IOE0928374651",
    recordedAt: "2026-11-28T10:00:00.000Z",
  });
  check("log entry carries a recorded date", entry.recordedAt === "2026-11-28T10:00:00.000Z");
  check(
    "log entry carries a plain-English meaning",
    entry.plainEnglish.includes("only means it arrived")
  );
  check("log entry carries a next step", entry.nextStep.length > 0);
  check(
    "log entry stores the masked receipt only",
    entry.receiptNumberMasked === "IOE••••••4651"
  );
  const log = appendStatusChange([], entry);
  check("status change is appended to an empty log", log.length === 1);
  const dup = appendStatusChange(log, { ...entry, id: "smoke-1b" });
  check("same status logged twice is not duplicated", dup.length === 1);
  const second = appendStatusChange(
    log,
    buildStatusLogEntry({
      id: "smoke-2",
      statusText: "Biometrics Appointment Was Scheduled",
      source: "sandbox_mock",
      receiptNumber: "IOE0928374651",
      recordedAt: "2026-11-28T11:00:00.000Z",
    })
  );
  check("a different status is appended", second.length === 2);
  const unknown = explainPublicStatus("Case Was Zorpified");
  check("unknown status is never guessed", !unknown.known);
  check(
    "unknown status tells the reader to check uscis.gov",
    unknown.plainEnglish.includes("USCIS Case Status Online")
  );

  // 3. Completeness view — our records, labelled on every row.
  const view = buildCompletenessView({ templateId: "i130-nvc" });
  check("completeness view has rows for the template", view.rows.length > 0);
  check(
    "completeness view readiness score is a number 0-100",
    view.readinessScore >= 0 && view.readinessScore <= 100
  );
  check(
    "completeness view is not ready to file at 0 cleared items",
    view.readyToFile === false
  );
  check(
    "every completeness row is labelled as our records",
    view.rows.every((r) => r.sourceNote === COMPLETENESS_SOURCE_LABEL)
  );
  check(
    "completeness view source note names our records, not USCIS's file",
    view.sourceNote.includes("Our records") &&
      view.sourceNote.includes("not USCIS's internal file")
  );
  const emptyView = buildCompletenessView({ templateId: "no-such-template" });
  check(
    "unknown template yields an empty view, never a guessed checklist",
    emptyView.rows.length === 0
  );

  // 4. Tracker component carries the honest note, verbatim.
  const trackerSrc = readFileSync(
    new URL("../src/components/nextstep/CaseTracker.tsx", import.meta.url),
    "utf8"
  );
  check(
    "tracker component renders the honest note",
    trackerSrc.includes("HONEST_TRACKER_NOTE") &&
      HONEST_TRACKER_NOTE.includes("We cannot see inside the officer's file")
  );
  check(
    "honest note text is the required sentence",
    HONEST_TRACKER_NOTE ===
      "We show your case status from USCIS public status and from your own file with us. We cannot see inside the officer's file."
  );

  // 5. No CEAC password field anywhere in the new code.
  const libSrc = readFileSync(
    new URL("../src/lib/caseTracking.ts", import.meta.url),
    "utf8"
  );
  // A "password field" means an input, a form field name/id, or a
  // variable that would HOLD a password — not the prose warning that
  // a CEAC password must never be entered or stored. The warning
  // constant CEAC_PASSWORD_RULE is allowed; a field is not.
  const PASSWORD_FIELD_RE =
    /ceacPassword|ceac_password(?!_rule)|ceacPwd|["']password["']\s*:|name\s*=\s*"[^"]*password|id\s*=\s*"[^"]*password|type\s*=\s*"password/i;
  for (const [file, src] of [
    ["caseTracking.ts", libSrc],
    ["CaseTracker.tsx", trackerSrc],
  ] as const) {
    check(`${file}: no CEAC password field or holder`, !PASSWORD_FIELD_RE.test(src));
  }
  check(
    "CEAC password warning is present instead",
    libSrc.includes("Never enter your CEAC password in this portal")
  );

  // 6. RFE / NOID decoder.
  const noid = decodeRfeNotice(
    "This is a Notice of Intent to Deny. We need more proof of a bona fide marriage."
  );
  check("NOID text is recognised", noid.recognised);
  check("NOID needs attorney review", noid.needsAttorneyReview === true);
  const unknownNotice = decodeRfeNotice("Zorp blorp frobnication clause 7.");
  check(
    "unrecognised notice words are admitted, never guessed",
    unknownNotice.recognised === false
  );

  // 7. Consular checklist — NVC engine, fees, no invented embassy email.
  const consular = buildConsularChecklist("PHP2026144009");
  check("valid NVC case number is accepted", consular.nvcCaseValid === true);
  check(
    "post lookup resolves Port-au-Prince",
    consular.post?.city === "Port-au-Prince" && consular.post?.country === "Haiti"
  );
  check(
    "DOS fees are $120 AOS + $325 IV",
    consular.fees.aosUsd === 120 && consular.fees.ivUsdPerApplicant === 325
  );
  check(
    "CEAC login link is present",
    consular.ceacLoginUrl === "https://ceac.state.gov/IV/Login.aspx"
  );
  check(
    "online submission list includes DS-260",
    consular.submitOnline.some((s) => s.title.includes("DS-260"))
  );
  check(
    "no embassy email is stored (null by design)",
    consular.embassyEmail === null
  );
  check(
    "embassy directory link is present instead of an address",
    consular.embassyDirectoryUrl === "https://www.usembassy.gov/"
  );
  const badNvc = buildConsularChecklist("PHP2026999001");
  check("invalid NVC case number is rejected", badNvc.nvcCaseValid === false);

  // 8. case_watch milestone — masked receipt only.
  const milestone = buildCaseWatchMilestone(entry);
  check(
    "milestone kind is uscis_status_change",
    milestone.kind === "uscis_status_change"
  );
  check(
    "milestone carries the masked receipt only",
    milestone.receipt_number_masked === "IOE••••••4651" &&
      !JSON.stringify(milestone).includes("0928374651")
  );

  // Deadline urgency is computed from stored dates only.
  check(
    "past RFE deadline is overdue",
    deadlineUrgency("2026-01-15", "due", "2026-11-28") === "overdue"
  );
  check(
    "deadline within 14 days is due soon",
    deadlineUrgency("2026-12-05", "due", "2026-11-28") === "due_soon"
  );

  console.log(`\nSMOKE CASE-TRACKING: ${passed} checks passed.`);
}

main().catch((err) => {
  console.error("SMOKE CASE-TRACKING FAILED:", err);
  process.exit(1);
});
