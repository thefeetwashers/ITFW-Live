// Final expert sweep — shared pure logic (Nov 28, 2026).
//
// Founder's final charge: the dashboard must be breathtaking and make
// every profession's job easy, with a powerful client intake — "do not
// leave anything behind". This file is the single source of truth for
// the sweep's order, boundaries, and honest derivations, so the smoke
// test (scripts/smoke-final-sweep.ts) can prove them without a browser:
//
//   1. DASHBOARD ORDER — every role dashboard shows, in this order:
//      next step FIRST, then the colour-coded checklist, then one-click
//      actions, then deadlines, then the notification inbox. Payment,
//      pipeline, chat, news and interview prep follow — they are
//      already built and are linked, not rebuilt, from DashboardTop.
//   2. INTAKE SEQUENCE — one guided sequence, free until the pay step:
//      Path Finder -> fee estimate -> checklist preview (first 2 free)
//      -> register -> pay -> case created. Nothing is invented: the
//      Path Finder questions and the fee estimate are the existing
//      SmartIntakeCalculator (lib/intakeCalculator.ts), the preview
//      items are the existing form-checklist templates
//      (lib/formChecklists.ts), register is /register, pay is the
//      existing Stripe checkout, and the case lands in /portal + /today.
//   3. NOTIFICATION INBOX — one place for every status / email /
//      message event, built ONLY from stored rows: notification_logs
//      (migration 0010) + messages (migration 0001). Message bodies
//      are NEVER copied into the inbox (same rule as the /today feed);
//      the inbox shows who, which channel, which stage, and when.
//   4. DEADLINE COUNTDOWN — computed from stored dates only
//      (RFE / NOID / interview / biometrics), via daysUntil
//      (lib/shipments.ts). No date is ever invented.
//   5. COLOURS — this file does NOT redefine the palette. The exact
//      colour meanings live in lib/nextStepEngine.ts (DOC_COLOURS) and
//      are reused by ColourChecklist; see the smoke test for proof.
//
// Nothing here calls Supabase, Stripe, SES, Twilio, or USCIS. Nothing
// here decides relief / eligibility / evidence strength / safe-to-leave.
// No DOB / A-Number / SSN / passport number is read, logged, or
// returned anywhere in this file.
import { daysUntil } from "./shipments";

// ---------------------------------------------------------------------------
// 1. Dashboard section order — next step first, no clutter.
// ---------------------------------------------------------------------------
export const DASHBOARD_SECTION_ORDER = [
  "next_step",
  "checklist",
  "one_click_actions",
  "deadlines",
  "notifications",
  "payment",
  "pipeline",
  "chat",
  "news",
  "interview_prep",
] as const;

export type DashboardSection = (typeof DASHBOARD_SECTION_ORDER)[number];

/** The first section of every role dashboard. Proved by the smoke test. */
export function firstDashboardSection(): DashboardSection {
  return DASHBOARD_SECTION_ORDER[0];
}

// ---------------------------------------------------------------------------
// 2. Guided intake sequence — free until the pay step.
// ---------------------------------------------------------------------------
export interface IntakeStep {
  id: string;
  title: string;
  detail: string;
  /** "free" steps cost nothing; "paid" steps need a DB-confirmed payment. */
  cost: "free" | "paid";
  href: string;
  hrefLabel: string;
}

export const INTAKE_STEPS: IntakeStep[] = [
  {
    id: "pathfinder",
    title: "1. Find your path — Path Finder questions",
    detail:
      "Answer the Path Finder questions (goal, where the beneficiary is, filing method). Your route — inside the US (adjustment) or outside the US (consular / NVC) — comes from these answers, never guessed.",
    cost: "free",
    href: "/intake#step-calculator",
    hrefLabel: "Answer the Path Finder questions",
  },
  {
    id: "calculator",
    title: "2. Instant fee estimate — Smart Intake Calculator",
    detail:
      "USCIS government fees and our prep fee are shown on separate lines, from the locked fee tables. A combined budgeting total appears only after both subtotals — government fees are paid to USCIS / the Department of State, never to us.",
    cost: "free",
    href: "/intake#step-calculator",
    hrefLabel: "Open the fee calculator",
  },
  {
    id: "checklist_preview",
    title: "3. Document checklist preview — first 2 items free",
    detail:
      "See the first 2 items of your form's document checklist, free. The full checklist is for paid clients only — it unlocks after payment, when your case is created.",
    cost: "free",
    href: "/intake#step-checklist",
    hrefLabel: "Preview the checklist",
  },
  {
    id: "register",
    title: "4. Register — create your account",
    detail:
      "Register with your role (client, preparer, attorney, nonprofit, law student, teacher). Registration itself is free; nothing is charged here.",
    cost: "free",
    href: "/register",
    hrefLabel: "Register",
  },
  {
    id: "pay",
    title: "5. Pay — Stripe checkout (paywall)",
    detail:
      "Pay your bundle or subscription through Stripe checkout. Access is confirmed from the database by the Stripe webhook — never by a front-end flag. Pay-before-access: the full checklist, Smart Forms and Interview Prep stay locked until payment is confirmed.",
    cost: "paid",
    href: "/register",
    hrefLabel: "Pay at registration checkout",
  },
  {
    id: "case_created",
    title: "6. Case created — your workspace opens",
    detail:
      "Your case, invoice and full document checklist open in the Client Portal, with your next step first and your daily home on /today. Save-and-resume: DIY answers are saved as drafts as you go (/diy) and can be resumed later.",
    cost: "paid",
    href: "/portal",
    hrefLabel: "Open the Client Portal",
  },
];

