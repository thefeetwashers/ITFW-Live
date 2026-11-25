// Automatic SMS / WhatsApp nudges (Founder check #3)
// LOGIC + QUEUE ONLY. Twilio is NOT connected, so nothing is actually
// sent by this code. Label in the UI: "Nudge logic ready — sending
// needs Twilio." A nudge is due every 48h while a Priority Action Item
// is open, and stops the moment the item is cleared. It respects the
// client's notification preference: sms/whatsapp only when the client
// chose sms or all.
export type NotificationPreference = "in_app" | "email" | "sms" | "all";
export type NudgeChannel = "sms" | "whatsapp";
export type NudgeStatus = "scheduled" | "sent" | "stopped_cleared" | "stopped_opted_out";

export const NUDGE_INTERVAL_HOURS = 48;

export interface Nudge {
  id: string;
  caseId: string;
  actionItemId: string;
  channel: NudgeChannel;
  nextDueAt: string; // ISO
  lastSentAt: string | null;
  status: NudgeStatus;
}

export function nextNudgeDue(lastSentAt: string | null, createdAt: string): string {
  const base = lastSentAt ? new Date(lastSentAt) : new Date(createdAt);
  return new Date(base.getTime() + NUDGE_INTERVAL_HOURS * 3600_000).toISOString();
}

export function shouldNudge(args: {
  actionItemCleared: boolean;
  notificationPreference: NotificationPreference;
  optedOutSms: boolean;
  now?: Date;
  nextDueAt: string;
}): { due: boolean; reason: string } {
  if (args.actionItemCleared)
    return { due: false, reason: "Stopped — action item cleared." };
  if (args.optedOutSms)
    return { due: false, reason: "Stopped — client opted out of SMS." };
  if (
    args.notificationPreference !== "sms" &&
    args.notificationPreference !== "all"
  )
    return {
      due: false,
      reason: "Not sent by SMS — client chose in-app/email only.",
    };
  const now = args.now ?? new Date();
  if (now < new Date(args.nextDueAt))
    return { due: false, reason: "Not due yet — next nudge in under 48h." };
  return { due: true, reason: "Due — 48h since the last nudge, item still open." };
}

export const EXAMPLE_NUDGE: Nudge = {
  id: "nudge-1",
  caseId: "example-case-i130",
  actionItemId: "action-bank",
  channel: "sms",
  nextDueAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
  lastSentAt: null,
  status: "scheduled",
};
