// GET /api/diy/chain-status — form-chain progress + per-form unlock.
//
// Query: ?caseId=<uuid>&chainId=<chain id>  OR  ?caseId=<uuid>&formCode=<form>
//   chainId defaults to the chain containing formCode, else "green-card-bundle".
//
// Server-side, from the database — never from a client claim:
//   * Completed forms: the union of (a) forms with saved answers for
//     this case in questionnaire_responses (migration 0005 — the
//     Dynamic Intake Engine saves answers there), and (b) forms with a
//     diy_drafts row (migration 0023) with status 'submitted' for this
//     account. A missing table is read as "no rows" — it never fails
//     the whole check and never invents a completed form.
//   * Per-form print / save / email: getDiyUnlockForCase() from
//     src/lib/diy.ts, the SAME gate /api/diy/packet enforces — one
//     $25 DIY payment unlocks ONE form, the $99 DIY Bundle unlocks the
//     bundle's forms. I-130A follows the I-130 payment (free with
//     I-130); I-693 has no portal packet (the doctor completes and
//     seals it), so its unlock is "not applicable", never locked or
//     unlocked.
//   * The caller is resolved from their Bearer token (resolveDiyCaller)
//     — never from an account id in the request.
//
// Responses:
//   200 { chainId, chainName, total, completedCount, completedFormCodes,
//         currentFormCode, label, complete, steps: [{ formCode, title,
//         reason, kind, hasIntakeSchema, freeWith, doctorNote, position,
//         status, unlock: { applicable, unlocked, reason, unlockedBy,
//         unlockPriceKey, unlockLabel } }], notices }
//   400 missing / invalid caseId, unknown chainId / formCode
//   401 no / invalid token — sign in first
//   403 no Immigration account for this login, or case belongs to someone else
//   501 Supabase not configured — access denied, fail closed
//
// Nothing here files anything, charges anything, or sends email.
// DOB / A-Number / SSN / passport are never read here — only form codes
// and statuses are returned.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  chainProgress,
  decideChainFormUnlock,
  getChain,
  chainForForm,
  GREEN_CARD_BUNDLE_CHAIN,
  CHAIN_EDITION_NOTICE,
  CHAIN_NOT_LAW_FIRM_NOTICE,
} from "@/lib/formChains";
import {
  getDiyUnlockForCase,
  resolveDiyCaller,
  type DiyUnlockDecision,
  type DiyUnlockEvidence,
  type DiyUnlockRole,
} from "@/lib/diy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * The packet gate's own verdict for one form (getDiyUnlockForCase —
 * the same gate /api/diy/packet enforces). The chain unlock below is
 * rebuilt from this verdict, so the two can never disagree about the
 * same payment: a form is unlocked here exactly when the packet gate
 * unlocks it.
 */
async function gateVerdictForForm(
  accountId: string,
  caseId: string,
  formCode: string
): Promise<DiyUnlockDecision> {
  return getDiyUnlockForCase(accountId, caseId, formCode);
}

/** No payment evidence at all — used only for the I-693 doctor step,
 *  which has no DIY gate (decideChainFormUnlock returns
 *  applicable: false for it regardless of the evidence). */
