// Real reviews only — migration 0017 (reviews table).
//
// Rules (enforced in the database by the reviews_enforce_moderation
// trigger, and repeated here so the UI never shows anything else):
//  * A client may leave a review ONLY after a real case/order, with
//    their permission (consent_given), tied to the professional they
//    used (professional_account_id) and the real service + real date.
//  * The professional may REPLY only — never edit or delete the
//    client's review (rating, text, name, service, consent).
//  * A founder/admin may HIDE a review only with a reason, logged to
//    audit_log. There is no delete.
//  * NEVER invent a review, a rating, a count, or a testimonial.
//    With no real rows the UI shows exactly:
//    "No reviews yet — be our first."
//  * A review is invited only after the case closes (lifecycle stage
//    6, visa_approved_closed — see src/lib/lifecycle.ts).
export const NO_REVIEWS_YET = "No reviews yet — be our first.";
export const REVIEW_STAGE_GATE = "visa_approved_closed";

export type DisplayNameChoice = "full_name" | "first_name_initial";

export interface ReviewRow {
  id: string;
  case_id: string;
  professional_account_id: string;
  client_account_id: string;
  service_form_code: string;
  service_name: string | null;
  rating: number; // 1–5
  body: string;
  consent_given: boolean;
  display_name_choice: DisplayNameChoice;
  display_name: string;
  reply_text: string | null;
  replied_at: string | null;
  replied_by: string | null;
  visible: boolean;
  hidden_by: string | null;
  hidden_reason: string | null;
  hidden_at: string | null;
  created_at: string;
}

/** First name + initial, e.g. "Maria" + "Gonzalez" -> "Maria G." */
export function firstNameInitial(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export function displayNameFor(
  fullName: string,
  choice: DisplayNameChoice
): string {
  return choice === "full_name" ? fullName.trim() : firstNameInitial(fullName);
}

/** Only visible, consented reviews are ever shown publicly. */
export function visibleReviews(rows: ReviewRow[]): ReviewRow[] {
  return rows.filter((r) => r.visible && r.consent_given);
}

/** Validation for a new review — the API route uses the same rules. */
export function validateReview(input: {
  caseId?: unknown;
  professionalAccountId?: unknown;
  serviceFormCode?: unknown;
  rating?: unknown;
  body?: unknown;
  displayName?: unknown;
  consentGiven?: unknown;
}): string[] {
  const errors: string[] = [];
  if (typeof input.caseId !== "string" || !input.caseId.trim())
    errors.push("A real case is required — a review can only be left after a real case/order.");
  if (typeof input.professionalAccountId !== "string" || !input.professionalAccountId.trim())
    errors.push("The professional you used is required.");
  if (typeof input.serviceFormCode !== "string" || !input.serviceFormCode.trim())
    errors.push("The real service (form code) is required.");
  if (
    typeof input.rating !== "number" ||
    !Number.isInteger(input.rating) ||
    input.rating < 1 ||
    input.rating > 5
  )
    errors.push("Rating must be a whole number from 1 to 5.");
  if (typeof input.body !== "string" || !input.body.trim())
    errors.push("Tell us how we did — the review text is required.");
  if (typeof input.displayName !== "string" || !input.displayName.trim())
    errors.push("The name to show with the review is required.");
  if (input.consentGiven !== true)
    errors.push("Your permission to show this review is required.");
  return errors;
}
