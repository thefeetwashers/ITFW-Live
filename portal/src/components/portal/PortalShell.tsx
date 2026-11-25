"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import LanguagePicker from "@/components/LanguagePicker";

export type PortalViewAs = "preparer" | "attorney";

const NAV: { id: string; label: string; href: string; badge?: string }[] = [
  { id: "nav-home", label: "Dashboard Home", href: "/portal" },
  { id: "nav-ordered", label: "Ordered Forms (2)", href: "/portal#ordered-package" },
  { id: "nav-invoices", label: "Invoices & Pay", href: "/portal#invoices-pay" },
  { id: "nav-forms", label: "Smart Forms (3)", href: "/portal/questionnaire" },
  { id: "nav-vault", label: "Document Vault", href: "/portal" },
  { id: "nav-translations", label: "Translations", href: "/portal" },
  { id: "nav-audit", label: "Packet Audit [!]", href: "/portal/packet-audit" },
  { id: "nav-esign", label: "E-Sign & Review", href: "/portal" },
  { id: "nav-interview", label: "Interview Prep", href: "/portal" },
  { id: "nav-messages", label: "Messages (2)", href: "/portal" },
  { id: "nav-invoices", label: "Invoices & Fees", href: "/portal" },
];

export default function PortalShell({
  active,
  viewAs,
  onViewAsChange,
  isLive,
  children,
}: {
  active: string;
  viewAs: PortalViewAs;
  onViewAsChange: (v: PortalViewAs) => void;
  isLive: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top bar — wraps cleanly at phone width (320px): the brand block
        and the actions cluster each take their own line rather than
        clipping. The Start button is a real link styled as a button: it
        is shrink-0 with normal wrapping text — there is deliberately NO
        white-space:nowrap, overflow:hidden, or text-overflow:ellipsis
        anywhere in this header, so the button can never clip on a
        narrow phone. (The live static site's Start-button clipping is
        a separate live-site issue and is NOT claimed fixed here.) */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-label="NIPTEI logo"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-slate-900 text-sm font-bold text-white"
          >
            N
          </span>
          <span className="shrink-0 text-sm font-bold tracking-wide">NIPTEI</span>
          <span className="hidden truncate text-sm text-slate-600 sm:inline">
            Case: Form I-130 (Family Petition)
          </span>
          <span className="hidden rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 md:inline">
            Active Order #INV-2049: Form I-130 + I-485 Bundle (example order
            number)
          </span>
        </div>
        <span className="w-full text-sm text-slate-600 sm:hidden">
          Case: Form I-130 (Family Petition)
        </span>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          <LanguagePicker />
          <Link
            href="/portal/questionnaire"
            className="shrink-0 rounded bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
          >
            Start
          </Link>
          <button
            type="button"
            aria-label="Notifications, 3 unread"
            className="relative shrink-0 rounded-full border border-slate-300 px-2 py-1 text-sm"
          >
            🔔 <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1 text-[10px] text-white">3</span>
          </button>
          <button
            type="button"
            aria-label="User menu"
            className="shrink-0 rounded-full border border-slate-300 bg-slate-100 px-2 py-1 text-sm sm:px-3"
          >
            👤 <span className="hidden min-[400px]:inline">Client ▾</span>
            <span className="min-[400px]:hidden">▾</span>
          </button>
        </div>
      </header>

      {/* Example / live banner + View-as switch */}
      <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900">
        <p>
          <strong>{isLive ? "Live data" : "Example data — not live."}</strong>{" "}
          {!isLive &&
            "No Supabase login is connected in this build, so this portal shows example data only. No real login, upload, chat, or payment is live here."}{" "}
          Immigration with NIPTEI — nipteiapp@gmail.com · (772) 971-6129. Not a
          law firm, not affiliated with USCIS. No approval guarantee.
          Clerical / educational help only; only a licensed attorney or
          DOJ-Accredited Representative gives legal advice or represents you
          (8 CFR 292.1).
        </p>
        <p className="mt-1">
          <span className="font-semibold">View as (example only): </span>
          <button
            type="button"
            onClick={() => onViewAsChange("preparer")}
            aria-pressed={viewAs === "preparer"}
            className={`mr-1 rounded border px-2 py-0.5 ${viewAs === "preparer" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-400 bg-white"}`}
          >
            Preparer
          </button>
          <button
            type="button"
            onClick={() => onViewAsChange("attorney")}
            aria-pressed={viewAs === "attorney"}
            className={`rounded border px-2 py-0.5 ${viewAs === "attorney" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-400 bg-white"}`}
          >
            Licensed Attorney
          </button>
          <span className="ml-2">
            {viewAs === "preparer"
              ? "Preparer view: G-28 / legal-advice tools are hidden."
              : "Attorney view (example only): G-28 workspace is shown."}
          </span>
        </p>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Left sidebar */}
        <nav
          aria-label="Portal"
          className="w-full shrink-0 border-b border-slate-200 bg-white lg:w-56 lg:border-b-0 lg:border-r"
        >
          <ul className="flex flex-row flex-wrap gap-1 p-3 lg:flex-col">
            {NAV.map((item) => (
              <li key={item.id}>
                <Link
                  id={item.id}
                  href={item.href}
                  aria-current={active === item.id ? "page" : undefined}
                  className={`block rounded px-3 py-2 text-sm ${
                    active === item.id
                      ? "bg-slate-900 font-semibold text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="hidden px-4 pb-4 text-[11px] leading-relaxed text-slate-500 lg:block">
            Immigration with NIPTEI. Clerical / educational help only. Not a
            law firm. Not affiliated with USCIS.
          </p>
        </nav>

        {/* Content */}
        <main className="min-w-0 flex-1 p-4">{children}</main>
      </div>

      <footer className="border-t border-slate-200 bg-white px-4 py-3 text-center text-xs text-slate-500">
        Immigration with NIPTEI · nipteiapp@gmail.com · (772) 971-6129 · Not a
        law firm. No approval guarantee. Clerical / educational help only.
      </footer>
    </div>
  );
}
