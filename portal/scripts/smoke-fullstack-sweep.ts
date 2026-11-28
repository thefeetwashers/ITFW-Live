// Smoke test: full-stack expert sweep — backend to frontend
// (founder's final expert sweep, Nov 28, 2026).
// Run with:  npx -y tsx scripts/smoke-fullstack-sweep.ts
// (tsx is NOT a project dependency; it is fetched on demand for this
// test only, as in scripts/smoke-final-sweep.ts.)
//
// FAKE DATA ONLY. No real Supabase, Stripe, SES, Twilio, or USCIS call
// is made. No network call is made at all: the rate limiter and the
// error/audit helpers are pure in-process functions, the migration
// checks read the SQL files from disk, and the UI checks read the
// component source from disk. Nothing is charged, no account is
// created, no real key is used.
//
// Proves:
//   1. RLS is enabled on every new table from migrations 0021-0030
//      (diy_drafts, diy_unlocks, daily_checkins, fee_waiver_checks,
//      biometrics_appointments, address_changes,
//      document_translations, google_connections, document_resends)
//      and migration 0031 hardens the four gaps found in the audit
//      (fee-waiver participant read, resend attribution, update
//      WITH CHECKs, ON DELETE CASCADE on the two bare FKs).
//   2. A public route returns 429 after the limit: the shared
//      limiter allows exactly N requests per bucket, then refuses
//      with retryAfterSeconds > 0, and the 429 response carries a
//      plain message and a Retry-After header.
//   3. A failing route returns an honest error with no stack trace:
//      safeDbError never includes the raw Postgres message (table /
//      column / constraint names), and missing-schema detection uses
//      the Postgres error CODE (42P01/42703), not message matching.
//   4. Audit logging never carries PII or money: scrubAuditDetail
//      drops sensitive keys (email, ssn, a_number, passport, income,
//      amount, price, threshold, …) even when the caller passes them.
//   5. Loading / error / empty states exist on the new surfaces:
//      pipeline (loading text + error alert + Try again + empty
//      state), /today (loading + error alert + Try again + empty
//      states), DIY drafts (empty state), fee-waiver save (saving /
//      saved / error + retry), and RTL direction is wired on the new
//      pages (dir={dir} / DirRoot / LanguagePicker persistence).
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkRateLimit,
  rateLimitResponse,
  PUBLIC_INTAKE_LIMIT,
  LOGIN_CODE_VERIFY_LIMIT,
} from "../src/lib/rateLimit";
import {
  safeDbError,
  isMissingSchemaError,
} from "../src/lib/apiErrors";
import { scrubAuditDetail } from "../src/lib/auditLog";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = join(ROOT, "..", "supabase", "migrations");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS, name), "utf8");
}

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  await fn();
  passed += 1;
  console.log(`  ok — ${name}`);
}

