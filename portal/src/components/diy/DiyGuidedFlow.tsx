// Guided DIY filing flow — client component.
//
// Steps (one at a time, in order):
//   1. Choose your form (the 15-schema registry — nothing else).
//   2. Answer the questions — the EXISTING Dynamic Intake Engine,
//      mounted once per form in client_diy mode. The preparer section
//      stays blank in DIY mode (the engine's locked rule) and the
//      AttorneyOptionsBar shows on every form page in both modes.
//      This component does NOT rebuild the engine.
//   3. Review a watermarked preview of your filled answers (free).
//   4. Pay to unlock — DIY $25 for this form, or DIY Bundle $99.
//   5. Print / save / email the completed packet, plus the document
//      checklist, a draft cover letter and the submission-order guide.
//
// Pay gate: answering is free; print / save / email stay locked until
// payment is confirmed in the database. The buttons in this file are
// NOT the gate — the gate is server-side in src/lib/diy.ts and
// enforced by /api/diy/packet and /api/diy/email-packet (402 when
// unpaid). This component only shows the locked/unlocked state the
// server reports (/api/diy/unlock-status).
//
// Copy deterrent (step 3 preview): text selection, right-click copy
// and copy/print shortcuts are disabled and the preview is
// watermarked — but that is a DETERRENT, not a guarantee (see
// DIY_COPY_DETERRENT_LABEL in src/lib/diy.ts). A phone camera or the
// browser's own print can still capture a screen. The pay gate is
// what protects the work.
//
// Sensitive values (DOB, A-Number, SSN, passport number) are shown
// masked only (***-**-1234), never in full, never logged. The preview
// reads the client's own saved answers from questionnaire_responses
// (migration 0005) — it never invents answers.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DynamicFormIntakeEngine from "@/components/DynamicFormIntakeEngine";
import CheckoutButton from "@/components/CheckoutButton";
import FormChainProgress from "@/components/diy/FormChainProgress";
import {
  chainForForm,
  chainProgress as computeChainProgress,
  type ChainFormUnlock,
} from "@/lib/formChains";
import { getSupabase } from "@/lib/supabase";
import {
  ALL_REGISTRY_FORM_CODES,
  DRAFT_SCHEMA_NOTICE,
  getRegistrySchema,
  maskSensitiveValue,
} from "@/lib/dynamicIntakeSchemas";
import {
  DIY_COPY_DETERRENT_LABEL,
  DIY_PAY_FIRST_TEXT,
  DIY_PREVIEW_WATERMARK,
  diyBundlePrice,
  diyFormMeta,
  diySinglePrice,
} from "@/lib/diy";
import {
  buildDiyCoverLetter,
  checklistTitlesForForm,
  submissionGuideForForms,
} from "@/lib/diySubmission";
import { checklistSlotsForForm } from "@/lib/dynamicIntakeSchemas";
import {
  diyCompletionStatus,
  resumePositionFor,
  type DiyCompletionStatus,
} from "@/lib/diyTransfer";
import type { DiyDraftAnswers } from "@/lib/diyDrafts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface UnlockState {
  kind: "unknown" | "checking" | "unlocked" | "locked" | "no-case" | "no-session" | "not-configured";
  reason?: string;
  unlockedBy?: string | null;
  accountId?: string;
  callerEmail?: string | null;
}

interface PreviewAnswer {
  questionKey: string;
  fieldName: string;
  value: string;
  sensitive: boolean;
}

interface PacketState {
  kind: "idle" | "loading" | "ready" | "error";
  signedUrl?: string;
  pageCount?: number;
  error?: string;
  auditScore?: number;
}

const STEPS = [
  { n: 1, label: "Choose your form" },
  { n: 2, label: "Answer the questions" },
  { n: 3, label: "Review your preview" },
  { n: 4, label: "Pay to unlock" },
  { n: 5, label: "Print, save & email" },
];

