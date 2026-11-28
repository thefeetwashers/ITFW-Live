// Smoke test: paywall gating + interview prep — run with:
//   npx -y tsx scripts/smoke-paywall-interview.ts
// (tsx is NOT a project dependency; it is fetched on demand for this
// test only, as in scripts/smoke-stripe.ts.)
//
// FAKE DATA ONLY. No real Supabase, Stripe, or USCIS call is made:
// Supabase env vars are cleared (or pointed at a dead local address)
// so every route fails closed, and every decision is tested against
// the pure decidePaidAccess() function with fake evidence rows.
// Nothing is charged, no account is created, no real key is used.
//
// Proves:
//   1. An unpaid user is BLOCKED server-side (pure decision denies;
//      /api/access and /api/interview-prep return 401/501 with NO
//      question data — not just hidden in UI).
//   2. A paid user PASSES (active subscription / paid invoice).
//   3. Every interview question carries a source citation
//      (label + uscis.gov URL + based-on text), and every practice
//      question is labelled NOT official.
//   4. Locked prices are unchanged (bundles, member, role subs,
//      DIY $25 / Review $99).
//   5. The Dynamic Intake Engine registry still has 15 schemas and
//      the draft notice on every schema.
import assert from "node:assert/strict";
import {
  decidePaidAccess,
  PAYWALL_AUDIT,
  type PaidAccessEvidence,
} from "../src/lib/paywall";
import {
  allInterviewQuestions,
  allInterviewQuestionsHaveSources,
  allPracticeQuestionsLabelledNotOfficial,
  interviewQuestionCounts,
  VIDEO_SCRIPTS,
} from "../src/lib/interviewPrep";
import {
  ALL_REGISTRY_FORM_CODES,
  DRAFT_SCHEMA_NOTICE,
  getRegistrySchema,
} from "../src/lib/dynamicIntakeSchemas";
import { getLockedPriceByKey } from "../src/lib/stripePrices";
import { GET as accessGet } from "../src/app/api/access/route";
import { GET as interviewPrepGet } from "../src/app/api/interview-prep/route";
import { GET as studentCasesGet } from "../src/app/api/student/cases/route";

// No live backends in this test: clear the env vars the routes read.
process.env.NEXT_PUBLIC_SUPABASE_URL = "";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.STRIPE_SECRET_KEY = "";

let passed = 0;
function ok(name: string, cond: boolean) {
  assert.equal(cond, true, name);
  passed += 1;
  console.log(`  PASS ${name}`);
}

function evidence(partial: Partial<PaidAccessEvidence>): PaidAccessEvidence {
  return {
    role: "client",
    professionalSubscriptionStatus: null,
    subscriptionCurrentPeriodEnd: null,
    paidInvoiceCount: 0,
    accountVerified: false,
    ...partial,
  };
}

