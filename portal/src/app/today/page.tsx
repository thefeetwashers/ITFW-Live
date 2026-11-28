// /today — Daily home screen (Nov 28, 2026, completeness sweep).
//
// The client's daily landing page: case status at a glance, today's next
// step, what changed today, reminders, the interview question of the day,
// today's immigration news, per-case timelines, and everything they saved
// — in one place. Data comes from GET /api/today (real stored rows only);
// the daily check-in goes to POST /api/today/checkin.
//
// When the client is not signed in, or Supabase is not connected, the
// page shows HONEST EMPTY STATES (from emptyDailyHomePayload via the
// API's 401/501 body) — never invented cases, status, or news. The
// built-in sourced news posts are still shown, labelled as built-in
// with no live feed connected.
"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import {
  emptyDailyHomePayload,
  type DailyHomePayload,
} from "@/lib/dailyHome";
import TodayHome from "@/components/today/TodayHome";
import { usePreferredDir } from "@/lib/usePreferredDir";

export default function TodayPage() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const dir = usePreferredDir();
  const [payload, setPayload] = useState<DailyHomePayload>(() =>
    emptyDailyHomePayload(todayIso)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [checkinNote, setCheckinNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setError(
        "Your cases are not connected yet (Supabase is not configured), so this page cannot load your real cases. The news below is built-in and sourced — everything else is an honest empty state until the connection is live."
      );
      setLoading(false);
      return;
    }
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setError(
        "Sign in to see your cases, your next step, and what changed today. The news below is built-in and sourced — the rest of this page is an honest empty state until you sign in."
      );
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/today", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        payload?: DailyHomePayload;
      };
      if (body.payload) {
        setPayload(body.payload);
        if (!body.ok && body.error) setError(body.error);
      } else {
        setError(body.error ?? "Your Today page could not be loaded. Try again.");
      }
    } catch {
      setError("Your Today page could not be loaded. Try again.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const checkin = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setCheckinNote("Check-in is not available — Supabase is not connected yet.");
      return;
    }
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setCheckinNote("Sign in first to check in.");
      return;
    }
    setCheckinBusy(true);
    try {
      const res = await fetch("/api/today/checkin", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        already?: boolean;
        streakDays?: number;
        checkedInToday?: boolean;
        totalCheckins?: number;
      };
      if (!body.ok) {
        setCheckinNote(body.error ?? "Your check-in could not be recorded.");
      } else {
        setCheckinNote(
          body.already
            ? "You already checked in today."
            : "Checked in — see you tomorrow."
        );
        setPayload((p) => ({
          ...p,
          checkin: {
            streakDays: body.streakDays ?? p.checkin.streakDays,
            checkedInToday: body.checkedInToday ?? true,
            totalCheckins: body.totalCheckins ?? p.checkin.totalCheckins,
          },
        }));
      }
    } catch {
      setCheckinNote("Your check-in could not be recorded. Try again.");
    }
    setCheckinBusy(false);
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8" dir={dir}>
      {loading ? (
        <p className="text-sm text-slate-600">Loading your Today page…</p>
      ) : (
        <>
          {error ? (
            <div
              role="alert"
              className="mb-4 flex flex-wrap items-center gap-3 rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900"
            >
              <p className="flex-1">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  void load();
                }}
                className="rounded bg-amber-700 px-3 py-1.5 text-sm font-semibold text-white"
              >
                Try again
              </button>
            </div>
          ) : null}
          <TodayHome
            payload={payload}
            onCheckin={() => void checkin()}
            checkinBusy={checkinBusy}
            checkinNote={checkinNote}
          />
        </>
      )}
    </main>
  );
}
