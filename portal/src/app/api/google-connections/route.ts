// GET /api/google-connections — connection status for Google
// Calendar, Drive, and Gmail for one professional.
// POST /api/google-connections — record the professional's OWN Google
// email + phone in their profile, or request a Google connect.
//
// HONEST STATE: Google Cloud OAuth scopes + consent-screen approval
// are NOT set up yet, so every product reports "not_connected" and
// every connect request returns 501 / not_configured with the setup
// steps. NOTHING here can mark a product "connected" — that only
// happens after a real OAuth exchange succeeds (setup step 6 in
// src/lib/googleIntegrations.ts). NEVER store a Google password;
// OAuth only. No token or secret is accepted or stored by this route.
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  ALL_GOOGLE_API_SCOPES,
  GOOGLE_OAUTH_SETUP_STEPS,
  GOOGLE_SETUP_NOT_DONE_NOTE,
  defaultGoogleConnections,
  googleConnectionLabel,
  validateGoogleContact,
  type GoogleConnection,
  type GoogleProduct,
} from "@/lib/googleIntegrations";
import { safeDbError } from "@/lib/apiErrors";
import { writeAuditLog } from "@/lib/auditLog";

function notConnectedPayload(connections: GoogleConnection[]) {
  return {
    connections: connections.map((c) => ({
      product: c.product,
      status: c.status,
      label: googleConnectionLabel(c),
      googleAccountEmail: c.googleAccountEmail,
      scopes: c.scopes,
      connectedAt: c.connectedAt,
    })),
    setupNotDone: true,
    note: GOOGLE_SETUP_NOT_DONE_NOTE,
    scopes: ALL_GOOGLE_API_SCOPES,
    setupSteps: GOOGLE_OAUTH_SETUP_STEPS.map((s) => `${s.step}. ${s.title} — ${s.detail}`),
  };
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const accountId = params.get("accountId") ?? "";
  // No account id → the honest default for every product.
  if (!accountId) {
    return NextResponse.json(notConnectedPayload(defaultGoogleConnections()), { status: 200 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      {
        ...notConnectedPayload(defaultGoogleConnections()),
        note: `${GOOGLE_SETUP_NOT_DONE_NOTE} (Supabase is also not connected in this build, so no stored connection status could be read.)`,
      },
      { status: 200 }
    );
  }
  const { data, error } = await supabase
    .from("google_connections")
    .select("product, status, google_account_email, scopes, connected_at, last_checked_at")
    .eq("account_id", accountId);
  // A database read failure is a FAILURE, not a "not connected"
  // answer: returning 200 with a warning would let the UI show
  // "not connected" for a product that may in fact be connected.
  // Fail closed with 502 and an honest message (no raw DB text).
  if (error) {
    return NextResponse.json(
      {
        error: safeDbError(
          "Stored Google connection status could not be read. No connection status is shown.",
          "Migration 0030 (google_connections) may not have run yet.",
          error
        ),
      },
      { status: 502 }
    );
  }
  const byProduct = new Map<string, GoogleConnection>();
  for (const row of (data ?? []) as unknown as {
    product: GoogleProduct;
    status: GoogleConnection["status"];
    google_account_email: string | null;
    scopes: string[];
    connected_at: string | null;
    last_checked_at: string | null;
  }[]) {
    byProduct.set(row.product, {
      product: row.product,
      status: row.status,
      googleAccountEmail: row.google_account_email,
      scopes: row.scopes ?? [],
      connectedAt: row.connected_at,
      lastCheckedAt: row.last_checked_at,
    });
  }
  // Stored rows are honoured only when they are really connected;
  // a stored 'connected' without a connected_at is treated as not
  // connected (never trust a status row over the OAuth exchange).
  const connections = defaultGoogleConnections().map((d) => {
    const stored = byProduct.get(d.product);
    if (!stored) return d;
    if (stored.status === "connected" && !stored.connectedAt) {
      return { ...d, status: "awaiting_founder_setup" as const };
    }
    return stored;
  });
  return NextResponse.json(notConnectedPayload(connections), { status: 200 });
}

export async function POST(req: Request) {
  let body: {
    action?: unknown;
    accountId?: unknown;
    profileId?: unknown;
    product?: unknown;
    googleEmail?: unknown;
    googlePhone?: unknown;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";

  // Record the professional's OWN Google email + phone (their own
  // contact details, from their profile — never scraped).
  if (action === "save_contact") {
    const checked = validateGoogleContact({
      googleEmail: typeof body.googleEmail === "string" ? body.googleEmail : "",
      googlePhone: typeof body.googlePhone === "string" ? body.googlePhone : "",
    });
    if (!checked.ok) {
      return NextResponse.json({ error: checked.error }, { status: 400 });
    }
    const profileId = typeof body.profileId === "string" ? body.profileId : "";
    if (!profileId) {
      return NextResponse.json({ error: "profileId is required." }, { status: 400 });
    }
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        {
          error:
            "Google contact details cannot be saved — Supabase is not connected, so the profile cannot be updated. Nothing was saved.",
          deliveryStatus: "not_configured",
        },
        { status: 501 }
      );
    }
    const { error } = await supabase
      .from("professional_profiles")
      .update({
        google_email: checked.value.googleEmail || null,
        google_phone: checked.value.googlePhone || null,
        google_contact_updated_at: new Date().toISOString(),
      })
      .eq("id", profileId);
    if (error) {
      return NextResponse.json(
        {
          error: safeDbError(
            "Google contact details could not be saved. Nothing was saved.",
            undefined,
            error
          ),
        },
        { status: 502 }
      );
    }
    // Audit: a profile write. Log ids only — never the email/phone.
    await writeAuditLog(supabase, {
      actorId: null,
      action: "google_connection_updated",
      entityType: "professional_profiles",
      entityId: profileId,
      detail: { status: "contact_saved" },
    });
    return NextResponse.json(
      { ok: true, googleEmail: checked.value.googleEmail, googlePhone: checked.value.googlePhone },
      { status: 200 }
    );
  }

  // Request a Google connect — always refused honestly until the
  // founder completes the Google Cloud OAuth setup. No product is
  // ever marked connected here.
  if (action === "connect") {
    const product = typeof body.product === "string" ? body.product : "";
    if (!["calendar", "drive", "gmail"].includes(product)) {
      return NextResponse.json({ error: "product must be calendar, drive, or gmail." }, { status: 400 });
    }
    return NextResponse.json(
      {
        error: `Google ${product} is not connected — Google Cloud OAuth scopes + consent-screen approval are not set up yet. No connection was made.`,
        deliveryStatus: "not_configured",
        product,
        scopes: ALL_GOOGLE_API_SCOPES,
        setupSteps: GOOGLE_OAUTH_SETUP_STEPS.map((s) => `${s.step}. ${s.title}`),
      },
      { status: 501 }
    );
  }

  return NextResponse.json(
    { error: "action must be save_contact or connect." },
    { status: 400 }
  );
}
