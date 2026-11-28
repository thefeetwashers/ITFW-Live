// Sponsor income checker — public UI for the locked 2026 qualifier
// (Nov 28, 2026).
//
// The LOGIC already existed (src/lib/formChecklists.ts
// SPONSOR_125_2026 + sponsorShortfallCheck, source: 2026 USCIS Form
// I-864P, effective March 1, 2026). No public UI existed, so this
// component is the thin UI over it — it does not rebuild the math.
//
// PRIVACY: the income and assets the visitor types stay in this
// browser only (component state). Nothing is posted, stored, logged,
// or emailed. The follow-up capture below (ToolLeadCapture) asks
// only for name / phone / email / service — never the income figure.
// The result is a checklist check, not legal advice: it never
// decides eligibility, and it never promises an approval.
"use client";

import { Suspense, useState } from "react";
import ToolLeadCapture from "@/components/leads/ToolLeadCapture";
import {
  requiredSponsorIncome,
  sponsorShortfallCheck,
  type SponsorRegion,
} from "@/lib/formChecklists";

const REGIONS: { id: SponsorRegion; label: string }[] = [
  { id: "contiguous", label: "48 contiguous states + D.C." },
  { id: "alaska", label: "Alaska" },
  { id: "hawaii", label: "Hawaii" },
];

function dollars(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

export default function SponsorIncomeChecker() {
  const [householdSize, setHouseholdSize] = useState("4");
  const [region, setRegion] = useState<SponsorRegion>("contiguous");
  const [military, setMilitary] = useState(false);
  const [income, setIncome] = useState("");
  const [assets, setAssets] = useState("");
  const [spouseOrMinorChild, setSpouseOrMinorChild] = useState(true);
  const [result, setResult] = useState<ReturnType<typeof sponsorShortfallCheck> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function check() {
    setError(null);
    setResult(null);
    const size = Math.floor(Number(householdSize));
    const incomeNum = Number(income);
    const assetsNum = assets.trim() === "" ? 0 : Number(assets);
    if (!Number.isFinite(size) || size < 1) {
      setError("Household size must be a whole number of 1 or more.");
      return;
    }
    if (!Number.isFinite(incomeNum) || incomeNum < 0) {
      setError("Enter your annual household income in dollars (numbers only).");
      return;
    }
    if (!Number.isFinite(assetsNum) || assetsNum < 0) {
      setError("Assets must be a dollar amount of 0 or more (leave blank for 0).");
      return;
    }
    setResult(
      sponsorShortfallCheck({
        householdSize: size,
        region,
        military,
        income: incomeNum,
        assets: assetsNum,
        isSpouseOrMinorChildOfUSC: spouseOrMinorChild,
      })
    );
  }

  const requiredNow = requiredSponsorIncome(
    Math.max(2, Math.floor(Number(householdSize)) || 2),
    region,
    military
  );

  return (
    <div>
      <form
        className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">Household size *</span>
            <input
              type="number"
              min={1}
              step={1}
              className="mt-1 w-full rounded border border-slate-300 p-2"
              value={householdSize}
              onChange={(e) => setHouseholdSize(e.target.value)}
            />
            <span className="text-xs text-slate-500">
              The sponsor + everyone counted on the I-864 (including the immigrant being sponsored).
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Where the sponsor lives</span>
            <select
              className="mt-1 w-full rounded border border-slate-300 p-2"
              value={region}
              onChange={(e) => setRegion(e.target.value as SponsorRegion)}
            >
              {REGIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Annual household income (dollars) *</span>
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className="mt-1 w-full rounded border border-slate-300 p-2"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              placeholder="e.g. 41250"
            />
            <span className="text-xs text-slate-500">
              Your income stays in this browser — it is never stored or sent anywhere.
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Assets, if any (dollars, optional)</span>
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className="mt-1 w-full rounded border border-slate-300 p-2"
              value={assets}
              onChange={(e) => setAssets(e.target.value)}
              placeholder="0"
            />
          </label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={military}
            onChange={(e) => setMilitary(e.target.checked)}
          />
          Sponsor is on active duty in the U.S. Armed Forces (100% column, not 125%)
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={spouseOrMinorChild}
            onChange={(e) => setSpouseOrMinorChild(e.target.checked)}
          />
          The immigrant is the spouse or minor child of a U.S. citizen (assets count at 3×, otherwise 5×)
        </label>
        <p className="mt-3 text-sm text-slate-700">
          Required income for this household: <strong>{dollars(requiredNow)}</strong>{" "}
          ({military ? "100% — active-duty military" : "125%"} of the 2026 Federal Poverty
          Guidelines, 2026 Form I-864P).
        </p>
        {error && (
          <p role="status" className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm font-medium text-amber-900">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="mt-3 rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Check my sponsor income
        </button>
      </form>

      {result && (
        <section
          aria-label="Result"
          className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 className="text-base font-semibold">
            Result: {result.qualified ? "Meets the income line" : "Below the income line"}
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Required income: <strong>{dollars(result.required)}</strong></li>
            {result.shortfall > 0 ? (
              <>
                <li>Shortfall: <strong>{dollars(result.shortfall)}</strong></li>
                <li>
                  Assets needed to cover it: <strong>{dollars(result.assetsNeeded)}</strong>{" "}
                  (shortfall × {result.multiplier})
                </li>
              </>
            ) : (
              <li>No shortfall — income meets the required amount.</li>
            )}
          </ul>
          <p className="mt-2 text-sm font-medium">{result.nextStep}</p>
          <p className="mt-2 text-xs text-slate-500">
            A checklist check, not legal advice. Poverty guidelines change
            every year — confirm the current figures on uscis.gov before you
            file Form I-864. Only a licensed attorney or a DOJ-Accredited
            Representative gives legal advice (8 CFR 292.1).
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
          <ToolLeadCapture toolId="sponsor_income" />
        </Suspense>
      )}
    </div>
  );
}
