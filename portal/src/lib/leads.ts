// Lead Sheet — CSV bulk import for the preparer pipeline.
//
// CSV ONLY: no .xlsx parsing library is in package.json, so Excel files
// are not accepted (see LEAD_IMPORT_LIMITS). Do not add a dependency
// without noting it.
//
// Storage target is `preparer_leads` as defined in migration 0010
// (0010_itfw_leads_nvc_lifecycle_notifications.sql — in progress by
// another builder, NOT yet applied, do not edit it). The importer
// therefore attempts a Supabase insert only when a client exists, a
// preparer is signed in, AND their accounts row resolves; otherwise —
// or when the insert fails — valid rows go to a clearly-labelled
// pending-import queue that writes to preparer_leads once the table
// is wired. Never claim an import is live in Supabase until an insert
// actually succeeds.
//
// Schema facts the importer must respect (migration 0010):
// - preparer_id references public.accounts(id) — NOT the auth user id.
//   It is resolved via accounts.auth_user_id = auth.uid(); RLS checks
//   preparer_id = current_account_id().
// - email is citext NOT NULL: a row with a missing email cannot be
//   inserted, so it is reported as invalid (no email is ever invented).
// - preferred_language is NOT NULL DEFAULT 'en': a blank language is
//   omitted from the insert so the DB default applies.
// - payment plan column is `payment_plan_offered`, CHECK-limited to the
//   4 locked plans. There is NO 50/50 Split value.
// - pipeline_stage defaults to 'new_lead'. There are NO `status` or
//   `source` columns — do not send them.
//
// Rules (locked):
// - A row is NEVER imported with a missing full name or phone.
// - Blank optional fields stay blank (null) — data is never invented.
// - Quoted fee is stored as integer cents (quoted_fee_cents).
// - Payment plan offered is limited to the locked immigration plans
//   (full_upfront / installments_3 / monthly_6 / monthly_12). There is
//   NO 50/50 Split plan for immigration bundles — 50/50 is the Florida
//   Property Compliance OS default, a different business (see lib/order.ts).
import type { PaymentPlanType } from "./order";
import { LANGUAGES, type LanguageCode } from "./i18n";

export const LEAD_IMPORT_LIMITS =
  "CSV only — .xlsx is not supported in this build (no spreadsheet parsing library in package.json).";

export const LEAD_PAYMENT_PLANS: {
  id: PaymentPlanType;
  label: string;
}[] = [
  { id: "full_upfront", label: "Pay in Full" },
  { id: "installments_3", label: "Pay in 3" },
  { id: "monthly_6", label: "Monthly — 6 months" },
  { id: "monthly_12", label: "Monthly — 12 months" },
];
// NOTE: no "50/50 Split" — it is not a locked immigration payment plan.

export interface ParsedLeadRow {
  rowNumber: number; // 1-based line in the file, counting the header as row 1
  fullName: string;
  email: string | null;
  phone: string;
  preferredLanguage: LanguageCode | null;
  leadSource: string | null;
  serviceInterested: string | null;
  quotedFeeCents: number | null; // integer cents
  /** Optional quote expiry (YYYY-MM-DD). Null = no expiry set.
   *  Mirrors preparer_leads.quote_expires_at (migration 0010). */
  quoteExpiresAt: string | null;
  followUpDate: string | null; // YYYY-MM-DD
  notes: string | null;
  errors: string[];
  valid: boolean;
}

export interface LeadCsvParseResult {
  rows: ParsedLeadRow[];
  fileErrors: string[]; // problems with the file itself (headers, empty file)
  ignoredColumns: string[];
}

export const LEAD_CSV_TEMPLATE =
  "full_name,email,phone,preferred_language,lead_source,service_interested,quoted_fee,quote_expires_at,follow_up_date,notes\n" +
  "Maria Santos,maria@example.com,772-555-0100,es,Referral,I-130 Petition,1799,2026-12-25,2026-11-25,Prefers Spanish; call after 5pm\n";

// Header aliases accepted (case-insensitive, spaces/underscores ignored).
const HEADER_ALIASES: Record<string, string> = {
  fullname: "full_name",
  name: "full_name",
  email: "email",
  emailaddress: "email",
  phone: "phone",
  phonenumber: "phone",
  telephone: "phone",
  preferredlanguage: "preferred_language",
  language: "preferred_language",
  leadsource: "lead_source",
  source: "lead_source",
  serviceinterested: "service_interested",
  service: "service_interested",
  quotedfee: "quoted_fee",
  fee: "quoted_fee",
  quotedfeecents: "quoted_fee_cents",
  quoteexpiresat: "quote_expires_at",
  quoteexpiry: "quote_expires_at",
  followupdate: "follow_up_date",
  followup: "follow_up_date",
  notes: "notes",
  note: "notes",
};

