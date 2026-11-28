// Dashboard embeds — retrofit (Nov 28, 2026).
// The earlier additions lived only on separate pages. Their key
// surfaces are embedded here as live dashboard summaries: the
// summary itself (counts, next step, soonest deadline) is ON the
// dashboard, with a link to the full page. No logic is duplicated —
// every section reuses the existing lib or route it summarises.
// All counts come from real rows only; with nothing on file each
// section shows its honest empty state, never invented rows.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { questionOfTheDay } from "@/lib/dailyHome";
import { BUILT_IN_NEWS, LIVE_NEWS_FEED_STATUS } from "@/lib/immigrationNews";
import { DIY_FORM_CODES } from "@/lib/diy";
import { PACKET_RESCUE_PRICE_LABEL } from "@/lib/packetRescue";
import type { FamilyMember } from "@/lib/familyCase";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Today / renewal reminders — already live on /today; linked
 *  prominently from every dashboard so nothing is hidden. */
export function TodayRemindersBanner() {
  return (
    <section
      aria-label="Today"
      className="rounded-lg border border-blue-300 bg-blue-50 p-4 shadow-sm"
    >
      <h2 className="text-base font-semibold">Today — your next step &amp; reminders</h2>
      <p className="mt-1 text-sm text-slate-700">
        Your daily home: today&apos;s next step, what changed today,
        renewal reminders, the interview question of the day, and
        today&apos;s immigration news — in one place.
      </p>
      <Link
        href="/today"
        className="mt-3 inline-block rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
      >
        Open Today →
      </Link>
    </section>
  );
}

/** Lead generator + pipeline summary (professional dashboards).
 *  Loads live counts from GET /api/dashboard-summary, which resolves
 *  the caller's own account server-side and counts only that
 *  provider's rows; with no session or no connection it says so and
 *  links to the full pages instead of inventing counts. */
