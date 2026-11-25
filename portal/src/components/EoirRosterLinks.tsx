// Shared EOIR roster links — the FULL 3-link version, used everywhere
// in the portal (back office, legal back office, verification queue,
// public storefront). Never a bare single "EOIR roster" link.
// Links checked Nov 14, 2026 (see src/lib/example-data.ts).
import { EOIR_ROSTER_LINKS, EOIR_ROSTER_PDF_REPORTS } from "@/lib/example-data";

export default function EoirRosterLinks({ compact = false }: { compact?: boolean }) {
  return (
    <div>
      <p className="text-sm">
        Official EOIR roster of recognized organizations and accredited
        representatives — check all three official links before approving
        any DOJ credential:
      </p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {EOIR_ROSTER_LINKS.map((link) => (
          <li key={link.url}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-blue-700 underline"
            >
              {link.label} (opens in a new tab)
            </a>
          </li>
        ))}
      </ul>
      {!compact && (
        <>
          <p className="mt-2 text-sm">
            Also — the other two roster PDF reports on the same
            roster-reports page:
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {EOIR_ROSTER_PDF_REPORTS.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-blue-700 underline"
                >
                  {link.label} (opens in a new tab)
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Florida tip: in the by-state roster PDF, press Ctrl+F (Windows) or
        Cmd+F (Mac) and type “Florida” to jump to the Florida listings.
        Links checked Nov 14, 2026; the R&amp;A Program page link was
        corrected Nov 20, 2026 (the old URL returned 404).
      </p>
    </div>
  );
}
