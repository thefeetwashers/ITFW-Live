// Form-catalog audit — 105 vs 107 (Nov 19, 2026).
//
// Source audited: the static site's form directory in
// ~/workspace/itfw-live/index.html — the PRICED array (35 entries) +
// the QUOTED array (72 entries) = 107 directory entries. This portal
// does NOT edit that file (live static v33 — separate builder), and
// does NOT claim the static site is fixed.
//
// Finding: 2 of the 107 entries are NOT standalone forms — they are
// supplements filed WITH Form I-485:
//   * "I-485 Supplement A"  * "I-485 Supplement J"
// So the honest standalone-form count is 105. No 2 forms were
// invented to reach 107, and no form was removed to reach 105.
// The 2 supplements are listed below (CATALOG_SUPPLEMENT_ENTRIES)
// so the 107-entry directory is fully accounted for.
//
// The portal's own ServiceCatalog (src/components/portal/ServiceCatalog.tsx)
// lists only 9 bundles / 17 form codes with full checklists
// (src/lib/formChecklists.ts) — it never claimed 107. The count below
// is the full-directory audit, shown in the catalog so the number is
// honest everywhere in the portal.
//
// Founder decision (see DEPLOY.md §13): confirm the 2 supplements
// stay counted as directory entries (107) or relabel the static site
// to 105 standalone forms. Until then the portal shows 105 with this
// note, and never shows 107 as a standalone-form count.
export const CATALOG_DIRECTORY_ENTRIES = 107;
export const CATALOG_STANDALONE_FORM_COUNT = 105;
export const CATALOG_PRICED_COUNT = 35;
export const CATALOG_QUOTED_COUNT = 72;

export const CATALOG_SUPPLEMENT_ENTRIES = [
  "I-485 Supplement A",
  "I-485 Supplement J",
] as const;

export const CATALOG_FORM_CODES: string[] = [
  "I-485",
  "I-130",
  "I-130A",
  "I-765",
  "I-131",
  "I-864",
  "I-864A",
  "I-90",
  "I-539",
  "N-400",
  "I-751",
  "I-129F",
  "I-821",
  "I-821D",
  "I-589",
  "I-601",
  "I-601A",
  "I-212",
  "AR-11",
  "G-639",
  "I-134",
  "I-134A",
  "N-565",
  "I-129",
  "I-140",
  "I-360",
  "I-290B",
  "I-824",
  "I-102",
  "I-730",
  "I-912",
  "N-600",
  "G-325R",
  "I-526E",
  "I-693",
  "EOIR-29",
  "G-28",
  "G-28I",
  "G-325A",
  "G-845",
  "G-884",
  "G-1041",
  "G-1041A",
  "G-1055",
  "G-1145",
  "G-1256",
  "G-1566",
  "G-1650",
  "G-1651",
  "I-9",
  "I-129CW",
  "I-129CWR",
  "I-129S",
  "I-131A",
  "I-191",
  "I-192",
  "I-193",
  "I-356",
  "I-361",
  "I-363",
  "I-407",
  "I-508",
  "I-526",
  "I-566",
  "I-600",
  "I-600A",
  "I-602",
  "I-612",
  "I-687",
  "I-690",
  "I-694",
  "I-698",
  "I-765V",
  "I-800",
  "I-800A",
  "I-817",
  "I-829",
  "I-854",
  "I-864EZ",
  "I-864P",
  "I-865",
  "I-881",
  "I-905",
  "I-907",
  "I-910",
  "I-914",
  "I-918",
  "I-929",
  "I-941",
  "I-945",
  "I-956",
  "I-956F",
  "I-956G",
  "I-956H",
  "I-956K",
  "N-300",
  "N-336",
  "N-426",
  "N-470",
  "N-600K",
  "N-644",
  "N-648",
  "G-1450",
  "I-140G",
  "I-912P"
];

export const CATALOG_COUNT_NOTE =
  "105 forms listed — 2 more directory entries (I-485 Supplement A and I-485 Supplement J) are supplements filed with Form I-485, not standalone forms, so they are not counted in the 105. The static site's \"All 107 Forms\" label counts them; that label is not fixed in this portal build — see DEPLOY.md §13.";
