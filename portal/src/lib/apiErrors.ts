// Safe database-error messages (full-stack expert sweep, Nov 28, 2026).
//
// Several API routes used to interpolate Supabase's raw error.message
// into the response. That message can name tables, columns, and
// constraints (e.g. "column fee_waiver_checks.threshold_150_cents does
// not exist") — internal schema detail a caller does not need and an
// attacker can use to map the database. It is not a stack trace, but
// it is still a leak. These helpers replace it with an honest,
// generic message and keep the detail server-side only (the caller
// logs it with console.error if they need it; the response never
// carries it).
//
// Rules:
//   * Never return error.message / error.details / error.hint to the
//     caller. The caller gets the fallback plus, when useful, which
//     migration to run — never the raw Postgres text.
//   * Missing-table / missing-column detection must use the Postgres
//     error CODE (42P01 undefined_table, 42703 undefined_column),
//     not a message regex, so it keeps working if Postgres rewords
//     the message.
//   * No PII, no money, no keys in the returned message.

export interface DbErrorLike {
  code?: string;
  message?: string;
}

export function dbErrorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as DbErrorLike).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

/** True when the failure is a table/column that does not exist yet. */
export function isMissingSchemaError(error: unknown): boolean {
  const code = dbErrorCode(error);
  return code === "42P01" || code === "42703";
}

/**
 * Honest, leak-free message for a failed database read/write.
 * `fallback` says what the user tried to do and that nothing was
 * saved/returned; `migrationHint` (e.g. "Migration 0029 may not have
 * run yet") is appended when the caller knows which migration owns
 * the table.
 */
export function safeDbError(
  fallback: string,
  migrationHint?: string,
  error?: unknown
): string {
  const hint =
    migrationHint ??
    (isMissingSchemaError(error)
      ? "The database table for this may not have been created yet."
      : undefined);
  return hint ? `${fallback} ${hint}` : fallback;
}
