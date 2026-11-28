// Immigration news alert — popup / alert inside the chat.
// ---------------------------------------------------------------------------
// Shows the built-in news posts (src/lib/immigrationNews.ts) with
// their dates and sources, flags the ones that may affect THIS
// client's case ("This may affect your case — … — source: …"), and
// carries the honest note that no live feed is connected yet.
// Nothing here is live news and no item is invented: when the
// built-in list is empty, the component says so.
//
// Client component: it fetches /api/news?forms=… once, so the chat
// page never needs the case's forms in the page bundle. The popup is
// a plain dismissible banner (role="alert" for the case flags) —
// no live polling, no push, no SMS.
"use client";

import { useEffect, useState } from "react";
import {
  LIVE_NEWS_FEED_STATUS,
  type CaseNewsFlag,
  type NewsItem,
} from "@/lib/immigrationNews";

export default function NewsAlert(props: { caseForms?: string[] }) {
  const caseForms = props.caseForms ?? [];
  const [items, setItems] = useState<NewsItem[]>([]);
  const [flags, setFlags] = useState<CaseNewsFlag[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const query =
      caseForms.length > 0
        ? `?forms=${encodeURIComponent(caseForms.join(","))}`
        : "";
    fetch(`/api/news${query}`)
      .then((res) => res.json())
      .then((data: { items?: NewsItem[]; flags?: CaseNewsFlag[] }) => {
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setFlags(Array.isArray(data.flags) ? data.flags : []);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("Immigration news could not be loaded right now.");
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch only when the case forms change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseForms.join(",")]);

  if (!loaded) return null;
  if (dismissed) return null;
  if (loadError) {
    return (
      <p className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {loadError}
      </p>
    );
  }

  const affecting = flags.filter((f) => f.affectsYourCase);

  return (
    <section
      aria-labelledby="immigration-news-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id="immigration-news-heading" className="text-base font-semibold">
          Immigration news &amp; updates
        </h2>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss immigration news"
          className="rounded border border-slate-300 px-2 py-1 text-xs"
        >
          Dismiss
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {LIVE_NEWS_FEED_STATUS.note}
      </p>

      {affecting.length > 0 && (
        <div role="alert" className="mt-3 space-y-2">
          {affecting.map((f) => (
            <p
              key={f.item.id}
              className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"
            >
              {f.flagText}
            </p>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">
          No immigration news posts yet. When a new official update is
          added, it will appear here with its date and source.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => {
            const flagged = flags.find(
              (f) => f.item.id === item.id && f.affectsYourCase
            );
            return (
              <li key={item.id} className="rounded border border-slate-200 p-3 text-sm">
                <p className="font-semibold">
                  {item.title} — {item.date}
                  {flagged ? (
                    <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      May affect your case
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-slate-700">{item.summary}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Source: {item.sourceLabel} —{" "}
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-700 underline"
                  >
                    {item.sourceUrl}
                  </a>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
