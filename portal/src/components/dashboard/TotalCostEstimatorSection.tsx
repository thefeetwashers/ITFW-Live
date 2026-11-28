// Total Cost Estimator — DASHBOARD section (Nov 28, 2026).
// USCIS government fee + our preparation fee shown SEPARATELY, per
// form and per bundle, with the locked prices — no surprises at
// checkout. The two fees are paid to different parties and are NEVER
// added into one combined total (see src/lib/totalCostEstimator.ts —
// there is deliberately no combined-total field). On the client
// dashboard home and in the intake flow; professionals see the same
// estimate per client case.
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  estimateForDiy,
  estimateForFamilyAdjustmentBundle,
  estimateForForm,
  estimableFormCodes,
  COST_TIER_LABEL,
  type CostTier,
  type TotalCostEstimate,
} from "@/lib/totalCostEstimator";

const TIERS: CostTier[] = ["basic", "standard", "premium"];

export function CostEstimateView({ estimate }: { estimate: TotalCostEstimate }) {
  return (
    <div className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
      <p className="font-semibold">
        {estimate.name} — {COST_TIER_LABEL[estimate.tier]}
      </p>
      <p className="mt-2 font-semibold">Our preparation fee (paid to us):</p>
      <ul className="mt-1 list-disc pl-5">
        <li>
          {estimate.ourFee.label}: <strong>{estimate.ourFee.amount}</strong>
          {!estimate.ourFee.locked ? " — TO BE CONFIRMED" : ""}
          {estimate.ourFee.note ? ` (${estimate.ourFee.note})` : ""}
        </li>
      </ul>
      <p className="mt-2 font-semibold">
        USCIS government fee (paid to USCIS — separate):
      </p>
      {estimate.governmentFees.length === 0 ? (
        <p className="mt-1 text-slate-600">
          No government fee is listed in the locked data for this item —
          confirm at uscis.gov/fees before paying.
        </p>
      ) : (
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {estimate.governmentFees.map((line) => (
            <li key={line.label}>
              {line.label}: <strong>{line.amount}</strong>
              {!line.locked ? " — TO BE CONFIRMED" : ""}
              {line.note ? ` (${line.note})` : ""}
            </li>
          ))}
        </ul>
      )}
      {estimate.hasUnconfirmedGovernmentFee && (
        <p className="mt-2 text-amber-800">
          One or more government fees above are TO BE CONFIRMED — do not
          pay a government fee until you have confirmed it at
          uscis.gov/fees.
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Our fee and the government fee are paid to different parties and
        are shown separately on purpose — they are never added into one
        combined total here. {estimate.disclaimer}
      </p>
      <p className="mt-1 text-xs text-slate-500">{estimate.feeWaiverNote}</p>
    </div>
  );
}

export default function TotalCostEstimatorSection({
  audience,
  caseLabel,
}: {
  audience: "client" | "professional";
  caseLabel?: string | null;
}) {
  const codes = estimableFormCodes();
  const [mode, setMode] = useState<"form" | "family_bundle" | "diy">("form");
  const [formCode, setFormCode] = useState("I-485");
  const [tier, setTier] = useState<CostTier>("basic");
  const [diyBundle, setDiyBundle] = useState(false);

  const estimate: TotalCostEstimate | null =
    mode === "family_bundle"
      ? estimateForFamilyAdjustmentBundle(tier)
      : mode === "diy"
        ? estimateForDiy(formCode, { bundle: diyBundle })
        : estimateForForm(formCode, tier);

  return (
    <section
      aria-label="Total cost estimator"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-base font-semibold">
        Total Cost Estimator — before you start
        {audience === "professional" && caseLabel ? ` — ${caseLabel}` : ""}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {audience === "client"
          ? "See the full cost before you start: our preparation fee and the USCIS government fee, shown separately — no surprises at checkout."
          : "The same estimate, per client case: our preparation fee and the USCIS government fee, shown separately."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="estimate-mode"
            checked={mode === "form"}
            onChange={() => setMode("form")}
          />{" "}
          Per form
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="estimate-mode"
            checked={mode === "family_bundle"}
            onChange={() => setMode("family_bundle")}
          />{" "}
          Family Adjustment Bundle
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="estimate-mode"
            checked={mode === "diy"}
            onChange={() => setMode("diy")}
          />{" "}
          Do-it-yourself
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {mode !== "family_bundle" && (
          <label className="flex items-center gap-2">
            <span className="font-semibold">Form</span>
            <select
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1"
            >
              {codes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}
        {mode !== "diy" && (
          <label className="flex items-center gap-2">
            <span className="font-semibold">Tier</span>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as CostTier)}
              className="rounded border border-slate-300 px-2 py-1"
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {COST_TIER_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
        )}
        {mode === "diy" && (
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={diyBundle}
              onChange={(e) => setDiyBundle(e.target.checked)}
            />{" "}
            DIY Bundle ($99) instead of $25 per form
          </label>
        )}
      </div>
      {estimate ? (
        <CostEstimateView estimate={estimate} />
      ) : (
        <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          No locked estimate exists for that form yet — the price is
          TO BE CONFIRMED, never guessed.
        </p>
      )}
      <p className="mt-3 text-sm">
        <Link href="/diy" className="font-semibold text-blue-700 underline">
          Start the DIY flow →
        </Link>{" "}
        <Link href="/fee-waiver" className="font-semibold text-blue-700 underline">
          Fee Waiver Checker →
        </Link>
      </p>
    </section>
  );
}
