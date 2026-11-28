// Immigration Journey Map — the client's one-page living map.
// Renders a JourneyMap built by src/lib/journeyMap.ts from real stored
// case data, or the honest empty state when there is no case. Headings
// render bilingually (English original always shown; locked translation
// where one exists, otherwise "Translation pending — shown in English").
// Sharing is via the existing family invite system only — this
// component creates no public link to a private case.
import Link from "next/link";
import {
  JOURNEY_MAP_EMPTY_STATE,
  JOURNEY_MAP_NO_INTERVIEW_DATE,
  JOURNEY_MAP_NO_MISSING_ITEMS,
  JOURNEY_MAP_SHARE_NOTE,
  journeyMapHeadings,
  type JourneyMap,
} from "@/lib/journeyMap";
import type { LanguageCode } from "@/lib/i18n";

const STATE_LABEL: Record<string, string> = {
  done: "Done — recorded in your file",
  current: "You are here",
  upcoming: "Coming next — no date promised",
  not_recorded: "Not recorded yet",
};

export default function JourneyMap({
  map,
  lang = "en",
}: {
  map: JourneyMap | null;
  lang?: LanguageCode;
}) {
  const headings = journeyMapHeadings(lang);
  const heading = (id: string) => headings.find((h) => h.id === id);

  if (!map) {
    return (
      <section
        aria-labelledby="journey-map-heading"
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 id="journey-map-heading" className="text-base font-semibold">
          Your Immigration Journey Map
        </h2>
        <p className="mt-2 text-sm text-slate-600">{JOURNEY_MAP_EMPTY_STATE}</p>
        <Link
          href="/portal"
          className="mt-3 inline-block rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
        >
          Open the Client Portal →
        </Link>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="journey-map-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="journey-map-heading" className="text-base font-semibold">
        Your Immigration Journey Map
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        One page, your whole journey — from your first question to the
        green card in hand. Everything below comes from your real case
        file. No milestone is shown as done unless it is recorded, and no
        date is ever promised.
      </p>

      <div className="mt-4 space-y-4 text-sm">
        <div>
          <h3 className="font-semibold">
            {heading("started")?.text.english}
            {heading("started")?.text.translated &&
              heading("started")?.text.language !== "en" && (
                <span className="block font-normal text-slate-600">
                  {heading("started")?.text.translated}
                </span>
              )}
          </h3>
          <p className="mt-1 text-slate-700">{map.whereStarted}</p>
        </div>

        <div>
          <h3 className="font-semibold">
            {heading("now")?.text.english}
            {heading("now")?.text.translated &&
              heading("now")?.text.language !== "en" && (
                <span className="block font-normal text-slate-600">
                  {heading("now")?.text.translated}
                </span>
              )}
          </h3>
          <p className="mt-1 text-slate-700">
            {map.currentStageLabel ? `${map.currentStageLabel}. ` : ""}
            {map.whereNow}
          </p>
        </div>

        <div>
          <h3 className="font-semibold">
            {heading("next")?.text.english}
            {heading("next")?.text.translated &&
              heading("next")?.text.language !== "en" && (
                <span className="block font-normal text-slate-600">
                  {heading("next")?.text.translated}
                </span>
              )}
          </h3>
          <p className="mt-1 text-slate-700">{map.whatIsNext}</p>
        </div>

        <div>
          <h3 className="font-semibold">
            {heading("missing")?.text.english}
            {heading("missing")?.text.translated &&
              heading("missing")?.text.language !== "en" && (
                <span className="block font-normal text-slate-600">
                  {heading("missing")?.text.translated}
                </span>
              )}
          </h3>
          {map.missingItems.length === 0 ? (
            <p className="mt-1 text-slate-700">{JOURNEY_MAP_NO_MISSING_ITEMS}</p>
          ) : (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
              {map.missingItems.map((item) => (
                <li key={item.id}>{item.label}</li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="font-semibold">
            {heading("interview")?.text.english}
            {heading("interview")?.text.translated &&
              heading("interview")?.text.language !== "en" && (
                <span className="block font-normal text-slate-600">
                  {heading("interview")?.text.translated}
                </span>
              )}
          </h3>
          <p className="mt-1 text-slate-700">
            {map.interviewDate
              ? `Your interview date, from your interview letter: ${map.interviewDate.slice(0, 10)}. Go to the medical exam before the interview, as the letter instructs, and bring the originals of every document you uploaded.`
              : JOURNEY_MAP_NO_INTERVIEW_DATE}
          </p>
        </div>

        <div>
          <h3 className="font-semibold">
            {heading("green-card")?.text.english}
            {heading("green-card")?.text.translated &&
              heading("green-card")?.text.language !== "en" && (
                <span className="block font-normal text-slate-600">
                  {heading("green-card")?.text.translated}
                </span>
              )}
          </h3>
          <p className="mt-1 text-slate-700">{map.greenCardLine}</p>
          <p className="mt-1 text-slate-700">
            USCIS Immigrant Fee ($235, paid before flying):{" "}
            {map.immigrantFeePaid ? "paid." : "not recorded as paid yet."}
          </p>
        </div>
      </div>

      <ol className="mt-5 space-y-2">
        {map.steps.map((s) => (
          <li
            key={s.step.id}
            className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          >
            <p className="font-semibold">
              Step {s.step.position} — {s.step.title}
            </p>
            <p className="text-slate-700">{s.step.detail}</p>
            <p className="mt-1 text-xs text-slate-500">
              {STATE_LABEL[s.state]}
              {s.recordedAt ? ` — recorded ${s.recordedAt.slice(0, 10)}` : ""}
              {s.step.lockedRange ? ` · ${s.step.lockedRange}` : ""}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-5 rounded border border-amber-300 bg-amber-50 px-3 py-2">
        <h3 className="text-sm font-semibold">
          {heading("share")?.text.english}
        </h3>
        <p className="mt-1 text-sm text-amber-900">{JOURNEY_MAP_SHARE_NOTE}</p>
        <Link
          href="/family-case"
          className="mt-2 inline-block text-sm font-semibold text-blue-700 underline"
        >
          Open Family Invite →
        </Link>
        {map.familyMemberCount > 0 && (
          <p className="mt-1 text-xs text-slate-600">
            {map.familyMemberCount} family member
            {map.familyMemberCount === 1 ? "" : "s"} invited to this case.
          </p>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        <Link href="/journey" className="underline">
          The full journey — first question to green card in hand →
        </Link>{" "}
        ·{" "}
        <Link href="/today" className="underline">
          Today →
        </Link>
      </p>
    </section>
  );
}
