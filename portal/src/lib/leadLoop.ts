// Arrival-capture + follow-up + return loop — the honest lead-finding
// flow (ELEVENTH ADDITION, Nov 28, 2026).
//
// THE BOUNDARY — read this first, do not weaken it:
//   The system CANNOT track or identify individual people searching
//   for immigration services online. That would violate privacy, and
//   search engines do not share who searched for what. Anyone who
//   claims the platform "watches searchers" or "finds people searching
//   online" is inventing a capability that does not exist. This file
//   states the boundary in LEAD_BOUNDARY_NOTE, shows it on the lead
//   generator page, and the smoke test asserts it is present.
//
// WHAT THE SYSTEM *CAN* DO — one labelled loop, reusing existing code
// (no second lead system is built here):
//   1. ARRIVE — people find the platform through search engines (the
//      SEO foundation in src/lib/seo.ts) or a referral link
//      (/r/[code], src/lib/referrals.ts) and arrive at a public page.
//   2. CAPTURE — they tell us what they need: the intake form
//      (/leads, src/lib/leads.ts + src/lib/leadScoring.ts — a lead
//      exists only because that person filled in the form), a quote
//      request (/api/quote-requests), the free Packet Health Check
//      (/api/diy/health-check, src/lib/diyHealthCheck.ts), or the
//      interview question of the day (/today, src/lib/dailyHome.ts).
//      Captured leads live in preparer_leads (migration 0010) with a
//      transparent score (migration 0021) — never a bought list, never
//      scraped personal data.
//   3. FOLLOW UP — automatically surfaced reminders from the lead's
//      own follow-up date (src/lib/lifecycle.ts followUpReminders)
//      and the existing follow-up email drafts (/api/pipeline
//      /draft-email, src/lib/draftedEmails.ts), sent through AWS SES
//      (src/lib/email.ts — 501/not_configured when SES is not
//      configured, never a claim of "sent").
//   4. RETURN — the daily home screen (/today) brings clients back
//      every day: today's next step, what changed today, the
//      interview question of the day, and the daily check-in streak
//      (src/lib/dailyHome.ts, migration 0026).
//   5. TELL A FRIEND — every client/professional carries their
//      referral link (src/lib/referrals.ts, REFERRAL_REWARD_LABEL:
//      "to be announced by the founder" — no amount invented), so a
//      happy client brings the next arrival. That closes the loop.
import {
  followUpReminders,
  countLeadsByBucket,
  type FollowUpBucket,
  type Lead,
} from "./lifecycle";
import { REFERRAL_REWARD_LABEL } from "./referrals";

export { REFERRAL_REWARD_LABEL };

/** The honest boundary, shown on the lead generator page and in the
 *  docs. Never reword it into a tracking claim. */
export const LEAD_BOUNDARY_NOTE =
  "How lead-finding honestly works here: this system does NOT track or identify people searching for immigration services online — search engines do not share who searched for what, and watching individual searchers would violate their privacy. What it does do: when someone finds us through a search engine or a friend's referral link and tells us what they need (intake form, quote request, free Packet Health Check, or interview question of the day), we capture that enquiry, follow it up on its follow-up date, and bring them back daily with the Today screen. New clients arrive every day because the last client told a friend — not because anyone was watched.";

export interface ArrivalChannel {
  id: string;
  label: string;
  /** Public entry point. */
  href: string;
  /** What is captured, in plain language. */
  captures: string;
}

/** The four arrival points — every one is an existing page/API. */
export const ARRIVAL_CHANNELS: ArrivalChannel[] = [
  {
    id: "intake",
    label: "Intake form",
    href: "/leads",
    captures: "Name, contact, language, and what help is needed — the lead exists only because the person filled in the form.",
  },
  {
    id: "quote",
    label: "Quote request",
    href: "/leads",
    captures: "Service requested and tier — a written quote with the preparation fee and the government fee shown separately.",
  },
  {
    id: "packet_health_check",
    label: "Free Packet Health Check",
    href: "/diy",
    captures: "Packet readiness from the client's own checklist — the free audit never unlocks the paid fix by itself.",
  },
  {
    id: "interview_question",
    label: "Interview question of the day",
    href: "/today",
    captures: "A daily reason to come back — one interview question a day, from the existing question banks, with the source labelled.",
  },
];

