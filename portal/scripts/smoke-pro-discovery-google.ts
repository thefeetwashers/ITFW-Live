// Smoke test for professional discovery + Google integrations +
// client document flow (twelfth addition, part A, Nov 28, 2026).
//
// Code-level only, FAKE data only — no real email is ever sent, no
// real professional is invented, no real Google account is touched,
// and no real key is ever used. Run with:
//   npx -y tsx scripts/smoke-pro-discovery-google.ts
//
// Asserts:
//   1. The verified directory lists VERIFIED professionals only:
//      unverified / unpublished / unpaid profiles are excluded by
//      the listing gate, whatever the filters are.
//   2. The Google connect UI shows "not connected" for Calendar,
//      Drive, and Gmail, with the EXACT least-privilege scopes
//      listed, and no claim of connection anywhere. Google sign-in
//      state is the verified code-path state (SES change does not
//      affect it; 6-digit code still required after Google).
//   3. Document resend by email works via SES when configured and
//      returns 501 / email_not_configured when not (checked via
//      src/lib/email.ts + the pure channel-availability helper).
//      The subject carries the form label only — never an
//      identifier — and identifier payloads are rejected.
//   4. SMS resend returns 501 / not_configured with no Twilio
//      connected (the professional's own Twilio is NOT connected).
//   5. Client invites reuse the family_invites magic link +
//      6-digit code system (no new mechanism), and locked
//      subscription prices are unchanged ($49 / $99 / $24.50 /
//      $49.50 / $35).
//
// This script is excluded from tsc (see tsconfig.json "exclude").
import assert from "node:assert";

process.env.AWS_ACCESS_KEY_ID = "";
process.env.AWS_SECRET_ACCESS_KEY = "";
process.env.AWS_SES_REGION = "";
process.env.EMAIL_FROM = "";
process.env.TWILIO_ACCOUNT_SID = "";
process.env.TWILIO_AUTH_TOKEN = "";
process.env.TWILIO_PHONE_NUMBER = "";

import {
  searchVerifiedProfessionals,
  NO_VERIFIED_MATCHES_EMPTY_STATE,
  type DirectoryProfile,
} from "../src/lib/verifiedDirectory";
import {
  ALL_GOOGLE_API_SCOPES,
  GOOGLE_SCOPES,
  GOOGLE_SIGNIN_STATE,
  defaultGoogleConnections,
  googleConnectionLabel,
  isGoogleProductConnected,
  validateGoogleContact,
} from "../src/lib/googleIntegrations";
import {
  buildResendEmailSubject,
  buildResendLogRow,
  containsSensitiveIdentifier,
  maskRecipient,
  resendChannelAvailability,
  validateResendRequest,
  vaultShareLink,
} from "../src/lib/docResend";
import { buildClientInvite, formatFlatPrice, proSubscriptionPrices } from "../src/lib/proDiscovery";
import * as email from "../src/lib/email";

const FAKE_UUID = "11111111-2222-4333-8444-555555555555";
const FAKE_UUID_2 = "66666666-7777-4888-9999-000000000000";

function listedProfile(overrides: Partial<DirectoryProfile>): DirectoryProfile {
  return {
    id: "p1",
    slug: "example-preparer",
    fullName: "Example Preparer",
    companyName: null,
    role: "preparer",
    bio: null,
    languagesSpoken: ["en"],
    acceptingNewClients: true,
    practiceAreas: ["I-130"],
    accreditationLevel: null,
    isPublished: true,
    subscriptionStatus: "active",
    isVerified: true,
    verificationStatus: "verified",
    formFees: [{ formCode: "I-130", feeCents: 29900 }],
    ...overrides,
  };
}

