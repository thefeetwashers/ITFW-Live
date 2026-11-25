// (e) Certified Translation & Passport Photo Add-On Tracker.
// REUSES the existing TranslationOrders component for ordering —
// nothing is duplicated. This tracker only shows WHICH foreign
// documents still need a Certificate of Translation Accuracy before
// USCIS / NVC, plus the passport-photo add-on per family member.
// EXAMPLE data only.
"use client";

import { useState } from "react";
import TranslationOrders from "@/components/portal/TranslationOrders";
import {
  EXAMPLE_PHOTO_ADDONS,
  EXAMPLE_TRANSLATION_ADDONS,
  type TranslationAddonStatus,
} from "@/lib/nvc";

const STATUS_LABEL: Record<TranslationAddonStatus, string> = {
  not_requested: "Not requested",
  requested: "Requested",
  received: "Received",
};

export default function TranslationPhotoTracker() {
  const [addons, setAddons] = useState(EXAMPLE_TRANSLATION_ADDONS);
  const [photos, setPhotos] = useState(EXAMPLE_PHOTO_ADDONS);

  const cycle = (id: string) =>
    setAddons((prev) =>
      prev.map((a) => {
        if (a.id !== id || a.status === "received") return a;
        return {
          ...a,
          status:
            a.status === "not_requested" ? "requested" : "received",
        } as typeof a;
      })
    );

  const cyclePhoto = (id: string) =>
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id !== id || p.status === "received") return p;
        return {
          ...p,
          status:
            p.status === "not_requested" ? "requested" : "received",
        } as typeof p;
      })
    );

  const stillNeeded = addons.filter(
    (a) => a.needsCertificate && a.status !== "received"
  ).length;

  return (
    <section
      aria-labelledby="translation-photo-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="translation-photo-heading" className="text-base font-semibold">
        Certified Translation &amp; Passport Photo Add-On Tracker
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {stillNeeded} foreign document
        {stillNeeded === 1 ? "" : "s"} still need
        {stillNeeded === 1 ? "s" : ""} a Certificate of Translation Accuracy
        before USCIS / NVC (EXAMPLE data). Certified translation is $45/page
        (locked price). Orders below reuse the existing translation
        component — no duplicate ordering flow.
      </p>

      <h3 className="mt-4 text-sm font-semibold">
        Certificate of Translation Accuracy — still needed
      </h3>
      <ul className="mt-2 space-y-2">
        {addons.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2 text-sm"
          >
            <span>
              <span className="font-medium">{a.document}</span>
              <span className="block text-xs text-slate-500">
                {a.note ?? ""}
              </span>
              <span className="text-xs">
                Status: <strong>{STATUS_LABEL[a.status]}</strong>
              </span>
            </span>
            <button
              type="button"
              disabled={a.status === "received"}
              onClick={() => cycle(a.id)}
              className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {a.status === "received"
                ? "Certificate on file ✓"
                : a.status === "requested"
                  ? "Requested ✓ — mark received"
                  : "Request certificate"}
            </button>
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-sm font-semibold">
        Passport Photos (2x2) — per family member
      </h3>
      <ul className="mt-2 space-y-2">
        {photos.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2 text-sm"
          >
            <span>
              <span className="font-medium">{p.personExample} (EXAMPLE)</span>
              <span className="block text-xs text-slate-500">{p.note ?? ""}</span>
              <span className="text-xs">
                Status: <strong>{STATUS_LABEL[p.status]}</strong>
              </span>
            </span>
            <button
              type="button"
              disabled={p.status === "received"}
              onClick={() => cyclePhoto(p.id)}
              className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {p.status === "received"
                ? "Photos on file ✓"
                : p.status === "requested"
                  ? "Requested ✓ — mark received"
                  : "Request photos"}
            </button>
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-sm font-semibold">
        Order certified translations (existing component)
      </h3>
      <div className="mt-2">
        <TranslationOrders />
      </div>
    </section>
  );
}
