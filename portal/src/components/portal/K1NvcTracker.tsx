// K-1 (I-129F) NVC / Consular Tracker
// ---------------------------------------------------------------------------
// NEW FILE (2026-11-19). Client component, pure — no Supabase, no live
// NVC/CEAC lookup, no sending. State lives in this component only.
//
// REUSES the existing NVC engine in src/lib/nvc.ts — there is NO
// second NVC tracker. The case number is validated by
// parseNvcCaseNumber() and the post by lookupNvcPost(), the same
// functions (and the same PHP/SDO/MNL/CDJ post-code lookup) as the
// I-130 consular tracker in CeacTracker.tsx.
//
// K-1 differences from I-130 consular (do NOT copy the I-130 steps):
//   - NO DS-260, NO I-864, NO CEAC $120 AOS / $325 IV fees.
//   - The fiancé(e) completes DS-160 + the petitioner completes I-134.
//   - The $265 K-1 visa fee is paid at the embassy — TO BE CONFIRMED.
// Once USCIS approves the I-129F and transfers the case to NVC, the
// petitioner logs the NVC case number + Invoice ID here so the
// petitioner and the fiancé(e) abroad track the embassy interview +
// medical exam checklist together. Never store a CEAC password.
"use client";

import { useMemo, useState } from "react";
import {
  CEAC_LOGIN_URL,
  K1_INTERVIEW_READINESS,
  K1_NVC_STEPS,
  createK1NvcRecord,
  lookupNvcPost,
  parseNvcCaseNumber,
  type InterviewReadinessItem,
} from "@/lib/nvc";

export default function K1NvcTracker() {
  const [caseInput, setCaseInput] = useState("");
  const [invoiceInput, setInvoiceInput] = useState("");
  const [embassyCity, setEmbassyCity] = useState("");
  const [logged, setLogged] = useState<{
    caseNumber: string;
    invoiceId: string;
    embassyCity: string;
    currentStepIndex: number;
  } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [stepsDone, setStepsDone] = useState<boolean[]>(
    () => K1_NVC_STEPS.map(() => false)
  );
  const [readiness, setReadiness] = useState<InterviewReadinessItem[]>(
    K1_INTERVIEW_READINESS
  );

  const parsed = useMemo(() => parseNvcCaseNumber(caseInput), [caseInput]);
  const post = parsed.postCode ? lookupNvcPost(parsed.postCode) : null;
  const currentStepIndex = stepsDone.findIndex((done) => !done);

  const logCase = () => {
    const result = createK1NvcRecord({
      caseNumber: caseInput,
      invoiceId: invoiceInput,
      embassyCity,
      currentStepIndex: 1,
    });
    if (!result.record) {
      setErrors(result.errors);
      setLogged(null);
      return;
    }
    setErrors([]);
    setLogged(result.record);
    setStepsDone(K1_NVC_STEPS.map((_s, i) => i < result.record!.currentStepIndex));
  };

  const toggleStep = (index: number) =>
    setStepsDone((prev) => prev.map((d, i) => (i === index ? !d : d)));

  const cycleReadiness = (id: string) =>
    setReadiness((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next =
          item.status === "done"
            ? "pending"
            : item.status === "pending"
              ? "to_be_confirmed"
              : "done";
        return { ...item, status: next };
      })
    );

  return (
    <section
      aria-labelledby="k1-nvc-tracker-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="k1-nvc-tracker-heading" className="text-base font-semibold">
        K-1 (I-129F) — NVC &amp; Embassy Interview Tracker
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        For use AFTER USCIS approves the I-129F and transfers the case to
        NVC. Log the NVC case number + Invoice ID from the NVC letter so
        the petitioner and the fiancé(e) abroad track the same case. This
        reuses the same NVC case-number engine as I-130 consular — there
        is no second NVC tracker. K-1 uses DS-160 + I-134 (not DS-260 +
        I-864) and has no CEAC fees; the $265 K-1 visa fee is paid at the
        embassy (TO BE CONFIRMED).
      </p>

      <div className="mt-3 space-y-3 rounded border border-slate-200 p-3">
        <label className="block text-sm font-medium text-slate-700">
          NVC Case Number (13 characters)
          <input
            type="text"
            value={caseInput}
            onChange={(e) => setCaseInput(e.target.value)}
            placeholder="e.g. PHP2026514009 (EXAMPLE format)"
            className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-sm"
          />
        </label>
        {caseInput && !parsed.valid && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
            {parsed.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {caseInput && parsed.valid && (
          <p className="text-sm">
            <strong>Valid format ✓</strong> — Post:{" "}
            {post
              ? `${post.code} — ${post.city}, ${post.country}`
              : `${parsed.postCode} — Post code not in lookup — verify with NVC`}
            {" · "}Year: {parsed.year} · Julian day: {parsed.julianDay} ·
            Sequence: {parsed.sequence}
          </p>
        )}
        <label className="block text-sm font-medium text-slate-700">
          NVC Invoice ID (from the NVC letter)
          <input
            type="text"
            value={invoiceInput}
            onChange={(e) => setInvoiceInput(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-sm"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Embassy city for the K-1 interview
          <input
            type="text"
            value={embassyCity}
            onChange={(e) => setEmbassyCity(e.target.value)}
            placeholder="e.g. Port-au-Prince"
            className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={logCase}
          className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Log NVC case
        </button>
        {errors.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {logged && (
          <p className="text-sm">
            Logged: <strong className="font-mono">{logged.caseNumber}</strong>{" "}
            · Invoice ID <strong className="font-mono">{logged.invoiceId}</strong>{" "}
            · Embassy: {logged.embassyCity}. Petitioner + fiancé(e) abroad
            track this same case.
          </p>
        )}
      </div>

      <ol className="mt-4 space-y-2">
        {K1_NVC_STEPS.map((step, i) => {
          const done = stepsDone[i];
          const current = currentStepIndex === -1 ? false : i === currentStepIndex;
          return (
            <li
              key={step.id}
              className={`flex items-start gap-2 rounded border p-3 text-sm ${
                done
                  ? "border-green-300 bg-green-50"
                  : current
                    ? "border-amber-400 bg-amber-50"
                    : "border-slate-200 bg-slate-50"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleStep(i)}
                aria-pressed={done}
                className="mt-0.5 shrink-0 rounded border border-slate-400 bg-white px-2 py-0.5 text-xs font-semibold"
                title="Manual entry — tap to mark this step done / not done"
              >
                {done ? "✓ Done" : current ? "◐ Current" : "○ Not done"}
              </button>
              <span>
                <span className="font-medium">{step.title}</span>
                <span className="block text-xs text-slate-600">{step.detail}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <h3 className="mt-4 text-sm font-semibold">
        Embassy interview + medical exam checklist
      </h3>
      <ul className="mt-2 space-y-2">
        {readiness.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2 text-sm"
          >
            <span>
              <span className="font-medium">{item.label}</span>
              {item.note && (
                <span className="block text-xs text-slate-600">{item.note}</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => cycleReadiness(item.id)}
              className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
            >
              {item.status === "done"
                ? "Done ✓"
                : item.status === "pending"
                  ? "Pending"
                  : "To be confirmed"}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm">
        <a
          href={CEAC_LOGIN_URL}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-blue-700 underline"
        >
          Open CEAC login (ceac.state.gov) →
        </a>{" "}
        <span className="text-xs text-slate-500">
          Manual tracking only — never store a CEAC password here, and never
          share your CEAC password with anyone.
        </span>
      </p>
    </section>
  );
}