async function main(): Promise<void> {
// ---------------------------------------------------------------- 1. RLS
console.log("1. RLS enabled on the new tables (migration SQL text):");
const NEW_TABLES: { table: string; migration: string }[] = [
  { table: "diy_drafts", migration: "0023_itfw_diy_drafts.sql" },
  { table: "diy_unlocks", migration: "0024_itfw_diy_unlocks.sql" },
  { table: "daily_checkins", migration: "0026_itfw_daily_home.sql" },
  { table: "fee_waiver_checks", migration: "0029_itfw_renewal_radar_vault_expiry_waiver_checks.sql" },
  { table: "biometrics_appointments", migration: "0035_itfw_more_added.sql" },
  { table: "address_changes", migration: "0035_itfw_more_added.sql" },
  { table: "document_translations", migration: "0035_itfw_more_added.sql" },
  { table: "google_connections", migration: "0030_itfw_pro_discovery_google_docresend.sql" },
  { table: "document_resends", migration: "0030_itfw_pro_discovery_google_docresend.sql" },
];
for (const { table, migration } of NEW_TABLES) {
  await check(`RLS enabled on ${table} (${migration})`, () => {
    const sql = readMigration(migration);
    assert.ok(
      new RegExp(`alter table public\\.${table} enable row level security`, "i").test(sql),
      `${table} has no ENABLE ROW LEVEL SECURITY in ${migration}`
    );
    assert.ok(
      new RegExp(`create policy \\S+ on public\\.${table} for (select|insert)`, "i").test(sql),
      `${table} has no participant policy in ${migration}`
    );
  });
}
await check("migration 0031 exists (next free number after the 0030 collision)", () => {
  assert.ok(existsSync(join(MIGRATIONS, "0031_itfw_fullstack_sweep_rls_gapfill.sql")));
});
await check("0031 recreates fee_waiver_checks policies on is_case_participant", () => {
  const sql = readMigration("0031_itfw_fullstack_sweep_rls_gapfill.sql");
  assert.ok(sql.includes("fee_waiver_checks_select on public.fee_waiver_checks for select"));
  assert.ok(sql.includes("public.is_case_participant(case_id)"));
  assert.ok(sql.includes("select_founder_admin_fee_waiver_checks"));
});
await check("0031 requires resent_by = current_account_id() on document_resends insert", () => {
  const sql = readMigration("0031_itfw_fullstack_sweep_rls_gapfill.sql");
  assert.ok(sql.includes("resent_by = public.current_account_id()"));
});
await check("0031 adds WITH CHECK to the four bare UPDATE policies", () => {
  const sql = readMigration("0031_itfw_fullstack_sweep_rls_gapfill.sql");
  for (const table of ["biometrics_appointments", "address_changes", "document_translations", "diy_drafts"]) {
    assert.ok(
      sql.includes(`${table}_update on public.${table} for update`),
      `no recreated update policy for ${table}`
    );
  }
  assert.ok((sql.match(/with check \(/gi) ?? []).length >= 4);
});
await check("0031 re-adds ON DELETE CASCADE on the two bare FKs", () => {
  const sql = readMigration("0031_itfw_fullstack_sweep_rls_gapfill.sql");
  assert.ok(sql.includes("diy_unlocks_client_id_fkey"));
  assert.ok(sql.includes("fee_waiver_checks_checked_by_fkey"));
  assert.ok(sql.includes("on delete cascade"));
});

// ------------------------------------------------------- 2. Rate limit 429
console.log("2. Public routes return 429 after the limit:");
await check("public intake bucket allows exactly the limit, then refuses", () => {
  const key = `smoke-intake-${Date.now()}`;
  for (let i = 0; i < PUBLIC_INTAKE_LIMIT.limit; i++) {
    assert.equal(checkRateLimit(key, PUBLIC_INTAKE_LIMIT.limit, PUBLIC_INTAKE_LIMIT.windowMs).allowed, true);
  }
  const refused = checkRateLimit(key, PUBLIC_INTAKE_LIMIT.limit, PUBLIC_INTAKE_LIMIT.windowMs);
  assert.equal(refused.allowed, false);
  assert.ok(refused.retryAfterSeconds > 0, "refusal must carry retryAfterSeconds");
});
await check("login-code verify bucket is stricter (5/minute)", () => {
  assert.equal(LOGIN_CODE_VERIFY_LIMIT.limit, 5);
  const key = `smoke-verify-${Date.now()}`;
  for (let i = 0; i < 5; i++) {
    assert.equal(checkRateLimit(key, 5, 60_000).allowed, true);
  }
  assert.equal(checkRateLimit(key, 5, 60_000).allowed, false);
});
await check("429 response is a plain message with a Retry-After header", async () => {
  const res = rateLimitResponse(45, "quote requests");
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("retry-after"), "45");
  const body = (await res.json()) as { error: string };
  assert.match(body.error, /Too many quote requests/);
  assert.ok(!/stack|trace|Error:/i.test(body.error), "429 body must not leak internals");
});
await check("rate limiting is wired into the public routes", () => {
  for (const [file, marker] of [
    ["src/app/api/quote-requests/route.ts", "QUOTE_REQUEST_LIMIT"],
    ["src/app/api/leads/route.ts", "PUBLIC_INTAKE_LIMIT"],
    ["src/app/api/auth/login/route.ts", "LOGIN_CODE_REQUEST_LIMIT"],
    ["src/app/api/auth/verify-code/route.ts", "LOGIN_CODE_VERIFY_LIMIT"],
  ] as const) {
    assert.ok(read(file).includes(marker), `${file} does not use ${marker}`);
    assert.ok(read(file).includes("rateLimitResponse"), `${file} does not return the 429 helper`);
  }
});

// ------------------------------------------- 3. Honest errors, no leaks
console.log("3. Failing routes return honest errors with no stack trace:");
await check("safeDbError never includes the raw Postgres message", () => {
  const raw = {
    code: "42703",
    message: 'column fee_waiver_checks.threshold_150_cents does not exist',
  };
  const msg = safeDbError("Could not save the fee-waiver check. Nothing was saved.", "Migration 0029 may not have run yet.", raw);
  assert.ok(!msg.includes("threshold_150_cents"), "leaked a column name");
  assert.ok(!msg.includes("fee_waiver_checks"), "leaked a table name");
  assert.match(msg, /Could not save the fee-waiver check/);
  assert.match(msg, /Migration 0029/);
});
await check("missing-schema detection uses the error CODE, not the message", () => {
  assert.equal(isMissingSchemaError({ code: "42P01", message: "something else entirely" }), true);
  assert.equal(isMissingSchemaError({ code: "42703", message: "" }), true);
  assert.equal(isMissingSchemaError({ code: "23505", message: "column foo does not exist" }), false);
});
await check("new routes no longer interpolate error.message into responses", () => {
  for (const file of [
    "src/app/api/waiver-checks/route.ts",
    "src/app/api/diy/drafts/route.ts",
    "src/app/api/quote-requests/route.ts",
    "src/app/api/documents/resend/route.ts",
    "src/app/api/leads/route.ts",
    "src/app/api/pipeline/route.ts",
    "src/app/api/google-connections/route.ts",
  ]) {
    const src = read(file);
    // The only allowed raw-message use is inside safeDbError's
    // caller-side detection (none) — a template literal with
    // ${...error.message} or ${...Error.message} must not remain.
    assert.ok(!/\$\{[^}]*\.message\}/.test(src), `${file} still interpolates an error message`);
    assert.ok(!/error\.message\.includes/.test(src), `${file} still matches on error.message text`);
  }
});
await check("google-connections no longer returns 200 on a DB read failure", () => {
  const src = read("src/app/api/google-connections/route.ts");
  assert.ok(src.includes("{ status: 502 }"), "DB read failure must be 502");
  assert.ok(!src.includes("Showing not connected for every product"), "200-with-warning fallback must be gone");
});

