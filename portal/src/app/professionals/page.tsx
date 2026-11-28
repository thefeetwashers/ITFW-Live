import type { Metadata } from "next";
import { PUBLIC_PAGE_META } from "@/lib/seo";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";

export const metadata: Metadata = {
  title: PUBLIC_PAGE_META["/professionals"].title,
  description: PUBLIC_PAGE_META["/professionals"].description,
};
import {
  searchVerifiedProfessionals,
  profileFlatFeeForForm,
  storefrontUrl,
  verificationLabel,
  subscriptionPriceForRole,
  DIRECTORY_NOT_CONNECTED_NOTE,
  type DirectoryProfile,
} from "@/lib/verifiedDirectory";

const LANG_CODES = LANGUAGES.map((l) => l.code);

type ViewRow = {
  id: string;
  slug: string;
  account_id: string;
  full_name: string;
  company_name: string | null;
  role: string;
  bio: string | null;
  languages_spoken: LanguageCode[] | null;
  accepting_new_clients: boolean | null;
  practice_areas: string[] | null;
  accreditation_level: DirectoryProfile["accreditationLevel"];
};

type FeeRow = {
  profile_id: string;
  form_code: string;
  custom_fee_cents: number;
};

function isLangCode(v: string | undefined): v is LanguageCode {
  return !!v && (LANG_CODES as string[]).includes(v);
}

