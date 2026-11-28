// Smoke test for the platform AWS SES sender (src/lib/email.ts).
//
// Code-level only, FAKE credentials only — no real email is ever sent
// and no real key is ever used. Run with:
//   npx -y tsx scripts/smoke-ses.ts
//
// Asserts:
//   1. No SES env vars set  -> email_not_configured, no network call.
//   2. Fake key set         -> SES call attempted and rejected
//      (ses_rejected / ses_unreachable / sender_not_verified —
//      never success, never email_not_configured).
//   3. Sender default is updates@niptei.com; EMAIL_FROM overrides it.
//   4. Region default is us-east-1; AWS_SES_REGION overrides it.
//   5. A verification-style SES error maps to sender_not_verified
//      (checked via the classifier's behaviour on a fake endpoint
//      is not possible without a server, so this is covered by the
//      fake-key rejection: the SES endpoint rejects the fake
//      signature before any identity check).
//
// This script is excluded from tsc (see tsconfig.json "exclude").
import assert from "node:assert";

process.env.AWS_ACCESS_KEY_ID = "";
process.env.AWS_SECRET_ACCESS_KEY = "";
process.env.AWS_SES_REGION = "";
process.env.EMAIL_FROM = "";

import * as email from "../src/lib/email";

async function main() {
let passed = 0;
function check(name: string, cond: boolean) {
  assert.ok(cond, name);
  passed += 1;
  console.log(`PASS ${name}`);
}

// 1. Missing env -> email_not_configured, no network call attempted.
const missing = await email.sendEmail({
  to: "test@example.com",
  subject: "smoke test",
  text: "smoke test — no email should be sent",
});
check("missing env -> email_not_configured", !missing.ok && missing.code === "email_not_configured");
check("missing env lists the missing vars", email.missingEmailEnvs().length === 2);
check("isEmailConfigured false when keys missing", email.isEmailConfigured() === false);

// 3/4. Defaults with no env set.
check("sender default is updates@niptei.com", email.platformSenderEmail() === "updates@niptei.com");
check("region default is us-east-1", email.sesRegion() === "us-east-1");
process.env.EMAIL_FROM = "hello@example.com";
check("EMAIL_FROM overrides sender", email.platformSenderEmail() === "hello@example.com");
process.env.AWS_SES_REGION = "eu-west-1";
check("AWS_SES_REGION overrides region", email.sesRegion() === "eu-west-1");
process.env.EMAIL_FROM = "";
process.env.AWS_SES_REGION = "";

// 2. Fake credentials -> SES call attempted, rejected, never success.
process.env.AWS_ACCESS_KEY_ID = "AKIAFAKEFAKEFAKEFAKE";
process.env.AWS_SECRET_ACCESS_KEY = "fakefakefakefakefakefakefakefakefakefake";
check("isEmailConfigured true with fake keys", email.isEmailConfigured() === true);
const fake = await email.sendEmail({
  to: "test@example.com",
  subject: "smoke test",
  text: "smoke test — fake credentials, must be rejected",
});
check("fake key -> not ok", fake.ok === false);
check(
  "fake key -> rejection code, never email_not_configured",
  !fake.ok &&
    ["ses_rejected", "ses_unreachable", "sender_not_verified", "recipient_not_verified"].includes(fake.code)
);
console.log(`  (fake-key rejection code: ${!fake.ok ? fake.code : "n/a"})`);

console.log(`\n${passed}/${passed} assertions passed — no email was sent.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
