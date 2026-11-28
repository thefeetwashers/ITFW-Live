// POST /api/renewals/remind — send due renewal reminders by email.
// { caseId } — loads that case's case_renewals rows, computes which
// 180/90/30/7-day ladder rungs are due (see
// portal/src/lib/renewalReminders.ts renewalRemindersDue), and sends
// ONE email per due renewal (its soonest due rung) via AWS SES
// (portal/src/lib/email.ts). The renewal's last_nudged_at is updated
// so the 48h repeat rule in src/lib/renewals.ts has a real timestamp.
//
// HONEST 501: until Supabase env vars are set this route returns 501
// and sends nothing; until SES is configured it returns 501 with
// code email_not_configured AND the list of reminders that WOULD have
// gone out — and never claims any was sent. No DOB, A-Number, SSN, or
// passport number is ever in a subject or body (see
// buildRenewalReminderEmail). Email only: the SMS/WhatsApp nudge
// queue (reminder_nudges, migration 0005) is a separate channel and
// is not written here.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  deriveRenewals,
  type RenewalInput,
  type RenewalType,
} from "@/lib/renewals";
import {
  renewalRemindersDue,
  sendRenewalReminder,
} from "@/lib/renewalReminders";
import { isEmailConfigured } from "@/lib/email";

export const runtime = "nodejs";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json(
      {
        error:
          "Renewal reminders not configured — Supabase env vars are not set, so no renewal was read and no reminder was sent.",
        notConfigured: true,
      },
      { status: 501 }
    );
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const caseId = body.caseId as string | undefined;
  if (!caseId) {
    return NextResponse.json({ error: "caseId is required." }, { status: 400 });
  }
  const { data: caseRow, error: caseError } = await admin
    .from("cases")
    .select("id, client_id")
    .eq("id", caseId)
    .maybeSingle();
  if (caseError || !caseRow) {
    return NextResponse.json(
      { error: "No case was found for that caseId. No reminder was sent." },
      { status: 404 }
    );
  }
  const { data: clientRow } = await admin
    .from("accounts")
    .select("id, email")
    .eq("id", (caseRow as { client_id: string }).client_id)
    .maybeSingle();
  const to = (clientRow as { email?: string } | null)?.email ?? null;
  const { data, error } = await admin
    .from("case_renewals")
    .select("id, case_id, renewal_type, eligibility_or_expiry_date, status, nudge_language, last_nudged_at")
    .eq("case_id", caseId)
    .order("eligibility_or_expiry_date", { ascending: true });
  if (error) {
    return NextResponse.json(
      { error: `Could not read renewals: ${error.message}. Migration 0017 / 0029 may not have run yet.` },
      { status: 500 }
    );
  }
  const inputs: RenewalInput[] = (data ?? []).map((r) => ({
    id: r.id as string,
    caseId: r.case_id as string,
    type: r.renewal_type as RenewalType,
    eligibilityOrExpiryDate: r.eligibility_or_expiry_date as string,
    status: r.status as RenewalInput["status"],
    language: (r.nudge_language as string | undefined) ?? "en",
    lastNudgedAt: (r.last_nudged_at as string | null) ?? null,
  }));
  void deriveRenewals(inputs);
  const due = renewalRemindersDue(inputs);
  // One email per due renewal (soonest rung each) — a renewal with
  // several rungs due gets one email, not one per rung.
  const perRenewal = new Map<string, (typeof due)[number]>();
  for (const d of due) {
    if (!perRenewal.has(d.renewalId)) perRenewal.set(d.renewalId, d);
  }
  const wouldSend = Array.from(perRenewal.values());
  if (wouldSend.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      due: [],
      note: "No renewal reminder is due for this case — no email was sent.",
    });
  }
  if (!to) {
    return NextResponse.json(
      {
        error:
          "No email address is on file for this case's client, so no reminder was sent.",
        due: wouldSend,
      },
      { status: 501 }
    );
  }
  if (!isEmailConfigured()) {
    return NextResponse.json(
      {
        error:
          "Renewal reminder sending not configured — AWS SES is not connected (see src/lib/email.ts), so no email was sent.",
        code: "email_not_configured",
        due: wouldSend,
        notConfigured: true,
      },
      { status: 501 }
    );
  }
  const sent: string[] = [];
  const failed: { renewalId: string; error: string }[] = [];
  for (const reminder of wouldSend) {
    const result = await sendRenewalReminder(to, reminder);
    if (result.ok) {
      sent.push(reminder.renewalId);
      await admin
        .from("case_renewals")
        .update({ last_nudged_at: new Date().toISOString() })
        .eq("id", reminder.renewalId);
    } else {
      failed.push({ renewalId: reminder.renewalId, error: result.error });
    }
  }
  return NextResponse.json({
    ok: failed.length === 0,
    sent: sent.length,
    failed,
    due: wouldSend,
  });
}
