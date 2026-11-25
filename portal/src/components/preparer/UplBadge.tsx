// UPL badge + "Get an attorney" buttons — shared by every preparer view.
// A Document Preparer is CLERICAL ONLY: never legal advice, never G-28,
// never EOIR-28, never representation, never legal strategy, never an
// RFE/NOID legal brief. The badge below must appear on every preparer
// surface; the buttons appear wherever a case needs legal help — they
// warn and refer, they NEVER lock the client out of their own case.
"use client";

export const UPL_BADGE_TEXT =
  "Non-attorney clerical prep only. No legal advice or G-28.";

export const DOJ_ROSTER_URL =
  "https://www.justice.gov/eoir/recognized-organizations-and-accredited-representatives-roster-by-state";

export function UplBadge() {
  return (
    <p
      role="note"
      className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"
    >
      {UPL_BADGE_TEXT}
    </p>
  );
}

export function GetAnAttorneyButtons({
  reason,
}: {
  /** Short plain-language reason, e.g. "I-601 waiver". Shown, never a lock. */
  reason?: string;
}) {
  return (
    <div className="rounded border border-red-300 bg-red-50 p-3">
      <p className="text-sm font-semibold text-red-900">
        Get an attorney — an attorney can protect you as the document
        preparer.
      </p>
      {reason && (
        <p className="mt-1 text-sm text-red-800">
          This case involves {reason}. A document preparer must not give
          legal advice or write a legal response for it. The client is NOT
          locked out — they keep full access to their case and documents.
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href="/legal-back-office"
          className="rounded bg-red-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-800"
        >
          Find Attorney
        </a>
        <a
          href={DOJ_ROSTER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-red-700 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100"
        >
          Find a DOJ-Accredited Representative
        </a>
      </div>
      <p className="mt-2 text-xs text-red-800">
        Attorneys and DOJ representatives in the directory are opt-in only
        and bar / DOJ verified. No per-lead or percentage fees are ever
        charged for a referral.
      </p>
    </div>
  );
}
