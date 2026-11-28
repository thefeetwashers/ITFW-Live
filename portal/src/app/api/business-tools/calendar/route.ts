// GET /api/business-tools/calendar?providerId=<account id>
// Professional calendar view — merged from the THREE canonical tables
// (no second calendar table is invented):
//   * appointments (0001) — confirmed appointments
//   * preparer_appointments (0012 + decision columns 0017) — requests
//   * consultation_requests (0017) — requests, locked $0 / $99 prices
// Google Calendar is NOT connected (google_connections, 0030, is
// status-only, no tokens): the response always says
// calendarConnected: false and "no calendar sync exists". Returns 501
// when Supabase is not configured. No client DOB / A-Number / SSN /
// passport number is ever returned — only names, times and statuses.
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  CALENDAR_NOT_CONNECTED,
  mergeCalendarEvents,
  type AppointmentRowInput,
  type ConsultationRequestRowInput,
  type PreparerAppointmentRowInput,
} from "@/lib/businessTools";

export async function GET(req: Request) {
  const providerId = new URL(req.url).searchParams.get("providerId");
  if (!providerId) {
    return NextResponse.json({ error: "providerId is required." }, { status: 400 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Calendar not configured — Supabase env vars are not set, so no appointments were read.",
        calendarConnected: false,
        calendarNote: CALENDAR_NOT_CONNECTED,
        events: [],
      },
      { status: 501 }
    );
  }
  const [appts, prep, consults] = await Promise.all([
    supabase
      .from("appointments")
      .select("id,case_id,client_id,provider_id,type,status,starts_at,ends_at,location_or_link")
      .eq("provider_id", providerId)
      .order("starts_at", { ascending: true }),
    supabase
      .from("preparer_appointments")
      .select("id,case_id,requester_name,consultation_type,preferred_time,status,decision,proposed_time,created_at")
      .eq("preparer_id", providerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("consultation_requests")
      .select("id,requester_name,mode,duration_minutes,price_cents,requested_time_text,proposed_starts_at,status,created_at")
      .eq("professional_id", providerId)
      .order("created_at", { ascending: false }),
  ]);
  if (appts.error || prep.error || consults.error) {
    return NextResponse.json(
      {
        error: `Could not read calendar records: ${appts.error?.message ?? prep.error?.message ?? consults.error?.message}. Migrations 0001, 0012 and 0017 may not have run yet.`,
        calendarConnected: false,
        calendarNote: CALENDAR_NOT_CONNECTED,
        events: [],
      },
      { status: 500 }
    );
  }
  const events = mergeCalendarEvents({
    appointments: (appts.data ?? []) as AppointmentRowInput[],
    preparerAppointments: (prep.data ?? []) as PreparerAppointmentRowInput[],
    consultationRequests: (consults.data ?? []) as ConsultationRequestRowInput[],
  });
  return NextResponse.json({
    calendarConnected: false,
    calendarNote: CALENDAR_NOT_CONNECTED,
    events,
    isEmpty: events.length === 0,
    emptyMessage:
      events.length === 0
        ? "No appointments or consultation requests yet. Requests from your storefront will appear here."
        : undefined,
  });
}
