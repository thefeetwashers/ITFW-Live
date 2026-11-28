// BYO Integrations — each professional connects their OWN accounts.
// The platform never holds their money or messages: no platform
// Twilio / Resend / SES / Stripe account sends on a professional's
// behalf, the platform never splits legal fees and never takes a
// percentage — flat subscription only (preparer $49/mo, attorney
// $99/mo, DOJ Standard $24.50/mo, DOJ Full $49.50/mo, law student
// $35/mo — migration 0001/0003 subscription_plan enum).
//
// STORAGE RULES (enforced by migration 0014 provider_settings):
//  * Keys are stored ONLY as an encrypted key reference
//    (provider_settings.encrypted_key_reference) — NO plaintext key
//    is ever written to the database, to a log, or to chat.
//  * The UI shows ONLY the last 4 characters (key_last4).
//  * A send that needs a not-connected integration returns
//    "not_configured" instead of pretending it sent.
//  * Test-send goes ONLY to the professional's OWN email/phone, and
//    only after the integration is connected + tested. Never to a
//    client until connected + tested.
//  * In this build there is no live Supabase / no key vault, so keys
//    entered in the settings UI are held in local component state only
//    and are NEVER persisted. When Supabase is live they go through
//    the service-role key-vault write into provider_settings.
export type ProviderKey =
  | "resend"
  | "aws_ses"
  | "twilio"
  | "whatsapp_business"
  | "video_call"
  | "calendar"
  | "esign"
  | "storage"
  | "google_translate"
  | "stripe_own";

export interface ProviderDef {
  key: ProviderKey;
  name: string;
  whatItDoes: string;
  /** Env names only — never a key value. */
  envNames: string[];
  /** Fields the professional enters in their dashboard. */
  connectFields: { id: string; label: string; secret: boolean; placeholder: string }[];
  /** What "connected" means for test-send. */
  testTarget: "own_email" | "own_phone" | "own_account";
  notConnectedLabel: string;
}

