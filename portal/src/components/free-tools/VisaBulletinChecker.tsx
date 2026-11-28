// Visa Bulletin date checker — public UI for the matcher
// (Nov 28, 2026).
//
// The LOGIC already existed (src/lib/visaBulletin.ts
// matchPriorityDate: strictly-before rule, cross-chargeability,
// chart labelled). No public UI existed, so this component is the
// thin UI over it — it does not rebuild the matching.
//
// HONEST CORE: NO cutoff dates are stored on the platform, so none
// is ever invented. The visitor enters the cutoff straight from
// the official Visa Bulletin (travel.state.gov — the page links to
// the bulletin for the month they pick), and the result always
// carries the source note telling them to verify it there before
// filing. A priority date is a case date, not a DOB / A-Number /
// SSN / passport number — and it still never leaves this browser:
// the check runs locally, nothing is posted or stored. The
// follow-up capture below asks only for name / phone / email /
// service — never the priority date.
"use client";

import { Suspense, useState } from "react";
import ToolLeadCapture from "@/components/leads/ToolLeadCapture";
import {
  CHARGEABILITY_COUNTRIES,
  CHART_LABELS,
  VISA_CATEGORIES,
  matchPriorityDate,
  visaBulletinUrl,
  type BulletinCutoff,
  type BulletinChartKind,
  type BulletinMonth,
  type ChargeabilityCountry,
  type PriorityDateMatch,
  type VisaCategory,
} from "@/lib/visaBulletin";

type CutoffKind = "current" | "unavailable" | "date";

