// Booking API — /api/bookings
// Consultation requests are COLLECTED, not auto-booked: the calendar
// is NOT connected and no calendar event is ever created here.
// GET  ?preparerId=<account id> — that professional's requests.
// POST — a client requests a consultation: { preparerId, requesterName,
//      requesterEmail?, mode (phone/video/in_person), lengthMinutes
//      (15 free / 30 $99), preferredTime?, timePreference
//      (weekday/evening/weekend/any), language?, timezone? }.
//      Stored in preparer_appointments (0012) + the decision columns
//      from migration 0017. Price is locked: 15 min = $0, 30 min = $99.
//      The 30-min consultation is NOT legal advice unless it comes
//      from a licensed attorney.
// PATCH — the professional answers: { id, decision: accepted |
//      proposed | declined, proposedTime?, declinedReason? }.
//      Accepting records the decision only — the professional confirms
//      the time with the client by message; nothing claims a sync.
// Until Supabase env vars are set this route returns 501 and stores
// nothing. If migration 0017 has not run, the insert fails on the
// missing decision columns and the error says so plainly.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { bookingPriceCents, type ConsultationMode, type TimePreference } from "@/lib/booking";
import { resolveVideoMeeting } from "@/lib/expertTools";

function notConfigured() {
  return NextResponse.json(
    {
      error:
        "Booking not configured — Supabase env vars are not set, so no request was stored. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY, and run migrations 0012 + 0017 first.",
    },
    { status: 501 }
  );
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const MODES: ConsultationMode[] = ["phone", "video", "in_person"];
const TIME_PREFERENCES: TimePreference[] = ["weekday", "evening", "weekend", "any"];

export async function GET(req: Request) {
  const preparerId = new URL(req.url).searchParams.get("preparerId");
  if (!preparerId) {
    return NextResponse.json({ error: "preparerId is required." }, { status: 400 });
  }
  const supabase = getSupabase();
  if (!supabase) return notConfigured();
  const { data, error } = await supabase
    .from("preparer_appointments")
    .select("*")
    .eq("preparer_id", preparerId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      { error: `Could not read booking requests: ${error.message}. Migrations 0012 + 0017 may not have run yet.` },
      { status: 500 }
    );
  }
  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(req: Request) {
  const admin = serviceClient();
  if (!admin) return notConfigured();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const preparerId = body.preparerId as string | undefined;
  const requesterName = typeof body.requesterName === "string" ? body.requesterName.trim() : "";
  const mode = body.mode as string | undefined;
  const lengthMinutes = body.lengthMinutes as number | undefined;
  if (!preparerId || !requesterName) {
    return NextResponse.json({ error: "preparerId and requesterName are required." }, { status: 400 });
  }
  if (!mode || !MODES.includes(mode as ConsultationMode)) {
    return NextResponse.json({ error: "mode must be phone, video, or in_person." }, { status: 400 });
  }
  if (lengthMinutes !== 15 && lengthMinutes !== 30) {
    return NextResponse.json({ error: "lengthMinutes must be 15 (free) or 30 ($99)." }, { status: 400 });
  }
  const timePreference =
    typeof body.timePreference === "string" && TIME_PREFERENCES.includes(body.timePreference as TimePreference)
      ? (body.timePreference as TimePreference)
      : "any";
  const { data, error } = await admin
    .from("preparer_appointments")
    .insert({
      preparer_id: preparerId,
      requester_name: requesterName,
      requester_email: typeof body.requesterEmail === "string" ? body.requesterEmail : null,
      consultation_type: mode === "in_person" ? "video" : mode, // 0012 CHECK allows phone/video only; the real mode is in consultation_mode (0017)
      consultation_mode: mode,
      time_preference: timePreference,
      language: typeof body.language === "string" ? body.language : "en",
      timezone: typeof body.timezone === "string" ? body.timezone : "America/New_York",
      price_cents: bookingPriceCents(lengthMinutes),
      preferred_time: typeof body.preferredTime === "string" ? body.preferredTime : null,
      decision: "pending",
      status: "request_collected",
    })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json(
      { error: `Request was NOT stored: ${error.message}. Migration 0017 may not have run yet.` },
      { status: 500 }
    );
  }
  return NextResponse.json(
    {
      ok: true,
      id: data.id,
      note: "Request collected — no calendar event was created. The professional confirms the time by message.",
    },
    { status: 201 }
  );
}

export async function PATCH(req: Request) {
  const admin = serviceClient();
  if (!admin) return notConfigured();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = body.id as string | undefined;
  const decision = body.decision as string | undefined;
  if (!id || !decision) {
    return NextResponse.json({ error: "id and decision are required." }, { status: 400 });
  }
  if (!["accepted", "proposed", "declined"].includes(decision)) {
    return NextResponse.json({ error: "decision must be accepted, proposed, or declined." }, { status: 400 });
  }
  if (decision === "proposed" && typeof body.proposedTime !== "string") {
    return NextResponse.json(
      { error: "Proposing another time requires proposedTime." },
      { status: 400 }
    );
  }
  // Video link (migration 0033): the professional's own pasted link
  // only. Google Meet is NOT connected, so no Meet link is ever
  // generated here — resolveVideoMeeting() validates the paste and
  // refuses anything that is not a valid https URL.
  let videoLinkPatch: { video_link: string; video_link_source: "manual" } | {} = {};
  if (typeof body.manualVideoLink === "string" && body.manualVideoLink.trim()) {
    const resolved = resolveVideoMeeting({
      googleCalendarConnected: false,
      googleMeetLinkFromEvent: null,
      manualLink: body.manualVideoLink as string,
    });
    if (resolved.source !== "manual" || !resolved.link) {
      return NextResponse.json({ error: resolved.note }, { status: 400 });
    }
    videoLinkPatch = { video_link: resolved.link, video_link_source: "manual" };
  }
  const { error } = await admin
    .from("preparer_appointments")
    .update({
      decision,
      proposed_time: decision === "proposed" ? (body.proposedTime as string) : null,
      declined_reason: decision === "declined" && typeof body.declinedReason === "string" ? body.declinedReason : null,
      status: decision === "accepted" ? "confirmed_by_preparer" : decision === "declined" ? "cancelled" : "request_collected",
      ...videoLinkPatch,
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: `Decision was NOT saved: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true, decision });
}
