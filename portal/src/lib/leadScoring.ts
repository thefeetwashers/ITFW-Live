// Lead scoring + public-intake validation — Lead Generator.
//
// TRANSPARENT SCORING (never a black box): every point comes from data
// the lead gave on the intake form, and every rule returns its reason
// in plain English. The score and its reasons are stored on
// preparer_leads (migration 0021: lead_score, lead_score_reasons) and
// shown to the professional next to the score.
//
// Rules (max 100, capped):
//   +30  Documents ready (lead said their documents are ready)
//   +25  Interview date already set (and not in the past)
//   +20  Urgency "urgent" / +15 "high" / +5 "normal" / +0 "low" or unstated
//   +15  Service has a locked price (quotable now) — "other" is TO BE
//         CONFIRMED, so it scores 0 here and says so
//   +10  Came by referral (warm lead — referral_source 'Referral')
//
// Bands (shown with the score, never instead of the reasons):
//   70+ Hot — contact first   40-69 Warm — contact soon   0-39 New
//
// Lead capture is PUBLIC intake + referral only. It never invents or
// buys lists of real people and never scrapes personal data: a lead
// exists only because that person filled in the form (or a preparer
// typed in a real enquiry). No SSN is ever asked for or stored.
import {
  resolveQuotedFee,
  SERVICE_REQUESTED_LABELS,
  type ServiceRequested,
  type ServiceTier,
} from "./lifecycle";
import type { LanguageCode } from "./i18n";

export type LeadUrgency = "low" | "normal" | "high" | "urgent";
export type BeneficiaryLocation = "inside_us" | "outside_us";

export const LEAD_URGENCIES: { id: LeadUrgency; label: string }[] = [
  { id: "low", label: "Not urgent — just exploring" },
  { id: "normal", label: "Normal — within the next few months" },
  { id: "high", label: "High — need to file soon" },
  { id: "urgent", label: "Urgent — deadline or interview coming up" },
];

export const BENEFICIARY_LOCATIONS: {
  id: BeneficiaryLocation;
  label: string;
}[] = [
  { id: "inside_us", label: "Inside the United States" },
  { id: "outside_us", label: "Outside the United States" },
];

export interface LeadScoreInput {
  documentsReady: boolean;
  /** YYYY-MM-DD, or null when the lead has no interview date yet. */
  interviewDate: string | null;
  urgency: LeadUrgency | null;
  serviceRequested: ServiceRequested;
  /** True when the lead arrived via a referral link (/r/[code]). */
  viaReferral: boolean;
}

export interface LeadScore {
  /** 0-100, capped. */
  score: number;
  /** One plain-English reason per rule, including the rules that gave 0. */
  reasons: string[];
  band: "hot" | "warm" | "new";
  bandLabel: string;
}

export function scoreLead(input: LeadScoreInput, todayIso?: string): LeadScore {
  const reasons: string[] = [];
  let score = 0;

  if (input.documentsReady) {
    score += 30;
    reasons.push("+30 — documents ready");
  } else {
    reasons.push("+0 — documents not ready yet");
  }

  const today = todayIso ?? new Date().toISOString().slice(0, 10);
  if (input.interviewDate) {
    if (input.interviewDate < today) {
      reasons.push("+0 — interview date is in the past, so it does not add points");
    } else {
      score += 25;
      reasons.push(`+25 — interview date already set (${input.interviewDate})`);
    }
  } else {
    reasons.push("+0 — no interview date yet");
  }

  switch (input.urgency) {
    case "urgent":
      score += 20;
      reasons.push("+20 — urgency: urgent");
      break;
    case "high":
      score += 15;
      reasons.push("+15 — urgency: high");
      break;
    case "normal":
      score += 5;
      reasons.push("+5 — urgency: normal");
      break;
    case "low":
      reasons.push("+0 — urgency: low");
      break;
    default:
      reasons.push("+0 — urgency not stated");
      break;
  }

  // A locked price means the professional can quote immediately.
  const quote = resolveQuotedFee(input.serviceRequested, "standard");
  if (quote.amountCents !== null) {
    score += 15;
    reasons.push(
      `+15 — ${SERVICE_REQUESTED_LABELS[input.serviceRequested]} has a locked price, so a quote can be sent now`
    );
  } else {
    reasons.push(
      "+0 — service price is TO BE CONFIRMED, so no quote can be sent yet"
    );
  }

  if (input.viaReferral) {
    score += 10;
    reasons.push("+10 — came by referral");
  } else {
    reasons.push("+0 — did not come by referral");
  }

  if (score > 100) score = 100;
  const band: LeadScore["band"] = score >= 70 ? "hot" : score >= 40 ? "warm" : "new";
  const bandLabel =
    band === "hot"
      ? "Hot — contact first"
      : band === "warm"
        ? "Warm — contact soon"
        : "New — follow up";
  return { score, reasons, band, bandLabel };
}

