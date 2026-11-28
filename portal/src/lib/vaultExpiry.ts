// Document Vault expiry tracking — every uploaded document gets an
// expiry date WHERE ONE APPLIES, and the vault flags what is about
// to expire.
//
// WHICH DOCUMENTS EXPIRE (and which do not):
//   * Passport — expires on the date printed in the passport.
//   * Medical exam (sealed Form I-693) — expires on the date recorded
//     from the exam paperwork by the preparer. This module states NO
//     fixed validity period for the I-693: no such period is locked
//     in this codebase, and USCIS rules on it change — the expiry is
//     whatever date the preparer records from the sealed exam, and
//     the UI says to confirm it with the preparer.
//   * Police clearance — expires on the date recorded from the
//     clearance itself. The issuing country / embassy sets the
//     validity; this module states no fixed period for it either.
//   * Birth certificate translations — DO NOT EXPIRE. A certified
//     translation does not go stale; the vault always reports
//     "never_expires" for it and says so on the dashboard.
//   * Anything else — expiry applies only when an expiry date was
//     recorded for it; otherwise "no_expiry_on_file", never guessed.
//
// Storage: migration 0029 adds documents.expires_on,
// documents.expiry_kind and documents.expiry_note. A document with
// no expires_on is never flagged as expiring — the vault says the
// date is not on file.
//
// Pure module (no Supabase, no secrets). No document numbers,
// A-Numbers, SSNs or passport numbers are ever handled here — only
// the document kind, a label, and the expiry date.
export type VaultDocumentKind =
  | "passport"
  | "medical_exam"
  | "police_clearance"
  | "birth_certificate_translation"
  | "other";

export const VAULT_DOCUMENT_KIND_LABEL: Record<VaultDocumentKind, string> = {
  passport: "Passport",
  medical_exam: "Medical exam (sealed Form I-693)",
  police_clearance: "Police clearance",
  birth_certificate_translation: "Birth certificate translation",
  other: "Other document",
};

/** A document is flagged "expiring soon" when it expires within this many days. */
export const VAULT_EXPIRING_SOON_DAYS = 90;

export const VAULT_TRANSLATION_NEVER_EXPIRES =
  "Birth certificate translations do not expire — a certified translation does not go stale.";

export const VAULT_EXPIRY_SOURCE_NOTE =
  "Expiry dates are the dates recorded in the vault from the document itself (passport) or from the exam / clearance paperwork (medical exam, police clearance). No expiry date is ever guessed: a document with no date on file is listed as \"no expiry date on file\".";

export interface VaultDocumentInput {
  id: string;
  caseId: string;
  /** Client label shown to professionals (a name or case label —
   *  never an A-Number, SSN, DOB or passport number). */
  clientLabel?: string | null;
  kind: VaultDocumentKind;
  /** File label as stored (e.g. "Passport — bio page"). */
  label: string;
  /** Expiry date YYYY-MM-DD as recorded in the vault. Null = none on file. */
  expiresOn: string | null;
}

export type VaultExpiryStatus =
  | "never_expires"
  | "no_expiry_on_file"
  | "expired"
  | "expiring_soon"
  | "ok";

export interface VaultDocumentDerived extends VaultDocumentInput {
  status: VaultExpiryStatus;
  daysUntilExpiry: number | null;
  statusLabel: string;
}

function daysBetween(dateIso: string, now: Date): number {
  const due = new Date(`${dateIso}T12:00:00Z`);
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12)
  );
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

/** Derive one document's expiry status. Translations never expire. */
export function deriveVaultExpiry(
  input: VaultDocumentInput,
  now: Date = new Date()
): VaultDocumentDerived {
  if (input.kind === "birth_certificate_translation") {
    return {
      ...input,
      status: "never_expires",
      daysUntilExpiry: null,
      statusLabel: "Does not expire — translations do not expire.",
    };
  }
  if (!input.expiresOn) {
    return {
      ...input,
      status: "no_expiry_on_file",
      daysUntilExpiry: null,
      statusLabel: "No expiry date on file — add the date from the document.",
    };
  }
  const days = daysBetween(input.expiresOn, now);
  if (days < 0) {
    return {
      ...input,
      status: "expired",
      daysUntilExpiry: days,
      statusLabel: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago — replace this document.`,
    };
  }
  if (days <= VAULT_EXPIRING_SOON_DAYS) {
    return {
      ...input,
      status: "expiring_soon",
      daysUntilExpiry: days,
      statusLabel: `Expiring soon — ${days} day${days === 1 ? "" : "s"} left.`,
    };
  }
  return {
    ...input,
    status: "ok",
    daysUntilExpiry: days,
    statusLabel: `OK — ${days} days left.`,
  };
}

export function deriveVaultExpiries(
  inputs: VaultDocumentInput[],
  now: Date = new Date()
): VaultDocumentDerived[] {
  return inputs
    .map((d) => deriveVaultExpiry(d, now))
    .sort((a, b) => {
      // Expiring / expired first, soonest first; never-expires last.
      const rank = (d: VaultDocumentDerived): number =>
        d.status === "expired"
          ? 0
          : d.status === "expiring_soon"
            ? 1
            : d.status === "no_expiry_on_file"
              ? 2
              : d.status === "ok"
                ? 3
                : 4;
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      if (a.daysUntilExpiry === null || b.daysUntilExpiry === null) return 0;
      return a.daysUntilExpiry - b.daysUntilExpiry;
    });
}

/** Documents that need attention: expired or expiring soon. */
export function vaultFlagsNeedingAttention(
  inputs: VaultDocumentInput[],
  now: Date = new Date()
): VaultDocumentDerived[] {
  return deriveVaultExpiries(inputs, now).filter(
    (d) => d.status === "expired" || d.status === "expiring_soon"
  );
}