async function main() {
  // 1) Unpaid user is BLOCKED server-side (pure decision) -------------
  console.log("paywall decision — unpaid blocked");
  const unpaidClient = decidePaidAccess(evidence({ role: "client" }), "interview_prep");
  ok("unpaid client denied", unpaidClient.allowed === false);
  ok("unpaid client unlock is member_monthly", unpaidClient.unlockPriceKey === "member_monthly");
  ok("unpaid client unlock label is $9.80/mo", (unpaidClient.unlockLabel ?? "").includes("$9.80/mo"));

  const unpaidPreparer = decidePaidAccess(
    evidence({ role: "preparer", professionalSubscriptionStatus: "none" }),
    "smart_forms"
  );
  ok("unpaid preparer denied", unpaidPreparer.allowed === false);
  ok("unpaid preparer unlock is subscription_preparer", unpaidPreparer.unlockPriceKey === "subscription_preparer");

  const pastDue = decidePaidAccess(
    evidence({ role: "attorney", professionalSubscriptionStatus: "past_due" }),
    "interview_prep"
  );
  ok("past_due attorney denied", pastDue.allowed === false);

  const canceled = decidePaidAccess(
    evidence({ role: "nonprofit", professionalSubscriptionStatus: "canceled" }),
    "document_vault"
  );
  ok("canceled nonprofit denied", canceled.allowed === false);

  const expired = decidePaidAccess(
    evidence({
      role: "preparer",
      professionalSubscriptionStatus: "active",
      subscriptionCurrentPeriodEnd: "2020-01-01T00:00:00.000Z",
    }),
    "smart_forms"
  );
  ok("expired subscription denied", expired.allowed === false);

  const unpaidStudent = decidePaidAccess(
    evidence({ role: "law_student" }),
    "interview_prep"
  );
  ok("unpaid law student denied", unpaidStudent.allowed === false);
  ok("unpaid law student unlock is $35/mo", unpaidStudent.unlockPriceKey === "subscription_law_student");

  // 2) Paid user PASSES ------------------------------------------------
  console.log("paywall decision — paid passes");
  const activePreparer = decidePaidAccess(
    evidence({ role: "preparer", professionalSubscriptionStatus: "active" }),
    "smart_forms"
  );
  ok("active preparer allowed", activePreparer.allowed === true);

  const activeAttorneyFuture = decidePaidAccess(
    evidence({
      role: "attorney",
      professionalSubscriptionStatus: "active",
      subscriptionCurrentPeriodEnd: "2999-01-01T00:00:00.000Z",
    }),
    "interview_prep"
  );
  ok("active attorney (period end in future) allowed", activeAttorneyFuture.allowed === true);

  const paidInvoiceClient = decidePaidAccess(
    evidence({ role: "client", paidInvoiceCount: 1 }),
    "interview_prep"
  );
  ok("client with a paid invoice allowed", paidInvoiceClient.allowed === true);

  const paidInvoiceStudent = decidePaidAccess(
    evidence({ role: "law_student", paidInvoiceCount: 2 }),
    "smart_forms"
  );
  ok("law student with paid invoices allowed", paidInvoiceStudent.allowed === true);

  const teacherFree = decidePaidAccess(evidence({ role: "teacher" }), "interview_prep");
  ok("teacher allowed without payment (free role)", teacherFree.allowed === true);

  // 3) Server routes fail closed — no data leaks to unpaid callers -----
  console.log("routes — fail closed, no data for unpaid callers");
  {
    const res = await accessGet(
      new Request("http://localhost/api/access?surface=interview_prep")
    );
    ok("GET /api/access with no token and no Supabase returns 501", res.status === 501);
    const body = (await res.json()) as { allowed?: boolean };
    ok("GET /api/access fail-closed body says allowed=false", body.allowed === false);
  }
  {
    const res = await accessGet(
      new Request("http://localhost/api/access?surface=nope")
    );
    // Env check runs first: still 501 (fail closed), never a grant.
    ok("GET /api/access unknown surface with no Supabase returns 501", res.status === 501);
  }
  {
    const res = await interviewPrepGet(new Request("http://localhost/api/interview-prep"));
    ok("GET /api/interview-prep with no token and no Supabase returns 501", res.status === 501);
    const body = (await res.json()) as Record<string, unknown>;
    ok("GET /api/interview-prep fail-closed body has NO banks", !("banks" in body));
    ok("GET /api/interview-prep fail-closed body has NO questions", !("questions" in body));
  }
  {
    const res = await studentCasesGet(new Request("http://localhost/api/student/cases"));
    ok("GET /api/student/cases with no Supabase returns 501", res.status === 501);
    const body = (await res.json()) as Record<string, unknown>;
    ok("GET /api/student/cases fail-closed body has NO cases", !("cases" in body));
  }

  // 401 path: point the routes at a dead local address so clients()
  // exists but no token is sent — the token check fires before any
  // network call, so this returns 401 immediately.
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:1";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-key";
  {
    const res = await accessGet(
      new Request("http://localhost/api/access?surface=interview_prep")
    );
    ok("GET /api/access with no token returns 401", res.status === 401);
    const body = (await res.json()) as { allowed?: boolean };
    ok("GET /api/access 401 body says allowed=false", body.allowed === false);
  }
  {
    const res = await interviewPrepGet(new Request("http://localhost/api/interview-prep"));
    ok("GET /api/interview-prep with no token returns 401", res.status === 401);
    const body = (await res.json()) as Record<string, unknown>;
    ok("GET /api/interview-prep 401 body has NO banks", !("banks" in body));
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";

  // 4) Interview questions — every one cited ---------------------------
  console.log("interview banks — citations");
  const counts = interviewQuestionCounts();
  console.log(`  counts: total=${counts.total} official=${counts.officialCivics} practice=${counts.practice}`);
  for (const bank of counts.perBank) {
    console.log(`    ${bank.bankId}: ${bank.count} (official ${bank.official}, practice ${bank.practice})`);
  }
  ok("total questions is 63", counts.total === 63);
  ok("official civics questions is 25", counts.officialCivics === 25);
  ok("practice questions is 38", counts.practice === 38);
  ok("every question carries a source label + uscis.gov URL + based-on text", allInterviewQuestionsHaveSources());
  ok("every practice question is labelled NOT official", allPracticeQuestionsLabelledNotOfficial());
  ok(
    "no practice question claims to be official",
    allInterviewQuestions()
      .filter((q) => q.kind === "practice")
      .every((q) => !q.question.toLowerCase().startsWith("official") && q.source.label.toLowerCase().includes("uscis"))
  );
  ok(
    "every official civics question has an official answer",
    allInterviewQuestions()
      .filter((q) => q.kind === "official_civics")
      .every((q) => (q.answer ?? "").trim().length > 0)
  );
  ok("6 video scripts, all labelled not a finished video", VIDEO_SCRIPTS.length === 6);
  ok(
    "every video script is 60 seconds, 9:16",
    VIDEO_SCRIPTS.every(
      (v) => v.lengthSeconds === 60 && v.format.includes("9:16") && v.status === "Video script — not a finished video"
    )
  );

  // 5) Locked prices unchanged ------------------------------------------
  console.log("locked prices unchanged");
  const priceChecks: Array<[string, number]> = [
    ["bundle_basic", 99900],
    ["bundle_standard", 179900],
    ["bundle_premium", 279900],
    ["member_monthly", 980],
    ["member_yearly", 9800],
    ["subscription_preparer", 4900],
    ["subscription_attorney", 9900],
    ["subscription_doj_standard", 2450],
    ["subscription_doj_full", 4950],
    ["subscription_law_student", 3500],
    ["diy_form", 2500],
    ["review_form", 9900],
    ["review_human", 19900],
    ["addon_mock_interview", 19900],
  ];
  for (const [key, cents] of priceChecks) {
    ok(`locked price ${key} is $${(cents / 100).toFixed(2)}`, getLockedPriceByKey(key)?.amountCents === cents);
  }

  // 6) Dynamic Intake Engine registry intact ----------------------------
  console.log("dynamic intake registry");
  ok("registry has 15 schemas", ALL_REGISTRY_FORM_CODES.length === 15);
  ok(
    "every registry schema carries the draft notice",
    ALL_REGISTRY_FORM_CODES.every(
      (code) => getRegistrySchema(code)?.draftNotice === DRAFT_SCHEMA_NOTICE
    )
  );
  ok(
    "draft notice names uscis.gov",
    DRAFT_SCHEMA_NOTICE.includes("uscis.gov")
  );

  // 7) Paywall audit table covers all six surfaces ----------------------
  // (Coordinator, Nov 28, 2026: a sixth surface, packet_rescue_fix, was
  // added by the standout-five builder after this test was written.)
  console.log("paywall audit");
  ok("audit covers 6 surfaces", PAYWALL_AUDIT.length === 6);
  ok(
    "audit includes packet_rescue_fix",
    PAYWALL_AUDIT.some((r) => r.surface === "packet_rescue_fix")
  );
  ok(
    "interview_prep and smart_forms are enforced",
    PAYWALL_AUDIT.filter((r) => r.status === "enforced").map((r) => r.surface).join(",") ===
      "interview_prep,smart_forms"
  );

  console.log(`\nSMOKE PAYWALL+INTERVIEW: ${passed} checks passed.`);
}

main().catch((err) => {
  console.error("SMOKE PAYWALL+INTERVIEW FAILED:", err);
  process.exit(1);
});
