// Dynamic Form Intake Engine — ONE engine shared by Self-Filing
// Clients (DIY) and Document Preparers.
// ============================================================================
// mode="client_diy" (Self-File) and mode="preparer_assisted" (Document
// Preparer) run the SAME engine over the SAME registry
// (src/lib/dynamicIntakeSchemas.ts). The engine reads selectedForms and
// renders ONLY those sections, in order — selecting N-400 shows only
// N-400 questions, never I-130 marriage fields.
//
// What this engine does NOT do:
//  * It NEVER auto-files with USCIS. The packet is a DRAFT for the
//    client to review, E-Sign, and submit themselves (or via their
//    attorney). Every generated packet says: "Generated — review and
//    sign before you submit. This does not file your case."
//  * It does NOT build a second packet route. It calls the EXISTING
//    POST /api/generate-packet with formCodes + answers + timelines +
//    preparer_block (preparer mode only) + gov_payment_authorization.
//    That route enforces the packet-audit gate (100%) and the payment
//    gate, watermarks the packet DRAFT, and lists unfilled fields.
//  * It does NOT build a second timeline validator. Date gaps are
//    checked with src/lib/validator.ts validateTimeline() only.
//  * It does NOT decide admissibility or eligibility, and it does NOT
//    invent I-485 admissibility checkbox answers (see the registry).
//
// DIY ladder rule: in DIY mode the Preparer section stays BLANK.
// Preparer mode: the preparer fills/edits ONLY at the client's
// direction (Mandatory User Direction checkbox, timestamped log), and
// the Preparer Contact & Signature Block is logged on every USCIS
// form — the block varies by form edition, so it is labelled
// "Preparer block per the current form edition — verify the block
// location on the official form". No single "Part 10" block is claimed
// to fit every form.
//
// Preparer identity: the preparer block uses the LOGGED-IN preparer's
// real profile (professional_profiles, passed in as preparerProfile).
// No fake preparer is ever used. When no profile is passed in, the
// block is left blank and labelled EXAMPLE / not-loaded — never filled
// with an invented name, company, phone or email.
//
// Sensitive values (SSN / A-Number / green card number / passport
// number): masked in the UI (***-**-1234), never shown in full in any
// list or log, never logged. Stored only in questionnaire_responses /
// the vault under the existing RLS (migration 0005).
//
// Attorney option: on EVERY form page, in BOTH modes, all FOUR options
// are shown every time — DIY $25, Preparer, Attorney, DOJ — plus
// Review $99 / Human Review $199, Find Attorney / Find DOJ buttons,
// and a stronger warning (not a lock) on red-flag forms.
// ============================================================================

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ALL_REGISTRY_FORM_CODES,
  ATTORNEY_OPTION_LINE,
  DRAFT_SCHEMA_NOTICE,
  GOV_PAYMENT_RULE,
  PREPARER_BLOCK_NOTICE,
  RED_FLAG_CASE_TYPES,
  RED_FLAG_WARNING,
  getDynamicSchema,
  getRegistrySchema,
  isDynamicFormCode,
  maskSensitiveValue,
  requiredFieldsForSchemas,
  runTimelineValidators,
  schemasForSelectedForms,
  timelineValidatorsForSchemas,
  unknownFormCodes,
  type RegistryField,
  type RegistryFormSchema,
} from "@/lib/dynamicIntakeSchemas";
import { validateTimeline, type TimelineEntry } from "@/lib/validator";
import { getSupabase } from "@/lib/supabase";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";
import { GetAnAttorneyButtons, UPL_BADGE_TEXT } from "@/components/preparer/UplBadge";

export type IntakeMode = "client_diy" | "preparer_assisted";

export type GovPaymentOption =
  | "uscis_online_paygov"
  | "paper_g1450_card"
  | "paper_g1650_ach";

export const GOV_PAYMENT_OPTIONS: Array<{ id: GovPaymentOption; label: string; detail: string }> = [
  {
    id: "uscis_online_paygov",
    label: "USCIS Online Account — Pay.gov (instant receipt)",
    detail: "Pay the USCIS fee online through your USCIS account (Pay.gov). You get an instant receipt.",
  },
  {
    id: "paper_g1450_card",
    label: "Paper filing + Form G-1450 (card)",
    detail: "Paper filing with Form G-1450 authorising USCIS to charge your card.",
  },
  {
    id: "paper_g1650_ach",
    label: "Paper filing + Form G-1650 (ACH bank debit)",
    detail: "Paper filing with Form G-1650 authorising USCIS to debit your bank account (ACH).",
  },
];

/** Logged-in preparer's real profile (public.professional_profiles).
 *  Pass the row for the signed-in preparer — never an invented one. */
