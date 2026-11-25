// Ask NIPTEI — chat copilot UI.
// Used in: Client Portal, Family Portal, every professional
// dashboard, and the public storefront (/p/[slug]).
//  * Client types in their own language (7 languages). The ORIGINAL
//    question is always shown, plus the English version when one
//    exists (null in this build — Google Translate NOT connected,
//    so no English version is invented).
//  * Every answer carries the label "AI helper — educational
//    information only, not legal advice" and a source citation.
//  * "Was this helpful? / Ask a human" routes the question to the
//    assigned professional's unified thread (local demo in this
//    build — no message is sent until the messages table is live).
//  * An answer that names a form checklist offers a one-tap
//    "Load this checklist" button, which opens that checklist
//    inline (wired to src/lib/formChecklists.ts).
//  * "Human review before release": when reviewMode is on, an
//    answer is HELD until the professional approves it (reuse of
//    the "Ask a Law Student" review pattern). A client never sees
//    a held answer as released.
//  * The API returns 501 "AI not configured" in this build — the
//    component treats 501 + a body as a normal (non-AI FAQ) answer,
//    never as an error and never as a fake AI answer.
"use client";

import { useState } from "react";
import { COPILOT_DISCLAIMER, type CopilotAnswer } from "@/lib/askNiptei";
import { getTemplate as getChecklistTemplate } from "@/lib/formChecklists";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";
import type { AuditItem } from "@/lib/audit";
import type { TimelineGap } from "@/lib/validator";

export type CopilotContext =
  | "client"
  | "family"
  | "professional"
  | "storefront";

interface ChatMessage {
  id: string;
  answer: CopilotAnswer;
  /** Held for professional review — not released to the client yet. */
  held: boolean;
  released: boolean;
  helpful: boolean | null;
  askedHuman: boolean;
}