export default async function ProfessionalsPage({
  searchParams,
}: {
  searchParams: { lang?: string; form?: string; max?: string; role?: string };
}) {
  const supabase = getSupabase();

  const lang = isLangCode(searchParams.lang) ? searchParams.lang : undefined;
  const formCode = searchParams.form?.trim()
    ? searchParams.form.trim().toUpperCase()
    : undefined;
  const maxDollars = searchParams.max ? Number(searchParams.max) : NaN;
  const maxPriceCents =
    Number.isFinite(maxDollars) && maxDollars > 0
      ? Math.round(maxDollars * 100)
      : undefined;
  const role =
    searchParams.role === "preparer" ||
    searchParams.role === "attorney" ||
    searchParams.role === "nonprofit"
      ? searchParams.role
      : undefined;

  let profiles: DirectoryProfile[] = [];
  let loadError: string | null = null;
  if (!supabase) {
    loadError = DIRECTORY_NOT_CONNECTED_NOTE;
  } else {
    // The public_profiles VIEW (migration 0013) is the listing gate:
    // a row in the view IS a listed (verified-or-preparer, published,
    // active-subscription) profile. Safe columns only — no email,
    // phone, bar_number, eoir_number, or stripe_customer_id.
    const { data, error } = await supabase
      .from("public_profiles")
      .select(
        "id, slug, account_id, full_name, company_name, role, bio, languages_spoken, accepting_new_clients, practice_areas, accreditation_level"
      );
    if (error) {
      loadError = `Could not read the verified directory: ${error.message}`;
    } else {
      const rows = (data ?? []) as unknown as ViewRow[];
      // Flat per-form fees, best effort: the anon policy may not return
      // them (see migration 0013 note). Missing fees mean "no form
      // filter match" for that profile — never an invented price.
      let feesByProfile = new Map<string, FeeRow[]>();
      const { data: feeData } = await supabase
        .from("professional_form_fees")
        .select("profile_id, form_code, custom_fee_cents");
      for (const row of (feeData ?? []) as unknown as FeeRow[]) {
        const list = feesByProfile.get(row.profile_id) ?? [];
        list.push(row);
        feesByProfile.set(row.profile_id, list);
      }
      profiles = rows
        .filter(
          (r) =>
            r.role === "preparer" || r.role === "attorney" || r.role === "nonprofit"
        )
        .map((r) => ({
          id: r.id,
          slug: r.slug,
          fullName: r.full_name,
          companyName: r.company_name,
          role: r.role as DirectoryProfile["role"],
          bio: r.bio,
          languagesSpoken: r.languages_spoken ?? [],
          acceptingNewClients: r.accepting_new_clients ?? true,
          practiceAreas: r.practice_areas ?? [],
          accreditationLevel: r.accreditation_level,
          // Present in the view = passes the 0013 listing gate.
          isPublished: true,
          subscriptionStatus: "active",
          isVerified: true,
          verificationStatus: "verified",
          formFees: (feesByProfile.get(r.id) ?? []).map((f) => ({
            formCode: f.form_code,
            feeCents: f.custom_fee_cents,
          })),
        }));
    }
  }

  const search = loadError
    ? null
    : searchVerifiedProfessionals(profiles, {
        language: lang,
        formCode,
        maxPriceCents,
        role,
      });

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-bold">
          Find a Verified Professional — Flat Prices Only
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Only verified professionals are listed here. Unverified profiles
          are never shown. Every price is a flat locked price — never a
          percentage, never a per-lead fee. Immigration with NIPTEI — not a
          law firm, not affiliated with USCIS. Only a licensed attorney or
          DOJ-Accredited Representative gives legal advice (8 CFR 292.1).{" "}
          <Link href="/for-professionals" className="text-blue-700 underline">
            Are you a professional? See why to join →
          </Link>
        </p>

        <form
          method="get"
          className="mt-4 flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <label className="text-sm">
            Language{" "}
            <select name="lang" defaultValue={lang ?? ""} className="rounded border border-slate-300 px-2 py-1">
              <option value="">Any language</option>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native} ({l.label})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Form{" "}
            <input
              name="form"
              defaultValue={formCode ?? ""}
              placeholder="e.g. I-130"
              className="w-24 rounded border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="text-sm">
            Max price ($){" "}
            <input
              name="max"
              defaultValue={searchParams.max ?? ""}
              placeholder="e.g. 500"
              inputMode="decimal"
              className="w-24 rounded border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="text-sm">
            Role{" "}
            <select name="role" defaultValue={role ?? ""} className="rounded border border-slate-300 px-2 py-1">
              <option value="">Any role</option>
              <option value="preparer">Document preparer</option>
              <option value="attorney">Licensed attorney</option>
              <option value="nonprofit">DOJ-accredited nonprofit</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded bg-blue-700 px-3 py-1 text-sm font-medium text-white"
          >
            Search
          </button>
        </form>

        {loadError ? (
          <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {loadError}
          </p>
        ) : search ? (
          <section aria-labelledby="results-heading" className="mt-4">
            <h2 id="results-heading" className="text-base font-semibold">
              {search.results.length} verified professional
              {search.results.length === 1 ? "" : "s"}
              {search.totalListed > 0 ? ` (of ${search.totalListed} listed)` : ""}
            </h2>
            {search.emptyState ? (
              <p className="mt-2 rounded border border-slate-200 bg-white p-4 text-sm">
                {search.emptyState}
              </p>
            ) : (
              <ul className="mt-2 space-y-3">
                {search.results.map((p) => {
                  const sub = subscriptionPriceForRole(p.role, p.accreditationLevel);
                  const fee = formCode ? profileFlatFeeForForm(p, formCode) : null;
                  return (
                    <li
                      key={p.id}
                      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <h3 className="font-semibold">
                        <Link href={storefrontUrl(p)} className="text-blue-700 underline">
                          {p.fullName}
                        </Link>
                        {p.companyName ? ` — ${p.companyName}` : ""}
                      </h3>
                      <p className="mt-1 text-sm text-slate-700">{verificationLabel(p)}</p>
                      <p className="mt-1 text-sm text-slate-700">
                        {p.role === "preparer"
                          ? "Document preparer"
                          : p.role === "attorney"
                            ? "Licensed attorney"
                            : "DOJ-accredited nonprofit"}
                        {sub ? ` — ${sub.label}` : ""}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        Languages: {p.languagesSpoken.join(", ") || "Not listed"}
                      </p>
                      {fee !== null && (
                        <p className="mt-1 text-sm font-medium">
                          {formCode} flat fee: ${(fee / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                      )}
                      {p.bio ? <p className="mt-1 text-sm text-slate-600">{p.bio}</p> : null}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-500">
              {search.excludedUnverifiedCount > 0
                ? `${search.excludedUnverifiedCount} unverified profile(s) were excluded by the listing gate and are never shown. `
                : ""}
              Prices shown are flat amounts. Government (USCIS / NVC) fees are
              always separate — confirm them at uscis.gov/fees before you pay.
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