const NO_EVIDENCE: DiyUnlockEvidence = {
  role: "client",
  caseForms: [],
  hasPaidDiyBundle: false,
  hasPaidDiyForm: false,
  hasPaidDiyUnlockRow: false,
  hasPaidFinalStageInvoice: false,
  hasFullyPaidPaymentPlan: false,
};

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const caseId = params.get("caseId") ?? "";
  const chainIdParam = params.get("chainId") ?? "";
  const formCodeParam = params.get("formCode") ?? "";

  if (!caseId || !UUID_RE.test(caseId)) {
    return NextResponse.json(
      { error: "caseId is required and must be a valid UUID (cases.id)." },
      { status: 400 }
    );
  }

  const chain = chainIdParam
    ? getChain(chainIdParam)
    : formCodeParam
      ? chainForForm(formCodeParam)
      : GREEN_CARD_BUNDLE_CHAIN;
  if (!chain) {
    return NextResponse.json(
      {
        error: chainIdParam
          ? `Unknown chainId "${chainIdParam}".`
          : `Form "${formCodeParam}" is not in any chain (standalone forms have no next form).`,
      },
      { status: 400 }
    );
  }

  const caller = await resolveDiyCaller(req);
  if (!caller.ok) {
    return NextResponse.json({ error: caller.error }, { status: caller.status });
  }
  const accountId = caller.accountId;

  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json(
      {
        error:
          "Payment records are not connected yet (Supabase is not configured), so chain progress and payment status cannot be verified. Nothing is unlocked.",
        code: "not_configured",
      },
      { status: 501 }
    );
  }

  // --- Completed forms: saved answers for this case, plus submitted drafts.
  const completed = new Set<string>();
  try {
    const { data } = await admin
      .from("questionnaire_responses")
      .select("form_code")
      .eq("case_id", caseId);
    for (const row of ((data ?? []) as Record<string, unknown>[])) {
      if (typeof row.form_code === "string" && row.form_code) {
        completed.add(row.form_code);
      }
    }
  } catch {
    // Missing table / read error = no evidence of saved answers.
  }
  try {
    const { data } = await admin
      .from("diy_drafts")
      .select("form_code")
      .eq("account_id", accountId)
      // 'submitted' is the chain builder's original status value;
      // 'completed' / 'transferred' are the save-and-resume statuses
      // set server-side by POST /api/diy/drafts and
      // POST /api/diy/transfer (migration 0023). All three mean the
      // client finished answering the form.
      .in("status", ["submitted", "completed", "transferred"]);
    for (const row of ((data ?? []) as Record<string, unknown>[])) {
      if (typeof row.form_code === "string" && row.form_code) {
        completed.add(row.form_code);
      }
    }
  } catch {
    // Missing table (migration 0023 not run) = no submitted drafts.
  }

  const progress = chainProgress(chain, Array.from(completed));

  // The caller's role, read once — admin / founder support access is
  // decided from accounts.role server-side, never from a client claim.
  let role: DiyUnlockRole = "client";
  try {
    const { data: accountRow } = await admin
      .from("accounts")
      .select("role")
      .eq("id", accountId)
      .maybeSingle();
    const rawRole = (accountRow as { role?: string } | null)?.role ?? "client";
    if (
      ["client", "preparer", "attorney", "nonprofit", "admin", "founder", "teacher", "law_student"].includes(rawRole)
    ) {
      role = rawRole as DiyUnlockRole;
    }
  } catch {
    role = "client";
  }

  // --- Per-form unlock, via the same gate the packet route enforces.
  // I-130A is checked against the I-130 payment (free with I-130);
  // I-693 is not applicable (doctor step) and is never queried.
  // The evidence is re-derived from the gate verdict's unlockedBy —
  // each unlockedBy value is set by exactly one evidence branch in
  // decideDiyUnlock, so this mapping is exact.
  const steps = [];
  for (const s of progress.steps) {
    if (s.formCode === "I-693") {
      steps.push({ ...s, unlock: decideChainFormUnlock(NO_EVIDENCE, "I-693") });
      continue;
    }
    const gateCode = s.formCode === "I-130A" ? "I-130" : s.formCode;
    const gate = await gateVerdictForForm(accountId, caseId, gateCode);
    const evidence: DiyUnlockEvidence = {
      role,
      caseForms: [gateCode],
      hasPaidDiyBundle: gate.unlockedBy === "diy_bundle_invoice",
      hasPaidDiyForm:
        gate.unlockedBy === "diy_form_invoice_for_case" ||
        gate.unlockedBy === "diy_unlock_row",
      hasPaidDiyUnlockRow: gate.unlockedBy === "diy_unlock_row",
      hasPaidFinalStageInvoice: gate.unlockedBy === "final_stage_invoice",
      hasFullyPaidPaymentPlan: gate.unlockedBy === "fully_paid_payment_plan",
    };
    steps.push({ ...s, unlock: decideChainFormUnlock(evidence, s.formCode) });
  }

  return NextResponse.json({
    chainId: progress.chainId,
    chainName: progress.chainName,
    source: chain.source,
    total: progress.total,
    completedCount: progress.completedCount,
    completedFormCodes: progress.completedFormCodes,
    currentFormCode: progress.currentStep?.formCode ?? null,
    currentPosition: progress.currentPosition,
    label: progress.label,
    complete: progress.complete,
    steps,
    notices: {
      edition: CHAIN_EDITION_NOTICE,
      notLawFirm: CHAIN_NOT_LAW_FIRM_NOTICE,
    },
  });
}
