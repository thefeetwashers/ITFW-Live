// Dynamic Form Intake Engine — I-131 / I-751 / I-539 / I-129F
// ---------------------------------------------------------------------------
// NEW FILE (2026-11-19). Client component, pure — no Supabase, no
// Stripe, no sending, no live lookups. State lives in this component
// only (answers are not saved anywhere in this build).
//
// Selecting one of the four forms loads ONLY that form's sections,
// timeline validators and document slots — no other form's questions
// ever appear. Works in both modes:
//   client_diy ("Client DIY") and preparer_assisted ("Preparer-Assisted").
// The help choice (DIY / Preparer / Attorney / DOJ-Accredited
// Representative) is shown on EVERY page, including the form picker —
// the attorney option is never hidden behind a step.
//
// Timeline validators come from src/lib/dynamicIntakeSchemas.ts:
//   I-131  intended departure must be in the future
//   I-751  filing date inside the 90-day window before card expiry
//   I-539  filed BEFORE the current I-94 expiry date
//   I-129F last in-person meeting within 2 years before filing
// They are date checks, not legal determinations — a failed check
// blocks the "ready to file" summary, it does not give legal advice.
//
// Document slots come from src/lib/formChecklists.ts for the selected
// form only (schema.documentSlotIds). Review $99 / Human Review $199
// are brief-given prices (src/lib/serviceTiers.ts), not repo-locked.
"use client";

import { useMemo, useState } from "react";
import {
  DYNAMIC_INTAKE_SCHEMAS,
  INTAKE_MODE_LABEL,
  INTAKE_SERVICE_OPTIONS,
  getDynamicSchema,
  runTimelineValidators,
  visibleFieldsForSection,
  type DynamicField,
  type DynamicFormCode,
  type DynamicIntakeSchema,
  type IntakeMode,
  type IntakeServiceOption,
} from "@/lib/dynamicIntakeSchemas";
import { getTemplate } from "@/lib/formChecklists";

const MODES: IntakeMode[] = ["client_diy", "preparer_assisted"];