export interface LeadLoopStep {
  step: number;
  title: string;
  detail: string;
  /** Existing code this step reuses — never a new system. */
  reuses: string;
}

/** The loop as one labelled flow: arrive → capture → follow up →
 *  return → tell a friend (which brings the next arrival). */
export function leadLoopSteps(): LeadLoopStep[] {
  return [
    {
      step: 1,
      title: "Arrive — found through search or a friend",
      detail:
        "People find the platform through Google, Yahoo, Bing, or another search engine (SEO foundation), or through a friend's referral link. The system never watches who searched.",
      reuses: "src/lib/seo.ts (sitemap + landing pages) + src/lib/referrals.ts (/r/[code])",
    },
    {
      step: 2,
      title: "Capture — they tell us what they need",
      detail:
        "Intake form, quote request, free Packet Health Check, or interview question of the day. The enquiry is stored in preparer_leads with a transparent lead score and its reasons.",
      reuses: "src/lib/leads.ts + src/lib/leadScoring.ts + migration 0010/0021",
    },
    {
      step: 3,
      title: "Follow up — on the follow-up date, automatically surfaced",
      detail:
        "Overdue / due today / upcoming reminders from each lead's own follow-up date, plus drafted follow-up emails sent through AWS SES (501/not_configured when SES is not configured — never a claim of sent).",
      reuses: "src/lib/lifecycle.ts followUpReminders + /api/pipeline/draft-email + src/lib/email.ts (SES)",
    },
    {
      step: 4,
      title: "Return — the Today screen brings them back daily",
      detail:
        "Today's next step, what changed today, the interview question of the day, and the daily check-in streak. A client who comes back every day is a client who finishes their case.",
      reuses: "src/lib/dailyHome.ts + /today + migration 0026 (daily_checkins)",
    },
    {
      step: 5,
      title: "Tell a friend — the loop closes itself",
      detail:
        "Every client and professional carries their referral link on their dashboard. Reward: to be announced by the founder — no amount is invented. A referred friend arrives at step 1.",
      reuses: "src/lib/referrals.ts (REFERRAL_REWARD_LABEL) + ReferralCard on the client and professional dashboards",
    },
  ];
}

export interface LeadLoopSummary {
  totalLeads: number;
  byBucket: { id: string; label: string; count: number }[];
  followUps: { leadId: string; bucket: FollowUpBucket; daysOverdue: number }[];
  overdueCount: number;
  dueTodayCount: number;
  upcomingCount: number;
  /** Honest empty state when there are no leads at all. */
  emptyState: string | null;
}

/** Summarise the loop for real stored leads only. With no leads the
 *  counts are 0 and the empty state is returned — never invented. */
export function summarizeLeadLoop(leads: Lead[], todayIso?: string): LeadLoopSummary {
  const reminders = followUpReminders(leads, todayIso);
  return {
    totalLeads: leads.length,
    byBucket: countLeadsByBucket(leads),
    followUps: reminders.map((r) => ({
      leadId: r.lead.id,
      bucket: r.bucket,
      daysOverdue: r.daysOverdue,
    })),
    overdueCount: reminders.filter((r) => r.bucket === "overdue").length,
    dueTodayCount: reminders.filter((r) => r.bucket === "due_today").length,
    upcomingCount: reminders.filter((r) => r.bucket === "upcoming").length,
    emptyState:
      leads.length === 0
        ? "No leads yet. A lead appears here only when a real person fills in the intake form, asks for a quote, or is entered by a preparer from a real enquiry — never from a bought list or from watching searchers."
        : null,
  };
}
