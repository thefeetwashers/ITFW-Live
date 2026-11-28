// Smoke test for the Guided DIY filing flow (/diy).
// Run with:  npx -y tsx scripts/smoke-diy-flow.ts
// (tsx is NOT a project dependency; it is fetched on demand for this
// test only. Fake data only — no real client, no real payment, no
// real email, no live Supabase / Stripe / SES call ever succeeds
// here. Nothing is charged, nothing is sent, nothing is filed.)
//
// Asserts:
//   1. Locked DIY prices are exactly DIY $25/form and DIY Bundle $99
//      with the locked Price IDs from the task (never changed here).
//   2. The pure unlock decision (src/lib/diy.ts decideDiyUnlock):
//      unpaid is DENIED; a paid diy_form invoice for a case unlocks
//      only the form(s) listed on that case; a paid diy_bundle
//      invoice unlocks every form; a paid per-form diy_unlocks row
//      unlocks that exact form; a paid final-stage invoice and a
//      fully-paid payment plan unlock; refunded/void/partial evidence
//      never unlocks; admin/founder get support access only.
//   3. Server-side enforcement (not just hidden buttons):
//      POST /api/diy/packet and POST /api/diy/email-packet with no
//      auth token return 401; with Supabase unconfigured they fail
//      CLOSED with 501 (never unlocked by default). GET
//      /api/diy/unlock-status rejects a bad case id (400) and an
//      unknown form (400) before any auth check.
//   4. Preview: the watermark text and the honest deterrent label
//      are present in the code and used by the DIY flow component,
//      and the label says plainly that a camera or browser print can
//      still capture a screen — screenshots are never claimed
//      impossible.
//   5. Every one of the 15 DIY forms carries its draft/edition
//      notice (DRAFT_SCHEMA_NOTICE + "check uscis.gov") and has at
//      least one checklist item from src/lib/formChecklists.ts.
//   6. Cover letter (draft): labelled DRAFT, says the platform is
//      not a law firm, carries the confirm-at-uscis.gov line and
//      the G-1450/G-1650 fee rule, and prints NO filing address.
//   7. Submission-order guide: 6 steps, confirm line on every
//      guide, G-1450/G-1650 only (no paper checks), one separate
//      payment per form, and NO invented filing address or online-
//      filing claim anywhere in the guide.
//   8. The packet route's real document rule: only documents with
//      review_status 'accepted' are included — there is NO
//      'approved' status (the brief's word "approved" is corrected
//      here; the route's own GET text says so).
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

// Fake / empty env first: no live service is ever reached.
process.env.NEXT_PUBLIC_SUPABASE_URL = "";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.STRIPE_SECRET_KEY = "";
process.env.STRIPE_WEBHOOK_SECRET = "";
process.env.AWS_ACCESS_KEY_ID = "";
process.env.AWS_SECRET_ACCESS_KEY = "";

import {
  ALL_REGISTRY_FORM_CODES,
  DRAFT_SCHEMA_NOTICE,
} from "../src/lib/dynamicIntakeSchemas";
import {
  DIY_COPY_DETERRENT_LABEL,
  DIY_FORM_CODES,
  DIY_PAY_FIRST_TEXT,
  DIY_PREVIEW_WATERMARK,
  allDiyFormsCarryEditionNotice,
  decideDiyUnlock,
  diyBundlePrice,
  diyFormMeta,
  diySinglePrice,
  getDiyUnlockForCase,
  type DiyUnlockEvidence,
} from "../src/lib/diy";
import {
  buildDiyCoverLetter,
  checklistTitlesForForm,
  submissionGuideForForms,
  DIY_SUBMISSION_CONFIRM_LINE,
} from "../src/lib/diySubmission";
import { POST as diyPacketPost } from "../src/app/api/diy/packet/route";
import { POST as diyEmailPost } from "../src/app/api/diy/email-packet/route";
import { GET as diyUnlockGet } from "../src/app/api/diy/unlock-status/route";
import { GET as packetGet } from "../src/app/api/generate-packet/route";

const FAKE_CASE = "11111111-2222-3333-4444-555555555555";
const FAKE_ACCOUNT = "66666666-7777-8888-9999-000000000000";

