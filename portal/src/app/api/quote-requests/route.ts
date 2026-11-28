// POST /api/quote-requests — request a pricing quote for an unpriced form.
//
// A client who needs I-526E / I-526 / I-829 (quoted individually) or
// I-693 (free booking; doctor's fee paid to the doctor) asks for a
// pricing quote from the service catalog. The request is saved to
// the existing public.quote_requests table (migration 0002; form /
// account / case columns added by migration 0025 — the route still
// saves on the pre-0025 schema by falling back to the 0002 columns
// with the form code in the description).
//
// The professional is notified by ONE SES email to the platform
// intake contact (nipteiapp@gmail.com — src/lib/notificationTemplates.ts
// CONTACT_EMAIL) via src/lib/email.ts. When SES is not configured the
// send returns 501/not_configured and the response says so honestly
// — it NEVER claims the professional was notified. The request is
// still saved (status "pending") either way, so no quote request is
// lost because email is down.
//
// No price is ever returned here: no quote amount, no expiry, no
// invented figure. No DOB, A-Number, SSN or passport number is ever
// accepted, stored, logged, or put in an email subject (the subject
// carries only the form code).
//
// Responses:
//   201 { ok, saved, id, email: { sent, code?, note } }
//   400 invalid input (name / email / formCode / message)
//   501 Supabase not configured — nothing was saved
//   500 save failed (database error, message only, no internals)
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildQuoteRequestRow,
  quoteNotificationBody,
  quoteNotificationSubject,
  QUOTE_NOTIFICATION_EMAIL,
} from "@/lib/quotedForms";
import { sendEmail } from "@/lib/email";
import {
  checkRateLimit,
  QUOTE_REQUEST_LIMIT,
  rateLimitKey,
  rateLimitResponse,
} from "@/lib/rateLimit";
import { safeDbError } from "@/lib/apiErrors";
import { writeAuditLog } from "@/lib/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: Request) {
  // Public intake route: a bot must not be able to spam quote
  // requests. 10/minute per IP, honest 429, never a fake success.
  const limited = checkRateLimit(
    rateLimitKey("quote-requests", req),
    QUOTE_REQUEST_LIMIT.limit,
    QUOTE_REQUEST_LIMIT.windowMs
  );
  if (!limited.allowed) {
    return rateLimitResponse(limited.retryAfterSeconds, "quote requests");
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const built = buildQuoteRequestRow(body);
  if (!built.row) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }
  const row = built.row;

  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json(
      {
        error:
          "Quote requests are not connected yet (Supabase is not configured), so your request was not saved. Nothing was sent — please contact the platform directly and ask for a pricing quote.",
      },
      { status: 501 }
    );
  }

  // Full insert (migration 0025 columns). If 0025 has not run yet,
  // the insert fails on the missing column — fall back to the 0002
  // columns (the form code is already in the description).
  let insertedId: string | null = null;
  const full = await admin
    .from("quote_requests")
    .insert({
      name: row.name,
      email: row.email,
      phone: row.phone,
      description: row.description,
      status: row.status,
      form_code: row.form_code,
      account_id: row.account_id,
      case_id: row.case_id,
    })
    .select("id")
    .maybeSingle();
  if (!full.error && full.data) {
    insertedId = (full.data as { id: string }).id;
  } else if (
    full.error &&
    /form_code|account_id|case_id/i.test(full.error.message)
  ) {
    const legacy = await admin
      .from("quote_requests")
      .insert({
        name: row.name,
        email: row.email,
        phone: row.phone,
        description: row.description,
        status: row.status,
      })
      .select("id")
      .maybeSingle();
    if (!legacy.error && legacy.data) {
      insertedId = (legacy.data as { id: string }).id;
    } else {
      return NextResponse.json(
        {
          error: safeDbError(
            "Your quote request could not be saved. Nothing was sent.",
            undefined,
            legacy.error ?? full.error
          ),
        },
        { status: 500 }
      );
    }
  } else if (full.error) {
    return NextResponse.json(
      {
        error: safeDbError(
          "Your quote request could not be saved. Nothing was sent.",
          undefined,
          full.error
        ),
      },
      { status: 500 }
    );
  }

  // Audit: the save is a money-adjacent decision (a quote is asked
  // for). Log ids/status only — no name, email, phone, or amount.
  if (insertedId) {
    await writeAuditLog(admin, {
      actorId: row.account_id,
      action: "quote_request_saved",
      entityType: "quote_requests",
      entityId: insertedId,
      caseId: row.case_id,
      detail: { form_code: row.form_code, status: "pending" },
    });
  }

  // Notify the professional (platform intake contact) by SES email.
  // Honest result: when SES is unconfigured the send returns
  // not_configured and the response says the email was NOT sent —
  // the saved request (status pending) is still the record.
  const emailResult = await sendEmail({
    to: QUOTE_NOTIFICATION_EMAIL,
    subject: quoteNotificationSubject(row.form_code),
    text: quoteNotificationBody(row),
  });

  return NextResponse.json(
    {
      ok: true,
      saved: true,
      id: insertedId,
      formCode: row.form_code,
      status: "pending",
      message:
        "Your pricing-quote request was saved. A professional will reply with a quote for your situation — no price has been shown or invented.",
      email: emailResult.ok
        ? { sent: true, note: "The professional was notified by email." }
        : {
            sent: false,
            code: emailResult.code,
            note: `The notification email was NOT sent (${emailResult.error}). Your request is still saved as pending — the professional can see it in the quote requests.`,
          },
    },
    { status: 201 }
  );
}
