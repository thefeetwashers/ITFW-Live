// Instant-answer chat — the client asks, the system answers NOW.
// Used in the case-chat area of the Client Portal (/portal) and
// anywhere a professional↔client thread needs an immediate answer.
//
// How it works: the question is POSTed to /api/ask-niptei with
// { instantChat: true }. The route returns 501 "AI not configured"
// BY DESIGN — the body still carries the instant answer, and this
// component treats 501 + a body as a normal answer, never as an
// error and never as a fake AI answer. The answer comes from the
// rule-based engine (src/lib/askNiptei.ts via src/lib/instantChat.ts)
// and ONLY from the platform's locked data, with a source cited.
//
//  * Known question → sourced answer + the system label.
//  * Unknown question → exactly "I do not know — check uscis.gov /
//    ask your preparer / ask an attorney", flagged to the
//    professional in the same thread ("Ask a human").
//  * Legal-decision question (relief / eligibility / evidence /
//    safe-to-travel / legal advice) → NO legal answer. Escalation
//    text (Find Attorney / Find DOJ + Review $99 / Human Review
//    $199, locked prices), logged, flagged to the professional.
//  * The BYO AI copilot stays optional and NOT configured —
//    AskNipteiByoSettings is where a professional connects their
//    own key; until then no AI answers anything here.
"use client";

import { useState } from "react";
import type { InstantChatResult } from "@/lib/instantChat";
import { SYSTEM_LABEL } from "@/lib/instantChat";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";
import NewsAlert from "@/components/copilot/NewsAlert";

interface InstantChatMessage {
  id: string;
  result: InstantChatResult;
  askedHuman: boolean;
}

export default function InstantAnswerChat(props: {
  caseId?: string;
  /** Shown to the professional side of the thread ("Flagged for
   *  you" banner). Defaults to the client view. */
  viewerRole?: "client" | "professional";
  /** Form codes on the client's case, for case-aware news flags.
   *  When omitted the news list is shown unflagged. */
  caseForms?: string[];
}) {
  const caseId = props.caseId ?? "example-case-1";
  const viewerRole = props.viewerRole ?? "client";
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<InstantChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flaggedCount = messages.filter(
    (m) => m.result.flaggedForProfessional
  ).length;

  async function send() {
    const question = input.trim();
    if (!question || loading) return;
    setLoading(true);
    setError(null);
    setInput("");
    try {
      const res = await fetch("/api/ask-niptei", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, language, instantChat: true, caseId }),
      });
      const data = (await res.json()) as {
        instant?: InstantChatResult;
        error?: string;
      };
      // 501 "AI not configured" is the expected status: the body
      // still carries the non-AI instant answer.
      if (!data.instant) {
        setError(
          data.error ??
            "The system could not answer right now. Ask your preparer or an attorney."
        );
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${prev.length}`,
          result: data.instant as InstantChatResult,
          askedHuman: false,
        },
      ]);
    } catch {
      setError(
        "The system could not answer right now. Ask your preparer or an attorney."
      );
    } finally {
      setLoading(false);
    }
  }

  function askHuman(id: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, askedHuman: true } : m))
    );
  }

  return (
    <section
      aria-labelledby="instant-chat-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="instant-chat-heading" className="text-lg font-semibold">
        Instant answers — ask, get an answer right now
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Ask a question in the chat and the system answers immediately —
        no waiting for a person to reply. Answers come only from the
        platform&apos;s locked guides and uscis.gov / travel.state.gov /
        justice.gov/eoir, with the source shown. {SYSTEM_LABEL}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        The system never decides whether you qualify, whether your
        evidence is strong enough, or whether it is safe to travel or
        leave — those questions go straight to your professional and to
        a licensed attorney or DOJ-accredited representative. The
        optional BYO AI copilot is NOT configured (no key set), so no
        AI answers anything here — these are non-AI answers from the
        locked guides.
      </p>

      {/* Immigration news inside the chat — built-in posts only, with
          a "may affect your case" flag when an item matches this
          client's case forms. No live feed is connected yet. */}
      <div className="mt-3">
        <NewsAlert caseForms={props.caseForms ?? []} />
      </div>

      {viewerRole === "professional" && flaggedCount > 0 && (
        <p
          role="status"
          className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900"
        >
          Flagged for you — {flaggedCount} question
          {flaggedCount === 1 ? "" : "s"} in this thread need{flaggedCount === 1 ? "s" : ""} a
          human follow-up (escalated or “I do not know”). Reply in the
          unified thread below.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="instant-chat-lang" className="text-sm font-medium">
          Your language
        </label>
        <select
          id="instant-chat-lang"
          value={language}
          onChange={(e) => setLanguage(e.target.value as LanguageCode)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.native} ({l.label})
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          Case: <span className="font-mono">{caseId}</span> (example)
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        <label htmlFor="instant-chat-q" className="sr-only">
          Your immigration question
        </label>
        <input
          id="instant-chat-q"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
          placeholder="Ask anything about your forms, documents, fees, or a USCIS/NVC letter…"
          className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={loading || !input.trim()}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? "Answering…" : "Ask — get an answer now"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Try: “What are the fees for I-485?” · “What does my RFE letter
        mean?” · “What documents do I need for I-130?”
      </p>

      <div className="mt-4 space-y-4">
        {messages.map((m) => (
          <article
            key={m.id}
            className="rounded border border-slate-200 bg-slate-50 p-3"
          >
            <p className="text-xs font-semibold text-slate-500">
              Your question
            </p>
            <p className="text-sm">{m.result.question}</p>

            {m.result.escalated && (
              <p className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-sm font-semibold text-red-900">
                Escalated — this needs a licensed attorney or
                DOJ-accredited representative. No legal answer was given.
                Logged as an escalation and flagged to your assigned
                professional in this thread.
              </p>
            )}
            {m.result.unknown && (
              <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-sm font-semibold text-amber-900">
                The system does not know this one — flagged to your
                assigned professional in this thread for a human answer.
              </p>
            )}

            <p className="mt-3 whitespace-pre-line text-sm">
              {m.result.answer}
            </p>
            <p className="mt-2 text-xs font-semibold">{SYSTEM_LABEL}</p>
            <p className="mt-1 text-xs text-slate-600">
              Sources:{" "}
              {m.result.sources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 ? " · " : ""}
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 underline"
                  >
                    {s.label}
                  </a>
                </span>
              ))}
            </p>
            {m.result.escalation && (
              <p className="mt-1 text-xs text-slate-600">
                Escalation logged: {m.result.escalation.reason} Routed to:{" "}
                {m.result.escalation.routedTo} Offers:{" "}
                {m.result.escalation.offers.join(" · ")}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2">
              <span className="text-xs font-semibold">
                Was this helpful? / Ask a human:
              </span>
              <button
                type="button"
                onClick={() => askHuman(m.id)}
                className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-white"
              >
                Ask a human
              </button>
              {m.askedHuman && (
                <span className="text-xs text-green-700" role="status">
                  Flagged to your assigned professional&apos;s unified
                  thread (local demo in this build — no message is sent
                  until the messages table is live).
                </span>
              )}
              {m.result.flaggedForProfessional && !m.askedHuman && (
                <span className="text-xs font-semibold text-red-800">
                  Flagged for your professional — they will follow up
                  here.
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
