// /interview-prep — Interview Preparation (paid content).
//
// The page NEVER imports src/lib/interviewPrep.ts. It fetches the
// question banks from /api/interview-prep, which serves them only
// after a server-side paid-access check. An unpaid visitor sees the
// honest "pay first" state (PaywallLocked) and no question data.
// Video scripts are labelled "Video script — not a finished video"
// on every script — no videos have been produced yet.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import PaywallLocked from "@/components/paywall/PaywallLocked";
import type {
  InterviewBank,
  VideoScript,
  WhatToBringGuide,
} from "@/lib/interviewPrep";

interface InterviewPrepPayload {
  banks: InterviewBank[];
  whatToBring: WhatToBringGuide[];
  conduct: { heading: string; points: string[] };
  whatOfficerLooksFor: { heading: string; points: string[] };
  delayDenialReasons: {
    heading: string;
    intro: string;
    reasons: { reason: string; whatItMeans: string; whatToDo: string }[];
  };
  videoScripts: VideoScript[];
  counts: { total: number; officialCivics: number; practice: number };
  noGuaranteeNotice: string;
}

type LoadState =
  | { kind: "checking" }
  | { kind: "no-session" }
  | { kind: "not-configured" }
  | { kind: "locked"; reason: string; unlockPriceKey: string | null }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: InterviewPrepPayload };

