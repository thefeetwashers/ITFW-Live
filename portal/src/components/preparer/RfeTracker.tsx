// RFE tracker — preparer dashboard, CLERICAL CHECKLIST ONLY.
// An RFE (Request for Evidence) deadline is tracked here and the
// preparer organises the documents USCIS asked for. The LEGAL RESPONSE
// content belongs to an attorney — a preparer never writes an RFE/NOID
// legal brief. Every RFE row shows the "Get an attorney" button.
// Red-flag / waiver / asylum cases (I-601, I-601A, I-212, I-589,
// Complex RFE/NOID, VAWA / U / T) show the warning + the buttons —
// NEVER a lock on the client.
"use client";

import { useState } from "react";
import { GetAnAttorneyButtons, UplBadge } from "@/components/preparer/UplBadge";

const RED_FLAG_CASES = [
  { form: "I-601", label: "I-601 waiver (grounds of inadmissibility)" },
  { form: "I-601A", label: "I-601A provisional unlawful-presence waiver" },
  { form: "I-212", label: "I-212 permission to reapply after removal" },
  { form: "I-589", label: "I-589 asylum — clerical prep only, never legal advice" },
  { form: "Complex RFE/NOID", label: "Complex RFE or Notice of Intent to Deny" },
  { form: "VAWA / U / T", label: "VAWA, U visa, or T visa — red-flag case" },
] as const;

interface RfeRow {
  id: string;
  label: string;
  deadline: string; // YYYY-MM-DD
  items: { id: string; label: string; done: boolean }[];
  uploaded: boolean;
}

function daysLeft(deadline: string): number {
  const ms = new Date(`${deadline}T00:00:00Z`).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

export default function RfeTracker() {
  const [rfes, setRfes] = useState<RfeRow[]>([
    {
      id: "rfe-1",
      label: "Example RFE — I-130 bona fide marriage evidence (example)",
      deadline: "2026-12-19",
      items: [
        { id: "r1", label: "Joint bank statements (last 6 months)", done: false },
        { id: "r2", label: "Joint lease / utility bills", done: false },
        { id: "r3", label: "Photos together with dates", done: true },
      ],
      uploaded: false,
    },
  ]);
  const [flagForm, setFlagForm] = useState<string>(RED_FLAG_CASES[0].form);

  const toggleItem = (rfeId: string, itemId: string) =>
    setRfes((rs) =>
      rs.map((r) =>
        r.id === rfeId
          ? { ...r, items: r.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) }
          : r
      )
    );

  return (
    <section
      aria-labelledby="rfe-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="rfe-heading" className="text-lg font-semibold">
        RFE Upload &amp; Deadline Countdown — Clerical Checklist Only
      </h2>
      <UplBadge />
      <p className="mt-2 text-sm text-slate-600">
        The preparer organises the documents USCIS asked for and tracks the
        deadline. The legal response itself is the attorney&apos;s work — a
        preparer never writes an RFE/NOID legal brief. Example data, local
        only.
      </p>

      {rfes.map((r) => {
        const left = daysLeft(r.deadline);
        const doneCount = r.items.filter((i) => i.done).length;
        return (
          <article key={r.id} className="mt-4 rounded border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold">{r.label}</p>
            <p className={`mt-1 text-sm font-semibold ${left <= 30 ? "text-red-700" : "text-slate-700"}`}>
              Deadline: {r.deadline} — {left >= 0 ? `${left} day(s) left` : "deadline passed (example)"}
            </p>
            <ul className="mt-2 space-y-1">
              {r.items.map((i) => (
                <li key={i.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={i.done}
                    onChange={() => toggleItem(r.id, i.id)}
                    aria-label={i.label}
                  />
                  <span className={i.done ? "line-through text-slate-500" : ""}>{i.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-600">
              {doneCount} of {r.items.length} checklist item(s) collected.{" "}
              {r.uploaded ? "RFE packet uploaded (example)." : "Not uploaded yet."}
            </p>
            <button
              type="button"
              onClick={() => setRfes((rs) => rs.map((x) => (x.id === r.id ? { ...x, uploaded: true } : x)))}
              className="mt-2 rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white"
            >
              Mark RFE documents uploaded (example — clerical only, not filed)
            </button>
            <div className="mt-3">
              <GetAnAttorneyButtons reason="an RFE response" />
            </div>
          </article>
        );
      })}

      <h3 className="mt-5 text-sm font-semibold">
        Red-flag cases — show the warning + the buttons, never a lock
      </h3>
      <label className="mt-2 block text-sm">
        <span className="font-medium">Case type that needs legal help</span>
        <select
          value={flagForm}
          onChange={(e) => setFlagForm(e.target.value)}
          className="mt-1 w-full max-w-sm rounded border border-slate-300 bg-white px-2 py-1 text-sm"
        >
          {RED_FLAG_CASES.map((c) => (
            <option key={c.form} value={c.form}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-2">
        <GetAnAttorneyButtons
          reason={RED_FLAG_CASES.find((c) => c.form === flagForm)?.label ?? flagForm}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        The client keeps full access to their case and documents while a
        referral is pending. A preparer never blocks a form or a client
        because the case needs an attorney.
      </p>
    </section>
  );
}
