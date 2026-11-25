// Visa Bulletin matcher — client portal section.
// The client enters their priority date, category and country of BIRTH;
// the result is shown in plain English (or Spanish / Kreyòl) against the
// cutoff dates the professional entered from the official Visa Bulletin.
// When no bulletin has been entered, the section says so honestly and
// checks nothing — it never invents a cutoff.
"use client";

import { useMemo, useState } from "react";
import {
  CHARGEABILITY_COUNTRIES,
  CHART_LABELS,
  VISA_CATEGORIES,
  matchPriorityDate,
  type BulletinChartKind,
  type BulletinMonth,
  type ChargeabilityCountry,
  type MatcherLanguage,
  type VisaCategory,
} from "@/lib/visaBulletin";

const UI_TEXT: Record<
  MatcherLanguage,
  { title: string; intro: string; priorityDate: string; category: string; birthCountry: string; spouseBirthCountry: string; spouseHint: string; chart: string; adjustment: string; consular: string; check: string; noBulletin: string; noCutoff: string; resultFor: string; cutoffLabel: string; chargeabilityLabel: string; crossLabel: string }
> = {
  en: {
    title: "Visa Bulletin — Is My Priority Date Current?",
    intro:
      "Your priority date is your place in line. Compare it with the cutoff dates your preparer entered from the official Visa Bulletin. Chargeability is your country of birth — not your citizenship.",
    priorityDate: "Priority date",
    category: "Category",
    birthCountry: "Country of birth (yours)",
    spouseBirthCountry: "Country of birth (spouse, if different)",
    spouseHint: "Leave blank if not married, or if your spouse was born in the same country.",
    chart: "Which case is this?",
    adjustment: "Adjustment of status in the U.S. — Dates for Filing chart",
    consular: "Consular processing abroad — Final Action Dates chart",
    check: "Check my priority date",
    noBulletin:
      "No Visa Bulletin has been entered yet. Your preparer enters each month's cutoff dates from the official Visa Bulletin at travel.state.gov. Nothing is checked until then — no date here is guessed.",
    noCutoff:
      "No cutoff was entered for this category, country and chart for this bulletin month. Ask your preparer to enter it from the official Visa Bulletin.",
    resultFor: "Result",
    cutoffLabel: "Cutoff used",
    chargeabilityLabel: "Chargeability used",
    crossLabel: "Cross-chargeability applied: your spouse's country of birth was used because it is more favorable.",
  },
  es: {
    title: "Boletín de Visas — ¿Mi fecha de prioridad está actual?",
    intro:
      "Su fecha de prioridad es su lugar en la fila. Compárela con las fechas límite que su preparador copió del Boletín de Visas oficial. La cargabilidad es su país de nacimiento — no su ciudadanía.",
    priorityDate: "Fecha de prioridad",
    category: "Categoría",
    birthCountry: "País de nacimiento (usted)",
    spouseBirthCountry: "País de nacimiento (cónyuge, si es diferente)",
    spouseHint: "Déjelo en blanco si no está casado, o si su cónyuge nació en el mismo país.",
    chart: "¿Qué tipo de caso es?",
    adjustment: "Ajuste de estatus en EE. UU. — tabla de Fechas para Presentar",
    consular: "Proceso consular en el extranjero — tabla de Fechas de Acción Final",
    check: "Verificar mi fecha de prioridad",
    noBulletin:
      "Aún no se ha ingresado ningún Boletín de Visas. Su preparador ingresa las fechas límite de cada mes desde el Boletín oficial en travel.state.gov. Nada se verifica hasta entonces — ninguna fecha aquí es inventada.",
    noCutoff:
      "No se ingresó ninguna fecha límite para esta categoría, país y tabla en este mes. Pida a su preparador que la ingrese desde el Boletín oficial.",
    resultFor: "Resultado",
    cutoffLabel: "Fecha límite usada",
    chargeabilityLabel: "Cargabilidad usada",
    crossLabel: "Se aplicó cargabilidad cruzada: se usó el país de nacimiento de su cónyuge porque es más favorable.",
  },
  ht: {
    title: "Bilten Viza — Èske dat priorite mwen an kouran?",
    intro:
      "Dat priorite ou se plas ou nan liy lan. Konpare l ak dat limit preparatè ou te antre apati Bilten Viza ofisyèl la. Chajabilite se peyi kote ou te fèt — se pa sitwayènte ou.",
    priorityDate: "Dat priorite",
    category: "Kategori",
    birthCountry: "Peyi kote ou te fèt",
    spouseBirthCountry: "Peyi kote mari/madanm ou te fèt (si li diferan)",
    spouseHint: "Kite l vid si ou pa marye, oswa si mari/madanm ou te fèt nan menm peyi a.",
    chart: "Ki kalite ka sa a?",
    adjustment: "Ajisteman estati Ozetazini — tablo Dat pou Depoze",
    consular: "Pwosesis konsilè aletranje — tablo Dat Aksyon Final",
    check: "Tcheke dat priorite mwen an",
    noBulletin:
      "Yo poko antre okenn Bilten Viza. Preparatè ou antre dat limit chak mwa apati Bilten Viza ofisyèl la sou travel.state.gov. Yo pa tcheke anyen jiskaske — okenn dat isit la pa envante.",
    noCutoff:
      "Yo pa t antre okenn dat limit pou kategori, peyi ak tablo sa a pou mwa sa a. Mande preparatè ou pou l antre l apati Bilten Viza ofisyèl la.",
    resultFor: "Rezilta",
    cutoffLabel: "Dat limit yo te itilize",
    chargeabilityLabel: "Chajabilite yo te itilize",
    crossLabel: "Yo te aplike chajabilite kwa: yo te itilize peyi kote mari/madanm ou te fèt paske li pi favorab.",
  },
};

