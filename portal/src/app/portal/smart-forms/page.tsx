// /portal/smart-forms — Smart Forms: the Dynamic Intake Engine,
// gated server-side.
//
// WHY THIS PAGE: the engine (15 registry schemas in
// src/lib/dynamicIntakeSchemas.ts) was mounted NOWHERE. It belongs
// on the portal's existing "Smart Forms" surface — /portal §6 is
// already called "Smart Forms & Checklists" — rather than on the
// public storefront (/p/[slug], which is pre-registration and must
// stay public) or in a provider-only back office (clients file their
// own intake here). This page mounts the FULL 15-schema registry
// engine (src/components/DynamicFormIntakeEngine.tsx, with the draft
// notice and the AttorneyOptionsBar in both modes), NOT the older
// 4-form portal copy (src/components/portal/DynamicFormIntakeEngine.tsx),
// which shows neither the draft notice nor the attorney bar and stays
// unmounted.
//
// Gate: the page checks /api/access (server-side, Bearer token)
// before mounting the engine. Unpaid visitors see PaywallLocked and
// the engine never mounts. A real cases.id (UUID) comes from
// ?caseId=…; without one the engine shows its own honest notice that
// a real case id is required to generate a packet — no placeholder
// case id is ever invented here.
"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DynamicFormIntakeEngine from "@/components/DynamicFormIntakeEngine";
import { getSupabase } from "@/lib/supabase";
import PaywallLocked from "@/components/paywall/PaywallLocked";
import { DRAFT_SCHEMA_NOTICE } from "@/lib/dynamicIntakeSchemas";
import type { IntakeMode } from "@/lib/dynamicIntakeSchemas";

type GateState =
  | { kind: "checking" }
  | { kind: "no-session" }
  | { kind: "not-configured" }
  | { kind: "locked"; reason: string; unlockPriceKey: string | null }
  | { kind: "allowed" };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function SmartFormsInner() {
  const searchParams = useSearchParams();
  const caseIdParam = searchParams.get("caseId") ?? "";
  const caseId = UUID_RE.test(caseIdParam) ? caseIdParam : "";
  const [mode, setMode] = useState<IntakeMode>("client_diy");
  const [gate, setGate] = useState<GateState>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const sb = getSupabase();
      if (!sb) {
        if (!cancelled) setGate({ kind: "not-configured" });
        return;
      }
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        if (!cancelled) setGate({ kind: "no-session" });
        return;
      }
      try {
        const res = await fetch("/api/access?surface=smart_forms", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json().catch(() => ({}))) as {
          allowed?: boolean;
          reason?: string;
          unlockPriceKey?: string | null;
          configured?: boolean;
        };
        if (cancelled) return;
        if (res.status === 501 || body.configured === false) {
          setGate({ kind: "not-configured" });
          return;
        }
        if (body.allowed) {
          setGate({ kind: "allowed" });
        } else {
          setGate({
            kind: "locked",
            reason: body.reason ?? "Pay first to unlock Smart Forms.",
            unlockPriceKey: body.unlockPriceKey ?? "member_monthly",
          });
        }
      } catch {
        if (!cancelled) setGate({ kind: "not-configured" });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">Smart Forms — Dynamic Intake</h1>
        <p className="mt-1 text-sm text-slate-600">
          Answer the questions for your form and the engine builds your
          intake: only the sections for the forms you pick, the 5-year
          timeline checks, and the document slots for those forms.{" "}
          {DRAFT_SCHEMA_NOTICE}.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          <Link href="/portal" className="text-blue-700 underline">
            ← Back to the Client Portal
          </Link>{" "}
          ·{" "}
          <Link href="/interview-prep" className="text-blue-700 underline">
            Interview Preparation →
          </Link>
        </p>
        {!caseId && gate.kind === "allowed" && (
          <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No case selected — open this page from your case in the portal
            (link with ?caseId=&lt;your case id&gt;) so the intake saves
            against a real case. You can still answer the questions below;
            generating a packet needs a real case id.
          </p>
        )}
      </header>

      {gate.kind === "checking" && (
        <p className="mt-6 text-sm text-slate-600">Checking your payment status…</p>
      )}

      {gate.kind === "no-session" && (
        <div className="mt-6 space-y-4">
          <p className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Sign in first — Smart Forms are paid content, and access is
            checked against the payment records for your account.{" "}
            <Link href="/login" className="font-semibold text-blue-700 underline">
              Sign in →
            </Link>
          </p>
          <PaywallLocked
            surfaceLabel="Smart Forms — Dynamic Intake Engine"
            unlockPriceKey="member_monthly"
            reason="Pay first to unlock Smart Forms — Member $9.80/mo, or any paid bundle. Nothing is shown until your payment is confirmed in our records."
          />
        </div>
      )}

      {gate.kind === "not-configured" && (
        <p className="mt-6 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Payment records are not connected yet, so your payment status
          cannot be verified. Nothing is unlocked until they are connected
          and your payment is confirmed.
        </p>
      )}

      {gate.kind === "locked" && (
        <div className="mt-6">
          <PaywallLocked
            surfaceLabel="Smart Forms — Dynamic Intake Engine"
            unlockPriceKey={gate.unlockPriceKey}
            reason={gate.reason}
          />
        </div>
      )}

      {gate.kind === "allowed" && (
        <div className="mt-6 space-y-4">
          <div className="rounded border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-600">
              Intake mode (both modes show the same sections, the draft
              notice, and the attorney option on every page)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["client_diy", "preparer_assisted"] as IntakeMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`rounded border px-3 py-1.5 text-xs font-semibold ${
                    mode === m
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  {m === "client_diy" ? "Client DIY" : "Preparer-Assisted"}
                </button>
              ))}
            </div>
          </div>
          <DynamicFormIntakeEngine
            mode={mode}
            selectedForms={[]}
            caseId={caseId}
            actorRole="client"
          />
        </div>
      )}
    </main>
  );
}

export default function SmartFormsPage() {
  return (
    <Suspense fallback={<p className="mx-auto max-w-4xl px-4 py-8 text-sm text-slate-600">Loading Smart Forms…</p>}>
      <SmartFormsInner />
    </Suspense>
  );
}
