// Packet Rescue, Free Check First — Immigration with NIPTEI
// (Nov 28, 2026). Founder-approved standout feature #3.
//
// WHAT ALREADY EXISTED (reused, not rebuilt):
//   * src/lib/audit.ts — computePacketReadiness(): score = earned /
//     total weight, readyToFile ONLY when score = 100 AND every
//     blocking item is cleared. EXAMPLE_AUDIT_ITEMS (88%, two blocking
//     fails). This file does NOT re-implement the audit.
//   * Locked price: Packet Rescue $199 — src/lib/storefront.ts
//     LOCKED_ADDONS ("Packet Rescue", 19900) and src/lib/
//     stripePrices.ts key "addon_packet_rescue",
//     price_1UfS8YPfd9SRUcvhDBkEUJW2, $199.00 one-time. Never changed.
//   * Pay-before-access: src/lib/paywall.ts decidePaidAccess() —
//     access is decided server-side against Stripe records in the
//     database (invoices status 'paid'), never by a front-end flag.
//     This file adds the "packet_rescue_fix" surface to that same
//     gate (see paywall.ts) instead of inventing a second gate.
//
// HOW IT WORKS:
//   1. FREE audit: the client uploads a packet prepared elsewhere.
//      runFreePacketAudit() runs the existing audit engine and shows
//      EXACTLY what is missing or wrong (every failing / warning item,
//      with its detail). The audit is free and it never unlocks the
//      paid fix: the result always carries paidFixUnlocked: false.
//   2. PAID fix: Packet Rescue $199, via the existing checkout /
//      webhook. decidePacketRescueFixAccess() allows the fix ONLY when
//      a paid invoice for the Packet Rescue price exists in the
//      database (packetRescuePaidInvoiceCount > 0). A free audit, a
//      front-end flag, or a checkout that has not confirmed in the
//      database never unlocks it.
//   3. READY RULE: the free audit NEVER claims a packet is ready to
//      file unless the audit is 100% AND all blocking items are
//      cleared (audit.ts readyToFile). Anything less is "Not ready to
//      file" with the open items listed.
//
// This is a checklist calculation, not a legal determination. Only a
// licensed attorney or DOJ-accredited representative gives legal
// advice (8 CFR 292.1). The system never files for the client; the
// user must review and sign before anything is submitted.
import {
  computePacketReadiness,
  type AuditItem,
} from "./audit";
import { getLockedPriceByKey } from "./stripePrices";

/** Locked Stripe price key for the paid Packet Rescue fix. */
export const PACKET_RESCUE_PRICE_KEY = "addon_packet_rescue";

/** Locked Packet Rescue price ($199 one-time). Undefined only if the
 *  locked map lost the key — in which case the fix must NOT be sold
 *  (decidePacketRescueFixAccess denies with "price not configured"). */
export const PACKET_RESCUE_LOCKED_PRICE = getLockedPriceByKey(
  PACKET_RESCUE_PRICE_KEY
);

export const PACKET_RESCUE_PRICE_CENTS = 19900;
export const PACKET_RESCUE_PRICE_LABEL = "Packet Rescue — $199";

/** Paywall surface for the paid fix (added to src/lib/paywall.ts). */
export const PACKET_RESCUE_SURFACE = "packet_rescue_fix" as const;

export type PacketRescueVerdict = "ready_to_file" | "not_ready_to_file";

export interface FreePacketAuditResult {
  /** The audit is always free. */
  free: true;
  /** The free audit NEVER unlocks the paid fix. Always false here. */
  paidFixUnlocked: false;
  score: number;
  totalWeight: number;
  earnedWeight: number;
  blockingItems: AuditItem[];
  failingItems: AuditItem[];
  warningItems: AuditItem[];
  readyToFile: boolean;
  verdict: PacketRescueVerdict;
  /** Plain-English verdict — never claims ready unless readyToFile. */
  verdictText: string;
  /** The paid fix offer: locked $199, pay-first, DB-confirmed. */
  fixOffer: {
    label: string;
    priceCents: number;
    priceKey: string;
    priceId: string | null;
    note: string;
  };
}

