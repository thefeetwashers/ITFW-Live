// Fee Waiver Checker (Form I-912) — DASHBOARD section (Nov 28, 2026).
// A guided check against the 150% Federal Poverty Guideline figures
// derived from the locked 2026 I-864P table (see
// src/lib/feeWaiverChecker.ts — household 4, contiguous US: $49,500).
// The result is NEVER "you qualify" — the strongest answer is
// "You may qualify — an attorney/DOJ rep should confirm." Only
// USCIS decides a fee waiver.
//
// Client view: the interactive guided check. Professional view: each
// client's saved waiver-check result in the pipeline (read-only;
// pass savedResult, or null for "no check on file yet"). The income
// figure the client types is never stored and never sent anywhere.
//
// SAVE GAP, fixed by the Nov 28 full-stack sweep: before this sweep
// no UI ever POSTed to /api/waiver-checks, so a client check was
// computed in memory and thrown away — the professional view could
// never show a result. The client view now offers "Save this result
// to my case" whenever the caller passes caseId + checkedByAccountId
// (the caller's own account id). Without a case the result is honestly
// labelled NOT saved — no case id is ever invented to make the save
// work. The dashboards do not pass a case yet, so the button appears
// only where a case is supplied; wiring the dashboard's signed-in
// case through is the remaining step (see the sweep report).
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  checkFeeWaiver,
  FEE_WAIVER_GROUND_LABEL,
  FEE_WAIVER_SOURCE,
  feeWaiver150Threshold,
  type FeeWaiverCheckResult,
  type SponsorRegion,
} from "@/lib/feeWaiverChecker";

const REGIONS: { value: SponsorRegion; label: string }[] = [
  { value: "contiguous", label: "Contiguous US (48 states + DC)" },
  { value: "alaska", label: "Alaska" },
  { value: "hawaii", label: "Hawaii" },
];

