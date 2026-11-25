// Case tools — the "add other things we forgot" layer (Nov 19, 2026).
// Pure types + helpers for the professional's per-case toolkit. All
// data here is EXAMPLE / local state until Supabase is live; the
// matching tables are preparer_case_notes / preparer_case_todos in
// migration 0012 and case_contact_preferences, case_renewals,
// case_referrals, appointment_reminders in migration 0014. There is
// NO case_notes / case_tasks table — do not query one. Messages /
// documents / invoices / appointments themselves already exist
// (migration 0001) and are NOT duplicated here.
//
// Privacy: case notes are provider-only and NEVER shown to the client
// (0012 RLS: assigned provider only — no client, no student, no
// founder). Tasks, renewals and referrals are participant-visible.
export type TaskStatus = "open" | "done" | "overdue";

export interface CaseTask {
  id: string;
  title: string;
  dueAt: string; // ISO date
  status: TaskStatus;
  assignedTo: string;
}

export interface CaseNote {
  id: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

export interface ContactCard {
  preferredLanguage: string;
  timezone: string;
  bestContactTime: string;
  preferredChannel: "Portal Chat" | "SMS" | "WhatsApp" | "Email";
  phoneMasked: string;
  emailMasked: string;
}

export type RenewalKind = "EAD" | "Green Card" | "N-400 eligibility";

export interface RenewalReminder {
  id: string;
  kind: RenewalKind;
  /** Date the client BECOMES eligible (e.g. N-400) or the document expires. */
  eligibilityOrExpiryDate: string;
  /** When to remind the professional — 90 days before by default. */
  remindOn: string;
  status: "upcoming" | "due" | "done";
}

/** N-400 eligibility: 5 years after becoming a lawful permanent
 *  resident (3 years if married to a U.S. citizen — pass the shorter
 *  date in as greenCardDate when it applies; this helper does the
 *  plain date math only and is NOT legal advice about eligibility). */
export function addYears(dateIso: string, years: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

/** Reminder date: 90 days before the eligibility/expiry date. */
export function remind90DaysBefore(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 90);
  return d.toISOString().slice(0, 10);
}

export function n400EligibilityDate(greenCardDate: string, years = 5): string {
  return addYears(greenCardDate, years);
}

export interface DailyCommandItem {
  id: string;
  label: string;
  kind: "deadline" | "overdue" | "new_message" | "new_upload";
  dueAt?: string;
}

/** Daily command view: today's deadlines, overdue items, new messages,
 *  new uploads — computed from the inputs, never hardcoded. */
export function buildDailyCommand(args: {
  todayIso: string;
  deadlines: { id: string; label: string; dueAt: string }[];
  overdue: { id: string; label: string; dueAt: string }[];
  newMessages: { id: string; label: string }[];
  newUploads: { id: string; label: string }[];
}): {
  today: DailyCommandItem[];
  overdue: DailyCommandItem[];
  newMessages: DailyCommandItem[];
  newUploads: DailyCommandItem[];
} {
  return {
    today: args.deadlines
      .filter((d) => d.dueAt === args.todayIso)
      .map((d) => ({ id: d.id, label: d.label, kind: "deadline" as const, dueAt: d.dueAt })),
    overdue: args.overdue.map((d) => ({ id: d.id, label: d.label, kind: "overdue" as const, dueAt: d.dueAt })),
    newMessages: args.newMessages.map((d) => ({ id: d.id, label: d.label, kind: "new_message" as const })),
    newUploads: args.newUploads.map((d) => ({ id: d.id, label: d.label, kind: "new_upload" as const })),
  };
}

/** Appointment reminders: 24h + 1h before the appointment. Calendar
 *  is NOT connected in this build — the UI must label it so. */
export function reminderTimes(startsAtIso: string): { remind24h: string; remind1h: string } {
  const start = new Date(startsAtIso);
  const h24 = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const h1 = new Date(start.getTime() - 60 * 60 * 1000);
  return { remind24h: h24.toISOString(), remind1h: h1.toISOString() };
}
