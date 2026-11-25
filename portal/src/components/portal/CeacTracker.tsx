// NVC CEAC 6-Step Tracker + DOS Fee Tracker (Part 2)
// NVC has NO API — CEAC status is manual entry + a link out to CEAC.
// Never store a CEAC password. USCIS live status needs the Production
// key + worker — NOT built; receipt / status below are manual / EXAMPLE.
// All case numbers, Invoice IDs and names here are EXAMPLE only.
"use client";

import { useMemo, useState } from "react";
import {
  CEAC_FEE_STATUS_LABEL,
  CEAC_LOGIN_URL,
  CEAC_STEPS,
  EXAMPLE_NVC_CASE,
  ceacFeeTotalUsd,
  lookupNvcPost,
  parseNvcCaseNumber,
  parseUscisReceipt,
  type CeacFee,
  type CeacFeeStatus,
} from "@/lib/nvc";

const FEE_STATUS_ORDER: CeacFeeStatus[] = ["not_paid", "in_process", "paid"];

export default function CeacTracker() {
  const [caseInput, setCaseInput] = useState(EXAMPLE_NVC_CASE.caseNumber);
  const [fees, setFees] = useState<CeacFee[]>(EXAMPLE_NVC_CASE.fees);
  const [stepsDone, setStepsDone] = useState<boolean[]>(
    () =>
      CEAC_STEPS.map(
        (_s, i) => i < EXAMPLE_NVC_CASE.currentStepIndex
      )
  );

  const parsed = useMemo(() => parseNvcCaseNumber(caseInput), [caseInput]);
  const uscisParsed = useMemo(
    () => parseUscisReceipt("IOE0928374651"),
    []
  );
  const post = parsed.postCode ? lookupNvcPost(parsed.postCode) : null;
  const currentStepIndex = stepsDone.findIndex((done) => !done);
  const paidTotal = ceacFeeTotalUsd(
    fees.filter((f) => f.status === "paid"),
    EXAMPLE_NVC_CASE.applicantCount
  );
  const fullTotal = ceacFeeTotalUsd(fees, EXAMPLE_NVC_CASE.applicantCount);

  const cycleFee = (id: CeacFee["id"]) =>
    setFees((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const next =
          FEE_STATUS_ORDER[
            (FEE_STATUS_ORDER.indexOf(f.status) + 1) % FEE_STATUS_ORDER.length
          ];
        return { ...f, status: next };
      })
    );

  const toggleStep = (index: number) =>
    setStepsDone((prev) => prev.map((d, i) => (i === index ? !d : d)));

  return (
    <section
      aria-labelledby="ceac-tracker-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="ceac-tracker-heading" className="text-base font-semibold">
        NVC &amp; Consular Processing — CEAC 6-Step Tracker
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        EXAMPLE case only — {EXAMPLE_NVC_CASE.petitionerExample} (petitioner,
        EXAMPLE) / {EXAMPLE_NVC_CASE.beneficiaryExample} (beneficiary,
        EXAMPLE). NVC has no API: CEAC status is entered manually here and
        checked at{" "}
        <a
          href={CEAC_LOGIN_URL}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-blue-700 underline"
        >
          ceac.state.gov
        </a>
        . Never store a CEAC password here, and never share your CEAC
        password with anyone — not with us, not by email, text, or phone.
      </p>

      {/* NVC case-number validation */}
      <div className="mt-3 rounded border border-slate-200 p-3">
        <label className="block text-xs font-medium text-slate-600">
          NVC Case Number (EXAMPLE — type a case number to validate it)
          <input
            type="text"
            value={caseInput}
            onChange={(e) => setCaseInput(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-sm"
          />
        </label>
        {parsed.valid ? (
          <div className="mt-2 text-sm">
            <p>
              <strong>Valid format ✓</strong> — Post:{" "}
              {post
                ? `${post.code} — ${post.city}, ${post.country}`
                : `${parsed.postCode} — Post code not in lookup — verify with NVC`}
              {" · "}Year: {parsed.year} · Julian day: {parsed.julianDay} ·
              Sequence: {parsed.sequence}
            </p>
          </div>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
            {parsed.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {parsed.notes.map((n) => (
          <p key={n} className="mt-1 text-xs font-semibold text-amber-700">
            {n}
          </p>
        ))}
        <p className="mt-2 text-xs text-slate-500">
          Format: 3-letter post code + 4-digit year + 3-digit Julian day +
          3-digit sequence = 13 characters. BOG is NOT the Bogotá post code
          — Bogotá is BGT.
        </p>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="font-semibold">NVC Invoice ID (EXAMPLE):</dt>
            <dd className="font-mono">{EXAMPLE_NVC_CASE.invoiceId}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-semibold">USCIS Receipt # (EXAMPLE):</dt>
            <dd className="font-mono">IOE0928374651</dd>
          </div>
        </dl>
        <p className="mt-1 text-xs text-slate-500">
          USCIS receipt prefix{" "}
          {uscisParsed.prefixKnown
            ? `${uscisParsed.prefix} — recognised (IOE, EAC, WAC, LIN, SRC, NBC, MSC).`
            : "not recognised."}{" "}
          Status shown in the portal is manual / EXAMPLE — live USCIS lookup
          needs the Production key + worker (NOT built).
        </p>
      </div>

      {/* 6 steps */}
      <ol className="mt-4 space-y-2">
        {CEAC_STEPS.map((step, i) => {
          const done = stepsDone[i];
          const current =
            currentStepIndex === -1 ? false : i === currentStepIndex;
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
                title="Manual entry — tap to mark this CEAC step done / not done"
              >
                {done ? "✓ Done" : current ? "◐ Current" : "○ Not done"}
              </button>
              <span>
                <span className="font-medium">{step.title}</span>
                <span className="block text-xs text-slate-600">
                  {step.detail}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-1 text-xs text-slate-500">
        Step status is manual entry (tap to change) until NVC / CEAC data can
        be entered from the real CEAC account. There is no live NVC feed.
      </p>

      {/* DOS fee tracker — separate from the clerical prep fee */}
      <h3 className="mt-4 text-sm font-semibold">
        DOS Fees in CEAC — separate from the clerical prep fee
      </h3>
      <ul className="mt-2 space-y-2">
        {fees.map((fee) => (
          <li
            key={fee.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2 text-sm"
          >
            <span>
              <span className="font-medium">{fee.label}</span> — $
              {fee.amountUsd} {fee.per} ·{" "}
              <strong>{CEAC_FEE_STATUS_LABEL[fee.status]}</strong>
            </span>
            <button
              type="button"
              onClick={() => cycleFee(fee.id)}
              className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Change status
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm">
        DOS fees paid (this example, {EXAMPLE_NVC_CASE.applicantCount}{" "}
        applicant): <strong>${paidTotal}</strong> of ${fullTotal} ($120 AOS +{" "}
        $325 IV per applicant).
      </p>
      <p className="mt-1 text-xs text-slate-500">
        These are U.S. Department of State fees paid in CEAC — not the
        preparer service fee and not USCIS fees. Never combine them into one
        total.
      </p>
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