export interface PreparerProfile {
  fullName: string;
  companyName?: string | null;
  cityState?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface DynamicFormIntakeEngineProps {
  mode: IntakeMode;
  /** Forms to load, e.g. ["N-400"] or ["I-130", "DS-260", "I-864"]. */
  selectedForms: string[];
  /** REAL cases.id (UUID). Never a placeholder such as 'CASE-101'. */
  caseId: string;
  /** accounts.id of the client, for questionnaire_responses. */
  clientId?: string | null;
  /** Logged-in preparer's professional_profiles row (preparer mode). */
  preparerProfile?: PreparerProfile | null;
  actorId?: string | null;
  actorRole?: "client" | "preparer" | "attorney" | "nonprofit" | "admin";
  initialLanguage?: LanguageCode;
  /** Save-and-resume (guided DIY flow): answers restored from the
   *  caller's saved draft (public.diy_drafts, migration 0023).
   *  Each value is { original, mapped } — the same shape the engine
   *  keeps in state. Absent = start empty. */
  initialAnswers?: Record<string, AnswerValue> | null;
  /** Save-and-resume: field name of the exact question the client
   *  left off (diy_drafts.current_field_name). The engine scrolls
   *  to it once on mount so the client resumes where they stopped. */
  initialResumeFieldName?: string | null;
  /** Save-and-resume: called with the full answers map on every
   *  answer change, so the parent can autosave the draft (debounced)
   *  to /api/diy/drafts. Values are never logged here — the parent
   *  owns what it sends, and the drafts route sanitizes again. */
  onAnswersChange?: ((answers: Record<string, AnswerValue>) => void) | null;
}

interface AnswerValue {
  original: string;
  mapped: string;
}

interface DirectionLogEntry {
  at: string;
  by: string;
  note: string;
}

interface PacketResult {
  status?: string;
  signedUrl?: string;
  downloadUrl?: string;
  pageCount?: number;
  unfilledFields?: Array<{ formCode?: string; fieldLabel?: string; reason?: string }>;
  message?: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LONG_TEXT_NAMES = [
  "_why_afraid",
  "_harm_feared",
  "_evidence_list",
  "_reason",
  "_purpose_detail",
  "_how_met",
  "_bona_fide_evidence",
  "_trips_abroad",
  "_financial_support",
  "_waiver_detail",
  "_reinstate_reason",
  "_trip_purpose",
  "_statement",
  "_children",
];

function isLongText(fieldName: string): boolean {
  return LONG_TEXT_NAMES.some((part) => fieldName.includes(part));
}

/** Display value for an answer: masked when the field is sensitive. */
function displayAnswer(field: RegistryField, value: string): string {
  if (!value) return "";
  return field.sensitive ? maskSensitiveValue(value) : value;
}

export default function DynamicFormIntakeEngine({
  mode,
  selectedForms: initialForms,
  caseId,
  clientId,
  preparerProfile,
  actorId,
  actorRole,
  initialLanguage = "en",
  initialAnswers = null,
  initialResumeFieldName = null,
  onAnswersChange = null,
}: DynamicFormIntakeEngineProps) {
  const isPreparerMode = mode === "preparer_assisted";
  const [selected, setSelected] = useState<string[]>(initialForms);
  const [lang, setLang] = useState<LanguageCode>(initialLanguage);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(
    () => initialAnswers ?? {}
  );
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newKind, setNewKind] = useState<"address" | "employment">("address");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [redFlagCaseType, setRedFlagCaseType] = useState("");
  const [directionChecked, setDirectionChecked] = useState(false);
  const [directionLog, setDirectionLog] = useState<DirectionLogEntry[]>([]);
  const [govPayment, setGovPayment] = useState<GovPaymentOption | "">("");
  const [uploadNames, setUploadNames] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [packet, setPacket] = useState<PacketResult | null>(null);

