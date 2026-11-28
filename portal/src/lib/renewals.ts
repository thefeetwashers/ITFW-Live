// Renewal reminders — derived from REAL case dates only.
// case_renewals exists since migration 0014; migration 0017 widens
// its renewal_type CHECK to the full set below (I-751, TPS and
// passport had no type before); migration 0029 adds advance_parole
// (I-131 renewal) and visa (visa expiry) to that CHECK. No renewal
// date is ever invented: a reminder exists only when a real
// expiry/eligibility date was entered for that case. Nudges go every
// 48h once due, in the client's language (see src/lib/nudges.ts
// NUDGE_INTERVAL_HOURS) — queued only: Twilio/AWS SES are NOT
// connected, so /api/reminders returns 501 and nothing is ever
// claimed sent. The 180/90/30/7-day reminder ladder below is the
// schedule those nudges follow: a rung is "due" when the expiry is
// that many days away or closer (see renewalReminderRungs).
import { NUDGE_INTERVAL_HOURS } from "./nudges";
import { getLockedPriceByKey } from "./stripePrices";

export type RenewalType =
  | "green_card" // I-90 — 10-year card, file 6 months before expiry
  | "conditional_green_card" // I-751 — 90-day filing window before expiry
  | "ead" // EAD renewal
  | "tps" // TPS / EAD renewal — 180-day window
  | "passport" // Passport expiry
  | "advance_parole" // Advance parole / travel document renewal (I-131)
  | "visa" // Visa expiry
  | "n400"; // N-400 eligibility date

export const RENEWAL_TYPE_LABEL: Record<RenewalType, string> = {
  green_card: "Green Card renewal (Form I-90)",
  conditional_green_card: "Conditional Green Card — remove conditions (Form I-751)",
  ead: "Work permit (EAD) renewal (Form I-765)",
  tps: "TPS renewal (Form I-821 + I-765)",
  passport: "Passport expiry",
  advance_parole: "Advance parole / travel document renewal (Form I-131)",
  visa: "Visa expiry",
  n400: "Citizenship eligibility (Form N-400)",
};

export const RENEWAL_FORM_TO_FILE: Record<RenewalType, string> = {
  green_card: "I-90",
  conditional_green_card: "I-751",
  ead: "I-765",
  tps: "I-821 + I-765",
  passport: "Renew your passport with your country's passport office",
  advance_parole: "I-131",
  visa: "Check your visa stamp / status with your preparer or attorney — a visa expiry is not renewed by filing a USCIS form",
  n400: "N-400",
};

/** Days before the expiry/eligibility date the reminder window opens. */
export const RENEWAL_WINDOW_DAYS: Record<RenewalType, number> = {
  green_card: 180, // 6 months before expiry
  conditional_green_card: 90, // 90-day filing window
  ead: 180, // 180-day renewal window
  tps: 180, // 180-day renewal window
  passport: 180, // 6 months before expiry — check your travel plans
  advance_parole: 180, // file the I-131 renewal well before the travel document expires
  visa: 180, // 6 months before expiry — check travel / status plans
  n400: 90, // eligibility date — file from this date, not before
};

/**
 * Reminder ladder (days before expiry): a reminder is due at 180,
 * 90, 30 and 7 days before the date. A rung fires once — when the
 * date is that many days away or closer — and the 48h nudge queue
 * (reminder_nudges, migration 0005) repeats it until cleared.
 */
export const RENEWAL_REMINDER_LADDER_DAYS: readonly number[] = [180, 90, 30, 7];

/** Locked Basic preparation price for the renewal form, where one
 *  exists in src/lib/stripePrices.ts. Null = no locked prep price
 *  for this renewal (passport: renew with the passport office;
 *  visa: no USCIS renewal form; TPS: priced per form, see I-821). */
export const RENEWAL_PREP_PRICE_KEY: Record<RenewalType, string | null> = {
  green_card: "i-90_basic",
  conditional_green_card: "i-751_basic",
  ead: "i-765_basic",
  tps: "i-821_basic",
  passport: null,
  advance_parole: "i-131_basic",
  visa: null,
  n400: "n-400_basic",
};

export function renewalPrepPrice(type: RenewalType): {
  label: string;
  amountCents: number;
} | null {
  const key = RENEWAL_PREP_PRICE_KEY[type];
  if (!key) return null;
  const price = getLockedPriceByKey(key);
  if (!price) return null;
  return { label: price.label, amountCents: price.amountCents };
}

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
  /** Ladder rungs (180/90/30/7) already reached for this renewal. */
  reminderRungsDue: number[];
  /** Soonest rung reached (180 first), or null when no rung is due. */
  soonestRungDue: number | null;
}

function addDays(isoDate: string, days: number): Date {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Ladder rungs reached for a renewal: every rung whose day-count
 *  is >= the days left until the date (a rung fires when the date is
 *  that many days away or closer). Done renewals and dates more than
 *  180 days out have no rung due. Pure — no date is invented. */
export function renewalReminderRungs(
  input: Pick<RenewalInput, "eligibilityOrExpiryDate" | "status">,
  now: Date = new Date()
): number[] {
  if (input.status === "done") return [];
  const dueDate = new Date(`${input.eligibilityOrExpiryDate}T12:00:00Z`);
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12)
  );
  const daysUntilDue = Math.round(
    (dueDate.getTime() - today.getTime()) / 86_400_000
  );
  if (daysUntilDue < 0) return [...RENEWAL_REMINDER_LADDER_DAYS];
  return RENEWAL_REMINDER_LADDER_DAYS.filter((rung) => daysUntilDue <= rung);
}
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
  const reminderRungsDue = renewalReminderRungs(input, now);
  return {
    ...input,
    remindOn,
    daysUntilDue,
    isDue,
    nextNudgeAt,
    reminderRungsDue,
    soonestRungDue: reminderRungsDue.length > 0 ? reminderRungsDue[0] : null,
  };
}

export function deriveRenewals(
  inputs: RenewalInput[],
  now: Date = new Date()
): RenewalDerived[] {
  return inputs
    .map((r) => deriveRenewal(r, now))
    .sort((a, b) => a.eligibilityOrExpiryDate.localeCompare(b.eligibilityOrExpiryDate));
}
