// Daily command view — today's deadlines, overdue items, new messages,
// new uploads — in every professional dashboard. Computed from the
// inputs via src/lib/caseTools.ts buildDailyCommand(), never hardcoded.
"use client";

import { buildDailyCommand } from "@/lib/caseTools";

export default function DailyCommand(props: { todayIso?: string }) {
  // EXAMPLE items only — labelled, no real people. Replace with live
  // rows (inbox_items / messages / documents / appointments) once live.
  const todayIso = props.todayIso ?? "2026-11-19";
  const view = buildDailyCommand({
    todayIso,
    deadlines: [
      { id: "dl-1", label: "Example: RFE reply due — Example Client A", dueAt: "2026-11-19" },
      { id: "dl-2", label: "Example: NVC fee due — Example Client B", dueAt: "2026-11-21" },
    ],
    overdue: [
      { id: "ov-1", label: "Example: missing 2024 address dates — Example Client A", dueAt: "2026-11-18" },
    ],
    newMessages: [
      { id: "nm-1", label: "Example Client A: “I re-uploaded my bank statement.”" },
    ],
    newUploads: [
      { id: "nu-1", label: "Example: bank statement page 2 uploaded — Example Client A" },
    ],
  });
  const columns: { title: string; items: { id: string; label: string; dueAt?: string }[]; empty: string }[] = [
    { title: "Today's deadlines", items: view.today, empty: "No deadlines today." },
    { title: "Overdue items", items: view.overdue, empty: "Nothing overdue." },
    { title: "New messages", items: view.newMessages, empty: "No new messages." },
    { title: "New uploads", items: view.newUploads, empty: "No new uploads." },
  ];
  return (
    <section aria-label="Daily command view" className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold">Daily Command — {todayIso} (example)</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {columns.map((col) => (
          <div key={col.title} className="rounded border border-slate-200 p-3">
            <h4 className="text-sm font-bold">{col.title}</h4>
            {col.items.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">{col.empty}</p>
            ) : (
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {col.items.map((i) => (<li key={i.id}>{i.label}{i.dueAt ? ` (due ${i.dueAt})` : ""}</li>))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
