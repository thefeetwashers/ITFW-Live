// Platform email sender — AWS SES (Simple Email Service).
//
// The platform sender is AWS SES (founder decision, Nov 28, 2026:
// SES is cheaper than Resend — $0.10 per 1,000 emails, no monthly
// fee). Resend is NO LONGER the platform sender — do not re-add it
// as the platform sender. (Professionals may still connect their OWN
// Resend account as a BYO provider; see src/lib/byo.ts.)
//
// Env vars — NAMES ONLY, no values in code:
//   AWS_SES_REGION        sending region, default "us-east-1"
//                         (configurable: set it to the region where
//                         the founder's SES identity lives).
//   AWS_ACCESS_KEY_ID     IAM access key with ses:SendEmail only.
//   AWS_SECRET_ACCESS_KEY IAM secret — server-only, never NEXT_PUBLIC_.
//   EMAIL_FROM            sender address, default updates@niptei.com.
//
// SENDER IS UNVERIFIED until the founder verifies the niptei.com
// domain identity in SES and adds the DKIM DNS records in IONOS.
// Until then SES rejects sends with a verification error and this
// module surfaces code "sender_not_verified" — it NEVER claims
// success. While SES is in sandbox, SES also rejects any recipient
// that is not a verified identity; that surfaces as
// "recipient_not_verified". Neither case is retried here.
//
// SERVER-ONLY: imports @aws-sdk/client-ses, so no client component
// may import this file. Keys are never logged, never returned, and
// never appear in an error message. No email is sent by the smoke
// test (portal/scripts/smoke-ses.ts) — it uses FAKE credentials.
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

export const PLATFORM_SENDER_EMAIL = "updates@niptei.com";
export const DEFAULT_SES_REGION = "us-east-1";

/** Env vars the platform SES sender needs. Region + sender have defaults. */
export const SES_REQUIRED_ENVS = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
] as const;

/** Env vars missing right now (empty when configured). */
export function missingEmailEnvs(): string[] {
  return SES_REQUIRED_ENVS.filter((n) => !process.env[n]?.trim());
}

/** True when the platform SES sender can be attempted. */
export function isEmailConfigured(): boolean {
  return missingEmailEnvs().length === 0;
}

/** The sender address used for platform email. */
export function platformSenderEmail(): string {
  return process.env.EMAIL_FROM?.trim() || PLATFORM_SENDER_EMAIL;
}

/** The SES region used for platform email. */
export function sesRegion(): string {
  return process.env.AWS_SES_REGION?.trim() || DEFAULT_SES_REGION;
}

export type EmailSendResult =
  | { ok: true; messageId: string }
  | {
      ok: false;
      /** Machine-readable reason; safe to return in an API response. */
      code:
        | "email_not_configured"
        | "sender_not_verified"
        | "recipient_not_verified"
        | "ses_rejected"
        | "ses_unreachable";
      error: string;
    };

export type SendEmailArgs = {
  to: string;
  /** No PII and no money amounts in subjects — see callers. */
  subject: string;
  text: string;
  html?: string;
};

/** Classify an SES failure without leaking any credential or key. */
function classifySesError(err: unknown): EmailSendResult {
  const name = err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : "";
  const haystack = `${name} ${message}`.toLowerCase();
  const saysNotVerified = haystack.includes("not verified");
  const aboutSender =
    haystack.includes("mailfromdomainnotverified") ||
    haystack.includes("from address") ||
    haystack.includes("sender") ||
    haystack.includes("identity");
  const aboutRecipient = haystack.includes("recipient");
  if (name === "MailFromDomainNotVerified") {
    return {
      ok: false,
      code: "sender_not_verified",
      error:
        "SES rejected the send — the sender identity is not verified in AWS SES. Verify niptei.com in SES first. No email was sent.",
    };
  }
  if (saysNotVerified && aboutRecipient && !aboutSender) {
    return {
      ok: false,
      code: "recipient_not_verified",
      error:
        "SES is in sandbox mode and the recipient address is not a verified SES identity — verify the recipient in SES or request production access. No email was sent.",
    };
  }
  if (saysNotVerified) {
    return {
      ok: false,
      code: "sender_not_verified",
      error:
        "The sender address is not verified in AWS SES — verify the niptei.com domain identity in SES and add the DKIM DNS records in IONOS before sending. No email was sent.",
    };
  }
  if (name === "MessageRejected") {
    return {
      ok: false,
      code: "ses_rejected",
      error: "AWS SES rejected the email. No email was sent.",
    };
  }
  if (
    err instanceof TypeError ||
    name === "TimeoutError" ||
    name.includes("Network")
  ) {
    return {
      ok: false,
      code: "ses_unreachable",
      error: "Could not reach AWS SES. No email was sent.",
    };
  }
  return {
    ok: false,
    code: "ses_rejected",
    error: `AWS SES refused the email (${name || "unknown error"}). No email was sent.`,
  };
}

/**
 * Send one platform email through AWS SES. Returns email_not_configured
 * (and attempts NO network call) when the SES env vars are missing.
 */
export async function sendEmail(args: SendEmailArgs): Promise<EmailSendResult> {
  const missing = missingEmailEnvs();
  if (missing.length > 0) {
    return {
      ok: false,
      code: "email_not_configured",
      error: `Email sending is not connected (AWS SES not configured — missing: ${missing.join(", ")}), so no email was sent.`,
    };
  }
  const client = new SESClient({
    region: sesRegion(),
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    },
  });
  try {
    const out = await client.send(
      new SendEmailCommand({
        Source: platformSenderEmail(),
        Destination: { ToAddresses: [args.to] },
        Message: {
          Subject: { Data: args.subject, Charset: "UTF-8" },
          Body: {
            Text: { Data: args.text, Charset: "UTF-8" },
            ...(args.html ? { Html: { Data: args.html, Charset: "UTF-8" } } : {}),
          },
        },
      })
    );
    return { ok: true, messageId: out.MessageId ?? "" };
  } catch (err) {
    return classifySesError(err);
  }
}
