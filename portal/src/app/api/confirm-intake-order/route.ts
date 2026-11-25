// POST /api/confirm-intake-order — Smart Guided Intake confirmation.
//
// What it does, in order:
//   (1) Finds the provider by slug in professional_profiles (NOT
//       `provider_profiles` — that table does not exist).
//   (2) Finds-or-creates the CLIENT via Supabase Auth + public.accounts
//       (role 'client', onboarding_status 'active', normal
//       email-confirmation flow). NEVER inserts a row directly into a
//       `users` table (none exists) and NEVER sets email_confirm: true.
//       A brand-new client is invited with inviteUserByEmail, so they
//       set their own password from the invite link.
//   (3) Creates the case in `cases` (status 'intake'). CORRECTION:
//       `cases` has NO pipeline_stage column — the pipeline stage lives
//       on preparer_leads (0010) and the lifecycle stage on
//       case_lifecycle (0010, stage 2 = payment_plan). This route
//       therefore writes preparer_leads.pipeline_stage = 'converted'
//       (a case now exists for the lead) and a case_lifecycle row with
//       stage 2, and stores the intake answers (goal / filing method /
//       speed / package title) in cases.pathfinder_route, which
//       parsePathfinderRoute() in lib/nextStepEngine.ts already reads.
//   (4) Creates service_orders + invoices + order_invoices +
//       payment_plans + payment_arrangements from the LOCKED tables
//       (0002 payment_plans + 0006 service_orders/order_invoices +
//       0009 payment_arrangements). Money is INTEGER CENTS everywhere.
//       The prep total is RE-COMPUTED server-side from
//       src/lib/intakeCalculator.ts — the browser sends picks, never
//       totals. payment_plan_type is one of the locked plans only
//       (full_upfront / installments_3 / monthly_6 / monthly_12);
//       there is NO split_50_50 plan for immigration. unlocks_stage is
//       one of the locked values (intake_and_docs / drafting /
//       esign_and_download) — 'all_stages' is not valid. Invoices are
//       created as 'draft': NO payment is taken here (Stripe checkout
//       is NOT connected); the professional sends a payment link.
//       Government fees are stored SEPARATELY
//       (estimated_uscis_gov_fee_cents = LOCKED gov fees only; TBC fees
//       are named, never counted) and are NEVER invoiced here — they
//       are paid directly to USCIS / the Department of State.
//   (5) Populates the checklist into inbox_items (type
//       'missing_document') + packet_audit_items via
//       insertChecklistRows() in src/lib/formChecklists.ts — NOT into
//       `documents` (a documents row is a real uploaded FILE; checklist
//       rows have no file yet, and inbox_items.document_id links to the
//       documents row only once a file is actually uploaded).
//   (6) Returns { caseId, redirectUrl: "/portal?caseId=..." } — the
//       client lands in the portal with invoice + checklist loaded,
//       and the order lands in that professional's Lead Sheet / pipeline
//       (preparer_leads, pipeline_stage 'converted').
//
// NOT LIVE until env vars are set: returns 501 / "not configured" and
// creates NOTHING when NEXT_PUBLIC_SUPABASE_URL or
// SUPABASE_SERVICE_ROLE_KEY is missing. CORRECTION: the env var is
// NEXT_PUBLIC_SUPABASE_URL — there is no SUPABASE_URL variable.
// On any failure AFTER the first write, created rows are removed
// best-effort (deleting the case cascades to its orders / invoices /
// plans / arrangements / lifecycle / checklist rows; the preparer_leads
// row is deleted explicitly) and the response says what was removed.
// The client Auth user / accounts row is NEVER deleted on failure:
// it may have existed before this request, and deleting an invited
// user would lock the client out.
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  validateIntakeOrder,
  payChoiceForPlan,
  formatDollars,
  type IntakeGoal,
  type BeneficiaryLocation,
  type FilingMethod,
  type SpeedId,
  type TierSelection,
  type PaymentPlanType,
} from "@/lib/intakeCalculator";
import { insertChecklistRows } from "@/lib/formChecklists";
import type { LanguageCode } from "@/lib/i18n";

