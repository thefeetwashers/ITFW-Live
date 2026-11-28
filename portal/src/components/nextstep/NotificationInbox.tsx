// NotificationInbox — one inbox for every status / email / message event.
//
// Reads GET /api/notifications (stored rows only: notification_logs +
// messages for the signed-in caller). Message bodies are never shown —
// the inbox shows who, which channel, which stage, and when. When the
// caller is not signed in, or Supabase is not connected, the honest
// empty state shows instead of invented events. No event is ever marked
// read from here — there is no mark-read endpoint yet, so unread counts
// are the stored is_read values only.
"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { unreadInboxCount, type InboxEvent } from "@/lib/finalSweep";

type Filter = "all" | "notification" | "message";

export default function NotificationInbox() {
  const [events, setEvents] = useState<InboxEvent[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setError(
        "Notifications are not connected yet (Supabase is not configured), so no stored events can be listed here."
      );
      setLoading(false);
      return;
    }
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setError(
        "Sign in to see your notifications — status updates, emails, and messages in one place."
      );
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        events?: InboxEvent[];
      };
      if (body.events) {
        // The API already returns normalized, newest-first events from
        // stored rows; sort defensively so the list stays newest-first.
        setEvents(
          [...body.events].sort(
            (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
          )
        );
        if (!body.ok && body.error) setError(body.error);
      } else {
        setError(body.error ?? "Your notifications could not be loaded.");
      }
    } catch {
      setError("Your notifications could not be loaded. Try again.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = unreadInboxCount(events);
  const shown = events.filter((e) => filter === "all" || e.kind === filter);

  return (
    <section
      aria-labelledby="notification-inbox-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="notification-inbox-heading" className="text-base font-semibold">
        Notification Inbox
        {unread > 0 && (
          <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
            {unread} unread message{unread === 1 ? "" : "s"}
          </span>
        )}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Every status update, email, and message in one place — from stored
        records only. Message contents are never copied here; open your
        case messages to read them.
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter notifications">
        {(
          [
            ["all", "All"],
            ["notification", "Status & email"],
            ["message", "Messages"],
          ] as [Filter, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={
              "rounded-lg border px-3 py-1.5 text-sm font-medium " +
              (filter === id
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-300 bg-white hover:border-blue-400")
            }
          >
            {label}
            {id === "message" && unread > 0 ? ` (${unread})` : ""}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="mt-3 text-sm text-slate-600">Loading your notifications…</p>
      ) : error ? (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      ) : shown.length === 0 ? (
        <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          {events.length === 0
            ? "No notifications yet — nothing has been sent or logged for your account. Status updates, emails, and messages will appear here when they happen."
            : "No events match this filter."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {shown.map((e) => (
            <li
              key={e.id}
              className={`rounded border px-3 py-2 ${
                e.kind === "message" && e.isRead === false
                  ? "border-blue-300 bg-blue-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <p className="font-medium">
                {e.label}
                {e.kind === "message" && e.isRead === false && (
                  <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                    Unread
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-slate-600">{e.detail}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {new Date(e.createdAt).toLocaleString()}
                {e.status ? ` · Delivery: ${e.status}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
