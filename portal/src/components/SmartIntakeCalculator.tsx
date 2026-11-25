"use client";

import { useMemo, useState } from "react";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";
import {
  INTAKE_GOALS,
  SPEED_OPTIONS,
  LOCKED_PAYMENT_PLANS,
  USCIS_FEE_SCHEDULE_URL,
  USCIS_G1055_URL,
  STATE_DEPT_FEES_URL,
  GOV_FEE_DISCLAIMER,
  USCIS_PAYMENT_COMPLIANCE_NOTE,
  determineIntake,
  computePrepTotal,
  lockedGovSubtotalCents,
  installmentsForPlan,
  formatDollars,
  type IntakeGoal,
  type BeneficiaryLocation,
  type FilingMethod,
  type SpeedId,
  type TierId,
  type PaymentPlanType,
} from "@/lib/intakeCalculator";

// ---------------------------------------------------------------------------
// Smart Guided Intake & Instant Fee Calculator.
// 4 plain-English questions -> exact forms, exact gov fees (LOCKED or
// TO BE CONFIRMED), prep tiers with side-by-side totals, locked payment
// plans, and USCIS payment compliance. NOTHING is pre-selected: the
// client must tap a goal, a filing method, a speed, a tier for every
// prep item, and a payment plan before "Confirm Forms & Start
// Application" enables. Prep and government fees are shown on separate
// lines first; a combined budgeting total appears only after both
// subtotals. Language selector covers all 7 languages — it sets the
// preferred language on the order; the UI itself stays in English
// (full translation needs Google Cloud Translation, not connected —
// nothing here is a fake translation).
//
// Confirm posts to /api/confirm-intake-order. Until Supabase is wired
// that route returns 501 / "not configured" and this component says so
// honestly — it never claims an order, case or invoice was created.
// ---------------------------------------------------------------------------

const TIER_LABELS: { id: TierId; label: string }[] = [
  { id: "basic", label: "Basic" },
  { id: "standard", label: "Standard" },
  { id: "premium", label: "Premium" },
];

const inputCls = "mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm";
const pickBtn = (active: boolean) =>
  `rounded border px-3 py-2 text-left text-sm font-semibold ${
    active ? "border-blue-700 bg-blue-50 text-blue-900" : "border-slate-300 bg-white hover:bg-slate-50"
  }`;

export interface SmartIntakeCalculatorProps {
  /** Professional's storefront slug (immigration.niptei.com/p/<slug>).
   *  Omit when embedding without a storefront (e.g. /portal): the
   *  confirm step then explains that the order must start from the
   *  professional's storefront link. */
  providerSlug?: string;
  providerName?: string;
}

