"use client";

import { useState } from "react";
import {
  EXAMPLE_TRANSLATIONS,
  type TranslationStatus,
} from "@/lib/example-data";

const STATUS_LABEL: Record<TranslationStatus, string> = {
  not_requested: "Not requested",
  requested: "Requested",
  in_progress: "In progress",
  received: "Certified translation received",
};

export default function TranslationOrders() {
  const [statuses, setStatuses] = useState<Record<string, TranslationStatus>>(
    () =>
      Object.fromEntries(
        EXAMPLE_TRANSLATIONS.map((t) => [t.id, t.status])
      ) as Record<string, TranslationStatus>
  );

  return (
    <div className="space-y-2">
      {EXAMPLE_TRANSLATIONS.filter((t) => t.id !== "tr-photos").map((t) => {
        const status = statuses[t.id];
        const isForeignCert = t.id === "tr-birth" || t.id === "tr-marriage";
        return (
          <div
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium">{t.label}</p>
              <p className="text-xs text-slate-500">{t.note}</p>
              <p className="text-xs">
                Translation status:{" "}
                <strong>{STATUS_LABEL[status]}</strong>
              </p>
            </div>
            {isForeignCert && (
              <button
                type="button"
                disabled={status === "received"}
                onClick={() =>
                  setStatuses((s) => ({ ...s, [t.id]: "requested" }))
                }
                className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {status === "received"
                  ? "Certified translation received ✓"
                  : status === "requested"
                    ? "Requested ✓ — awaiting provider"
                    : "Order certified translation"}
              </button>
            )}
          </div>
        );
      })}
      <p className="text-xs text-slate-500">
        Request to a human certified-translation service — not instant
        auto-translation. No price or provider set.
      </p>
    </div>
  );
}
