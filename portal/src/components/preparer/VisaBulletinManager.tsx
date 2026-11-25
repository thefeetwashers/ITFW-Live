// Visa Bulletin manager — professional dashboard.
// The professional pastes/enters the current month's cutoff dates per
// category + chargeability country from the official Visa Bulletin
// (travel.state.gov). Each cell accepts "C" (Current), "U"
// (Unavailable), or a cutoff date (YYYY-MM-DD). Nothing is scraped,
// nothing is invented: a blank cell means "no cutoff entered" and the
// matcher reports that instead of guessing.
//
// When Supabase is configured the month + cutoffs are stored in
// visa_bulletin_months / visa_bulletin_cutoffs (migration 0018). When it
// is not configured, entries live in this browser session only and the
// UI says so — they are NOT claimed as stored.
"use client";

import { useMemo, useState } from "react";
import VisaBulletinMatcher from "@/components/portal/VisaBulletinMatcher";
import { getSupabase } from "@/lib/supabase";
import {
  CHARGEABILITY_COUNTRIES,
  VISA_CATEGORIES,
  visaBulletinUrl,
  type BulletinChartKind,
  type BulletinCutoff,
  type BulletinMonth,
  type ChargeabilityCountry,
  type VisaCategory,
} from "@/lib/visaBulletin";

type CellValue = "" | "C" | "U" | string;

function parseCell(
  category: VisaCategory,
  country: ChargeabilityCountry,
  chartKind: BulletinChartKind,
  raw: string
): BulletinCutoff | null {
  const v = raw.trim().toUpperCase();
  if (!v) return null;
  if (v === "C") return { category, chargeabilityCountry: country, chartKind, isCurrent: true, isUnavailable: false, cutoffDate: null };
  if (v === "U") return { category, chargeabilityCountry: country, chartKind, isCurrent: false, isUnavailable: true, cutoffDate: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return { category, chargeabilityCountry: country, chartKind, isCurrent: false, isUnavailable: false, cutoffDate: v };
  }
  return null;
}

