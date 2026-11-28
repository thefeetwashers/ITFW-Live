// Reads ?ref= / ?provider= from the URL and renders the Lead
// Generator funnel with them. Split out of app/leads/page.tsx so the
// page can wrap it in <Suspense> (required for useSearchParams).
"use client";

import { useSearchParams } from "next/navigation";
import LeadGenerator from "@/components/leads/LeadGenerator";

export default function LeadGeneratorFromParams() {
  const params = useSearchParams();
  const referralCode = params.get("ref");
  const providerSlug = params.get("provider");
  return <LeadGenerator referralCode={referralCode} providerSlug={providerSlug} />;
}
