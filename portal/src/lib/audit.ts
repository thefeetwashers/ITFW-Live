// Pre-Filing Packet Audit & Readiness Score (Build C)
// Rules: missing signature, expired passport, untranslated foreign
// document, missing document, incomplete form section.
// Score = earned weight / total weight * 100. Filing cannot be marked
// ready until score = 100 AND every blocking item is cleared.
// This is a checklist calculation, not a legal determination.
export type AuditCheckStatus = "pass" | "fail" | "warning";

export interface AuditItem {
  id: string;
  rule:
    | "missing_signature"
    | "expired_passport"
    | "untranslated_foreign_document"
    | "missing_document"
    | "incomplete_form_section";
  label: string;
  weight: number;
  status: AuditCheckStatus;
  blocking: boolean;
  detail?: string;
}

export function computePacketReadiness(items: AuditItem[]): {
  score: number;
  totalWeight: number;
  earnedWeight: number;
  blockingItems: AuditItem[];
  readyToFile: boolean;
} {
  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  const earnedWeight = items
    .filter((i) => i.status === "pass")
    .reduce((s, i) => s + i.weight, 0);
  const score = totalWeight === 0 ? 0 : Math.round((earnedWeight / totalWeight) * 100);
  const blockingItems = items.filter((i) => i.blocking && i.status !== "pass");
  return {
    score,
    totalWeight,
    earnedWeight,
    blockingItems,
    readyToFile: score === 100 && blockingItems.length === 0,
  };
}

// How the example 88% is derived: weights sum to 100, passed = 88.
// Blocking fails: 5-year address gap (6) + blurry bank statement (6) = 12.
export const EXAMPLE_AUDIT_ITEMS: AuditItem[] = [
  { id: "a-sig", rule: "missing_signature", label: "I-130 draft signed", weight: 10, status: "pass", blocking: true },
  { id: "a-passport", rule: "expired_passport", label: "Petitioner passport not expired", weight: 10, status: "pass", blocking: true },
  { id: "a-passport-ben", rule: "expired_passport", label: "Beneficiary passport not expired", weight: 10, status: "pass", blocking: true },
  { id: "a-birth-trans", rule: "untranslated_foreign_document", label: "Foreign birth certificate + certified translation", weight: 12, status: "pass", blocking: true },
  { id: "a-marriage-trans", rule: "untranslated_foreign_document", label: "Marriage certificate + certified translation", weight: 12, status: "pass", blocking: true },
  { id: "a-docs", rule: "missing_document", label: "All required documents present", weight: 12, status: "pass", blocking: true },
  { id: "a-bank", rule: "missing_document", label: "Joint bank statement readable (last 3 months)", weight: 6, status: "fail", blocking: true, detail: "Previous upload was blurry." },
  { id: "a-address", rule: "incomplete_form_section", label: "5-year address & work history complete", weight: 6, status: "fail", blocking: true, detail: "Missing Jan–Apr 2024." },
  { id: "a-marriage-q", rule: "incomplete_form_section", label: "Bona fide marriage questions complete", weight: 0, status: "warning", blocking: false, detail: "Not Started — open item, unscored (weight 0) and non-blocking until filing; it does not raise the score." },
  { id: "a-sponsor", rule: "missing_document", label: "I-864 sponsor documents present", weight: 12, status: "pass", blocking: true },
  { id: "a-photos", rule: "missing_document", label: "Passport photos (2x2)", weight: 10, status: "pass", blocking: true },
];
// Worked example: scored weights sum to 100, passed = 88.
// Blocking fails: 5-year address gap (6) + blurry bank statement (6) = 12.
// The marriage-questions row is weight 0, so it is listed as open
// without inflating the score.
