export type Role =
  | "client"
  | "preparer"
  | "attorney"
  | "nonprofit"
  | "law_student"
  | "teacher"
  | "founder";

export type OnboardingStatus =
  | "role_selected"
  | "profile_completed"
  | "pending_verification"
  | "active";

export type VerificationStatus =
  | "not_required"
  | "pending"
  | "verified"
  | "rejected"
  | "expired";

export type CaseStatus =
  | "intake"
  | "documents_pending"
  | "in_preparation"
  | "ready_to_sign"
  | "filed"
  | "uscis_pending"
  | "rfe"
  | "interview"
  | "approved"
  | "denied"
  | "closed";

// Portal progress steps, in the founder's diagram order.
export const PORTAL_STEPS = ["Intake", "Docs", "Drafting", "Sign", "Filed"] as const;

export type DocumentReviewStatus =
  | "uploaded"
  | "under_review"
  | "accepted"
  | "retake_requested";

export interface ChecklistItem {
  id: string;
  label: string;
  status: DocumentReviewStatus;
  note?: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  time: string;
  body: string;
  mine: boolean;
}

export interface ProviderBadge {
  kind: "preparer" | "attorney" | "nonprofit";
  label: string;
}
