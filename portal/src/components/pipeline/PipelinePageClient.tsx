// Client-side loader for /pipeline: role switcher + fetch from
// /api/pipeline. Split out of app/pipeline/page.tsx so the page can
// wrap it in <Suspense> (required for useSearchParams).
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ClientPipeline from "@/components/pipeline/ClientPipeline";
import { PIPELINE_ROLES, type PipelineClientRow, type PipelineRole } from "@/lib/pipeline";
import { usePreferredDir } from "@/lib/usePreferredDir";

export default function PipelinePageClient() {
  const params = useSearchParams();
  const dir = usePreferredDir();
  const providerId = params.get("providerId");
  const roleParam = params.get("role");
  const [role, setRole] = useState<PipelineRole>(
    roleParam === "attorney" || roleParam === "doj" ? roleParam : "preparer"
  );
  const [rows, setRows] = useState<PipelineClientRow[]>([]);
  const [live, setLive] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Empty state (no rows yet) and load error are SEPARATE: an error
  // gets a retry button, an empty list gets the honest empty text
  // and no retry (retrying an empty list changes nothing).
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    setNotice(null);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/pipeline?role=${role}&providerId=${encodeURIComponent(providerId)}`
      );
      const data = (await res.json()) as {
        error?: string;
        notConfigured?: boolean;
        rows?: PipelineClientRow[];
        emptyState?: string | null;
      };
      if (!res.ok) {
        setLive(false);
        setRows([]);
        setLoadError(
          data.error ??
            "The pipeline could not be loaded. No rows are shown."
        );
        return;
      }
      setLive(true);
      setRows(data.rows ?? []);
      if (data.emptyState) setNotice(data.emptyState);
    } catch {
      setLive(false);
      setRows([]);
      setLoadError("Could not reach the server. No rows are shown.");
    } finally {
      setLoading(false);
    }
  }, [providerId, role]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4" dir={dir}>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Pipeline role">
        {PIPELINE_ROLES.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={role === r.id}
            onClick={() => setRole(r.id)}
            className={`rounded border px-3 py-2 text-sm font-semibold ${
              role === r.id
                ? "border-blue-700 bg-blue-700 text-white"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {!providerId && (
        <p role="status" className="rounded border border-amber-400 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          No professional is signed in on this page yet — open it with
          ?providerId=&lt;your account id&gt; (for example, from your
          dashboard once sign-in fills it in). Until then no client rows
          are shown, because the pipeline never guesses whose clients to
          display.
        </p>
      )}
      {loading && <p className="text-sm text-slate-600">Loading the pipeline…</p>}
      {loadError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900"
        >
          <p className="flex-1">{loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded bg-red-700 px-3 py-1.5 text-sm font-semibold text-white"
          >
            Try again
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          {notice}
        </p>
      )}
      {providerId && (
        <ClientPipeline role={role} rows={rows} live={live} onRefresh={() => void load()} />
      )}
    </div>
  );
}
