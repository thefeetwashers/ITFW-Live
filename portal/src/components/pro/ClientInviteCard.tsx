// Invite Your Client — professional dashboard card (client component).
// Reuses the family_invites magic invite + 6-digit code system
// (POST /api/professionals/invite-client) and the referral link
// (0017). The client registers themselves; the invite promises no
// case outcome or filing date. No client is invented here — the
// professional types nothing about the client; they share a link.
"use client";

import { useState } from "react";
import { CLIENT_INVITE_HONEST_NOTE } from "@/lib/proDiscovery";

export default function ClientInviteCard({
  invitedBy,
  referralCode,
}: {
  invitedBy: string;
  referralCode: string | null;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [referralUrl, setReferralUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const createInvite = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/professionals/invite-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitedBy, referralCode }),
      });
      const data = (await res.json()) as {
        error?: string;
        link?: string;
        code?: string;
        referralUrl?: string | null;
        expiresAt?: string;
      };
      if (!res.ok) {
        setNote(data.error ?? "The invite could not be created.");
        return;
      }
      setLink(data.link ?? null);
      setCode(data.code ?? null);
      setReferralUrl(data.referralUrl ?? null);
      setExpiresAt(data.expiresAt ?? null);
    } catch {
      setNote("Could not reach the server. No invite was created.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="client-invite-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="client-invite-heading" className="text-lg font-semibold">
        Invite Your Own Client
      </h2>
      <p className="mt-1 text-sm text-slate-700">{CLIENT_INVITE_HONEST_NOTE}</p>
      <button
        type="button"
        disabled={busy || !invitedBy}
        onClick={() => void createInvite()}
        className="mt-3 rounded bg-blue-700 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
      >
        Create a client invite
      </button>
      {!invitedBy ? (
        <p className="mt-2 text-sm text-slate-600">
          Sign in as a professional to create a client invite.
        </p>
      ) : null}
      {link ? (
        <div className="mt-3 space-y-1 text-sm">
          <p>
            <span className="font-medium">Invite link: </span>
            <a href={link} className="text-blue-700 underline break-all">
              {link}
            </a>
          </p>
          <p>
            <span className="font-medium">6-digit code (share verbally): </span>
            {code ?? "—"}
          </p>
          {expiresAt ? (
            <p>
              <span className="font-medium">Expires: </span>
              {new Date(expiresAt).toLocaleString()}
            </p>
          ) : null}
          {referralUrl ? (
            <p>
              <span className="font-medium">Your referral link: </span>
              <a href={referralUrl} className="text-blue-700 underline break-all">
                {referralUrl}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
      {note ? (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {note}
        </p>
      ) : null}
    </section>
  );
}