// ---------------------------------------------------------------------------
// Follow-up reminders for intake leads (preparer_leads rows).
// A lead needs a reminder when it has a follow-up date and is not
// converted and not lost. Mirrors followUpReminders() in lib/lifecycle.ts
// (which works on the local Lead type); this one works on the plain
// follow-up dates the API returns, so the Lead Generator does not have
// to rebuild Lead objects. Dates are calendar dates (YYYY-MM-DD).
// ---------------------------------------------------------------------------

export type FollowUpStatus =
  | { kind: "none"; label: string }
  | { kind: "overdue"; label: string; daysOverdue: number }
  | { kind: "due_today"; label: string }
  | { kind: "upcoming"; label: string; daysAway: number };

export function followUpStatus(
  followUpDate: string | null,
  opts?: { converted?: boolean; lost?: boolean; todayIso?: string }
): FollowUpStatus {
  if (!followUpDate) return { kind: "none", label: "No follow-up date set" };
  if (opts?.converted) return { kind: "none", label: "Converted — no follow-up needed" };
  if (opts?.lost) return { kind: "none", label: "Lost — no follow-up needed" };
  const today = opts?.todayIso ?? new Date().toISOString().slice(0, 10);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const dueMs = Date.parse(`${followUpDate}T00:00:00Z`);
  if (Number.isNaN(dueMs)) return { kind: "none", label: "Follow-up date is not a real date" };
  const diffDays = Math.round((todayMs - dueMs) / 86400000);
  if (diffDays > 0) {
    return {
      kind: "overdue",
      label: `Follow-up overdue by ${diffDays} day${diffDays === 1 ? "" : "s"} (was ${followUpDate})`,
      daysOverdue: diffDays,
    };
  }
  if (diffDays === 0) return { kind: "due_today", label: "Follow-up due today" };
  const daysAway = -diffDays;
  return {
    kind: "upcoming",
    label: `Follow-up in ${daysAway} day${daysAway === 1 ? "" : "s"} (${followUpDate})`,
    daysAway,
  };
}

// ---------------------------------------------------------------------------
// Public intake validation — the funnel posts name, phone, email,
// language, service needed, beneficiary location, documents-ready,
// interview date and urgency. A row is never created with a missing
// name, phone or email (preparer_leads.email is NOT NULL, migration
// 0010), and nothing is ever invented to fill a blank.
// ---------------------------------------------------------------------------

export interface LeadCaptureInput {
  fullName: string;
  phone: string;
  email: string;
  preferredLanguage: LanguageCode;
  serviceRequested: ServiceRequested;
  serviceTier: ServiceTier;
  beneficiaryLocation: BeneficiaryLocation | null;
  documentsReady: boolean;
  /** YYYY-MM-DD or "" when the lead has no interview date. */
  interviewDate: string;
  urgency: LeadUrgency | null;
  /** Referral code from /r/[code] or ?ref=, when the lead used one. */
  referralCode: string | null;
  /** Provider storefront slug, when the lead came from /p/[slug]. */
  providerSlug: string | null;
  /** Free-tool id the lead came from (src/lib/freeTools.ts
   *  TOOL_USED_IDS), or null when the lead did not come from a tool.
   *  A made-up tool id is rejected by validateLeadCapture. */
  toolUsed: string | null;
  /** preparer_leads.arrival_channel value (migration 0028), or null
   *  when not recorded. Only the locked check values are accepted. */
  arrivalChannel: string | null;
}

const TOOL_USED_IDS: readonly string[] = [
  "packet_health_check",
  "fee_calculator",
  "interview_question",
  "sponsor_income",
  "visa_bulletin",
];
// Single source of truth for the tool ids lives in freeTools.ts
// (TOOL_USED_IDS there); this list mirrors it so leadScoring stays
// free of a dependency on the hub registry. The smoke test asserts
// the two lists are identical.

const ARRIVAL_CHANNEL_VALUES: readonly string[] = [
  "intake",
  "quote",
  "packet_health_check",
  "interview_question",
  "referral",
  "storefront",
  "other",
];

