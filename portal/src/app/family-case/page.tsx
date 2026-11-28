import Link from "next/link";
import {
  FAMILY_ROLES,
  FAMILY_ROLE_LABEL,
  FAMILY_ROLE_DEFAULT_SCOPE,
  scopeFamilyCaseView,
  isHiddenSection,
  type FamilyMember,
  type SharedCaseContent,
} from "@/lib/familyCase";

// EXAMPLE data only — one case, four family logins, one shared checklist
// and timeline. Real rows come from case_family_members (migrations
// 0009 + 0022) once Supabase is connected.
const EXAMPLE_SHARED: SharedCaseContent = {
  checklist: [
    "Petitioner passport / ID",
    "Beneficiary passport / ID",
    "Proof of relationship",
  ],
  timeline: [
    "Stage 1 — first question",
    "Stage 4 — documents and drafting",
    "Stage 6 — visa approved, travel prep",
  ],
  invoices: [{ label: "Family Adjustment Bundle — Standard", amountCents: 179900 }],
  messages: [{ from: "Preparer", text: "EXAMPLE message — not a real thread." }],
};

const EXAMPLE_CHILD: FamilyMember = {
  id: "member-example-child",
  caseId: "case-example-1",
  accountId: "account-example-child",
  inviteId: "invite-example-1",
  fullName: "EXAMPLE Child",
  role: "child",
  email: "example-child@example.invalid",
  phone: null,
  canViewStatus: true,
  canUploadDocs: false,
  canViewInvoices: false,
  canViewMessages: false,
  inviteToken: "example-token",
  acceptedAt: "2026-11-28T00:00:00Z",
};

export default function FamilyCasePage() {
  // The child sees the shared checklist + timeline — never the payments.
  const childView = scopeFamilyCaseView(EXAMPLE_CHILD, EXAMPLE_SHARED);

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <strong>Example data — not live.</strong> Whole family in one case:
          petitioner, beneficiary, children and joint sponsor each log in
          with their own account, all in the same case, sharing one checklist
          and one timeline. Each member sees only what their role allows.
          Immigration with NIPTEI — not a law firm, not affiliated with
          USCIS.
        </p>

        <h1 className="mt-4 text-xl font-bold">
          Whole Family in One Case
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          <Link href="/portal" className="underline">
            ← Back to Portal
          </Link>{" "}
          ·{" "}
          <Link href="/family-portal/example-token" className="underline">
            Family portal (invite link) →
          </Link>
        </p>

        <section
          aria-labelledby="roles-heading"
          className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 id="roles-heading" className="text-base font-semibold">
            The four roles — and what each one may see
          </h2>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1 pr-2">Role</th>
                <th className="py-1 pr-2">Status</th>
                <th className="py-1 pr-2">Uploads</th>
                <th className="py-1 pr-2">Invoices</th>
                <th className="py-1">Messages</th>
              </tr>
            </thead>
            <tbody>
              {FAMILY_ROLES.map((role) => {
                const scope = FAMILY_ROLE_DEFAULT_SCOPE[role];
                return (
                  <tr key={role} className="border-t border-slate-100">
                    <td className="py-1 pr-2 font-medium">{FAMILY_ROLE_LABEL[role]}</td>
                    <td className="py-1 pr-2">{scope.canViewStatus ? "Yes" : "No"}</td>
                    <td className="py-1 pr-2">{scope.canUploadDocs ? "Yes" : "No"}</td>
                    <td className="py-1 pr-2">{scope.canViewInvoices ? "Yes" : "No — default"}</td>
                    <td className="py-1">{scope.canViewMessages ? "Yes" : "No — default"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">
            Defaults above are what an inviter should pick. The stored flags
            on each member row (migration 0009 + 0022) are what is enforced —
            invoices and messages default to hidden. A member&apos;s own login
            is their own accounts row plus the 6-digit email code (migration
            0020); the invite link is only how they are invited.
          </p>
        </section>

        <section
          aria-labelledby="child-heading"
          className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 id="child-heading" className="text-base font-semibold">
            Example: what the child sees in this case
          </h2>
          <h3 className="mt-3 text-sm font-semibold">Shared checklist</h3>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {childView.checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3 className="mt-3 text-sm font-semibold">Shared timeline</h3>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {childView.timeline.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3 className="mt-3 text-sm font-semibold">Payment details</h3>
          <p className="mt-1 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            {isHiddenSection(childView.invoices)
              ? childView.invoices.reason
              : "Visible (this member was granted invoice access)."}
          </p>
          <h3 className="mt-3 text-sm font-semibold">Messages</h3>
          <p className="mt-1 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            {isHiddenSection(childView.messages)
              ? childView.messages.reason
              : "Visible (this member was granted message access)."}
          </p>
        </section>
      </div>
    </div>
  );
}