  // Save-and-resume: report every answer change to the parent (which
  // debounces the draft save), and scroll once on mount to the exact
  // question the client left off. The callback is kept in a ref so
  // the effect below does not re-run when the parent re-renders.
  const onAnswersChangeRef = useRef(onAnswersChange);
  onAnswersChangeRef.current = onAnswersChange;
  useEffect(() => {
    onAnswersChangeRef.current?.(answers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);
  const resumeScrolledRef = useRef(false);
  useEffect(() => {
    if (resumeScrolledRef.current || !initialResumeFieldName) return;
    resumeScrolledRef.current = true;
    const el = document.getElementById(`dyn-${initialResumeFieldName}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preparer block — prefilled ONLY from the logged-in preparer's real
  // profile. No profile = blank fields, labelled EXAMPLE / not-loaded.
  const [preparerName, setPreparerName] = useState(preparerProfile?.fullName ?? "");
  const [preparerCompany, setPreparerCompany] = useState(preparerProfile?.companyName ?? "");
  const [preparerCityState, setPreparerCityState] = useState(preparerProfile?.cityState ?? "");
  const [preparerPhone, setPreparerPhone] = useState(preparerProfile?.phone ?? "");
  const [preparerEmail, setPreparerEmail] = useState(preparerProfile?.email ?? "");

  const schemas: RegistryFormSchema[] = useMemo(
    () => schemasForSelectedForms(selected),
    [selected]
  );
  const unknown = useMemo(() => unknownFormCodes(selected), [selected]);
  const requiredFields = useMemo(() => requiredFieldsForSchemas(schemas), [schemas]);
  const timelineKinds = useMemo(() => timelineValidatorsForSchemas(schemas), [schemas]);
  const timelineRequired = timelineKinds.length > 0;
  const validation = useMemo(() => validateTimeline(entries), [entries]);
  const hasRedFlagForm = schemas.some((s) => s.redFlag);
  const hasRedFlagCase = hasRedFlagForm || redFlagCaseType !== "";

  // 5-year timeline gate: only the kinds the selected schemas require
  // can block. (validateTimeline checks both kinds; filter its gaps.)
  const blockingGaps = useMemo(() => {
    if (!timelineRequired) return [];
    return validation.gaps.filter((g) =>
      (g.kind === "address" && timelineKinds.includes("address_5yr")) ||
      (g.kind === "employment" && timelineKinds.includes("employment_5yr"))
    );
  }, [validation, timelineKinds, timelineRequired]);
  const timelineBlocked = blockingGaps.length > 0;

  // Expanded-form date validators (I-131 / I-751 / I-539 / I-129F):
  // the 90-day window, I-94 deadline, 2-year meeting rule, departure
  // date — pure date checks from the registry above.
  const mappedAnswers = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(answers)) {
      out[key] = value.mapped || value.original;
    }
    return out;
  }, [answers]);
  const expandedDateChecks = useMemo(() => {
    const out: Array<{ formCode: string; label: string; ok: boolean; message: string }> = [];
    for (const schema of schemas) {
      const expanded = isDynamicFormCode(schema.formCode)
        ? getDynamicSchema(schema.formCode)
        : null;
      if (!expanded) continue;
      for (const check of runTimelineValidators(expanded, mappedAnswers)) {
        out.push({ formCode: schema.formCode, ...check });
      }
    }
    return out;
  }, [schemas, mappedAnswers]);
  const expandedDateBlocked = expandedDateChecks.some((c) => !c.ok);

  // Unfilled required fields (timeline_5yr fields are covered by the
  // timeline gate, not this list; "note" fields are never answers).
  const unfilledRequired = useMemo(
    () =>
      requiredFields.filter(({ field }) => {
        if (field.type === "timeline_5yr") return false;
        const a = answers[field.name];
        return !(a && (a.mapped.trim() || a.original.trim()));
      }),
    [requiredFields, answers]
  );

  const preparerDisplayName =
    preparerProfile?.fullName?.trim() ||
    (preparerName.trim() ? `${preparerName.trim()} (not verified against a logged-in profile)` : "No preparer profile loaded");
  const preparerEditable = isPreparerMode && directionChecked;

  function toggleForm(code: string) {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function setAnswer(
    fieldName: string,
    part: "original" | "mapped",
    value: string
  ) {
    setAnswers((prev) => {
      const prevAnswer = prev[fieldName] ?? { original: "", mapped: "" };
      return {
        ...prev,
        [fieldName]: { ...prevAnswer, [part]: value },
      };
    });
  }

  function handleDirectionChange(checked: boolean) {
    setDirectionChecked(checked);
    if (checked) {
      setDirectionLog((log) => [
        ...log,
        {
          at: new Date().toISOString(),
          by: preparerDisplayName,
          note: "Client direction confirmed — preparer may fill or edit fields at the client's direction only.",
        },
      ]);
    }
  }

  function addTimelineEntry() {
    const label = newLabel.trim();
    if (!label || !newStart) return;
    setEntries((list) => [
      ...list,
      { id: `entry-${Date.now()}`, kind: newKind, label, start: newStart, end: newEnd || null },
    ]);
    setNewLabel("");
    setNewStart("");
    setNewEnd("");
  }

  /** Save answers to questionnaire_responses (original + mapped
   *  English, per migration 0005). Never logs any answer value —
   *  only question keys and counts. */
  async function saveAnswers(): Promise<boolean> {
    const answeredKeys = Object.keys(answers).filter((k) => {
      const a = answers[k];
      return a && (a.original.trim() || a.mapped.trim());
    });
    if (answeredKeys.length === 0) {
      setSaveStatus("Nothing to save yet — answer at least one question first.");
      return false;
    }
    const fieldByKey = new Map<string, { formCode: string; field: RegistryField }>();
    for (const schema of schemas) {
      for (const section of schema.sections) {
        for (const field of section.fields) {
          fieldByKey.set(field.name, { formCode: schema.formCode, field });
        }
      }
    }
    const supabase = getSupabase();
    if (!supabase || !clientId) {
      try {
        localStorage.setItem(
          `niptei-dynamic-intake-draft-${caseId}`,
          JSON.stringify({ answers, entries, selected, savedAt: new Date().toISOString() })
        );
      } catch {
        // Local draft save is best-effort only.
      }
      setSaveStatus(
        supabase
          ? "Saved as a local browser draft only — no client id was provided, so answers were NOT written to questionnaire_responses."
          : "Supabase is not connected in this build, so answers were saved as a local browser draft only — NOT written to questionnaire_responses. Connect Supabase before relying on server-side saves."
      );
      return false;
    }
    let saved = 0;
    const errors: string[] = [];
    for (const key of answeredKeys) {
      const meta = fieldByKey.get(key);
      if (!meta) continue;
      const value = answers[key];
      const { error: deleteError } = await supabase
        .from("questionnaire_responses")
        .delete()
        .eq("case_id", caseId)
        .eq("question_key", key);
      if (deleteError) {
        errors.push(`${key}: ${deleteError.message}`);
        continue;
      }
      const { error: insertError } = await supabase
        .from("questionnaire_responses")
        .insert({
          case_id: caseId,
          client_id: clientId,
          question_key: key,
          original_language: lang,
          original_value: value.original,
          mapped_english_value: value.mapped || value.original,
          form_code: meta.formCode,
          field_name: meta.field.label,
        });
      if (insertError) errors.push(`${key}: ${insertError.message}`);
      else saved += 1;
    }
    if (isPreparerMode && directionChecked && saved > 0) {
      setDirectionLog((log) => [
        ...log,
        {
          at: new Date().toISOString(),
          by: preparerDisplayName,
          note: `Saved ${saved} answer(s) to questionnaire_responses at the client's direction (question keys only — values are never written to this log).`,
        },
      ]);
    }
    setSaveStatus(
      errors.length > 0
        ? `Saved ${saved} of ${answeredKeys.length} answer(s) to questionnaire_responses. Errors: ${errors.join("; ")}`
        : `Saved ${saved} answer(s) to questionnaire_responses (original + mapped English).`
    );
    return errors.length === 0 && saved > 0;
  }