// ------------------------------------------------------- 4. Audit logging
console.log("4. Audit log carries no PII or money:");
await check("scrubAuditDetail drops sensitive keys even when passed by mistake", () => {
  const clean = scrubAuditDetail({
    form_code: "I-130",
    status: "saved",
    email: "someone@example.com",
    ssn: "123-45-6789",
    a_number: "A123",
    passport: "X123",
    income: 40000,
    amount_cents: 2500,
    threshold_150_cents: 4950000,
    client_name: "Jane Doe",
  });
  assert.deepEqual(clean, { form_code: "I-130", status: "saved" });
});
await check("audit calls exist on the sensitive writes", () => {
  const pairs: [string, string][] = [
    ["src/app/api/quote-requests/route.ts", "quote_request_saved"],
    ["src/app/api/leads/route.ts", "lead_saved"],
    ["src/app/api/diy/drafts/route.ts", "diy_draft_saved"],
    ["src/app/api/diy/drafts/route.ts", "diy_draft_deleted"],
    ["src/app/api/waiver-checks/route.ts", "fee_waiver_check_saved"],
    ["src/app/api/documents/resend/route.ts", "document_resent"],
    ["src/app/api/google-connections/route.ts", "google_connection_updated"],
  ];
  for (const [file, action] of pairs) {
    assert.ok(read(file).includes(action), `${file} does not log ${action}`);
  }
});

// --------------------------------------- 5. Loading / error / empty states
console.log("5. Loading / error / empty states on the new surfaces:");
await check("pipeline has loading + error alert + Try again + empty state", () => {
  const src = read("src/components/pipeline/PipelinePageClient.tsx");
  assert.ok(src.includes("Loading the pipeline…"));
  assert.ok(src.includes('role="alert"'));
  assert.ok(src.includes("Try again"));
  assert.ok(src.includes("loadError"));
  const rows = read("src/components/pipeline/ClientPipeline.tsx");
  assert.ok(rows.includes("pipelineEmptyState(role)"));
});
await check("/today has loading + error alert + Try again", () => {
  const src = read("src/app/today/page.tsx");
  assert.ok(src.includes("Loading your Today page…"));
  assert.ok(src.includes('role="alert"'));
  assert.ok(src.includes("Try again"));
  const home = read("src/components/today/TodayHome.tsx");
  assert.ok(home.includes("No cases on file yet."));
  assert.ok(home.includes("No reminders today."));
});
await check("DIY drafts have an honest empty state; fee-waiver save has saving/saved/error", () => {
  const extras = read("src/components/diy/DiyExtras.tsx");
  assert.ok(extras.includes("No DIY drafts saved yet."));
  const waiver = read("src/components/dashboard/FeeWaiverCheckerSection.tsx");
  assert.ok(waiver.includes("Save this result to my case"));
  assert.ok(waiver.includes("Saving…"));
  assert.ok(waiver.includes("Saved to your case"));
  assert.ok(waiver.includes("This result is not saved"));
});
await check("RTL is wired on the new pages (no global restyle)", () => {
  assert.ok(read("src/app/today/page.tsx").includes("dir={dir}"));
  assert.ok(read("src/app/diy/page.tsx").includes("dir={dir}"));
  assert.ok(read("src/components/pipeline/PipelinePageClient.tsx").includes("dir={dir}"));
  assert.ok(read("src/app/journey/page.tsx").includes("<DirRoot>"));
  assert.ok(read("src/components/LanguagePicker.tsx").includes("niptei-language"));
  assert.ok(read("src/lib/usePreferredDir.ts").includes('isRtl'));
});

console.log(`\nSMOKE FULLSTACK SWEEP: ${passed} checks passed.`);
}

void main();