const KNOWN_HEADERS = [
  "full_name",
  "email",
  "phone",
  "preferred_language",
  "lead_source",
  "service_interested",
  "quoted_fee",
  "quoted_fee_cents",
  "quote_expires_at",
  "follow_up_date",
  "notes",
];

const LANGUAGE_NAMES: Record<string, LanguageCode> = {
  english: "en",
  spanish: "es",
  espanol: "es",
  "español": "es",
  haitiancreole: "ht",
  "haitian creole": "ht",
  kreyol: "ht",
  "kreyòl": "ht",
  "kreyòl ayisyen": "ht",
  french: "fr",
  "français": "fr",
  portuguese: "pt",
  "português": "pt",
  chinese: "zh",
  arabic: "ar",
};

function normaliseHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

// Minimal RFC-4180 CSV parser: quoted fields, "" escapes, commas and
// newlines inside quotes, CRLF/LF line endings. No dependency.
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false;
  const pushField = () => {
    row.push(field);
    field = "";
    fieldStarted = false;
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && !fieldStarted && field === "") {
      inQuotes = true;
      fieldStarted = true;
      continue;
    }
    if (ch === ",") {
      pushField();
      continue;
    }
    if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      pushRow();
      continue;
    }
    if (ch === "\n") {
      pushRow();
      continue;
    }
    field += ch;
    fieldStarted = true;
  }
  // Trailing content without a newline.
  if (field !== "" || fieldStarted || row.length > 0) pushRow();
  // Drop wholly-empty trailing rows (e.g. final newline).
  while (
    rows.length > 0 &&
    rows[rows.length - 1].every((c) => c.trim() === "")
  ) {
    rows.pop();
  }
  return rows;
}

function parseLanguage(raw: string): LanguageCode | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  const codes = LANGUAGES.map((l) => l.code);
  if ((codes as string[]).includes(v)) return v as LanguageCode;
  return LANGUAGE_NAMES[v] ?? null;
}

function parseFeeCents(raw: string): { cents: number | null; error: string | null } {
  const v = raw.trim().replace(/[$,\s]/g, "");
  if (!v) return { cents: null, error: null };
  if (!/^\d+(\.\d{1,2})?$/.test(v)) {
    return { cents: null, error: `quoted_fee "${raw.trim()}" is not a valid dollar amount` };
  }
  const cents = Math.round(parseFloat(v) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0) {
    return { cents: null, error: `quoted_fee "${raw.trim()}" is not a valid dollar amount` };
  }
  return { cents, error: null };
}

function parseDateField(
  raw: string,
  fieldName: string
): { date: string | null; error: string | null } {
  const v = raw.trim();
  if (!v) return { date: null, error: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return { date: null, error: `${fieldName} "${v}" must be YYYY-MM-DD` };
  }
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return { date: null, error: `${fieldName} "${v}" is not a real date` };
  }
  return { date: v, error: null };
}

function parseFollowUpDate(raw: string): { date: string | null; error: string | null } {
  return parseDateField(raw, "follow_up_date");
}

