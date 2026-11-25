import type { ChatMessage, ChecklistItem, ProviderBadge } from "./types";

// ---------------------------------------------------------------------------
// EXAMPLE DATA ONLY — no real client, provider, case, or document.
// Every screen that uses this must show the "Example data" banner.
// Replace with Supabase rows (cases / documents / messages / accounts)
// once env vars are set and migration 0004 has run live.
// ---------------------------------------------------------------------------

export const EXAMPLE_CASE = {
  formCode: "I-130",
  formName: "Family Petition",
  statusLine: "Your provider is currently drafting your forms.",
  // Portal steps: Intake done, Docs done, Drafting in progress.
  currentStepIndex: 2,
};

export const EXAMPLE_PROVIDER = {
  name: "Jane Doe",
  roleLabel: "Document Preparer",
  badge: { kind: "preparer", label: "Document Preparer - Clerical Only" } as ProviderBadge,
  banner: "Non-attorney clerical assistance.",
  // When a supervised student is assigned, show this line instead of
  // hiding the supervisor. Example name only.
  assistedBy: "Alex M.",
};

export const EXAMPLE_ATTORNEY_PROVIDER = {
  name: "Jane Doe",
  roleLabel: "Licensed Attorney",
  badge: { kind: "attorney", label: "Licensed Esq." } as ProviderBadge,
  banner: null as string | null,
  assistedBy: null as string | null,
};

export const EXAMPLE_CHECKLIST: ChecklistItem[] = [
  { id: "doc-passport", label: "Petitioner Passport", status: "accepted" },
  { id: "doc-marriage", label: "Marriage Certificate", status: "accepted" },
  { id: "doc-birth", label: "Birth Certificate", status: "under_review" },
  {
    id: "doc-bank",
    label: "Joint Bank Statement",
    status: "retake_requested",
    note: "Previous upload was blurry.",
  },
  { id: "doc-address", label: "Beneficiary Address History", status: "accepted" },
  { id: "doc-tax", label: "Tax Transcript (Last Year)", status: "accepted" },
];
// 4 of 6 accepted — COMPUTED from the statuses above (Birth Certificate
// is under_review, Joint Bank Statement is retake_requested). The
// founder's brief said "5 of 6 Approved" — the data gives 4 of 6, so
// the portal displays the computed 4 of 6 with that note, and the
// founder decision ("which item should count as approved to make 5
// of 6?") is on the DEPLOY.md checklist. Do NOT hardcode 5 of 6.

export const EXAMPLE_ACTION_ITEMS = [
  {
    id: "action-bank",
    kind: "upload" as const,
    title: "Upload: Joint Bank Statement (Last 3 Months)",
    reason: "Previous upload was blurry.",
    cta: "Upload File",
  },
  {
    id: "action-address",
    kind: "complete" as const,
    title: "Complete: Beneficiary Address History",
    reason: "",
    cta: "Completed",
  },
];

export const EXAMPLE_CHAT: ChatMessage[] = [
  {
    id: "msg-1",
    sender: "Jane Doe",
    time: "10:14 AM",
    body: "Hi! Please re-upload page 2 of your bank statement.",
    mine: false,
  },
  {
    id: "msg-2",
    sender: "You",
    time: "10:20 AM",
    body: "Scanning it now with my phone!",
    mine: true,
  },
];

// Admin verification queue — EXAMPLE submissions only, no real people.
export interface VerificationRow {
  id: string;
  name: string;
  role: "attorney" | "nonprofit";
  submitted: string;
  barNumber?: string;
  barStates?: string[];
  eoirNumber?: string;
  accreditationLevel?: "Partial — USCIS only" | "Full — USCIS and Court";
  accreditationExpiry?: string;
  status: "pending" | "verified" | "rejected" | "expired";
  notes: string;
}

export const EXAMPLE_VERIFICATIONS: VerificationRow[] = [
  {
    id: "ver-1",
    name: "Example Attorney",
    role: "attorney",
    submitted: "2026-11-18",
    barNumber: "FL-000000 (example)",
    barStates: ["Florida"],
    status: "pending",
    notes: "Bar number submitted for manual/admin check. No live bar lookup yet.",
  },
  {
    id: "ver-2",
    name: "Example Nonprofit",
    role: "nonprofit",
    submitted: "2026-11-17",
    barNumber: undefined,
    eoirNumber: "EOIR-000000 (example)",
    accreditationLevel: "Full — USCIS and Court",
    accreditationExpiry: "2027-06-30",
    status: "pending",
    notes: "Check against the official EOIR roster before approving.",
  },
  {
    id: "ver-3",
    name: "Example Attorney (expired)",
    role: "attorney",
    submitted: "2026-10-02",
    barNumber: "FL-000001 (example)",
    barStates: ["Florida", "New York"],
    status: "expired",
    notes: "Example expired row, shown so the Expired filter has a row.",
  },
];