export default function SmartIntakeCalculator({ providerSlug, providerName }: SmartIntakeCalculatorProps) {
  const [goal, setGoal] = useState<IntakeGoal | null>(null);
  const [location, setLocation] = useState<BeneficiaryLocation | null>(null);
  const [filingMethod, setFilingMethod] = useState<FilingMethod | null>(null);
  const [speed, setSpeed] = useState<SpeedId | null>(null);
  const [tierSelections, setTierSelections] = useState<Record<string, TierId>>({});
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlanType | null>(null);
  const [premiumProcessing, setPremiumProcessing] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const determination = useMemo(
    () => (goal && filingMethod ? determineIntake(goal, goal === "family" ? location : "inside_us", filingMethod) : null),
    [goal, location, filingMethod]
  );
  const prep = useMemo(
    () => (determination && speed ? computePrepTotal(determination, Object.entries(tierSelections).map(([key, tier]) => ({ key, tier })), speed) : null),
    [determination, tierSelections, speed]
  );
  const lockedGovCents = determination ? lockedGovSubtotalCents(determination.govFees) : 0;
  const installments = useMemo(
    () => (prep?.prepFeeCents !== null && prep?.prepFeeCents !== undefined && paymentPlan ? installmentsForPlan(prep.prepFeeCents, paymentPlan) : []),
    [prep, paymentPlan]
  );
  const tbcGovFees = determination?.govFees.filter((f) => !f.locked) ?? [];

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim());
  const readyToConfirm =
    Boolean(providerSlug) &&
    Boolean(goal) &&
    (goal !== "family" || Boolean(location)) &&
    Boolean(filingMethod) &&
    Boolean(speed) &&
    Boolean(prep) &&
    prep !== null &&
    prep.prepFeeCents !== null &&
    Boolean(paymentPlan) &&
    clientName.trim().length > 0 &&
    emailValid &&
    !submitting;

  const missingSteps: string[] = [];
  if (!providerSlug) missingSteps.push("Open this from your professional's storefront link (immigration.niptei.com/p/<slug>) — this page does not know which professional's storefront you came from.");
  if (!goal) missingSteps.push("Answer question 1 — what is your immigration goal?");
  if (goal === "family" && !location) missingSteps.push("Answer question 2 — where is the beneficiary?");
  if (!filingMethod) missingSteps.push("Answer question 3 — online or paper filing?");
  if (!speed) missingSteps.push("Answer question 4 — how fast do you need the packet prepared?");
  if (determination && prep && prep.missing.length > 0) missingSteps.push(...prep.missing);
  if (!paymentPlan) missingSteps.push("Choose a payment plan — Pay in Full, Pay in 3, Monthly 6 or Monthly 12.");
  if (!clientName.trim()) missingSteps.push("Enter your full name.");
  if (!emailValid) missingSteps.push("Enter a valid email.");

  const pickTier = (key: string, tier: TierId) => {
    setTierSelections((prev) => ({ ...prev, [key]: tier }));
    setError(null);
  };

  const confirm = async () => {
    setError(null);
    setResult(null);
    if (!readyToConfirm || !goal || !filingMethod || !speed || !paymentPlan || !prep || prep.prepFeeCents === null || !providerSlug) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/confirm-intake-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerSlug,
          goal,
          beneficiaryLocation: goal === "family" ? location : null,
          filingMethod,
          speed,
          tierSelections: Object.entries(tierSelections).map(([key, tier]) => ({ key, tier })),
          paymentPlan,
          premiumProcessing: determination?.premiumProcessingEligible ? premiumProcessing : false,
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          clientPhone: clientPhone.trim() || undefined,
          preferredLanguage: language,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.status === 501) {
        setError(
          `Not started yet — ${typeof data.error === "string" ? data.error : "the intake order service is not configured (Supabase is not wired)."} No case, order or invoice was created.`
        );
        return;
      }
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : `Could not start the application (HTTP ${res.status}). Nothing was created.`);
        return;
      }
      if (typeof data.redirectUrl === "string" && data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      setResult("Your application was started. No redirect was returned — ask your professional for your portal link.");
    } catch (e) {
      setError(`Could not reach the intake service: ${e instanceof Error ? e.message : "network error"}. Nothing was created.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="smart-intake-heading" className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm sm:p-5">
      <h2 id="smart-intake-heading" className="text-lg font-bold">
        Smart Guided Intake &amp; Instant Fee Calculator
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Answer 4 questions in plain English. Nothing is pre-selected — you choose every step.
        {providerName ? ` Your professional: ${providerName}.` : ""}
      </p>

      {/* Language selector — all 7 languages. Sets the order language. */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <label htmlFor="intake-lang" className="font-medium">Your language:</label>
        <select id="intake-lang" value={language} onChange={(e) => setLanguage(e.target.value as LanguageCode)} className="rounded border border-slate-300 px-2 py-1 text-sm">
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label} — {l.native}</option>
          ))}
        </select>
        <span className="text-slate-500">This sets the language on your case. Full translation of this page needs Google Cloud Translation (not connected yet) — nothing here is machine-translated.</span>
      </div>

      {/* Q1 — goal */}
      <fieldset className="mt-4">
        <legend className="text-sm font-bold">1. What is your immigration goal?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {INTAKE_GOALS.map((g) => (
            <button key={g.id} type="button" aria-pressed={goal === g.id} onClick={() => { setGoal(g.id); if (g.id !== "family") setLocation(null); setError(null); }} className={pickBtn(goal === g.id)}>
              {g.label}
              <span className="mt-0.5 block text-xs font-normal text-slate-600">{g.plainEnglish}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Q2 — location (family green card only) */}
      {goal === "family" && (
        <fieldset className="mt-4">
          <legend className="text-sm font-bold">2. Where is the beneficiary (the family member)?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button type="button" aria-pressed={location === "inside_us"} onClick={() => setLocation("inside_us")} className={pickBtn(location === "inside_us")}>
              Inside the United States — Adjustment of Status
              <span className="mt-0.5 block text-xs font-normal text-slate-600">Your family member is already in the U.S. and files Form I-485 here.</span>
            </button>
            <button type="button" aria-pressed={location === "outside_us"} onClick={() => setLocation("outside_us")} className={pickBtn(location === "outside_us")}>
              Outside the United States — Consular / NVC
              <span className="mt-0.5 block text-xs font-normal text-slate-600">Your family member is abroad and goes through the National Visa Center and a U.S. embassy interview.</span>
            </button>
          </div>
        </fieldset>
      )}
      {goal && goal !== "family" && (
        <p className="mt-4 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Question 2 does not apply to {INTAKE_GOALS.find((g) => g.id === goal)?.label} — this goal is filed from inside the United States.
        </p>
      )}

      {/* Q3 — filing method */}
      <fieldset className="mt-4">
        <legend className="text-sm font-bold">3. Online or paper filing?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <button type="button" aria-pressed={filingMethod === "online"} onClick={() => setFilingMethod("online")} className={pickBtn(filingMethod === "online")}>
            Online filing
            <span className="mt-0.5 block text-xs font-normal text-slate-600">File through your USCIS online account where the form allows it.</span>
          </button>
          <button type="button" aria-pressed={filingMethod === "paper"} onClick={() => setFilingMethod("paper")} className={pickBtn(filingMethod === "paper")}>
            Paper filing
            <span className="mt-0.5 block text-xs font-normal text-slate-600">Mail the paper forms to USCIS. {USCIS_PAYMENT_COMPLIANCE_NOTE}</span>
          </button>
        </div>
        {filingMethod === "paper" && (
          <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{USCIS_PAYMENT_COMPLIANCE_NOTE}</p>
        )}
      </fieldset>

      {/* Q4 — speed */}
      <fieldset className="mt-4">
        <legend className="text-sm font-bold">4. How fast do you need the packet prepared?</legend>
        <p className="mt-1 text-xs text-slate-500">This is packet PREPARATION time — how fast we prepare your forms. It is NOT USCIS processing time. USCIS decides your case on its own timeline.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {SPEED_OPTIONS.map((s) => (
            <button key={s.id} type="button" aria-pressed={speed === s.id} onClick={() => setSpeed(s.id)} className={pickBtn(speed === s.id)}>
              {s.label} — {s.dayRange}
              <span className="mt-0.5 block text-xs font-normal text-slate-600">{s.feeCents === 0 ? "Included in the tier price ($0 extra)" : `+${formatDollars(s.feeCents)}`}. {s.note}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Forms + tiers + totals — only once Q1–Q4 are answered */}
      {determination && speed && (
        <div className="mt-5 space-y-4 border-t border-slate-200 pt-4">
          <div>
            <h3 className="text-sm font-bold">Forms required — {determination.packageTitle}</h3>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {determination.forms.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            {determination.notes.map((n) => (
              <p key={n} className="mt-1 text-xs text-slate-600">{n}</p>
            ))}
          </div>

          {/* Tier pickers — one per prep item, nothing pre-selected */}
          {determination.prepItems.map((item) => (
            <div key={item.key} className="rounded border border-slate-200 p-3">
              <p className="text-sm font-bold">{item.label}</p>
              <p className="mt-0.5 text-xs text-slate-600">{item.note}</p>
              {item.tierPrices ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {TIER_LABELS.map((t) => (
                    <button key={t.id} type="button" aria-pressed={tierSelections[item.key] === t.id} onClick={() => pickTier(item.key, t.id)} className={pickBtn(tierSelections[item.key] === t.id)}>
                      {t.label} — ${item.tierPrices ? item.tierPrices[t.id].toLocaleString("en-US") : ""}
                      <span className="mt-0.5 block text-xs font-normal text-slate-600">Preparation fee for this form{determination.prepItems.length > 1 ? " (each form is priced separately)" : ""}.</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                  Price TO BE CONFIRMED — this part has no locked price yet, so it is not in the total below. Your professional confirms it before you pay anything.
                </p>
              )}
            </div>
          ))}

          {/* Premium Processing — OPT/STEM EAD only, or I-539 eligible F/J/M only */}
          {determination.premiumProcessingEligible && (
            <label className="block rounded border border-slate-200 p-3 text-sm">
              <input type="checkbox" checked={premiumProcessing} onChange={(e) => setPremiumProcessing(e.target.checked)} className="mr-2" />
              <strong>{determination.premiumProcessingLabel ?? "Add Premium Processing — Form I-907 ($1,780 — TO BE CONFIRMED)."}</strong>{" "}
              {determination.premiumProcessingLabel ? null : "Only for OPT / STEM EAD categories. It is never offered for I-130 / I-485. Your professional confirms your category before it is added. "}(Not added to the totals below — the fee is TO BE CONFIRMED.)
            </label>
          )}

          {/* Fee breakdown — prep and government on separate lines first */}
          <div className="rounded border border-slate-300 p-3">
            <h3 className="text-sm font-bold">Your fee breakdown — preparation and government fees are always separate</h3>
            <dl className="mt-2 space-y-1 text-sm">
              {determination.prepItems.map((item) => {
                const tier = tierSelections[item.key];
                return (
                  <div key={item.key} className="flex flex-wrap justify-between gap-2">
                    <dt>Prep fee — {item.label}</dt>
                    <dd className="font-semibold">{item.tierPrices ? (tier ? `${formatDollars(item.tierPrices[tier] * 100)} (${TIER_LABELS.find((t) => t.id === tier)?.label})` : "Choose a tier above") : "TO BE CONFIRMED"}</dd>
                  </div>
                );
              })}
              <div className="flex flex-wrap justify-between gap-2">
                <dt>Preparation speed — {SPEED_OPTIONS.find((s) => s.id === speed)?.label} ({SPEED_OPTIONS.find((s) => s.id === speed)?.dayRange})</dt>
                <dd className="font-semibold">{SPEED_OPTIONS.find((s) => s.id === speed)?.feeCents === 0 ? "$0.00 (included)" : `+${formatDollars(SPEED_OPTIONS.find((s) => s.id === speed)?.feeCents ?? 0)}`}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-1">
                <dt className="font-bold">Preparation subtotal (what you pay us)</dt>
                <dd className="font-bold">{prep && prep.prepFeeCents !== null ? formatDollars(prep.prepFeeCents) : "Choose a tier for every item above"}</dd>
              </div>
            </dl>

            <h4 className="mt-3 text-sm font-bold">Government fees (paid directly to USCIS / the Department of State — never to us, never in the prep total)</h4>
            <dl className="mt-2 space-y-1 text-sm">
              {determination.govFees.map((fee) => (
                <div key={fee.label} className="flex flex-wrap justify-between gap-2">
                  <dt>
                    {fee.label}{" "}
                    <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${fee.locked ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-900"}`}>
                      {fee.locked ? "LOCKED" : "TO BE CONFIRMED"}
                    </span>
                    {fee.note ? <span className="block text-xs font-normal text-slate-600">{fee.note}</span> : null}
                  </dt>
                  <dd className="font-semibold">{fee.amountCents !== null ? formatDollars(fee.amountCents) : "TO BE CONFIRMED"}</dd>
                </div>
              ))}
              <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-1">
                <dt className="font-bold">Government subtotal (locked fees only — TO BE CONFIRMED fees are not counted)</dt>
                <dd className="font-bold">{formatDollars(lockedGovCents)}</dd>
              </div>
            </dl>
            {tbcGovFees.length > 0 && (
              <p className="mt-2 text-xs text-slate-600">
                Not counted in the government subtotal (TO BE CONFIRMED): {tbcGovFees.map((f) => f.label).join("; ")}. {GOV_FEE_DISCLAIMER}
              </p>
            )}
            {prep && prep.prepFeeCents !== null && (
              <div className="mt-3 flex flex-wrap justify-between gap-2 rounded bg-slate-100 px-3 py-2 text-sm">
                <span className="font-bold">Total to budget (preparation subtotal + locked government fees)</span>
                <span className="font-bold">{formatDollars(prep.prepFeeCents + lockedGovCents)}</span>
              </div>
            )}
            <p className="mt-2 text-xs text-slate-600">
              {GOV_FEE_DISCLAIMER} Sources:{" "}
              <a href={USCIS_FEE_SCHEDULE_URL} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">uscis.gov/fees</a>
              {" · "}
              <a href={USCIS_G1055_URL} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">uscis.gov/g-1055</a>
              {" · "}
              <a href={STATE_DEPT_FEES_URL} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">travel.state.gov — Fees for Visa Services</a>.
            </p>
            {filingMethod === "paper" && (
              <p className="mt-1 text-xs font-semibold text-slate-700">{USCIS_PAYMENT_COMPLIANCE_NOTE}</p>
            )}
          </div>

          {/* Payment plan — locked only, nothing pre-selected */}
          <fieldset>
            <legend className="text-sm font-bold">How do you want to pay the preparation fee?</legend>
            <p className="mt-1 text-xs text-slate-500">Government fees are paid separately, directly to USCIS / the Department of State — they are never on a payment plan here.</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              {LOCKED_PAYMENT_PLANS.map((p) => (
                <button key={p.id} type="button" aria-pressed={paymentPlan === p.id} onClick={() => setPaymentPlan(p.id)} className={pickBtn(paymentPlan === p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
            {paymentPlan && prep && prep.prepFeeCents !== null && (
              <ul className="mt-2 space-y-1 text-sm">
                {installments.map((inst, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-2 rounded border border-slate-200 px-3 py-1.5">
                    <span>{inst.label} — due {inst.dueDate}</span>
                    <span className="font-semibold">{formatDollars(inst.amountCents)}</span>
                  </li>
                ))}
                <li className="text-xs text-slate-600">If you miss a payment, 50% is added to the total amount. E-Sign unlocks only once the balance is paid in full.</li>
              </ul>
            )}
          </fieldset>

          {/* Contact details */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Your full name *</span>
              <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputCls} placeholder="e.g. Carlos Mendez" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Email *</span>
              <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={inputCls} placeholder="you@example.com" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Phone (optional)</span>
              <input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className={inputCls} placeholder="+1 772 555 0194" />
            </label>
            <p className="text-xs text-slate-500 sm:self-end">We use your email to create your client account (Supabase Auth email-confirmation flow) and to send your portal link. No account is created until you press Confirm below.</p>
          </div>

          {/* Confirm */}
          {missingSteps.length > 0 && (
            <ul className="list-disc space-y-1 rounded border border-amber-300 bg-amber-50 px-5 py-2 text-sm text-amber-900">
              {missingSteps.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          {error && (
            <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900">{error}</p>
          )}
          {result && (
            <p className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">{result}</p>
          )}
          <button
            type="button"
            disabled={!readyToConfirm}
            onClick={() => void confirm()}
            className="w-full rounded bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          >
            {submitting ? "Starting your application…" : "Confirm Forms & Start Application"}
          </button>
          <p className="text-xs text-slate-500">
            Confirming creates your case, your order and invoices, and your document checklist in your professional&apos;s pipeline — and takes you to your portal. No payment is taken here: Stripe checkout is NOT connected, so your professional sends you a payment link for the first invoice. Government fees are paid separately to USCIS / the Department of State.
          </p>
        </div>
      )}
    </section>
  );
}
