// Email login codes — second factor for EVERY login (migration 0020).
//
// Locked rules (do not weaken):
//   * 6-digit code, 10-minute expiry, ONE use (used_at set on verify).
//   * 3 wrong codes lock the code for 15 minutes (locked_until).
//   * No "remember this device": nothing persistent is stored and no
//     code is ever reused across logins.
//   * Founder/Admin get a code EVERY time — same as everyone else.
//   * The code itself is NEVER stored: only its SHA-256 hash
//     (login_codes.code_hash). A database read leaks no usable code.
//   * Codes are SENT by email (platform AWS SES, src/lib/email.ts —
//     NOT connected yet). Until email is connected the login route
//     returns 501 email_not_configured and no session is created.
//     The code is NEVER returned in an API response.
//
// This file is SERVER-ONLY (API routes). It imports node:crypto, so no
// client component may import it — the login page gets its redirect
// from the /api/auth/verify-code response instead.
import { createHash, randomInt } from "crypto";

export const LOGIN_CODE_LENGTH = 6;
export const LOGIN_CODE_TTL_MINUTES = 10;
export const LOGIN_CODE_MAX_WRONG = 3;
export const LOGIN_CODE_LOCK_MINUTES = 15;

/** A 6-digit code as a string, "100000"–"999999" (never leading-zero). */
export function generateLoginCode(): string {
  // randomInt is uniform; 900000 values, first digit never 0.
  return String(randomInt(100000, 1000000));
}

/** SHA-256 hex of a code. Stored in login_codes.code_hash. */
export function hashLoginCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export function loginCodeExpiresAt(issuedAt: Date = new Date()): Date {
  return new Date(issuedAt.getTime() + LOGIN_CODE_TTL_MINUTES * 60_000);
}

export function loginCodeLockedUntil(now: Date = new Date()): Date {
  return new Date(now.getTime() + LOGIN_CODE_LOCK_MINUTES * 60_000);
}

export type LoginCodeRow = {
  id: string;
  code_hash: string;
  expires_at: string;
  wrong_attempts: number;
  locked_until: string | null;
  used_at: string | null;
  created_at: string;
};

/** Why a code cannot be verified right now, if anything. */
export function loginCodeBlockReason(
  row: LoginCodeRow,
  now: Date = new Date()
): "used" | "expired" | "locked" | null {
  if (row.used_at) return "used";
  if (new Date(row.expires_at).getTime() <= now.getTime()) return "expired";
  if (row.locked_until && new Date(row.locked_until).getTime() > now.getTime())
    return "locked";
  return null;
}

/** Seconds until a lock lifts (0 when not locked). */
export function loginCodeLockSecondsLeft(
  row: LoginCodeRow,
  now: Date = new Date()
): number {
  if (!row.locked_until) return 0;
  return Math.max(
    0,
    Math.ceil((new Date(row.locked_until).getTime() - now.getTime()) / 1000)
  );
}

/** Where a role lands after login. Teacher has its own dashboard
 *  (/teacher-dashboard — confirm students); Founder/Admin land on the
 *  verification queue. */
export function redirectAfterLogin(role: string): string {
  switch (role) {
    case "client":
      return "/portal";
    case "preparer":
      return "/preparer-dashboard";
    case "attorney":
    case "nonprofit":
    case "law_student":
      return "/legal-back-office";
    case "teacher":
      return "/teacher-dashboard";
    case "founder":
    case "admin":
      return "/admin/verifications";
    default:
      return "/portal";
  }
}
