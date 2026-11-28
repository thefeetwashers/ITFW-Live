// Google Integrations — Calendar, Drive, Gmail (status + code paths
// only). Nov 28, 2026 (twelfth addition, part A).
//
// WHAT ALREADY EXISTED (reused, not rebuilt):
//   * Google SIGN-IN via Supabase Auth — src/lib/googleAuth.ts:
//     signInWithOAuth({ provider: "google" }), /auth/callback, and
//     the 6-digit email code step AFTER Google (every login, Google
//     included). That flow is UNCHANGED by this file. Its honest
//     state is in GOOGLE_SIGNIN_STATE below (verified from code).
//   * BYO integrations — src/lib/byo.ts provider_settings: each
//     professional connects their OWN accounts (own Twilio, own
//     Resend, own SES). Google Calendar/Drive/Gmail follow the same
//     BYO shape: the professional connects THEIR OWN Google account
//     — the platform never holds a shared Google account.
//   * BYO "calendar" provider in byo.ts already exists as a
//     status-only entry ("No calendar is connected in this build").
//     This file is the Google-specific detail for it: exact scopes,
//     setup steps, and the google_connections table (migration
//     0030). It does NOT replace byo.ts.
//
// HONEST BOUNDARY — read before claiming anything is connected:
//   * Google Calendar / Drive / Gmail API access needs a Google
//     Cloud OAuth client + consent-screen approval. That is NOT
//     set up yet: there is no Google Cloud OAuth client for API
//     scopes in this repo, no consent screen, no redirect URI, and
//     no token exchange code that talks to Google's APIs. The UI
//     therefore shows "Not connected" for all three products, and
//     every connect attempt returns 501 / not_configured with the
//     setup steps — NEVER a claim of connection.
//   * The Supabase Auth Google provider (sign-in) is a DIFFERENT
//     OAuth client from the API OAuth client this file needs. A
//     sign-in token does NOT carry Calendar/Drive/Gmail scopes and
//     must never be reused as an API token.
//   * NEVER store a Google password. OAuth only. No token, refresh
//     token, or secret is ever stored in google_connections — that
//     table holds status + scopes + the Google account email only
//     (migration 0030). When the OAuth client exists, tokens live
//     in the provider's secure token store, never in this repo.
//   * The professional's Google email + phone in their profile
//     (migration 0030 professional_profiles.google_email /
//     google_phone) are THEIR OWN contact details, entered by them
//     — never scraped, never bought, never copied from a client.

export type GoogleProduct = "calendar" | "drive" | "gmail";

export type GoogleConnectionStatus =
  | "not_connected"
  | "awaiting_founder_setup"
  | "connected";

export interface GoogleProductDef {
  product: GoogleProduct;
  name: string;
  whatItDoes: string;
  /** Exact OAuth scopes this product needs (least privilege). */
  scopes: string[];
  /** What the scope lets the platform do, in plain words. */
  scopePlainEnglish: string[];
  notConnectedLabel: string;
}

/**
 * EXACT OAuth scopes (least privilege — nothing broader):
 *   Calendar — calendar.events: create/read calendar EVENTS only.
 *     (NOT https://www.googleapis.com/auth/calendar — full calendar
 *     read/write is broader than needed.)
 *   Drive — drive.file: access ONLY files this app creates or the
 *     user opens with it. (NOT drive / drive.readonly — full Drive
 *     access is broader than needed.)
 *   Gmail — gmail.send: SEND mail only. (NOT gmail.readonly,
 *     gmail.modify, or full gmail access — reading the
 *     professional's inbox is never needed.)
 * Sign-in scopes (already live via Supabase Auth, separate client):
 *   openid, email, profile.
 */
export const GOOGLE_SCOPES: Record<GoogleProduct, string[]> = {
  calendar: ["https://www.googleapis.com/auth/calendar.events"],
  drive: ["https://www.googleapis.com/auth/drive.file"],
  gmail: ["https://www.googleapis.com/auth/gmail.send"],
};

/** All API scopes, for the consent-screen / setup checklist. */
export const ALL_GOOGLE_API_SCOPES: string[] = [
  ...GOOGLE_SCOPES.calendar,
  ...GOOGLE_SCOPES.drive,
  ...GOOGLE_SCOPES.gmail,
];

export const GOOGLE_PRODUCTS: GoogleProductDef[] = [
  {
    product: "calendar",
    name: "Google Calendar",
    whatItDoes:
      "Creates appointment events on the professional's own Google Calendar and reads event times for booking. No calendar is connected in this build.",
    scopes: GOOGLE_SCOPES.calendar,
    scopePlainEnglish: ["Create and read calendar events"],
    notConnectedLabel: "Not connected — Google Calendar is not connected.",
  },
  {
    product: "drive",
    name: "Google Drive",
    whatItDoes:
      "Saves case documents the professional creates in the portal to the professional's own Google Drive (files this app creates only). No Drive is connected in this build.",
    scopes: GOOGLE_SCOPES.drive,
    scopePlainEnglish: ["Access only files this app creates or you open with it"],
    notConnectedLabel: "Not connected — Google Drive is not connected.",
  },
  {
    product: "gmail",
    name: "Gmail",
    whatItDoes:
      "Sends email from the professional's own Gmail address, through their own Google account. Platform email still goes through AWS SES (src/lib/email.ts). No Gmail is connected in this build.",
    scopes: GOOGLE_SCOPES.gmail,
    scopePlainEnglish: ["Send email from your Gmail address (send only — never reads your inbox)"],
    notConnectedLabel: "Not connected — Gmail is not connected.",
  },
];

