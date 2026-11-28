// Share buttons for public pages (Nov 28, 2026).
//
// Plain links to a public page: copy link, WhatsApp, email. The
// URLs come from src/lib/freeTools.ts shareLinks() and carry no
// tracking parameters (no utm_, no referrer id) — sharing records
// nothing about the sharer, and no click is tracked.
"use client";

import { useState } from "react";
import { shareLinks } from "@/lib/freeTools";

export default function ShareButtons({
  path,
  title,
}: {
  path: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);
  const links = shareLinks(path, title);

  async function copy() {
    try {
      await navigator.clipboard.writeText(links.copyText);
      setCopied(true);
    } catch {
      // Clipboard unavailable (older browser / permission): fall back
      // to selecting the link text the user can copy by hand.
      setCopied(false);
      const el = document.getElementById("share-link-text");
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold">Share this page with someone who needs it</p>
      <p className="mt-1 text-xs text-slate-500">
        A plain link — no tracking, nothing recorded about you for sharing it.
      </p>
      <p className="mt-2 text-sm">
        <span id="share-link-text" className="break-all font-mono text-blue-700">
          {links.url}
        </span>
      </p>
      <p className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800"
        >
          {copied ? "Copied ✓" : "Copy link"}
        </button>
        <a
          href={links.whatsapp}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800"
        >
          Share on WhatsApp →
        </a>
        <a
          href={links.email}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800"
        >
          Share by email →
        </a>
      </p>
    </div>
  );
}
