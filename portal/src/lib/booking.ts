// Booking + embassy / medical appointment scheduling.
// Calendar is NOT connected — consultation requests are COLLECTED,
// the professional confirms the time by message, and no calendar
// event is ever created. Never claim a calendar sync.
//
// Consultation prices (locked, from the storefront):
//  * Free 15-minute consultation — $0.
//  * 30-minute consultation — $99. Not legal advice unless it comes
//    from a licensed attorney (preparers give clerical help only).
export const CONSULTATION_FREE_MINUTES = 15;
export const CONSULTATION_30_MIN_CENTS = 9900;
export const CONSULTATION_30_MIN_LABEL =
  "30-minute consultation — $99 (not legal advice unless from a licensed attorney)";

export type ConsultationMode = "phone" | "video" | "in_person";
export type TimePreference = "weekday" | "evening" | "weekend" | "any";
export type BookingDecision = "pending" | "accepted" | "proposed" | "declined";

export const CONSULTATION_MODE_LABEL: Record<ConsultationMode, string> = {
  phone: "Phone",
  video: "Video",
  in_person: "In person",
};

export const TIME_PREFERENCE_LABEL: Record<TimePreference, string> = {
  weekday: "Weekday",
  evening: "Evening",
  weekend: "Weekend",
  any: "Any time",
};

export interface BookingRequest {
  id: string;
  requesterName: string;
  requesterEmail: string | null;
  mode: ConsultationMode;
  lengthMinutes: 15 | 30;
  priceCents: number; // 0 for the free 15-min call, 9900 for 30-min
  preferredTime: string | null;
  timePreference: TimePreference;
  language: string;
  timezone: string;
  decision: BookingDecision;
  proposedTime: string | null;
  declinedReason: string | null;
}

export function bookingPriceCents(lengthMinutes: 15 | 30): number {
  return lengthMinutes === 15 ? 0 : CONSULTATION_30_MIN_CENTS;
}

// --- Consular interview & medical exam appointment card --------------------
// For consular (NVC) cases only. Every date is entered by the
// professional/client or left blank — NO appointment date is invented.
// Reminders 24h + 1h are QUEUED in appointment_reminders (migration
// 0014), never claimed sent (Twilio/Resend NOT connected).
export interface InterviewMedicalAppointment {
  id: string;
  caseId: string;
  embassyPost: string | null; // e.g. "U.S. Embassy, Port-au-Prince" — entered, never guessed
  interviewDate: string | null; // YYYY-MM-DD or null (blank)
  vacAppointment: string | null; // Visa Application Centre appointment, or null
  medicalExamDate: string | null; // Panel-physician medical exam, or null
  panelPhysician: string | null;
}

export const ORIGINAL_DOCUMENTS_BINDER: string[] = [
  "Passport (valid, plus all prior passports)",
  "Birth certificate (+ certified translation if foreign)",
  "Marriage certificate / divorce decrees (+ certified translation if foreign)",
  "Police certificates from every country lived in",
  "Medical exam results (sealed envelope from the panel physician — do not open)",
  "Affidavit of Support (Form I-864) + sponsor tax returns / transcripts",
  "Appointment confirmation letters (interview + VAC + medical exam)",
  "Passport photos (2x2) — as specified in the interview letter",
  "DS-260 confirmation page",
];

export const WHAT_TO_BRING: string[] = [
  ...ORIGINAL_DOCUMENTS_BINDER,
  "The original of every document you uploaded — the officer compares originals to copies",
  "A pen, water, and snacks — interviews can take hours",
  "Do NOT bring large bags, electronics beyond a phone, or food that needs heating — check the embassy's prohibited-items list in your interview letter",
];

export const APPOINTMENT_REMINDER_OFFSETS = [
  { label: "24 hours before", hoursBefore: 24 },
  { label: "1 hour before", hoursBefore: 1 },
] as const;
