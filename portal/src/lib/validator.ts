// 5-Year Address / Employment Gap Validator (Build A + Founder check #1)
// Clients cannot submit an incomplete timeline. Contiguous date coverage
// is required for the 5 years before filing; gaps are red alerts.
// Save-and-resume is allowed (draft entries are stored); SUBMIT is blocked
// until every gap is closed. No AI, no eligibility decision here —
// this is date arithmetic only.
export interface TimelineEntry {
  id: string;
  kind: "address" | "employment";
  label: string;
  start: string; // YYYY-MM-DD
  end: string | null; // null = present / still there
}

export interface TimelineGap {
  kind: "address" | "employment";
  gapStart: string;
  gapEnd: string;
  label: string; // e.g. "Missing Jan–Apr 2024"
}

function toDate(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}
function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function findGaps(
  entries: TimelineEntry[],
  kind: "address" | "employment",
  asOf: Date = new Date()
): TimelineGap[] {
  const windowStart = new Date(asOf);
  windowStart.setUTCFullYear(windowStart.getUTCFullYear() - 5);
  const rows = entries
    .filter((e) => e.kind === kind)
    .map((e) => ({ start: toDate(e.start), end: e.end ? toDate(e.end) : asOf }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const gaps: TimelineGap[] = [];
  let cursor = windowStart;
  for (const r of rows) {
    if (r.start > cursor) {
      const gapEnd = new Date(r.start);
      gapEnd.setUTCDate(gapEnd.getUTCDate() - 1);
      gaps.push({
        kind,
        gapStart: fmt(cursor),
        gapEnd: fmt(gapEnd),
        label: `Missing ${monthLabel(cursor)}–${monthLabel(gapEnd)}`,
      });
    }
    if (r.end >= cursor) {
      const next = new Date(r.end);
      next.setUTCDate(next.getUTCDate() + 1);
      if (next > cursor) cursor = next;
    }
    if (cursor > asOf) break;
  }
  if (cursor <= asOf) {
    gaps.push({
      kind,
      gapStart: fmt(cursor),
      gapEnd: fmt(asOf),
      label: `Missing ${monthLabel(cursor)}–${monthLabel(asOf)}`,
    });
  }
  return gaps;
}

export function validateTimeline(
  entries: TimelineEntry[],
  asOf: Date = new Date()
): { ok: boolean; gaps: TimelineGap[]; coveragePercent: number } {
  const gaps = [...findGaps(entries, "address", asOf), ...findGaps(entries, "employment", asOf)];
  const windowDays = 5 * 365.25 * 2; // address + employment windows
  const gapDays = gaps.reduce(
    (sum, g) =>
      sum +
      Math.round(
        (toDate(g.gapEnd).getTime() - toDate(g.gapStart).getTime()) / 86400000 + 1
      ),
    0
  );
  const coveragePercent = Math.max(
    0,
    Math.round(((windowDays - gapDays) / windowDays) * 100)
  );
  return { ok: gaps.length === 0, gaps, coveragePercent };
}

// Example timeline with the founder's gap: Jan–Apr 2024 missing.
export const EXAMPLE_TIMELINE: TimelineEntry[] = [
  { id: "addr-1", kind: "address", label: "123 Main St, Fort Pierce, FL", start: "2021-11-19", end: "2023-12-31" },
  { id: "addr-2", kind: "address", label: "456 Oak Ave, Fort Pierce, FL", start: "2024-05-01", end: null },
  { id: "emp-1", kind: "employment", label: "Example Employer (example)", start: "2021-11-19", end: null },
];