export default function InterviewPrepPage() {
  const [state, setState] = useState<LoadState>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const sb = getSupabase();
      if (!sb) {
        if (!cancelled) setState({ kind: "not-configured" });
        return;
      }
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        if (!cancelled) setState({ kind: "no-session" });
        return;
      }
      try {
        const res = await fetch("/api/interview-prep", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json().catch(() => ({}))) as Partial<InterviewPrepPayload> & {
          error?: string;
          unlockPriceKey?: string | null;
        };
        if (cancelled) return;
        if (res.status === 501) {
          setState({ kind: "not-configured" });
          return;
        }
        if (res.status === 403) {
          setState({
            kind: "locked",
            reason: body.error ?? "Pay first to unlock interview preparation.",
            unlockPriceKey: body.unlockPriceKey ?? "member_monthly",
          });
          return;
        }
        if (!res.ok || !body.banks) {
          setState({
            kind: "error",
            message: body.error ?? `Could not load interview preparation (${res.status}).`,
          });
          return;
        }
        setState({ kind: "ready", data: body as InterviewPrepPayload });
      } catch {
        if (!cancelled) {
          setState({ kind: "error", message: "Could not reach the interview-prep service. Check your connection and try again." });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">Interview Preparation</h1>
        <p className="mt-1 text-sm text-slate-600">
          Mock questions, what to bring, how to conduct yourself, and what
          immigration is looking for — so you know what to expect and how
          to pass your interview to get your green card. Immigration with
          NIPTEI is not USCIS and cannot promise an outcome.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          <Link href="/portal" className="text-blue-700 underline">
            ← Back to the Client Portal
          </Link>
        </p>
      </header>

      {state.kind === "checking" && (
        <p className="mt-6 text-sm text-slate-600">Checking your payment status…</p>
      )}

      {state.kind === "no-session" && (
        <div className="mt-6 space-y-4">
          <p className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Sign in first — interview preparation is paid content, and
            access is checked against the payment records for your account.{" "}
            <Link href="/login" className="font-semibold text-blue-700 underline">
              Sign in →
            </Link>
          </p>
          <PaywallLocked
            surfaceLabel="Interview Preparation"
            unlockPriceKey="member_monthly"
            reason="Pay first to unlock interview preparation — Member $9.80/mo, or any paid bundle. Nothing is shown until your payment is confirmed in our records."
          />
        </div>
      )}

      {state.kind === "not-configured" && (
        <p className="mt-6 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Payment records are not connected yet, so your payment status
          cannot be verified. Nothing is unlocked until they are connected
          and your payment is confirmed.
        </p>
      )}

      {state.kind === "locked" && (
        <div className="mt-6">
          <PaywallLocked
            surfaceLabel="Interview Preparation"
            unlockPriceKey={state.unlockPriceKey}
            reason={state.reason}
          />
        </div>
      )}

      {state.kind === "error" && (
        <p className="mt-6 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.message}
        </p>
      )}

      {state.kind === "ready" && (
        <div className="mt-6 space-y-8">
          <p className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {state.data.noGuaranteeNotice}
          </p>
          <p className="text-sm text-slate-600">
            {state.data.counts.total} questions in total —{" "}
            {state.data.counts.officialCivics} official USCIS civics
            questions and {state.data.counts.practice} practice questions
            written by the platform. Every question cites its uscis.gov
            source below it.
          </p>

          {state.data.banks.map((bank) => (
            <section
              key={bank.id}
              aria-labelledby={`bank-${bank.id}`}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h2 id={`bank-${bank.id}`} className="text-lg font-semibold">
                {bank.title}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{bank.intro}</p>
              <p className="mt-2 text-xs text-slate-500">
                Source:{" "}
                <a
                  href={bank.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-blue-700 underline"
                >
                  {bank.source.label}
                </a>{" "}
                — {bank.source.basedOn}
              </p>
              <ol className="mt-4 space-y-4">
                {bank.questions.map((q, i) => (
                  <li key={q.id} className="rounded border border-slate-200 p-3">
                    <p className="text-sm font-medium">
                      {i + 1}. {q.question}{" "}
                      <span
                        className={`ml-1 inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${
                          q.kind === "official_civics"
                            ? "bg-green-100 text-green-900"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {q.kind === "official_civics"
                          ? "Official USCIS civics question"
                          : "Practice question — not official"}
                      </span>
                    </p>
                    {q.answer && (
                      <p className="mt-1 text-sm text-slate-700">
                        <span className="font-semibold">Official answer: </span>
                        {q.answer}
                      </p>
                    )}
                    {q.answerNote && (
                      <p className="mt-1 text-sm text-slate-700">{q.answerNote}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      Source:{" "}
                      <a
                        href={q.source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 underline"
                      >
                        {q.source.label}
                      </a>{" "}
                      — {q.source.basedOn}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          ))}

          <section
            aria-labelledby="bring-heading"
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h2 id="bring-heading" className="text-lg font-semibold">
              What to bring
            </h2>
            {state.data.whatToBring.map((guide) => (
              <div key={guide.interviewType} className="mt-4">
                <h3 className="text-sm font-semibold">{guide.interviewType}</h3>
                <p className="mt-1 text-sm font-medium text-amber-800">{guide.checkFirst}</p>
                <ul className="mt-2 space-y-2">
                  {guide.items.map((item) => (
                    <li key={item.item} className="text-sm">
                      <span className="font-medium">{item.item}</span> — {item.why}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-slate-500">
                  Source:{" "}
                  <a
                    href={guide.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 underline"
                  >
                    {guide.source.label}
                  </a>
                </p>
              </div>
            ))}
          </section>

          <section
            aria-labelledby="conduct-heading"
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h2 id="conduct-heading" className="text-lg font-semibold">
              {state.data.conduct.heading}
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
              {state.data.conduct.points.map((point) => (
                <li key={point.slice(0, 40)}>{point}</li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="looking-for-heading"
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h2 id="looking-for-heading" className="text-lg font-semibold">
              {state.data.whatOfficerLooksFor.heading}
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
              {state.data.whatOfficerLooksFor.points.map((point) => (
                <li key={point.slice(0, 40)}>{point}</li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="delay-heading"
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h2 id="delay-heading" className="text-lg font-semibold">
              {state.data.delayDenialReasons.heading}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{state.data.delayDenialReasons.intro}</p>
            <ul className="mt-3 space-y-3">
              {state.data.delayDenialReasons.reasons.map((r) => (
                <li key={r.reason} className="rounded border border-slate-200 p-3 text-sm">
                  <p className="font-semibold">{r.reason}</p>
                  <p className="mt-1 text-slate-700">{r.whatItMeans}</p>
                  <p className="mt-1 text-slate-700">
                    <span className="font-medium">What to do: </span>
                    {r.whatToDo}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="videos-heading"
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h2 id="videos-heading" className="text-lg font-semibold">
              Interview videos — scripts ready for production
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              No videos have been produced yet. Each script below is a full
              60-second, 9:16 vertical storyboard (title, scenes, exact
              on-screen text, narration) ready for the video team to shoot.
              Founder video standard: 60 seconds, 9:16, website name big
              and readable top and bottom in every scene.
            </p>
            {state.data.videoScripts.map((script) => (
              <article
                key={script.id}
                className="mt-4 rounded border border-slate-200 p-3"
              >
                <h3 className="text-sm font-semibold">{script.title}</h3>
                <p className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                  {script.status}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {script.purpose} Length: {script.lengthSeconds} seconds.{" "}
                  {script.format}.
                </p>
                <ol className="mt-3 space-y-3">
                  {script.scenes.map((scene) => (
                    <li key={scene.scene} className="rounded border border-slate-200 p-3 text-sm">
                      <p className="font-semibold">
                        Scene {scene.scene} — {scene.time}
                      </p>
                      <p className="mt-1">
                        <span className="font-medium">Visual: </span>
                        {scene.visual}
                      </p>
                      <p className="mt-1">
                        <span className="font-medium">On screen: </span>
                        {scene.onScreenText}
                      </p>
                      <p className="mt-1">
                        <span className="font-medium">Narration: </span>“
                        {scene.narration}”
                      </p>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </section>
        </div>
      )}
    </main>
  );
}
