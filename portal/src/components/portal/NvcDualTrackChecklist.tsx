// (b) NVC CEAC Dual-Track Checklist — Side A Petitioner Financial
// vs Side B Beneficiary Civil Documents. EXAMPLE statuses only;
// checkboxes are local manual entry in this build.
"use client";

import { useState } from "react";
import { EXAMPLE_DUAL_TRACK, type DualTrackItem } from "@/lib/nvc";

function TrackColumn({
  title,
  items,
  checked,
  onToggle,
}: {
  title: string;
  items: DualTrackItem[];
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const doneCount = items.filter((i) => checked[i.id]).length;
  return (
    <div className="rounded border border-slate-200 p-3">
      <h3 className="text-sm font-semibold">
        {title} — {doneCount} of {items.length} checked
      </h3>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(checked[item.id])}
              onChange={() => onToggle(item.id)}
              aria-label={item.label}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className={checked[item.id] ? "line-through text-slate-500" : ""}>
                {item.label}
              </span>
              {item.note ? (
                <span className="block text-xs text-slate-500">{item.note}</span>
              ) : null}
              {item.status === "to_be_confirmed" && (
                <span className="block text-xs font-semibold text-amber-700">
                  TO BE CONFIRMED
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function NvcDualTrackChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of [...EXAMPLE_DUAL_TRACK.sideA, ...EXAMPLE_DUAL_TRACK.sideB]) {
      initial[item.id] = item.status === "done";
    }
    return initial;
  });

  const toggle = (id: string) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <section
      aria-labelledby="dual-track-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="dual-track-heading" className="text-base font-semibold">
        NVC CEAC Dual-Track Checklist
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Two tracks, one CEAC case (EXAMPLE statuses). Check items off as
        they are uploaded — manual entry in this build; nothing here is
        pulled live from CEAC.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <TrackColumn
          title="Side A — Petitioner Financial"
          items={EXAMPLE_DUAL_TRACK.sideA}
          checked={checked}
          onToggle={toggle}
        />
        <TrackColumn
          title="Side B — Beneficiary Civil Documents"
          items={EXAMPLE_DUAL_TRACK.sideB}
          checked={checked}
          onToggle={toggle}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Joint Sponsor I-864A applies only if household income is below 125%
        of the HHS Poverty Guidelines — confirm for this case before
        collecting it.
      </p>
    </section>
  );
}