export default function AskNipteiChat(props: {
  context: CopilotContext;
  caseId?: string;
  professionalId?: string;
  /** "human_review_before_release" holds every answer until approved. */
  reviewMode?: boolean;
  /** When false the professional has turned the copilot OFF. */
  copilotEnabled?: boolean;
  auditItems?: AuditItem[];
  timelineGaps?: TimelineGap[];
}) {
  const {
    context,
    reviewMode = false,
    copilotEnabled = true,
    auditItems,
    timelineGaps,
  } = props;
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [openChecklistId, setOpenChecklistId] = useState<string | null>(null);

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
        body: JSON.stringify({
          question,
          language,
          caseId: props.caseId,
          professionalId: props.professionalId,
          auditItems,
          timelineGaps,
        }),
      });
      const data = (await res.json()) as {
        answer?: CopilotAnswer;
        note?: string;
        error?: string;
      };
      // 501 "AI not configured" is the expected status in this build:
      // the body still carries the non-AI FAQ answer. Any other
      // status without an answer is a real error.
      if (!data.answer) {
        setError(
          data.error ??
            "The copilot could not answer right now. Ask your preparer or an attorney."
        );
        return;
      }
      setAiStatus(data.note ?? null);
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${prev.length}`,
          answer: data.answer as CopilotAnswer,
          held: reviewMode && context !== "professional",
          released: !reviewMode || context === "professional",
          helpful: null,
          askedHuman: false,
        },
      ]);
    } catch {
      setError(
        "The copilot could not answer right now. Ask your preparer or an attorney."
      );
    } finally {
      setLoading(false);
    }
  }

  function setHelpful(id: string, value: boolean) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, helpful: value } : m))
    );
  }

  function askHuman(id: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, askedHuman: true } : m))
    );
  }

  function release(id: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, held: false, released: true } : m))
    );
  }

  if (!copilotEnabled) {
    return (
      <section
        aria-labelledby="ask-niptei-heading"
        className="rounded-lg border border-slate-300 bg-slate-100 p-4 shadow-sm"
      >
        <h2 id="ask-niptei-heading" className="text-lg font-semibold">
          Ask NIPTEI
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          The copilot is turned OFF for your clients by your professional.
          Ask them directly, or use “Ask a human” in your case thread.
        </p>
      </section>
    );
  }

  const openTemplate = openChecklistId
    ? getChecklistTemplate(openChecklistId)
    : null;

  return (
    <section
      aria-labelledby="ask-niptei-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="ask-niptei-heading" className="text-lg font-semibold">
        Ask NIPTEI
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {COPILOT_DISCLAIMER}. Ask in your own language — which form you
        need, what documents are needed, what a USCIS/NVC notice means
        (RFE Decoder), how to complete a field, or what the fees are
        (locked prices only). I never decide eligibility, never give
        legal advice, never represent you, and never file anything.
      </p>
      {aiStatus && (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          AI not configured — non-AI answer from the locked FAQ / form
          guides. OpenRouter is NOT connected (env OPENROUTER_API_KEY
          only). Google Translate is NOT connected either, so answers
          are in English for now and your original question is shown
          as typed.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="ask-niptei-lang" className="text-sm font-medium">
          Your language
        </label>
        <select
          id="ask-niptei-lang"
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
        {reviewMode && (
          <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
            Human review before release — answers are held until a
            professional approves them
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <label htmlFor="ask-niptei-q" className="sr-only">
          Your immigration question
        </label>
        <input
          id="ask-niptei-q"
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
          {loading ? "Asking…" : "Ask"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Try: “Which form do I need to petition for my spouse outside the
        U.S.?” · “What does my RFE letter mean?” · “What are the fees
        for I-485?” · “What is my next step?”
      </p>

      <div className="mt-4 space-y-4">
        {messages.map((m) => (
          <article
            key={m.id}
            className="rounded border border-slate-200 bg-slate-50 p-3"
          >
            <p className="text-xs font-semibold text-slate-500">
              Your question (original)
            </p>
            <p className="text-sm">{m.answer.questionOriginal}</p>
            {m.answer.questionEnglish ? (
              <p className="mt-1 text-sm text-slate-600">
                <span className="text-xs font-semibold text-slate-500">
                  English version:{" "}
                </span>
                {m.answer.questionEnglish}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                English version: not available — translation is NOT
                configured (Google Translate NOT connected). Original
                shown as typed.
              </p>
            )}

            {m.held && !m.released ? (
              <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-900">
                  Held for professional review — not released yet.
                </p>
                <p className="mt-1 text-xs text-amber-900">
                  Human review before release is on: a professional must
                  approve this answer before the client sees it.
                </p>
                {context === "professional" && (
                  <button
                    type="button"
                    onClick={() => release(m.id)}
                    className="mt-2 rounded bg-amber-600 px-3 py-1 text-sm font-semibold text-white"
                  >
                    Approve &amp; release this answer
                  </button>
                )}
              </div>
            ) : (
              <>
                {m.answer.escalated && (
                  <p className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-sm font-semibold text-red-900">
                    Escalated — this needs a licensed attorney or
                    DOJ-accredited representative. Logged as an
                    escalation and routed to your assigned
                    professional&apos;s unified thread.
                  </p>
                )}
                <p className="mt-3 whitespace-pre-line text-sm">
                  {m.answer.answer}
                </p>
                {m.answer.packetScore !== null && (
                  <p className="mt-2 text-sm">
                    Packet audit score:{" "}
                    <strong>{m.answer.packetScore}%</strong>{" "}
                    {m.answer.packetReady
                      ? "— ready for DRAFT packet review."
                      : "— not ready yet; clear every blocking item to reach 100%."}
                  </p>
                )}
                {m.answer.timelineGaps && m.answer.timelineGaps.length > 0 && (
                  <p className="mt-2 text-sm">
                    Timeline gaps:{" "}
                    {m.answer.timelineGaps.map((g) => g.label).join("; ")}
                  </p>
                )}
                <p className="mt-2 text-xs font-semibold">
                  {COPILOT_DISCLAIMER}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Sources:{" "}
                  {m.answer.sources.map((s, i) => (
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
                {m.answer.checklistTemplate && (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenChecklistId(
                        openChecklistId === m.answer.checklistTemplateId
                          ? null
                          : m.answer.checklistTemplateId
                      )
                    }
                    className="mt-2 rounded border border-blue-600 px-3 py-1 text-sm font-semibold text-blue-700"
                  >
                    Load this checklist —{" "}
                    {m.answer.checklistTemplate.name}
                  </button>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2">
                  <span className="text-xs font-semibold">
                    {m.answer.askHumanLabel}:
                  </span>
                  <button
                    type="button"
                    onClick={() => setHelpful(m.id, true)}
                    className={
                      "rounded border px-2 py-1 text-xs " +
                      (m.helpful === true
                        ? "border-green-600 bg-green-50 font-semibold text-green-800"
                        : "border-slate-300")
                    }
                  >
                    Yes, helpful
                  </button>
                  <button
                    type="button"
                    onClick={() => setHelpful(m.id, false)}
                    className={
                      "rounded border px-2 py-1 text-xs " +
                      (m.helpful === false
                        ? "border-amber-600 bg-amber-50 font-semibold text-amber-800"
                        : "border-slate-300")
                    }
                  >
                    No — ask a human
                  </button>
                  <button
                    type="button"
                    onClick={() => askHuman(m.id)}
                    className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-white"
                  >
                    Ask a human
                  </button>
                  {m.askedHuman && (
                    <span className="text-xs text-green-700" role="status">
                      Sent to your assigned professional&apos;s unified
                      thread (local demo in this build — no message is
                      sent until the messages table is live; your
                      professional can see this question in the case
                      thread).
                    </span>
                  )}
                </div>
              </>
            )}
          </article>
        ))}
      </div>

      {openTemplate && (
        <div className="mt-4 rounded border border-blue-200 bg-blue-50 p-3">
          <h3 className="text-sm font-semibold">
            Checklist — {openTemplate.name}
          </h3>
          <p className="mt-1 text-sm">{openTemplate.summary}</p>
          <p className="mt-1 text-sm">{openTemplate.prepFeeNote}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {openTemplate.checklist.map((item) => (
              <li key={item.id}>
                {item.title}
                {item.translationRequired ? " (certified translation required)" : ""}
                {item.condition ? ` — ${item.condition}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-600">
            Source: platform form checklists (src/lib/formChecklists.ts).
            Government fees:{" "}
            {openTemplate.govFees
              .map((g) => `${g.label} — ${g.note}`)
              .join("; ")}
          </p>
          <button
            type="button"
            onClick={() => setOpenChecklistId(null)}
            className="mt-2 rounded border border-slate-300 px-3 py-1 text-xs"
          >
            Close checklist
          </button>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-500">
        Filing help: the copilot never files anything. It helps you
        complete the form — then you generate the DRAFT packet (blocked
        until the audit score is 100%), review it, E-Sign it, and submit
        it yourself (or via your attorney). Your packet is ready for
        review — never “filed” by the copilot.
        {auditItems
          ? ` Packet audit items supplied: ${auditItems.length}.`
          : ""}{" "}
        {timelineGaps ? ` Timeline gaps supplied: ${timelineGaps.length}.` : ""}
      </p>
    </section>
  );
}