export function parseLeadCsv(text: string): LeadCsvParseResult {
  const fileErrors: string[] = [];
  if (!text.trim()) {
    return { rows: [], fileErrors: ["File is empty."], ignoredColumns: [] };
  }
  const rawRows = parseCsvText(text);
  if (rawRows.length === 0) {
    return { rows: [], fileErrors: ["File is empty."], ignoredColumns: [] };
  }
  const headers = rawRows[0].map((h) => HEADER_ALIASES[normaliseHeader(h)] ?? normaliseHeader(h));
  const ignoredColumns = rawRows[0]
    .map((h, i) => ({ raw: h.trim(), mapped: headers[i] }))
    .filter((c) => !KNOWN_HEADERS.includes(c.mapped))
    .map((c) => c.raw);
  if (!headers.includes("full_name")) {
    fileErrors.push('Missing required column "full_name" (full name).');
  }
  if (!headers.includes("phone")) {
    fileErrors.push('Missing required column "phone".');
  }
  if (fileErrors.length > 0) {
    return { rows: [], fileErrors, ignoredColumns };
  }

  const rows: ParsedLeadRow[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const cells = rawRows[i];
    if (cells.every((c) => c.trim() === "")) continue; // skip blank lines
    const get = (name: string): string => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? (cells[idx] ?? "").trim() : "";
    };
    const errors: string[] = [];
    const fullName = get("full_name");
    if (!fullName) errors.push("Missing full name — row will not be imported.");
    const phone = get("phone");
    if (!phone) {
      errors.push("Missing phone — row will not be imported.");
    } else if (phone.replace(/\D/g, "").length < 7) {
      errors.push(`Phone "${phone}" has fewer than 7 digits.`);
    }
    const emailRaw = get("email");
    let email: string | null = null;
    if (!emailRaw) {
      // preparer_leads.email is citext NOT NULL (migration 0010) — a
      // row without an email cannot be inserted. Never invent one.
      errors.push("Missing email — preparer_leads requires an email and none is invented.");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      errors.push(`Email "${emailRaw}" is not a valid email address.`);
    } else {
      email = emailRaw;
    }
    const langRaw = get("preferred_language");
    let preferredLanguage: LanguageCode | null = null;
    if (langRaw) {
      const parsed = parseLanguage(langRaw);
      if (!parsed) {
        errors.push(
          `Preferred language "${langRaw}" is not recognised (use en, es, ht, fr, pt, zh, or ar).`
        );
      } else {
        preferredLanguage = parsed;
      }
    }
    const feeRaw = get("quoted_fee");
    const feeCentsRaw = get("quoted_fee_cents");
    let quotedFeeCents: number | null = null;
    if (feeRaw) {
      const { cents, error } = parseFeeCents(feeRaw);
      if (error) errors.push(error);
      else quotedFeeCents = cents;
    } else if (feeCentsRaw) {
      if (!/^\d+$/.test(feeCentsRaw)) {
        errors.push(`quoted_fee_cents "${feeCentsRaw}" must be a whole number of cents.`);
      } else {
        quotedFeeCents = parseInt(feeCentsRaw, 10);
      }
    }
    const { date: followUpDate, error: dateError } = parseFollowUpDate(
      get("follow_up_date")
    );
    if (dateError) errors.push(dateError);
    const { date: quoteExpiresAt, error: expiryError } = parseDateField(
      get("quote_expires_at"),
      "quote_expires_at"
    );
    if (expiryError) errors.push(expiryError);

    // Blank optional fields stay null — never invented.
    const orNull = (v: string): string | null => (v ? v : null);
    rows.push({
      rowNumber: i + 1,
      fullName,
      email,
      phone,
      preferredLanguage,
      leadSource: orNull(get("lead_source")),
      serviceInterested: orNull(get("service_interested")),
      quotedFeeCents,
      quoteExpiresAt,
      followUpDate,
      notes: orNull(get("notes")),
      errors,
      valid: errors.length === 0,
    });
  }
  return { rows, fileErrors, ignoredColumns };
}

// Row as inserted into `preparer_leads` (migration 0010 columns only).
// preparerId must be the preparer's public.accounts(id) — resolved via
// accounts.auth_user_id — NOT the Supabase auth user id, or the RLS
// policy (preparer_id = current_account_id()) will reject the insert.
// A blank preferred_language is omitted so the DB default ('en') applies
// rather than sending an explicit null into a NOT NULL column.
export function toPreparerLeadInsert(
  row: ParsedLeadRow,
  preparerId: string,
  paymentPlan: PaymentPlanType
): Record<string, unknown> {
  const insert: Record<string, unknown> = {
    preparer_id: preparerId,
    full_name: row.fullName,
    email: row.email,
    phone: row.phone,
    lead_source: row.leadSource,
    service_interested: row.serviceInterested,
    quoted_fee_cents: row.quotedFeeCents,
    payment_plan_offered: paymentPlan,
    pipeline_stage: "new_lead",
    quote_expires_at: row.quoteExpiresAt,
    follow_up_date: row.followUpDate,
    notes: row.notes,
  };
  if (row.preferredLanguage !== null) {
    insert.preferred_language = row.preferredLanguage;
  }
  return insert;
}

export function leadsToCsv(rows: ParsedLeadRow[]): string {
  const esc = (v: string | null): string => {
    if (v === null) return "";
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const header =
    "full_name,email,phone,preferred_language,lead_source,service_interested,quoted_fee_cents,quote_expires_at,follow_up_date,notes";
  const lines = rows.map((r) =>
    [
      esc(r.fullName),
      esc(r.email),
      esc(r.phone),
      esc(r.preferredLanguage),
      esc(r.leadSource),
      esc(r.serviceInterested),
      r.quotedFeeCents === null ? "" : String(r.quotedFeeCents),
      esc(r.quoteExpiresAt),
      esc(r.followUpDate),
      esc(r.notes),
    ].join(",")
  );
  return [header, ...lines].join("\n") + "\n";
}