function ServiceOptionBar({
  serviceOption,
  onChange,
}: {
  serviceOption: IntakeServiceOption;
  onChange: (option: IntakeServiceOption) => void;
}) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-600">
        Who helps you? (shown on every page — pick one)
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {INTAKE_SERVICE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={serviceOption === option.id}
            title={option.note}
            className={`rounded border px-3 py-1.5 text-xs font-semibold ${
              serviceOption === option.id
                ? "border-blue-600 bg-blue-50"
                : "border-slate-200 bg-white"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Review $99 / Human Review $199 are available add-ons (brief-given
        prices). Only an attorney gives legal advice.
      </p>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: DynamicField;
  value: string;
  onChange: (value: string) => void;
}) {
  const common =
    "mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm";
  const label = (
    <span className="block text-sm font-medium text-slate-700">
      {field.label}
      {field.required ? " *" : ""}
    </span>
  );
  if (field.type === "select") {
    return (
      <label className="block">
        {label}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={common}
        >
          <option value="">— Choose —</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {field.help && <span className="mt-1 block text-xs text-slate-500">{field.help}</span>}
      </label>
    );
  }
  if (field.type === "textarea") {
    return (
      <label className="block">
        {label}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={common}
        />
        {field.help && <span className="mt-1 block text-xs text-slate-500">{field.help}</span>}
      </label>
    );
  }
  return (
    <label className="block">
      {label}
      <input
        type={field.type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={common}
      />
      {field.help && <span className="mt-1 block text-xs text-slate-500">{field.help}</span>}
    </label>
  );
}

export default function DynamicFormIntakeEngine() {
  const [formCode, setFormCode] = useState<DynamicFormCode | null>(null);
  const [mode, setMode] = useState<IntakeMode>("client_diy");
  const [serviceOption, setServiceOption] =
    useState<IntakeServiceOption>("preparer");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checkedSlots, setCheckedSlots] = useState<string[]>([]);

  const schema: DynamicIntakeSchema | null = formCode
    ? getDynamicSchema(formCode)
    : null;

  const template = useMemo(
    () => (schema ? getTemplate(schema.checklistTemplateId) : null),
    [schema]
  );

  // Document slots: ONLY this form's checklist items, in schema order.
  const documentSlots = useMemo(() => {
    if (!schema || !template) return [];
    return schema.documentSlotIds
      .map((id) => template.checklist.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [schema, template]);

  const timelineResults = useMemo(
    () => (schema ? runTimelineValidators(schema, answers) : []),
    [schema, answers]
  );

  const timelinesPass = timelineResults.every((r) => r.ok);

  const pickForm = (code: DynamicFormCode) => {
    setFormCode(code);
    setSectionIndex(0);
    setAnswers({});
    setCheckedSlots([]);
  };

  const setAnswer = (key: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  const currentSection = schema?.sections[sectionIndex] ?? null;
  const visibleFields = currentSection
    ? visibleFieldsForSection(currentSection, answers)
    : [];
  const currentSectionComplete = visibleFields.every(
    (f) => !f.required || (answers[f.key] ?? "").trim() !== ""
  );

  const isLastSection =
    schema !== null && sectionIndex === schema.sections.length - 1;

  return (
    <section
      aria-labelledby="dynamic-intake-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="dynamic-intake-heading" className="text-base font-semibold">
        Dynamic Form Intake
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Pick one form. Only that form&apos;s questions, timeline checks and
        document slots load — nothing from any other form appears.
      </p>

      {/* Help choice — visible on every page, including the picker */}
      <div className="mt-3">
        <ServiceOptionBar
          serviceOption={serviceOption}
          onChange={setServiceOption}
        />
      </div>

      {/* Form picker */}
      <h3 className="mt-4 text-sm font-semibold">Which form?</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {DYNAMIC_INTAKE_SCHEMAS.map((s) => (
          <button
            key={s.formCode}
            type="button"
            onClick={() => pickForm(s.formCode)}
            aria-pressed={formCode === s.formCode}
            className={`rounded border p-3 text-left text-sm ${
              formCode === s.formCode
                ? "border-blue-600 bg-blue-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <span className="font-medium">{s.name}</span>
            <span className="block text-xs text-slate-600">{s.summary}</span>
          </button>
        ))}
      </div>

      {schema && (
        <div className="mt-4">
          {/* Mode — both modes load the same sections */}
          <h3 className="text-sm font-semibold">Intake mode</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`rounded border px-3 py-1.5 text-xs font-semibold ${
                  mode === m
                    ? "border-blue-600 bg-blue-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                {INTAKE_MODE_LABEL[m]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Mode: {INTAKE_MODE_LABEL[mode]} — the same {schema.formCode}{" "}
            sections, timeline checks and document slots load in both modes.
            {mode === "client_diy"
              ? " In DIY mode you answer the questions yourself; a preparer reviews only if you add Review $99 / Human Review $199."
              : " In preparer-assisted mode your assigned preparer sees the same answers and checklist."}
          </p>

          {/* Section stepper — this form's sections only */}
          <ol className="mt-4 flex flex-wrap gap-2">
            {schema.sections.map((section, i) => (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => setSectionIndex(i)}
                  aria-current={i === sectionIndex}
                  className={`rounded border px-3 py-1.5 text-xs font-semibold ${
                    i === sectionIndex
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  {i + 1}. {section.title}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => setSectionIndex(schema.sections.length)}
                aria-current={sectionIndex === schema.sections.length}
                className={`rounded border px-3 py-1.5 text-xs font-semibold ${
                  sectionIndex === schema.sections.length
                    ? "border-blue-600 bg-blue-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                {schema.sections.length + 1}. Documents &amp; timeline
              </button>
            </li>
          </ol>

          {currentSection ? (
            <div className="mt-4">
              <h3 className="text-sm font-semibold">
                {sectionIndex + 1}. {currentSection.title} — {schema.formCode}{" "}
                only
              </h3>
              {currentSection.description && (
                <p className="mt-1 text-sm text-slate-600">
                  {currentSection.description}
                </p>
              )}
              <div className="mt-3 space-y-3">
                {visibleFields.map((field) => (
                  <FieldInput
                    key={field.key}
                    field={field}
                    value={answers[field.key] ?? ""}
                    onChange={(value) => setAnswer(field.key, value)}
                  />
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={sectionIndex === 0}
                  onClick={() => setSectionIndex((i) => Math.max(0, i - 1))}
                  className="rounded bg-slate-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSectionIndex((i) =>
                      Math.min(schema.sections.length, i + 1)
                    )
                  }
                  className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {isLastSection ? "Documents & timeline →" : "Next →"}
                </button>
              </div>
              {!currentSectionComplete && (
                <p className="mt-2 text-xs text-amber-700">
                  Fill in the required (*) fields in this section before
                  filing — you can move on, but the packet is not ready
                  until they are answered.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <h3 className="text-sm font-semibold">
                Documents &amp; timeline — {schema.formCode} only
              </h3>

              {/* Timeline validators — this form only */}
              <h4 className="mt-3 text-sm font-semibold">Timeline checks</h4>
              <ul className="mt-2 space-y-2">
                {timelineResults.map((result) => (
                  <li
                    key={result.validatorId}
                    className={`rounded border p-3 text-sm ${
                      result.ok
                        ? "border-green-300 bg-green-50"
                        : "border-amber-400 bg-amber-50"
                    }`}
                  >
                    <span className="font-medium">
                      {result.ok ? "✓ " : "⚠ "}
                      {result.label}
                    </span>
                    <span className="block text-xs text-slate-600">
                      {result.message}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Document slots — this form only */}
              <h4 className="mt-4 text-sm font-semibold">
                Document slots ({documentSlots.length})
              </h4>
              <ul className="mt-2 space-y-2">
                {documentSlots.map((item) => {
                  const checked = checkedSlots.includes(item.id);
                  return (
                    <li
                      key={item.id}
                      className="flex items-start gap-2 rounded border border-slate-200 p-3 text-sm"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setCheckedSlots((prev) =>
                            checked
                              ? prev.filter((id) => id !== item.id)
                              : [...prev, item.id]
                          )
                        }
                        aria-pressed={checked}
                        className="mt-0.5 shrink-0 rounded border border-slate-400 bg-white px-2 py-0.5 text-xs font-semibold"
                      >
                        {checked ? "✓ Done" : "○ Not done"}
                      </button>
                      <span>
                        <span className="font-medium">{item.title}</span>
                        <span className="block text-xs text-slate-600">
                          Assigned to: {item.assignedTo}
                          {item.translationRequired
                            ? " — certified English translation required if the document is not in English."
                            : ""}
                          {item.condition ? ` — ${item.condition}.` : ""}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-3 text-sm font-semibold">
                {timelinesPass
                  ? "Timeline checks pass. The packet is ready to draft once every required field is answered and every blocking document slot is done."
                  : "Timeline checks do NOT all pass — do not file until the warning above is resolved."}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Government fees for {schema.formCode}:{" "}
                {schema.govFees
                  .map(
                    (fee) =>
                      `${fee.label} ${fee.displayAmount ?? "TO BE CONFIRMED"} (${fee.locked ? "LOCKED" : "TO BE CONFIRMED"})`
                  )
                  .join("; ")}
                . Government fees change. Confirm the current fee at
                uscis.gov/fees before you pay.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSectionIndex(schema.sections.length - 1)}
                  className="rounded bg-slate-200 px-3 py-1.5 text-xs font-semibold"
                >
                  ← Back to questions
                </button>
              </div>
            </div>
          )}

          {/* Help choice repeated at the bottom of every page */}
          <div className="mt-4">
            <ServiceOptionBar
              serviceOption={serviceOption}
              onChange={setServiceOption}
            />
          </div>
        </div>
      )}
    </section>
  );
}
