// Family Member & Co-Sponsor Shared Access — preparer view.
// Invites use createCoSponsorInvite() + inviteLink() from lib/invites.
// Canonical guest link: https://immigration.niptei.com/guest/<token>.
// Invitees upload their own documents without sharing passwords and
// never see the primary client's password or other cases. The token
// shown here is an example created client-side; real tokens are
// generated server-side and stored in family_invites.invite_token
// with expiry (migration 0006).
"use client";

import { useState } from "react";
import {
  createCoSponsorInvite,
  inviteLink,
  type CoSponsorInvite,
} from "@/lib/invites";

type InviteeRole = "spouse" | "adult_child" | "joint_sponsor";

interface Invitee {
  invite: CoSponsorInvite;
  label: string;
  role: InviteeRole;
  canViewStatus: boolean;
  canUploadDocs: boolean;
  canViewInvoices: boolean;
}

const ROLE_LABELS: Record<InviteeRole, string> = {
  spouse: "Spouse",
  adult_child: "Adult child",
  joint_sponsor: "Joint sponsor (I-864)",
};

const ROLE_PERMISSIONS: Record<
  InviteeRole,
  { canViewStatus: boolean; canUploadDocs: boolean; canViewInvoices: boolean }
> = {
  spouse: { canViewStatus: true, canUploadDocs: false, canViewInvoices: false },
  adult_child: { canViewStatus: true, canUploadDocs: false, canViewInvoices: false },
  joint_sponsor: { canViewStatus: true, canUploadDocs: true, canViewInvoices: true },
};

export default function FamilyInviteManager() {
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [label, setLabel] = useState("Example Joint Sponsor");
  const [role, setRole] = useState<InviteeRole>("joint_sponsor");
  const [permission, setPermission] = useState<
    "view" | "upload_pay"
  >("upload_pay");

  const createInvite = () => {
    const invite = createCoSponsorInvite({
      caseId: "example-case-i130",
      formCode: "I-864",
    });
    const defaults = ROLE_PERMISSIONS[role];
    const perms =
      permission === "view"
        ? { canViewStatus: true, canUploadDocs: false, canViewInvoices: false }
        : defaults;
    setInvitees((prev) => [
      ...prev,
      {
        invite: { ...invite, role: role === "joint_sponsor" ? "joint_sponsor" : role === "spouse" ? "spouse" : "relative_abroad" },
        label: label.trim() || "Example Invitee",
        role,
        ...perms,
      },
    ]);
    setLabel("Example Joint Sponsor");
  };

  return (
    <section
      aria-labelledby="family-invites-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="family-invites-heading" className="text-lg font-semibold">
        Family Member &amp; Co-Sponsor Shared Access
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Invite spouses, adult children, and joint sponsors with role-based
        permissions. They upload their own documents without sharing
        passwords, and they never see the primary client&apos;s password or
        other cases.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-slate-600">
          Invitee label (generic only)
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="mt-1 block rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as InviteeRole)}
            className="mt-1 block rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            {(Object.keys(ROLE_LABELS) as InviteeRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Permission set
          <select
            value={permission}
            onChange={(e) =>
              setPermission(e.target.value as "view" | "upload_pay")
            }
            className="mt-1 block rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            <option value="view">View Case &amp; USCIS/NVC Status</option>
            <option value="upload_pay">Upload Missing Docs &amp; Pay Invoice</option>
          </select>
        </label>
        <button
          type="button"
          onClick={createInvite}
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create invite
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Example invite only — the token is generated client-side here. Real
        tokens are generated server-side and stored with expiry in
        family_invites.invite_token.
      </p>

      {invitees.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          No invites created yet in this example session.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {invitees.map((inv) => (
            <li
              key={inv.invite.token}
              className="rounded border border-slate-200 bg-slate-50 p-3 text-sm"
            >
              <p className="font-medium">
                {inv.label} — {ROLE_LABELS[inv.role]} (Form{" "}
                {inv.invite.formCode})
              </p>
              <p className="mt-1 break-all">
                Guest link:{" "}
                <a
                  href={inviteLink(inv.invite.token)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 underline"
                >
                  {inviteLink(inv.invite.token)}
                </a>
              </p>
              <p className="mt-1 text-xs text-slate-600">
                6-digit code (share verbally, shown once):{" "}
                <span className="font-mono">{inv.invite.code}</span> ·
                Expires: {new Date(inv.invite.expiresAt).toLocaleDateString()}
              </p>
              <p className="mt-2 text-xs">
                Permissions — can_view_status:{" "}
                {inv.canViewStatus ? "yes" : "no"} · can_upload_docs:{" "}
                {inv.canUploadDocs ? "yes" : "no"} · can_view_invoices:{" "}
                {inv.canViewInvoices ? "yes" : "no"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
