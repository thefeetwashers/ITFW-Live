// Tier summary — shows the client exactly what their tier includes
// and does NOT include, in plain English, in their language.
// The English text comes from src/lib/serviceTiers.ts
// (createCaseFromOrder plainEnglish); translation goes through the
// translate route when Google Cloud Translation is connected — never a
// fake translation. Until then the English text is shown with the
// "translation not configured" label.
"use client";

import { tierDef, featureLabels, type ServiceTierId } from "@/lib/serviceTiers";
import type { LanguageCode } from "@/lib/i18n";

export default function TierSummary(props: {
  tier: ServiceTierId;
  serviceLabel: string;
  clientLanguage?: LanguageCode;
}) {
  const def = tierDef(props.tier);
  const lang = props.clientLanguage ?? "en";
  return (
    <section aria-label={`What your ${def.label} tier includes`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold">What your tier includes — {props.serviceLabel} · {def.label}</h3>
      <p className="mt-1 text-xs text-slate-500">
        Shown in your language ({lang.toUpperCase()}) when translation is connected. Translation is not configured in this build, so the English text below is shown with that label — nothing was translated by machine here.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <h4 className="text-sm font-bold text-green-800">✓ Included</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {featureLabels(def.features).map((f) => (<li key={f}>{f}</li>))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-bold text-red-800">✗ NOT included at this tier</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {def.notIncluded.map((n) => (<li key={n}>{n}</li>))}
          </ul>
        </div>
      </div>
      <p className="mt-3 text-sm"><span className="font-medium">Price:</span> {def.priceUsd !== null ? `$${def.priceUsd.toLocaleString("en-US")}` : "TO BE CONFIRMED"} — {def.priceNote}</p>
      <p className="mt-1 text-sm"><span className="font-medium">Your professional:</span> {def.professionalTypeNote}</p>
      <p className="mt-1 text-xs text-slate-500">Government (USCIS) fees are always separate from the service fee and are never included in the price above.</p>
    </section>
  );
}