export default function VisaBulletinChecker() {
  const [month, setMonth] = useState("2026-11");
  const [priorityDate, setPriorityDate] = useState("");
  const [category, setCategory] = useState<VisaCategory>("F1");
  const [birthCountry, setBirthCountry] = useState<ChargeabilityCountry>("WORLDWIDE");
  const [spouseBirthCountry, setSpouseBirthCountry] = useState<ChargeabilityCountry | "">("");
  const [chartKind, setChartKind] = useState<BulletinChartKind>("final_action");
  const [cutoffKind, setCutoffKind] = useState<CutoffKind>("date");
  const [cutoffDate, setCutoffDate] = useState("");
  const [result, setResult] = useState<PriorityDateMatch | null>(null);
  const [error, setError] = useState<string | null>(null);

  function check() {
    setError(null);
    setResult(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(priorityDate)) {
      setError("Enter your priority date as YYYY-MM-DD (the date on your I-797 receipt notice).");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(month + "-01")) {
      setError("Enter the bulletin month as YYYY-MM.");
      return;
    }
    if (cutoffKind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(cutoffDate)) {
      setError(
        "Enter the cutoff date from the official Visa Bulletin as YYYY-MM-DD — or pick \"Current\" / \"Unavailable\" if the bulletin says C or U for your category."
      );
      return;
    }
    const cutoff: BulletinCutoff = {
      category,
      chargeabilityCountry: birthCountry,
      chartKind,
      isCurrent: cutoffKind === "current",
      isUnavailable: cutoffKind === "unavailable",
      cutoffDate: cutoffKind === "date" ? cutoffDate : null,
    };
    const bulletin: BulletinMonth = {
      bulletinMonth: month,
      sourceUrl: visaBulletinUrl(month),
      cutoffs: [cutoff],
    };
    const match = matchPriorityDate({
      priorityDate,
      category,
      birthCountry,
      spouseBirthCountry: spouseBirthCountry === "" ? null : spouseBirthCountry,
      chartKind,
      bulletin,
    });
    if (!match) {
      setError("No cutoff was entered for that category and country — enter the cutoff from the official bulletin and try again. Nothing was guessed.");
      return;
    }
    setResult(match);
  }

  const bulletinUrl = visaBulletinUrl(month);

  return (
    <div>
      <form
        className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
      >
        <p className="text-sm text-slate-700">
          First, open the official Visa Bulletin for the month and find your
          category and country:{" "}
          <a href={bulletinUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">
            Visa Bulletin for {month} (travel.state.gov) →
          </a>
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">Bulletin month (YYYY-MM) *</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 p-2"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              placeholder="2026-11"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Your priority date (YYYY-MM-DD) *</span>
            <input
              type="date"
              className="mt-1 w-full rounded border border-slate-300 p-2"
              value={priorityDate}
              onChange={(e) => setPriorityDate(e.target.value)}
            />
            <span className="text-xs text-slate-500">
              The date on your I-797 receipt notice. It never leaves this browser.
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Visa category</span>
            <select
              className="mt-1 w-full rounded border border-slate-300 p-2"
              value={category}
              onChange={(e) => setCategory(e.target.value as VisaCategory)}
            >
              {VISA_CATEGORIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Country of birth (principal applicant)</span>
            <select
              className="mt-1 w-full rounded border border-slate-300 p-2"
              value={birthCountry}
              onChange={(e) => setBirthCountry(e.target.value as ChargeabilityCountry)}
            >
              {CHARGEABILITY_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">
              Chargeability is country of birth, not citizenship.
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Spouse&apos;s country of birth (optional)</span>
            <select
              className="mt-1 w-full rounded border border-slate-300 p-2"
              value={spouseBirthCountry}
              onChange={(e) => setSpouseBirthCountry(e.target.value as ChargeabilityCountry | "")}
            >
              <option value="">No spouse / same country</option>
              {CHARGEABILITY_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">
              Cross-chargeability: a principal may use the spouse&apos;s birth country when it is more favorable.
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Which chart</span>
            <select
              className="mt-1 w-full rounded border border-slate-300 p-2"
              value={chartKind}
              onChange={(e) => setChartKind(e.target.value as BulletinChartKind)}
            >
              <option value="final_action">{CHART_LABELS.final_action.short} — consular (NVC) cases</option>
              <option value="dates_for_filing">{CHART_LABELS.dates_for_filing.short} — adjustment of status (I-485)</option>
            </select>
            <span className="text-xs text-slate-500">{CHART_LABELS[chartKind].long}</span>
          </label>
          <fieldset className="block text-sm sm:col-span-2">
            <legend className="font-medium">Cutoff from the official bulletin for this category + country *</legend>
            <p className="mt-1 flex flex-wrap gap-4">
              <label className="flex items-center gap-1">
                <input type="radio" name="cutoffKind" checked={cutoffKind === "current"} onChange={() => setCutoffKind("current")} />
                Current (C)
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" name="cutoffKind" checked={cutoffKind === "unavailable"} onChange={() => setCutoffKind("unavailable")} />
                Unavailable (U)
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" name="cutoffKind" checked={cutoffKind === "date"} onChange={() => setCutoffKind("date")} />
                A date:
                <input
                  type="date"
                  className="rounded border border-slate-300 p-1"
                  value={cutoffDate}
                  onChange={(e) => {
                    setCutoffDate(e.target.value);
                    setCutoffKind("date");
                  }}
                />
              </label>
            </p>
            <span className="text-xs text-slate-500">
              Copy the cutoff exactly as the bulletin prints it. A priority date equal to the cutoff is NOT current — it must be strictly before it.
            </span>
          </fieldset>
        </div>
        {error && (
          <p role="status" className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm font-medium text-amber-900">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="mt-3 rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Check my priority date
        </button>
      </form>

      {result && (
        <section
          aria-label="Result"
          className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 className="text-base font-semibold">{result.message}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>
              Outcome: <strong>{result.outcome === "current" ? "Current" : result.outcome === "not_current" ? "Not current" : "Unavailable"}</strong>
            </li>
            <li>
              Chart: {CHART_LABELS[result.chartKind].short} — {CHART_LABELS[result.chartKind].long}
            </li>
            <li>
              Chargeability used: {result.chargeabilityUsed}
              {result.usedCrossChargeability ? " (spouse's birth country — cross-chargeability)" : ""}
            </li>
            {result.cutoff?.cutoffDate && <li>Cutoff entered: {result.cutoff.cutoffDate}</li>}
          </ul>
          <p className="mt-2 text-xs text-slate-500">{result.sourceNote}</p>
          <p className="mt-1 text-xs text-slate-500">
            This check does not decide eligibility or whether it is safe to
            file — only a licensed attorney or a DOJ-Accredited
            Representative gives legal advice (8 CFR 292.1). Verify the
            cutoff at{" "}
            <a href={bulletinUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">
              travel.state.gov
            </a>{" "}
            before filing.
          </p>
        </section>
      )}

      {result && (
        <Suspense
          fallback={
            <p className="mt-6 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              Loading the follow-up form…
            </p>
          }
        >
          <ToolLeadCapture toolId="visa_bulletin" />
        </Suspense>
      )}
    </div>
  );
}
