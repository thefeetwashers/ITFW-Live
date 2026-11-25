// Smart Intake Calculator — Question 1 goal picker + locked prep tiers
// + speed fees + government fees.
// ---------------------------------------------------------------------------
// NEW FILE (2026-11-19). Client component, pure — no Supabase, no
// Stripe, no sending, no live lookups.
//
// Question 1 ("What immigration goal are you applying for?") lists
// every goal in src/lib/formChecklists.ts, including the four expanded
// forms (I-131, I-751, I-539, I-129F) added 2026-11-19.
//
// PRICE RULES (do not weaken these):
// - The prep TIER is never pre-selected: the client must tap a tier
//   before any total is shown. The speed is never pre-selected either.
// - Speed fees apply to the four expanded forms only (LOCKED mapping
//   in src/lib/dynamicIntakeSchemas.ts): Standard tier + $0, Rush
//   tier + $199, Express tier + $399. Speed is PACKET PREPARATION
//   TIME, NOT USCIS processing time.
// - Locked prep tiers for the four expanded forms:
//     I-131 $250/$325/$400 · I-751 $139/$295/$449 ·
//     I-539 $250/$375/$500 · I-129F $750/$925/$1,095.
//   The paste's example tiers are NOT used.
// - Government fees are shown on their own lines with LOCKED or
//   TO BE CONFIRMED labels, never combined with the prep fee, and
//   every total carries: "Government fees change. Confirm the current
//   fee at uscis.gov/fees before you pay."
// - Review $99 / Human Review $199 are brief-given prices
//   (src/lib/serviceTiers.ts), not repo-locked — labelled as such.
"use client";

import { useMemo, useState } from "react";
import {
  FORM_CHECKLIST_TEMPLATES,
  type FormChecklistTemplate,
} from "@/lib/formChecklists";
import {
  GOV_FEE_DISCLAIMER,
  INTAKE_SERVICE_OPTIONS,
  SPEED_OPTIONS,
  getDynamicSchema,
  isDynamicFormCode,
  prepTotalFor,
  type DynamicFormCode,
  type IntakeServiceOption,
  type PrepTierId,
  type SpeedId,
} from "@/lib/dynamicIntakeSchemas";

const TIER_ORDER: PrepTierId[] = ["basic", "standard", "premium"];

const TIER_LABEL: Record<PrepTierId, string> = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
};