export default function VisaBulletinManager() {
  const isLive = useMemo(() => getSupabase() !== null, []);
  const [month, setMonth] = useState("2026-11");
  const [chartKind, setChartKind] = useState<BulletinChartKind>("dates_for_filing");
  const [sourceUrl, setSourceUrl] = useState(visaBulletinUrl("2026-11"));
  const [cells, setCells] = useState<Record<string, CellValue>>({});
  const [saved, setSaved] = useState<BulletinMonth | null>(null);
  const [saveNote, setSaveNote] = useState("");
  const [invalid, setInvalid] = useState<string[]>([]);

  const key = (c: VisaCategory, country: ChargeabilityCountry) => `${c}|${country}`;

  const parsed = useMemo(() => {
    const cutoffs: BulletinCutoff[] = [];
    const bad: string[] = [];
    for (const { code } of VISA_CATEGORIES) {
      for (const { code: country } of CHARGEABILITY_COUNTRIES) {
        const raw = cells[key(code, country)] ?? "";
        if (!raw.trim()) continue;
        const parsedCell = parseCell(code, country, chartKind, raw);
        if (!parsedCell) bad.push(`${code} / ${country}: "${raw}" — use C, U, or YYYY-MM-DD`);
        else cutoffs.push(parsedCell);
      }
    }
    return { cutoffs, bad };
  }, [cells, chartKind]);

  const bulletin: BulletinMonth | null = saved;

  async function save() {
    setInvalid(parsed.bad);
    if (parsed.bad.length > 0) return;
    const next: BulletinMonth = { bulletinMonth: month, sourceUrl, cutoffs: parsed.cutoffs };
    const supabase = getSupabase();
    if (!supabase) {
      setSaved(next);
      setSaveNote(
        "Saved in this browser session only — Supabase is not connected, so this month is NOT stored in the database. Enter it again after Supabase is connected, or it will be lost when this page closes."
      );
      return;
    }
    const { data: monthRow, error: monthError } = await supabase
      .from("visa_bulletin_months")
      .upsert(
        { bulletin_month: month, source_url: sourceUrl },
        { onConflict: "bulletin_month" }
      )
      .select("id")
      .single();
    if (monthError || !monthRow) {
      setSaveNote(`Could not store this month: ${monthError?.message ?? "unknown error"}. Nothing was saved — check that migration 0018 has been run.`);
      return;
    }
    const rows = parsed.cutoffs.map((c) => ({
      bulletin_month_id: (monthRow as { id: string }).id,
      category: c.category,
      chargeability_country: c.chargeabilityCountry,
      chart_kind: c.chartKind,
      cutoff_date: c.cutoffDate,
      is_current: c.isCurrent,
      is_unavailable: c.isUnavailable,
      source_url: sourceUrl,
    }));
    const { error } = await supabase.from("visa_bulletin_cutoffs").upsert(rows, {
      onConflict: "bulletin_month_id,category,chargeability_country,chart_kind",
    });
    if (error) {
      setSaveNote(`Month saved, but cutoffs could not be stored: ${error.message}. Check that migration 0018 has been run.`);
      return;
    }
    setSaved(next);
    setSaveNote(`Stored: ${parsed.cutoffs.length} cutoff(s) for ${month} (${chartKind === "dates_for_filing" ? "Dates for Filing" : "Final Action Dates"}).`);
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="vb-manager-heading" className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
        <h2 id="vb-manager-heading" className="text-base font-semibold">
          Visa Bulletin — Enter This Month&apos;s Cutoff Dates
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Copy each cutoff from the official Visa Bulletin at travel.state.gov. Enter{" "}
          <strong>C</strong> for Current, <strong>U</strong> for Unavailable, or the cutoff
          date (YYYY-MM-DD). A blank cell means no cutoff entered — the matcher will say so,
          never guess. Chargeability is country of birth.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Bulletin month
            <input
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setSourceUrl(visaBulletinUrl(e.target.value || "2026-11"));
              }}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="text-sm">
            Source URL (official bulletin)
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
            />
          </label>
        </div>
        <fieldset className="mt-3 text-sm">
          <legend className="font-medium">Chart</legend>
          <label className="mr-4">
            <input type="radio" name="vb-mgr-chart" checked={chartKind === "dates_for_filing"} onChange={() => setChartKind("dates_for_filing")} />{" "}
            Dates for Filing (adjustment of status)
          </label>
          <label>
            <input type="radio" name="vb-mgr-chart" checked={chartKind === "final_action"} onChange={() => setChartKind("final_action")} />{" "}
            Final Action Dates (consular)
          </label>
        </fieldset>
        <p className="mt-2 text-xs text-slate-500">
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">
            Open the official bulletin for {month}
          </a>{" "}
          — enter one chart at a time; switch the chart above to enter the other chart for the same month.
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-slate-300 bg-slate-50 px-2 py-1 text-left">Category</th>
                {CHARGEABILITY_COUNTRIES.map((c) => (
                  <th key={c.code} className="border border-slate-300 bg-slate-50 px-2 py-1 text-left">
                    {c.code === "WORLDWIDE" ? "All others" : c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VISA_CATEGORIES.map(({ code, label }) => (
                <tr key={code}>
                  <td className="border border-slate-300 px-2 py-1 font-medium">{label}</td>
                  {CHARGEABILITY_COUNTRIES.map(({ code: country }) => (
                    <td key={country} className="border border-slate-300 px-1 py-1">
                      <input
                        aria-label={`${label}, ${country}`}
                        value={cells[key(code, country)] ?? ""}
                        onChange={(e) =>
                          setCells((prev) => ({ ...prev, [key(code, country)]: e.target.value }))
                        }
                        placeholder="C / U / date"
                        className="w-full rounded border border-slate-200 px-1 py-1 text-sm"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {invalid.length > 0 && (
          <div role="alert" className="mt-3 rounded border border-red-400 bg-red-50 p-3 text-sm text-red-900">
            <p className="font-semibold">These entries could not be read — fix them before saving:</p>
            <ul className="mt-1 list-disc pl-5">
              {invalid.map((m) => (<li key={m}>{m}</li>))}
            </ul>
          </div>
        )}

        <p className="mt-3 text-sm text-slate-600">
          {parsed.cutoffs.length} cutoff(s) entered for this chart.{" "}
          {!isLive && "Supabase is not connected — saving keeps this month in this browser session only."}
        </p>
        <button
          type="button"
          onClick={save}
          className="mt-2 rounded bg-blue-700 px-3 py-1 text-sm font-semibold text-white"
        >
          Save bulletin month
        </button>
        {saveNote && (
          <p role="status" className="mt-2 rounded border border-slate-300 bg-slate-50 p-2 text-sm">
            {saveNote}
          </p>
        )}
      </section>

      <VisaBulletinMatcher bulletin={bulletin} />
    </div>
  );
}
