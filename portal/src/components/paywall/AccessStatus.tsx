// AccessStatus — shows the signed-in user's paid-access state for a
// surface, checked SERVER-SIDE via /api/access. Read-only display:
// it never grants access itself — the gated pages decide from the
// API response, not from this component.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import type { PaywallSurface } from "@/lib/paywall";

type State =
  | { kind: "no-session" }
  | { kind: "checking" }
  | { kind: "not-configured" }
  | { kind: "allowed"; role: string; reason: string }
  | { kind: "denied"; reason: string; unlockLabel: string | null };

export default function AccessStatus({ surface }: { surface: PaywallSurface }) {
  const [state, setState] = useState<State>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const sb = getSupabase();
      if (!sb) {
        if (!cancelled) setState({ kind: "not-configured" });
        return;
      }
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        if (!cancelled) setState({ kind: "no-session" });
        return;
      }
      try {
        const res = await fetch(
          `/api/access?surface=${encodeURIComponent(surface)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const body = (await res.json().catch(() => ({}))) as {
          allowed?: boolean;
          role?: string;
          reason?: string;
          unlockLabel?: string | null;
          configured?: boolean;
        };
        if (cancelled) return;
        if (res.status === 501 || body.configured === false) {
          setState({ kind: "not-configured" });
          return;
        }
        if (body.allowed) {
          setState({
            kind: "allowed",
            role: body.role ?? "",
            reason: body.reason ?? "Paid access confirmed.",
          });
        } else {
          setState({
            kind: "denied",
            reason: body.reason ?? "Not paid yet.",
            unlockLabel: body.unlockLabel ?? null,
          });
        }
      } catch {
        if (!cancelled) setState({ kind: "not-configured" });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [surface]);

  if (state.kind === "checking") {
    return <p className="text-sm text-slate-600">Checking your payment status…</p>;
  }
  if (state.kind === "no-session") {
    return (
      <p className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        Sign in to check your payment status.{" "}
        <Link href="/login" className="font-semibold text-blue-700 underline">
          Sign in →
        </Link>
      </p>
    );
  }
  if (state.kind === "not-configured") {
    return (
      <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Payment records are not connected yet, so your payment status
        cannot be verified. Nothing is unlocked until they are connected
        and your payment is confirmed.
      </p>
    );
  }
  if (state.kind === "allowed") {
    return (
      <p className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
        ✓ Paid access confirmed{state.role ? ` (${state.role})` : ""} — {state.reason}
      </p>
    );
  }
  return (
    <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      Not paid yet — {state.reason}
      {state.unlockLabel ? ` Unlock: ${state.unlockLabel}.` : ""}
    </p>
  );
}
