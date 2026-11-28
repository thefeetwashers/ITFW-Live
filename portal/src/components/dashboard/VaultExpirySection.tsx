// Document Vault Expiry Tracking — DASHBOARD section (Nov 28, 2026).
// Every uploaded document gets an expiry date where one applies
// (passport, medical exam, police clearance — the date recorded in
// the vault from the document itself), and the vault flags what is
// about to expire. Birth certificate translations DO NOT EXPIRE —
// the section says so, and they are always reported as never
// expiring. A document with no expiry date on file is never flagged
// as expiring. Client dashboard home shows the client's own vault
// warnings; the professional pipeline shows per-client vault flags.
"use client";

import Link from "next/link";
import {
  deriveVaultExpiries,
  VAULT_DOCUMENT_KIND_LABEL,
  VAULT_EXPIRY_SOURCE_NOTE,
  VAULT_TRANSLATION_NEVER_EXPIRES,
  type VaultDocumentInput,
} from "@/lib/vaultExpiry";

export default function VaultExpirySection({
  documents,
  audience,
}: {
  documents: VaultDocumentInput[];
  audience: "client" | "professional";
}) {
  const derived = deriveVaultExpiries(documents);
  const flags = derived.filter(
    (d) => d.status === "expired" || d.status === "expiring_soon"
  );

  return (
    <section
      aria-label="Document vault expiry"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-base font-semibold">Document Vault — expiry warnings</h2>
      <p className="mt-1 text-sm text-slate-600">
        {audience === "client"
          ? "Your uploaded documents, and which ones are about to expire — passport, medical exam, and police clearance carry expiry dates."
          : "Per-client vault flags for your pipeline — which clients have a document expiring soon or already expired."}
      </p>
      <p className="mt-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        {VAULT_TRANSLATION_NEVER_EXPIRES}
      </p>
      {derived.length === 0 ? (
        <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          No documents expiring — no vault document with an expiry date
          on file is expiring soon
          {audience === "professional" ? " for any client in your pipeline" : ""}.
          Documents with no expiry date on file are listed as such, never
          guessed.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm">
            {flags.length > 0 ? (
              <strong className="text-amber-800">
                {flags.length} document{flags.length === 1 ? "" : "s"} need
                {flags.length === 1 ? "s" : ""} attention.
              </strong>
            ) : (
              <span className="text-slate-600">
                No documents expiring soon.
              </span>
            )}
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            {derived.map((d) => (
              <li
                key={d.id}
                className="rounded border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <p>
                  <strong>{d.label}</strong> —{" "}
                  {VAULT_DOCUMENT_KIND_LABEL[d.kind]}
                  {audience === "professional" && d.clientLabel
                    ? ` — ${d.clientLabel}`
                    : ""}
                </p>
                <p className="text-slate-600">
                  {d.statusLabel}
                  {d.expiresOn ? ` Expiry on file: ${d.expiresOn}.` : ""}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-2 text-xs text-slate-500">{VAULT_EXPIRY_SOURCE_NOTE}</p>
      <p className="mt-3 text-sm">
        <Link href="/portal" className="font-semibold text-blue-700 underline">
          Open the Document Vault in the Client Portal →
        </Link>
      </p>
    </section>
  );
}
