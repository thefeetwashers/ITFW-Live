"use client";

import { useState } from "react";
import { EXAMPLE_CHAT_UPGRADED } from "@/lib/example-data";
import type { ChatMessage } from "@/lib/types";

const INTERVIEW_QUESTIONS = [
  "When and where did you first meet your spouse?",
  "When and where did you get married, and who attended?",
  "Where do you and your spouse currently live together?",
  "What is your spouse's daily routine / job, and what do you do together on a typical weekend?",
  "Can you show joint documents — bank statements, lease, photos, or messages — that show your life together?",
  "Have you met each other's families? When and where?",
  "What plans do you have together for the next year?",
];

export function CaseChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(EXAMPLE_CHAT_UPGRADED);
  const [draft, setDraft] = useState("");

  function send() {
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [
      ...m,
      {
        id: `msg-local-${Date.now()}`,
        sender: "You",
        time: new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
        body: text,
        mine: true,
      },
    ]);
    setDraft("");
  }

  return (
    <div>
      <div className="space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg px-3 py-2 text-sm ${
              m.sender === "System"
                ? "border border-blue-200 bg-blue-50 text-blue-900"
                : m.mine
                  ? "ml-6 bg-slate-900 text-white"
                  : "mr-6 bg-slate-100"
            }`}
          >
            <p className="text-xs font-semibold">
              {m.sender}
              {m.time ? ` · ${m.time}` : ""}
              {m.sender === "System" ? " (example SMS reminder)" : ""}
            </p>
            <p>{m.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          id="chat-draft"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Type a message…"
          aria-label="Type a message"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-2 text-sm"
        />
        <button
          type="button"
          aria-label="Attach a file (example only)"
          className="rounded border border-slate-300 px-2 py-2 text-sm"
          onClick={() => alert("Example only — attachments are not uploaded in this build.")}
        >
          📎
        </button>
        <button
          type="button"
          onClick={send}
          className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
        >
          Send
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Example chat only — messages shown here are client-side and are not
        actually sent in this build. SMS alerts: nudge logic ready, sending
        needs Twilio (not connected, no message actually sent).
      </p>
    </div>
  );
}

export function InterviewPrep() {
  return (
    <div>
      <h4 className="text-sm font-semibold">
        📖 Study Guide — Top Marriage Interview Questions (example prep)
      </h4>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
        {INTERVIEW_QUESTIONS.map((q, i) => (
          <li key={`iq-${i}`}>{q}</li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-slate-500">
        Example preparation questions only — not legal advice, and not a
        guarantee about what an officer will ask. Bring the document
        checklist from your Packet Audit to the interview.
      </p>
    </div>
  );
}