export function googleProductDef(product: GoogleProduct): GoogleProductDef {
  return GOOGLE_PRODUCTS.find((p) => p.product === product) as GoogleProductDef;
}

export function scopesForProduct(product: GoogleProduct): string[] {
  return [...GOOGLE_SCOPES[product]];
}

export interface GoogleConnection {
  product: GoogleProduct;
  status: GoogleConnectionStatus;
  googleAccountEmail: string | null;
  scopes: string[];
  connectedAt: string | null;
  lastCheckedAt: string | null;
}

/** The honest default: every product starts not connected. */
export function defaultGoogleConnections(): GoogleConnection[] {
  return GOOGLE_PRODUCTS.map((p) => ({
    product: p.product,
    status: "not_connected" as const,
    googleAccountEmail: null,
    scopes: [...p.scopes],
    connectedAt: null,
    lastCheckedAt: null,
  }));
}

/** True only when the product is really connected (OAuth exchange
 *  succeeded). Anything else is "not connected" in the UI. */
export function isGoogleProductConnected(c: GoogleConnection): boolean {
  return c.status === "connected" && c.connectedAt !== null;
}

/** Status label shown in the dashboard — never claims a connection
 *  that does not exist. */
export function googleConnectionLabel(c: GoogleConnection): string {
  if (isGoogleProductConnected(c)) {
    return `Connected${c.googleAccountEmail ? ` — ${c.googleAccountEmail}` : ""}`;
  }
  if (c.status === "awaiting_founder_setup") {
    return "Not connected — waiting for the founder to finish the Google Cloud OAuth setup.";
  }
  return googleProductDef(c.product).notConnectedLabel;
}

/** A Google API call is allowed only when connected. Until then the
 *  caller must return 501 / not_configured — never a fake success. */
export function googleCallBlockedReason(c: GoogleConnection): string {
  if (isGoogleProductConnected(c)) return "";
  return "not configured — Google Cloud OAuth is not set up yet, so this Google product is not connected.";
}

// ---------------------------------------------------------------------------
// Google sign-in state (verified from code, Nov 28, 2026).
// ---------------------------------------------------------------------------

/**
 * Google SIGN-IN (Supabase Auth) — code path, as built:
 *   1. Register / Login offer "Continue with Google" for every role
 *      EXCEPT Founder / Admin (email + code only) — see
 *      src/components/auth/GoogleSignInButton.tsx and
 *      src/lib/googleAuth.ts signInWithGoogle().
 *   2. signInWithOAuth({ provider: "google" }) sends the user to
 *      Google; Supabase handles its callback
 *      (https://jdxjskqdvwqarfhcqjlg.supabase.co/auth/v1/callback);
 *      the portal receives the user at /auth/callback
 *      (src/app/auth/callback/page.tsx).
 *   3. /auth/callback looks the Auth user up in public.accounts:
 *      existing account → POST /api/auth/login with
 *      { email, oauthAccessToken } so the server issues the 6-digit
 *      email code, then /login step 2 — the user is NEVER sent
 *      straight to their role destination. New Google user →
 *      /onboarding?google=1, must still pick ONE role and complete
 *      that role's profile. No role is auto-assigned, no
 *      professional is auto-verified.
 *   4. The 6-digit code is sent by AWS SES (src/lib/email.ts).
 *      The SES change does NOT change this path — the callback
 *      already handles the SES 501 honestly ("Email codes are not
 *      configured yet (AWS SES is not connected)").
 *
 * HONEST STATE (Nov 28, 2026): the code path is complete and
 * unchanged by the SES change. Google sign-in itself is verified
 * as ENABLED in the live Supabase "Immigration" project (Nov 19,
 * 2026 — Client ID + Client Secret already filled in Supabase).
 * It will work once the Supabase env vars are set in Vercel and
 * the portal is deployed; it does NOT work on the static live
 * site, and the Google button renders DISABLED with that
 * explanation until then. No live end-to-end Google sign-in has
 * been run from this repo (no live Supabase / Vercel in this
 * build), so "works" here means "code path complete + provider
 * enabled in Supabase", not "tested live".
 */
