// "Tell us how we did" — /reviews/new
// A client leaves a review ONLY after a real case/order, with their
// permission, tied to the professional they used. The form collects
// the real case id, the real service, a 1–5 rating, the review text,
// and the name to show (full real name, or first name + initial).
// The API (/api/reviews) refuses the review unless the case reached
// stage 6 (closed). Until Supabase is connected the form explains
// that nothing can be stored yet — it never pretends a review was left.
"use client";

import { useState } from "react";
import Link from "next/link";
import PortalShell from "@/components/portal/PortalShell";
import { NO_REVIEWS_YET, validateReview, type DisplayNameChoice } from "@/lib/reviews";

export default function NewReviewPage() {
  const [caseId, setCaseId] = useState("");
  const [professionalAccountId, setProfessionalAccountId] = useState("");
  const [clientAccountId, setClientAccountId] = useState("");
  const [serviceFormCode, setServiceFormCode] = useState("I-130");
  const [serviceName, setServiceName] = useState("");
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [displayNameChoice, setDisplayNameChoice] = useState<DisplayNameChoice>("first_name_initial");
  const [permission, setPermission] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    const errors = validateReview({
      caseId,
      professionalAccountId,
      serviceFormCode,
      rating,
      body,
      displayName,
      consentGiven: permission,
    });
    if (!clientAccountId.trim()) errors.push("Your client account id is required — a review is tied to the real client on the case.");
    if (errors.length > 0) {
      setResult(errors.join(" "));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: caseId.trim(),
          professionalAccountId: professionalAccountId.trim(),
          clientAccountId: clientAccountId.trim(),
          serviceFormCode: serviceFormCode.trim(),
          serviceName: serviceName.trim() || null,
          rating,
          body: body.trim(),
          displayName: displayName.trim(),
          displayNameChoice,
          consentGiven: permission,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setResult(
        res.ok
          ? "Thank you — your review was recorded and will show on your professional's page."
          : (data.error as string) || "Your review was NOT saved. Nothing was stored."
      );
      if (res.ok) {
        setBody("");
        setPermission(false);
      }
    } catch {
      setResult("Your review was NOT saved — the reviews service is not reachable. Nothing was stored.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalShell active="nav-home" viewAs="preparer" onViewAsChange={() => {}} isLive={false}>
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-xl font-bold">Tell us how we did</h1>
        <p className="text-sm text-slate-600">
          Reviews open only after your case closes (stage 6), and only with
          your permission. Your review shows your real name — or your first
          name + initial if you choose that — the real service, and the real
          date. We never invent a review, a rating, or a testimonial. With no
          reviews yet, the page says: “{NO_REVIEWS_YET}”
        </p>
        <form onSubmit={submit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block text-sm">
            <span className="font-medium">Your case id (real case only)</span>
            <input type="text" value={caseId} onChange={(e) => setCaseId(e.target.value)} placeholder="e.g. the case id from your portal" className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Your client account id</span>
            <input type="text" value={clientAccountId} onChange={(e) => setClientAccountId(e.target.value)} placeholder="Your account id — the review is tied to you" className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Professional&apos;s account id (the professional you used)</span>
            <input type="text" value={professionalAccountId} onChange={(e) => setProfessionalAccountId(e.target.value)} placeholder="Your professional's account id" className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Service — form code</span>
              <input type="text" value={serviceFormCode} onChange={(e) => setServiceFormCode(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Service name (optional)</span>
              <input type="text" value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="e.g. Family Adjustment Bundle" className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium">Rating</span>
            <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm">
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>{n} of 5 — {"★".repeat(n)}{"☆".repeat(5 - n)}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Tell us how we did</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={2000} placeholder="What was the service like? What should we keep doing?" className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Name to show with your review</span>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your real name" className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
          </label>
          <fieldset className="text-sm">
            <legend className="font-medium">How should your name appear?</legend>
            <label className="mr-4">
              <input type="radio" name="name-choice" checked={displayNameChoice === "first_name_initial"} onChange={() => setDisplayNameChoice("first_name_initial")} className="mr-1" />
              First name + initial (e.g. Maria G.)
            </label>
            <label>
              <input type="radio" name="name-choice" checked={displayNameChoice === "full_name"} onChange={() => setDisplayNameChoice("full_name")} className="mr-1" />
              Full real name
            </label>
          </fieldset>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={permission} onChange={(e) => setPermission(e.target.checked)} className="mt-0.5" />
            <span>I give permission for this review to be shown publicly with the name above, the service, and the date.</span>
          </label>
          <button type="submit" disabled={saving} className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "Saving…" : "Leave my review"}
          </button>
          {result && (
            <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{result}</p>
          )}
          <p className="text-xs text-slate-500">
            Your professional can reply to your review — they cannot edit or
            delete it. A founder/admin can hide a review only with a reason,
            logged to the audit log. If your case has not closed yet (stage
            6), the review is refused and nothing is stored.
          </p>
        </form>
        <p className="text-sm">
          <Link href="/portal" className="font-semibold text-blue-700 underline">← Back to your portal</Link>
        </p>
      </div>
    </PortalShell>
  );
}
