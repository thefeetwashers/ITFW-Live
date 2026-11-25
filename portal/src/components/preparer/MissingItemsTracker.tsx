// Missing-item tracker — preparer dashboard.
// Document checklist comes from lib/formChecklists (never invented).
// Each missing item has an ASSIGNED PERSON: client, spouse /
// beneficiary, or joint sponsor. Approve / reject with a reason and
// re-upload requests work on local example state. Translation ordering
// is $45/page LOCKED (lib/fees) with a visible status.
"use client";

import { useState } from "react";
import {
  FORM_CHECKLIST_TEMPLATES,
  type ChecklistAssignee,
  type FormChecklistItem,
} from "@/lib/formChecklists";
import { TRANSLATION_PRICE_PER_PAGE_CENTS } from "@/lib/fees";
import { formatCents } from "@/lib/order";

type ItemStatus = "missing" | "uploaded" | "accepted" | "retake_requested";

export default function MissingItemsTracker() {
  const [templateId, setTemplateId] = useState(FORM_CHECKLIST_TEMPLATES[0]?.id ?? "");
  const template =
    FORM_CHECKLIST_TEMPLATES.find((t) => t.id === templateId) ??
    FORM_CHECKLIST_TEMPLATES[0];
  const [statuses, setStatuses] = useState<Record<string, ItemStatus>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [translation, setTranslation] = useState<Record<string, "not_ordered" | "ordered" | "received">>({});

  const statusOf = (item: FormChecklistItem): ItemStatus =>
    statuses[item.id] ?? "missing";
  const missing = template.checklist.filter((i) => statusOf(i) === "missing" || statusOf(i) === "retake_requested");

  const setStatus = (id: string, s: ItemStatus) =>
    setStatuses((prev) => ({ ...prev, [id]: s }));

  return (
    <section
      aria-labelledby="missing-items-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="missing-items-heading" className="text-lg font-semibold">
        Missing-Item Tracker — Document Checklist
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Checklist from lib/formChecklists — nothing invented. Example data,
        local only. {missing.length} of {template.checklist.length} item(s)
        still missing for {template.name}.
        {template.clericalOnly && (
          <span className="font-semibold text-amber-800">
            {" "}I-589 is clerical prep only — never legal advice.
          </span>
        )}
      </p>
      <label className="mt-3 block text-sm">
        <span className="font-medium">Form / bundle checklist</span>
        <select
          value={templateId}
          onChange={(e) => { setTemplateId(e.target.value); setStatuses({}); }}
          className="mt-1 w-full max-w-sm rounded border border-slate-300 bg-white px-2 py-1 text-sm"
        >
          {FORM_CHECKLIST_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.formsIncluded.join(", ")})
            </option>
          ))}
        </select>
      </label>

      <ul className="mt-3 space-y-2">
        {template.checklist.map((item) => {
          const status = statusOf(item);
          const trStatus = translation[item.id] ?? "not_ordered";
          return (
            <li key={item.id} className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              <p>
                <strong>{item.title}</strong>{" "}
                <span className="text-xs text-slate-500">
                  · {item.vaultCategory} · {item.blocking ? "blocking" : "non-blocking"}
                  {item.condition ? ` · ${item.condition}` : ""}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Assigned to: <strong>{item.assignedTo}</strong> — Status:{" "}
                <strong>
                  {status === "missing" ? "Missing" : status === "uploaded" ? "Uploaded — awaiting review" : status === "accepted" ? "Accepted" : "Retake requested"}
                </strong>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => setStatus(item.id, "uploaded")} className="rounded bg-slate-700 px-2 py-1 text-xs font-semibold text-white">
                  Mark uploaded
                </button>
                <button type="button" onClick={() => setStatus(item.id, "accepted")} className="rounded bg-green-700 px-2 py-1 text-xs font-semibold text-white">
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setStatus(item.id, "retake_requested")}
                  className="rounded bg-amber-600 px-2 py-1 text-xs font-semibold text-white"
                >
                  Reject / request re-upload
                </button>
                <input
                  type="text"
                  value={reasons[item.id] ?? ""}
                  onChange={(e) => setReasons((r) => ({ ...r, [item.id]: e.target.value }))}
                  placeholder="Reject reason, e.g. blurry"
                  className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                />
              </div>
              {status === "retake_requested" && (
                <p className="mt-1 text-xs text-amber-800">
                  Retake requested — reason: {reasons[item.id]?.trim() || "no reason entered yet"}.
                </p>
              )}
              {item.translationRequired && (
                <p className="mt-2 text-xs">
                  Certified translation needed — {formatCents(TRANSLATION_PRICE_PER_PAGE_CENTS)}/page
                  (locked). Status: <strong>{trStatus === "not_ordered" ? "Not ordered" : trStatus === "ordered" ? "Ordered — awaiting provider" : "Received"}</strong>{" "}
                  <button
                    type="button"
                    disabled={trStatus === "received"}
                    onClick={() =>
                      setTranslation((t) => ({
                        ...t,
                        [item.id]: trStatus === "not_ordered" ? "ordered" : "received",
                      }))
                    }
                    className="ml-1 rounded bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {trStatus === "not_ordered" ? "Order translation" : trStatus === "ordered" ? "Mark received" : "Received ✓"}
                  </button>
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        Assignees are client / spouse-beneficiary / joint sponsor only — the
        checklist itself assigns each item (lib/formChecklists). Missing
        items also appear in the Client &amp; Family Portal once Supabase
        is wired (see AgencyNumberHub).
      </p>
    </section>
  );
}