export default function DiyGuidedFlow({
  caseId,
  initialFormCode,
}: {
  caseId: string;
  initialFormCode?: string | null;
}) {
  const [step, setStep] = useState(1);
  const [formCode, setFormCode] = useState(
    initialFormCode && ALL_REGISTRY_FORM_CODES.includes(initialFormCode)
      ? initialFormCode
      : "I-485"
  );
  const [unlock, setUnlock] = useState<UnlockState>({ kind: "unknown" });
  const [preview, setPreview] = useState<PreviewAnswer[] | null>(null);
  const [previewNote, setPreviewNote] = useState<string | null>(null);
  const [packet, setPacket] = useState<PacketState>({ kind: "idle" });
  const [emailState, setEmailState] = useState<{ kind: "idle" | "loading" | "done" | "error"; message?: string }>({ kind: "idle" });

  // --- Save-and-resume (founder addition, Nov 28, 2026) -----------------
  // Every answer is saved AS THE CLIENT GOES to public.diy_drafts
  // (migration 0023) via /api/diy/drafts — database, never only the
  // browser — with the resume position (the exact question left off),
  // so the client can leave, close the tab, change device, and come
  // back to the same question. Saving is debounced + automatic on
  // answer change; the explicit button below saves now and returns
  // the client to their dashboard.
  const router = useRouter();
  interface LoadedDraft {
    id: string;
    answers: DiyDraftAnswers;
    currentSectionIndex: number;
    currentQuestionIndex: number;
    currentFieldName: string | null;
    status: string;
    lastSavedAt: string | null;
  }
  const [draft, setDraft] = useState<LoadedDraft | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [saveState, setSaveState] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved"; at: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [progress, setProgress] = useState<DiyCompletionStatus | null>(null);
  const latestFlatAnswersRef = useRef<DiyDraftAnswers>({});
  const lastSavedJsonRef = useRef<string>("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveAndExitBusyRef = useRef(false);

  // --- Automatic transfer on completion ----------------------------------
  // Once ALL questions are answered, POST /api/diy/transfer moves the
  // answers into the immigration form (questionnaire_responses → the
  // existing USCIS mappings → /api/generate-packet) and returns the
  // checklist, draft cover letter and submission guide. It runs
  // automatically when the client reaches step 5 with a complete form
  // and a confirmed payment — never for a half-finished form, never
  // before the pay gate passes (the route enforces both, 409 / 402).
  const [transfer, setTransfer] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | {
        kind: "done";
        transferredCount: number;
        mappedAnswered: number;
        mappedTotal: number;
        mustEnterOnForm: string[];
        packetGenerated: boolean;
        packetUrl?: string;
        packetError?: string;
      }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const transferRanRef = useRef<string>("");

  const hasCase = UUID_RE.test(caseId);
  const meta = diyFormMeta(formCode);
  // --- Form chaining -------------------------------------------------
  // The chain the current form belongs to (Green Card Bundle, TPS+EAD,
  // or Consular/NVC), or null for standalone forms. Progress comes from
  // the server (/api/diy/chain-status: saved answers + submitted drafts
  // for "completed", the DIY pay gate for per-form unlock) merged with
  // forms finished in this session (localCompleted). A form not yet
  // reached is locked, never completed; a completed form is revisitable.
  const chain = useMemo(() => chainForForm(formCode), [formCode]);
  const [chainServer, setChainServer] = useState<{
    completed: string[];
    unlockByForm: Record<string, ChainFormUnlock>;
  } | null>(null);
  const [localCompleted, setLocalCompleted] = useState<string[]>([]);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);

  const getToken = useCallback(async (): Promise<string | null> => {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const fetchChainStatus = useCallback(async () => {
    if (!hasCase || !chain) {
      setChainServer(null);
      return;
    }
    const token = await getToken();
    if (!token) {
      setChainServer(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/diy/chain-status?caseId=${encodeURIComponent(caseId)}&formCode=${encodeURIComponent(formCode)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const body = (await res.json().catch(() => ({}))) as {
        completedFormCodes?: string[];
        steps?: Array<{ formCode: string; unlock?: ChainFormUnlock }>;
      };
      if (!res.ok || !Array.isArray(body.completedFormCodes)) {
        setChainServer(null);
        return;
      }
      const unlockByForm: Record<string, ChainFormUnlock> = {};
      for (const s of body.steps ?? []) {
        if (s.unlock) unlockByForm[s.formCode] = s.unlock;
      }
      setChainServer({ completed: body.completedFormCodes, unlockByForm });
    } catch {
      setChainServer(null);
    }
  }, [caseId, formCode, hasCase, chain, getToken]);

  useEffect(() => {
    void fetchChainStatus();
  }, [fetchChainStatus]);

  const mergedCompleted = useMemo(
    () =>
      Array.from(new Set([...(chainServer?.completed ?? []), ...localCompleted])),
    [chainServer, localCompleted]
  );
  const chainProgressValue = useMemo(
    () => (chain ? computeChainProgress(chain, mergedCompleted) : null),
    [chain, mergedCompleted]
  );

  /** The client finished answering this form: mark it completed in
   *  this session (the server also sees it once the engine saves the
   *  answers) and move to the watermarked preview. The chain panel
   *  then shows the NEXT form with its reason. */
  function finishAnswering() {
    setLocalCompleted((prev) =>
      prev.includes(formCode) ? prev : [...prev, formCode]
    );
    setJustCompleted(formCode);
    setStep(3);
  }

  /** Jump to a completed / current chain form's questions. */
  function selectChainForm(code: string) {
    setJustCompleted(null);
    setPacket({ kind: "idle" });
    setEmailState({ kind: "idle" });
    setFormCode(code);
    setStep(2);
  }

  /** Go to pay-to-unlock for a locked chain form. */
  function payForChainForm(code: string) {
    setJustCompleted(null);
    setFormCode(code);
    setStep(4);
  }
  const single = useMemo(() => diySinglePrice(), []);
  const bundle = useMemo(() => diyBundlePrice(), []);
  const guide = useMemo(() => submissionGuideForForms([formCode]), [formCode]);
  const coverLetter = useMemo(
    () =>
      buildDiyCoverLetter({
        clientName: null,
        formCodes: [formCode],
        dateIso: new Date().toISOString().slice(0, 10),
      }),
    [formCode]
  );

  const checkUnlock = useCallback(async () => {
    if (!hasCase) {
      setUnlock({ kind: "no-case" });
      return;
    }
    setUnlock({ kind: "checking" });
    const token = await getToken();
    if (!token) {
      setUnlock({ kind: "no-session" });
      return;
    }
    try {
      const res = await fetch(
        `/api/diy/unlock-status?caseId=${encodeURIComponent(caseId)}&formCode=${encodeURIComponent(formCode)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const body = (await res.json().catch(() => ({}))) as {
        allowed?: boolean;
        reason?: string;
        unlockedBy?: string | null;
        configured?: boolean;
        accountId?: string;
        callerEmail?: string | null;
      };
      if (res.status === 501 || body.configured === false) {
        setUnlock({ kind: "not-configured", reason: body.reason });
        return;
      }
      if (body.allowed) {
        setUnlock({
          kind: "unlocked",
          reason: body.reason,
          unlockedBy: body.unlockedBy ?? null,
          accountId: body.accountId,
          callerEmail: body.callerEmail ?? null,
        });
      } else {
        setUnlock({
          kind: "locked",
          reason: body.reason ?? DIY_PAY_FIRST_TEXT,
          accountId: body.accountId,
          callerEmail: body.callerEmail ?? null,
        });
      }
    } catch {
      setUnlock({ kind: "not-configured", reason: "Could not reach the unlock check. Nothing is unlocked until the payment records are checked." });
    }
  }, [caseId, formCode, hasCase, getToken]);

  useEffect(() => {
    void checkUnlock();
  }, [checkUnlock]);

  // --- Save-and-resume wiring --------------------------------------------
  const flattenEngineAnswers = useCallback(
    (answers: Record<string, { original: string; mapped: string }>): DiyDraftAnswers => {
      const flat: DiyDraftAnswers = {};
      for (const [key, value] of Object.entries(answers)) {
        const v = (value.mapped || value.original || "").trim();
        if (v) flat[key] = value.mapped || value.original;
      }
      return flat;
    },
    []
  );

  const loadDraft = useCallback(async () => {
    setDraftLoaded(false);
    setDraft(null);
    setProgress(null);
    latestFlatAnswersRef.current = {};
    lastSavedJsonRef.current = "";
    if (!hasCase) {
      setDraftLoaded(true);
      return;
    }
    const token = await getToken();
    if (!token) {
      setDraftLoaded(true);
      return;
    }
    try {
      const res = await fetch(
        `/api/diy/drafts?caseId=${encodeURIComponent(caseId)}&formCode=${encodeURIComponent(formCode)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.status === 404) {
        setDraftLoaded(true);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as {
        drafts?: Array<{
          id: string;
          answers?: Record<string, string>;
          currentSectionIndex?: number;
          currentQuestionIndex?: number;
          currentFieldName?: string | null;
          status?: string;
          lastSavedAt?: string | null;
        }>;
      };
      const row = (body.drafts ?? [])[0];
      if (row) {
        const answers = (row.answers ?? {}) as DiyDraftAnswers;
        setDraft({
          id: row.id,
          answers,
          currentSectionIndex: row.currentSectionIndex ?? 0,
          currentQuestionIndex: row.currentQuestionIndex ?? 0,
          currentFieldName: row.currentFieldName ?? null,
          status: row.status ?? "in_progress",
          lastSavedAt: row.lastSavedAt ?? null,
        });
        latestFlatAnswersRef.current = answers;
        lastSavedJsonRef.current = JSON.stringify(answers);
        setProgress(diyCompletionStatus(formCode, answers));
        if (row.lastSavedAt) setSaveState({ kind: "saved", at: row.lastSavedAt });
      }
    } catch {
      // Draft load failure never blocks answering: the engine starts
      // empty and the first autosave creates the draft.
    } finally {
      setDraftLoaded(true);
    }
  }, [caseId, formCode, hasCase, getToken]);

  useEffect(() => {
    void loadDraft();
  }, [loadDraft]);

  const saveDraftNow = useCallback(
    async (flatAnswers: DiyDraftAnswers): Promise<boolean> => {
      if (!hasCase) return false;
      const token = await getToken();
      if (!token) return false;
      const json = JSON.stringify(flatAnswers);
      if (json === lastSavedJsonRef.current) return true;
      setSaveState({ kind: "saving" });
      const position = resumePositionFor(formCode, flatAnswers);
      try {
        const res = await fetch("/api/diy/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            caseId,
            formCode,
            answers: flatAnswers,
            currentSectionIndex: position?.sectionIndex ?? 0,
            currentQuestionIndex: position?.questionIndex ?? 0,
            currentFieldName: position?.fieldName ?? null,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          lastSavedAt?: string;
          updatedAt?: string;
          error?: string;
        };
        if (!res.ok) {
          setSaveState({
            kind: "error",
            message: body.error ?? `Could not save your answers (HTTP ${res.status}). Nothing was lost from this screen — keep answering and try saving again.`,
          });
          return false;
        }
        lastSavedJsonRef.current = json;
        const at = body.lastSavedAt ?? body.updatedAt ?? new Date().toISOString();
        setDraft((prev) =>
          prev
            ? { ...prev, answers: flatAnswers, lastSavedAt: at }
            : {
                id: "",
                answers: flatAnswers,
                currentSectionIndex: position?.sectionIndex ?? 0,
                currentQuestionIndex: position?.questionIndex ?? 0,
                currentFieldName: position?.fieldName ?? null,
                status: "in_progress",
                lastSavedAt: at,
              }
        );
        setSaveState({ kind: "saved", at });
        return true;
      } catch (e) {
        setSaveState({
          kind: "error",
          message: `Could not save your answers: ${e instanceof Error ? e.message : String(e)}. Nothing was lost from this screen.`,
        });
        return false;
      }
    },
    [caseId, formCode, hasCase, getToken]
  );

  /** Engine callback: every answer change updates progress and
   *  schedules a debounced autosave (900 ms). Never logs values. */
  const handleEngineAnswersChange = useCallback(
    (answers: Record<string, { original: string; mapped: string }>) => {
      const flat = flattenEngineAnswers(answers);
      latestFlatAnswersRef.current = flat;
      setProgress(diyCompletionStatus(formCode, flat));
      if (!hasCase) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void saveDraftNow(flat);
      }, 900);
    },
    [flattenEngineAnswers, formCode, hasCase, saveDraftNow]
  );

  /** Explicit "Save and come back later": save now, then dashboard. */
  async function saveAndComeBackLater() {
    if (saveAndExitBusyRef.current) return;
    saveAndExitBusyRef.current = true;
    try {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      await saveDraftNow(latestFlatAnswersRef.current);
      router.push("/client-dashboard");
    } finally {
      saveAndExitBusyRef.current = false;
    }
  }

  // --- Automatic transfer --------------------------------------------------
  const runTransfer = useCallback(async () => {
    if (!hasCase) return;
    const token = await getToken();
    if (!token) {
      setTransfer({ kind: "error", message: "Sign in first — the transfer runs only for your signed-in account." });
      return;
    }
    setTransfer({ kind: "loading" });
    try {
      const res = await fetch("/api/diy/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ caseId, formCode }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        transferredCount?: number;
        transfer?: {
          mappedFields?: Array<{ answered?: boolean }>;
          mustEnterOnForm?: Array<{ label?: string; name?: string }>;
        };
        packet?: {
          generated?: boolean;
          signedUrl?: string;
          downloadUrl?: string;
          error?: string;
          status?: number;
        };
        error?: string;
        missing?: Array<{ label?: string; name?: string }>;
      };
      if (!res.ok) {
        setTransfer({
          kind: "error",
          message: body.error
            ? `Transfer did not run (${res.status}): ${body.error}`
            : `Transfer did not run (HTTP ${res.status}). Your answers are still saved — nothing was lost.`,
        });
        return;
      }
      const mapped = body.transfer?.mappedFields ?? [];
      setTransfer({
        kind: "done",
        transferredCount: body.transferredCount ?? 0,
        mappedAnswered: mapped.filter((f) => f.answered).length,
        mappedTotal: mapped.length,
        mustEnterOnForm: (body.transfer?.mustEnterOnForm ?? []).map(
          (f) => f.label ?? f.name ?? ""
        ).filter(Boolean),
        packetGenerated: body.packet?.generated === true,
        packetUrl: body.packet?.signedUrl ?? body.packet?.downloadUrl,
        packetError: body.packet?.generated === true ? undefined : body.packet?.error,
      });
      if (body.packet?.generated === true && (body.packet.signedUrl ?? body.packet.downloadUrl)) {
        setPacket({
          kind: "ready",
          signedUrl: body.packet.signedUrl ?? body.packet.downloadUrl,
        });
      }
      setDraft((prev) => (prev ? { ...prev, status: "transferred" } : prev));
    } catch (e) {
      setTransfer({
        kind: "error",
        message: `Transfer failed: ${e instanceof Error ? e.message : String(e)}. Your answers are still saved — nothing was lost.`,
      });
    }
  }, [caseId, formCode, hasCase, getToken]);

  // Auto-run the transfer when the client reaches step 5 with a
  // complete form and a confirmed payment — once per case + form.
  useEffect(() => {
    if (step !== 5) return;
    if (unlock.kind !== "unlocked") return;
    if (!progress?.complete) return;
    const key = `${caseId}:${formCode}`;
    if (transferRanRef.current === key) return;
    transferRanRef.current = key;
    void runTransfer();
  }, [step, unlock.kind, progress?.complete, caseId, formCode, runTransfer]);

  // Reset the transfer run-guard when the form changes.
  useEffect(() => {
    transferRanRef.current = "";
    setTransfer({ kind: "idle" });
    setPacket({ kind: "idle" });
    setEmailState({ kind: "idle" });
  }, [formCode]);

  const loadPreview = useCallback(async () => {
    setPreview(null);
    setPreviewNote(null);
    const sb = getSupabase();
    if (!sb) {
      setPreviewNote("Supabase is not connected in this build, so your saved answers cannot be loaded for the preview. Answer the questions in step 2 and save them — the preview loads from your saved answers once Supabase is connected.");
      return;
    }
    if (!hasCase) {
      setPreviewNote("No real case is selected, so there are no saved answers to preview yet. Open this flow from your case in the portal (link with ?caseId=<your case id>), answer the questions in step 2 and save them — then the preview shows your filled answers here, watermarked.");
      return;
    }
    const schema = getRegistrySchema(formCode);
    const sensitiveKeys = new Set<string>();
    const labelsByKey = new Map<string, string>();
    if (schema) {
      for (const section of schema.sections) {
        for (const field of section.fields) {
          labelsByKey.set(field.name, field.label);
          if (field.sensitive) sensitiveKeys.add(field.name);
        }
      }
    }
    // Preview reads the SAVED DRAFT first (migration 0023) — it is
    // the freshest copy, autosaved as the client answers. Only when
    // there is no draft does it fall back to questionnaire_responses
    // (the engine's manual Save target). Nothing is invented either way.
    try {
      const token = await getToken();
      if (token) {
        const draftRes = await fetch(
          `/api/diy/drafts?caseId=${encodeURIComponent(caseId)}&formCode=${encodeURIComponent(formCode)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (draftRes.ok) {
          const draftBody = (await draftRes.json().catch(() => ({}))) as {
            drafts?: Array<{ answers?: Record<string, string> }>;
          };
          const draftAnswers = (draftBody.drafts ?? [])[0]?.answers ?? {};
          const draftKeys = Object.keys(draftAnswers).filter(
            (k) => (draftAnswers[k] ?? "").trim() !== ""
          );
          if (draftKeys.length > 0) {
            setPreview(
              draftKeys.map((key) => {
                const sensitive = sensitiveKeys.has(key);
                const value = String(draftAnswers[key] ?? "");
                return {
                  questionKey: key,
                  fieldName: labelsByKey.get(key) ?? key,
                  value: sensitive ? maskSensitiveValue(value) : value,
                  sensitive,
                };
              })
            );
            return;
          }
        }
      }
    } catch {
      // Draft read failed — fall through to questionnaire_responses.
    }
    const { data, error } = await sb
      .from("questionnaire_responses")
      .select("question_key, mapped_english_value, form_code, field_name")
      .eq("case_id", caseId)
      .eq("form_code", formCode);
    if (error) {
      setPreviewNote(`Your saved answers could not be loaded (${error.message}). Nothing is shown instead of an invented preview.`);
      return;
    }
    const rows = ((data ?? []) as Record<string, unknown>[]);
    if (rows.length === 0) {
      setPreviewNote("No answers are saved for this form yet. Answer the questions in step 2 — they save automatically as you go — then come back here and the preview shows your filled answers, watermarked.");
      return;
    }
    setPreview(
      rows.map((r) => {
        const key = String(r.question_key ?? "");
        const sensitive = sensitiveKeys.has(key);
        const value = String(r.mapped_english_value ?? "");
        return {
          questionKey: key,
          fieldName: String(r.field_name ?? key),
          value: sensitive ? maskSensitiveValue(value) : value,
          sensitive,
        };
      })
    );
  }, [formCode, hasCase, caseId, getToken]);

  useEffect(() => {
    if (step === 3) {
      void loadPreview();
      void fetchChainStatus();
    }
  }, [step, loadPreview, fetchChainStatus]);

  async function fetchPacket() {
    if (!hasCase) {
      setPacket({ kind: "error", error: "A real case id is required to generate a packet." });
      return;
    }
    setPacket({ kind: "loading" });
    const token = await getToken();
    if (!token) {
      setPacket({ kind: "error", error: "Sign in first — the packet is served only after the server checks your payment." });
      return;
    }
    try {
      const res = await fetch("/api/diy/packet", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ caseId, formCode }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        signedUrl?: string;
        downloadUrl?: string;
        pageCount?: number;
        auditScore?: number;
        error?: string;
        detail?: string;
        code?: string;
      };
      if (!res.ok || !(body.signedUrl ?? body.downloadUrl)) {
        setPacket({
          kind: "error",
          error: body.error
            ? `Packet not ready (${res.status}): ${body.error}${body.detail ? ` — ${body.detail}` : ""}`
            : `Packet request failed (HTTP ${res.status}). Nothing was generated.`,
        });
        return;
      }
      setPacket({
        kind: "ready",
        signedUrl: body.signedUrl ?? body.downloadUrl,
        pageCount: body.pageCount,
        auditScore: body.auditScore,
      });
    } catch (e) {
      setPacket({ kind: "error", error: `Packet request failed: ${e instanceof Error ? e.message : String(e)}. Nothing was generated.` });
    }
  }

  async function emailPacket() {
    if (!hasCase) return;
    setEmailState({ kind: "loading" });
    const token = await getToken();
    if (!token) {
      setEmailState({ kind: "error", message: "Sign in first — the email is sent only after the server checks your payment." });
      return;
    }
    try {
      const res = await fetch("/api/diy/email-packet", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ caseId, formCode }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string; sentTo?: string };
      if (!res.ok) {
        setEmailState({ kind: "error", message: body.error ?? `Email could not be sent (HTTP ${res.status}). Nothing was sent.` });
        return;
      }
      setEmailState({ kind: "done", message: body.message ?? "Email sent." });
    } catch (e) {
      setEmailState({ kind: "error", message: `Email could not be sent: ${e instanceof Error ? e.message : String(e)}. Nothing was sent.` });
    }
  }

  function blockCopyKey(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && ["c", "x", "p", "s", "a"].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  }

  const unlocked = unlock.kind === "unlocked";

  // Save-and-resume: expand the saved draft's flat answers into the
  // engine's { original, mapped } shape. Memoised on the draft so the
  // engine (keyed per form + draft) mounts with the restored answers.
  const engineInitialAnswers = useMemo(() => {
    if (!draft) return null;
    const out: Record<string, { original: string; mapped: string }> = {};
    for (const [key, value] of Object.entries(draft.answers)) {
      out[key] = { original: value, mapped: value };
    }
    return out;
  }, [draft]);

  return (
    <div className="space-y-4">
      <p className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
        Immigration with NIPTEI is a document-preparation service, not a law firm, and is not
        affiliated with USCIS. Only a licensed attorney or DOJ-accredited representative gives
        legal advice. This system never files for you — you review and sign before anything is
        submitted. {DRAFT_SCHEMA_NOTICE}.
      </p>

      {/* Fee up front — shown BEFORE step 1, before the client
          answers anything. The fee is for the guided help +
          print/save/email unlock; answering the questions is free.
          When the unlock is already paid, this says "Already paid"
          instead of showing a pay button — never charge twice. */}
      <div
        aria-label="DIY fee — shown before you start"
        className={`rounded border px-3 py-2 text-sm ${
          unlock.kind === "unlocked"
            ? "border-green-600 bg-green-50 text-green-900"
            : "border-amber-400 bg-amber-50 text-amber-900"
        }`}
      >
        {unlock.kind === "unlocked" ? (
          <>
            <p className="font-semibold">
              Already paid — you will not be charged again for this unlock.
            </p>
            <p className="mt-1">{unlock.reason}</p>
          </>
        ) : (
          <>
            <p className="font-semibold">
              Before you start — the DIY fee: {single.label} — $
              {(single.amountCents / 100).toFixed(2)} for Form {formCode},
              or {bundle.label} — ${(bundle.amountCents / 100).toFixed(2)}{" "}
              for every DIY form on this case.
            </p>
            <p className="mt-1">
              That fee covers the guided help plus the print / save / email
              unlock of your completed application. Answering the questions
              (steps 1–3) is free — you only pay in step 4, and print /
              save / email unlock only once the payment is confirmed in
              our records. USCIS government fees are separate and are never
              part of this payment — confirm the current USCIS fee at
              uscis.gov/fees before you pay.
            </p>
          </>
        )}
      </div>

      {/* Step rail */}
      <ol className="flex flex-wrap gap-2" aria-label="DIY steps">
        {STEPS.map((s) => (
          <li key={s.n}>
            <button
              type="button"
              onClick={() => setStep(s.n)}
              aria-current={step === s.n ? "step" : undefined}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                step === s.n ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {s.n}. {s.label}
            </button>
          </li>
        ))}
      </ol>

      {/* Form chain — what comes next, in order, and what is paid. */}
      {chainProgressValue ? (
        <FormChainProgress
          progress={chainProgressValue}
          unlockByForm={chainServer?.unlockByForm ?? {}}
          justCompletedFormCode={justCompleted}
          onSelectForm={selectChainForm}
          onPayForForm={payForChainForm}
          onStartNext={selectChainForm}
        />
      ) : null}

      {/* Step 1 — choose form */}
      {step === 1 && (
        <section aria-labelledby="diy-form-heading" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 id="diy-form-heading" className="text-base font-semibold">Step 1 — Choose your form</h2>
          <p className="mt-1 text-sm text-slate-600">
            Pick one form. You answer its questions in step 2 — only that form&apos;s sections are
            shown, one form at a time. I-130A is included free with I-130.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {ALL_REGISTRY_FORM_CODES.map((code) => {
              const schema = getRegistrySchema(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => { setFormCode(code); setStep(2); }}
                  aria-pressed={formCode === code}
                  className={`rounded border px-3 py-2 text-left text-sm ${
                    formCode === code ? "border-blue-600 bg-blue-50" : "border-slate-300 bg-white"
                  }`}
                >
                  <strong>Form {code}</strong>
                  <span className="block text-xs text-slate-600">{schema?.title ?? ""}</span>
                  <span className="mt-1 block text-xs font-semibold text-slate-700">{DRAFT_SCHEMA_NOTICE}.</span>
                </button>
              );
            })}
          </div>
          {!hasCase && (
            <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No case selected — open this flow from your case in the portal (link with
              ?caseId=&lt;your case id&gt;) so answers save against a real case. You can still
              answer the questions; generating a packet needs a real case id.
            </p>
          )}
        </section>
      )}

      {/* Step 2 — the engine, one form, DIY mode */}
      {step === 2 && (
        <section aria-labelledby="diy-answer-heading" className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 id="diy-answer-heading" className="text-base font-semibold">
              Step 2 — Answer the questions for Form {formCode}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {meta ? meta.title : ""} — {meta?.sectionCount ?? 0} section(s), in order.{" "}
              {meta?.editionNote ?? ""}
            </p>
            {meta?.redFlag ? (
              <p role="alert" className="mt-2 rounded border border-red-600 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900">
                This is a red-flag case type. We strongly recommend talking to a licensed attorney
                or a DOJ-accredited representative before you file. This is a warning, not a lock.
              </p>
            ) : null}
            {/* Save-and-resume: progress + saved state + come back later. */}
            {hasCase ? (
              <div className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2">
                {progress ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">
                        {progress.answeredCount} of {progress.totalCount} required questions answered
                      </span>
                      <span className="text-slate-600">{progress.progressPercent}%</span>
                    </div>
                    <div
                      className="mt-1 h-2 w-full overflow-hidden rounded bg-slate-200"
                      role="progressbar"
                      aria-valuenow={progress.progressPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`DIY progress for Form ${formCode}`}
                    >
                      <div
                        className="h-full bg-green-700"
                        style={{ width: `${progress.progressPercent}%` }}
                      />
                    </div>
                    {progress.complete ? (
                      <p className="mt-1 text-sm font-semibold text-green-800">
                        All questions answered — your answers will transfer into the form automatically once your payment is confirmed (step 4).
                      </p>
                    ) : progress.missing.length > 0 ? (
                      <p className="mt-1 text-xs text-slate-600">
                        Next unanswered question: {progress.missing[0].label}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-slate-600">Your answers save automatically as you type them.</p>
                )}
                <p role="status" className="mt-1 text-sm text-slate-700">
                  {saveState.kind === "saving"
                    ? "Saving…"
                    : saveState.kind === "saved"
                      ? `Saved — come back anytime.${saveState.at ? ` Last saved ${new Date(saveState.at).toLocaleString("en-US")}.` : ""}`
                      : saveState.kind === "error"
                        ? saveState.message
                        : "Your answers save automatically as you go — leave any time and come back to the exact question you left off."}
                </p>
                {draft?.currentFieldName && progress && !progress.complete ? (
                  <p className="mt-1 text-xs text-slate-600">
                    You left off at: {progress.missing[0]?.label ?? draft.currentFieldName} — the form opened there.
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void saveAndComeBackLater()}
                  className="mt-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
                >
                  Save and come back later
                </button>
              </div>
            ) : (
              <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                No case selected, so answers cannot be saved to come back to yet — open this flow
                from your case in the portal (?caseId=&lt;your case id&gt;). You can still answer
                the questions.
              </p>
            )}
            <p className="mt-2 text-sm">
              <button type="button" onClick={() => setStep(1)} className="text-blue-700 underline">← Change form</button>
              {" · "}
              <button type="button" onClick={finishAnswering} className="font-semibold text-blue-700 underline">Done answering — review my preview →</button>
            </p>
          </div>
          {!draftLoaded ? (
            <p className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Loading your saved answers…
            </p>
          ) : (
            <DynamicFormIntakeEngine
              key={`${formCode}-${draft?.id ?? "new"}`}
              mode="client_diy"
              selectedForms={[formCode]}
              caseId={caseId}
              actorRole="client"
              initialAnswers={engineInitialAnswers}
              initialResumeFieldName={draft?.currentFieldName ?? null}
              onAnswersChange={handleEngineAnswersChange}
            />
          )}
          <p className="text-sm">
            <button type="button" onClick={finishAnswering} className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Done answering — review my preview →
            </button>
          </p>
        </section>
      )}

      {/* Step 3 — watermarked, non-copyable preview */}
      {step === 3 && (
        <section aria-labelledby="diy-preview-heading" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 id="diy-preview-heading" className="text-base font-semibold">
            Step 3 — Review your preview for Form {formCode}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            This is a preview of your filled answers, not the filed form. Print, save and email
            stay locked until you pay in step 4 — the preview itself cannot be printed, saved or
            emailed from here.
          </p>
          <p className="mt-2 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            {DIY_COPY_DETERRENT_LABEL}
          </p>
          <div
            className="relative mt-3 overflow-hidden rounded border border-slate-300 bg-slate-50 p-4"
            style={{ userSelect: "none", WebkitUserSelect: "none" }}
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            onKeyDown={blockCopyKey}
            tabIndex={0}
            aria-label="Watermarked, non-copyable preview of your filled answers"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-8 overflow-hidden opacity-[0.13]"
            >
              {[0, 1, 2].map((i) => (
                <span key={i} className="whitespace-nowrap text-lg font-bold text-red-800" style={{ transform: "rotate(-30deg)" }}>
                  {DIY_PREVIEW_WATERMARK}
                </span>
              ))}
            </div>
            <p className="relative text-center text-xs font-bold uppercase tracking-wide text-red-800">
              {DIY_PREVIEW_WATERMARK}
            </p>
            {previewNote ? (
              <p className="relative mt-3 text-sm text-slate-700">{previewNote}</p>
            ) : null}
            {preview ? (
              <dl className="relative mt-3 space-y-2 text-sm">
                {preview.map((a) => (
                  <div key={a.questionKey} className="rounded border border-slate-200 bg-white px-3 py-2">
                    <dt className="font-semibold">{a.fieldName}</dt>
                    <dd className="text-slate-700">
                      {a.value || "(no answer saved)"}
                      {a.sensitive ? " — sensitive value, shown masked only" : ""}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <p className="relative mt-3 text-xs text-slate-600">
              {DRAFT_SCHEMA_NOTICE}. {meta?.editionNote ?? ""}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadPreview()} className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold">
              Reload preview
            </button>
            <button type="button" onClick={() => setStep(2)} className="rounded border border-slate-300 px-3 py-2 text-sm">
              ← Back to questions
            </button>
            <button type="button" onClick={() => setStep(4)} className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Continue to pay to unlock →
            </button>
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-semibold">Documents to send with Form {formCode}</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
              {checklistTitlesForForm(formCode).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-slate-600">
              From the form checklist for {formCode} — verify the full document list against the
              current form edition at uscis.gov before you file.
            </p>
            <p className="mt-2 text-xs text-slate-600">
              Document slots in the engine (step 2) come from the same checklist —{" "}
              {checklistSlotsForForm(formCode).length} item(s) for this form.
            </p>
          </div>
        </section>
      )}

      {/* Step 4 — pay to unlock */}
      {step === 4 && (
        <section aria-labelledby="diy-pay-heading" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 id="diy-pay-heading" className="text-base font-semibold">Step 4 — Pay to unlock print, save &amp; email</h2>
          <p className="mt-1 text-sm text-slate-600">{DIY_PAY_FIRST_TEXT}</p>
          {unlock.kind === "checking" && <p className="mt-3 text-sm text-slate-600">Checking your payment status…</p>}
          {unlock.kind === "no-case" && (
            <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              A real case is required before you can pay — the payment is recorded against your
              case, and the Stripe webhook records no invoice without a case id and account id.
              Open this flow from your case in the portal (?caseId=&lt;your case id&gt;).
            </p>
          )}
          {unlock.kind === "no-session" && (
            <p className="mt-3 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Sign in first — payment status is checked against the payment records for your
              account. <Link href="/login" className="font-semibold text-blue-700 underline">Sign in →</Link>
            </p>
          )}
          {unlock.kind === "not-configured" && (
            <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {unlock.reason ?? "Payment records are not connected yet, so your payment status cannot be verified. Nothing is unlocked until they are connected and your payment is confirmed."}
            </p>
          )}
          {unlock.kind === "unlocked" && (
            <div className="mt-3 rounded border border-green-600 bg-green-50 px-3 py-2 text-sm text-green-900">
              <p className="font-semibold">Unlocked — your DIY payment is confirmed.</p>
              <p className="mt-1">{unlock.reason}</p>
              <button type="button" onClick={() => setStep(5)} className="mt-2 rounded bg-green-700 px-4 py-2 text-sm font-semibold text-white">
                Go to print, save &amp; email →
              </button>
            </div>
          )}
          {unlock.kind === "locked" && (
            <div className="mt-3 space-y-3">
              <p className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {unlock.reason}
              </p>
              {!hasCase ? null : (
                <>
                  <div className="rounded border border-slate-300 p-3">
                    <p className="text-sm font-semibold">
                      {single.label} — ${(single.amountCents / 100).toFixed(2)} — unlocks Form {formCode} for this case
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      USCIS government fees are separate and are never part of this payment.
                    </p>
                    <div className="mt-2">
                      <CheckoutButton
                        priceId={single.priceId}
                        plan="full"
                        email={unlock.callerEmail ?? undefined}
                        accountId={unlock.accountId}
                        caseId={caseId}
                        formCode={formCode}
                        label={`Pay $${(single.amountCents / 100).toFixed(2)} — unlock Form ${formCode}`}
                      />
                    </div>
                  </div>
                  <div className="rounded border border-slate-300 p-3">
                    <p className="text-sm font-semibold">
                      {bundle.label} — ${(bundle.amountCents / 100).toFixed(2)} — unlocks every DIY form for this case
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Better if you are filing more than one form. USCIS government fees are
                      separate and are never part of this payment.
                    </p>
                    <div className="mt-2">
                      <CheckoutButton
                        priceId={bundle.priceId}
                        plan="full"
                        email={unlock.callerEmail ?? undefined}
                        accountId={unlock.accountId}
                        caseId={caseId}
                        formCode={formCode}
                        label={`Pay $${(bundle.amountCents / 100).toFixed(2)} — unlock the DIY Bundle`}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    After payment, come back here and press “I&apos;ve paid — check again”. Access
                    unlocks only once Stripe confirms the payment and it is recorded in our
                    database — not from the checkout page alone. If you already paid, sign in
                    with the same account you paid with.
                  </p>
                  <button
                    type="button"
                    onClick={() => void checkUnlock()}
                    className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold"
                  >
                    I&apos;ve paid — check again
                  </button>
                </>
              )}
            </div>
          )}
          <p className="mt-3 text-sm">
            <button type="button" onClick={() => setStep(3)} className="text-blue-700 underline">← Back to preview</button>
          </p>
        </section>
      )}

      {/* Step 5 — packet, cover letter, submission guide */}
      {step === 5 && (
        <section aria-labelledby="diy-packet-heading" className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 id="diy-packet-heading" className="text-base font-semibold">
              Step 5 — Print, save &amp; email your completed application
            </h2>
            {!unlocked ? (
              <div className="mt-3">
                <p className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Locked — {unlock.reason ?? DIY_PAY_FIRST_TEXT}
                </p>
                <button type="button" onClick={() => setStep(4)} className="mt-3 rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  Go to pay to unlock →
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="rounded border border-green-600 bg-green-50 px-3 py-2 text-sm text-green-900">
                  Unlocked — {unlock.reason}
                </p>
                <p className="text-sm text-slate-700">
                  Your completed packet is a DRAFT until the packet audit is 100% and the balance
                  is paid — the packet route enforces that itself and says so honestly when it is
                  not ready. Review every page and sign before you submit anything. This system
                  does not file for you.
                </p>
                {/* Automatic transfer: answers → the immigration form. */}
                <div className="rounded border border-slate-300 p-3">
                  <h3 className="text-sm font-semibold">Automatic transfer of your answers</h3>
                  {!progress?.complete ? (
                    <p className="mt-1 text-sm text-slate-700">
                      Your answers transfer into the form automatically once every required
                      question is answered — {progress ? `${progress.answeredCount} of ${progress.totalCount} answered so far.` : "answer the questions in step 2 first."}{" "}
                      A half-finished form never transfers and never generates a packet.{" "}
                      <button type="button" onClick={() => setStep(2)} className="font-semibold text-blue-700 underline">Back to the questions →</button>
                    </p>
                  ) : transfer.kind === "loading" ? (
                    <p className="mt-1 text-sm text-slate-600">Transferring your answers into Form {formCode}…</p>
                  ) : transfer.kind === "done" ? (
                    <div className="mt-1 text-sm text-green-900">
                      <p className="font-semibold">
                        Transferred — {transfer.transferredCount} answer(s) moved into Form {formCode} ({transfer.mappedAnswered} of {transfer.mappedTotal} mapped form fields filled).
                      </p>
                      {transfer.mustEnterOnForm.length > 0 ? (
                        <p className="mt-1 text-slate-700">
                          Re-enter on the official form itself (never stored in a draft):{" "}
                          {transfer.mustEnterOnForm.join("; ")}.
                        </p>
                      ) : null}
                      {transfer.packetGenerated && transfer.packetUrl ? (
                        <p className="mt-1">
                          <a href={transfer.packetUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                            Open your DRAFT packet PDF (link valid 24 hours)
                          </a>{" "}
                          — review and sign before you submit. This does not file your case.
                        </p>
                      ) : (
                        <p className="mt-1 text-amber-900">
                          Your answers are transferred, but the packet itself is not ready yet:{" "}
                          {transfer.packetError ?? "the packet audit is not 100% or the balance is not paid."}{" "}
                          Your answers stay transferred — fix that and use “Get my completed packet” below; you do not need to re-type anything.
                        </p>
                      )}
                    </div>
                  ) : transfer.kind === "error" ? (
                    <div className="mt-1 text-sm">
                      <p role="alert" className="rounded border border-red-600 bg-red-50 px-3 py-2 font-semibold text-red-800">
                        {transfer.message}
                      </p>
                      <button
                        type="button"
                        onClick={() => void runTransfer()}
                        className="mt-2 rounded border border-slate-300 px-3 py-2 text-sm font-semibold"
                      >
                        Try the transfer again
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1 text-sm text-slate-700">
                      <p>All questions answered. Transfer your answers into the form now:</p>
                      <button
                        type="button"
                        onClick={() => void runTransfer()}
                        className="mt-2 rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Transfer my answers into Form {formCode}
                      </button>
                    </div>
                  )}
                </div>
                {packet.kind === "idle" || packet.kind === "error" ? (
                  <button
                    type="button"
                    onClick={() => void fetchPacket()}
                    className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Get my completed packet (PDF)
                  </button>
                ) : null}
                {packet.kind === "loading" && <p className="text-sm text-slate-600">Generating your packet…</p>}
                {packet.kind === "error" && (
                  <p role="alert" className="rounded border border-red-600 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                    {packet.error}
                  </p>
                )}
                {packet.kind === "ready" && packet.signedUrl && (
                  <div className="rounded border border-green-600 bg-green-50 px-3 py-2 text-sm text-green-900">
                    <p className="font-semibold">
                      Your DRAFT packet is ready{packet.pageCount ? ` — ${packet.pageCount} page(s)` : ""}.
                      Review and sign before you submit. This does not file your case.
                    </p>
                    <p className="mt-2">
                      <a href={packet.signedUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                        Open the packet PDF (link valid 24 hours)
                      </a>{" "}
                      — use your PDF viewer&apos;s Print or Save to print it or save a copy.
                    </p>
                    {typeof packet.auditScore === "number" ? (
                      <p className="mt-1 text-xs">Packet audit score at generation: {packet.auditScore}% (100% required).</p>
                    ) : null}
                  </div>
                )}
                <div className="rounded border border-slate-300 p-3">
                  <h3 className="text-sm font-semibold">Email the completed application to yourself</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Sent only to the email on your Immigration account, as a secure download link
                    (valid 24 hours) — the PDF itself is not attached to the email. No sensitive
                    numbers are ever in the subject line.
                  </p>
                  <button
                    type="button"
                    onClick={() => void emailPacket()}
                    disabled={emailState.kind === "loading"}
                    className="mt-2 rounded bg-slate-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {emailState.kind === "loading" ? "Sending…" : "Email my packet to me"}
                  </button>
                  {emailState.kind === "done" && (
                    <p role="status" className="mt-2 text-sm text-green-800">{emailState.message}</p>
                  )}
                  {emailState.kind === "error" && (
                    <p role="alert" className="mt-2 rounded border border-red-600 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                      {emailState.message}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {unlocked && (
            <>
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-base font-semibold">Your draft cover letter</h3>
                <p className="mt-1 text-xs text-slate-600">
                  DRAFT, plain English. Replace [Your full legal name] and [Date] with your real
                  details, review it, and sign the real forms before you submit anything.
                </p>
                <pre className="mt-2 whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">{coverLetter}</pre>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-base font-semibold">{guide.title}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-700">{guide.draftNotice}.</p>
                <p className="mt-1 text-xs text-slate-600">{guide.confirmLine}</p>
                <ol className="mt-3 space-y-3">
                  {guide.steps.map((s) => (
                    <li key={s.step} className="rounded border border-slate-200 px-3 py-2 text-sm">
                      <strong>{s.step}. {s.title}</strong>
                      <p className="mt-1 whitespace-pre-wrap text-slate-700">{s.detail}</p>
                    </li>
                  ))}
                </ol>
                {guide.govTotalNote ? (
                  <p className="mt-3 whitespace-pre-wrap text-xs text-slate-600">{guide.govTotalNote}</p>
                ) : null}
                <p className="mt-2 text-xs text-slate-600">
                  <Link href="/portal" className="text-blue-700 underline">← Back to the Client Portal</Link>
                </p>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
