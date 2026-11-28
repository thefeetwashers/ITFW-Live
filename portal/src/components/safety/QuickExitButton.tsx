// Quick Exit — discreet control for sensitive pages (VAWA, U/T visa,
// domestic-violence content, safety pages, your-rights).
//
// Behaviour, matching the public site's Quick Exit
// (index.html:4541, 4661: a link to https://www.google.com):
//   * One tap leaves the site for Google, in the same tab.
//   * window.location.replace() is used so the browser Back button
//     does NOT return to this page.
//   * sessionStorage is cleared first, so no draft answer or page
//     state is left visible in this tab. (localStorage is NOT
//     touched: wiping it would sign the client out of the portal
//     mid-case; the visible-state risk is the page itself.)
//   * The Escape key also exits, for a keyboard-only user whose
//     hands are already on the keyboard.
//   * It is NEVER logged: no fetch, no analytics event, no console
//     entry, no audit row. Nothing in the codebase records that it
//     was used, or when.
//   * Honest limit, stated on the safety hub: Quick Exit changes
//     the page you are looking at — it does NOT erase browser
//     history. The hub tells the client to clear history or use a
//     private window.
"use client";

import { useCallback, useEffect } from "react";
import { QUICK_EXIT_URL } from "@/lib/safety";

export default function QuickExitButton({
  variant = "fixed",
}: {
  /** "fixed" pins the button top-right on sensitive pages;
   *  "inline" renders it in the page flow (safety hub banner). */
  variant?: "fixed" | "inline";
}) {
  const exitNow = useCallback(() => {
    try {
      sessionStorage.clear();
    } catch {
      // Storage may be unavailable (private mode, blocked cookies) —
      // leaving the page matters more than clearing it.
    }
    window.location.replace(QUICK_EXIT_URL);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitNow();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exitNow]);

  const className =
    variant === "fixed"
      ? "no-print fixed right-3 top-3 z-50 rounded bg-red-700 px-3 py-2 text-sm font-bold text-white shadow-lg hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-900 focus:ring-offset-2"
      : "no-print inline-block rounded bg-red-700 px-3 py-2 text-sm font-bold text-white shadow hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-900 focus:ring-offset-2";

  return (
    <button
      type="button"
      onClick={exitNow}
      aria-label="Quick Exit — leave this page now and open Google instead. Pressing Escape also leaves this page."
      title="Quick Exit — leave this page now (or press Escape)"
      className={className}
    >
      ✕ Quick Exit — leave this page now
    </button>
  );
}
