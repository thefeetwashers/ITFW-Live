// "More added" hub — six further expert features beyond the 20
// differentiators (Nov 28, 2026). Everything interactive on this page
// runs in the browser on what the visitor types; nothing typed here is
// sent anywhere or saved. Trackers show honest empty states until a
// real stored record exists — no fake appointments, moves, or payments.
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AR11_CHECKLIST,
  AR11_NEVER_FILES_NOTICE,
  AR11_RULE,
  EMERGENCY_GUIDE,
  EMERGENCY_GUIDE_INTRO,
  MORE_ADDED_NOT_AFFILIATED_NOTICE,
  SPONSOR_CALCULATOR_NOT_A_DECISION,
  TRANSLATION_DOCUMENT_TYPES,
  TRANSLATION_PRICE_PER_PAGE_CENTS,
  ar11View,
  biometricsTrackerView,
  emergencyScenario,
  i290bLockedPrices,
  paymentPlanDashboard,
  sponsorCalculator,
  translationEstimate,
  todayIso,
  type BiometricsAppointment,
  type EmergencyScenarioId,
  type SponsorRegion,
  type TranslationItem,
} from "@/lib/moreAdded";

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-slate-700">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
      {text}
    </p>
  );
}

export default function MoreAddedPage() {
  const today = todayIso();
  const [scenario, setScenario] = useState<EmergencyScenarioId>("rfe");
  const sc = emergencyScenario(scenario);
  const i290b = i290bLockedPrices();

  // --- Sponsor calculator (typed locally, never sent) ---
  const [household, setHousehold] = useState("4");
  const [region, setRegion] = useState<SponsorRegion>("contiguous");
  const [income, setIncome] = useState("30000");
  const [assets, setAssets] = useState("0");
  const [spouseChild, setSpouseChild] = useState(false);
  const [jointIncome, setJointIncome] = useState("");
  const sponsor = useMemo(() => {
    const n = (v: string, fallback: number) => {
      const parsed = Number(v);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    };
    return sponsorCalculator({
      householdSize: Math.max(2, Math.floor(n(household, 4))),
      region,
      military: false,
      income: n(income, 0),
      assets: n(assets, 0),
      isSpouseOrMinorChildOfUSC: spouseChild,
      jointSponsor: jointIncome
        ? {
            householdSize: Math.max(2, Math.floor(n(household, 4))),
            region,
            military: false,
            income: n(jointIncome, 0),
            assets: 0,
            isSpouseOrMinorChildOfUSC: false,
          }
        : null,
    });
  }, [household, region, income, assets, spouseChild, jointIncome]);

  // --- Translation estimator ---
  const [pages, setPages] = useState<Record<string, string>>({ birth: "2", marriage: "1" });
  const translation = useMemo(() => {
    const items: TranslationItem[] = Object.entries(pages)
      .filter(([, v]) => v !== "")
      .map(([documentType, v]) => ({
        documentType,
        pages: Math.max(0, Math.floor(Number(v) || 0)),
        status: "needed" as const,
      }));
    return translationEstimate(items);
  }, [pages]);

  // --- Payment plan dashboard: honest empty state + a worked example
  // labelled as an example (locked $1,799 Standard bundle, Pay in 3).
  // The live dashboard reads a real payment_plans row; this page shows
  // the math on the example so the rule is visible before any plan exists.
  const examplePlan = useMemo(
    () =>
      paymentPlanDashboard(
        {
          id: "example-only",
          caseId: "example-only",
          totalServiceFeeCents: 179900,
          payChoice: "installments_3",
          installmentAmountsCents: [59967, 59967, 59966],
          paidCents: 59967,
          missedPaymentPenaltyPercent: 50,
          status: "active",
        },
        "installments_3",
        "2026-11-01",
        today
      ),
    [today]
  );

  // --- AR-11 helper (typed locally) ---
  const [moveDate, setMoveDate] = useState("");
  const ar11 = moveDate ? ar11View(moveDate, today) : null;

  // --- Biometrics tracker: no stored record yet = honest empty state.
  const demoBiometrics: BiometricsAppointment = {
    id: "example-only",
    caseId: "example-only",
    appointmentDate: "2026-12-10",
    ascLocation: "As printed on your I-797C notice",
    noticeReceivedAt: null,
    status: "scheduled",
    rescheduledFromDate: null,
  };
  const demoBio = biometricsTrackerView(demoBiometrics, today);

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">More added — beyond the 20 differentiators</h1>
        <p className="mt-2 text-sm text-slate-600">
          Six further expert features, added Nov 28, 2026 on the founder&apos;s instruction to leave
          nothing behind. Everything here is computed from locked data already in the codebase or
          from dates you enter yourself.
        </p>
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {MORE_ADDED_NOT_AFFILIATED_NOTICE}
        </p>
      </header>

      <Section title="1. Biometrics appointment tracker">
        <p>
          The Backbone page explains biometrics. This tracker stores the appointment itself — date,
          place, and outcome — from your own I-797C notice. A date that passed with no outcome
          recorded is shown as unconfirmed, never guessed.
        </p>
        <EmptyState text="No biometrics appointment stored yet. Add the date, time, and place straight from your I-797C notice and the tracker will count the days and flag a missed appointment." />
        <p className="text-xs text-slate-500">
          Worked example (not a real appointment): {demoBio.headline} Bring the I-797C notice and a
          photo ID.
        </p>
      </Section>

      <Section title="2. Address-change (AR-11) helper">
        <p>{AR11_RULE}</p>
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {AR11_NEVER_FILES_NOTICE}
        </p>
        <label className="block text-xs font-medium text-slate-700">
          Date you moved
          <input
            type="date"
            value={moveDate}
            onChange={(e) => setMoveDate(e.target.value)}
            className="mt-1 block rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        {ar11 && (
          <p className="font-medium text-slate-900">
            {ar11.headline} Deadline: {ar11.deadline}.
          </p>
        )}
        <ul className="list-disc space-y-1 pl-5">
          {AR11_CHECKLIST.map((item) => (
            <li key={item.id}>
              <span className="font-medium">{item.label}.</span> {item.detail}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="3. Emergency “what if” guide">
        <p>{EMERGENCY_GUIDE_INTRO}</p>
        <div className="flex flex-wrap gap-2">
          {EMERGENCY_GUIDE.map((s) => (
            <button
              key={s.id}
              onClick={() => setScenario(s.id)}
              className={`rounded border px-3 py-1 text-xs font-medium ${
                scenario === s.id
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
        <h3 className="font-semibold text-slate-900">{sc.title}</h3>
        <p>{sc.whatHappened}</p>
        <p className="font-medium text-slate-900">Do first:</p>
        <ul className="list-disc space-y-1 pl-5">
          {sc.doNow.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
        <p className="font-medium text-slate-900">Do not:</p>
        <ul className="list-disc space-y-1 pl-5">
          {sc.doNot.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">Deadline source: {sc.deadlineSource}</p>
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {sc.attorneyNote}
        </p>
        {scenario === "denied" && (
          <p className="text-xs text-slate-600">
            Locked I-290B document-preparation prices (preparation only, never the legal decision to
            file): Basic {dollars(i290b.basic)}, Standard {dollars(i290b.standard)}, Premium{" "}
            {dollars(i290b.premium)}.
          </p>
        )}
      </Section>

      <Section title="4. Sponsor income calculator (numbers only)">
        <p>
          Compares household income with the locked 2026 I-864P 125% figures and shows the shortfall
          and the asset multiple (3x for a spouse or minor child of a U.S. citizen, 5x otherwise).
          A joint sponsor is judged on their own household, never combined with the petitioner.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-slate-700">
            Household size
            <input type="number" min={2} value={household} onChange={(e) => setHousehold(e.target.value)} className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm" />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Region
            <select value={region} onChange={(e) => setRegion(e.target.value as SponsorRegion)} className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm">
              <option value="contiguous">Contiguous U.S.</option>
              <option value="alaska">Alaska</option>
              <option value="hawaii">Hawaii</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Annual household income ($)
            <input type="number" min={0} value={income} onChange={(e) => setIncome(e.target.value)} className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm" />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Assets ($)
            <input type="number" min={0} value={assets} onChange={(e) => setAssets(e.target.value)} className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm" />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Joint sponsor income ($) — optional
            <input type="number" min={0} value={jointIncome} onChange={(e) => setJointIncome(e.target.value)} placeholder="Leave blank if none" className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm" />
          </label>
          <label className="flex items-end gap-2 text-xs font-medium text-slate-700">
            <input type="checkbox" checked={spouseChild} onChange={(e) => setSpouseChild(e.target.checked)} />
            Spouse / minor child of a U.S. citizen (3x assets)
          </label>
        </div>
        <p>
          <span className="font-medium">Petitioner:</span> required{" "}
          ${sponsor.petitioner.required.toLocaleString("en-US")} · shortfall{" "}
          ${sponsor.petitioner.shortfall.toLocaleString("en-US")} · asset multiple{" "}
          {sponsor.petitioner.multiplier}x · assets needed{" "}
          ${sponsor.petitioner.assetsNeeded.toLocaleString("en-US")}
        </p>
        <p>{sponsor.petitioner.reading}</p>
        {sponsor.jointSponsor && (
          <p>
            <span className="font-medium">Joint sponsor (own household):</span>{" "}
            {sponsor.jointSponsor.reading}
          </p>
        )}
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {SPONSOR_CALCULATOR_NOT_A_DECISION}
        </p>
        <p className="text-xs text-slate-500">{sponsor.sourceNote}</p>
      </Section>

      <Section title="5. Document translation tracker">
        <p>
          Certified translation — {dollars(TRANSLATION_PRICE_PER_PAGE_CENTS)} per page (locked price).
          Enter page counts per document; a document with 0 pages has no cost yet because its page
          count is unknown — never guessed.
        </p>
        <div className="space-y-2">
          {TRANSLATION_DOCUMENT_TYPES.filter((t) => t.needsTranslation).map((t) => (
            <label key={t.id} className="flex items-center justify-between gap-3 text-xs text-slate-700">
              <span>
                <span className="font-medium">{t.document}.</span> {t.note}
              </span>
              <input
                type="number"
                min={0}
                value={pages[t.id] ?? ""}
                placeholder="Pages"
                onChange={(e) => setPages((prev) => ({ ...prev, [t.id]: e.target.value }))}
                className="w-20 shrink-0 rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
          ))}
        </div>
        <ul className="space-y-1">
          {translation.rows.map((row) => (
            <li key={row.documentType} className="flex justify-between text-xs">
              <span>
                {row.document} — {row.pages} page{row.pages === 1 ? "" : "s"} ({row.status})
              </span>
              <span className="font-medium">{dollars(row.costCents)}</span>
            </li>
          ))}
        </ul>
        <p className="font-medium text-slate-900">
          Total: {translation.totalPages} pages — {dollars(translation.totalCents)}
        </p>
        <p className="text-xs text-slate-500">{translation.note}</p>
      </Section>

      <Section title="6. Payment plan dashboard">
        <p>
          Pay in 3 / Monthly 6 / Monthly 12, from the real payment_plans record: installments, next
          payment, and the exact missed-payment math.
        </p>
        <EmptyState text="No payment plan stored for this case yet. When a plan exists, its installments, next payment date, and missed-payment math appear here from the stored record — never from a front-end flag." />
        <p className="text-xs text-slate-500">
          Worked example (Standard bundle $1,799, Pay in 3, first due Nov 1, 2026, $599.67 paid —
          not a real plan): {examplePlan.installments.map((i) => `${i.label} ${dollars(i.amountCents)} — ${i.state}`).join("; ")}.{" "}
          {examplePlan.missedPenaltyCents > 0
            ? `Missed penalty: ${dollars(examplePlan.missedPenaltyCents)}.`
            : "No missed installment in the example."}{" "}
          {examplePlan.missedRule}
        </p>
        <p className="text-xs text-slate-500">
          <Link href="/backbone" className="underline">Backbone</Link> ·{" "}
          <Link href="/client-dashboard" className="underline">Client dashboard</Link>
        </p>
      </Section>
    </main>
  );
}
