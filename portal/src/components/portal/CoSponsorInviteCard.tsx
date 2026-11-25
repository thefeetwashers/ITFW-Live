"use client";

import { useState } from "react";
import { createCoSponsorInvite, inviteLink } from "@/lib/invites";

export default function CoSponsorInviteCard() {
  const [invite, setInvite] = useState<ReturnType<
    typeof createCoSponsorInvite
  > | null>(null);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold">Sponsor (I-864)</h3>
      <p className="mt-1 text-sm text-slate-600">
        Form I-864, Affidavit of Support. A joint sponsor / co-sponsor can
        upload their own tax returns into your vault under their own invite.
      </p>
      {!invite ? (
        <button
          type="button"
          onClick={() =>
            setInvite(
              createCoSponsorInvite({
                caseId: "example-case-i130",
                formCode: "I-864",
              })
            )
          }
          className="mt-3 rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
        >
          Share Link with Co-Sponsor
        </button>
      ) : (
        <div className="mt-3 rounded border border-green-200 bg-green-50 p-3 text-sm">
          <p>
            <strong>Co-sponsor invite created (example, local only).</strong>
          </p>
          <p className="mt-1 break-all">
            Invite link: <code>{inviteLink(invite.token)}</code>
          </p>
          <p className="mt-1">
            6-digit code (share verbally):{" "}
            <strong className="text-lg tracking-widest">{invite.code}</strong>
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Role: {invite.role} · Form: {invite.formCode} · Expires:{" "}
            {new Date(invite.expiresAt).toLocaleDateString()}
          </p>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Your co-sponsor uploads their own tax returns into your vault under
        their own invite — they never see your password or your other cases.
      </p>
    </div>
  );
}