  /** Generate the DRAFT packet via the EXISTING /api/generate-packet
   *  route. Never shows a success message when the call fails or when
   *  no download link comes back — the real error is shown instead. */
  async function handleGeneratePacket() {
    setGenerateError(null);
    setPacket(null);
    if (!caseId || !UUID_RE.test(caseId)) {
      setGenerateError(
        "A real case id (cases.id, UUID) is required to generate a packet. Do not use a placeholder case id."
      );
      return;
    }
    if (selected.length === 0) {
      setGenerateError("Select at least one form before generating a packet.");
      return;
    }
    if (timelineBlocked) {
      setGenerateError(
        `Packet generation is blocked — the 5-year timeline has date gaps: ${blockingGaps
          .map((g) => `${g.kind}: ${g.label}`)
          .join("; ")}. Add entries to close every gap first.`
      );
      return;
    }
    if (expandedDateBlocked) {
      const failed = expandedDateChecks.filter((c) => !c.ok);
      setGenerateError(
        `Packet generation is blocked — date check failed: ${failed
          .map((c) => `[${c.formCode}] ${c.message}`)
          .join("; ")}`
      );
      return;
    }
    if (unfilledRequired.length > 0) {
      setGenerateError(
        `Packet generation is blocked — ${unfilledRequired.length} required question(s) are unfilled: ${unfilledRequired
          .slice(0, 5)
          .map(({ formCode, field }) => `[${formCode}] ${field.label}`)
          .join("; ")}${unfilledRequired.length > 5 ? "…" : ""}`
      );
      return;
    }
    if (!govPayment) {
      setGenerateError(
        "Choose how the USCIS government fee will be paid before generating a packet. Paper filings require G-1450 or G-1650 — no personal checks or money orders."
      );
      return;
    }
    if (isPreparerMode && !directionChecked) {
      setGenerateError(
        "In preparer mode the Mandatory User Direction checkbox must be checked first — the preparer may only fill or edit fields at the client's direction."
      );
      return;
    }
    setGenerateBusy(true);
    try {
      const preparerBlock = isPreparerMode
        ? {
            name: preparerName || null,
            company: preparerCompany || null,
            cityState: preparerCityState || null,
            phone: preparerPhone || null,
            email: preparerEmail || null,
            profileLoaded: Boolean(preparerProfile),
            notice: PREPARER_BLOCK_NOTICE,
          }
        : null;
      const res = await fetch("/api/generate-packet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          formCodes: selected,
          answers: mappedAnswers,
          timelines: entries,
          preparer_block: preparerBlock,
          gov_payment_authorization: govPayment,
          actorId: actorId ?? null,
          actorRole: actorRole ?? (isPreparerMode ? "preparer" : "client"),
        }),
      });
      let data: PacketResult & { error?: string; detail?: string } | null = null;
      try {
        data = (await res.json()) as PacketResult & { error?: string; detail?: string };
      } catch {
        data = null;
      }
      if (!res.ok) {
        setGenerateError(
          data?.error
            ? `Packet generation failed (${res.status}): ${data.error}${data.detail ? ` — ${data.detail}` : ""}`
            : `Packet generation failed (HTTP ${res.status}). No packet was generated.`
        );
        return;
      }
      const downloadUrl = data?.signedUrl ?? data?.downloadUrl;
      if (!downloadUrl) {
        setGenerateError(
          "Packet generation returned no download link. No packet is ready — this is a failure, not a success. Check the packet audit (100% required) and the balance, then try again."
        );
        return;
      }
      setPacket({ ...data, signedUrl: downloadUrl });
    } catch (e) {
      setGenerateError(
        `Packet generation failed: ${e instanceof Error ? e.message : String(e)}. No packet was generated.`
      );
    } finally {
      setGenerateBusy(false);
    }
  }

  function renderField(field: RegistryField) {
    if (field.type === "note") {
      return (
        <p key={field.name} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <strong>{field.label}: </strong>
          {field.note}
        </p>
      );
    }
    if (field.type === "timeline_5yr") {
      return (
        <p key={field.name} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <strong>{field.label}.</strong> Use the 5-Year Timeline Builder below — date gaps block
          submission. {field.help}
        </p>
      );
    }
    const value = answers[field.name] ?? { original: "", mapped: "" };
    const disabled = isPreparerMode && !directionChecked;
    const inputClass =
      "mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500";
    return (
      <div key={field.name} className="rounded border border-slate-200 p-3">
        <label htmlFor={`dyn-${field.name}`} className="block text-sm font-medium">
          {field.label}
          {field.required ? " *" : ""}
          {field.sensitive ? " (sensitive — masked)" : ""}
        </label>
        {field.help ? <p className="text-xs text-slate-500">{field.help}</p> : null}
        {field.type === "select" ? (
          <select
            id={`dyn-${field.name}`}
            value={value.mapped}
            disabled={disabled}
            onChange={(e) => {
              setAnswer(field.name, "mapped", e.target.value);
              setAnswer(field.name, "original", e.target.value);
            }}
            className={inputClass}
          >
            <option value="">— Choose —</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : field.type === "checkbox_group" ? (
          <div className="mt-2 space-y-1">
            {(field.options ?? []).map((opt) => {
              const checked = (value.mapped || "").split(", ").includes(opt);
              return (
                <label key={opt} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => {
                      const current = (value.mapped || "").split(", ").filter(Boolean);
                      const next = e.target.checked
                        ? [...current, opt]
                        : current.filter((c) => c !== opt);
                      setAnswer(field.name, "mapped", next.join(", "));
                      setAnswer(field.name, "original", next.join(", "));
                    }}
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
        ) : field.type === "date" ? (
          <input
            id={`dyn-${field.name}`}
            type="date"
            value={value.mapped}
            disabled={disabled}
            onChange={(e) => {
              setAnswer(field.name, "mapped", e.target.value);
              setAnswer(field.name, "original", e.target.value);
            }}
            className={inputClass}
          />
        ) : field.type === "number" ? (
          <input
            id={`dyn-${field.name}`}
            type="number"
            value={value.mapped}
            disabled={disabled}
            onChange={(e) => {
              setAnswer(field.name, "mapped", e.target.value);
              setAnswer(field.name, "original", e.target.value);
            }}
            className={inputClass}
          />
        ) : isLongText(field.name) ? (
          <textarea
            id={`dyn-${field.name}`}
            value={value.original}
            disabled={disabled}
            rows={3}
            onChange={(e) => setAnswer(field.name, "original", e.target.value)}
            className={inputClass}
          />
        ) : (
          <input
            id={`dyn-${field.name}`}
            type={field.sensitive ? "password" : "text"}
            autoComplete="off"
            value={field.sensitive ? value.mapped : value.original}
            disabled={disabled}
            onChange={(e) => {
              if (field.sensitive) {
                setAnswer(field.name, "mapped", e.target.value);
                setAnswer(field.name, "original", e.target.value);
              } else {
                setAnswer(field.name, "original", e.target.value);
              }
            }}
            className={inputClass}
          />
        )}
        {/* Mapped English (for the USCIS form) — not shown for
            select/date/number/checkbox, where the answer is already the
            mapped value. Sensitive values are shown masked only. */}
        {!field.sensitive &&
          (field.type === "text" || isLongText(field.name)) && (
            <div className="mt-2">
              <label htmlFor={`dyn-mapped-${field.name}`} className="text-xs font-semibold">
                Mapped English (for the USCIS form)
              </label>
              <input
                id={`dyn-mapped-${field.name}`}
                type="text"
                value={value.mapped}
                disabled={disabled}
                onChange={(e) => setAnswer(field.name, "mapped", e.target.value)}
                className={inputClass}
              />
            </div>
          )}
        {field.sensitive && value.mapped ? (
          <p className="mt-1 text-xs text-slate-500">
            Saved as {maskSensitiveValue(value.mapped)} — the full value is never shown here.
          </p>
        ) : null}
        {isPreparerMode && !directionChecked && (
          <p className="mt-1 text-xs text-slate-500">
            Locked until the Mandatory User Direction checkbox below is checked.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">
        {isPreparerMode ? "Document Preparer Intake" : "Self-File Intake (DIY)"}
      </h1>
      <p className="text-sm text-slate-600">
        One engine for DIY and preparer-assisted filing. Only the sections for the forms you
        selected are shown, in order. {DRAFT_SCHEMA_NOTICE}.
      </p>
      <p className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
        {UPL_BADGE_TEXT} A preparer prepares forms from your answers and documents — clerical
        help only, no legal advice, no G-28.
      </p>
      {!UUID_RE.test(caseId) ? (
        <p role="alert" className="rounded border border-red-600 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900">
          No real case id was provided for this intake. A real cases.id (UUID) is required —
          do not use a placeholder case id.
        </p>
      ) : null}

      {/* Attorney options — shown on EVERY form page, in BOTH modes. */}
      <AttorneyOptionsBar redFlag={hasRedFlagCase} />

      {/* Form selector — dynamically loads ONLY the selected sections. */}
      <section aria-labelledby="form-select-heading" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 id="form-select-heading" className="text-base font-semibold">
          Choose your forms
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Only the sections for the forms you tick are shown — nothing irrelevant. I-130A is
          included free with I-130.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ALL_REGISTRY_FORM_CODES.map((code) => {
            const schema = getRegistrySchema(code);
            return (
              <label key={code} className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(code)}
                  onChange={() => toggleForm(code)}
                />
                <span>
                  <strong>{code}</strong>
                  {schema ? ` — ${schema.title}` : ""}
                </span>
              </label>
            );
          })}
        </div>
        {unknown.length > 0 ? (
          <p className="mt-2 text-sm text-red-700">
            These form codes have no intake schema and are not shown: {unknown.join(", ")}.
          </p>
        ) : null}
        <label className="mt-3 flex items-center gap-2 text-sm">
          Red-flag case type (if any):
          <select
            value={redFlagCaseType}
            onChange={(e) => setRedFlagCaseType(e.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            <option value="">None of these</option>
            {RED_FLAG_CASE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          Answer language:
          <select
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
      </section>

      {/* Selected form sections — ONLY these render. */}
      {schemas.length === 0 ? (
        <p className="rounded border border-slate-300 bg-white p-4 text-sm">
          No forms selected yet. Tick at least one form above.
        </p>
      ) : null}
      {schemas.map((schema) => (
        <section
          key={schema.formCode}
          aria-labelledby={`form-${schema.formCode}`}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 id={`form-${schema.formCode}`} className="text-lg font-semibold">
            Form {schema.formCode} — {schema.title}
          </h2>
          <p className="mt-1 text-xs font-semibold text-slate-700">{schema.draftNotice}</p>
          {schema.includedFreeWith ? (
            <p className="mt-1 text-sm text-slate-600">
              Included free with Form {schema.includedFreeWith}.
            </p>
          ) : null}
          {schema.clericalOnly ? (
            <p className="mt-1 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
              Clerical prep only — this is not legal advice and nothing here guarantees any
              outcome.
            </p>
          ) : null}

          {/* Attorney options on EVERY form page, in BOTH modes. */}
          <div className="mt-3">
            <AttorneyOptionsBar compact redFlag={schema.redFlag || redFlagCaseType !== ""} formCode={schema.formCode} />
          </div>

          {schema.sections.map((section) => (
            <div key={section.id} className="mt-4">
              <h3 className="text-base font-semibold">{section.heading}</h3>
              {section.note ? (
                <p className="mt-1 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {section.note}
                </p>
              ) : null}
              <div className="mt-3 space-y-3">
                {section.fields.map((field) => renderField(field))}
              </div>
            </div>
          ))}

          {/* Document upload slots for THIS form only (from formChecklists). */}
          <div className="mt-4">
            <h3 className="text-base font-semibold">
              Documents for Form {schema.formCode}
            </h3>
            <p className="mt-1 text-xs text-slate-600">{schema.checklistCoverageNote}</p>
            <ul className="mt-2 space-y-2">
              {schema.documentSlots.map((slot) => (
                <li key={slot.id} className="rounded border border-slate-200 px-3 py-2 text-sm">
                  <strong>{slot.title}</strong>
                  <span className="text-slate-600">
                    {" "}— assigned to {slot.assignedTo}
                    {slot.translationRequired ? " — certified English translation required if not in English" : ""}
                    {slot.blocking ? " — blocking" : ""}
                    {slot.condition ? ` — ${slot.condition}` : ""}
                    {slot.source === "draft-intake-slot" ? " — DRAFT slot, verify at uscis.gov" : ""}
                  </span>
                  <div className="mt-1">
                    <label className="text-xs font-semibold">
                      Upload (file name recorded locally only — vault upload is not wired in
                      this build; use the portal vault upload)
                      <input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setUploadNames((prev) => ({ ...prev, [slot.id]: file.name }));
                          }
                        }}
                        className="mt-1 block text-xs"
                      />
                    </label>
                    {uploadNames[slot.id] ? (
                      <p className="mt-1 text-xs text-slate-600">
                        Chosen file: {uploadNames[slot.id]} (name only — not uploaded yet).
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      {/* 5-Year Timeline Builder — blocks date gaps (lib/validator.ts). */}
      {timelineRequired ? (
        <section aria-labelledby="timeline-heading" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 id="timeline-heading" className="text-base font-semibold">
            5-Year Timeline Builder
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Required for the selected form(s):{" "}
            {timelineKinds.map((k) => (k === "address_5yr" ? "5-year addresses" : "5-year employment")).join(" + ")}.
            Date gaps block packet generation — add an entry to close each gap.
          </p>
          {timelineBlocked ? (
            <div role="alert" className="mt-3 rounded border-2 border-red-600 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">Date gaps found — fix these before generating a packet:</p>
              <ul className="mt-1 list-disc pl-5">
                {blockingGaps.map((g, i) => (
                  <li key={`${g.kind}-${i}`}>
                    {g.kind}: {g.label} ({g.gapStart} to {g.gapEnd})
                  </li>
                ))}
              </ul>
              <p className="mt-1">Coverage: {validation.coveragePercent}%.</p>
            </div>
          ) : (
            <div role="status" className="mt-3 rounded border border-green-600 bg-green-50 p-3 text-sm text-green-800">
              No date gaps — 5-year timeline is complete (coverage {validation.coveragePercent}%).
            </div>
          )}
          <ul className="mt-3 space-y-2 text-sm">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2">
                <span>
                  <strong>{e.kind === "address" ? "Address" : "Employment"}:</strong> {e.label} —{" "}
                  {e.start} to {e.end ?? "present"}
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
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as "address" | "employment")}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal"
              >
                <option value="address">Address</option>
                <option value="employment">Employment</option>
              </select>
            </label>
            <label className="text-xs font-semibold md:col-span-2">
              Address / employer
              <input
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
                type="date"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal"
              />
            </label>
            <label className="text-xs font-semibold">
              End (blank = present)
              <input
                type="date"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={addTimelineEntry}
            className="mt-2 rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Add Timeline Entry
          </button>
        </section>
      ) : (
        <p className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No 5-year timeline is required for the selected form(s).
        </p>
      )}

      {/* Expanded-form date checks (I-751 window, I-539 I-94 deadline,
          I-129F 2-year meeting rule, I-131 departure date). */}
      {expandedDateChecks.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">Date checks for the selected forms</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {expandedDateChecks.map((c) => (
              <li key={`${c.formCode}-${c.label}`} className={c.ok ? "text-green-800" : "font-semibold text-red-800"}>
                [{c.formCode}] {c.label}: {c.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Preparer section — BLANK in DIY mode (locked DIY ladder rule). */}
      <section aria-labelledby="preparer-heading" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 id="preparer-heading" className="text-base font-semibold">
          Preparer Contact &amp; Signature Block
        </h2>
        <p className="mt-1 text-xs text-slate-600">{PREPARER_BLOCK_NOTICE}</p>
        {!isPreparerMode ? (
          <p className="mt-3 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            Left blank — DIY mode. No preparer is assigned and no preparer block is logged on
            any form. (Locked DIY ladder rule.)
          </p>
        ) : (
          <>
            {!preparerProfile ? (
              <p role="note" className="mt-3 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                EXAMPLE / not loaded — no logged-in preparer profile was passed in. These
                fields are blank until the logged-in preparer&apos;s professional_profiles row
                is loaded. Do not use an invented name, company, phone or email.
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                Loaded from the logged-in preparer&apos;s profile (professional_profiles).
              </p>
            )}
            <label className="mt-3 flex items-start gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={directionChecked}
                onChange={(e) => handleDirectionChange(e.target.checked)}
              />
              <span>
                Mandatory User Direction — I confirm the client directed me to fill in or edit
                these fields, and I am acting only at the client&apos;s direction. Every edit
                is logged with a timestamp below.
              </span>
            </label>
            {!directionChecked ? (
              <p className="mt-1 text-xs text-slate-500">
                Preparer fields stay locked until this box is checked.
              </p>
            ) : null}
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <label className="text-xs font-semibold">
                Preparer full name
                <input
                  type="text"
                  value={preparerName}
                  disabled={!preparerEditable}
                  onChange={(e) => setPreparerName(e.target.value)}
                  placeholder="Logged-in preparer's real name"
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm font-normal disabled:bg-slate-100"
                />
              </label>
              <label className="text-xs font-semibold">
                Company / organisation
                <input
                  type="text"
                  value={preparerCompany}
                  disabled={!preparerEditable}
                  onChange={(e) => setPreparerCompany(e.target.value)}
                  placeholder="Logged-in preparer's company"
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm font-normal disabled:bg-slate-100"
                />
              </label>
              <label className="text-xs font-semibold">
                City, State
                <input
                  type="text"
                  value={preparerCityState}
                  disabled={!preparerEditable}
                  onChange={(e) => setPreparerCityState(e.target.value)}
                  placeholder="e.g. Fort Pierce, FL"
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm font-normal disabled:bg-slate-100"
                />
              </label>
              <label className="text-xs font-semibold">
                Phone
                <input
                  type="text"
                  value={preparerPhone}
                  disabled={!preparerEditable}
                  onChange={(e) => setPreparerPhone(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm font-normal disabled:bg-slate-100"
                />
              </label>
              <label className="text-xs font-semibold md:col-span-2">
                Email
                <input
                  type="text"
                  value={preparerEmail}
                  disabled={!preparerEditable}
                  onChange={(e) => setPreparerEmail(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm font-normal disabled:bg-slate-100"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              This block is logged on every USCIS form in the packet, per the current form
              edition — verify the block location on the official form.
            </p>
            {directionLog.length > 0 ? (
              <div className="mt-3">
                <h3 className="text-sm font-semibold">Direction log (timestamped)</h3>
                <ul className="mt-1 space-y-1 text-xs text-slate-700">
                  {directionLog.map((entry, i) => (
                    <li key={i} className="rounded border border-slate-200 px-2 py-1">
                      {entry.at} — {entry.by} — {entry.note}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* Government payment — nothing pre-selected. */}
      <section aria-labelledby="govpay-heading" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 id="govpay-heading" className="text-base font-semibold">
          How will the USCIS government fee be paid?
        </h2>
        <p className="mt-1 text-sm font-semibold text-slate-800">{GOV_PAYMENT_RULE}</p>
        <p className="mt-1 text-xs text-slate-600">
          Nothing is pre-selected — choose one. The preparer fee and the USCIS government fee
          are always separate.
        </p>
        <div className="mt-3 space-y-2">
          {GOV_PAYMENT_OPTIONS.map((opt) => (
            <label key={opt.id} className="flex items-start gap-2 rounded border border-slate-200 px-3 py-2 text-sm">
              <input
                type="radio"
                name="gov-payment"
                checked={govPayment === opt.id}
                onChange={() => setGovPayment(opt.id)}
              />
              <span>
                <strong>{opt.label}</strong>
                <span className="block text-xs text-slate-600">{opt.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* Save + generate. */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Save &amp; generate your packet</h2>
        {unfilledRequired.length > 0 ? (
          <div className="mt-2 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p className="font-semibold">
              {unfilledRequired.length} required question(s) still unfilled:
            </p>
            <ul className="mt-1 list-disc pl-5">
              {unfilledRequired.slice(0, 10).map(({ formCode, field }) => (
                <li key={`${formCode}-${field.name}`}>
                  [{formCode}] {field.label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mt-2 text-xs text-slate-600">
          The packet audit gate (100% required) and the payment gate are enforced by the
          existing /api/generate-packet route — this page does not invent an audit score.
          USCIS templates come from uscis.gov only; field mappings are unverified and the
          packet lists every unfilled field.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void saveAnswers()}
            className="rounded bg-slate-700 px-4 py-2 text-sm font-semibold text-white"
          >
            Save answers
          </button>
          <button
            type="button"
            disabled={generateBusy}
            onClick={() => void handleGeneratePacket()}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {generateBusy ? "Generating…" : "Generate DRAFT packet"}
          </button>
        </div>
        {saveStatus ? (
          <p role="status" className="mt-2 text-sm text-slate-700">
            {saveStatus}
          </p>
        ) : null}
        {generateError ? (
          <p role="alert" className="mt-2 rounded border border-red-600 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
            {generateError}
          </p>
        ) : null}
        {packet ? (
          <div role="status" className="mt-2 rounded border border-green-600 bg-green-50 px-3 py-2 text-sm text-green-900">
            <p className="font-semibold">
              Generated — review and sign before you submit. This does not file your case.
            </p>
            <p className="mt-1">
              DRAFT packet{packet.pageCount ? ` — ${packet.pageCount} page(s)` : ""}.{" "}
              {packet.signedUrl ? (
                <a href={packet.signedUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  Download the DRAFT packet (link valid 24 hours)
                </a>
              ) : null}
            </p>
            {packet.unfilledFields && packet.unfilledFields.length > 0 ? (
              <div className="mt-2">
                <p className="font-semibold">Unfilled fields listed by the packet route:</p>
                <ul className="mt-1 list-disc pl-5">
                  {packet.unfilledFields.map((u, i) => (
                    <li key={i}>
                      [{u.formCode ?? "?"}] {u.fieldLabel ?? "Unfilled field"}
                      {u.reason ? ` — ${u.reason}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="mt-2 text-xs">
              E-Sign provider is not connected yet — review and sign outside this packet until
              it is. Nothing has been filed with USCIS.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

/**
 * The four help options, shown on EVERY form page in BOTH modes —
 * never buried in a menu, never hidden in DIY or preparer mode.
 * DIY $25, Review $99 and Human Review $199 are the prices recorded in
 * src/lib/serviceTiers.ts (brief-given, not repo-locked). The attorney
 * / DOJ directory is opt-in only, bar / DOJ verified, no per-lead or
 * percentage fees. A red-flag warning is a warning, NOT a lock.
 */
function AttorneyOptionsBar({
  compact = false,
  redFlag = false,
  formCode,
}: {
  compact?: boolean;
  redFlag?: boolean;
  formCode?: string;
}) {
  return (
    <section
      aria-label={`Help options${formCode ? ` for Form ${formCode}` : ""}`}
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 className={compact ? "text-sm font-semibold" : "text-base font-semibold"}>
        Choose how you want help — all four options, on every form
      </h2>
      {redFlag ? (
        <p role="alert" className="mt-2 rounded border border-red-600 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900">
          {RED_FLAG_WARNING}
        </p>
      ) : null}
      <p className="mt-2 text-sm font-semibold text-red-900">{ATTORNEY_OPTION_LINE}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded border border-slate-300 px-3 py-2 text-sm">
          <strong>DIY — $25</strong>
          <p className="text-xs text-slate-600">
            Self-serve. You answer the questions and file yourself. No assigned professional.
          </p>
        </div>
        <div className="rounded border border-slate-300 px-3 py-2 text-sm">
          <strong>Preparer</strong>
          <p className="text-xs text-slate-600">
            Clerical help only — a preparer prepares the forms from your answers. No legal
            advice, no G-28.
          </p>
        </div>
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm">
          <strong>Attorney</strong>
          <p className="text-xs text-slate-600">
            A licensed attorney can protect you. Only an attorney gives legal advice.
          </p>
        </div>
        <div className="rounded border border-slate-300 px-3 py-2 text-sm">
          <strong>DOJ-Accredited Representative</strong>
          <p className="text-xs text-slate-600">
            A DOJ-accredited representative, within their accreditation.
          </p>
        </div>
      </div>
      <div className="mt-3">
        <GetAnAttorneyButtons reason={redFlag ? "a red-flag case" : undefined} />
      </div>
      <p className="mt-2 text-sm text-slate-700">
        Extra help if you want it: <strong>Review — $99</strong> (one provider document-review
        pass) or <strong>Human Review — $199</strong> (a preparer reviews your work and
        messages you). Neither is legal advice and neither files your case.
      </p>
      <p className="mt-1 text-xs text-slate-600">
        Attorneys and DOJ representatives in the directory are opt-in only and bar / DOJ
        verified. No per-lead or percentage fees are ever charged for a referral. You are
        never locked into one option — you can change your mind at any time.
      </p>
    </section>
  );
}
