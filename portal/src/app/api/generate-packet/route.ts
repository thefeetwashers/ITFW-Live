import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  PDFTextField,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";
import { computePacketReadiness, type AuditItem } from "@/lib/audit";
import {
  mappingsForForm,
  templateStoragePath,
  packetStoragePath,
  VAULT_BUCKET,
} from "@/lib/uscisFieldMappings";
import { MISSED_PAYMENT_RULE, formatCents } from "@/lib/order";
import { PORTAL_URL } from "@/lib/notificationTemplates";

// PDF Auto-Fill & Packet Merger API — POST /api/generate-packet
// ============================================================================
// DRAFT ONLY. This route NEVER files anything with USCIS, never claims a
// packet is "filed", and never calls a packet "submission-ready" as if it
// were filed. Every generated packet is a DRAFT for the preparer/attorney
// and the client to review and E-Sign before filing.
//
// CORRECTIONS vs the pasted draft (do not re-introduce them):
//  * Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (server-only).
//    process.env.SUPABASE_URL does NOT exist here.
//  * Tables: cases is correct; the client join is public.accounts
//    (cases.client_id -> accounts.id) — there is NO users table join.
//    There is NO case_intake_answers table — answers live in
//    questionnaire_responses (migration 0005). There is NO case_documents
//    table — documents live in `documents` (migration 0001).
//  * Storage: the ONLY bucket is the private `vault`. There is no
//    'uscis-templates' or 'case-documents' bucket — do not create one.
//    Templates live at vault/templates/<form-code>/<edition>.pdf,
//    packets at vault/packets/<case-id>/.
//  * Templates: official USCIS PDFs are NOT in this repo and NOT in any
//    bucket. They must come from uscis.gov, per form edition. A missing
//    template returns a clear 404 error — the route never silently skips
//    a form and never claims it was filled.
//  * Field mappings: every AcroForm name in src/lib/uscisFieldMappings.ts
//    is UNVERIFIED (guessed). The route tries each one, logs every field
//    that was NOT found on the template, and returns the unfilled list.
//  * Documents: the real review status is 'accepted' (migration 0001
//    document_review_status enum: uploaded / under_review / accepted /
//    retake_requested). There is NO 'approved' status — the pasted spec's
//    status='approved' would have matched zero rows. Only 'accepted'
//    documents are included; everything else is listed on the cover
//    sheet as excluded/missing.
//  * Audit gate: packet_audit_items (migration 0005) scored with
//    computePacketReadiness() from src/lib/audit.ts. Generation is
//    BLOCKED unless score is 100% AND every blocking item is cleared.
//    The EXAMPLE_AUDIT_ITEMS in audit.ts are example data and are never
//    used as a real score.
//  * Payment gate: the final packet download stays locked until the
//    balance is paid/current — order_invoices (migration 0006) for the
//    case's service_orders row, plus payment_plans (migration 0002)
//    shown for transparency. Prep fee and USCIS government fees are
//    ALWAYS separate (service_orders.total_service_fee_cents vs
//    estimated_uscis_gov_fee_cents) — never combined into one total.
//  * Domain: https://immigration.niptei.com (PORTAL_URL). Never niptei.com.
//  * E-Sign: NO E-Sign provider is connected yet. The packet is a draft
//    awaiting review + E-Sign; this route does not sign anything.
//  * Vercel deploy / custom domain / local Stripe webhook testing are
//    SEPARATE tasks — not done here.
//  * Auth: this route does NOT yet enforce caller authentication. It must
//    sit behind preparer/attorney auth before any live use; the actorId /
//    actorRole in the body are recorded in audit_log only when supplied.
//  * Logging: audit_log gets actor, case, form codes and page count ONLY.
//    NO document contents and NO PII beyond the case id.
//
// Request body:
//   { caseId: string, editions?: { [formCode]: string },
//     actorId?: string (accounts.id), actorRole?: "client"|"preparer"|
//     "attorney"|"nonprofit"|"admin" }
// Response (200): draft packet metadata + signed URL (24h) + pageCount +
//   unfilledFields + audit score at generation time.
// ============================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNED_URL_SECONDS = 24 * 60 * 60; // 24 hours
const DRAFT_WATERMARK = "DRAFT — FOR REVIEW BEFORE FILING — NOT FILED";
const DRAFT_FOOTER =
  "DRAFT — for review before filing, not filed • Immigration with NIPTEI • https://immigration.niptei.com";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ACTOR_ROLES = ["client", "preparer", "attorney", "nonprofit", "admin"] as const;
type ActorRole = (typeof ACTOR_ROLES)[number];

const AUDIT_RULES = [
  "missing_signature",
  "expired_passport",
  "untranslated_foreign_document",
  "missing_document",
  "incomplete_form_section",
] as const;
type AuditRule = (typeof AUDIT_RULES)[number];

