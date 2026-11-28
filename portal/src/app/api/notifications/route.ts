// GET /api/notifications — Notification inbox (final sweep, Nov 28, 2026).
//
// One place for every status / email / message event, built ONLY from
// stored rows: notification_logs (migration 0010) + messages (migration
// 0001), for the signed-in caller only (recipient_account_id /
// recipient_id = caller). Auth reuses resolveDiyCaller() (src/lib/diy.ts)
// — an account id in the query is never trusted. 401 when not signed
// in, 501 when Supabase is not configured (fail closed).
//
// Message bodies are NEVER returned here (same rule as the /today feed):
// the inbox shows who, which channel, which stage, and when. No DOB /
// A-Number / SSN / passport number is read, logged, or returned.
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveDiyCaller } from "@/lib/diy";
import {
  normalizeInboxEvents,
  type MessageRow,
  type NotificationLogRow,
} from "@/lib/finalSweep";

export const runtime = "nodejs";

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(req: Request) {
  const caller = await resolveDiyCaller(req);
  if (!caller.ok) {
    return NextResponse.json(
      { ok: false, error: caller.error, events: [] },
      { status: caller.status }
    );
  }
  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Notifications are not connected yet (Supabase is not configured), so no stored events can be listed.",
        events: [],
      },
      { status: 501 }
    );
  }
  const accountId = caller.accountId as string;
  const [logsRes, msgsRes] = await Promise.all([
    admin
      .from("notification_logs")
      .select("id, stage_key, channel, status, created_at")
      .eq("recipient_account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("messages")
      .select("id, sender_role, recipient_role, is_read, created_at")
      .eq("recipient_id", accountId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (logsRes.error || msgsRes.error) {
    return NextResponse.json(
      {
        ok: false,
        error: `Your notifications could not be loaded: ${logsRes.error?.message ?? msgsRes.error?.message ?? "unknown error"}`,
        events: [],
      },
      { status: 500 }
    );
  }
  const events = normalizeInboxEvents({
    logs: (logsRes.data ?? []) as NotificationLogRow[],
    messages: (msgsRes.data ?? []) as MessageRow[],
  });
  return NextResponse.json({ ok: true, events });
}