export const BYO_PROVIDERS: ProviderDef[] = [
  {
    key: "resend", name: "Resend (email)", whatItDoes: "Sends email from your own sender address, through your own Resend account.",
    envNames: ["RESEND_API_KEY"], testTarget: "own_email", notConnectedLabel: "NOT CONNECTED — email will return “not configured”.",
    connectFields: [
      { id: "api_key", label: "Resend API key", secret: true, placeholder: "re_…" },
      { id: "sender_email", label: "Your sender email", secret: false, placeholder: "you@yourpractice.com" },
    ],
  },
  {
    key: "aws_ses", name: "AWS SES (email)", whatItDoes: "Sends email through your own AWS SES account. (The platform itself also sends through AWS SES — see src/lib/email.ts.)",
    envNames: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SES_REGION"], testTarget: "own_email", notConnectedLabel: "NOT CONNECTED — email will return “not configured”.",
    connectFields: [
      { id: "access_key_id", label: "AWS access key ID", secret: true, placeholder: "AKIA…" },
      { id: "secret_access_key", label: "AWS secret access key", secret: true, placeholder: "••••" },
      { id: "region", label: "AWS region", secret: false, placeholder: "us-east-1" },
      { id: "sender_email", label: "Your sender email", secret: false, placeholder: "you@yourpractice.com" },
    ],
  },
  {
    key: "twilio", name: "Twilio (SMS)", whatItDoes: "Sends SMS from your own Twilio phone number, through your own Twilio account. Never from a personal phone.",
    envNames: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"], testTarget: "own_phone", notConnectedLabel: "NOT CONNECTED — SMS will return “not configured”.",
    connectFields: [
      { id: "account_sid", label: "Twilio Account SID", secret: true, placeholder: "AC…" },
      { id: "auth_token", label: "Twilio Auth Token", secret: true, placeholder: "••••" },
      { id: "phone_number", label: "Your Twilio phone number", secret: false, placeholder: "+1…" },
    ],
  },
  {
    key: "whatsapp_business", name: "WhatsApp Business (via Twilio)", whatItDoes: "Sends WhatsApp from your own WhatsApp Business number, through your own Twilio account. Needs WhatsApp Business approval — a separate step from having the keys.",
    envNames: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_NUMBER"], testTarget: "own_phone", notConnectedLabel: "NOT CONNECTED — WhatsApp will return “not configured”.",
    connectFields: [
      { id: "account_sid", label: "Twilio Account SID", secret: true, placeholder: "AC…" },
      { id: "auth_token", label: "Twilio Auth Token", secret: true, placeholder: "••••" },
      { id: "whatsapp_number", label: "Your WhatsApp Business number", secret: false, placeholder: "+1…" },
    ],
  },
  {
    key: "video_call", name: "Video-call account", whatItDoes: "Starts video calls from your own video account. No video provider is connected in this build.",
    envNames: [], testTarget: "own_account", notConnectedLabel: "NOT CONNECTED — video room not connected yet.",
    connectFields: [
      { id: "provider", label: "Video provider (e.g. Zoom / Google Meet)", secret: false, placeholder: "Zoom" },
      { id: "account", label: "Your video account / meeting link", secret: false, placeholder: "https://…" },
    ],
  },
  {
    key: "calendar", name: "Calendar", whatItDoes: "Books appointments on your own calendar. No calendar is connected in this build — booking shows “calendar NOT connected”.",
    envNames: [], testTarget: "own_account", notConnectedLabel: "NOT CONNECTED — calendar NOT connected.",
    connectFields: [
      { id: "provider", label: "Calendar provider", secret: false, placeholder: "Google Calendar" },
      { id: "account", label: "Your calendar account", secret: false, placeholder: "you@yourpractice.com" },
    ],
  },
  {
    key: "esign", name: "E-signature provider", whatItDoes: "Collects client e-signatures through your own e-signature provider. No e-sign provider is connected in this build.",
    envNames: [], testTarget: "own_account", notConnectedLabel: "NOT CONNECTED — e-sign provider not connected.",
    connectFields: [
      { id: "provider", label: "E-signature provider", secret: false, placeholder: "Provider name" },
      { id: "api_key", label: "Provider API key", secret: true, placeholder: "••••" },
    ],
  },
  {
    key: "storage", name: "Storage", whatItDoes: "Stores case files in your own storage. Document Vault storage is Supabase Storage bucket 'vault' (migration 0001) — this is for a professional's own additional storage.",
    envNames: [], testTarget: "own_account", notConnectedLabel: "NOT CONNECTED.",
    connectFields: [
      { id: "provider", label: "Storage provider", secret: false, placeholder: "Provider name" },
      { id: "bucket", label: "Bucket / folder", secret: false, placeholder: "Bucket name" },
    ],
  },
  {
    key: "google_translate", name: "Google Cloud Translation", whatItDoes: "Auto-translates messages between the client's language and English. NOT connected — env name only: GOOGLE_TRANSLATE_API_KEY.",
    envNames: ["GOOGLE_TRANSLATE_API_KEY"], testTarget: "own_account", notConnectedLabel: "NOT CONNECTED — translation returns “translation not configured”.",
    connectFields: [
      { id: "api_key", label: "Google Cloud Translation API key", secret: true, placeholder: "AIza…" },
    ],
  },
  {
    key: "stripe_own", name: "Your own Stripe (payments)", whatItDoes: "Takes client payments into YOUR Stripe account. The platform never holds money — payments go to the professional's own Stripe, never through the platform.",
    envNames: ["STRIPE_SECRET_KEY"], testTarget: "own_account", notConnectedLabel: "NOT CONNECTED — checkout is not live.",
    connectFields: [
      { id: "secret_key", label: "Stripe secret key", secret: true, placeholder: "sk_…" },
      { id: "publishable_key", label: "Stripe publishable key", secret: false, placeholder: "pk_…" },
    ],
  },
];

/** Last-4 masking: only the last 4 characters of a secret are ever
 *  shown or stored (provider_settings.key_last4). Never log a secret. */
export function last4(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "••••";
  return `••••${trimmed.slice(-4)}`;
}

export type ProviderStatus = "connected" | "not_connected" | "test_pending";

export interface ProviderConnection {
  providerKey: ProviderKey;
  status: ProviderStatus;
  /** Last 4 only — never a full key. Null when not connected. */
  keyLast4: string | null;
  connectedAt: string | null;
  lastTestedAt: string | null;
  testStatus: "not_tested" | "passed" | "failed" | "not_configured";
}

/** A send is allowed only when the integration is connected AND tested.
 *  Anything else returns "not_configured" — never a fake "sent". */
export function canSendWith(conn: ProviderConnection): boolean {
  return conn.status === "connected" && conn.testStatus === "passed";
}

export function sendBlockedReason(conn: ProviderConnection): string {
  if (conn.status !== "connected") return "not configured — connect your own account first.";
  if (conn.testStatus !== "passed") return "not configured — test-send to your own email/phone first.";
  return "";
}
