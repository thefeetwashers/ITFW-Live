// RoleCheatsheet — "Start here" guide, rendered inside each dashboard
// and on the standalone cheatsheet pages (/cheatsheets/<role>).
// Short, task-ordered (first 5 things to do, in order), role-specific.
// Every step links to a real page in the portal (see src/lib/cheatsheets.ts
// — no invented features, no invented links).
import Link from "next/link";
import {
  getCheatsheet,
  type CheatsheetRole,
} from "@/lib/cheatsheets";

export default function RoleCheatsheet(props: {
  role: CheatsheetRole;
  /** Compact = fewer words per step (dashboard embed). Full = the
   *  whole step detail (standalone cheatsheet page). */
  compact?: boolean;
}) {
  const sheet = getCheatsheet(props.role);
  const compact = props.compact ?? false;
  return (
    <section
      aria-labelledby={`cheatsheet-${sheet.role}-heading`}
      className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 shadow-sm"
    >
      <h2
        id={`cheatsheet-${sheet.role}-heading`}
        className="text-lg font-semibold text-emerald-950"
      >
        {sheet.title}
      </h2>
      <p className="mt-1 text-sm text-emerald-900">{sheet.intro}</p>
      <ol className="mt-3 list-decimal space-y-3 pl-5">
        {sheet.steps.map((step, i) => (
          <li key={`${sheet.role}-step-${i}`} className="text-sm">
            <p className="font-semibold text-emerald-950">{step.title}</p>
            {!compact && (
              <p className="mt-0.5 text-emerald-900">{step.detail}</p>
            )}
            <p className="mt-0.5">
              <Link
                href={step.href}
                className="font-semibold text-blue-700 underline"
              >
                {step.linkLabel} →
              </Link>
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-emerald-900">{sheet.footer}</p>
      <p className="mt-2 text-xs">
        <Link
          href={`/cheatsheets/${sheet.role}`}
          className="font-semibold text-blue-700 underline"
        >
          Open the full {sheet.title.toLowerCase()} guide
        </Link>
        {" · "}
        <Link
          href={sheet.dashboardHref}
          className="font-semibold text-blue-700 underline"
        >
          Go to your dashboard ({sheet.dashboardLabel})
        </Link>
      </p>
    </section>
  );
}
