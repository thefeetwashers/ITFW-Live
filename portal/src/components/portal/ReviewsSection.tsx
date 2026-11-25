// Real reviews only — shows ONLY rows from the reviews table
// (migration 0017). With no real rows: "No reviews yet — be our
// first." Never a count, rating, or testimonial that is not a row.
// The professional can reply (reply form posts to /api/reviews);
// the professional cannot edit/delete a client's review — the
// database trigger enforces that, and no edit/delete control is
// rendered here.
"use client";

import { useState } from "react";
import Link from "next/link";
import { NO_REVIEWS_YET, type ReviewRow } from "@/lib/reviews";

export default function ReviewsSection({
  reviews,
  professionalName,
  caseClosed,
  isProfessional = false,
}: {
  reviews: ReviewRow[];
  professionalName: string;
  /** True only when the client's case reached stage 6 (closed). */
  caseClosed: boolean;
  isProfessional?: boolean;
}) {
  const shown = reviews.filter((r) => r.visible && r.consent_given);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyResult, setReplyResult] = useState<string | null>(null);

  const submitReply = async (reviewId: string) => {
    setReplyResult(null);
    if (!replyText.trim()) return;
    try {
      const res = await fetch("/api/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reviewId, replyText: replyText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      setReplyResult(
        res.ok
          ? "Reply recorded."
          : (data.error as string) ||
              "Reply was NOT saved — Supabase is not connected yet, so nothing was stored."
      );
      if (res.ok) {
        setReplyFor(null);
        setReplyText("");
      }
    } catch {
      setReplyResult(
        "Reply was NOT saved — the reviews service is not reachable. Nothing was stored."
      );
    }
  };

  return (
    <section
      aria-labelledby="reviews-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="reviews-heading" className="text-base font-semibold">
        What clients say — {professionalName}
      </h2>
      {shown.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{NO_REVIEWS_YET}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {shown.map((r) => (
            <li key={r.id} className="rounded border border-slate-200 px-3 py-2">
              <p className="text-sm">
                <strong>
                  {"★".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)}
                </strong>{" "}
                <span className="text-slate-500">
                  {r.rating} of 5 — {r.display_name} — {r.service_form_code}
                  {r.service_name ? ` (${r.service_name})` : ""} —{" "}
                  {new Date(r.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{r.body}</p>
              {r.reply_text && (
                <p className="mt-2 rounded bg-slate-50 px-2 py-1 text-sm">
                  <strong>Reply from {professionalName}:</strong> {r.reply_text}
                </p>
              )}
              {isProfessional && !r.reply_text && (
                <div className="mt-2">
                  {replyFor === r.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={2}
                        placeholder="Reply to this review (you can reply — you cannot edit or delete the client's review)."
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => submitReply(r.id)}
                          className="rounded bg-slate-900 px-3 py-1 text-sm font-semibold text-white"
                        >
                          Send reply
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReplyFor(null);
                            setReplyText("");
                          }}
                          className="rounded border border-slate-300 px-3 py-1 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReplyFor(r.id)}
                      className="rounded border border-slate-300 px-3 py-1 text-sm font-semibold"
                    >
                      Reply to this review
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {replyResult && (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {replyResult}
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Only real reviews from real cases appear here, with the
        client&apos;s permission. A professional can reply — never edit or
        delete a client&apos;s review. A founder/admin can hide a review
        only with a reason, logged to the audit log.
      </p>
      {caseClosed ? (
        <p className="mt-2 text-sm">
          Your case is closed —{" "}
          <Link href="/reviews/new" className="font-semibold text-blue-700 underline">
            tell us how we did
          </Link>
          .
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          After your case closes (stage 6), you will be invited here to tell
          us how we did. Reviews open only after a real case closes.
        </p>
      )}
    </section>
  );
}