const LANGUAGE_CODES: readonly string[] = ["en", "es", "ht", "fr", "pt", "zh", "ar"];
const SERVICE_CODES: readonly string[] = [
  "family_bundle",
  "I-130",
  "I-485",
  "N-400",
  "I-589",
  "I-821",
  "other",
];

/** Validate raw intake input. Returns the cleaned input or throws with a
 *  plain-English reason. Never invents a missing value. */
export function validateLeadCapture(body: unknown): LeadCaptureInput {
  const row = (body ?? {}) as Record<string, unknown>;
  const asString = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const fullName = asString(row.fullName);
  if (!fullName) throw new Error("Full name is required.");
  const phone = asString(row.phone);
  if (!phone) throw new Error("Phone is required.");
  if (phone.replace(/\D/g, "").length < 7) {
    throw new Error("Phone number has fewer than 7 digits.");
  }
  const email = asString(row.email);
  if (!email) throw new Error("Email is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email address is not valid.");
  }
  const languageRaw = asString(row.preferredLanguage) || "en";
  if (!LANGUAGE_CODES.includes(languageRaw)) {
    throw new Error(`Preferred language "${languageRaw}" is not recognised.`);
  }
  const serviceRaw = asString(row.serviceRequested);
  if (!SERVICE_CODES.includes(serviceRaw)) {
    throw new Error(`Service "${serviceRaw}" is not recognised.`);
  }
  const tierRaw = asString(row.serviceTier) || "standard";
  if (!["basic", "standard", "premium"].includes(tierRaw)) {
    throw new Error(`Service tier "${tierRaw}" is not recognised.`);
  }
  const locationRaw = asString(row.beneficiaryLocation);
  const beneficiaryLocation: BeneficiaryLocation | null =
    locationRaw === "inside_us" || locationRaw === "outside_us"
      ? locationRaw
      : locationRaw === ""
        ? null
        : (() => {
            throw new Error(`Beneficiary location "${locationRaw}" is not recognised.`);
          })();
  const interviewDate = asString(row.interviewDate);
  if (interviewDate && !/^\d{4}-\d{2}-\d{2}$/.test(interviewDate)) {
    throw new Error(`Interview date "${interviewDate}" must be YYYY-MM-DD.`);
  }
  if (interviewDate) {
    const [y, m, d] = interviewDate.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
      throw new Error(`Interview date "${interviewDate}" is not a real date.`);
    }
  }
  const urgencyRaw = asString(row.urgency);
  const urgency: LeadUrgency | null =
    urgencyRaw === ""
      ? null
      : urgencyRaw === "low" ||
          urgencyRaw === "normal" ||
          urgencyRaw === "high" ||
          urgencyRaw === "urgent"
        ? urgencyRaw
        : (() => {
            throw new Error(`Urgency "${urgencyRaw}" is not recognised.`);
          })();
  // Free-tool follow-up (Nov 28, 2026): optional, validated, never
  // invented. A tool id outside the five free tools is rejected.
  const toolUsedRaw = asString(row.toolUsed);
  const toolUsed: string | null =
    toolUsedRaw === ""
      ? null
      : TOOL_USED_IDS.includes(toolUsedRaw)
        ? toolUsedRaw
        : (() => {
            throw new Error(`Tool "${toolUsedRaw}" is not recognised.`);
          })();
  const arrivalChannelRaw = asString(row.arrivalChannel);
  const arrivalChannel: string | null =
    arrivalChannelRaw === ""
      ? null
      : ARRIVAL_CHANNEL_VALUES.includes(arrivalChannelRaw)
        ? arrivalChannelRaw
        : (() => {
            throw new Error(`Arrival channel "${arrivalChannelRaw}" is not recognised.`);
          })();
  return {
    fullName,
    phone,
    email,
    preferredLanguage: languageRaw as LanguageCode,
    serviceRequested: serviceRaw as ServiceRequested,
    serviceTier: tierRaw as ServiceTier,
    beneficiaryLocation,
    documentsReady: row.documentsReady === true,
    interviewDate,
    urgency,
    referralCode: asString(row.referralCode) || null,
    providerSlug: asString(row.providerSlug) || null,
    toolUsed,
    arrivalChannel,
  };
}

/** Default follow-up date for a new lead: 2 days from submission. The
 *  professional can change it on the Lead Sheet afterwards. */
export function defaultFollowUpDate(todayIso?: string): string {
  const today = todayIso ?? new Date().toISOString().slice(0, 10);
  const ms = Date.parse(`${today}T00:00:00Z`) + 2 * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}