export function LeadsPipelineSummary({ role }: { role: "preparer" | "attorney" | "doj" }) {
  const [state, setState] = useState<
    | { kind: "checking" }
    | { kind: "unavailable"; reason: string }
    | {
        kind: "ready";
        leadCount: number;
        newLeads: number;
        followUpsDue: number;
        pipelineCount: number;
        pipelineByStage: Record<string, number>;
      }
  >({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const sb = getSupabase();
      if (!sb) {
        if (!cancelled)
          setState({
            kind: "unavailable",
            reason:
              "Supabase is not connected in this build, so live lead and pipeline counts cannot be loaded yet.",
          });
        return;
      }
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        if (!cancelled)
          setState({
            kind: "unavailable",
            reason: "Sign in to load your live leads and pipeline.",
          });
        return;
      }
      try {
        const res = await fetch(`/api/dashboard-summary?role=${role}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json().catch(() => ({}))) as {
          leadCount?: number;
          newLeads?: number;
          followUpsDue?: number;
          pipelineCount?: number;
          pipelineByStage?: Record<string, number>;
          error?: string;
        };
        if (!res.ok) {
          if (!cancelled)
            setState({
              kind: "unavailable",
              reason:
                body.error ?? "Your leads and pipeline could not be loaded right now.",
            });
          return;
        }
        if (!cancelled)
          setState({
            kind: "ready",
            leadCount: body.leadCount ?? 0,
            newLeads: body.newLeads ?? 0,
            followUpsDue: body.followUpsDue ?? 0,
            pipelineCount: body.pipelineCount ?? 0,
            pipelineByStage: body.pipelineByStage ?? {},
          });
      } catch {
        if (!cancelled)
          setState({
            kind: "unavailable",
            reason: "Your leads and pipeline could not be reached. Check your connection and try again.",
          });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [role]);

  return (
    <Card title="Leads & Pipeline — summary">
      <p className="mt-1 text-sm text-slate-600">
        Your lead generator and client pipeline, at a glance. The full
        lead sheet and pipeline live on their own pages — the counts
        below are live, never invented.
      </p>
      {state.kind === "checking" && (
        <p className="mt-3 text-sm text-slate-600">Loading your leads and pipeline…</p>
      )}
      {state.kind === "unavailable" && (
        <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          {state.reason}
        </p>
      )}
      {state.kind === "ready" && (
        <ul className="mt-3 space-y-1 text-sm">
          <li>
            Leads on file: <strong>{state.leadCount}</strong>
            {state.leadCount === 0
              ? " — no leads yet."
              : ` (${state.newLeads} new, ${state.followUpsDue} follow-up${state.followUpsDue === 1 ? "" : "s"} due).`}
          </li>
          <li>
            Clients in your pipeline: <strong>{state.pipelineCount}</strong>
            {state.pipelineCount === 0 ? " — no clients yet." : ""}
          </li>
          {Object.entries(state.pipelineByStage).map(([stage, n]) => (
            <li key={stage}>
              {stage}: <strong>{n}</strong>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm">
        <Link href="/leads" className="font-semibold text-blue-700 underline">
          Lead Generator →
        </Link>{" "}
        <Link href="/pipeline" className="font-semibold text-blue-700 underline">
          Client Pipeline →
        </Link>
      </p>
    </Card>
  );
}

/** DIY flow entry + progress (client dashboard). Progress comes
 *  from saved drafts when the parent passes them; with no draft on
 *  file the honest empty state shows, plus the locked DIY prices. */
export function DiyProgressSummary({
  drafts,
}: {
  drafts?: { formCode: string; updatedAt: string }[];
}) {
  const list = drafts ?? [];
  return (
    <Card title="Do-it-yourself — your progress">
      <p className="mt-1 text-sm text-slate-600">
        Do it yourself, form by form — $25 per form, or the $99 DIY
        Bundle. {DIY_FORM_CODES.length} forms are available in the DIY
        flow. Your drafts save as you go.
      </p>
      {list.length === 0 ? (
        <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          No DIY draft started yet — pick a form and start. Nothing is
          filed until you choose to file it.
        </p>
      ) : (
        <ul className="mt-3 space-y-1 text-sm">
          {list.map((d) => (
            <li key={`${d.formCode}-${d.updatedAt}`}>
              Form {d.formCode} — draft saved{" "}
              {new Date(d.updatedAt).toLocaleDateString("en-US")}.
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm">
        <Link href="/diy" className="font-semibold text-blue-700 underline">
          Continue the DIY flow →
        </Link>
      </p>
    </Card>
  );
}

/** Interview prep — question of the day + link (client dashboard).
 *  Reuses questionOfTheDay from src/lib/dailyHome (the same question
 *  /today shows). */
export function InterviewQuestionSection() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const qotd = questionOfTheDay(todayIso);
  return (
    <Card title="Interview prep — question of the day">
      <p className="mt-2 text-sm font-semibold">{qotd.question.question}</p>
      <p className="mt-1 text-sm text-slate-600">{qotd.kindLabel}</p>
      <p className="mt-1 text-xs text-slate-500">
        Source: {qotd.question.source.label} —{" "}
        <a href={qotd.question.source.url} className="text-blue-700 underline">
          {qotd.question.source.url}
        </a>
      </p>
      <p className="mt-3 text-sm">
        <Link href="/interview-prep" className="font-semibold text-blue-700 underline">
          Open Interview Preparation →
        </Link>
      </p>
    </Card>
  );
}

/** News alerts (client dashboard) — the built-in sourced posts only;
 *  no live feed is connected, and the section says so. */
export function NewsAlertsSection() {
  return (
    <Card title="Immigration news alerts">
      <p className="mt-1 text-sm text-slate-600">{LIVE_NEWS_FEED_STATUS.note}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {BUILT_IN_NEWS.map((item) => (
          <li key={item.id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-semibold">{item.title}</p>
            <p className="text-slate-600">
              {item.date} — {item.summary}
            </p>
            <p className="text-xs text-slate-500">
              Source:{" "}
              <a href={item.sourceUrl} className="text-blue-700 underline">
                {item.sourceLabel}
              </a>
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm">
        <Link href="/today" className="font-semibold text-blue-700 underline">
          More news on Today →
        </Link>{" "}
        <Link href="/portal" className="font-semibold text-blue-700 underline">
          Visa Bulletin →
        </Link>
      </p>
    </Card>
  );
}

/** Family case summary (client dashboard). Members come from the
 *  family roster when the parent passes them; otherwise the honest
 *  empty state shows. */
export function FamilyCaseSummarySection({
  members,
}: {
  members?: FamilyMember[];
}) {
  const list = members ?? [];
  return (
    <Card title="Your family case">
      {list.length === 0 ? (
        <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          No family members are on your family case yet. Add the people
          filing with you — petitioner, spouse-beneficiary, derivatives —
          and each person sees only the cases they are allowed to see.
        </p>
      ) : (
        <ul className="mt-3 space-y-1 text-sm">
          {list.map((m) => (
            <li key={m.id}>
              {m.fullName} — {m.role}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm">
        <Link href="/family-case" className="font-semibold text-blue-700 underline">
          Open your family case →
        </Link>
      </p>
    </Card>
  );
}

/** Packet Rescue entry (client dashboard) — locked $199 price, what
 *  it fixes, and the link. No audit is run here. */
export function PacketRescueSummarySection() {
  return (
    <Card title="Packet Rescue — is your packet ready to file?">
      <p className="mt-1 text-sm text-slate-600">
        A free packet audit checks your packet against its checklist
        and tells you what is missing or wrong — before USCIS sees it.{" "}
        {PACKET_RESCUE_PRICE_LABEL} covers the fix when the audit finds
        problems. The audit never files anything.
      </p>
      <p className="mt-3 text-sm">
        <Link href="/packet-rescue" className="font-semibold text-blue-700 underline">
          Run the free packet audit →
        </Link>
      </p>
    </Card>
  );
}

/** Case tracker summary (client dashboard). Cases come from the
 *  parent when loaded; otherwise the honest empty state + links. */
export function CaseTrackerSummarySection({
  cases,
}: {
  cases?: { caseId: string; forms: string[]; status: string }[];
}) {
  const list = cases ?? [];
  return (
    <Card title="Case tracker — where your cases stand">
      {list.length === 0 ? (
        <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          No cases are being tracked yet. Your case status, receipt
          numbers, and USCIS / NVC updates appear here once a case is
          on file — nothing is invented while you wait.
        </p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {list.map((c) => (
            <li key={c.caseId} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="font-medium">
                Case {c.caseId.slice(0, 8)}… —{" "}
                {c.forms.length > 0 ? c.forms.join(", ") : "No forms on file"}
              </p>
              <p className="text-slate-600">Status: {c.status}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm">
        <Link href="/portal" className="font-semibold text-blue-700 underline">
          Track in the Client Portal →
        </Link>{" "}
        <Link href="/today" className="font-semibold text-blue-700 underline">
          Today&apos;s status →
        </Link>
      </p>
    </Card>
  );
}