export const runtime = "nodejs";

const LANGUAGE_CODES: readonly string[] = ["en", "es", "ht", "fr", "pt", "zh", "ar"];

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function unlocksStageForSlice(index: number, count: number): string {
  if (count === 1) return "intake_and_docs";
  if (index === 0) return "intake_and_docs";
  if (index === count - 1) return "esign_and_download";
  return "drafting";
}

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "Intake orders not configured — NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set. No client, case, order or invoice was created.",
        notConfigured: true,
      },
      { status: 501 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const tierSelections: TierSelection[] = Array.isArray(body.tierSelections)
    ? (body.tierSelections as unknown[]).map((s) => {
        const row = s as Record<string, unknown>;
        return { key: asString(row.key), tier: asString(row.tier) as TierSelection["tier"] };
      })
    : [];
  const preferredLanguage =
    typeof body.preferredLanguage === "string" && LANGUAGE_CODES.includes(body.preferredLanguage)
      ? (body.preferredLanguage as LanguageCode)
      : "en";

  let validated;
  try {
    validated = validateIntakeOrder({
      providerSlug: asString(body.providerSlug),
      goal: asString(body.goal) as IntakeGoal,
      beneficiaryLocation: (typeof body.beneficiaryLocation === "string" ? body.beneficiaryLocation : null) as BeneficiaryLocation | null,
      filingMethod: asString(body.filingMethod) as FilingMethod,
      speed: asString(body.speed) as SpeedId,
      tierSelections,
      paymentPlan: asString(body.paymentPlan) as PaymentPlanType,
      premiumProcessing: body.premiumProcessing === true,
      clientName: asString(body.clientName),
      clientEmail: asString(body.clientEmail),
      clientPhone: asString(body.clientPhone) || undefined,
      preferredLanguage,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Validation failed: ${e instanceof Error ? e.message : "invalid intake order."} Nothing was created.` },
      { status: 400 }
    );
  }

  const { determination, prep, lockedGovFeeCents, installments } = validated;
  if (prep.prepFeeCents === null) {
    return NextResponse.json(
      { error: "The order cannot be priced yet — a required tier is unpicked or has no locked price. Nothing was created." },
      { status: 400 }
    );
  }
  const prepTotalCents = prep.prepFeeCents;
  const paymentPlan = asString(body.paymentPlan) as PaymentPlanType;
  const clientEmail = asString(body.clientEmail);
  const clientName = asString(body.clientName);
  const clientPhone = asString(body.clientPhone) || null;
  const providerSlug = asString(body.providerSlug);

  // Reject tier picks for prep items that do not exist in this intake —
  // the server must not accept junk the calculator never offered.
  const knownKeys = new Set(determination.prepItems.map((i) => i.key));
  const unknownKeys = tierSelections.filter((s) => !knownKeys.has(s.key)).map((s) => s.key);
  if (unknownKeys.length > 0) {
    return NextResponse.json(
      { error: `Unknown prep item(s) in tierSelections: ${unknownKeys.join(", ")}. Nothing was created.` },
      { status: 400 }
    );
  }

  const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // (1) Provider by slug in professional_profiles.
  const { data: profile, error: profileError } = await admin
    .from("professional_profiles")
    .select("id, account_id, role, slug, is_published")
    .eq("slug", providerSlug)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json(
      { error: `Could not look up the professional: ${profileError.message}. Nothing was created.` },
      { status: 500 }
    );
  }
  const provider = profile as unknown as {
    id: string;
    account_id: string;
    role: "preparer" | "attorney" | "nonprofit";
    slug: string;
    is_published: boolean;
  } | null;
  if (!provider) {
    return NextResponse.json(
      { error: `No professional profile with slug "${providerSlug}". Nothing was created.` },
      { status: 404 }
    );
  }

  // (2) Find-or-create the CLIENT via Supabase Auth + public.accounts.
  let clientAccountId: string;
  let clientCreated = false;
  const { data: existingAccount, error: lookupError } = await admin
    .from("accounts")
    .select("id, auth_user_id")
    .eq("email", clientEmail)
    .maybeSingle();
  if (lookupError) {
    return NextResponse.json(
      { error: `Could not look up the client account: ${lookupError.message}. Nothing was created.` },
      { status: 500 }
    );
  }
  const existing = existingAccount as unknown as { id: string; auth_user_id: string } | null;
  if (existing) {
    clientAccountId = existing.id;
  } else {
    // Brand-new client: invite email — they set their own password from
    // the invite link. email_confirm is NEVER set to true; the normal
    // Supabase Auth email-confirmation flow applies.
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(clientEmail, {
      data: { full_name: clientName, role: "client" },
    });
    if (inviteError || !inviteData.user) {
      const msg = inviteError?.message ?? "unknown error";
      if (/already registered|already exists/i.test(msg)) {
        return NextResponse.json(
          {
            error:
              "An Auth account with this email already exists but has no client profile row — sign in with that email, or ask the admin to link it. No duplicate account was created.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: `Supabase Auth could not invite the client: ${msg}. Nothing was created.` },
        { status: 400 }
      );
    }
    const authUserId = inviteData.user.id;
    const { data: account, error: accountError } = await admin
      .from("accounts")
      .insert({
        auth_user_id: authUserId,
        role: "client",
        full_name: clientName,
        email: clientEmail,
        phone: clientPhone,
        preferred_language: preferredLanguage,
        is_verified: false,
        verification_status: "not_required",
        onboarding_status: "active",
      })
      .select("id")
      .single();
    if (accountError || !account) {
      return NextResponse.json(
        {
          error: `Client Auth user was invited, but the public.accounts row could not be written: ${accountError?.message ?? "unknown error"}. The Auth user exists — ask the admin to finish the profile; do not re-register with the same email.`,
        },
        { status: 500 }
      );
    }
    clientAccountId = (account as { id: string }).id;
    clientCreated = true;
  }

  // Everything from here on is written under one best-effort cleanup:
  // on failure the case is deleted (cascades to orders / invoices /
  // plans / arrangements / lifecycle / checklist rows) and the lead row
  // is deleted explicitly. The client account is never deleted.
  let caseId: string | null = null;
  let leadId: string | null = null;
  const fail = async (message: string, status = 500) => {
    if (caseId) {
      await admin.from("cases").delete().eq("id", caseId);
    }
    if (leadId) {
      await admin.from("preparer_leads").delete().eq("id", leadId);
    }
    return NextResponse.json(
      {
        error: `${message} Any case / order / invoice rows created by this request were removed; the client account was left untouched.`,
      },
      { status }
    );
  };

  try {
    // (3) Case. status 'intake' (cases.status enum) — there is no
    // pipeline_stage column on cases. The intake answers go in
    // pathfinder_route; the route key parses via parsePathfinderRoute().
    const routeValue =
      determination.goal === "family"
        ? determination.forms.includes("I-485")
          ? "inside_us"
          : "outside_us"
        : undefined;
    const { data: caseRow, error: caseError } = await admin
      .from("cases")
      .insert({
        client_id: clientAccountId,
        assigned_provider_id: provider.account_id,
        assigned_provider_role: provider.role,
        case_for: "myself",
        help_needed: "preparer",
        service_option: "preparer",
        forms: determination.forms,
        status: "intake",
        pathfinder_route: {
          ...(routeValue ? { route: routeValue } : {}),
          goal: determination.goal,
          filing_method: asString(body.filingMethod),
          speed: asString(body.speed),
          package_title: determination.packageTitle,
          premium_processing: body.premiumProcessing === true,
          intake_source: "smart-intake-calculator",
        },
      })
      .select("id")
      .single();
    if (caseError || !caseRow) throw new Error(`Case could not be created: ${caseError?.message ?? "unknown error"}.`);
    caseId = (caseRow as { id: string }).id;

    // (4a) service_orders — prep fee ONLY; gov fees separate.
    const tierSummary = determination.prepItems
      .map((item) => {
        const pick = tierSelections.find((s) => s.key === item.key);
        return pick ? `${item.key} ${pick.tier}` : `${item.key} (unpicked)`;
      })
      .join(", ");
    const packageTitle = `${determination.packageTitle} — ${tierSummary} — ${asString(body.speed)}`;
    const { data: orderRow, error: orderError } = await admin
      .from("service_orders")
      .insert({
        case_id: caseId,
        client_id: clientAccountId,
        provider_id: provider.account_id,
        package_title: packageTitle,
        ordered_forms: determination.forms,
        payment_plan_type: paymentPlan,
        total_service_fee_cents: prepTotalCents,
        estimated_uscis_gov_fee_cents: lockedGovFeeCents,
      })
      .select("id")
      .single();
    if (orderError || !orderRow) throw new Error(`Service order could not be created: ${orderError?.message ?? "unknown error"}.`);
    const orderId = (orderRow as { id: string }).id;
    const invoicePrefix = `INV-${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

    // (4b) invoices (0001, canonical) + order_invoices (0006, milestone
    // slices 1:1 linked via invoice_id). Invoices are 'draft' — no
    // payment is taken here; the professional sends a payment link.
    const invoiceNumbers: string[] = [];
    for (let i = 0; i < installments.length; i++) {
      const slice = installments[i];
      const invoiceNumber = `${invoicePrefix}-${i + 1}`;
      const { data: invoiceRow, error: invoiceError } = await admin
        .from("invoices")
        .insert({
          case_id: caseId,
          client_id: clientAccountId,
          provider_id: provider.account_id,
          description: `${packageTitle} — ${slice.label}`,
          form_code: determination.forms[0] ?? null,
          service_fee_cents: slice.amountCents,
          uscis_fee_cents: 0,
          status: "draft",
          due_at: new Date(`${slice.dueDate}T00:00:00.000Z`).toISOString(),
        })
        .select("id")
        .single();
      if (invoiceError || !invoiceRow) throw new Error(`Invoice ${invoiceNumber} could not be created: ${invoiceError?.message ?? "unknown error"}.`);
      const invoiceId = (invoiceRow as { id: string }).id;
      const { error: orderInvoiceError } = await admin.from("order_invoices").insert({
        order_id: orderId,
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        milestone_step: i + 1,
        milestone_label: slice.label,
        amount_cents: slice.amountCents,
        status: "unpaid",
        unlocks_stage: unlocksStageForSlice(i, installments.length),
      });
      if (orderInvoiceError) throw new Error(`Order invoice ${invoiceNumber} could not be created: ${orderInvoiceError.message}.`);
      invoiceNumbers.push(invoiceNumber);
    }

    // (4c) payment_plans (0002/0003) — pay_choice spelling: full_upfront
    // is stored as 'all_at_once'; all_at_once carries NO installment
    // amounts (0003 trigger), the other plans carry exactly 3 / 6 / 12.
    const { error: planError } = await admin.from("payment_plans").insert({
      case_id: caseId,
      client_id: clientAccountId,
      provider_id: provider.account_id,
      total_service_fee_cents: prepTotalCents,
      pay_choice: payChoiceForPlan(paymentPlan),
      installment_amounts_cents: paymentPlan === "full_upfront" ? [] : installments.map((s) => s.amountCents),
      paid_cents: 0,
      missed_payment_penalty_percent: 50,
      status: "active",
    });
    if (planError) throw new Error(`Payment plan could not be created: ${planError.message}.`);

    // (4d) payment_arrangements (0009) — auto-draft schedule mirroring
    // the order_invoices slices; it does NOT create a second total.
    const { error: arrangementError } = await admin.from("payment_arrangements").insert(
      installments.map((slice, i) => ({
        order_id: orderId,
        installment_number: i + 1,
        due_date: slice.dueDate,
        amount_cents: slice.amountCents,
        status: "scheduled",
      }))
    );
    if (arrangementError) throw new Error(`Payment arrangements could not be created: ${arrangementError.message}.`);

    // (4e) Lead Sheet landing: preparer_leads row for THIS professional,
    // pipeline_stage 'converted' (a case now exists). preparer_leads has
    // no case_id column, so the case id is carried in notes (known gap).
    const { data: leadRow, error: leadError } = await admin
      .from("preparer_leads")
      .insert({
        preparer_id: provider.account_id,
        full_name: clientName,
        email: clientEmail,
        phone: clientPhone,
        preferred_language: preferredLanguage,
        lead_source: `smart-intake /p/${providerSlug}`,
        service_interested: packageTitle,
        quoted_fee_cents: prepTotalCents,
        payment_plan_offered: paymentPlan,
        pipeline_stage: "converted",
        notes: `Smart Intake order — case_id ${caseId}. Prep fee ${formatDollars(prepTotalCents)} (${paymentPlan}); locked gov fees ${formatDollars(lockedGovFeeCents)} separate, never invoiced here. No payment taken — Stripe checkout is NOT connected; send a payment link for invoice ${invoiceNumbers[0] ?? ""}.`,
      })
      .select("id")
      .single();
    if (leadError || !leadRow) throw new Error(`Lead Sheet row could not be created: ${leadError?.message ?? "unknown error"}.`);
    leadId = (leadRow as { id: string }).id;

    // (4f) Lifecycle: stage 2 = payment_plan (0010 case_lifecycle).
    const { error: lifecycleError } = await admin.from("case_lifecycle").insert({
      case_id: caseId,
      stage: 2,
      is_current: true,
      stage_changed_by: provider.account_id,
    });
    if (lifecycleError) throw new Error(`Lifecycle stage could not be recorded: ${lifecycleError.message}.`);

    // (5) Checklist into inbox_items + packet_audit_items (NOT documents).
    const checklistTier =
      tierSelections.find((s) => determination.prepItems.some((i) => i.key === s.key && i.tierPrices))?.tier ?? "standard";
    let checklist: { templateId: string | null; insertedInboxItems: number; insertedAuditItems: number; errors: string[]; note?: string };
    if (!determination.templateId) {
      checklist = {
        templateId: null,
        insertedInboxItems: 0,
        insertedAuditItems: 0,
        errors: [],
        note: "No checklist template exists for standalone I-765 in src/lib/formChecklists.ts yet — TO BE CONFIRMED. No checklist rows were created; the professional adds the checklist by hand until a template exists.",
      };
    } else {
      const inserted = await insertChecklistRows(admin, {
        caseId,
        clientId: clientAccountId,
        requestedBy: provider.account_id,
        providerId: provider.account_id,
        templateId: determination.templateId,
        tier: checklistTier as "basic" | "standard" | "premium",
      });
      checklist = {
        templateId: inserted.templateId,
        insertedInboxItems: inserted.insertedInboxItems,
        insertedAuditItems: inserted.insertedAuditItems,
        errors: inserted.errors,
      };
      if (inserted.errors.length > 0) {
        throw new Error(`Checklist could not be fully created: ${inserted.errors.join(" ")}`);
      }
    }

    // (6) Redirect to the portal with the new case loaded.
    const tbcGovFees = determination.govFees.filter((f) => !f.locked).map((f) => f.label);
    return NextResponse.json(
      {
        ok: true,
        caseId,
        orderId,
        leadId,
        clientAccountId,
        clientCreated,
        providerSlug,
        providerIsPublished: provider.is_published,
        packageTitle,
        orderedForms: determination.forms,
        prepTotalCents,
        speedFeeCents: prep.speedFeeCents,
        lockedGovFeeCents,
        tbcGovFees,
        paymentPlan,
        installments,
        invoiceNumbers,
        invoiceStatus: "draft",
        checklist,
        lifecycleStage: 2,
        lifecycleStageLabel: "payment_plan",
        redirectUrl: `/portal?caseId=${caseId}`,
        paymentNote:
          "No payment was taken — Stripe checkout is NOT connected. Invoices are drafts; the professional sends a payment link for the first invoice. Government fees are paid separately, directly to USCIS / the Department of State.",
        premiumProcessing:
          body.premiumProcessing === true
            ? { added: true, feeCents: null, note: "Form I-907 $1,780 — TO BE CONFIRMED. Not added to any total." }
            : { added: false },
      },
      { status: 201 }
    );
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Intake order could not be completed.");
  }
}
