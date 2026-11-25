// Renewal reminders — derived from REAL case dates only.
// case_renewals exists since migration 0014; migration 0017 widens
// its renewal_type CHECK to the full set below (I-751, TPS and
// passport had no type before). No renewal date is ever invented:
// a reminder exists only when a real expiry/eligibility date was
// entered for that case. Nudges go every 48h once due, in the
// client's language (see src/lib/nudges.ts NUDGE_INTERVAL_HOURS) —
// queued only: Twilio/Resend are NOT connected, so /api/reminders
// returns 501 and nothing is ever claimed sent.
import { NUDGE_INTERVAL_HOURS } from "./nudges";

export type RenewalType =
  | "green_card" // I-90 — 10-year card, file 6 months before expiry
  | "conditional_green_card" // I-751 — 90-day filing window before expiry
  | "ead" // EAD renewal
  | "tps" // TPS / EAD renewal — 180-day window
  | "passport" // Passport expiry
  | "n400"; // N-400 eligibility date

export const RENEWAL_TYPE_LABEL: Record<RenewalType, string> = {
  green_card: "Green Card renewal (Form I-90)",
  conditional_green_card: "Conditional Green Card — remove conditions (Form I-751)",
  ead: "Work permit (EAD) renewal (Form I-765)",
  tps: "TPS renewal (Form I-821 + I-765)",
  passport: "Passport expiry",
  n400: "Citizenship eligibility (Form N-400)",
};

export const RENEWAL_FORM_TO_FILE: Record<RenewalType, string> = {
  green_card: "I-90",
  conditional_green_card: "I-751",
  ead: "I-765",
  tps: "I-821 + I-765",
  passport: "Renew your passport with your country's passport office",
  n400: "N-400",
};

/** Days before the expiry/eligibility date the reminder window opens. */
export const RENEWAL_WINDOW_DAYS: Record<RenewalType, number> = {
  green_card: 180, // 6 months before expiry
  conditional_green_card: 90, // 90-day filing window
  ead: 180, // 180-day renewal window
  tps: 180, // 180-day renewal window
  passport: 180, // 6 months before expiry — check your travel plans
  n400: 90, // eligibility date — file from this date, not before
};

export type RenewalStatus = "upcoming" | "due" | "done";

export interface RenewalInput {
  id: string;
  caseId: string;
  type: RenewalType;
  /** Real expiry / eligibility date, entered by the professional or client. */
  eligibilityOrExpiryDate: string; // YYYY-MM-DD
  status: RenewalStatus;
  language?: string;
  lastNudgedAt?: string | null;
}

export interface RenewalDerived extends RenewalInput {
  remindOn: string; // YYYY-MM-DD — window opens
  daysUntilDue: number;
  isDue: boolean;
  nextNudgeAt: string | null; // ISO — 48h after last nudge, once due
}

function addDays(isoDate: string, days: number): Date {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Derive remind-on / due / next-nudge from the real date. Never invents a date. */
export function deriveRenewal(
  input: RenewalInput,
  now: Date = new Date()
): RenewalDerived {
  const remindOn = toDateOnly(
    addDays(input.eligibilityOrExpiryDate, -RENEWAL_WINDOW_DAYS[input.type])
  );
  const dueDate = new Date(`${input.eligibilityOrExpiryDate}T12:00:00Z`);
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12)
  );
  const daysUntilDue = Math.round(
    (dueDate.getTime() - today.getTime()) / 86_400_000
  );
  const isDue =
    input.status !== "done" && today >= new Date(`${remindOn}T12:00:00Z`);
  const nextNudgeAt =
    isDue && input.status !== "done"
      ? new Date(
          (input.lastNudgedAt
            ? new Date(input.lastNudgedAt)
            : new Date(`${remindOn}T12:00:00Z`)
          ).getTime() +
            NUDGE_INTERVAL_HOURS * 3_600_000
        ).toISOString()
      : null;
  return { ...input, remindOn, daysUntilDue, isDue, nextNudgeAt };
}

export function deriveRenewals(
  inputs: RenewalInput[],
  now: Date = new Date()
): RenewalDerived[] {
  return inputs
    .map((r) => deriveRenewal(r, now))
    .sort((a, b) => a.eligibilityOrExpiryDate.localeCompare(b.eligibilityOrExpiryDate));
}
