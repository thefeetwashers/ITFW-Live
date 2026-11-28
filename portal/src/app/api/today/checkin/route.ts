// /api/today/checkin — Daily check-in (Nov 28, 2026, completeness sweep).
//
// A client taps "I checked my case today" once a day. One stored row per
// account + day (+ case, when the check-in is for a specific case).
// The streak is computed from stored rows only (computeStreak,
// src/lib/dailyHome.ts) — never invented.
//
// Auth reuses resolveDiyCaller() (src/lib/diy.ts). 401 when not signed
// in, 501 when Supabase is not configured. If migration 0026 has not
// been run yet, the table does not exist and the route returns 501
// saying so honestly instead of pretending a check-in was stored.
//
// GET  — today's check-in status + streak for the caller.
// POST { caseId?: string } — record today's check-in. Already checked
//        in today -> { ok: true, already: true } (no duplicate row).
//        caseId, when given, must be a case of the caller.
// No email, no charge, no filing. Nothing sensitive is stored: only
// account id, case id, and the calendar date.
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveDiyCaller } from "@/lib/diy";
import { computeStreak } from "@/lib/dailyHome";
import { isMissingSchemaError } from "@/lib/apiErrors";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function readCheckins(admin: SupabaseClient, accountId: string) {
  const { data, error } = await admin
    .from("daily_checkins")
    .select("checked_date")
    .eq("account_id", accountId)
    .order("checked_date", { ascending: false })
    .limit(400);
  if (error) return null;
  return (Array.isArray(data) ? data : []).map((r) =>
    String((r as Record<string, unknown>).checked_date ?? "")
  );
}

export async function GET(req: Request) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const caller = await resolveDiyCaller(req);
  if (!caller.ok) {
    return NextResponse.json({ ok: false, error: caller.error }, { status: caller.status });
  }
  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured." },
      { status: 501 }
    );
  }
  const dates = await readCheckins(admin, caller.accountId);
  if (dates === null) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Daily check-ins are not set up yet (migration 0026 has not been run). Your check-in was not recorded.",
      },
      { status: 501 }
    );
  }
  return NextResponse.json({
    ok: true,
    todayIso,
    ...computeStreak(dates, todayIso),
  });
}

export async function POST(req: Request) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const caller = await resolveDiyCaller(req);
  if (!caller.ok) {
    return NextResponse.json({ ok: false, error: caller.error }, { status: caller.status });
  }
  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured." },
      { status: 501 }
    );
  }
  let caseId: string | null = null;
  try {
    const body = (await req.json()) as { caseId?: unknown };
    if (typeof body.caseId === "string" && body.caseId) {
      if (!UUID_RE.test(body.caseId)) {
        return NextResponse.json(
          { ok: false, error: "caseId must be a case id." },
          { status: 400 }
        );
      }
      caseId = body.caseId;
    }
  } catch {
    caseId = null;
  }
  if (caseId) {
    const { data: caseRow } = await admin
      .from("cases")
      .select("id")
      .eq("id", caseId)
      .eq("client_id", caller.accountId)
      .maybeSingle();
    if (!caseRow) {
      return NextResponse.json(
        { ok: false, error: "That case does not belong to your account." },
        { status: 403 }
      );
    }
  }
  const existing = await readCheckins(admin, caller.accountId);
  if (existing === null) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Daily check-ins are not set up yet (migration 0026 has not been run). Your check-in was not recorded.",
      },
      { status: 501 }
    );
  }
  if (existing.includes(todayIso)) {
    return NextResponse.json({
      ok: true,
      already: true,
      todayIso,
      ...computeStreak(existing, todayIso),
    });
  }
  const { error } = await admin.from("daily_checkins").upsert(
    {
      account_id: caller.accountId,
      case_id: caseId,
      checked_date: todayIso,
    },
    { onConflict: "account_id,checked_date,case_id" }
  );
  if (error) {
    // Missing-table detection by Postgres error CODE (42P01), not
    // by matching the message text.
    const missing = isMissingSchemaError(error);
    return NextResponse.json(
      {
        ok: false,
        error: missing
          ? "Daily check-ins are not set up yet (migration 0026 has not been run). Your check-in was not recorded."
          : "Your check-in could not be recorded. Try again.",
      },
      { status: missing ? 501 : 500 }
    );
  }
  const dates = (await readCheckins(admin, caller.accountId)) ?? [todayIso];
  return NextResponse.json({
    ok: true,
    already: false,
    todayIso,
    ...computeStreak(dates, todayIso),
  });
}
