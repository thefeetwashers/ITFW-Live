// /cheatsheets/[role] — standalone "Start here" guide per role.
// One page per role: client, preparer, attorney, doj, law_student,
// teacher. Each page renders the full (non-compact) cheatsheet and
// links to the other five guides and to that role's dashboard.
// Unknown role → 404 (notFound).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RoleCheatsheet from "@/components/cheatsheets/RoleCheatsheet";
import {
  CHEATSHEET_ROLES,
  getCheatsheet,
  isCheatsheetRole,
  type CheatsheetRole,
} from "@/lib/cheatsheets";

export function generateStaticParams(): { role: CheatsheetRole }[] {
  return CHEATSHEET_ROLES.map((r) => ({ role: r.role }));
}

export async function generateMetadata(props: {
  params: { role: string };
}): Promise<Metadata> {
  if (!isCheatsheetRole(props.params.role)) {
    return { title: "Cheatsheet not found — Immigration with NIPTEI" };
  }
  const sheet = getCheatsheet(props.params.role);
  return {
    title: `${sheet.title} — Immigration with NIPTEI`,
    description: sheet.intro,
  };
}

export default function CheatsheetPage(props: { params: { role: string } }) {
  if (!isCheatsheetRole(props.params.role)) {
    notFound();
  }
  const sheet = getCheatsheet(props.params.role);
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm text-slate-600">
        <Link href="/cheatsheets" className="font-semibold text-blue-700 underline">
          ← All cheatsheets
        </Link>
        {" · "}
        <Link href={sheet.dashboardHref} className="font-semibold text-blue-700 underline">
          Go to your dashboard ({sheet.dashboardLabel})
        </Link>
      </p>
      <div className="mt-4">
        <RoleCheatsheet role={sheet.role} />
      </div>
      <nav aria-label="Cheatsheets for other roles" className="mt-6 rounded-lg border border-slate-300 bg-white p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Cheatsheets for other roles
        </h2>
        <ul className="mt-2 space-y-1">
          {CHEATSHEET_ROLES.filter((r) => r.role !== sheet.role).map((r) => (
            <li key={r.role}>
              <Link href={`/cheatsheets/${r.role}`} className="text-sm font-semibold text-blue-700 underline">
                {getCheatsheet(r.role).title} →
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <footer className="mt-8 text-xs text-slate-500">
        Immigration with NIPTEI · nipteiapp@gmail.com · (772) 971-6129 · Educational
        information only, not legal advice.
      </footer>
    </main>
  );
}