export function FeeWaiverResultView({ result }: { result: FeeWaiverCheckResult }) {
  return (
    <div className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
      <p className="font-semibold">{result.headline}</p>
      <p className="mt-1 text-slate-600">
        150% threshold for your household: $
        {result.threshold150.toLocaleString("en-US")} per year.{" "}
        {result.verifyFiguresNote}
      </p>
      {result.groundsIndicated.length > 0 ? (
        <>
          <p className="mt-2 font-semibold">Grounds indicated — proof to gather:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
            {result.proofToGather.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-slate-600">
          No I-912 ground was indicated by these answers. The three
          grounds USCIS asks about are:{" "}
          {Object.values(FEE_WAIVER_GROUND_LABEL).join("; ")}.
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">{result.disclaimer}</p>
      <p className="mt-1 text-xs text-slate-500">
        Preparing a Form I-912 request on this platform is Basic $39
        (locked price). That is the platform&apos;s preparation fee — it
        is not the USCIS fee, and paying it does not buy a waiver. Source:{" "}
        <a href={FEE_WAIVER_SOURCE.url} className="text-blue-700 underline">
          {FEE_WAIVER_SOURCE.label}
        </a>
        . Full checklist:{" "}
        <Link href="/fee-waiver" className="font-semibold text-blue-700 underline">
          /fee-waiver →
        </Link>
      </p>
    </div>
  );
}

export default function FeeWaiverCheckerSection({
  audience,
  savedResult,
  caseLabel,
  caseId,
  checkedByAccountId,
}: {
  audience: "client" | "professional";
  /** Professional view: the client's saved check result, or null. */
  savedResult?: FeeWaiverCheckResult | null;
  caseLabel?: string | null;
  /** Client view: the case to save the check against. Omit = no save. */
  caseId?: string | null;
  /** Client view: the caller's own accounts.id (never another account's). */
  checkedByAccountId?: string | null;
}) {
  const [householdSize, setHouseholdSize] = useState(4);
  const [region, setRegion] = useState<SponsorRegion>("contiguous");
  const [saveState, setSaveState] = useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function saveResult(result: FeeWaiverCheckResult) {
    if (!caseId || !checkedByAccountId) return;
    setSaveState({ kind: "saving" });
    try {
      const res = await fetch("/api/waiver-checks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId,
          householdSize,
          region,
          grounds: result.groundsIndicated,
          outcome: result.outcome,
          checkedByAccountId,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setSaveState({
          kind: "error",
          message: body.error ?? `Could not save this result (HTTP ${res.status}). Nothing was saved.`,
        });
        return;
      }
      setSaveState({ kind: "saved" });
    } catch {
      setSaveState({
        kind: "error",
        message: "Could not reach the server. Nothing was saved.",
      });
    }
  }
  const [income, setIncome] = useState("");
  const [benefit, setBenefit] = useState<boolean | null>(null);
  const [hardship, setHardship] = useState<boolean | null>(null);
  const [result, setResult] = useState<FeeWaiverCheckResult | null>(null);

  const threshold = feeWaiver150Threshold(householdSize, region);

  if (audience === "professional") {
    return (
      <section
        aria-label="Fee waiver check"
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 className="text-base font-semibold">
          Fee Waiver Check (Form I-912)
          {caseLabel ? ` — ${caseLabel}` : ""}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Each client&apos;s guided I-912 check result, from the pipeline.
          This check never decides eligibility — only USCIS decides, and
          an attorney or DOJ-accredited representative should confirm
          any &ldquo;may qualify&rdquo; result.
        </p>
        {savedResult ? (
          <FeeWaiverResultView result={savedResult} />
        ) : (
          <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            No fee-waiver check on file for this client yet. The client
            runs the guided check on their own dashboard; the result
            appears here once saved.
          </p>
        )}
      </section>
    );
  }

  return (
    <section
      aria-label="Fee waiver checker"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-base font-semibold">Fee Waiver Checker (Form I-912)</h2>
      <p className="mt-1 text-sm text-slate-600">
        Can&apos;t afford the USCIS fee? Answer the three questions USCIS
        asks on Form I-912. This check never decides whether you qualify
        — it only tells you whether you <em>may</em> qualify and what
        proof to gather. Only USCIS decides.
      </p>
      <div className="mt-3 space-y-3 text-sm">
        <label className="block">
          <span className="font-semibold">People in your household</span>
          <input
            type="number"
            min={1}
            max={20}
            value={householdSize}
            onChange={(e) => setHouseholdSize(Number(e.target.value) || 1)}
            className="mt-1 block w-24 rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="font-semibold">Where you live</span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as SponsorRegion)}
            className="mt-1 block rounded border border-slate-300 px-2 py-1"
          >
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
          150% of the Federal Poverty Guidelines for a household of{" "}
          {householdSize} in {REGIONS.find((r) => r.value === region)?.label}:{" "}
          <strong>${threshold.toLocaleString("en-US")} per year</strong>.
          Derived from the locked 2026 Form I-864P table — confirm the
          current figures on uscis.gov before you file.
        </p>
        <label className="block">
          <span className="font-semibold">
            Your household&apos;s yearly income, before taxes (optional —
            never stored, never sent anywhere)
          </span>
          <input
            type="number"
            min={0}
            value={income}
            placeholder="e.g. 40000"
            onChange={(e) => setIncome(e.target.value)}
            className="mt-1 block w-48 rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <fieldset>
          <legend className="font-semibold">
            Are you (or your spouse, or the head of your household) currently
            receiving a means-tested benefit?
          </legend>
          <p className="text-xs text-slate-500">
            For example: Medicaid, SNAP / food stamps, SSI, TANF.
          </p>
          <div className="mt-1 flex gap-4">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="waiver-benefit"
                checked={benefit === true}
                onChange={() => setBenefit(true)}
              />{" "}
              Yes
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="waiver-benefit"
                checked={benefit === false}
                onChange={() => setBenefit(false)}
              />{" "}
              No
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend className="font-semibold">
            Do you have a financial hardship that makes paying the USCIS fee
            difficult?
          </legend>
          <p className="text-xs text-slate-500">
            For example: unemployment, a medical emergency, or other
            extraordinary expenses.
          </p>
          <div className="mt-1 flex gap-4">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="waiver-hardship"
                checked={hardship === true}
                onChange={() => setHardship(true)}
              />{" "}
              Yes
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="waiver-hardship"
                checked={hardship === false}
                onChange={() => setHardship(false)}
              />{" "}
              No
            </label>
          </div>
        </fieldset>
        <button
          type="button"
          onClick={() =>
            setResult(
              checkFeeWaiver({
                householdSize,
                region,
                annualHouseholdIncome:
                  income.trim() === "" ? null : Number(income),
                hasMeansTestedBenefit: benefit,
                hasFinancialHardship: hardship,
              })
            )
          }
          className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
        >
          Check — may I qualify?
        </button>
      </div>
      {result && (
        <>
          <FeeWaiverResultView result={result} />
          {caseId && checkedByAccountId ? (
            <div className="mt-3">
              {saveState.kind === "saved" ? (
                <p role="status" className="text-sm font-semibold text-green-800">
                  Saved to your case — your preparer can see this result in the pipeline.
                </p>
              ) : (
                <button
                  type="button"
                  disabled={saveState.kind === "saving"}
                  onClick={() => void saveResult(result)}
                  className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saveState.kind === "saving" ? "Saving…" : "Save this result to my case"}
                </button>
              )}
              {saveState.kind === "error" ? (
                <p role="alert" className="mt-2 text-sm text-red-800">
                  {saveState.message}{" "}
                  <button
                    type="button"
                    onClick={() => void saveResult(result)}
                    className="font-semibold underline"
                  >
                    Try again
                  </button>
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              This result is not saved — no case is linked on this page, so your preparer
              cannot see it yet. Open the checker from your case in the portal to save it.
            </p>
          )}
        </>
      )}
      <p className="mt-3 text-sm">
        <Link href="/fee-waiver" className="font-semibold text-blue-700 underline">
          Full I-912 checklist →
        </Link>
      </p>
    </section>
  );
}
