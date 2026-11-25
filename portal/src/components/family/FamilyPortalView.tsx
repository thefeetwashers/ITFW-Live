// Family Member & Joint Sponsor Portal View — token-gated.
// Shows ONLY: USCIS / NVC numbers (from EXAMPLE_AGENCY_NUMBERS), what
// is missing, and upload-missing-items slots (local state only, labelled
// example — a file input records a filename locally; no real upload
// yet). NO access to the primary client's messages, invoices (unless
// can_view_invoices — this invitee cannot view invoices, so they are
// shown as hidden with the reason), or other cases.
"use client";

import { useState } from "react";
import { CEAC_LOGIN_URL, EXAMPLE_AGENCY_NUMBERS } from "@/lib/agency";
import LifecyclePipeline from "@/components/LifecyclePipeline";
import CaseCommandPanel from "@/components/nextstep/CaseCommandPanel";
import UnifiedThread from "@/components/comms/UnifiedThread";
import AskNipteiChat from "@/components/copilot/AskNipteiChat";

interface ScopedPermissions {
  canViewStatus: boolean;
  canUploadDocs: boolean;
  canViewInvoices: boolean;
}

// Scoped permissions for the example invitee ("example-token").
const EXAMPLE_PERMISSIONS: ScopedPermissions = {
  canViewStatus: true,
  canUploadDocs: true,
  canViewInvoices: false,
};

const MISSING_SLOTS = [
  "Police Certificate",
  "2025 IRS Tax Transcript",
] as const;

