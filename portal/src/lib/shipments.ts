// Physical Mail & USCIS Receipt Proof Vault (Layer 3)
// Carrier tracking is a LINK OUT to the carrier's tracking page +
// a stored tracking number. Do NOT claim a live carrier API pull.
// USCIS notices: dedicated slots for I-797C Receipt, Biometrics,
// RFE, Approval. Countdowns are computed from STORED dates, not
// live USCIS data. RFE deadlines reuse rfe_uploads (0002) where
// possible — this file only adds the vault record + countdown math.
export type Carrier = "USPS" | "FedEx" | "UPS" | "USCIS";
export type NoticeType =
  | "outgoing_packet"
  | "uscis_receipt"
  | "biometrics"
  | "rfe"
  | "approval";

export function carrierTrackingUrl(carrier: Carrier, trackingNumber: string): string | null {
  const n = encodeURIComponent(trackingNumber);
  if (carrier === "USPS") return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
  if (carrier === "FedEx") return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
  if (carrier === "UPS") return `https://www.ups.com/track?tracknum=${n}`;
  return null; // USCIS has no carrier tracking link
}

export function daysUntil(dateIso: string, now: Date = new Date()): number {
  const ms = new Date(dateIso).getTime() - now.getTime();
  return Math.ceil(ms / 86400000);
}

export interface VaultNotice {
  id: string;
  type: NoticeType;
  label: string;
  trackingOrReceiptNumber: string;
  carrier: Carrier;
  deadlineIso?: string;
  deadlineLabel?: string;
}

// Example notices only — no real tracking/receipt numbers.
export const EXAMPLE_NOTICES: VaultNotice[] = [
  {
    id: "notice-1",
    type: "outgoing_packet",
    label: "Final assembled I-130 packet — mailed",
    trackingOrReceiptNumber: "9400 0000 0000 0000 0000 00 (example)",
    carrier: "USPS",
    deadlineLabel: "Delivery signature confirmation on file (photo/PDF of packet)",
  },
  {
    id: "notice-2",
    type: "uscis_receipt",
    label: "Form I-797C Receipt Notice",
    trackingOrReceiptNumber: "IOE0928374651 (example)",
    carrier: "USCIS",
  },
  {
    id: "notice-3",
    type: "biometrics",
    label: "Biometrics Appointment Letter",
    trackingOrReceiptNumber: "IOE0928374651 (example)",
    carrier: "USCIS",
    deadlineIso: "2026-12-03",
    deadlineLabel: "Biometrics appointment",
  },
  {
    id: "notice-4",
    type: "approval",
    label: "EAD Work Permit — renewal countdown",
    trackingOrReceiptNumber: "Example",
    carrier: "USCIS",
    deadlineIso: "2027-05-18",
    deadlineLabel: "EAD Work Permit expires — Start Renewal",
  },
];
