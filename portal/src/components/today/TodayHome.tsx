// TodayHome — the daily home screen sections (Nov 28, 2026).
//
// Presentational only: it renders a DailyHomePayload from /api/today.
// Every section has an HONEST EMPTY STATE — when the payload has no
// cases, no reminders, no changes, or no saved things, the section says
// so plainly instead of inventing content. No live USCIS status is ever
// shown: statuses are labelled "as recorded in your file".
//
// What this screen never does:
//   * It never claims USCIS or any government body adopted or endorsed
//     the platform. Immigration with NIPTEI is a document-preparation
//     service, not a law firm and not affiliated with USCIS.
//   * It never shows a DOB, A-Number, SSN, or passport number.
//   * It never promises a date: the timeline shows when a stage was
//     recorded and what is next, never when it will happen.
import Link from "next/link";
import type { DailyHomePayload } from "@/lib/dailyHome";
import { LIVE_FEED_NOTICE } from "@/lib/dailyNews";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
      {children}
    </p>
  );
}

export default function TodayHome({
  payload,
  onCheckin,
  checkinBusy,
  checkinNote,
}: {
  payload: DailyHomePayload;
  onCheckin: () => void;
  checkinBusy: boolean;
  checkinNote: string | null;
}) {
  const today = new Date(`${payload.todayIso}T12:00:00Z`).toLocaleDateString(
    "en-US",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" }
  );
  return (
    <div>
      <header>
        <h1 className="text-2xl font-bold">Today — {today}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your cases, your next step, and what changed today — in one place.
          Immigration with NIPTEI is a document-preparation service, not a
          law firm, and not affiliated with USCIS. Only a licensed attorney
          or DOJ-accredited representative gives legal advice.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onCheckin}
            disabled={checkinBusy || payload.checkin.checkedInToday}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {payload.checkin.checkedInToday
              ? "✓ Checked in today"
              : checkinBusy
                ? "Checking in…"
                : "I checked my case today"}
          </button>
          <span className="text-sm text-slate-600">
            {payload.checkin.streakDays > 0
              ? `${payload.checkin.streakDays}-day check-in streak — ${payload.checkin.totalCheckins} day${payload.checkin.totalCheckins === 1 ? "" : "s"} checked in total.`
              : "No check-in streak yet — tap the button once a day and your streak grows."}
          </span>
          {checkinNote ? (
            <span className="text-sm text-amber-800">{checkinNote}</span>
          ) : null}
        </div>
      </header>

      {/* 1. Case status at a glance + today's next step */}
      <Section title="Your cases — at a glance">
        {payload.emptyStates.noCases ? (
          <EmptyNote>
            No cases on file yet. Nothing has been filed with USCIS and no
            case status exists — because there is no case yet.{" "}
            <Link href="/portal/questionnaire" className="font-semibold text-blue-700 underline">
              Start the questionnaire →
            </Link>{" "}
            or{" "}
            <Link href="/portal" className="font-semibold text-blue-700 underline">
              open the Client Portal →
            </Link>
          </EmptyNote>
        ) : (
          <ul className="space-y-3">
            {payload.cases.map((c) => (
              <li key={c.caseId} className="rounded border border-slate-200 p-3">
                <p className="text-sm font-semibold">
                  {c.forms.length > 0 ? c.forms.join(", ") : "Case"} — {c.statusLabel}
                </p>
                {c.stageLabel ? (
                  <p className="mt-1 text-sm text-slate-600">{c.stageLabel}</p>
                ) : (
                  <p className="mt-1 text-sm text-slate-600">
                    No stage recorded yet — your provider records each stage change as your case moves.
                  </p>
                )}
                {c.recordedAgencyStatus ? (
                  <p className="mt-1 text-sm text-slate-600">
                    Agency status as recorded in your file
                    {c.recordedAgencyStatusAt ? ` (${c.recordedAgencyStatusAt.slice(0, 10)})` : ""}:{" "}
                    {c.recordedAgencyStatus} — entered by your provider from a USCIS or NVC letter, not a live lookup.
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-slate-500">{c.statusNote}</p>
                <div className="mt-2 rounded bg-slate-50 p-2">
                  <p className="text-sm font-semibold">Today&apos;s next step: {c.nextStep.title}</p>
                  <p className="mt-1 text-sm text-slate-700">{c.nextStep.detail}</p>
                  <p className="mt-1 text-sm text-slate-700">
                    <span className="font-semibold">By when:</span> {c.nextStep.byWhen}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    <span className="font-semibold">After that:</span> {c.nextStep.after}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {payload.unreadMessages > 0 ? (
          <p className="mt-2 text-sm font-semibold text-blue-800">
            {payload.unreadMessages} unread message{payload.unreadMessages === 1 ? "" : "s"} from your provider.{" "}
            <Link href="/portal" className="underline">Open the portal to read them →</Link>
          </p>
        ) : null}
      </Section>

      {/* 2. What changed today */}
      <Section title="What changed today">
        {payload.emptyStates.noChanges ? (
          <EmptyNote>{payload.whatChanged.emptyMessage}</EmptyNote>
        ) : (
          <ul className="space-y-2">
            {payload.whatChanged.events.map((e) => (
              <li key={e.id} className="rounded border border-slate-200 p-3 text-sm">
                <p className="font-semibold">{e.label}</p>
                {e.detail ? <p className="mt-1 text-slate-600">{e.detail}</p> : null}
                <p className="mt-1 text-xs text-slate-500">
                  {e.at.slice(0, 10)} · {e.kind}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 3. Reminders */}
      <Section title="Reminders — renewals & deadlines">
        {payload.emptyStates.noReminders ? (
          <EmptyNote>
            No reminders today. No renewal date, RFE deadline, or document
            retake is on file for your cases. A reminder appears here only
            when a real date or a real request exists — nothing is guessed.
          </EmptyNote>
        ) : (
          <ul className="space-y-2">
            {payload.reminders.map((r, i) => (
              <li key={`${r.kind}-${r.caseId}-${i}`} className="rounded border border-slate-200 p-3 text-sm">
                <p className="font-semibold">
                  {r.urgency === "overdue" ? "[Overdue] " : r.urgency === "due_soon" ? "[Due soon] " : ""}
                  {r.title}
                </p>
                <p className="mt-1 text-slate-600">{r.detail}</p>
                {r.dueDate ? (
                  <p className="mt-1 text-xs text-slate-500">Due: {r.dueDate}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 4. Question of the day */}
      <Section title="Interview question of the day">
        {payload.questionOfTheDay ? (
          <div>
            <p className="text-sm font-semibold">{payload.questionOfTheDay.question.question}</p>
            {payload.questionOfTheDay.question.answer ? (
              <p className="mt-2 text-sm text-slate-700">
                <span className="font-semibold">Answer:</span> {payload.questionOfTheDay.question.answer}
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-700">
                There is no single correct answer — the officer wants YOUR true answer, consistent with your application.
              </p>
            )}
            <p className="mt-2 text-xs text-slate-500">
              {payload.questionOfTheDay.kindLabel}
              <br />
              Source: {payload.questionOfTheDay.question.source.label} —{" "}
              <a
                href={payload.questionOfTheDay.question.source.url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 underline"
              >
                {payload.questionOfTheDay.question.source.url}
              </a>
              <br />
              {payload.questionOfTheDay.question.source.basedOn}
            </p>
            <p className="mt-2 text-sm">
              <Link href="/interview-prep" className="font-semibold text-blue-700 underline">
                Practice the full question banks →
              </Link>
            </p>
          </div>
        ) : (
          <EmptyNote>
            {payload.questionLockNote ??
              "Sign in to see today's interview question."}{" "}
            <Link href="/interview-prep" className="font-semibold text-blue-700 underline">
              Interview Preparation →
            </Link>
          </EmptyNote>
        )}
      </Section>

      {/* 5. Today's immigration news */}
      <Section title="Today's immigration news">
        <p className="text-xs text-slate-500">{payload.newsNote || LIVE_FEED_NOTICE}</p>
        <ul className="mt-2 space-y-2">
          {payload.news.map((n) => (
            <li key={n.id} className="rounded border border-slate-200 p-3 text-sm">
              <p className="font-semibold">{n.title}</p>
              <p className="mt-1 text-slate-600">{n.summary}</p>
              <p className="mt-1 text-xs text-slate-500">
                {n.publishedDate} · Source: {n.sourceLabel} —{" "}
                <a href={n.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                  {n.sourceUrl}
                </a>
              </p>
            </li>
          ))}
        </ul>
      </Section>

      {/* 6. Case timelines */}
      <Section title="Your case timelines — check every day">
        {payload.timelines.length === 0 ? (
          <EmptyNote>
            No timeline yet — timelines appear here once you have a case.
            Each stage is shown only when your provider records it; no date
            is ever promised.
          </EmptyNote>
        ) : (
          <ul className="space-y-4">
            {payload.timelines.map((t) => (
              <li key={t.caseId} className="rounded border border-slate-200 p-3">
                <p className="text-sm font-semibold">
                  Case timeline
                  {t.currentStageNumber ? ` — now at Stage ${t.currentStageNumber}` : " — no stage recorded yet"}
                </p>
                <ol className="mt-2 space-y-1">
                  {t.entries.map((e) => (
                    <li key={e.stageNumber} className="text-sm">
                      <span className="font-semibold">Stage {e.stageNumber} — {e.title}:</span>{" "}
                      {e.state === "current"
                        ? "You are here."
                        : e.state === "done"
                          ? `Done${e.recordedAt ? ` (recorded ${e.recordedAt.slice(0, 10)})` : ""}.`
                          : e.state === "not_recorded"
                            ? "Passed, but no record was kept for this stage."
                            : "Not yet."}
                      {e.subStage ? ` Sub-stage ${e.subStage}.` : ""}
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-sm text-slate-700">
                  <span className="font-semibold">What is next:</span> {t.whatIsNext}
                </p>
                <p className="mt-1 text-sm">
                  <Link href="/journey" className="font-semibold text-blue-700 underline">
                    See the full journey guide →
                  </Link>{" "}
                  ·{" "}
                  <Link href="/portal" className="font-semibold text-blue-700 underline">
                    Open the portal →
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 7. My saved things */}
      <Section title="My saved things — drafts, documents & answers in one place">
        {payload.emptyStates.noSavedThings ? (
          <EmptyNote>
            Nothing saved yet. Your DIY drafts, uploaded documents, and
            questionnaire answers will gather here once you start them —{" "}
            <Link href="/diy" className="font-semibold text-blue-700 underline">
              start a DIY form →
            </Link>{" "}
            or{" "}
            <Link href="/portal/questionnaire" className="font-semibold text-blue-700 underline">
              answer the questionnaire →
            </Link>
          </EmptyNote>
        ) : (
          <div>
            <p className="text-sm text-slate-600">
              {payload.savedThings.counts.drafts} draft{payload.savedThings.counts.drafts === 1 ? "" : "s"} ·{" "}
              {payload.savedThings.counts.documents} document{payload.savedThings.counts.documents === 1 ? "" : "s"} ·{" "}
              {payload.savedThings.counts.questionnaireAnswers} questionnaire answer
              {payload.savedThings.counts.questionnaireAnswers === 1 ? "" : "s"}.
            </p>
            <ul className="mt-2 space-y-2">
              {payload.savedThings.items.map((item, i) => (
                <li key={`${item.kind}-${i}`} className="rounded border border-slate-200 p-3 text-sm">
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-slate-600">{item.detail}</p>
                  {item.downloadLocked && item.lockNote ? (
                    <p className="mt-1 text-amber-800">{item.lockNote}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">
                    Updated {item.updatedAt.slice(0, 10)} ·{" "}
                    <Link href={item.href} className="font-semibold text-blue-700 underline">
                      {item.kind === "draft" ? "Resume →" : item.kind === "document" ? "View in portal →" : "Review answers →"}
                    </Link>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <footer className="mt-8 text-xs text-slate-500">
        <Link href="/client-dashboard" className="text-blue-600 underline">← My Cases</Link>
        {" · "}
        <Link href="/portal" className="text-blue-600 underline">Client Portal</Link>
        {" · "}
        <Link href="/" className="text-blue-600 underline">Home</Link>
        <p className="mt-2">
          Immigration with NIPTEI is a document-preparation service, not a
          law firm, and is not affiliated with USCIS or any government body.
          Nothing on this page is legal advice, and nothing here is filed
          for you — you review and sign before anything is submitted.
        </p>
      </footer>
    </div>
  );
}
