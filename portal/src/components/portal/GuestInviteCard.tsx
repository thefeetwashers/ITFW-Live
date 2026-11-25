"use client";

import { useState } from "react";
import { createCoSponsorInvite, inviteLink } from "@/lib/invites";

export default function GuestInviteCard() {
  const [invite, setInvite] = useState<ReturnType<
    typeof createCoSponsorInvite
  > | null>(null);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold">
        Invite Family / Co-Sponsor — Guest Upload Links
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        One-click magic invite. Your family member or co-sponsor uploads
        their own documents under their own invite — scoped permissions only.
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
          Invite Family / Co-Sponsor
        </button>
      ) : (
        <div className="mt-3 rounded border border-green-200 bg-green-50 p-3 text-sm">
          <p>
            <strong>Guest invite created (example, local only).</strong>
          </p>
          <p className="mt-1 break-all">
            Guest link: <code>{inviteLink(invite.token)}</code>
          </p>
          <p className="mt-1">
            6-digit code (share verbally):{" "}
            <strong className="text-lg tracking-widest">{invite.code}</strong>
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Expires: {new Date(invite.expiresAt).toLocaleDateString()} · Role:{" "}
            {invite.role} · Form: {invite.formCode}
          </p>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Scoped permissions: a guest can ONLY upload their own tax
        transcripts, W-2s, or passport — they cannot see your messages,
        invoices, or other cases. The token is stored in family_invites
        (migration 0006) with expiry + allowed_document_types. Guest upload
        needs a server-side endpoint and is not live yet — the link above is
        an example only, and the token shown here is a browser-generated
        example, not a server-stored token.
      </p>
    </div>
  );
}