async function main() {
  let passed = 0;
  function check(name: string, cond: boolean) {
    assert.ok(cond, name);
    passed += 1;
    console.log(`PASS ${name}`);
  }

  // --- 1. Verified directory: verified only. --------------------------
  const verified = listedProfile({});
  const unverifiedAttorney = listedProfile({
    id: "p2", slug: "unverified-attorney", fullName: "Unverified Attorney",
    role: "attorney", isVerified: false,
  });
  const unpublished = listedProfile({
    id: "p3", slug: "unpublished-preparer", fullName: "Unpublished Preparer",
    isPublished: false,
  });
  const unpaid = listedProfile({
    id: "p4", slug: "unpaid-preparer", fullName: "Unpaid Preparer",
    subscriptionStatus: "none",
  });
  const all = [verified, unverifiedAttorney, unpublished, unpaid];
  const search = searchVerifiedProfessionals(all, {});
  check("directory lists only the verified profile", search.results.length === 1 && search.results[0].id === "p1");
  check("directory reports 3 excluded by the listing gate", search.excludedUnverifiedCount === 3);
  check("directory totalListed counts only listed profiles", search.totalListed === 1);
  const empty = searchVerifiedProfessionals(all, { language: "fr" });
  check("no match -> honest empty state, never an invented listing",
    empty.results.length === 0 && empty.emptyState === NO_VERIFIED_MATCHES_EMPTY_STATE);

  // --- 2. Google integrations: not connected, exact scopes. ----------
  const conns = defaultGoogleConnections();
  check("three Google products tracked (calendar, drive, gmail)",
    conns.length === 3 &&
    conns.some((c) => c.product === "calendar") &&
    conns.some((c) => c.product === "drive") &&
    conns.some((c) => c.product === "gmail"));
  for (const c of conns) {
    check(`google ${c.product} starts not_connected`, c.status === "not_connected");
    check(`google ${c.product} is not connected (helper)`, isGoogleProductConnected(c) === false);
    check(`google ${c.product} label says Not connected, never Connected`,
      googleConnectionLabel(c).toLowerCase().includes("not connected") &&
      !googleConnectionLabel(c).startsWith("Connected"));
  }
  check("calendar scope is exactly calendar.events (least privilege)",
    JSON.stringify(GOOGLE_SCOPES.calendar) === JSON.stringify(["https://www.googleapis.com/auth/calendar.events"]));
  check("drive scope is exactly drive.file (least privilege)",
    JSON.stringify(GOOGLE_SCOPES.drive) === JSON.stringify(["https://www.googleapis.com/auth/drive.file"]));
  check("gmail scope is exactly gmail.send (send only, never inbox read)",
    JSON.stringify(GOOGLE_SCOPES.gmail) === JSON.stringify(["https://www.googleapis.com/auth/gmail.send"]));
  check("all API scopes list is exactly the three least-privilege scopes",
    JSON.stringify(ALL_GOOGLE_API_SCOPES) === JSON.stringify([
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/gmail.send",
    ]));
  check("google sign-in code path complete, SES change does not affect it",
    GOOGLE_SIGNIN_STATE.codePathComplete === true && GOOGLE_SIGNIN_STATE.sesChangeAffectsIt === false);
  check("6-digit code still required after Google",
    GOOGLE_SIGNIN_STATE.codeStepAfterGoogle === true);
  check("google sign-in does not work on the static site",
    GOOGLE_SIGNIN_STATE.worksOnStaticSite === false);
  const contact = validateGoogleContact({ googleEmail: "pro@example.com", googlePhone: "+1 772-555-0100" });
  check("professional's own google contact validates", contact.ok === true);
  check("invalid google email rejected",
    validateGoogleContact({ googleEmail: "not-an-email" }).ok === false);

  // --- 3. Document resend: email via SES / 501 when not configured. --
  const emailDown = resendChannelAvailability("email", { emailConfigured: false, supabaseConfigured: true });
  check("email resend without SES -> 501 not_configured",
    emailDown.httpStatus === 501 && emailDown.status === "not_configured");
  const emailUp = resendChannelAvailability("email", { emailConfigured: true, supabaseConfigured: true });
  check("email resend with SES configured -> attempt allowed (200)",
    emailUp.httpStatus === 200 && emailUp.status === "sent");
  const sesMissing = await email.sendEmail({
    to: "client@example.com",
    subject: "smoke test",
    text: "smoke test — no email should be sent",
  });
  check("SES missing env -> email_not_configured, no network call",
    !sesMissing.ok && sesMissing.code === "email_not_configured");
  check("isEmailConfigured false when SES keys missing", email.isEmailConfigured() === false);
  // Fake SES keys -> the SES endpoint rejects them; never success.
  process.env.AWS_ACCESS_KEY_ID = "<redacted>";
  process.env.AWS_SECRET_ACCESS_KEY = "fakefakefakefakefakefakefakefakefakefake";
  check("isEmailConfigured true with fake keys", email.isEmailConfigured() === true);
  const sesFake = await email.sendEmail({
    to: "client@example.com",
    subject: "smoke test",
    text: "smoke test — fake credentials, must be rejected",
  });
  check("fake SES key -> rejected, never success, never email_not_configured",
    sesFake.ok === false &&
    ["ses_rejected", "ses_unreachable", "sender_not_verified", "recipient_not_verified"].includes(sesFake.code));
  console.log(`  (fake-key SES rejection code: ${sesFake.code})`);
  process.env.AWS_ACCESS_KEY_ID = "";
  process.env.AWS_SECRET_ACCESS_KEY = "";

  // Subject + identifier guards.
  check("resend subject is form label only",
    buildResendEmailSubject("I-130 form") === "Immigration with NIPTEI — your I-130 form document");
  check("A-Number detected in payload", containsSensitiveIdentifier("my A-123456789") === true);
  check("SSN detected in payload", containsSensitiveIdentifier("123-45-6789") === true);
  check("plain note has no identifier", containsSensitiveIdentifier("Your document is ready.") === false);
  const badReq = validateResendRequest({
    documentId: FAKE_UUID, caseId: FAKE_UUID_2, channel: "email",
    senderId: FAKE_UUID, senderRole: "preparer",
    recipientEmail: "client@example.com", note: "A-123456789",
  });
  check("resend request with an A-Number is rejected",
    badReq !== null && badReq.includes("A-Number"));
  const clientReq = validateResendRequest({
    documentId: FAKE_UUID, caseId: FAKE_UUID_2, channel: "email",
    senderId: FAKE_UUID, senderRole: "client",
    recipientEmail: "client@example.com",
  });
  check("a client may not resend a document (professionals only)", clientReq !== null);
  check("recipient email is masked for display",
    maskRecipient("jane@example.com") === "j•••@example.com");
  check("recipient phone is masked to last 4 only",
    maskRecipient("+1 772-555-0199") === "••• ••• 0199");
  check("vault share link shape",
    vaultShareLink("tok-123").startsWith("https://immigration.niptei.com/vault/shared/"));
  const logRow = buildResendLogRow({
    input: {
      documentId: FAKE_UUID, caseId: FAKE_UUID_2, channel: "sms",
      senderId: FAKE_UUID, senderRole: "preparer", recipientPhone: "+1 772-555-0199",
    },
    status: "not_configured", provider: "twilio_byo",
    errorMessage: "SMS not configured",
  });
  check("resend log row carries status + provider, no body column",
    logRow.status === "not_configured" && logRow.provider === "twilio_byo" &&
    !("body" in logRow) && !("subject" in logRow));

  // --- 4. SMS resend: 501 / not_configured, no Twilio. ---------------
  const sms = resendChannelAvailability("sms", { emailConfigured: true, supabaseConfigured: true });
  check("SMS resend -> 501 not_configured even with SES configured",
    sms.httpStatus === 501 && sms.status === "not_configured");
  check("SMS 501 names the missing Twilio envs",
    sms.detail.includes("TWILIO_ACCOUNT_SID") && sms.detail.includes("TWILIO_AUTH_TOKEN"));
  const portalChat = resendChannelAvailability("portal_chat", { emailConfigured: false, supabaseConfigured: false });
  check("in-app resend without Supabase -> 501 not_configured",
    portalChat.httpStatus === 501 && portalChat.status === "not_configured");
  const vaultLink = resendChannelAvailability("vault_link", { emailConfigured: false, supabaseConfigured: true });
  check("vault link resend with Supabase -> allowed (200)",
    vaultLink.httpStatus === 200 && vaultLink.status === "sent");

  // --- 5. Client invites + locked prices. ------------------------------
  const invite = buildClientInvite({ invitedBy: FAKE_UUID, referralCode: "REF123" });
  check("client invite reuses magic link + 6-digit code",
    invite.link.startsWith("https://immigration.niptei.com/guest/") &&
    /^\d{6}$/.test(invite.code) && invite.role === "client" &&
    invite.purpose === "client_onboarding");
  check("client invite carries the referral link",
    invite.referralUrl === "https://immigration.niptei.com/r/REF123");
  const prices = proSubscriptionPrices();
  const priceByRole = new Map(prices.map((p) => [p.role, p.price?.amountCents]));
  check("locked prices unchanged: preparer $49, attorney $99",
    priceByRole.get("Document Preparer") === 4900 && priceByRole.get("Licensed Attorney") === 9900);
  check("locked prices unchanged: DOJ $24.50 / $49.50, student $35",
    priceByRole.get("DOJ Nonprofit — Standard") === 2450 &&
    priceByRole.get("DOJ Nonprofit — Full") === 4950 &&
    priceByRole.get("Law Student (supervised only)") === 3500);
  check("flat price formats as $49.00/mo", formatFlatPrice(prices[0].price) === "$49.00/mo");

  console.log(`\n${passed}/${passed} assertions passed — no email was sent, no professional was invented, no Google product was claimed connected.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
