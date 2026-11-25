"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PortalShell, { type PortalViewAs } from "@/components/portal/PortalShell";
import LanguagePicker from "@/components/LanguagePicker";
import {
  FIELD_MAPPINGS,
  QUESTIONNAIRE_SECTIONS,
  mapAnswer,
  type QuestionnaireAnswer,
} from "@/lib/questionnaire";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";
import {
  validateTimeline,
  EXAMPLE_TIMELINE,
  type TimelineEntry,
} from "@/lib/validator";
import { getSupabase } from "@/lib/supabase";

const DRAFT_KEY = "niptei-questionnaire-draft-v1";

type DraftAnswers = Record<
  string,
  { original: string; mapped: string }
>;

export default function QuestionnairePage() {
  const [viewAs, setViewAs] = useState<PortalViewAs>("preparer");
  const isLive = useMemo(() => getSupabase() !== null, []);
  const [lang, setLang] = useState<LanguageCode>("en");
  const [answers, setAnswers] = useState<DraftAnswers>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [entries, setEntries] = useState<TimelineEntry[]>(EXAMPLE_TIMELINE);
  const [newLabel, setNewLabel] = useState("");
  const [newKind, setNewKind] = useState<"address" | "employment">("address");
  const [newStart, setNewStart] = useState("2024-01-01");
  const [newEnd, setNewEnd] = useState("2024-04-30");

  // Load saved draft (save-and-resume).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          answers?: DraftAnswers;
          entries?: TimelineEntry[];
        };
        if (parsed.answers) setAnswers(parsed.answers);
        if (parsed.entries) setEntries(parsed.entries);
        setSavedAt("Restored saved draft");
      }
    } catch {
      // Ignore a corrupt draft; start fresh from the example data.
    }
    setLoaded(true);
  }, []);

  // Save draft on every change (localStorage only).
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers, entries }));
      setSavedAt(`Saved ${new Date().toLocaleTimeString()}`);
    } catch {
      setSavedAt("Could not save draft in this browser.");
    }
  }, [answers, entries, loaded]);

  const validation = useMemo(() => validateTimeline(entries), [entries]);

  const mappedAnswers: QuestionnaireAnswer[] = useMemo(
    () =>
      FIELD_MAPPINGS.flatMap((f) => {
        const a = answers[f.questionKey];
        if (!a || (!a.original && !a.mapped)) return [];
        const mapped = mapAnswer(f.questionKey, lang, a.original, a.mapped);
        return mapped ? [mapped] : [];
      }),
    [answers, lang]
  );

  function addEntry() {
    const label = newLabel.trim();
    if (!label) return;
    setEntries((e) => [
      ...e,
      {
        id: `entry-${Date.now()}`,
        kind: newKind,
        label,
        start: newStart,
        end: newEnd || null,
      },
    ]);
    setNewLabel("");
  }

  return (
    <PortalShell
      active="nav-forms"
      viewAs={viewAs}
      onViewAsChange={setViewAs}
      isLive={isLive}
    >
      <h1 className="text-xl font-bold">
        Smart Forms — Intake Questionnaire (Form I-130)
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Answer in your own language. Each answer is stored in the original
        language and mapped to the English USCIS form field, shown
        side-by-side below.
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-700">
        Translation is UI + mapping only in this build — live Google Cloud
        Translation is NOT connected yet.
      </p>
      <p className="mt-1 text-sm">
        Draft status:{" "}
        <strong>{savedAt ?? "Not saved yet"}</strong>{" "}
        <span className="text-xs text-slate-500">
          (Saved automatically to this browser — save-and-resume.)
        </span>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <LanguagePicker />
        <label className="flex items-center gap-2 text-sm">
          Questionnaire language:
          <select
            id="questionnaire-language"
            value={lang}
            onChange={(e) => setLang(e.target.value as LanguageCode)}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.native}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Sections + field mappings */}
      {QUESTIONNAIRE_SECTIONS.map((section) => (
        <section
          key={section.id}
          aria-labelledby={`section-${section.id}`}
          className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 id={`section-${section.id}`} className="text-base font-semibold">
            {section.title} — {section.formCode}
          </h2>
          <div className="mt-3 space-y-4">
            {FIELD_MAPPINGS.filter((f) => {
              if (section.id === "petitioner")
                return (
                  f.questionKey === "petitioner_full_name" ||
                  f.questionKey === "beneficiary_full_name" ||
                  f.questionKey === "beneficiary_passport_number"
                );
              if (section.id === "address-work")
                return f.questionKey === "petitioner_address_history_5y";
              return f.questionKey === "marriage_date_place";
            }).map((f) => {
              const a = answers[f.questionKey] ?? { original: "", mapped: "" };
              return (
                <div key={f.questionKey} className="rounded border border-slate-200 p-3">
                  <label
                    htmlFor={`q-${f.questionKey}`}
                    className="block text-sm font-medium"
                  >
                    {f.prompt[lang] ?? f.prompt.en}
                  </label>
                  <p className="text-xs text-slate-500">
                    Maps to: {f.field} ({f.formCode})
                  </p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`q-${f.questionKey}`}
                        className="text-xs font-semibold"
                      >
                        Your answer (original —{" "}
                        {LANGUAGES.find((l) => l.code === lang)?.native})
                      </label>
                      <input
                        id={`q-${f.questionKey}`}
                        type="text"
                        value={a.original}
                        onChange={(e) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [f.questionKey]: { ...a, original: e.target.value },
                          }))
                        }
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`q-mapped-${f.questionKey}`}
                        className="text-xs font-semibold"
                      >
                        Mapped English (for the USCIS form)
                      </label>
                      <input
                        id={`q-mapped-${f.questionKey}`}
                        type="text"
                        value={a.mapped}
                        onChange={(e) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [f.questionKey]: { ...a, mapped: e.target.value },
                          }))
                        }
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm"
                      />
                    </div>
                  </div>
                  {a.original || a.mapped ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Stored side-by-side: original “{a.original}” → mapped
                      English “{a.mapped}”.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Mapped answers summary */}
      {mappedAnswers.length > 0 && (
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">
            Mapped Answers (original + English)
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {mappedAnswers.map((m) => (
              <li key={m.questionKey}>
                <strong>{m.field}:</strong> “{m.originalValue}” (
                {m.originalLanguage}) → “{m.mappedEnglishValue}”
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 5-year timeline editor */}
      <section
        aria-labelledby="timeline-heading"
        className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 id="timeline-heading" className="text-base font-semibold">
          5-Year Address &amp; Work History Timeline
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Starting entries are the example timeline. Add an entry to close
          the gap — for example, an address covering Jan–Apr 2024.
        </p>

        {!validation.ok && (
          <div
            role="alert"
            className="mt-3 rounded border-2 border-red-600 bg-red-50 p-3 text-sm text-red-800"
          >
            <p className="font-semibold">
              [!] Date gaps found — fix these before submitting:
            </p>
            <ul className="mt-1 list-disc pl-5">
              {validation.gaps.map((g, i) => (
                <li key={`${g.kind}-${i}`}>
                  {g.kind}: {g.label} ({g.gapStart} to {g.gapEnd})
                </li>
              ))}
            </ul>
            <p className="mt-1">Coverage: {validation.coveragePercent}%.</p>
          </div>
        )}
        {validation.ok && (
          <div
            role="status"
            className="mt-3 rounded border border-green-600 bg-green-50 p-3 text-sm text-green-800"
          >
            ✓ No date gaps — 5-year timeline is complete (coverage{" "}
            {validation.coveragePercent}%).
          </div>
        )}

        <ul className="mt-3 space-y-2 text-sm">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2"
            >
              <span>
                <strong>{e.kind === "address" ? "Address" : "Employment"}:</strong>{" "}
                {e.label} — {e.start} to {e.end ?? "present"}
              </span>
              <button
                type="button"
                onClick={() => setEntries((list) => list.filter((x) => x.id !== e.id))}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-3 grid gap-2 rounded border border-slate-200 bg-slate-50 p-3 md:grid-cols-5">
          <label className="text-xs font-semibold">
            Type
            <select
              id="new-entry-kind"
              value={newKind}
              onChange={(e) =>
                setNewKind(e.target.value as "address" | "employment")
              }
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal"
            >
              <option value="address">Address</option>
              <option value="employment">Employment</option>
            </select>
          </label>
          <label className="text-xs font-semibold md:col-span-2">
            Address / employer
            <input
              id="new-entry-label"
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. 789 Pine St, Fort Pierce, FL"
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-semibold">
            Start
            <input
              id="new-entry-start"
              type="date"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-semibold">
            End (blank = present)
            <input
              id="new-entry-end"
              type="date"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={addEntry}
          className="mt-2 rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
        >
          Add Timeline Entry
        </button>

        <div className="mt-4 border-t border-slate-200 pt-3">
          <button
            type="button"
            disabled={!validation.ok}
            onClick={() => setSubmitted(true)}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          >
            {validation.ok
              ? "Submit Questionnaire"
              : "Fix the date gaps above to submit"}
          </button>
          {submitted && validation.ok && (
            <p role="status" className="mt-2 text-sm font-semibold text-green-700">
              ✓ Questionnaire submitted (example only — nothing was sent to a
              server in this build).
            </p>
          )}
          {!validation.ok && (
            <p className="mt-2 text-xs text-slate-500">
              Submit is blocked until validateTimeline() reports no gaps.
            </p>
          )}
        </div>
      </section>

      <p className="mt-4 text-sm">
        <Link href="/portal" className="underline">
          ← Back to Portal Dashboard
        </Link>
      </p>
    </PortalShell>
  );
}