function cutoffDisplay(c: { isCurrent: boolean; isUnavailable: boolean; cutoffDate: string | null }): string {
  if (c.isCurrent) return "C — Current";
  if (c.isUnavailable) return "U — Unavailable";
  return c.cutoffDate ?? "—";
}

export default function VisaBulletinMatcher({
  bulletin,
}: {
  /** Stored bulletin month + cutoffs, when the professional entered one. */
  bulletin?: BulletinMonth | null;
}) {
  const [language, setLanguage] = useState<MatcherLanguage>("en");
  const [priorityDate, setPriorityDate] = useState("");
  const [category, setCategory] = useState<VisaCategory>("F2A");
  const [birthCountry, setBirthCountry] = useState<ChargeabilityCountry>("WORLDWIDE");
  const [spouseBirthCountry, setSpouseBirthCountry] = useState<ChargeabilityCountry | "">("");
  const [chartKind, setChartKind] = useState<BulletinChartKind>("dates_for_filing");
  const [checked, setChecked] = useState(false);

  const t = UI_TEXT[language];

  const result = useMemo(() => {
    if (!checked || !bulletin || !priorityDate) return null;
    return matchPriorityDate({
      priorityDate,
      category,
      birthCountry,
      spouseBirthCountry: spouseBirthCountry || null,
      chartKind,
      bulletin,
      language,
    });
  }, [checked, bulletin, priorityDate, category, birthCountry, spouseBirthCountry, chartKind, language]);

  return (
    <section
      aria-labelledby="visa-bulletin-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="visa-bulletin-heading" className="text-base font-semibold">
          {t.title}
        </h2>
        <label className="text-sm">
          <span className="sr-only">Language / Idioma / Lang</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as MatcherLanguage)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="ht">Kreyòl Ayisyen</option>
          </select>
        </label>
      </div>
      <p className="mt-1 text-sm text-slate-600">{t.intro}</p>

      {!bulletin ? (
        <p role="status" className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          {t.noBulletin}
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-slate-500">
            Bulletin month: <strong>{bulletin.bulletinMonth}</strong> · Chart:{" "}
            <strong>{CHART_LABELS[chartKind].short}</strong> · Source:{" "}
            <a href={bulletin.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">
              travel.state.gov
            </a>
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              {t.priorityDate}
              <input
                type="date"
                value={priorityDate}
                onChange={(e) => { setPriorityDate(e.target.value); setChecked(false); }}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="text-sm">
              {t.category}
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value as VisaCategory); setChecked(false); }}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              >
                {VISA_CATEGORIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              {t.birthCountry}
              <select
                value={birthCountry}
                onChange={(e) => { setBirthCountry(e.target.value as ChargeabilityCountry); setChecked(false); }}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              >
                {CHARGEABILITY_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              {t.spouseBirthCountry}
              <select
                value={spouseBirthCountry}
                onChange={(e) => { setSpouseBirthCountry(e.target.value as ChargeabilityCountry | ""); setChecked(false); }}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              >
                <option value="">—</option>
                {CHARGEABILITY_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-500">{t.spouseHint}</span>
            </label>
          </div>
          <fieldset className="mt-3 text-sm">
            <legend className="font-medium">{t.chart}</legend>
            <label className="mt-1 block">
              <input
                type="radio"
                name="vb-chart"
                checked={chartKind === "dates_for_filing"}
                onChange={() => { setChartKind("dates_for_filing"); setChecked(false); }}
              />{" "}
              {t.adjustment}
            </label>
            <label className="mt-1 block">
              <input
                type="radio"
                name="vb-chart"
                checked={chartKind === "final_action"}
                onChange={() => { setChartKind("final_action"); setChecked(false); }}
              />{" "}
              {t.consular}
            </label>
            <p className="mt-1 text-xs text-slate-500">{CHART_LABELS[chartKind].long}</p>
          </fieldset>
          <button
            type="button"
            disabled={!priorityDate}
            onClick={() => setChecked(true)}
            className="mt-3 rounded bg-blue-700 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t.check}
          </button>

          {checked && priorityDate && (
            <div role="status" className="mt-3 rounded border border-slate-300 bg-slate-50 p-3 text-sm">
              {result === null ? (
                <p className="font-medium text-amber-900">{t.noCutoff}</p>
              ) : (
                <>
                  <p className="font-semibold">
                    {t.resultFor}: {result.message}
                  </p>
                  <p className="mt-1">
                    {t.cutoffLabel}: {result.cutoff ? cutoffDisplay(result.cutoff) : "—"} ·{" "}
                    {t.chargeabilityLabel}: {result.chargeabilityUsed}
                  </p>
                  {result.usedCrossChargeability && <p className="mt-1">{t.crossLabel}</p>}
                  <p className="mt-2 text-xs text-slate-500">{result.sourceNote}</p>
                </>
              )}
            </div>
          )}
        </>
      )}
      <p className="mt-3 text-xs text-slate-500">
        This is general information from the Visa Bulletin, not legal advice. Only a licensed
        attorney or DOJ-Accredited Representative gives legal advice.
      </p>
    </section>
  );
}