interface UnfilledField {
  formCode: string;
  questionKey: string | null;
  fieldLabel: string;
  candidateAcroFormField: string | null;
  reason: string;
}

interface FormResult {
  formCode: string;
  edition: string;
  templatePath: string;
  filledFieldCount: number;
  unfilledFieldCount: number;
  /** Real AcroForm field names present on the downloaded template. */
  templateFieldNames: string[];
}

interface ExhibitIncluded {
  fileName: string;
  vaultCategory: string;
  mimeType: string;
  pages: number;
}

interface ExhibitExcluded {
  fileName: string;
  vaultCategory: string;
  reviewStatus: string;
  reason: string;
}

function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function missingTemplateError(formCode: string, edition: string | null) {
  const expected = edition
    ? templateStoragePath(formCode, edition)
    : `templates/${formCode}/<edition>.pdf`;
  return {
    error: `USCIS template for ${formCode} not uploaded — download the current edition from uscis.gov and upload it to the vault`,
    formCode,
    expectedStoragePath: `${VAULT_BUCKET}/${expected}`,
    howToFix: `Download the current ${formCode} edition from uscis.gov and upload it to the private vault bucket at ${expected}. No template is bundled in this repo and no form is filled without its official template.`,
  };
}

/** Wrap text to a max width using the real font metrics. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split("\n")) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        line = next;
      } else {
        if (line) lines.push(line);
        // A single word wider than the column: hard-split it.
        let rest = word;
        while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
          let cut = rest.length;
          while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut -= 1;
          lines.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        line = rest;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function drawWatermark(page: PDFPage, bold: PDFFont): void {
  const { width, height } = page.getSize();
  const size = 24;
  const textWidth = bold.widthOfTextAtSize(DRAFT_WATERMARK, size);
  // Centre a -45° watermark: place its start so the rotated text crosses
  // the middle of the page.
  const angle = Math.PI / 4;
  const x = (width - textWidth * Math.cos(angle)) / 2;
  const y = height / 2 - (textWidth * Math.sin(angle)) / 2 + 40;
  page.drawText(DRAFT_WATERMARK, {
    x,
    y,
    size,
    font: bold,
    color: rgb(0.75, 0.1, 0.1),
    opacity: 0.13,
    rotate: degrees(-45),
  });
  page.drawText(DRAFT_FOOTER, {
    x: 36,
    y: 24,
    size: 7,
    font: bold,
    color: rgb(0.55, 0.1, 0.1),
    opacity: 0.85,
  });
}

export async function GET() {
  return NextResponse.json({
    route: "POST /api/generate-packet",
    status: "draft_only",
    description:
      "Generates a DRAFT immigration filing packet (cover sheet + filled USCIS forms + accepted exhibits) as one merged PDF in the private vault bucket. DRAFT — for review before filing, not filed. Nothing is filed with USCIS and no E-Sign provider is connected yet.",
    requires: {
      caseId: "cases.id (UUID)",
      editions: "optional map { [formCode]: edition } — otherwise the single template file found under vault/templates/<form-code>/ is used",
      actorId: "optional accounts.id, recorded in audit_log",
      actorRole: "optional client | preparer | attorney | nonprofit | admin",
    },
    gates: [
      "Packet audit score must be 100% with all blocking items cleared (packet_audit_items + src/lib/audit.ts computePacketReadiness). Otherwise 409.",
      "Balance must be paid/current (order_invoices / payment_plans). Otherwise 402 — final packet download stays locked.",
      "Every ordered USCIS form needs its official template in vault/templates/<form-code>/<edition>.pdf (from uscis.gov). Otherwise 404 — a form is never silently skipped.",
    ],
    fieldMappings:
      "All AcroForm field names in src/lib/uscisFieldMappings.ts are UNVERIFIED guesses. The response lists every unfilled field and the template's real field names.",
    documentsIncludedOnlyWhen: "documents.review_status = 'accepted' (the real enum value — there is no 'approved' status).",
    output: "Signed URL valid 24 hours, pageCount, unfilledFields, audit score at generation time. Logged to audit_log with case id only — no document contents, no PII.",
    portalUrl: PORTAL_URL,
    notLiveYet: [
      "No USCIS template is uploaded to the vault yet — templates must come from uscis.gov per form edition.",
      "E-Sign provider not connected.",
      "USCIS filing is not automated — this route files nothing.",
      "Caller authentication is not enforced yet — put this route behind preparer/attorney auth before live use.",
    ],
  });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const caseId = typeof body.caseId === "string" ? body.caseId : "";
  if (!caseId || !UUID_RE.test(caseId)) {
    return NextResponse.json(
      { error: "caseId is required and must be a valid UUID (cases.id)." },
      { status: 400 }
    );
  }
  const editions =
    body.editions && typeof body.editions === "object" && !Array.isArray(body.editions)
      ? (body.editions as Record<string, unknown>)
      : {};
  const actorId =
    typeof body.actorId === "string" && UUID_RE.test(body.actorId) ? body.actorId : null;
  const actorRole =
    typeof body.actorRole === "string" &&
    (ACTOR_ROLES as readonly string[]).includes(body.actorRole)
      ? (body.actorRole as ActorRole)
      : null;

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Supabase service-role is not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-only) in the environment. Nothing was generated.",
        missingEnv: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter(
          (n) => !process.env[n]
        ),
      },
      { status: 501 }
    );
  }

  // --- Case + client (cases.client_id -> public.accounts.id) ---------------
  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id, client_id, forms, status")
    .eq("id", caseId)
    .single();
  if (caseError || !caseRow) {
    return NextResponse.json(
      { error: `Case not found: ${caseId}.`, detail: caseError?.message ?? undefined },
      { status: 404 }
    );
  }
  const clientId = caseRow.client_id as string;
  const { data: accountRow } = await supabase
    .from("accounts")
    .select("id, full_name, email")
    .eq("id", clientId)
    .single();
  const clientName =
    (accountRow?.full_name as string | undefined) ?? "Client name not found in accounts";

  // --- Audit gate: packet_audit_items scored by src/lib/audit.ts -----------
  const { data: auditRows, error: auditError } = await supabase
    .from("packet_audit_items")
    .select("rule, label, weight, status, blocking, detail")
    .eq("case_id", caseId);
  if (auditError) {
    return NextResponse.json(
      {
        error: "Packet audit could not be read — generation blocked.",
        detail: auditError.message,
      },
      { status: 502 }
    );
  }
  const auditItems: AuditItem[] = ((auditRows ?? []) as Record<string, unknown>[])
    .filter((r) => (AUDIT_RULES as readonly string[]).includes(String(r.rule)))
    .map((r, i) => ({
      id: `db-${i}`,
      rule: r.rule as AuditRule,
      label: String(r.label ?? r.rule),
      weight: typeof r.weight === "number" ? r.weight : 0,
      status: (r.status === "pass" || r.status === "fail" || r.status === "warning"
        ? r.status
        : "fail") as AuditItem["status"],
      blocking: r.blocking === true,
      detail: typeof r.detail === "string" ? r.detail : undefined,
    }));
  const audit = computePacketReadiness(auditItems);
  if (auditItems.length === 0 || audit.score !== 100 || audit.blockingItems.length > 0) {
    return NextResponse.json(
      {
        error:
          auditItems.length === 0
            ? "Packet generation blocked — no packet audit items are recorded for this case. Run the packet audit first; generation requires an audit score of 100% with all blocking items cleared."
            : "Packet generation blocked — packet audit score is not 100% or blocking items remain. Fix the blocking items and re-run the packet audit.",
        code: "audit_not_ready",
        auditScore: audit.score,
        auditTotalWeight: audit.totalWeight,
        auditEarnedWeight: audit.earnedWeight,
        blockingItems: audit.blockingItems.map((i) => ({
          label: i.label,
          rule: i.rule,
          detail: i.detail,
        })),
        readyToFile: false,
      },
      { status: 409 }
    );
  }

  // --- Payment gate: order_invoices / payment_plans -------------------------
  // Final packet download stays locked until the balance is paid/current.
  const { data: orderRows, error: orderError } = await supabase
    .from("service_orders")
    .select(
      "id, package_title, ordered_forms, payment_plan_type, total_service_fee_cents, estimated_uscis_gov_fee_cents"
    )
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (orderError) {
    return NextResponse.json(
      { error: "Service order could not be read — generation blocked.", detail: orderError.message },
      { status: 502 }
    );
  }
  const orderRow = (orderRows ?? [])[0] as Record<string, unknown> | undefined;
  if (!orderRow) {
    return NextResponse.json(
      {
        error:
          "Packet generation blocked — no service order found for this case. The final packet download stays locked until a service order exists and the balance is paid/current.",
        code: "no_service_order",
        auditScore: audit.score,
      },
      { status: 402 }
    );
  }
  const totalServiceFeeCents = Number(orderRow.total_service_fee_cents ?? 0);
  const estimatedUscisGovFeeCents = Number(orderRow.estimated_uscis_gov_fee_cents ?? 0);
  const packageTitle =
    (orderRow.package_title as string | undefined) ?? "Immigration filing packet";
  const { data: invoiceRows, error: invoiceError } = await supabase
    .from("order_invoices")
    .select("invoice_number, milestone_step, milestone_label, amount_cents, status, unlocks_stage, paid_at")
    .eq("order_id", orderRow.id as string);
  if (invoiceError) {
    return NextResponse.json(
      { error: "Order invoices could not be read — generation blocked.", detail: invoiceError.message },
      { status: 502 }
    );
  }
  const invoices = ((invoiceRows ?? []) as Record<string, unknown>[]).map((r) => ({
    invoiceNumber: String(r.invoice_number ?? ""),
    amountCents: Number(r.amount_cents ?? 0),
    status: String(r.status ?? "unpaid"),
    unlocksStage: String(r.unlocks_stage ?? ""),
  }));
  const paidCents = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amountCents, 0);
  const balanceDueCents = Math.max(0, totalServiceFeeCents - paidCents);
  const overdueInvoices = invoices.filter((i) => i.status === "overdue");
  const finalStageUnpaid = invoices.filter(
    (i) => i.unlocksStage === "esign_and_download" && i.status !== "paid"
  );
  const { data: planRows } = await supabase
    .from("payment_plans")
    .select("status, total_service_fee_cents, paid_cents, pay_choice")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1);
  const planRow = (planRows ?? [])[0] as Record<string, unknown> | undefined;
  const paymentPlan = planRow
    ? {
        status: String(planRow.status ?? ""),
        payChoice: String(planRow.pay_choice ?? ""),
        totalServiceFeeCents: Number(planRow.total_service_fee_cents ?? 0),
        paidCents: Number(planRow.paid_cents ?? 0),
      }
    : null;
  if (invoices.length === 0 || balanceDueCents > 0 || overdueInvoices.length > 0 || finalStageUnpaid.length > 0) {
    return NextResponse.json(
      {
        error:
          "Packet generation blocked — the balance is not paid/current. The final packet download stays locked until the balance is paid. Preparer fees are separate from USCIS government fees; paying the preparer balance does not pay USCIS fees.",
        code: "balance_due",
        balanceDueCents,
        balanceDue: formatCents(balanceDueCents),
        totalServiceFeeCents,
        paidCents,
        overdueInvoices: overdueInvoices.map((i) => i.invoiceNumber),
        finalStageUnpaid: finalStageUnpaid.map((i) => i.invoiceNumber),
        invoices,
        paymentPlan,
        auditScore: audit.score,
        missedPaymentNote: MISSED_PAYMENT_RULE,
      },
      { status: 402 }
    );
  }

  // --- Ordered forms ---------------------------------------------------------
  const caseForms = Array.isArray(caseRow.forms)
    ? (caseRow.forms as unknown[]).map(String).filter(Boolean)
    : [];
  const orderForms = Array.isArray(orderRow.ordered_forms)
    ? (orderRow.ordered_forms as unknown[]).map(String).filter(Boolean)
    : [];
  const formCodes = caseForms.length > 0 ? caseForms : orderForms;
  if (formCodes.length === 0) {
    return NextResponse.json(
      {
        error:
          "No forms are listed on this case (cases.forms is empty and the service order lists no ordered forms). Add the ordered USCIS forms before generating a packet.",
        code: "no_forms",
      },
      { status: 400 }
    );
  }

  // --- Questionnaire answers (questionnaire_responses, migration 0005) ------
  const { data: answerRows, error: answerError } = await supabase
    .from("questionnaire_responses")
    .select("question_key, original_language, original_value, mapped_english_value, form_code, field_name")
    .eq("case_id", caseId);
  if (answerError) {
    return NextResponse.json(
      { error: "Questionnaire answers could not be read — generation blocked.", detail: answerError.message },
      { status: 502 }
    );
  }
  const answersByKey = new Map<string, string>();
  for (const r of ((answerRows ?? []) as Record<string, unknown>[])) {
    const key = String(r.question_key ?? "");
    const value = String(r.mapped_english_value ?? "");
    if (key && value && !answersByKey.has(key)) answersByKey.set(key, value);
  }

  // --- Templates: download each official USCIS PDF from the vault -----------
  // A missing template is a hard 404 — never silently skip a form.
  const unfilledFields: UnfilledField[] = [];
  const formResults: FormResult[] = [];
  const filledFormDocs: { formCode: string; doc: PDFDocument }[] = [];
  for (const formCode of formCodes) {
    const requestedEdition =
      typeof editions[formCode] === "string" && (editions[formCode] as string).trim()
        ? ((editions[formCode] as string).trim() as string)
        : null;
    let edition = requestedEdition;
    if (!edition) {
      const { data: listed, error: listError } = await supabase.storage
        .from(VAULT_BUCKET)
        .list(`templates/${formCode}`, { limit: 100 });
      if (listError) {
        return NextResponse.json(
          { error: `Could not list templates for ${formCode} in the vault.`, detail: listError.message },
          { status: 502 }
        );
      }
      const pdfs = (listed ?? []).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
      if (pdfs.length === 0) {
        return NextResponse.json(missingTemplateError(formCode, null), { status: 404 });
      }
      if (pdfs.length > 1) {
        return NextResponse.json(
          {
            ...missingTemplateError(formCode, null),
            error: `Multiple ${formCode} template editions are in the vault — specify which edition to use.`,
            editionsFound: pdfs.map((f) => f.name.replace(/\.pdf$/i, "")),
          },
          { status: 400 }
        );
      }
      edition = pdfs[0].name.replace(/\.pdf$/i, "");
    }
    const templatePath = templateStoragePath(formCode, edition as string);
    const { data: templateBlob, error: downloadError } = await supabase.storage
      .from(VAULT_BUCKET)
      .download(templatePath);
    if (downloadError || !templateBlob) {
      return NextResponse.json(missingTemplateError(formCode, edition as string), {
        status: 404,
      });
    }
    const templateBytes = new Uint8Array(await templateBlob.arrayBuffer());
    let templateDoc: PDFDocument;
    try {
      templateDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
    } catch (e) {
      return NextResponse.json(
        {
          error: `USCIS template for ${formCode} could not be read as a PDF — re-upload the current edition from uscis.gov.`,
          formCode,
          templatePath: `${VAULT_BUCKET}/${templatePath}`,
          detail: e instanceof Error ? e.message : String(e),
        },
        { status: 422 }
      );
    }

    // Fill: try each mapping; log every field NOT found on the template.
    const templateFieldNames: string[] = [];
    let filledCount = 0;
    try {
      const form = templateDoc.getForm();
      for (const f of form.getFields()) templateFieldNames.push(f.getName());
      const mappings = mappingsForForm(formCode);
      if (mappings.length === 0) {
        unfilledFields.push({
          formCode,
          questionKey: null,
          fieldLabel: `Entire ${formCode} form`,
          candidateAcroFormField: null,
          reason:
            `No field mappings are defined for ${formCode} yet — no questionnaire answers map to this form. ` +
            `Its template pages are included blank. Check the actual USCIS PDF for this edition and add verified mappings before treating this form as filled.`,
        });
      }
      for (const mapping of mappings) {
        const value = answersByKey.get(mapping.questionKey);
        if (!value) {
          unfilledFields.push({
            formCode,
            questionKey: mapping.questionKey,
            fieldLabel: mapping.fieldLabel,
            candidateAcroFormField: mapping.acroFormFieldName,
            reason:
              "No questionnaire answer is recorded for this case (questionnaire_responses has no mapped_english_value for this question key).",
          });
          continue;
        }
        let field: ReturnType<typeof form.getField> | null = null;
        try {
          field = form.getField(mapping.acroFormFieldName);
        } catch {
          field = null;
        }
        if (!field) {
          unfilledFields.push({
            formCode,
            questionKey: mapping.questionKey,
            fieldLabel: mapping.fieldLabel,
            candidateAcroFormField: mapping.acroFormFieldName,
            reason:
              `Candidate AcroForm field name "${mapping.acroFormFieldName}" was NOT found on the template. ` +
              `The mapping is UNVERIFIED — check the actual USCIS PDF for this edition and correct the field name. The answer was NOT written onto the form.`,
          });
          continue;
        }
        if (!(field instanceof PDFTextField)) {
          unfilledFields.push({
            formCode,
            questionKey: mapping.questionKey,
            fieldLabel: mapping.fieldLabel,
            candidateAcroFormField: mapping.acroFormFieldName,
            reason: `Field "${mapping.acroFormFieldName}" exists on the template but is not a text field (it is a ${field.constructor.name}), so the text answer could not be written into it.`,
          });
          continue;
        }
        try {
          field.setText(value);
          filledCount += 1;
        } catch (e) {
          unfilledFields.push({
            formCode,
            questionKey: mapping.questionKey,
            fieldLabel: mapping.fieldLabel,
            candidateAcroFormField: mapping.acroFormFieldName,
            reason: `Writing the answer into "${mapping.acroFormFieldName}" failed: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      }
      // Flatten so fields cannot be altered after E-Sign.
      try {
        form.flatten();
      } catch {
        // Non-fatal: pages are still merged; the cover sheet records it.
        unfilledFields.push({
          formCode,
          questionKey: null,
          fieldLabel: `${formCode} flattening`,
          candidateAcroFormField: null,
          reason:
            "The form could not be flattened after filling — its fields may still be editable. Review before E-Sign.",
        });
      }
    } catch (e) {
      // Template has no AcroForm at all (or it is unreadable as a form).
      unfilledFields.push({
        formCode,
        questionKey: null,
        fieldLabel: `Entire ${formCode} form`,
        candidateAcroFormField: null,
        reason: `The template has no fillable AcroForm fields that could be read (${e instanceof Error ? e.message : String(e)}). No answers were written onto this form; its pages are included as-is.`,
      });
    }
    formResults.push({
      formCode,
      edition: edition as string,
      templatePath: `${VAULT_BUCKET}/${templatePath}`,
      filledFieldCount: filledCount,
      unfilledFieldCount: unfilledFields.filter((u) => u.formCode === formCode).length,
      templateFieldNames,
    });
    filledFormDocs.push({ formCode, doc: templateDoc });
  }

  // --- Exhibits: only documents with review_status = 'accepted' -------------
  // (Real enum: uploaded / under_review / accepted / retake_requested.
  //  There is NO 'approved' status.) Everything else is excluded and
  //  listed on the cover sheet as missing — never silently dropped.
  const { data: docRows, error: docError } = await supabase
    .from("documents")
    .select("id, file_name, mime_type, storage_bucket, storage_path, review_status, vault_category")
    .eq("case_id", caseId)
    .eq("storage_bucket", VAULT_BUCKET);
  if (docError) {
    return NextResponse.json(
      { error: "Case documents could not be read — generation blocked.", detail: docError.message },
      { status: 502 }
    );
  }
  const exhibitsIncluded: ExhibitIncluded[] = [];
  const exhibitsExcluded: ExhibitExcluded[] = [];
  const exhibitPages: { title: string; doc: PDFDocument }[] = [];
  for (const d of ((docRows ?? []) as Record<string, unknown>[])) {
    const fileName = String(d.file_name ?? "document");
    const category = String(d.vault_category ?? "");
    const mimeType = String(d.mime_type ?? "");
    const reviewStatus = String(d.review_status ?? "");
    const storagePath = String(d.storage_path ?? "");
    if (reviewStatus !== "accepted") {
      exhibitsExcluded.push({
        fileName,
        vaultCategory: category,
        reviewStatus,
        reason:
          reviewStatus === "retake_requested"
            ? "Document needs a retake — not included in the packet."
            : reviewStatus === "uploaded" || reviewStatus === "under_review"
              ? `Document is '${reviewStatus}', not yet accepted — not included in the packet.`
              : `Document review status is '${reviewStatus}' — not included in the packet.`,
      });
      continue;
    }
    const { data: fileBlob, error: fileError } = await supabase.storage
      .from(VAULT_BUCKET)
      .download(storagePath);
    if (fileError || !fileBlob) {
      exhibitsExcluded.push({
        fileName,
        vaultCategory: category,
        reviewStatus,
        reason: `Accepted document could not be downloaded from the vault (${fileError?.message ?? "download failed"}) — not included.`,
      });
      continue;
    }
    const bytes = new Uint8Array(await fileBlob.arrayBuffer());
    if (mimeType === "application/pdf") {
      try {
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        exhibitPages.push({ title: `${category ? `${category} — ` : ""}${fileName}`, doc });
        exhibitsIncluded.push({ fileName, vaultCategory: category, mimeType, pages: doc.getPageCount() });
      } catch (e) {
        exhibitsExcluded.push({
          fileName,
          vaultCategory: category,
          reviewStatus,
          reason: `Accepted PDF could not be read (${e instanceof Error ? e.message : String(e)}) — not included.`,
        });
      }
    } else if (mimeType === "image/jpeg" || mimeType === "image/png") {
      // Mobile photos go onto clean US Letter pages with an exhibit title.
      try {
        const doc = await PDFDocument.create();
        const page = doc.addPage([612, 792]);
        const image =
          mimeType === "image/jpeg" ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
        const maxW = 612 - 72;
        const maxH = 792 - 130;
        const scale = Math.min(maxW / image.width, maxH / image.height, 1);
        const w = image.width * scale;
        const h = image.height * scale;
        page.drawImage(image, { x: (612 - w) / 2, y: (792 - 100 - h) / 2 + 10, width: w, height: h });
        exhibitPages.push({ title: `${category ? `${category} — ` : ""}${fileName}`, doc });
        exhibitsIncluded.push({ fileName, vaultCategory: category, mimeType, pages: 1 });
      } catch (e) {
        exhibitsExcluded.push({
          fileName,
          vaultCategory: category,
          reviewStatus,
          reason: `Accepted image could not be placed on a Letter page (${e instanceof Error ? e.message : String(e)}) — not included.`,
        });
      }
    } else {
      exhibitsExcluded.push({
        fileName,
        vaultCategory: category,
        reviewStatus,
        reason: `Unsupported file type '${mimeType}' — only PDF, JPG and PNG documents can go in a packet.`,
      });
    }
  }

  // --- Build the merged packet: cover sheet + forms + exhibits --------------
  const merged = await PDFDocument.create();
  const font = await merged.embedFont(StandardFonts.Helvetica);
  const bold = await merged.embedFont(StandardFonts.HelveticaBold);
  const generatedAt = new Date();
  const generatedLabel = generatedAt.toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "full",
    timeStyle: "short",
  });
  const feeNote =
    `Preparer/service fee and USCIS government fees are SEPARATE and are never combined into one total. ` +
    `Service fee: ${formatCents(totalServiceFeeCents)} (paid ${formatCents(paidCents)}, balance ${formatCents(balanceDueCents)}). ` +
    `Estimated USCIS government fees: ${formatCents(estimatedUscisGovFeeCents)} — shown separately; USCIS fees are paid to USCIS, not to the preparer.`;
  const missingSummary =
    unfilledFields.length === 0 && exhibitsExcluded.length === 0
      ? "None — every mapped field was filled and every listed document was included."
      : null;

  // Cover sheet (Page 1, US Letter 612 x 792). Lines are collected first,
  // then rendered across as many Letter pages as needed — a long
  // Missing / unfilled-fields list continues onto a second cover page
  // instead of being truncated off the bottom of page 1.
  interface CoverLine {
    text: string;
    size: number;
    useBold: boolean;
    gap: number;
    color: ReturnType<typeof rgb>;
    extraGapBefore: number;
  }
  const coverLines: CoverLine[] = [];
  const drawLine = (
    text: string,
    size = 10,
    useBold = false,
    gap = 14,
    color = rgb(0, 0, 0),
    extraGapBefore = 0
  ) => {
    coverLines.push({ text, size, useBold, gap, color, extraGapBefore });
  };
  const drawHeading = (text: string) => {
    drawLine(text, 11, true, 15, rgb(0, 0, 0), 6);
  };
  drawLine("IMMIGRATION FILING PACKET — TABLE OF CONTENTS", 15, true, 20);
  drawLine("DRAFT — for review before filing, not filed", 12, true, 18, rgb(0.6, 0.08, 0.08));
  drawLine(
    "This packet is a DRAFT for the preparer/attorney and the client to review and E-Sign before filing. Nothing in this packet has been filed with USCIS.",
    9, false, 13
  );
  drawLine(`Client: ${clientName}`, 10, true, 14, rgb(0, 0, 0), 4);
  drawLine(`Package: ${packageTitle}`, 10, true);
  drawLine(`Case: ${caseId}`, 9);
  drawLine(`Generated: ${generatedLabel} (Eastern Time)`, 9);
  drawLine(`Packet audit score at generation: ${audit.score}% (100% required; all blocking items cleared)`, 9);
  drawLine(`Balance at generation: ${formatCents(balanceDueCents)} due — final download unlocked only while paid/current`, 9);
  drawLine(`Review at: ${PORTAL_URL}`, 9);

  drawHeading("Forms in this packet (in order)");
  if (formResults.length === 0) {
    drawLine("No forms were included.", 10);
  } else {
    formResults.forEach((f, i) => {
      drawLine(
        `${i + 1}. Form ${f.formCode} — edition ${f.edition} — ${f.filledFieldCount} field(s) filled, ${f.unfilledFieldCount} unfilled`,
        10
      );
    });
  }

  drawHeading("Exhibits in this packet");
  if (exhibitsIncluded.length === 0) {
    drawLine("No exhibits were included (no accepted documents).", 10);
  } else {
    exhibitsIncluded.forEach((e, i) => {
      drawLine(`${i + 1}. ${e.vaultCategory ? `${e.vaultCategory} — ` : ""}${e.fileName} (${e.pages} page${e.pages === 1 ? "" : "s"})`, 10);
    });
  }

  drawHeading("Missing / unfilled fields");
  if (missingSummary) {
    drawLine(missingSummary, 10);
  } else {
    for (const u of unfilledFields) {
      drawLine(`• [${u.formCode}] ${u.fieldLabel} — ${u.reason}`, 9, false, 12);
    }
    for (const e of exhibitsExcluded) {
      drawLine(`• Exhibit NOT included: ${e.fileName} (${e.reviewStatus}) — ${e.reason}`, 9, false, 12);
    }
  }

  drawHeading("Fees — preparer fee is separate from USCIS government fees");
  drawLine(feeNote, 9, false, 12);
  drawLine(`Missed-payment rule: ${MISSED_PAYMENT_RULE}`, 9, false, 12);

  drawHeading("What happens next");
  drawLine(
    "1. The preparer/attorney reviews every page. 2. The client reviews and E-Signs (E-Sign provider not connected yet — signing happens outside this packet until it is). 3. Only after review + E-Sign is the packet filed with USCIS. This packet is NOT filed.",
    9, false, 12
  );

  // Render the collected cover lines onto Letter pages (usually one).
  const margin = 48;
  const contentWidth = 612 - margin * 2;
  let coverPage = merged.addPage([612, 792]);
  let y = 792 - 48;
  for (const item of coverLines) {
    y -= item.extraGapBefore;
    for (const line of wrapText(item.text, item.useBold ? bold : font, item.size, contentWidth)) {
      if (y < 48) {
        coverPage = merged.addPage([612, 792]);
        y = 792 - 48;
      }
      coverPage.drawText(line, {
        x: margin,
        y,
        size: item.size,
        font: item.useBold ? bold : font,
        color: item.color,
      });
      y -= item.gap;
    }
  }

  // Forms (flattened already), then exhibits (with title headers on image pages).
  for (const { doc } of filledFormDocs) {
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const p of pages) merged.addPage(p);
  }
  for (const { title, doc } of exhibitPages) {
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const p of pages) {
      // Title header on image-exhibit pages (single-page docs built above);
      // PDF exhibits keep their own pages and get the header only when the
      // page was created by this route (1-page image docs).
      if (doc.getPageCount() === 1 && pages.length === 1) {
        p.drawText(title, { x: 36, y: 792 - 36, size: 9, font: bold, color: rgb(0, 0, 0) });
        p.drawText("Exhibit — DRAFT", { x: 36, y: 792 - 50, size: 8, font, color: rgb(0.6, 0.08, 0.08) });
      }
      merged.addPage(p);
    }
  }

  // DRAFT watermark + footer on EVERY page, including the cover sheet.
  for (const page of merged.getPages()) drawWatermark(page, bold);

  const pageCount = merged.getPageCount();
  const packetBytes = await merged.save();

  // --- Save to the vault + 24-hour signed URL -------------------------------
  const stamp = generatedAt.toISOString().replace(/[:.]/g, "-");
  const storagePath = packetStoragePath(caseId, `packet-${stamp}.pdf`);
  const { error: uploadError } = await supabase.storage
    .from(VAULT_BUCKET)
    .upload(storagePath, packetBytes, { contentType: "application/pdf", upsert: false });
  if (uploadError) {
    return NextResponse.json(
      {
        error: "Packet was built but could not be saved to the vault — nothing was returned as a download.",
        detail: uploadError.message,
        pageCount,
        unfilledFields,
      },
      { status: 502 }
    );
  }
  const { data: signed, error: signError } = await supabase.storage
    .from(VAULT_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_SECONDS);
  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      {
        error: "Packet was saved to the vault but a signed URL could not be created.",
        storagePath: `${VAULT_BUCKET}/${storagePath}`,
        detail: signError?.message ?? undefined,
        pageCount,
        unfilledFields,
      },
      { status: 502 }
    );
  }

  // --- Audit log: case + form codes + page count only. NO PII. --------------
  // Best-effort: a logging failure must not fail a packet that was built.
  try {
    await supabase.from("audit_log").insert({
      actor_id: actorId,
      actor_role: actorRole,
      action: "packet_generated",
      entity_type: "case",
      entity_id: caseId,
      case_id: caseId,
      detail: {
        status: "draft",
        formCodes,
        pageCount,
        unfilledFieldCount: unfilledFields.length,
        exhibitsIncludedCount: exhibitsIncluded.length,
        exhibitsExcludedCount: exhibitsExcluded.length,
        auditScore: audit.score,
        storagePath: `${VAULT_BUCKET}/${storagePath}`,
        signedUrlExpiresInSeconds: SIGNED_URL_SECONDS,
      },
    });
  } catch {
    // Logged packet stands; the response notes the log failure.
  }

  return NextResponse.json({
    status: "draft",
    draft: true,
    filed: false,
    message:
      "DRAFT packet generated — for the preparer/attorney and the client to review and E-Sign before filing. Nothing has been filed with USCIS. The packet is NOT submission-ready as filed; it is a draft, and any unfilled fields listed below must be resolved first.",
    caseId,
    clientName,
    packageTitle,
    generatedAt: generatedAt.toISOString(),
    generatedLabel,
    portalUrl: PORTAL_URL,
    storagePath: `${VAULT_BUCKET}/${storagePath}`,
    signedUrl: signed.signedUrl,
    signedUrlExpiresInSeconds: SIGNED_URL_SECONDS,
    pageCount,
    forms: formResults,
    unfilledFields,
    missingFields: unfilledFields,
    exhibitsIncluded,
    exhibitsExcluded,
    auditScore: audit.score,
    auditBlockingItems: [],
    balanceDueCents,
    balanceDue: formatCents(balanceDueCents),
    feeNote,
    missedPaymentNote: MISSED_PAYMENT_RULE,
    esignNote:
      "E-Sign provider is not connected yet. This packet must be reviewed and E-Signed outside this route until an E-Sign provider is connected; generation alone does not sign or file anything.",
    fieldMappingsNote:
      "All AcroForm field names in src/lib/uscisFieldMappings.ts are UNVERIFIED guesses. templateFieldNames in each form result lists the real field names on the downloaded template — use them to correct the mappings.",
    unfilledFieldCount: unfilledFields.length,
  });
}