export const GOOGLE_SIGNIN_STATE = {
  provider: "supabase_auth_google",
  codePathComplete: true,
  sesChangeAffectsIt: false,
  codeStepAfterGoogle: true,
  worksOnStaticSite: false,
  needsEnvVarsInVercel: true,
  testedLiveEndToEnd: false,
  note: "Google sign-in is wired to Supabase Auth and unchanged by the SES change. It works once the Supabase env vars are set in Vercel and the portal is deployed; it does not work on the static live site.",
} as const;

// ---------------------------------------------------------------------------
// Setup steps still needing the founder (Google Cloud OAuth, API scopes).
// No step here is done. Do not mark any done until it really is.
// ---------------------------------------------------------------------------

export const GOOGLE_OAUTH_SETUP_STEPS: { step: number; title: string; detail: string }[] = [
  {
    step: 1,
    title: "Create a Google Cloud project (or reuse the founder's existing one)",
    detail:
      "In Google Cloud Console (console.cloud.google.com), create a project for Immigration with NIPTEI — or reuse the founder's existing project if one already exists. Do NOT create a second OAuth client for sign-in: Supabase Auth already has its own Google OAuth client (see GOOGLE_SIGNIN_STATE). This is a SECOND client, for API scopes only.",
  },
  {
    step: 2,
    title: "Enable the APIs",
    detail:
      "In the same Google Cloud project, enable: Google Calendar API, Google Drive API, and Gmail API (APIs & Services → Library). No other Google API is needed.",
  },
  {
    step: 3,
    title: "Configure the OAuth consent screen",
    detail:
      "APIs & Services → OAuth consent screen. User type: External (professionals are outside the founder's Workspace, if any). App name: Immigration with NIPTEI. Add exactly the scopes in ALL_GOOGLE_API_SCOPES (calendar.events, drive.file, gmail.send — least privilege, nothing broader). Add the founder as a test user while the app is in Testing; submit for Google verification before going to Production, because gmail.send is a restricted scope and Google reviews it.",
  },
  {
    step: 4,
    title: "Create the OAuth client (Web application)",
    detail:
      "APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application. Authorized redirect URI: the portal's Google OAuth callback (to be created when the client exists — e.g. https://immigration.niptei.com/api/google/oauth/callback). This redirect URI is DIFFERENT from the Supabase Auth callback (https://jdxjskqdvwqarfhcqjlg.supabase.co/auth/v1/callback) — do not reuse it.",
  },
  {
    step: 5,
    title: "Store the client ID + secret server-side only",
    detail:
      "Put GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in Vercel env vars (server-only — never NEXT_PUBLIC_, never in code, never in docs). No real key or secret may appear in this repo.",
  },
  {
    step: 6,
    title: "Build the token exchange + per-product API calls",
    detail:
      "Build the OAuth authorization-code exchange and the three API call paths (create calendar event, save file to Drive, send via Gmail), each gated on isGoogleProductConnected(). Until that code exists and a real exchange succeeds, google_connections stays 'not_connected' and the UI keeps saying so.",
  },
  {
    step: 7,
    title: "Founder approves, then one professional connects and tests",
    detail:
      "The founder approves the setup, then one professional connects their own Google account and test-sends to themselves first (same rule as BYO test-send: own account only, never a client, until connected + tested). Only then may a Google product be shown as connected.",
  },
];

export const GOOGLE_SETUP_NOT_DONE_NOTE =
  "Google Calendar, Google Drive, and Gmail are not connected. Google Cloud OAuth scopes + consent-screen approval are not set up yet — the UI and code paths are built, but no Google product can be used until the founder completes the 7 setup steps in GOOGLE_OAUTH_SETUP_STEPS.";

// ---------------------------------------------------------------------------
// Professional's own Google contact details (profile-entered only).
// ---------------------------------------------------------------------------

export interface GoogleContactDetails {
  googleEmail: string;
  googlePhone: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Loose phone check: digits, spaces, +, -, parentheses; 7–20 chars. */
const PHONE_RE = /^[+0-9][0-9\s\-().]{6,19}$/;

/** Validate the professional's OWN Google email + phone from their
 *  profile. Both are optional (a professional may leave either
 *  blank); when given, each must be well-formed. Never scraped. */
export function validateGoogleContact(
  input: Partial<GoogleContactDetails>
): { ok: true; value: GoogleContactDetails } | { ok: false; error: string } {
  const googleEmail = (input.googleEmail ?? "").trim();
  const googlePhone = (input.googlePhone ?? "").trim();
  if (googleEmail && !EMAIL_RE.test(googleEmail)) {
    return { ok: false, error: "That Google email address does not look valid." };
  }
  if (googlePhone && !PHONE_RE.test(googlePhone)) {
    return { ok: false, error: "That phone number does not look valid." };
  }
  return { ok: true, value: { googleEmail, googlePhone } };
}

/** Mask a Google email for display outside the owner's own dashboard
 *  (e.g. "j•••@gmail.com"). The owner sees their own full address. */
export function maskGoogleEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 1) return "•••";
  return `${email[0]}•••${email.slice(at)}`;
}