async function main() {
  let passed = 0;
  function ok(name: string, cond: boolean) {
    assert.equal(cond, true, name);
    passed += 1;
    console.log(`  PASS ${name}`);
  }

  const baseEvidence = (over: Partial<DiyUnlockEvidence>): DiyUnlockEvidence => ({
    role: "client",
    caseForms: ["I-485"],
    hasPaidDiyBundle: false,
    hasPaidDiyForm: false,
    hasPaidDiyUnlockRow: false,
    hasPaidFinalStageInvoice: false,
    hasFullyPaidPaymentPlan: false,
    ...over,
  });

  // 1) Locked DIY prices — never changed here.
  console.log("locked DIY prices");
  const single = diySinglePrice();
  ok("DIY $25/form priceId is price_1UfS5APfd9SRUcvh47Ks9Lw0", single.priceId === "price_1UfS5APfd9SRUcvh47Ks9Lw0");
  ok("DIY $25/form is 2500 cents", single.amountCents === 2500);
  const bundle = diyBundlePrice();
  ok("DIY Bundle $99 priceId is price_1UfS5iPfd9SRUcvhKEQxf0pj", bundle.priceId === "price_1UfS5iPfd9SRUcvhKEQxf0pj");
  ok("DIY Bundle $99 is 9900 cents", bundle.amountCents === 9900);
  ok("pay-first text names both prices", DIY_PAY_FIRST_TEXT.includes("$25") && DIY_PAY_FIRST_TEXT.includes("$99"));

  // 2) Pure unlock decision.
  console.log("unlock decision — unpaid is denied");
  ok("no evidence -> denied", decideDiyUnlock(baseEvidence({}), "I-485").unlocked === false);
  ok("denied reason is the pay-first text", decideDiyUnlock(baseEvidence({}), "I-485").reason === DIY_PAY_FIRST_TEXT);
  ok("denied decision names no unlock source", decideDiyUnlock(baseEvidence({}), "I-485").unlockedBy === null);

  console.log("unlock decision — paid evidence");
  ok(
    "paid diy_form invoice unlocks a form listed on the case",
    decideDiyUnlock(baseEvidence({ hasPaidDiyForm: true }), "I-485").unlocked === true &&
      decideDiyUnlock(baseEvidence({ hasPaidDiyForm: true }), "I-485").unlockedBy === "diy_form_invoice_for_case"
  );
  ok(
    "paid diy_form invoice does NOT unlock a form not on the case",
    decideDiyUnlock(baseEvidence({ hasPaidDiyForm: true }), "N-400").unlocked === false
  );
  ok(
    "paid diy_bundle invoice unlocks every form",
    decideDiyUnlock(baseEvidence({ hasPaidDiyBundle: true }), "N-400").unlocked === true &&
      decideDiyUnlock(baseEvidence({ hasPaidDiyBundle: true }), "N-400").unlockedBy === "diy_bundle_invoice"
  );
  ok(
    "paid per-form diy_unlocks row unlocks that exact form",
    decideDiyUnlock(baseEvidence({ hasPaidDiyUnlockRow: true }), "I-485").unlocked === true &&
      decideDiyUnlock(baseEvidence({ hasPaidDiyUnlockRow: true }), "I-485").unlockedBy === "diy_unlock_row"
  );
  ok(
    "paid final-stage invoice unlocks",
    decideDiyUnlock(baseEvidence({ hasPaidFinalStageInvoice: true }), "I-485").unlocked === true
  );
  ok(
    "fully-paid payment plan unlocks",
    decideDiyUnlock(baseEvidence({ hasFullyPaidPaymentPlan: true }), "I-485").unlocked === true
  );
  ok(
    "admin/founder support access only",
    decideDiyUnlock(baseEvidence({ role: "admin" }), "I-485").unlocked === true &&
      decideDiyUnlock(baseEvidence({ role: "admin" }), "I-485").unlockedBy === "admin_founder_support" &&
      decideDiyUnlock(baseEvidence({ role: "teacher" }), "I-485").unlocked === false &&
      decideDiyUnlock(baseEvidence({ role: "preparer" }), "I-485").unlocked === false
  );

  // 3) Server-side enforcement.
  console.log("server-side gate — unconfigured Supabase fails CLOSED");
  {
    const noConfig = await getDiyUnlockForCase(FAKE_ACCOUNT, FAKE_CASE, "I-485");
    ok("unconfigured reader denies", noConfig.unlocked === false);
    ok("unconfigured reader reports configured=false", noConfig.configured === false);
  }
  {
    // No auth token at all: the packet route must refuse before any
    // unlock or packet work (resolveDiyCaller returns 501 while env
    // is empty — fail closed either way; never unlocked by default).
    const res = await diyPacketPost(
      new Request("http://localhost/api/diy/packet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: FAKE_CASE, formCode: "I-485" }),
      })
    );
    ok("POST /api/diy/packet with no auth is not 200", res.status !== 200);
    ok("POST /api/diy/packet with no auth fails closed (401 or 501)", res.status === 401 || res.status === 501);
    const data = (await res.json()) as { error?: string; code?: string };
    ok("packet refusal carries an error, never a signed URL", typeof data.error === "string" && !("signedUrl" in data));
  }
  {
    const res = await diyEmailPost(
      new Request("http://localhost/api/diy/email-packet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: FAKE_CASE, formCode: "I-485" }),
      })
    );
    ok("POST /api/diy/email-packet with no auth is not 200", res.status !== 200);
    ok("POST /api/diy/email-packet with no auth fails closed (401 or 501)", res.status === 401 || res.status === 501);
    const data = (await res.json()) as { error?: string };
    ok("email refusal carries an error", typeof data.error === "string");
  }
  {
    // Fake Supabase env (no network is reached: no token is sent, so
    // the caller check refuses before any Supabase call).
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-key";
    const res = await diyPacketPost(
      new Request("http://localhost/api/diy/packet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: FAKE_CASE, formCode: "I-485" }),
      })
    );
    ok("POST /api/diy/packet with fake env + no token returns 401", res.status === 401);
    const emailRes = await diyEmailPost(
      new Request("http://localhost/api/diy/email-packet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: FAKE_CASE, formCode: "I-485" }),
      })
    );
    ok("POST /api/diy/email-packet with fake env + no token returns 401", emailRes.status === 401);
    const badCase = await diyUnlockGet(
      new Request("http://localhost/api/diy/unlock-status?caseId=not-a-uuid&formCode=I-485")
    );
    ok("GET /api/diy/unlock-status with a bad case id returns 400", badCase.status === 400);
    const badForm = await diyUnlockGet(
      new Request(`http://localhost/api/diy/unlock-status?caseId=${FAKE_CASE}&formCode=I-999`)
    );
    ok("GET /api/diy/unlock-status with an unknown form returns 400", badForm.status === 400);
    // Back to unconfigured for the rest of the run.
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  }

  // 4) Preview watermark + honest deterrent label.
  console.log("preview watermark + deterrent label");
  ok("watermark names DRAFT + Immigration with NIPTEI + not for filing", DIY_PREVIEW_WATERMARK.includes("DRAFT") && DIY_PREVIEW_WATERMARK.includes("Immigration with NIPTEI") && DIY_PREVIEW_WATERMARK.includes("not for filing until reviewed and signed"));
  ok("deterrent label says it is a deterrent, not a guarantee", DIY_COPY_DETERRENT_LABEL.includes("deterrent, not a guarantee"));
  ok("deterrent label admits a phone camera can still capture a screen", DIY_COPY_DETERRENT_LABEL.includes("phone camera"));
  ok("deterrent label admits the browser's own print can still capture a screen", DIY_COPY_DETERRENT_LABEL.includes("browser's own print"));
  ok("deterrent label says the pay gate is what protects the work", DIY_COPY_DETERRENT_LABEL.includes("pay gate"));
  ok("deterrent label never claims screenshots are impossible", !DIY_COPY_DETERRENT_LABEL.toLowerCase().includes("impossible") && !DIY_COPY_DETERRENT_LABEL.toLowerCase().includes("cannot be screenshotted"));
  const flowSource = fs.readFileSync(
    path.join(__dirname, "..", "src", "components", "diy", "DiyGuidedFlow.tsx"),
    "utf8"
  );
  ok("DIY flow component renders the watermark", flowSource.includes("DIY_PREVIEW_WATERMARK"));
  ok("DIY flow component renders the deterrent label", flowSource.includes("DIY_COPY_DETERRENT_LABEL"));
  ok("DIY flow component disables copy/cut/context-menu in the preview", flowSource.includes('onCopy') && flowSource.includes("preventDefault") && flowSource.includes("onContextMenu"));
  ok("DIY flow component blocks copy/print keyboard shortcuts in the preview", flowSource.includes('"c"') && flowSource.includes('"p"'));
  ok("DIY flow component mounts the real intake engine in DIY mode", flowSource.includes("DynamicFormIntakeEngine") && flowSource.includes('mode="client_diy"'));
  ok("DIY flow component uses the real CheckoutButton for both DIY prices", flowSource.includes("CheckoutButton") && flowSource.includes("single.priceId") && flowSource.includes("bundle.priceId"));
  const pageSource = fs.readFileSync(
    path.join(__dirname, "..", "src", "app", "diy", "page.tsx"),
    "utf8"
  );
  ok("the /diy page mounts the guided flow", pageSource.includes("DiyGuidedFlow"));

  // 5) Every form carries its edition notice + a checklist.
  console.log("edition notice on all 15 forms");
  ok("DIY covers exactly the 15 registry forms", DIY_FORM_CODES.length === 15 && DIY_FORM_CODES.every((c) => ALL_REGISTRY_FORM_CODES.includes(c)));
  ok("every DIY form carries its draft/edition notice", allDiyFormsCarryEditionNotice());
  for (const code of DIY_FORM_CODES) {
    const meta = diyFormMeta(code);
    ok(`Form ${code} has a draft notice`, meta !== null && meta.draftNotice === DRAFT_SCHEMA_NOTICE);
    ok(`Form ${code} edition note says to confirm at uscis.gov (no invented edition)`, (meta?.editionNote ?? "").includes("uscis.gov") && !(meta?.editionNote ?? "").match(/\b(0[1-9]|1[0-2])\/\d{2}\/\d{2}\b/));
    const items = checklistTitlesForForm(code);
    ok(`Form ${code} has at least one checklist item`, items.length >= 1);
  }

  // 6) Cover letter (draft).
  console.log("cover letter");
  const letter = buildDiyCoverLetter({ clientName: null, formCodes: ["I-485"], dateIso: "2026-11-28" });
  ok("cover letter is labelled DRAFT", letter.includes("DRAFT cover letter"));
  ok("cover letter says the platform is not a law firm", letter.includes("not a law firm"));
  ok("cover letter carries the confirm-at-uscis.gov line", letter.includes(DIY_SUBMISSION_CONFIRM_LINE));
  ok("cover letter names the G-1450/G-1650 fee rule", letter.includes("G-1450") && letter.includes("G-1650"));
  ok("cover letter prints no filing address", !letter.includes("P.O. Box") && !/\b\d{5}(-\d{4})?\b/.test(letter));  ok("cover letter uses a name placeholder when no name is known (never invents one)", letter.includes("[Your full legal name]"));
  ok("cover letter lists the form's checklist items", letter.includes("Birth certificate"));

  // 7) Submission-order guide.
  console.log("submission-order guide");
  for (const code of DIY_FORM_CODES) {
    const guide = submissionGuideForForms([code]);
    ok(`guide for ${code} has 6 steps in order`, guide.steps.length === 6 && guide.steps.every((s, i) => s.step === i + 1));
    ok(`guide for ${code} carries the confirm line`, guide.confirmLine === DIY_SUBMISSION_CONFIRM_LINE);
    ok(`guide for ${code} carries the draft notice`, guide.draftNotice === DRAFT_SCHEMA_NOTICE);
    const joined = guide.steps.map((s) => s.detail).join("\n");
    ok(`guide for ${code} says G-1450/G-1650 and no paper checks`, joined.includes("G-1450") && joined.includes("G-1650") && joined.includes("no personal checks"));
    ok(`guide for ${code} says one separate payment per form`, joined.includes("One separate payment per form") || joined.includes("one separate payment per form"));
    ok(`guide for ${code} prints no invented filing address`, !/P\.O\. Box|Lockbox|Chicago|Phoenix|Dallas|Elgin|Lewisville/.test(joined));
    ok(`guide for ${code} claims no online-filing list`, joined.includes("does not list a filing address") && joined.includes("does not say which forms accept online filing"));
  }

  // 8) Packet route's real document rule: 'accepted', not 'approved'.
  console.log("packet document rule");
  {
    const res = await packetGet();
    const data = (await res.json()) as { documentsIncludedOnlyWhen?: string };
    ok(
      "generate-packet documents rule is review_status 'accepted'",
      (data.documentsIncludedOnlyWhen ?? "").includes("accepted")
    );
    ok(
      "generate-packet says there is no 'approved' status",
      (data.documentsIncludedOnlyWhen ?? "").includes("no 'approved' status")
    );
  }

  console.log(`\nDIY flow smoke test: ${passed} checks passed.`);
}

main().catch((err) => {
  console.error("SMOKE FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
