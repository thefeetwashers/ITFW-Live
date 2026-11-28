// /diy — Guided DIY filing flow (Lawfully-style).
//
// Mounts the guided DIY flow: the existing Dynamic Intake Engine in
// client_diy mode, one form at a time, with a watermarked preview, a
// pay-to-unlock gate (DIY $25/form or DIY Bundle $99 via the existing
// Stripe checkout), and — once payment is confirmed in the database —
// print / save / email of the completed packet, a draft cover letter
// and a submission-order guide.
//
// The questions are free. Print / save / email are NOT: they stay
// locked until the server confirms payment (src/lib/diy.ts). A real
// cases.id (UUID) comes from ?caseId=…; without one the flow still
// answers questions, but no packet can be generated — no placeholder
// case id is ever invented here.
//
// This page does NOT gate the questions behind a paywall (unlike
// /portal/smart-forms): DIY answering is free by design — only the
// completed packet is paid. The AttorneyOptionsBar inside the engine
// shows the attorney option on every form page in both modes.
"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DiyGuidedFlow from "@/components/diy/DiyGuidedFlow";
import { ALL_REGISTRY_FORM_CODES, DRAFT_SCHEMA_NOTICE } from "@/lib/dynamicIntakeSchemas";
import { usePreferredDir } from "@/lib/usePreferredDir";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function DiyInner() {
  const searchParams = useSearchParams();
  const dir = usePreferredDir();
  const caseIdParam = searchParams.get("caseId") ?? "";
  const caseId = UUID_RE.test(caseIdParam) ? caseIdParam : "";
  const formParam = searchParams.get("form") ?? "";
  const initialForm = ALL_REGISTRY_FORM_CODES.includes(formParam) ? formParam : undefined;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8" dir={dir}>
      <header>
        <h1 className="text-2xl font-bold">File It Yourself — Guided DIY</h1>
        <p className="mt-1 text-sm text-slate-600">
          Answer the questions for your form one step at a time and the system fills the form
          with your answers. When you finish, pay $25 for the form (or $99 for the DIY Bundle)
          to print it, save it and email it to yourself — plus the document checklist, a draft
          cover letter and how to submit it, in order. {DRAFT_SCHEMA_NOTICE}.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          <Link href="/portal" className="text-blue-700 underline">
            ← Back to the Client Portal
          </Link>{" "}
          ·{" "}
          <Link href="/portal/smart-forms" className="text-blue-700 underline">
            Smart Forms →
          </Link>
        </p>
        {!caseId && (
          <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No case selected — open this flow from your case in the portal (link with
            ?caseId=&lt;your case id&gt;) so answers save against a real case and payment is
            recorded against it. You can still answer the questions below; print, save and email
            need a real case id.
          </p>
        )}
      </header>
      <div className="mt-6">
        <DiyGuidedFlow caseId={caseId} initialFormCode={initialForm} />
      </div>
    </main>
  );
}

export default function DiyPage() {
  return (
    <Suspense fallback={<p className="mx-auto max-w-4xl px-4 py-8 text-sm text-slate-600">Loading the DIY flow…</p>}>
      <DiyInner />
    </Suspense>
  );
}