/**
 * Run the FREE pre-filing audit on a packet prepared elsewhere.
 * Delegates scoring to src/lib/audit.ts computePacketReadiness().
 * The result lists exactly what is missing or wrong and states the
 * verdict honestly: "ready to file" appears ONLY when the audit is
 * 100% and every blocking item is cleared.
 */
export function runFreePacketAudit(items: AuditItem[]): FreePacketAuditResult {
  const readiness = computePacketReadiness(items);
  const failingItems = items.filter((i) => i.status === "fail");
  const warningItems = items.filter((i) => i.status === "warning");
  const readyToFile = readiness.readyToFile;
  return {
    free: true,
    paidFixUnlocked: false,
    score: readiness.score,
    totalWeight: readiness.totalWeight,
    earnedWeight: readiness.earnedWeight,
    blockingItems: readiness.blockingItems,
    failingItems,
    warningItems,
    readyToFile,
    verdict: readyToFile ? "ready_to_file" : "not_ready_to_file",
    verdictText: readyToFile
      ? "Ready to file — the audit is 100% and all blocking items are cleared. This is a checklist result, not a legal determination: review and sign before anything is submitted."
      : `Not ready to file — audit ${readiness.score}%, ${readiness.blockingItems.length} blocking item${readiness.blockingItems.length === 1 ? "" : "s"} still open. Fix the items listed below, then run the audit again.`,
    fixOffer: {
      label: PACKET_RESCUE_PRICE_LABEL,
      priceCents: PACKET_RESCUE_PRICE_CENTS,
      priceKey: PACKET_RESCUE_PRICE_KEY,
      priceId: PACKET_RESCUE_LOCKED_PRICE?.priceId ?? null,
      note: "Paid fix — $199 flat. Pay first through checkout; the fix unlocks only after Stripe confirms the payment in our records (webhook writes the paid invoice). The free audit above never unlocks it.",
    },
  };
}

// ---------------------------------------------------------------------------
// Paid-fix gate — DB-confirmed payment only, never a front-end flag.
// ---------------------------------------------------------------------------

export interface PacketRescueFixEvidence {
  /** Number of invoices rows with status 'paid' for this account AND
   *  this Packet Rescue price (read server-side from the database by
   *  the API route — never from the client). */
  packetRescuePaidInvoiceCount: number;
}

export interface PacketRescueFixDecision {
  allowed: boolean;
  reason: string;
  unlockPriceKey: string;
  unlockLabel: string;
  unlockPriceId: string | null;
}

/**
 * Decide whether the paid Packet Rescue fix is unlocked. Allowed ONLY
 * when a paid invoice for the locked $199 Packet Rescue price exists
 * in the database. A free audit (paidFixUnlocked is always false), an
 * unpaid checkout, or a client-side claim never unlocks it.
 */
export function decidePacketRescueFixAccess(
  evidence: PacketRescueFixEvidence
): PacketRescueFixDecision {
  const base = {
    unlockPriceKey: PACKET_RESCUE_PRICE_KEY,
    unlockLabel: PACKET_RESCUE_PRICE_LABEL,
    unlockPriceId: PACKET_RESCUE_LOCKED_PRICE?.priceId ?? null,
  };
  if (!PACKET_RESCUE_LOCKED_PRICE) {
    return {
      ...base,
      allowed: false,
      reason:
        "Packet Rescue cannot be sold right now — its locked $199 Stripe price is not configured. Do not charge anything until the price is restored.",
    };
  }
  if (evidence.packetRescuePaidInvoiceCount > 0) {
    return {
      ...base,
      allowed: true,
      reason: `Paid Packet Rescue invoice on file (${evidence.packetRescuePaidInvoiceCount} paid). The fix is unlocked.`,
    };
  }
  return {
    ...base,
    allowed: false,
    reason:
      "The paid fix is locked — pay $199 first through checkout. The free audit does not unlock it, and nothing is unlocked until the payment is confirmed in our records.",
  };
}