/** Index of the first step that costs money — everything before it is free. */
export const INTAKE_FREE_PAID_BOUNDARY = INTAKE_STEPS.findIndex(
  (s) => s.cost === "paid"
);

/** Free preview of a checklist: the first `freeCount` items, plus how
 *  many stay locked behind payment. Never invents an item. */
export function checklistPreview<T>(items: T[], freeCount = 2): {
  freeItems: T[];
  lockedCount: number;
  total: number;
} {
  return {
    freeItems: items.slice(0, freeCount),
    lockedCount: Math.max(0, items.length - freeCount),
    total: items.length,
  };
}

// ---------------------------------------------------------------------------
// 3. Notification inbox — stored rows only, no message bodies.
// ---------------------------------------------------------------------------
export type InboxEventKind = "notification" | "message";

export interface InboxEvent {
  id: string;
  kind: InboxEventKind;
  /** Short label, e.g. "Stage update — active_drafting (email)" or
   *  "Message — preparer → client". No body, no PII. */
  label: string;
  detail: string;
  channel: string | null;
  status: string | null;
  createdAt: string;
  isRead: boolean | null;
}

export interface NotificationLogRow {
  id: string;
  stage_key: string;
  channel: string;
  status: string;
  created_at: string;
}

export interface MessageRow {
  id: string;
  sender_role: string;
  recipient_role: string;
  is_read: boolean;
  created_at: string;
}

/** Merge stored notification_logs rows + stored messages rows into one
 *  newest-first inbox. Rows with an unparseable date are dropped, never
 *  guessed. Message bodies are never included — see the header. */
export function normalizeInboxEvents(input: {
  logs: NotificationLogRow[];
  messages: MessageRow[];
}): InboxEvent[] {
  const events: InboxEvent[] = [];
  for (const log of input.logs) {
    const t = Date.parse(log.created_at);
    if (Number.isNaN(t)) continue;
    events.push({
      id: `log:${log.id}`,
      kind: "notification",
      label: `Stage update — ${log.stage_key} (${log.channel})`,
      detail:
        log.status === "sent"
          ? "Sent. Recorded in notification_logs."
          : log.status === "not_configured"
            ? "Queued — email/SMS is not configured yet, so nothing was sent."
            : `Delivery status: ${log.status}.`,
      channel: log.channel,
      status: log.status,
      createdAt: log.created_at,
      isRead: null,
    });
  }
  for (const msg of input.messages) {
    const t = Date.parse(msg.created_at);
    if (Number.isNaN(t)) continue;
    events.push({
      id: `msg:${msg.id}`,
      kind: "message",
      label: `Message — ${msg.sender_role} → ${msg.recipient_role}`,
      detail:
        "Open your case messages to read it. Message contents are never copied into this inbox.",
      channel: null,
      status: null,
      createdAt: msg.created_at,
      isRead: msg.is_read,
    });
  }
  events.sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );
  return events;
}

export function unreadInboxCount(events: InboxEvent[]): number {
  return events.filter((e) => e.kind === "message" && e.isRead === false)
    .length;
}

// ---------------------------------------------------------------------------
// 4. Deadline countdown — from stored dates only.
// ---------------------------------------------------------------------------
export type DeadlineState =
  | "overdue"
  | "due_today"
  | "due_soon"
  | "due"
  | "no_date";

export interface DeadlineCountdown {
  days: number | null;
  state: DeadlineState;
  label: string;
}

/** Countdown for one stored deadline date. `dueIso` null/empty means no
 *  date is on file — the UI says so instead of inventing one. "Due
 *  soon" is 14 days or fewer (the RFE/NOID/interview/biometrics
 *  window professionals watch); the count itself is daysUntil. */
export function deadlineCountdown(
  dueIso: string | null | undefined,
  today: Date = new Date()
): DeadlineCountdown {
  if (!dueIso) {
    return { days: null, state: "no_date", label: "No date on file" };
  }
  const days = daysUntil(dueIso, today);
  if (days < 0)
    return {
      days,
      state: "overdue",
      label: `OVERDUE by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`,
    };
  if (days === 0) return { days, state: "due_today", label: "Due today" };
  if (days <= 14)
    return {
      days,
      state: "due_soon",
      label: `Due soon — in ${days} day${days === 1 ? "" : "s"}`,
    };
  return {
    days,
    state: "due",
    label: `Due in ${days} day${days === 1 ? "" : "s"}`,
  };
}

/** RFE / NOID / interview / biometrics — the four deadline kinds the
 *  countdown covers, from the dates on the client's actual notices. */
export const DEADLINE_KINDS = ["rfe", "noid", "interview", "biometrics"] as const;
export type DeadlineKind = (typeof DEADLINE_KINDS)[number];

export const DEADLINE_KIND_LABELS: Record<DeadlineKind, string> = {
  rfe: "RFE deadline",
  noid: "NOID deadline",
  interview: "Interview",
  biometrics: "Biometrics",
};
