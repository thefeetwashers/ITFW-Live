// GET /api/dashboard-summary?role=preparer|attorney|doj
// — Live lead + pipeline COUNTS for the professional dashboards.
//
// The dashboard embeds (src/components/dashboard/DashboardEmbeds.tsx)
// show these counts ON the dashboard, with links to the full /leads
// and /pipeline pages. This route exists because /api/leads and
// /api/pipeline both need an account id as a query parameter, which
// the dashboard does not know client-side: this route resolves the
// caller's own account id server-side from the Authorization token
// (accounts.auth_user_id, same pattern as /api/student/cases) and
// then counts only that provider's rows — nothing new is stored,
// and the full row lists still live behind /api/leads and
// /api/pipeline. Counts only: no names, emails, DOBs, or case detail
// are returned. Returns 501 / notConfigured when Supabase env vars
// are missing, 401 with no session, and honest zero counts (never
// invented rows) when the provider has no leads or clients yet.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const ROLES = ["preparer", "attorney", "doj"] as const;
type DashboardRole = (typeof ROLES)[number];

function clients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return null;
  return {
    anon: createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    admin: createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

export async function GET(req: Request) {
  const cs = clients();
  if (!cs) {
    return NextResponse.json(
      {
        error:
          "Dashboard summary not configured — NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are not set. No counts were loaded.",
        notConfigured: true,
      },
      { status: 501 }
    );
  }
  const role = new URL(req.url).searchParams.get("role") ?? "";
  if (!ROLES.includes(role as DashboardRole)) {
    return NextResponse.json(
      { error: `Role "${role}" is not recognised — use preparer, attorney or doj.` },
      { status: 400 }
    );
  }
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return NextResponse.json(
      { error: "Sign in first — no access token was sent." },
      { status: 401 }
    );
  }
  const { data: userData, error: userError } = await cs.anon.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json(
      { error: "Your login could not be verified. Sign in again." },
      { status: 401 }
    );
  }
  const { data: account, error: accountError } = await cs.admin
    .from("accounts")
    .select("id, role")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (accountError || !account) {
    return NextResponse.json(
      { error: "No Immigration account exists for this login." },
      { status: 403 }
    );
  }
  const providerId = (account as { id: string }).id;
  const assignedRole =
    role === "preparer" ? "preparer" : role === "attorney" ? "attorney" : "nonprofit";

  const [leadsRes, casesRes] = await Promise.all([
    cs.admin
      .from("preparer_leads")
      .select("id, pipeline_stage", { count: "exact" })
      .eq("preparer_id", providerId),
    cs.admin
      .from("cases")
      .select("id", { count: "exact" })
      .eq("assigned_provider_id", providerId)
      .eq("assigned_provider_role", assignedRole),
  ]);
  if (leadsRes.error) {
    return NextResponse.json(
      { error: `Could not count leads: ${leadsRes.error.message}.` },
      { status: 500 }
    );
  }
  if (casesRes.error) {
    return NextResponse.json(
      { error: `Could not count pipeline cases: ${casesRes.error.message}.` },
      { status: 500 }
    );
  }
  const leads = (leadsRes.data ?? []) as { pipeline_stage?: string }[];
  const caseIds = ((casesRes.data ?? []) as { id: string }[]).map((c) => c.id);
  let pipelineByStage: Record<string, number> = {};
  if (caseIds.length > 0) {
    const { data: lifecycle, error: lifecycleError } = await cs.admin
      .from("case_lifecycle")
      .select("case_id, stage")
      .in("case_id", caseIds)
      .eq("is_current", true);
    if (lifecycleError) {
      return NextResponse.json(
        { error: `Could not count pipeline stages: ${lifecycleError.message}.` },
        { status: 500 }
      );
    }
    for (const row of (lifecycle ?? []) as { stage?: string }[]) {
      const s = row.stage ?? "unknown";
      pipelineByStage[s] = (pipelineByStage[s] ?? 0) + 1;
    }
  }
  return NextResponse.json({
    ok: true,
    role,
    leadCount: leads.length,
    newLeads: leads.filter((l) => l.pipeline_stage === "new_lead").length,
    followUpsDue: leads.filter((l) => l.pipeline_stage === "follow_up_due").length,
    pipelineCount: caseIds.length,
    pipelineByStage,
    emptyState:
      leads.length === 0 && caseIds.length === 0
        ? "No leads and no clients in your pipeline yet — share your referral link to bring in your first enquiry."
        : null,
  });
}
