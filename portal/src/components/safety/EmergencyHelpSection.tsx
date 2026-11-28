// Emergency help — the hotlines the platform already cites, on one
// clearly visible section. Every number is copied from the frozen
// public site (see src/lib/safety.ts for the exact lines); no number
// is invented here. Server component — no client state.
import Link from "next/link";
import { EMERGENCY_HOTLINES } from "@/lib/safety";

export default function EmergencyHelpSection() {
  return (
    <section
      aria-labelledby="emergency-help-heading"
      className="mt-6 rounded-lg border-2 border-red-200 bg-red-50 p-4 shadow-sm"
    >
      <h2 id="emergency-help-heading" className="text-lg font-bold text-red-900">
        Get help now — emergency help
      </h2>
      <p className="mt-1 text-sm text-slate-700">
        If you are in danger now, call <strong>911</strong>. The numbers
        below are free, confidential, and open 24 hours a day, 7 days a
        week.
      </p>
      <ul className="mt-3 space-y-3">
        {EMERGENCY_HOTLINES.map((h) => (
          <li key={h.id} className="rounded border border-red-100 bg-white p-3">
            <p className="text-sm font-semibold text-slate-900">{h.name}</p>
            <p className="mt-1 text-base">
              <a
                href={h.telHref}
                aria-label={`Call ${h.name}: ${h.number}`}
                className="font-bold text-blue-700 underline"
              >
                {h.number}
              </a>
              {h.text ? (
                <span className="ml-3 text-sm text-slate-700">{h.text}</span>
              ) : null}
              {h.tty ? (
                <span className="ml-3 text-sm text-slate-700">
                  <a href={h.ttyTelHref} aria-label={`Call ${h.name} TTY: ${h.tty}`} className="font-semibold text-blue-700 underline">
                    {h.tty}
                  </a>
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-sm text-slate-600">{h.note}</p>
            {h.website ? (
              <p className="mt-1 text-sm">
                <a
                  href={h.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 underline"
                >
                  {h.website.replace(/^https:\/\//, "")} ↗
                </a>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm">
        <Link href="/safety" className="font-semibold text-blue-700 underline">
          Safety hub — Quick Exit, scam warnings, and your privacy →
        </Link>
      </p>
    </section>
  );
}
