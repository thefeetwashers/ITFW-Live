// /cheatsheets — index of the six "Start here" guides, one per role.
import type { Metadata } from "next";
import Link from "next/link";
import { CHEATSHEET_ROLES, getCheatsheet } from "@/lib/cheatsheets";

export const metadata: Metadata = {
  title: "Start here cheatsheets — Immigration with NIPTEI",
  description:
    "Short, task-ordered Start here guides for every role on Immigration with NIPTEI: client, document preparer, attorney, DOJ-accredited nonprofit, law student, and teacher.",
};

export default function CheatsheetsIndexPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Start here cheatsheets</h1>
      <p className="mt-1 text-sm text-slate-600">
        New to the platform? Pick your role. Each guide is the first 5
        things to do, in order — and every step links to a real page.
        Nothing here is legal advice.
      </p>
      <ul className="mt-6 space-y-3">
        {CHEATSHEET_ROLES.map((r) => {
          const sheet = getCheatsheet(r.role);
          return (
            <li
              key={r.role}
              className="rounded-lg border border-slate-300 bg-white p-4"
            >
              <Link
                href={`/cheatsheets/${r.role}`}
                className="text-base font-semibold text-blue-700 underline"
              >
                {sheet.title} →
              </Link>
              <p className="mt-1 text-sm text-slate-600">{sheet.intro}</p>
              <p className="mt-1 text-xs text-slate-500">
                Your dashboard:{" "}
                <Link
                  href={sheet.dashboardHref}
                  className="font-semibold text-blue-700 underline"
                >
                  {sheet.dashboardLabel}
                </Link>
              </p>
            </li>
          );
        })}
      </ul>
      <footer className="mt-8 text-xs text-slate-500">
        <Link href="/" className="text-blue-600 underline">
          ← Back to home
        </Link>
      </footer>
    </main>
  );
}