// Official EOIR Recognition & Accreditation (R&A) roster links.
// Use the FULL labels below at every link — never a bare "EOIR roster"
// link, and never a single link. The three links are:
//   1. the by-state roster PDF
//      (https://www.justice.gov/eoir/media/1398081/dl?inline),
//   2. the roster-reports page
//      (https://www.justice.gov/eoir/recognition-accreditation-roster-reports),
//   3. the R&A Program page
//      (https://www.justice.gov/eoir/recognition-and-accreditation-program).
// Florida tip (shown with the links): in the by-state roster PDF press
// Ctrl+F (Windows) / Cmd+F (Mac) and type "Florida".
// Links checked Nov 14, 2026; re-checked Nov 20, 2026 — the old R&A
// URL (…/recognition-accreditation-roster) returns 404 and was replaced
// with the live program page above; the roster-reports page was fetched
// live Nov 20, 2026 and lists the three roster PDF reports. The
// by-state roster PDF URL is the one named in the Nov 19 brief; it was
// not re-fetched here.
// The other two roster PDF reports (verified live Nov 19, 2026) are
// kept separately in EOIR_ROSTER_PDF_REPORTS below — they are extra
// reports on the same roster-reports page, not a replacement for the
// three links above.
export const EOIR_ROSTER_LINKS: { label: string; url: string }[] = [
  {
    label:
      "Recognized Organizations and Accredited Representatives Roster by State and City (PDF, justice.gov)",
    url: "https://www.justice.gov/eoir/media/1398081/dl?inline",
  },
  {
    label:
      "EOIR Recognition & Accreditation Roster Reports page (justice.gov)",
    url: "https://www.justice.gov/eoir/recognition-accreditation-roster-reports",
  },
  {
    label:
      "EOIR Recognition & Accreditation (R&A) Program page (justice.gov)",
    url: "https://www.justice.gov/eoir/recognition-and-accreditation-program",
  },
];

/** The other two roster PDF reports on the roster-reports page. */
export const EOIR_ROSTER_PDF_REPORTS: { label: string; url: string }[] = [
  {
    label:
      "Recognized Organizations and Accredited Representatives Roster (PDF, justice.gov)",
    url: "https://www.justice.gov/media/1193706/dl?inline",
  },
  {
    label: "Accredited Representatives Roster (PDF, justice.gov)",
    url: "https://www.justice.gov/media/1193716/dl?inline",
  },
];

/** Back-compat: the by-state roster was the single link used before the
 *  3-link fix. Prefer EOIR_ROSTER_LINKS everywhere. */
export const EOIR_ROSTER_URL = EOIR_ROSTER_LINKS[0].url;

// --- Upgraded portal (Nov 19, 2026 wireframe) — EXAMPLE DATA ONLY ---
export const EXAMPLE_USCIS = {
  receiptNumber: "IOE0928374651",
  status: "Case Was Received",
  nextDeadline: "Biometrics Appointment in 14 Days (Dec 3, 2026)",
  note: "EXAMPLE receipt number, status, and date. Live USCIS lookup is NOT built — Sandbox only today, Production key not granted, needs a worker + Production key.",
};

export const EXAMPLE_PRIORITY_ACTIONS = [
  {
    id: "action-gap",
    title: "Fix Date Gap: 5-Year Address History (Missing Jan–Apr 2024)",
    cta: "Resume Questionnaire ->",
    href: "/portal/questionnaire",
  },
  {
    id: "action-bank2",
    title: "Re-Upload: Joint Bank Statement (Blurry)",
    cta: "Snap / Upload",
    href: "/portal",
  },
  {
    id: "action-sign",
    title: "Ready to Sign: Completed Form I-130 Draft",
    cta: "Review & Sign",
    href: "/portal",
  },
];

export const EXAMPLE_SMART_FORMS = [
  { id: "sf-info", label: "Petitioner & Beneficiary Info", pct: 100, state: "Complete" },
  { id: "sf-address", label: "5-Year Address & Work History", pct: 85, state: "1 Gap Found" },
  { id: "sf-marriage", label: "Bona Fide Marriage Questions", pct: 0, state: "Not Started" },
];

export type TranslationStatus =
  | "not_requested"
  | "requested"
  | "in_progress"
  | "received";

export const EXAMPLE_TRANSLATIONS = [
  { id: "tr-birth", label: "Birth Certificate (Foreign)", status: "received" as TranslationStatus, note: "Certified Translation ✓" },
  { id: "tr-marriage", label: "Marriage Certificate (Foreign)", status: "not_requested" as TranslationStatus, note: "Order certified translation — request to a human certified-translation service, not instant auto-translation. No price or provider invented." },
  { id: "tr-photos", label: "Passport Photos (2x2)", status: "not_requested" as TranslationStatus, note: "Upload or Take Selfie ->" },
];

export const EXAMPLE_CHAT_UPGRADED: ChatMessage[] = [
  { id: "msg-sys", sender: "System", time: "", body: "SMS reminder sent to client for missing 2024 address dates. (Nudge logic ready — sending needs Twilio; no message was actually sent in this build.)", mine: false },
  { id: "msg-3", sender: "Jane Doe", time: "10:14 AM", body: "Once you fill in that 3-month gap, your I-130 is ready to sign!", mine: false },
];