export default function FamilyPortalView({ token, canViewMessages = false }: { token: string; canViewMessages?: boolean }) {
  const [uploads, setUploads] = useState<Record<string, string>>({});

  const recordUpload = (slot: string, file: File | undefined) => {
    if (!file) return;
    // Local state only — the filename is recorded, no file is uploaded.
    setUploads((prev) => ({ ...prev, [slot]: file.name }));
  };

  const missingFromAgency = EXAMPLE_AGENCY_NUMBERS.flatMap((n) =>
    n.missingFromAgency ? [n.missingFromAgency] : []
  );

  return (
    <div className="space-y-6">
      {/* Next Step + Stage + Payment + Communication engine — family view.
          This invitee can view status and upload docs, but NOT invoices
          (can_view_invoices is false) and NOT the primary client's
          messages (hidden unless canViewMessages), so the panel hides
          the Payment Centre, the thread, and Daily Command here — those
          appear only when the invite allows them. EXAMPLE case is the
          consular / NVC case, so route is outside_us. */}
      <CaseCommandPanel
        role="family"
        route="outside_us"
        clientLanguage="es"
        showDailyCommand={false}
        showComms={false}
        showPayment={false}
        canEditRoute={false}
        guide="client"
      />
      <section
        aria-labelledby="scoped-permissions-heading"
        className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
      >
        <h2 id="scoped-permissions-heading" className="text-lg font-semibold">
          Your scoped permissions
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Invite token: <span className="font-mono">{token}</span> (example
          token). You can only see what this invite allows.
        </p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <dt className="font-medium">can_view_status</dt>
            <dd>{EXAMPLE_PERMISSIONS.canViewStatus ? "Yes" : "No"}</dd>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <dt className="font-medium">can_upload_docs</dt>
            <dd>{EXAMPLE_PERMISSIONS.canUploadDocs ? "Yes" : "No"}</dd>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <dt className="font-medium">can_view_invoices</dt>
            <dd>{EXAMPLE_PERMISSIONS.canViewInvoices ? "Yes" : "No"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-slate-600">
          You do <strong>not</strong> have access to the primary
          client&apos;s messages, other cases, or invoices.
        </p>
        <p className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <strong>Role isolation:</strong> this invite only ever shows this
          one case. If you can see another client&apos;s information, or a
          page that is not for your role, stop and email{" "}
          <a href="mailto:nipteiapp@gmail.com" className="font-semibold text-blue-700 underline">
            nipteiapp@gmail.com
          </a>{" "}
          (do not use thefeetwashers@gmail.com for portal access issues).
        </p>
      </section>

      <section
        aria-labelledby="agency-numbers-heading"
        className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
      >
        <h2 id="agency-numbers-heading" className="text-lg font-semibold">
          USCIS &amp; NVC Numbers
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Example numbers only — shared from the preparer&apos;s Case Number
          Hub (visible_to_family = true).
        </p>
        <ul className="mt-3 space-y-2">
          {EXAMPLE_AGENCY_NUMBERS.map((n) => (
            <li
              key={n.id}
              className="rounded border border-slate-200 bg-slate-50 p-3 text-sm"
            >
              <span className="font-medium">
                {n.agency} — {n.formOrStage}:
              </span>{" "}
              <span className="font-mono">{n.caseNumber}</span>
              {n.nvcInvoiceId && (
                <span className="block text-xs text-slate-600">
                  NVC Invoice ID:{" "}
                  <span className="font-mono">{n.nvcInvoiceId}</span>
                </span>
              )}
              <span className="block text-slate-700">
                Status: {n.agencyStatus}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          NVC CEAC:{" "}
          <a
            href={CEAC_LOGIN_URL}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-blue-700 underline"
          >
            Open CEAC login (ceac.state.gov)
          </a>{" "}
          — manual tracking only; never share or store a CEAC password.
        </p>
      </section>

      {/* Lifecycle — read-only guidance. Example case is at NVC (5B). */}
      <LifecyclePipeline
        currentStage="submitted_uscis"
        currentSubStage="5B"
        readOnly
        caseLabel="This case (EXAMPLE): USCIS approved the I-130 petition — the case is now at NVC."
      />

      <section
        aria-labelledby="missing-heading"
        className="rounded-lg border border-red-300 bg-red-50 p-4 shadow-sm"
      >
        <h2 id="missing-heading" className="text-lg font-semibold">
          What NVC Says Is Missing: Police Certificate &amp; 2025 IRS Tax
          Transcript
        </h2>
        <p className="mt-1 text-sm text-slate-700">
          Example missing items (from the shared Case Number Hub). Anything
          the preparer logs as &ldquo;Missing from USCIS or NVC&rdquo; —
          an RFE, an NVC CEAC civil-document rejection, or an I-864
          joint-sponsor tax transcript — appears here as soon as it is
          logged.
        </p>
        {missingFromAgency.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {missingFromAgency.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}

        <h3 className="mt-4 text-sm font-semibold">
          Upload the missing items (example — local only)
        </h3>
        <ul className="mt-2 space-y-3">
          {MISSING_SLOTS.map((slot) => (
            <li
              key={slot}
              className="rounded border border-slate-200 bg-white p-3 text-sm"
            >
              <label className="block font-medium">
                {slot}
                <input
                  type="file"
                  onChange={(e) =>
                    recordUpload(slot, e.target.files?.[0])
                  }
                  className="mt-1 block w-full text-sm"
                />
              </label>
              {uploads[slot] ? (
                <p className="mt-1 text-xs text-green-700" role="status">
                  Recorded locally (example only, not uploaded):{" "}
                  {uploads[slot]}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  No file recorded yet. Choosing a file records its name
                  locally only — no real upload happens in this example
                  build.
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="invoices-heading"
        className="rounded-lg border border-slate-300 bg-slate-100 p-4 shadow-sm"
      >
        <h2 id="invoices-heading" className="text-lg font-semibold">
          Invoices — hidden
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Invoices are hidden for this invite because can_view_invoices is
          false. Ask the primary client for an invite with invoice access
          if you need to pay an invoice.
        </p>
      </section>

      {/* Ask NIPTEI copilot — family view. Non-AI FAQ answers in
          this build (OpenRouter NOT connected). "Ask a human" routes
          to the assigned professional's unified thread. */}
      <AskNipteiChat context="family" caseId="example-case-1" />

      <section
        aria-labelledby="messages-heading"
        className="rounded-lg border border-slate-300 bg-slate-100 p-4 shadow-sm"
      >
        <h2 id="messages-heading" className="text-lg font-semibold">
          Messages &amp; other cases — not available
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          The primary client&apos;s messages and all other cases are not
          visible through a family invite. This view shows only the case
          numbers, missing items, and upload slots above. Messages open
          only if the invite explicitly allows them (default: hidden —
          see guest_upload_scope.sees_messages, migration 0006).
        </p>
        {canViewMessages && (
          <div className="mt-3">
            <UnifiedThread
              caseId="example-case-1"
              caseLabel="Invited case (EXAMPLE)"
              viewerRole="family"
              viewerName="You (Family Member)"
              clientLanguage="es"
            />
          </div>
        )}
      </section>
    </div>
  );
}
