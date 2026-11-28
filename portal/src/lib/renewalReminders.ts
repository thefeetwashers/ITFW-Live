// Renewal reminder sending — 180/90/30/7-day ladder, via the
// existing reminder_nudges queue (migration 0005) + AWS SES email
// (src/lib/email.ts).
//
// HONESTY RULE: until SES is configured, sendRenewalReminder returns
// email_not_configured and sends NOTHING — the caller (see
// /api/renewals/remind) answers 501 with the list of reminders that
// WOULD have gone out, and never claims any was sent. The 48h repeat
// rule from src/lib/nudges.ts still applies: once a rung is due, the
// reminder repeats every 48h until the renewal is cleared.
//
// PRIVACY: the email subject and body never contain a DOB, A-Number,
// SSN, or passport number — only the renewal kind ("your green card
// renewal"), the date, and the form to file.
//
// SERVER-ONLY: imports src/lib/email.ts (AWS SES client), so no
// client component may import this file.
import { sendEmail, type EmailSendResult } from "./email";
import {
  RENEWAL_FORM_TO_FILE,
  RENEWAL_TYPE_LABEL,
  renewalReminderRungs,
  type RenewalInput,
} from "./renewals";

export interface RenewalReminderDue {
  renewalId: string;
  caseId: string;
  type: RenewalInput["type"];
  typeLabel: string;
  formToFile: string;
  expiryDate: string;
  daysUntilDue: number;
  rungDays: number;
}

/**
 * Which (renewal, ladder rung) pairs are due right now. A rung is
 * due when the expiry is that many days away or closer. Pure —
 * used by the API route to say what WOULD be sent, and by the
 * smoke test. No email is sent by this function.
 */
export function renewalRemindersDue(
  renewals: RenewalInput[],
  now: Date = new Date()
): RenewalReminderDue[] {
  const out: RenewalReminderDue[] = [];
  for (const r of renewals) {
    if (r.status === "done") continue;
    const dueDate = new Date(`${r.eligibilityOrExpiryDate}T12:00:00Z`);
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12)
    );
    const daysUntilDue = Math.round(
      (dueDate.getTime() - today.getTime()) / 86_400_000
    );
    for (const rung of renewalReminderRungs(r, now)) {
      out.push({
        renewalId: r.id,
        caseId: r.caseId,
        type: r.type,
        typeLabel: RENEWAL_TYPE_LABEL[r.type],
        formToFile: RENEWAL_FORM_TO_FILE[r.type],
        expiryDate: r.eligibilityOrExpiryDate,
        daysUntilDue,
        rungDays: rung,
      });
    }
  }
  return out.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

/** Reminder email for one due rung. No PII in the subject or body. */
export function buildRenewalReminderEmail(reminder: RenewalReminderDue): {
  subject: string;
  text: string;
} {
  return {
    subject: "Your renewal reminder — Immigration with NIPTEI",
    text:
      `Hello from Immigration with NIPTEI.\n\n` +
      `Reminder: ${reminder.typeLabel} — ${reminder.rungDays} days before the date on file (${reminder.expiryDate}).\n` +
      `Form to file: ${reminder.formToFile}.\n\n` +
      `Open your dashboard to check the renewal and start the filing. ` +
      `If the date on file is wrong, tell your preparer so it can be corrected — no date is ever guessed.\n\n` +
      `Immigration with NIPTEI is a document-preparation service, not a law firm and not affiliated with USCIS. ` +
      `Only a licensed attorney or DOJ-accredited representative gives legal advice (8 CFR 292.1).\n`,
  };
}

/**
 * Send one renewal reminder email via SES. Returns
 * email_not_configured (no network call, nothing sent) while SES
 * is unconfigured — the caller must surface that honestly as 501.
 */
export async function sendRenewalReminder(
  to: string,
  reminder: RenewalReminderDue
): Promise<EmailSendResult> {
  const email = buildRenewalReminderEmail(reminder);
  return sendEmail({ to, subject: email.subject, text: email.text });
}
