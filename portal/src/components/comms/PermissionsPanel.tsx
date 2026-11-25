// "What you can do" panel — renders the service-level permissions
// matrix (src/lib/permissions.ts) for one role. The matrix is the
// source of truth; this panel never hardcodes a different rule.
"use client";

import { MATRIX_ROLES, panelForRole, type MatrixRole, type GateContext } from "@/lib/permissions";

export default function PermissionsPanel(props: {
  role: MatrixRole;
  tierLabel?: string;
  ctx?: GateContext;
}) {
  const { role, tierLabel, ctx } = props;
  const label = MATRIX_ROLES.find((r) => r.id === role)?.label ?? role;
  const { allowed, locked } = panelForRole(role, ctx ?? {});
  return (
    <section aria-label={`What you can do — ${label}`} className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold">What you can do — {label}</h3>
      {tierLabel && <p className="mt-1 text-xs text-slate-600">Service tier: {tierLabel}. Tier limits apply on top of role limits — a Basic-tier client cannot get Premium-tier services, and DIY leaves the Preparer section blank.</p>}
      <p className="mt-1 text-xs text-slate-500">
        Source of truth: docs/permissions-matrix.md (same rows as src/lib/permissions.ts). If this panel and the matrix ever disagree, the matrix wins.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <h4 className="text-sm font-bold text-green-800">✓ You CAN</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {allowed.map((a) => (
              <li key={a.label}>{a.label}{a.note ? ` — ${a.note}` : ""}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-bold text-red-800">🔒 LOCKED for you</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {locked.map((l) => (
              <li key={l.label}>{l.label}{l.note ? ` — ${l.note}` : ""}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