function dollars(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

export default function SmartIntakeCalculator() {
  const [goalId, setGoalId] = useState<string | null>(null);
  const [tier, setTier] = useState<PrepTierId | null>(null);
  const [speed, setSpeed] = useState<SpeedId | null>(null);
  const [serviceOption, setServiceOption] =
    useState<IntakeServiceOption>("preparer");

  const goal: FormChecklistTemplate | null = useMemo(
    () => FORM_CHECKLIST_TEMPLATES.find((t) => t.id === goalId) ?? null,
    [goalId]
  );

  // The four expanded forms are the only goals with a speed fee. The
  // goal's first form code identifies them (e.g. "I-131").
  const dynamicCode: DynamicFormCode | null = useMemo(() => {
    if (!goal) return null;
    const code = goal.formsIncluded[0];
    return code && isDynamicFormCode(code) ? code : null;
  }, [goal]);

  const dynamicSchema = dynamicCode ? getDynamicSchema(dynamicCode) : null;

  const pickGoal = (id: string) => {
    setGoalId(id);
    // Nothing carries over between goals: tier and speed start untapped.
    setTier(null);
    setSpeed(null);
  };

  const prepTotal =
    goal && goal.tierPrices && tier
      ? dynamicCode && speed
        ? prepTotalFor(dynamicCode, tier, speed)
        : goal.tierPrices[tier]
      : null;

  const speedFee =
    dynamicCode && speed
      ? SPEED_OPTIONS.find((s) => s.id === speed)?.addedFeeUsd ?? 0
      : null;

  return (
    <section
      aria-labelledby="smart-intake-calculator-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="smart-intake-calculator-heading" className="text-base font-semibold">
        Smart Intake Calculator
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Compare the locked preparation tiers and the government fees before
        you choose. The preparation fee and the government fee are always
        separate — never combined into one price.
      </p>

      {/* Question 1 — goal */}
      <h3 className="mt-4 text-sm font-semibold">
        Question 1 — What immigration goal are you applying for?
      </h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {FORM_CHECKLIST_TEMPLATES.map((template) => {
          const selected = goalId === template.id;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => pickGoal(template.id)}
              aria-pressed={selected}
              className={`rounded border p-3 text-left text-sm ${
                selected
                  ? "border-blue-600 bg-blue-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <span className="font-medium">{template.name}</span>
              <span className="block text-xs text-slate-600">
                {template.formsIncluded.join(", ")}
                {template.tierPrices
                  ? ` · Prep ${dollars(template.tierPrices.basic)} / ${dollars(
                      template.tierPrices.standard
                    )} / ${dollars(template.tierPrices.premium)}`
                  : " · Prep fee TO BE CONFIRMED"}
              </span>
            </button>
          );
        })}
      </div>

      {goal && (
        <div className="mt-4">
          <p className="text-sm text-slate-600">{goal.summary}</p>

          {/* Service option — all four, on every goal */}
          <h3 className="mt-4 text-sm font-semibold">
            Who helps you? (All four options — pick one)
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {INTAKE_SERVICE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setServiceOption(option.id)}
                aria-pressed={serviceOption === option.id}
                title={option.note}
                className={`rounded border px-3 py-1.5 text-xs font-semibold ${
                  serviceOption === option.id
                    ? "border-blue-600 bg-blue-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Review $99 / Human Review $199 are available add-ons
            (brief-given prices, not repo-locked). Only an attorney gives
            legal advice.
          </p>

          {/* Tier — nothing pre-selected */}
          <h3 className="mt-4 text-sm font-semibold">
            Tap a preparation tier (nothing is pre-selected)
          </h3>
          {goal.tierPrices ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {TIER_ORDER.map((tierId) => (
                <button
                  key={tierId}
                  type="button"
                  onClick={() => {
                    setTier(tierId);
                    setSpeed(null);
                  }}
                  aria-pressed={tier === tierId}
                  className={`rounded border px-3 py-2 text-sm font-semibold ${
                    tier === tierId
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  {TIER_LABEL[tierId]} — {dollars(goal.tierPrices![tierId])}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-amber-700">
              No locked prep fee for this goal — TO BE CONFIRMED. Do not
              quote a price until it is confirmed.
            </p>
          )}
          {!tier && goal.tierPrices && (
            <p className="mt-1 text-xs text-slate-500">
              Tap a tier above — no total is shown until you do.
            </p>
          )}

          {/* Speed — expanded forms only, never pre-selected */}
          {tier && dynamicSchema && (
            <>
              <h3 className="mt-4 text-sm font-semibold">
                Tap a preparation speed (packet preparation time — NOT USCIS
                processing time)
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {SPEED_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSpeed(option.id)}
                    aria-pressed={speed === option.id}
                    title={option.note}
                    className={`rounded border px-3 py-2 text-sm font-semibold ${
                      speed === option.id
                        ? "border-blue-600 bg-blue-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    {option.label}
                    {option.addedFeeUsd > 0
                      ? ` +${dollars(option.addedFeeUsd)}`
                      : " +$0"}
                  </button>
                ))}
              </div>
              {!speed && (
                <p className="mt-1 text-xs text-slate-500">
                  Tap a speed above — the prep total needs a tier and a speed.
                </p>
              )}
            </>
          )}

          {/* Totals */}
          {prepTotal !== null && tier && (!dynamicSchema || speed) && (
            <div className="mt-4 rounded border border-slate-200 p-3">
              <h3 className="text-sm font-semibold">
                Your estimate — {goal.name}
              </h3>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <dt>
                    Preparation fee ({TIER_LABEL[tier]}
                    {dynamicSchema && speed
                      ? ` + ${SPEED_OPTIONS.find((s) => s.id === speed)?.label} preparation`
                      : ""}
                    )
                  </dt>
                  <dd className="font-semibold">{dollars(prepTotal)}</dd>
                </div>
                {dynamicSchema && speedFee !== null && speedFee > 0 && (
                  <div className="flex justify-between gap-2 text-xs text-slate-600">
                    <dt>
                      of which: speed fee (
                      {SPEED_OPTIONS.find((s) => s.id === speed)?.label} —
                      packet preparation time, NOT USCIS processing)
                    </dt>
                    <dd>{dollars(speedFee)}</dd>
                  </div>
                )}
              </dl>
              <h4 className="mt-3 text-sm font-semibold">
                Government fees — separate from the preparation fee
              </h4>
              <ul className="mt-1 space-y-1 text-sm">
                {goal.govFees.map((fee) => {
                  // The four expanded forms carry a display amount in
                  // the dynamic schema (e.g. "$580 online"); other
                  // goals use the locked cents value or TO BE CONFIRMED.
                  const dynamicFee = dynamicSchema?.govFees.find(
                    (g) => g.label === fee.label
                  );
                  const amount = dynamicFee?.displayAmount
                    ? dynamicFee.displayAmount
                    : fee.amountCents !== null
                      ? dollars(fee.amountCents / 100)
                      : "TO BE CONFIRMED";
                  return (
                    <li key={fee.label} className="flex flex-wrap justify-between gap-2">
                      <span>
                        {fee.label}
                        {fee.appliesOnly ? ` (${fee.appliesOnly})` : ""}
                      </span>
                      <span className="font-semibold">
                        {amount} — {fee.locked ? "LOCKED" : "TO BE CONFIRMED"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-slate-600">{goal.govTotalNote}</p>
              <p className="mt-2 text-xs font-semibold text-slate-700">
                {GOV_FEE_DISCLAIMER}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Help:{" "}
                {INTAKE_SERVICE_OPTIONS.find((o) => o.id === serviceOption)?.label}
                . Preparation fee shown is the {TIER_LABEL[tier]} tier
                {dynamicSchema && speed
                  ? ` with ${SPEED_OPTIONS.find((s) => s.id === speed)?.label} preparation`
                  : ""}
                . Government fees are paid to the government, not to us.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
