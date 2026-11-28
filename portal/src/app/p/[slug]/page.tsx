"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import SmartIntakeCalculator from "@/components/SmartIntakeCalculator";
import EoirRosterLinks from "@/components/EoirRosterLinks";
import { NO_REVIEWS_YET, visibleReviews, type ReviewRow } from "@/lib/reviews";
import AskNipteiChat from "@/components/copilot/AskNipteiChat";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";
import { BUNDLE_TEMPLATES } from "@/lib/bundles";
import { splitInvoices } from "@/lib/stripe";
import { formTierPriceKey, getLockedPriceByKey } from "@/lib/stripePrices";
import CheckoutButton from "@/components/CheckoutButton";
import type { PaymentPlanType } from "@/lib/order";
import {
  BUNDLE_TIER_CENTS,
  DIY_PER_FORM_CENTS,
  REVIEW_PER_FORM_CENTS,
  HUMAN_REVIEW_CENTS,
  CONSULTATION_30MIN_CENTS,
  LOCKED_ADDONS,
  SECTION_TYPE_LABEL,
  SECTION_TYPES,
  SPOKEN_LABEL,
  USCIS_FEES_URL,
  formatCents,
  govFeeNoteFor,
  t,
  type SectionType,
  type ServiceLevel,
} from "@/lib/storefront";

// ---------------------------------------------------------------------------
// Public storefront — /p/<slug> — immigration.niptei.com/p/<slug>.
// Each VERIFIED professional gets their OWN storefront. A client opening
// the link can order that professional's service right there.
// Listing rule (migration 0013's public_profiles VIEW): is_published
// AND subscription active AND (preparer OR verified account). The view
// is the ONLY public projection of professional_profiles — the page
// never reads the base table as a visitor (that would expose
// stripe_customer_id / bar_number). Extra public storefront columns
// come from migration 0014's listed_profile_storefront RPC (SECURITY
// DEFINER, listed profiles only). Anything else shows "Pending
// verification — booking disabled" (owner view) or "No verified
// professional at this address" (visitor view) and NO order, quote,
// or booking form. UNVERIFIED profiles are NOT listed publicly and
// never show a fake verified badge.
//
// Ordering: the 5-step checkout (service → tier → payment plan →
// details → confirm) inserts ONE row into preparer_leads with
// preparer_id = THIS profile's account_id and pipeline_stage =
// 'new_lead' — i.e. it drops into that professional's Lead Sheet and
// case pipeline, and nobody else's. A cases row is created only when
// the professional converts the lead (migration 0010 pattern); the
// page never claims a case exists at order time. Quote requests and
// free-call requests go to the same Lead Sheet the same way.
//   * Stripe checkout: the locked form prep fee can be paid here via
//     /api/checkout (CheckoutButton, step 5, Pay in Full or Pay in 3).
//     Add-ons are the professional's own prices and are billed
//     separately. Until STRIPE_SECRET_KEY is set in Vercel, checkout
//     returns 501 and no payment is taken.
//   * The booking calendar is NOT connected — call requests are
//     collected, not booked; no calendar event is created.
//   * E-Sign is NOT connected.
// Photo/logo: uploaded by the owner to the private 'vault' bucket
// (photo_storage_path); the page mints a short-lived signed URL.
// No photo is ever invented — blank means no photo shown.
// Sections (storefront_sections) and add-ons (professional_addons) are
// migration 0014. If 0014 has not run yet, those queries fail and the
// page shows honest empty states instead of breaking.
// Edit mode: the signed-in owner of THIS slug (auth user -> accounts
// -> profile.account_id) can edit, save, preview, and publish their
// own storefront. Nobody can edit another slug — the panel only renders
// for the owner, and RLS enforces it server-side. Nothing publishes
// without the owner saving it.
// Isolation: every query on this page is scoped by slug -> profile ->
// account_id. A storefront shows ONLY this professional's services,
// sections, add-ons, reviews, and contact.
// No AHCA home-care licence anywhere on this page — it is not relevant
// to an immigration storefront.
// EXAMPLE DATA ONLY until a real verified row is read from Supabase.
// ---------------------------------------------------------------------------

interface ProfileRow {
  id: string;
  account_id: string;
  role: "preparer" | "attorney" | "nonprofit";
  company_name: string | null;
  slug: string;
  bio: string | null;
  languages_spoken: string[];
  is_published: boolean;
  subscription_plan: string;
  bar_number: string | null;
  bar_states: string[];
  eoir_number: string | null;
  accreditation_level: string | null;
  years_experience: number | null;
  service_area: unknown;
  updated_at: string | null;
}

interface ProfileStorefrontRow {
  display_name: string | null;
  photo_storage_path: string | null;
  public_phone: string | null;
  public_email: string | null;
  whatsapp_number: string | null;
  public_address_text: string | null;
  show_address: boolean;
  office_hours: string | null;
  is_law_student: boolean;
  supervising_attorney_name: string | null;
}

// One row of migration 0013's public_profiles VIEW (safe columns only).
interface ViewRow {
  id: string;
  slug: string;
  account_id: string;
  full_name: string;
  company_name: string | null;
  role: "preparer" | "attorney" | "nonprofit";
  bio: string | null;
  languages_spoken: string[];
  service_area: unknown;
  amenities: string[];
  accepting_new_clients: boolean;
  practice_areas: string[];
  accreditation_level: string | null;
}

interface AccountRow {
  full_name: string;
  verification_status: string;
  is_verified: boolean;
}

interface FormFeeRow {
  form_code: string;
  custom_fee_cents: number;
  is_offered: boolean;
}

interface SectionRow {
  id: string;
  professional_id: string;
  section_type: SectionType;
  title: string;
  body: string;
  sort_order: number;
  is_published: boolean;
}

interface AddonRow {
  id: string;
  professional_id: string;
  name: string;
  description: string;
  price_cents: number;
  is_locked_price: boolean;
  is_active: boolean;
  sort_order: number;
}

const PLAN_PRICE: Record<string, string> = {
  preparer_pro_49: "$49/mo",
  attorney_pro_99: "$99/mo",
  nonprofit_standard_24_50: "$24.50/mo",
  nonprofit_full_49_50: "$49.50/mo",
};

const PLAN_LABEL: Record<PaymentPlanType, string> = {
  full_upfront: "Pay in Full",
  installments_3: "Pay in 3",
  monthly_6: "Monthly — 6 months",
  monthly_12: "Monthly — 12 months",
};

function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

function roleBadge(profile: ProfileRow, sf: ProfileStorefrontRow | null): string {
  if (profile.role === "attorney") return "Licensed Immigration Attorney — Bar Verified";
  if (profile.role === "nonprofit")
    return profile.accreditation_level === "full_uscis_and_court"
      ? "DOJ-Accredited Nonprofit — Full"
      : "DOJ-Accredited Nonprofit — Partial";
  if (sf?.is_law_student) return "Law Student — Supervised Only";
  return "Document Preparer — Clerical Only";
}

function serviceAreaText(area: unknown): string | null {
  if (!area) return null;
  if (Array.isArray(area)) {
    const parts = area.filter((x): x is string => typeof x === "string" && x.trim() !== "");
    return parts.length > 0 ? parts.join(", ") : null;
  }
  if (typeof area === "object") {
    const obj = area as Record<string, unknown>;
    const states = obj.states ?? obj.service_states ?? obj.areas;
    if (Array.isArray(states)) {
      const parts = states.filter((x): x is string => typeof x === "string" && x.trim() !== "");
      if (parts.length > 0) return parts.join(", ");
    }
    if (typeof obj.label === "string" && obj.label.trim() !== "") return obj.label;
    if (typeof obj.description === "string" && obj.description.trim() !== "") return obj.description;
  }
  if (typeof area === "string" && area.trim() !== "") return area;
  return null;
}

/** Price (cents) of a service level for a form, or null when not offered. */
function levelPriceCents(formCode: string, level: ServiceLevel): number | null {
  if (level === "diy") return DIY_PER_FORM_CENTS;
  if (level === "review") return REVIEW_PER_FORM_CENTS;
  if (level === "human_review") return HUMAN_REVIEW_CENTS;
  const tpl = BUNDLE_TEMPLATES.find((b) => b.formCode === formCode);
  if (tpl?.serviceFee && "basic" in tpl.serviceFee) {
    const fee = tpl.serviceFee as { basic: number; standard: number; premium: number };
    return (fee[level] ?? 0) * 100;
  }
  if (tpl?.serviceFee && "flat" in tpl.serviceFee) return (tpl.serviceFee as { flat: number }).flat * 100;
  return BUNDLE_TIER_CENTS[level];
}

const LEVEL_LABEL: Record<ServiceLevel, string> = {
  diy: "DIY — $25 per form",
  review: "Review — $99 per form",
  human_review: "Human Review — $199",
  basic: "Basic — $999",
  standard: "Standard — $1,799",
  premium: "Premium — $2,799",
};

const LEVELS: ServiceLevel[] = ["diy", "review", "human_review", "basic", "standard", "premium"];

const inputCls = "mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm";

export default function PublicProfilePage({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const [status, setStatus] = useState<"loading" | "not_configured" | "not_found" | "pending" | "listed">(
    "loading"
  );
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [storefront, setStorefront] = useState<ProfileStorefrontRow | null>(null);
  const [account, setAccount] = useState<AccountRow | null>(null);
  const [formFees, setFormFees] = useState<FormFeeRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [addons, setAddons] = useState<AddonRow[]>([]);
  // Real reviews (migration 0017, reviews table) — visible + consented
  // rows only. Empty until a real client leaves one after a real case.
  const [realReviews, setRealReviews] = useState<ReviewRow[]>([]);
  const [storefrontTablesMissing, setStorefrontTablesMissing] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  // Storefront language picker (whole storefront translates).
  const [lang, setLang] = useState<LanguageCode>("en");

  // --- Edit mode (owner only) -------------------------------------------
  const [editOpen, setEditOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [eDisplayName, setEDisplayName] = useState("");
  const [eCompany, setECompany] = useState("");
  const [eBio, setEBio] = useState("");
  const [eLanguages, setELanguages] = useState<string[]>([]);
  const [eYears, setEYears] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [eEmail, setEEmail] = useState("");
  const [eWhatsapp, setEWhatsapp] = useState("");
  const [eAddress, setEAddress] = useState("");
  const [eShowAddress, setEShowAddress] = useState(false);
  const [eOfficeHours, setEOfficeHours] = useState("");
  const [eLawStudent, setELawStudent] = useState(false);
  const [eSupervisor, setESupervisor] = useState("");
  const [editSections, setEditSections] = useState<SectionRow[]>([]);
  const [editAddons, setEditAddons] = useState<AddonRow[]>([]);
  const [newSectionType, setNewSectionType] = useState<SectionType>("how_i_work");
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionBody, setNewSectionBody] = useState("");
  const [lockedAddonPick, setLockedAddonPick] = useState(LOCKED_ADDONS[0].name);
  const [customAddonName, setCustomAddonName] = useState("");
  const [customAddonPrice, setCustomAddonPrice] = useState("");
  const [customAddonDesc, setCustomAddonDesc] = useState("");

  // --- Quote request ------------------------------------------------------
  const [qName, setQName] = useState("");
  const [qEmail, setQEmail] = useState("");
  const [qPhone, setQPhone] = useState("");
  const [qLang, setQLang] = useState<LanguageCode>("en");
  const [qMessage, setQMessage] = useState("");
  const [quoteResult, setQuoteResult] = useState<string | null>(null);
  const [quoteSending, setQuoteSending] = useState(false);

  // --- Consultation request (collect only — calendar NOT connected) ---
  // Phone / video / in-person; free 15-min or 30-min $99 (not legal
  // advice unless from a licensed attorney). Price is shown up front.
  const [bName, setBName] = useState("");
  const [bEmail, setBEmail] = useState("");
  const [bPhone, setBPhone] = useState("");
  const [bType, setBType] = useState<"phone" | "video" | "in_person">("video");
  const [bLength, setBLength] = useState<15 | 30>(15);
  const [bTimePref, setBTimePref] = useState<"weekday" | "evening" | "weekend" | "any">("any");
  const [bLang, setBLang] = useState<LanguageCode>("en");
  const [bTz, setBTz] = useState("America/New_York");
  const [bWhen, setBWhen] = useState("");
  const [bookingResult, setBookingResult] = useState<string | null>(null);
  const [bookingSending, setBookingSending] = useState(false);
  // Referral landing: /r/<code> redirects here with ?ref=<code>.
  const [referralCode, setReferralCode] = useState<string | null>(null);
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) setReferralCode(ref);
  }, []);
  // Resolve the code to the referrer's account so the lead row records
  // who referred them (referrer_account_id), not just the code. If the
  // lookup fails (Supabase not connected / 0017 not run), the lead is
  // still recorded with referral_source 'Referral' + the code, and the
  // referrer stays null rather than invented.
  const [referrerAccountId, setReferrerAccountId] = useState<string | null>(null);
  useEffect(() => {
    if (!referralCode) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/referrals?code=${encodeURIComponent(referralCode)}`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data.referrerAccountId) {
          setReferrerAccountId(data.referrerAccountId as string);
        }
      } catch {
        // Unresolved — the code is still recorded on the lead row.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [referralCode]);

  // --- 5-step checkout ----------------------------------------------------
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [coStep, setCoStep] = useState(1);
  const [coForm, setCoForm] = useState("");
  const [coLevel, setCoLevel] = useState<ServiceLevel | null>(null);
  const [coPlan, setCoPlan] = useState<PaymentPlanType | null>(null);
  const [coAddonIds, setCoAddonIds] = useState<string[]>([]);
  const [coName, setCoName] = useState("");
  const [coEmail, setCoEmail] = useState("");
  const [coPhone, setCoPhone] = useState("");
  const [coLang, setCoLang] = useState<LanguageCode>("en");
  const [coResult, setCoResult] = useState<string | null>(null);
  const [coSending, setCoSending] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setStatus("not_configured");
      return;
    }
    void (async () => {
      // Public path (migration 0013): the public_profiles VIEW is the
      // only anon-readable projection. A view row means LISTED.
      let row: ProfileRow | null = null;
      let listed = false;
      const { data: viewData } = await supabase
        .from("public_profiles")
        .select(
          "id, slug, account_id, full_name, company_name, role, bio, languages_spoken, service_area, amenities, accepting_new_clients, practice_areas, accreditation_level"
        )
        .eq("slug", slug)
        .maybeSingle();
      const viewRow = (viewData as unknown as ViewRow | null) ?? null;
      if (viewRow) {
        listed = true;
        row = {
          id: viewRow.id,
          account_id: viewRow.account_id,
          role: viewRow.role,
          company_name: viewRow.company_name,
          slug: viewRow.slug,
          bio: viewRow.bio,
          languages_spoken: viewRow.languages_spoken ?? [],
          is_published: true,
          subscription_plan: "",
          bar_number: null,
          bar_states: [],
          eoir_number: null,
          accreditation_level: viewRow.accreditation_level,
          years_experience: null,
          service_area: viewRow.service_area,
          updated_at: null,
        };
        setAccount({
          full_name: viewRow.full_name,
          verification_status: "verified",
          is_verified: true,
        });
      } else {
        // No public row: try the base table (works only for the signed-in
        // owner/admin) so the owner still sees their pending state.
        const { data, error } = await supabase
          .from("professional_profiles")
          .select(
            "id, account_id, role, company_name, slug, bio, languages_spoken, is_published, subscription_plan, bar_number, bar_states, eoir_number, accreditation_level, years_experience, service_area, updated_at"
          )
          .eq("slug", slug)
          .maybeSingle();
        if (error) {
          setLoadError(`Could not read the directory: ${error.message}`);
          setStatus("not_found");
          return;
        }
        row = (data as unknown as ProfileRow | null) ?? null;
        if (!row) {
          setStatus("not_found");
          return;
        }
        const { data: acct } = await supabase
          .from("accounts")
          .select("full_name, verification_status, is_verified")
          .eq("id", row.account_id)
          .maybeSingle();
        setAccount((acct as unknown as AccountRow | null) ?? null);
      }
      setProfile(row);

      // Public storefront columns (migration 0014 RPC — SECURITY DEFINER,
      // listed profiles only). Tolerate failure: if 0014 has not run yet,
      // the page still renders the view fields.
      type SfRpcRow = ProfileStorefrontRow & {
        years_experience: number | null;
        bar_states: string[];
        updated_at: string | null;
      };
      const { data: sfData, error: sfError } = await supabase.rpc("listed_profile_storefront", {
        p_profile_id: row.id,
      });
      const sfRow =
        !sfError && Array.isArray(sfData) && sfData.length > 0
          ? (sfData[0] as unknown as SfRpcRow)
          : null;
      if (sfRow) {
        setStorefront(sfRow);
        setProfile({
          ...row,
          years_experience: sfRow.years_experience,
          bar_states: sfRow.bar_states ?? [],
          updated_at: sfRow.updated_at,
        });
        if (sfRow.photo_storage_path) {
          const { data: signed } = await supabase.storage
            .from("vault")
            .createSignedUrl(sfRow.photo_storage_path, 3600);
          if (signed?.signedUrl) setPhotoUrl(signed.signedUrl);
        }
      }

      const { data: fees } = await supabase
        .from("professional_form_fees")
        .select("form_code, custom_fee_cents, is_offered")
        .eq("profile_id", row.id)
        .eq("is_offered", true);
      setFormFees(((fees as unknown as FormFeeRow[]) ?? []).filter((f) => f.is_offered));

      // Sections + add-ons (migration 0014). Missing table = honest
      // empty state, not a crash.
      const { data: sec, error: secError } = await supabase
        .from("storefront_sections")
        .select("id, professional_id, section_type, title, body, sort_order, is_published")
        .eq("professional_id", row.account_id)
        .order("sort_order", { ascending: true });
      if (secError) {
        setStorefrontTablesMissing(true);
        setSections([]);
      } else {
        setSections((sec as unknown as SectionRow[]) ?? []);
      }
      const { data: ad, error: adError } = await supabase
        .from("professional_addons")
        .select("id, professional_id, name, description, price_cents, is_locked_price, is_active, sort_order")
        .eq("professional_id", row.account_id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (adError) {
        setStorefrontTablesMissing(true);
        setAddons([]);
      } else {
        setAddons((ad as unknown as AddonRow[]) ?? []);
      }

      // Real reviews (migration 0017). Missing table (0017 not run
      // yet) = honest empty state, not a crash and never an invented
      // review. Only visible rows the client consented to show.
      const { data: rev, error: revError } = await supabase
        .from("reviews")
        .select(
          "id, case_id, professional_account_id, client_account_id, service_form_code, service_name, rating, body, consent_given, display_name_choice, display_name, reply_text, replied_at, replied_by, visible, hidden_by, hidden_reason, hidden_at, created_at"
        )
        .eq("professional_account_id", row.account_id)
        .eq("visible", true)
        .eq("consent_given", true)
        .order("created_at", { ascending: false });
      setRealReviews(
        revError ? [] : visibleReviews((rev as unknown as ReviewRow[]) ?? [])
      );

      // Owner check: signed-in user whose accounts row is this profile.
      try {
        const { data: userData } = await supabase.auth.getUser();
        const authUserId = userData?.user?.id;
        if (authUserId) {
          const { data: ownAcct } = await supabase
            .from("accounts")
            .select("id")
            .eq("auth_user_id", authUserId)
            .maybeSingle();
          const ownId = (ownAcct as unknown as { id: string } | null)?.id;
          if (ownId && ownId === row.account_id) {
            setIsOwner(true);
            setEditSections((sec as unknown as SectionRow[]) ?? []);
            setEditAddons((ad as unknown as AddonRow[]) ?? []);
            setEDisplayName(sfRow?.display_name ?? "");
            setECompany(row.company_name ?? "");
            setEBio(row.bio ?? "");
            setELanguages(row.languages_spoken ?? []);
            setEYears(row.years_experience != null ? String(row.years_experience) : "");
            setEPhone(sfRow?.public_phone ?? "");
            setEEmail(sfRow?.public_email ?? "");
            setEWhatsapp(sfRow?.whatsapp_number ?? "");
            setEAddress(sfRow?.public_address_text ?? "");
            setEShowAddress(sfRow?.show_address ?? false);
            setEOfficeHours(sfRow?.office_hours ?? "");
            setELawStudent(sfRow?.is_law_student ?? false);
            setESupervisor(
              sfRow?.supervising_attorney_name ?? ""
            );
          }
        }
      } catch {
        // Not signed in (or auth unavailable) — visitor view only.
      }

      // The 0013 view row IS the listing gate: present = listed.
      setStatus(listed ? "listed" : "pending");
    })();
  }, [slug]);

  const displayName =
    storefront?.display_name?.trim()
      ? storefront.display_name
      : profile?.role === "nonprofit"
        ? (profile?.company_name ?? account?.full_name ?? "Example Organization")
        : (account?.full_name ?? profile?.company_name ?? "Example Professional");

  const publishedSections = sections.filter((s) => s.is_published);
  const visibleSections = previewMode ? sections : publishedSections;
  const reviewSections = visibleSections.filter((s) => s.section_type === "reviews");
  const otherSections = visibleSections.filter((s) => s.section_type !== "reviews");
  const selectedAddons = addons.filter((a) => coAddonIds.includes(a.id));
  const coLevelPrice = coForm && coLevel ? levelPriceCents(coForm, coLevel) : null;
  const coAddonsTotal = selectedAddons.reduce((s, a) => s + a.price_cents, 0);
  const coTotal = (coLevelPrice ?? 0) + coAddonsTotal;

  /** Insert one row into this professional's Lead Sheet (preparer_leads).
   *  When referral is given, the row is recorded with
   *  referral_source = 'Referral' + the referrer (migration 0017). */
  const insertLead = async (lead: {
    fullName: string;
    email: string;
    phone: string;
    preferredLanguage: LanguageCode;
    serviceInterested: string;
    quotedFeeCents: number | null;
    paymentPlan: PaymentPlanType | null;
    notes: string;
    referral?: { code: string; referrerAccountId: string | null };
  }): Promise<{ ok: boolean; message: string }> => {
    const supabase = getSupabase();
    if (!supabase || !profile) {
      return {
        ok: false,
        message:
          "Not stored — Supabase is not connected, so this request was NOT sent. It is queued on this screen only. Please email the professional directly instead.",
      };
    }
    const insert: Record<string, unknown> = {
      preparer_id: profile.account_id,
      full_name: lead.fullName.trim(),
      email: lead.email.trim(),
      phone: lead.phone.trim() || null,
      preferred_language: lead.preferredLanguage,
      lead_source: `storefront /p/${slug}`,
      service_interested: lead.serviceInterested,
      quoted_fee_cents: lead.quotedFeeCents,
      pipeline_stage: "new_lead",
      notes: lead.notes,
    };
    if (lead.paymentPlan) insert.payment_plan_offered = lead.paymentPlan;
    if (lead.referral) {
      // Migration 0017 columns. If 0017 has not run yet the insert
      // fails with a column error and the message below says so.
      insert.referral_source = "Referral";
      insert.referral_code = lead.referral.code;
      if (lead.referral.referrerAccountId)
        insert.referrer_account_id = lead.referral.referrerAccountId;
    }
    const { error } = await supabase.from("preparer_leads").insert(insert);
    if (error) {
      return {
        ok: false,
        message: `Could NOT be stored: ${error.message}. Nothing was sent to the professional — please contact them directly (see Contact above). If this keeps happening, the storefront database update (migration 0014) may not have run yet.`,
      };
    }
    return { ok: true, message: "Recorded in this professional's Lead Sheet." };
  };

  const submitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuoteResult(null);
    if (!qName.trim() || !qEmail.trim() || !qMessage.trim() || !profile) return;
    setQuoteSending(true);
    const res = await insertLead({
      fullName: qName,
      email: qEmail,
      phone: qPhone,
      preferredLanguage: qLang,
      serviceInterested: "Quote request",
      quotedFeeCents: null,
      paymentPlan: null,
      notes: `Quote request from storefront /p/${slug} (${displayName}): ${qMessage.trim()}`,
      ...(referralCode
        ? { referral: { code: referralCode, referrerAccountId } }
        : {}),
    });
    setQuoteSending(false);
    setQuoteResult(
      res.ok
        ? "Quote request recorded in this professional's Lead Sheet. They will reply to your email. (A case is created only when they convert your request — nothing is filed yet.)"
        : res.message
    );
    if (res.ok) {
      setQName("");
      setQEmail("");
      setQPhone("");
      setQMessage("");
    }
  };

  const submitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingResult(null);
    if (!bName.trim() || !bEmail.trim() || !profile) return;
    setBookingSending(true);
    const res = await insertLead({
      fullName: bName,
      email: bEmail,
      phone: bPhone,
      preferredLanguage: bLang,
      serviceInterested:
        bLength === 15 ? "Free 15-min call request" : "30-min consultation request ($99)",
      quotedFeeCents: bLength === 15 ? null : 9900,
      paymentPlan: null,
      notes: `${bLength === 15 ? "Free 15-min" : "30-min ($99)"} call request from storefront /p/${slug}: ${bType} consultation, time preference ${bTimePref}, preferred time "${bWhen.trim() || "not given"}", timezone ${bTz}. Calendar NOT connected — request collected only; the professional confirms the time directly.`,
      ...(referralCode
        ? { referral: { code: referralCode, referrerAccountId } }
        : {}),
    });
    setBookingSending(false);
    setBookingResult(
      res.ok
        ? `Call request collected: ${bName.trim()} — ${bType} consultation (${bLength} min${bLength === 30 ? ", $99" : ", free"}), time preference ${bTimePref}, preferred time "${bWhen.trim() || "not given"}" (${bTz}). The booking calendar is NOT connected, so no booking was made and no calendar event was created; the professional confirms the time with you directly.`
        : res.message
    );
    if (res.ok) {
      setBName("");
      setBEmail("");
      setBPhone("");
      setBWhen("");
    }
  };

  const startOrder = (formCode: string) => {
    setCoForm(formCode);
    setCoLevel(null);
    setCoPlan(null);
    setCoStep(1);
    setCoResult(null);
    setCheckoutOpen(true);
  };

  const submitOrder = async () => {
    setCoResult(null);
    if (!coForm || !coLevel || !coPlan || !coName.trim() || !coEmail.trim() || !profile) return;
    setCoSending(true);
    const addonText =
      selectedAddons.length > 0
        ? ` Add-ons: ${selectedAddons.map((a) => `${a.name} (${formatCents(a.price_cents)})`).join(", ")}.`
        : " No add-ons.";
    const res = await insertLead({
      fullName: coName,
      email: coEmail,
      phone: coPhone,
      preferredLanguage: coLang,
      serviceInterested: `Storefront order: ${coForm} — ${LEVEL_LABEL[coLevel]}`,
      quotedFeeCents: coTotal,
      paymentPlan: coPlan,
      notes:
        `Order from storefront /p/${slug} (${displayName}). Service ${coForm}, tier ${LEVEL_LABEL[coLevel]} ` +
        `(prep fee ${formatCents(coLevelPrice ?? 0)}).${addonText} ` +
        `Payment plan: ${PLAN_LABEL[coPlan]}. Total prep + add-ons: ${formatCents(coTotal)}. ` +
        `USCIS/NVC government fees are SEPARATE — ${govFeeNoteFor(coForm)} ` +
        `Stripe checkout is NOT connected, so no payment was taken. The professional confirms the order and sends a payment link. ` +
        `A case is created only when the professional converts this lead.`,
      ...(referralCode
        ? { referral: { code: referralCode, referrerAccountId } }
        : {}),
    });
    setCoSending(false);
    if (res.ok) {
      setCoResult(
        `Order recorded in ${displayName}'s Lead Sheet — prep + add-ons ${formatCents(coTotal)} (${PLAN_LABEL[coPlan]}). No payment was taken: Stripe checkout is NOT connected, so the professional will confirm your order and send a payment link. USCIS/NVC government fees are separate — ${govFeeNoteFor(coForm)} A case is created only when the professional converts your order.`
      );
      setCheckoutOpen(false);
      setCoStep(1);
      setCoLevel(null);
      setCoPlan(null);
      setCoAddonIds([]);
    } else {
      setCoResult(res.message);
    }
  };

  // --- Owner edit-mode saves ------------------------------------------------
  const saveProfileEdits = async () => {
    setEditMsg(null);
    const supabase = getSupabase();
    if (!supabase || !profile) return;
    if (eLawStudent && !eSupervisor.trim()) {
      setEditMsg("Law Student — Supervised Only requires the supervising attorney's name.");
      return;
    }
    setEditSaving(true);
    const { error: pErr } = await supabase
      .from("professional_profiles")
      .update({
        display_name: eDisplayName.trim() || null,
        company_name: eCompany.trim() || null,
        bio: eBio.trim() || null,
        languages_spoken: eLanguages,
        years_experience: eYears.trim() === "" ? null : Math.max(0, parseInt(eYears, 10) || 0),
        public_phone: ePhone.trim() || null,
        public_email: eEmail.trim() || null,
        whatsapp_number: eWhatsapp.trim() || null,
        public_address_text: eAddress.trim() || null,
        show_address: eShowAddress,
        office_hours: eOfficeHours.trim() || null,
        is_law_student: eLawStudent,
        supervising_attorney_name: eLawStudent ? eSupervisor.trim() : null,
      })
      .eq("id", profile.id);
    setEditSaving(false);
    if (pErr) {
      setEditMsg(`Profile could NOT be saved: ${pErr.message}. (If the storefront columns are missing, migration 0014 has not run yet.)`);
      return;
    }
    setEditMsg("Profile saved as a draft — it is NOT published until you press Publish below. Reload the page to see it as visitors do.");
  };

  const saveSections = async () => {
    setEditMsg(null);
    const supabase = getSupabase();
    if (!supabase || !profile) return;
    setEditSaving(true);
    const { error } = await supabase
      .from("storefront_sections")
      .upsert(
        editSections.map((s, i) => ({
          id: s.id,
          professional_id: profile.account_id,
          section_type: s.section_type,
          title: s.title,
          body: s.body,
          sort_order: i,
          is_published: s.is_published,
        })),
        { onConflict: "id" }
      );
    // Delete rows the owner removed in the editor.
    const kept = new Set(editSections.map((s) => s.id));
    const removed = sections.filter((s) => !kept.has(s.id));
    let delErr: string | null = null;
    for (const r of removed) {
      const { error: dErr } = await supabase.from("storefront_sections").delete().eq("id", r.id);
      if (dErr) delErr = dErr.message;
    }
    setEditSaving(false);
    if (error || delErr) {
      setEditMsg(`Sections could NOT be saved: ${error?.message ?? delErr}. (Migration 0014 may not have run yet.)`);
      return;
    }
    setSections(editSections.map((s, i) => ({ ...s, sort_order: i })));
    setEditMsg("Sections saved as a draft — unpublished sections stay hidden from visitors until you tick Published and save again.");
  };

  const saveAddons = async () => {
    setEditMsg(null);
    const supabase = getSupabase();
    if (!supabase || !profile) return;
    setEditSaving(true);
    const { error } = await supabase
      .from("professional_addons")
      .upsert(
        editAddons.map((a, i) => ({
          id: a.id,
          professional_id: profile.account_id,
          name: a.name,
          description: a.description,
          price_cents: a.price_cents,
          is_locked_price: a.is_locked_price,
          is_active: a.is_active,
          sort_order: i,
        })),
        { onConflict: "id" }
      );
    const kept = new Set(editAddons.map((a) => a.id));
    const removed = addons.filter((a) => !kept.has(a.id));
    let delErr: string | null = null;
    for (const r of removed) {
      const { error: dErr } = await supabase.from("professional_addons").delete().eq("id", r.id);
      if (dErr) delErr = dErr.message;
    }
    setEditSaving(false);
    if (error || delErr) {
      setEditMsg(`Add-ons could NOT be saved: ${error?.message ?? delErr}. (Migration 0014 may not have run yet.)`);
      return;
    }
    setAddons(editAddons.filter((a) => a.is_active).map((a, i) => ({ ...a, sort_order: i })));
    setEditMsg("Add-ons saved. Locked prices cannot be changed — only the professional's own custom add-ons carry a price they set.");
  };

  const setPublished = async (publish: boolean) => {
    setEditMsg(null);
    const supabase = getSupabase();
    if (!supabase || !profile) return;
    const { error } = await supabase
      .from("professional_profiles")
      .update({ is_published: publish })
      .eq("id", profile.id);
    if (error) {
      setEditMsg(`Publish state could NOT be changed: ${error.message}`);
      return;
    }
    setProfile({ ...profile, is_published: publish });
    setEditMsg(
      publish
        ? "Published — visitors now see your saved storefront."
        : "Unpublished — visitors no longer see this storefront. Your saved draft is kept."
    );
  };

  const uploadPhoto = async (file: File) => {
    setEditMsg(null);
    const supabase = getSupabase();
    if (!supabase || !profile) return;
    const path = `storefront-photos/${profile.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("vault").upload(path, file, { upsert: false });
    if (upErr) {
      setEditMsg(`Photo could NOT be uploaded: ${upErr.message}. The private 'vault' bucket (or its upload policy) may not be set up yet — no photo was saved.`);
      return;
    }
    const { error: updErr } = await supabase
      .from("professional_profiles")
      .update({ photo_storage_path: path })
      .eq("id", profile.id);
    if (updErr) {
      setEditMsg(`Photo uploaded to the vault but the profile could NOT be updated: ${updErr.message}. (Migration 0014 may not have run yet.)`);
      return;
    }
    setStorefront({ ...(storefront ?? {
      display_name: null, photo_storage_path: null, public_phone: null, public_email: null,
      whatsapp_number: null, public_address_text: null, show_address: false, office_hours: null,
      is_law_student: false, supervising_attorney_name: null,
    }), photo_storage_path: path });
    const { data: signed } = await supabase.storage.from("vault").createSignedUrl(path, 3600);
    if (signed?.signedUrl) setPhotoUrl(signed.signedUrl);
    setEditMsg("Photo saved to the private vault. Save your profile, then Publish, for visitors to see it.");
  };

  const whatsappDigits = storefront?.whatsapp_number?.replace(/[^0-9]/g, "") ?? "";
  const editedDate = profile?.updated_at
    ? new Date(profile.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-slate-900">
      <p className="text-sm">
        <Link href="/" className="text-blue-600 underline">
          ← Immigration with NIPTEI
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-bold">
        Professional profile: <span className="font-mono">immigration.niptei.com/p/{slug}</span>
      </h1>

      {/* Language picker — whole storefront translates. */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm">
        <label htmlFor="storefront-lang" className="font-medium">Storefront language:</label>
        <select
          id="storefront-lang"
          value={lang}
          onChange={(e) => setLang(e.target.value as LanguageCode)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label} — {l.native}
            </option>
          ))}
        </select>
        <span className="text-slate-500">
          {lang === "en" ? "Showing this storefront in English." : `Showing this storefront in ${languageLabel(lang)}.`}
        </span>
      </div>

      {status === "loading" && (
        <p className="mt-4 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
          Looking up this profile…
        </p>
      )}

      {status === "not_configured" && (
        <div className="mt-4 space-y-4">
          <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            Directory not live — Supabase is not connected in this build, so no real profile can
            be looked up. Below is a clearly-labelled EXAMPLE of what a verified storefront shows.
            No real person, no verified bar number.
          </p>
          <div className="rounded border border-slate-300 bg-white p-5">
            <p className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-900">
              EXAMPLE ONLY — not a real person, not verified
            </p>
            <h2 className="mt-2 text-xl font-bold">Example Attorney</h2>
            <p className="mt-1 text-sm font-semibold">Licensed Immigration Attorney — Bar Verified</p>
            <p className="mt-1 text-sm text-slate-600">
              Verification status: <strong>EXAMPLE — not verified</strong>.
            </p>
            <p className="mt-2 text-sm">Languages: English, Se habla español (example).</p>
            <p className="mt-1 text-sm">Services / forms: I-130, I-485 (example).</p>
            <p className="mt-1 text-sm">Prep fees: DIY $25/form · Review $99/form · Human Review $199 · Basic $999 · Standard $1,799 · Premium $2,799 (locked).</p>
            <p className="mt-2 text-sm text-slate-600">
              USCIS / NVC government fees are always on a SEPARATE line, never combined with the
              prep fee (I-485 $1,440 locked; I-130 $675 TO BE CONFIRMED; $120 AOS + $325 IV; $235
              USCIS Immigrant Fee). Confirm at uscis.gov/fees.
            </p>
          </div>
          {/* Smart Guided Intake — shown here too so the calculator can be
              tried while the directory is not live. Confirming returns 501
              until Supabase is wired; nothing is created. */}
          <SmartIntakeCalculator providerSlug={slug} />
        </div>
      )}

      {status === "not_found" && (
        <div className="mt-4 rounded border border-slate-300 bg-white p-5">
          <h2 className="text-xl font-bold">No verified professional at this address</h2>
          <p className="mt-1 text-sm text-slate-600">
            Either the slug is wrong or the profile is not listed. Unverified profiles are NOT
            listed in the directory. {loadError ?? ""}
          </p>
          <p className="mt-2 text-sm">
            Need help? Email{" "}
            <a href="mailto:nipteiapp@gmail.com" className="text-blue-600 underline">
              nipteiapp@gmail.com
            </a>{" "}
            or call{" "}
            <a href="tel:+17729716129" className="text-blue-600 underline">
              (772) 971-6129
            </a>
            .
          </p>
        </div>
      )}

      {status === "pending" && profile && (
        <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-xl font-bold">{displayName}</h2>
          <p className="mt-1 text-sm font-semibold">{roleBadge(profile, storefront)}</p>
          <p className="mt-2 rounded border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900">
            {t("pendingVerification", lang)} — this profile is not listed yet, so no booking is
            available. Directory listing and live client assignments unlock once verification is
            approved.
          </p>
          <p className="mt-2 text-sm text-slate-600">{t("bookingDisabled", lang)}</p>
        </div>
      )}

      {status === "listed" && profile && (
        <div className="mt-4 space-y-4">
          {/* Owner edit banner (slug-owner check). */}
          {isOwner && (
            <div className="rounded border border-blue-300 bg-blue-50 p-4">
              <p className="text-sm font-bold text-blue-900">
                This is your storefront{previewMode ? " — PREVIEW mode (visitors do not see unpublished sections or unsaved edits)." : "."}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(!editOpen)}
                  className="rounded bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white"
                >
                  {editOpen ? "Close editor" : "Edit my storefront"}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode(!previewMode)}
                  className="rounded border border-blue-700 px-3 py-1.5 text-sm font-semibold text-blue-800"
                >
                  {previewMode ? "Exit preview" : "Preview before publishing"}
                </button>
                <button
                  type="button"
                  onClick={() => void setPublished(!profile.is_published)}
                  className="rounded border border-slate-400 bg-white px-3 py-1.5 text-sm font-semibold"
                >
                  {profile.is_published ? "Unpublish" : "Publish"}
                </button>
              </div>
              <p className="mt-2 text-xs text-blue-900">
                Nothing publishes without you saving it: edits stay a draft until you press Save,
                and visitors only see published sections on a published storefront.
              </p>
            </div>
          )}

          {/* Owner editor — only the slug owner ever sees this. */}
          {isOwner && editOpen && (
            <div className="space-y-4 rounded border border-blue-300 bg-white p-5">
              <h2 className="text-lg font-bold">Edit my storefront</h2>
              {storefrontTablesMissing && (
                <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                  Sections and add-ons cannot be saved yet — migration 0014 has not run on the
                  database. Profile fields below will also fail to save until then.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium">Name shown on the storefront</span>
                  <input type="text" value={eDisplayName} onChange={(e) => setEDisplayName(e.target.value)} placeholder="Leave blank to use your account name" className={inputCls} />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Company name (if applicable)</span>
                  <input type="text" value={eCompany} onChange={(e) => setECompany(e.target.value)} className={inputCls} />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="font-medium">Bio / about (leave blank and nothing shows — never invented)</span>
                  <textarea value={eBio} onChange={(e) => setEBio(e.target.value)} rows={3} className={inputCls} />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Years of experience (only what you enter)</span>
                  <input type="number" min={0} value={eYears} onChange={(e) => setEYears(e.target.value)} placeholder="Leave blank if you prefer not to say" className={inputCls} />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Office hours</span>
                  <input type="text" value={eOfficeHours} onChange={(e) => setEOfficeHours(e.target.value)} placeholder="e.g. Mon–Fri, 9am–5pm ET" className={inputCls} />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Public phone</span>
                  <input type="tel" value={ePhone} onChange={(e) => setEPhone(e.target.value)} className={inputCls} />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Public email</span>
                  <input type="email" value={eEmail} onChange={(e) => setEEmail(e.target.value)} className={inputCls} />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">WhatsApp number</span>
                  <input type="tel" value={eWhatsapp} onChange={(e) => setEWhatsapp(e.target.value)} placeholder="e.g. +1 772 971 6129" className={inputCls} />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Address to publish (optional)</span>
                  <input type="text" value={eAddress} onChange={(e) => setEAddress(e.target.value)} className={inputCls} />
                </label>
              </div>
              <label className="block rounded border border-red-300 bg-red-50 px-3 py-2 text-sm">
                <input type="checkbox" checked={eShowAddress} onChange={(e) => setEShowAddress(e.target.checked)} className="mr-2" />
                <strong>Show my address publicly.</strong> Warning: this address will be visible
                to anyone on the internet. Never tick this for a home address unless you mean it —
                your address is hidden by default.
              </label>
              <fieldset className="rounded border border-slate-300 p-3">
                <legend className="px-1 text-sm font-medium">Languages you speak</legend>
                <div className="flex flex-wrap gap-3">
                  {LANGUAGES.map((l) => (
                    <label key={l.code} className="text-sm">
                      <input
                        type="checkbox"
                        checked={eLanguages.includes(l.code)}
                        onChange={(e) =>
                          setELanguages(
                            e.target.checked
                              ? [...eLanguages, l.code]
                              : eLanguages.filter((c) => c !== l.code)
                          )
                        }
                        className="mr-1"
                      />
                      {l.label} ({l.native})
                    </label>
                  ))}
                </div>
              </fieldset>
              {profile.role === "preparer" && (
                <fieldset className="rounded border border-slate-300 p-3">
                  <legend className="px-1 text-sm font-medium">Law student</legend>
                  <label className="block text-sm">
                    <input type="checkbox" checked={eLawStudent} onChange={(e) => setELawStudent(e.target.checked)} className="mr-2" />
                    I am a law student working under supervision — show the “Law Student — Supervised Only” badge.
                  </label>
                  {eLawStudent && (
                    <label className="mt-2 block text-sm">
                      <span className="font-medium">Supervising attorney&apos;s name *</span>
                      <input type="text" value={eSupervisor} onChange={(e) => setESupervisor(e.target.value)} className={inputCls} />
                    </label>
                  )}
                </fieldset>
              )}
              <label className="block text-sm">
                <span className="font-medium">Photo / logo (private vault upload — signed URL only, never public)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadPhoto(f);
                  }}
                  className="mt-1 block w-full text-sm"
                />
              </label>
              <button type="button" disabled={editSaving} onClick={() => void saveProfileEdits()} className="rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {editSaving ? "Saving…" : "Save profile (draft — not published yet)"}
              </button>

              {/* Sections editor */}
              <div>
                <h3 className="font-bold">Front-page sections</h3>
                <p className="text-sm text-slate-600">
                  Add, edit, and reorder sections. “What clients say” may hold ONLY real reviews
                  you have permission to show — never invented reviews or counts.
                </p>
                <div className="mt-2 space-y-2">
                  {editSections.map((s, i) => (
                    <div key={s.id} className="rounded border border-slate-300 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={s.section_type}
                          onChange={(e) =>
                            setEditSections(editSections.map((x) => (x.id === s.id ? { ...x, section_type: e.target.value as SectionType } : x)))
                          }
                          className="rounded border border-slate-300 px-2 py-1 text-sm"
                        >
                          {SECTION_TYPES.map((st) => (
                            <option key={st} value={st}>{SECTION_TYPE_LABEL[st]}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={s.title}
                          onChange={(e) => setEditSections(editSections.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))}
                          placeholder="Section title"
                          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                        <label className="text-sm">
                          <input
                            type="checkbox"
                            checked={s.is_published}
                            onChange={(e) => setEditSections(editSections.map((x) => (x.id === s.id ? { ...x, is_published: e.target.checked } : x)))}
                            className="mr-1"
                          />
                          Published
                        </label>
                        <button type="button" disabled={i === 0} onClick={() => {
                          const next = [...editSections];
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          setEditSections(next);
                        }} className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40">↑</button>
                        <button type="button" disabled={i === editSections.length - 1} onClick={() => {
                          const next = [...editSections];
                          [next[i + 1], next[i]] = [next[i], next[i + 1]];
                          setEditSections(next);
                        }} className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40">↓</button>
                        <button type="button" onClick={() => setEditSections(editSections.filter((x) => x.id !== s.id))} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700">Remove</button>
                      </div>
                      <textarea
                        value={s.body}
                        onChange={(e) => setEditSections(editSections.map((x) => (x.id === s.id ? { ...x, body: e.target.value } : x)))}
                        rows={3}
                        placeholder="Section text — write it in your own words."
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 rounded border border-slate-300 p-3">
                  <p className="text-sm font-medium">Add a section</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <select value={newSectionType} onChange={(e) => setNewSectionType(e.target.value as SectionType)} className="rounded border border-slate-300 px-2 py-1 text-sm">
                      {SECTION_TYPES.map((st) => (
                        <option key={st} value={st}>{SECTION_TYPE_LABEL[st]}</option>
                      ))}
                    </select>
                    <input type="text" value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)} placeholder="Title" className="rounded border border-slate-300 px-2 py-1 text-sm" />
                  </div>
                  <textarea value={newSectionBody} onChange={(e) => setNewSectionBody(e.target.value)} rows={2} placeholder="Section text" className={inputCls} />
                  <button
                    type="button"
                    disabled={!newSectionTitle.trim()}
                    onClick={() => {
                      setEditSections([
                        ...editSections,
                        {
                          id: crypto.randomUUID(),
                          professional_id: profile.account_id,
                          section_type: newSectionType,
                          title: newSectionTitle.trim(),
                          body: newSectionBody,
                          sort_order: editSections.length,
                          is_published: false,
                        },
                      ]);
                      setNewSectionTitle("");
                      setNewSectionBody("");
                    }}
                    className="mt-2 rounded bg-slate-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Add section (unpublished)
                  </button>
                </div>
                <button type="button" disabled={editSaving} onClick={() => void saveSections()} className="mt-2 rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {editSaving ? "Saving…" : "Save sections"}
                </button>
              </div>

              {/* Add-ons editor */}
              <div>
                <h3 className="font-bold">Additional services / add-ons</h3>
                <p className="text-sm text-slate-600">
                  Locked platform prices cannot be changed. Your own custom add-ons carry a price
                  you set, and are labelled on the storefront as your own service.
                </p>
                <div className="mt-2 space-y-2">
                  {editAddons.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-300 p-3 text-sm">
                      <span className="font-medium">{a.name}</span>
                      <span>{formatCents(a.price_cents)}</span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                        {a.is_locked_price ? "Locked platform price" : "Your own service — price set by you"}
                      </span>
                      <label className="text-sm">
                        <input
                          type="checkbox"
                          checked={a.is_active}
                          onChange={(e) => setEditAddons(editAddons.map((x) => (x.id === a.id ? { ...x, is_active: e.target.checked } : x)))}
                          className="mr-1"
                        />
                        Show on storefront
                      </label>
                      <button type="button" onClick={() => setEditAddons(editAddons.filter((x) => x.id !== a.id))} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700">Remove</button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-slate-300 p-3 text-sm">
                  <span className="font-medium">Add a locked add-on:</span>
                  <select value={lockedAddonPick} onChange={(e) => setLockedAddonPick(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm">
                    {LOCKED_ADDONS.map((l) => (
                      <option key={l.name} value={l.name}>{l.name} — {formatCents(l.priceCents)}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={editAddons.some((a) => a.name === lockedAddonPick)}
                    onClick={() => {
                      const picked = LOCKED_ADDONS.find((l) => l.name === lockedAddonPick);
                      if (!picked) return;
                      setEditAddons([
                        ...editAddons,
                        {
                          id: crypto.randomUUID(),
                          professional_id: profile.account_id,
                          name: picked.name,
                          description: picked.blurb,
                          price_cents: picked.priceCents,
                          is_locked_price: true,
                          is_active: true,
                          sort_order: editAddons.length,
                        },
                      ]);
                    }}
                    className="rounded bg-slate-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Add locked add-on
                  </button>
                </div>
                <div className="mt-2 rounded border border-slate-300 p-3">
                  <p className="text-sm font-medium">Add your own custom add-on</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <input type="text" value={customAddonName} onChange={(e) => setCustomAddonName(e.target.value)} placeholder="Name" className="rounded border border-slate-300 px-2 py-1 text-sm" />
                    <input type="number" min={0} value={customAddonPrice} onChange={(e) => setCustomAddonPrice(e.target.value)} placeholder="Price in dollars" className="w-32 rounded border border-slate-300 px-2 py-1 text-sm" />
                    <input type="text" value={customAddonDesc} onChange={(e) => setCustomAddonDesc(e.target.value)} placeholder="Description" className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
                    <button
                      type="button"
                      disabled={!customAddonName.trim() || customAddonPrice.trim() === ""}
                      onClick={() => {
                        setEditAddons([
                          ...editAddons,
                          {
                            id: crypto.randomUUID(),
                            professional_id: profile.account_id,
                            name: customAddonName.trim(),
                            description: customAddonDesc.trim(),
                            price_cents: Math.round(parseFloat(customAddonPrice) * 100) || 0,
                            is_locked_price: false,
                            is_active: true,
                            sort_order: editAddons.length,
                          },
                        ]);
                        setCustomAddonName("");
                        setCustomAddonPrice("");
                        setCustomAddonDesc("");
                      }}
                      className="rounded bg-slate-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Add my add-on
                    </button>
                  </div>
                </div>
                <button type="button" disabled={editSaving} onClick={() => void saveAddons()} className="mt-2 rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {editSaving ? "Saving…" : "Save add-ons"}
                </button>
              </div>

              {editMsg && (
                <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {editMsg}
                </p>
              )}
            </div>
          )}

          {/* Profile card */}
          <div className="rounded border border-slate-300 bg-white p-5">
            <p className="inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-bold text-green-900">
              ✓ {t("verified", lang)}
            </p>
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={`Photo of ${displayName}`} loading="lazy" width={128} height={128} className="mt-3 h-32 w-32 rounded-full object-cover" />
            ) : (
              <p className="mt-3 text-sm text-slate-500">No photo provided.</p>
            )}
            <h2 className="mt-2 text-xl font-bold">{displayName}</h2>
            {profile.company_name && <p className="text-sm text-slate-600">{profile.company_name}</p>}
            <p className="mt-1 text-sm font-semibold">{roleBadge(profile, storefront)}</p>
            {profile.role === "attorney" && (
              <p className="mt-1 text-sm text-slate-600">
                Bar state(s): {profile.bar_states.join(", ") || "—"} (bar number verified by admin —
                never shown as verified before approval).
              </p>
            )}
            {profile.role === "nonprofit" && (
              <p className="mt-1 text-sm text-slate-600">
                Accreditation:{" "}
                {profile.accreditation_level === "full_uscis_and_court"
                  ? "Full — USCIS and Court"
                  : "Partial — USCIS only"}{" "}
                (checked against the EOIR roster).
              </p>
            )}
            {storefront?.is_law_student && storefront.supervising_attorney_name && (
              <p className="mt-1 text-sm text-slate-600">
                Supervised by attorney {storefront.supervising_attorney_name}. A law student does
                not give legal advice and does not represent clients alone.
              </p>
            )}
            {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}
            <p className="mt-2 text-sm">
              <strong>{t("languages", lang)}:</strong>{" "}
              {profile.languages_spoken.length > 0
                ? profile.languages_spoken
                    .map((c) => SPOKEN_LABEL[c as LanguageCode] ?? languageLabel(c))
                    .join(" · ")
                : "Not listed"}
            </p>
            {profile.years_experience != null && (
              <p className="mt-1 text-sm">
                Experience: {profile.years_experience} {profile.years_experience === 1 ? "year" : "years"}
              </p>
            )}
            {serviceAreaText(profile.service_area) && (
              <p className="mt-1 text-sm">Service area: {serviceAreaText(profile.service_area)}</p>
            )}
            {storefront?.office_hours && (
              <p className="mt-1 text-sm">Office hours: {storefront.office_hours}</p>
            )}
            <p className="mt-1 text-sm">
              Platform plan: <strong>{PLAN_PRICE[profile.subscription_plan] ?? "—"}</strong>
            </p>
            {editedDate && (
              <p className="mt-2 text-xs text-slate-500">Edited {editedDate}.</p>
            )}
          </div>

          {/* Contact */}
          <div className="rounded border border-slate-300 bg-white p-5">
            <h2 className="text-lg font-bold">{t("contact", lang)}</h2>
            {storefront?.public_phone && (
              <p className="mt-1 text-sm">
                Phone:{" "}
                <a href={`tel:${storefront.public_phone.replace(/[^0-9+]/g, "")}`} className="text-blue-600 underline">
                  {storefront.public_phone}
                </a>
              </p>
            )}
            {storefront?.public_email && (
              <p className="mt-1 text-sm">
                Email:{" "}
                <a href={`mailto:${storefront.public_email}`} className="text-blue-600 underline">
                  {storefront.public_email}
                </a>
              </p>
            )}
            {whatsappDigits && (
              <p className="mt-1 text-sm">
                WhatsApp:{" "}
                <a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  Message on WhatsApp
                </a>
              </p>
            )}
            {storefront?.show_address && storefront.public_address_text && (
              <p className="mt-1 text-sm">Address: {storefront.public_address_text}</p>
            )}
            {!storefront?.public_phone && !storefront?.public_email && !whatsappDigits && (
              <p className="mt-1 text-sm text-slate-500">
                No public contact details listed — use the quote form below and the professional
                will reply by email.
              </p>
            )}
          </div>

          {/* Smart Guided Intake & Instant Fee Calculator — 4 questions,
              exact forms + gov fees (LOCKED / TO BE CONFIRMED), locked
              prep tiers, locked payment plans. Confirming posts to
              /api/confirm-intake-order, which creates the case + order +
              checklist in the real tables (501 until Supabase is wired). */}
          <SmartIntakeCalculator providerSlug={slug} providerName={displayName} />

          {/* Services + ordering */}
          <div className="rounded border border-slate-300 bg-white p-5">
            <h2 className="text-lg font-bold">{t("services", lang)}</h2>
            <p className="mt-1 text-sm text-slate-600">
              Preparation fees are separate from USCIS / NVC government fees, which are always on
              their own line and never combined with the prep fee. Confirm USCIS fees at{" "}
              <a href={USCIS_FEES_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">
                uscis.gov/fees
              </a>
              .
            </p>
            {formFees.length === 0 && (
              <p className="mt-2 text-sm text-slate-500">
                No services listed yet — ask for a quote below and the professional will price
                your case.
              </p>
            )}
            <div className="mt-3 space-y-3">
              {formFees.map((f) => {
                const tpl = BUNDLE_TEMPLATES.find((b) => b.formCode === f.form_code);
                return (
                  <div key={f.form_code} className="rounded border border-slate-200 p-3">
                    <p className="font-bold">
                      {f.form_code}
                      {tpl ? ` — ${tpl.name}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      This professional&apos;s listed prep fee: {formatCents(f.custom_fee_cents)}.
                    </p>
                    <p className="mt-1 text-sm">
                      Tiers (locked): DIY $25/form · Review $99/form · Human Review $199 · Basic
                      $999 · Standard $1,799 · Premium $2,799.
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{govFeeNoteFor(f.form_code)}</p>
                    <button
                      type="button"
                      onClick={() => startOrder(f.form_code)}
                      className="mt-2 rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white"
                    >
                      {t("orderThisService", lang)}
                    </button>
                  </div>
                );
              })}
            </div>
            {coResult && (
              <p className="mt-3 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
                {coResult}
              </p>
            )}
          </div>

          {/* 5-step checkout */}
          {checkoutOpen && (
            <div className="rounded border border-blue-300 bg-white p-5">
              <h2 className="text-lg font-bold">
                {t("checkout", lang)} — Step {coStep} of 5
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {coStep === 1 && "Choose the service."}
                {coStep === 2 && "Choose a tier — nothing is pre-selected."}
                {coStep === 3 && "Choose a payment plan — nothing is pre-selected. Stripe checkout is NOT connected, so no payment is taken now."}
                {coStep === 4 && "Your details, and any add-ons."}
                {coStep === 5 && "Check everything, then confirm."}
              </p>

              {coStep === 1 && (
                <div className="mt-3 space-y-2">
                  {formFees.map((f) => (
                    <label key={f.form_code} className="block rounded border border-slate-300 px-3 py-2 text-sm">
                      <input
                        type="radio"
                        name="co-form"
                        checked={coForm === f.form_code}
                        onChange={() => setCoForm(f.form_code)}
                        className="mr-2"
                      />
                      {f.form_code} — {BUNDLE_TEMPLATES.find((b) => b.formCode === f.form_code)?.name ?? "Service"}
                    </label>
                  ))}
                </div>
              )}

              {coStep === 2 && (
                <div className="mt-3 space-y-2">
                  {LEVELS.map((lv) => (
                    <label key={lv} className="block rounded border border-slate-300 px-3 py-2 text-sm">
                      <input
                        type="radio"
                        name="co-level"
                        checked={coLevel === lv}
                        onChange={() => setCoLevel(lv)}
                        className="mr-2"
                      />
                      {LEVEL_LABEL[lv]}
                      {coForm && lv !== "diy" && lv !== "review" && lv !== "human_review" && (
                        <span className="text-slate-500">
                          {" "}
                          — {coForm}: {formatCents(levelPriceCents(coForm, lv) ?? 0)}
                        </span>
                      )}
                    </label>
                  ))}
                  <p className="text-xs text-slate-500">
                    DIY $25/form, Review $99/form, and Human Review $199 are the locked per-form
                    levels. Basic / Standard / Premium use this form&apos;s locked tier price.
                  </p>
                </div>
              )}

              {coStep === 3 && (
                <div className="mt-3 space-y-2">
                  {(Object.keys(PLAN_LABEL) as PaymentPlanType[]).map((p) => (
                    <label key={p} className="block rounded border border-slate-300 px-3 py-2 text-sm">
                      <input
                        type="radio"
                        name="co-plan"
                        checked={coPlan === p}
                        onChange={() => setCoPlan(p)}
                        className="mr-2"
                      />
                      {PLAN_LABEL[p]}
                      {coLevelPrice != null && (
                        <span className="text-slate-500">
                          {" "}
                          — {splitInvoices(coLevelPrice + coAddonsTotal, p).map((s) => formatCents(s.amountCents)).join(" + ")}
                        </span>
                      )}
                    </label>
                  ))}
                  <p className="text-xs text-slate-500">
                    No payment is taken now — Stripe checkout is NOT connected. The professional
                    confirms your order and sends a payment link.
                  </p>
                </div>
              )}

              {coStep === 4 && (
                <div className="mt-3 space-y-3">
                  <label className="block text-sm">
                    <span className="font-medium">{t("preferredLanguage", lang)} *</span>
                    <select value={coLang} onChange={(e) => setCoLang(e.target.value as LanguageCode)} className={inputCls}>
                      {LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>{l.label} — {l.native}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium">Your full name *</span>
                    <input type="text" required value={coName} onChange={(e) => setCoName(e.target.value)} className={inputCls} />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium">Your email *</span>
                    <input type="email" required value={coEmail} onChange={(e) => setCoEmail(e.target.value)} className={inputCls} />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium">Your phone</span>
                    <input type="tel" value={coPhone} onChange={(e) => setCoPhone(e.target.value)} className={inputCls} />
                  </label>
                  {addons.length > 0 && (
                    <fieldset className="rounded border border-slate-300 p-3">
                      <legend className="px-1 text-sm font-medium">{t("addons", lang)}</legend>
                      {addons.map((a) => (
                        <label key={a.id} className="mt-1 block text-sm">
                          <input
                            type="checkbox"
                            checked={coAddonIds.includes(a.id)}
                            onChange={(e) =>
                              setCoAddonIds(
                                e.target.checked
                                  ? [...coAddonIds, a.id]
                                  : coAddonIds.filter((id) => id !== a.id)
                              )
                            }
                            className="mr-2"
                          />
                          {a.name} — {formatCents(a.price_cents)}
                          <span className="text-slate-500">
                            {" "}
                            ({a.is_locked_price ? "Locked platform price" : "This professional's own service"})
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                </div>
              )}

              {coStep === 5 && (
                <div className="mt-3 space-y-2 text-sm">
                  <p><strong>Service:</strong> {coForm} — {coLevel ? LEVEL_LABEL[coLevel] : "—"}</p>
                  <p><strong>Payment plan:</strong> {coPlan ? PLAN_LABEL[coPlan] : "—"}</p>
                  <p><strong>Prep fee:</strong> {formatCents(coLevelPrice ?? 0)}</p>
                  <p><strong>Add-ons:</strong> {selectedAddons.length > 0 ? selectedAddons.map((a) => `${a.name} (${formatCents(a.price_cents)})`).join(", ") : "None"}</p>
                  <p><strong>Total prep + add-ons:</strong> {formatCents(coTotal)}</p>
                  <p className="rounded border border-slate-300 bg-slate-50 px-3 py-2">
                    <strong>USCIS / NVC government fees — SEPARATE, never combined:</strong>{" "}
                    {coForm ? govFeeNoteFor(coForm) : "—"} Confirm the current fee at{" "}
                    <a href={USCIS_FEES_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">uscis.gov/fees</a>{" "}
                    before you pay.
                  </p>
                  {coPlan && (
                    <p>
                      <strong>Payment schedule ({PLAN_LABEL[coPlan]}):</strong>{" "}
                      {splitInvoices(coTotal, coPlan).map((s) => `${s.label} ${formatCents(s.amountCents)} (due ${s.dueDate})`).join(" · ")}
                    </p>
                  )}
                  <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 font-semibold text-amber-800">
                    No payment is taken by confirming below — it places this
                    order in {displayName}&apos;s Lead Sheet only; a case is
                    created when they convert it.
                  </p>
                  {(() => {
                    // Stripe checkout covers the LOCKED form prep fee only.
                    // Add-ons are the professional's own prices
                    // (professional_addons) with no locked Stripe Price,
                    // so they are billed separately by the professional.
                    // Pay in Full and Pay in 3 are supported here; Monthly
                    // is bundle-only and is not offered on single forms.
                    if (!coForm || !coLevel || coLevel === "diy" || coLevel === "review" || coLevel === "human_review") return null;
                    if (coPlan !== "full_upfront" && coPlan !== "installments_3") return null;
                    const price = getLockedPriceByKey(formTierPriceKey(coForm, coLevel));
                    if (!price) return null;
                    return (
                      <div className="rounded border border-blue-300 bg-blue-50 px-3 py-2">
                        <p className="mb-2 text-xs text-blue-900">
                          Pay the {price.label} prep fee ({formatCents(price.amountCents)}) now
                          with secure Stripe checkout{coPlan === "installments_3" ? " — Instalment 1 of 3 only; instalments 2–3 are due before filing and are not auto-charged" : ""}.
                          {selectedAddons.length > 0 ? " Add-ons are billed separately by the professional — they are not in this Stripe payment." : ""}{" "}
                          USCIS government fees are separate.
                        </p>
                        <CheckoutButton
                          priceId={price.priceId}
                          plan={coPlan === "installments_3" ? "installments_3" : "full"}
                          email={coEmail}
                          label={coPlan === "installments_3" ? `Pay Instalment 1 with Stripe` : `Pay ${formatCents(price.amountCents)} with Stripe`}
                        />
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {coStep > 1 && (
                  <button type="button" onClick={() => setCoStep(coStep - 1)} className="rounded border border-slate-400 px-3 py-2 text-sm font-semibold">
                    Back
                  </button>
                )}
                {coStep < 5 && (
                  <button
                    type="button"
                    disabled={
                      (coStep === 1 && !coForm) ||
                      (coStep === 2 && !coLevel) ||
                      (coStep === 3 && !coPlan) ||
                      (coStep === 4 && (!coName.trim() || !coEmail.trim()))
                    }
                    onClick={() => setCoStep(coStep + 1)}
                    className="rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Continue
                  </button>
                )}
                {coStep === 5 && (
                  <button type="button" disabled={coSending} onClick={() => void submitOrder()} className="rounded bg-green-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {coSending ? "Placing order…" : t("confirmOrder", lang)}
                  </button>
                )}
                <button type="button" onClick={() => { setCheckoutOpen(false); setCoResult(null); }} className="rounded border border-slate-400 px-3 py-2 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Additional services / add-ons */}
          <div className="rounded border border-slate-300 bg-white p-5">
            <h2 className="text-lg font-bold">{t("addons", lang)}</h2>
            {addons.length === 0 && !storefrontTablesMissing && (
              <p className="mt-1 text-sm text-slate-500">
                No additional services listed — the professional can add their own from their
                dashboard.
              </p>
            )}
            {storefrontTablesMissing && (
              <p className="mt-1 text-sm text-slate-500">
                Additional services are not loaded yet — the storefront database update (migration
                0014) has not run.
              </p>
            )}
            <div className="mt-2 space-y-2">
              {addons.map((a) => (
                <label key={a.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={coAddonIds.includes(a.id)}
                    onChange={(e) => {
                      setCoAddonIds(
                        e.target.checked
                          ? [...coAddonIds, a.id]
                          : coAddonIds.filter((id) => id !== a.id)
                      );
                      if (e.target.checked && !checkoutOpen && formFees.length > 0) {
                        setCoForm(formFees[0].form_code);
                        setCoStep(1);
                        setCheckoutOpen(true);
                      }
                    }}
                  />
                  <span className="font-medium">{a.name}</span>
                  <span>{formatCents(a.price_cents)}{a.name.startsWith("Certified Translation") ? " / page" : ""}</span>
                  <span className="text-slate-500">
                    {a.is_locked_price ? "Locked platform price" : "This professional's own service — price set by them"}
                  </span>
                  {a.description && <span className="w-full text-slate-600">{a.description}</span>}
                  <span className="text-blue-700">{t("addToOrder", lang)}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Locked add-on prices: translation $45/page, Packet Rescue $199, consultation $99/30
              min, RFE $399/$799/$1,499, FBI prep $149, FOIA prep $149, mock interview $199.
            </p>
          </div>

          {/* Free-form sections the professional added */}
          {otherSections.map((s) => (
            <div key={s.id} className="rounded border border-slate-300 bg-white p-5">
              <h2 className="text-lg font-bold">{s.title}</h2>
              {s.body ? (
                <p className="mt-1 whitespace-pre-wrap text-sm">{s.body}</p>
              ) : (
                <p className="mt-1 text-sm text-slate-500">Nothing written here yet.</p>
              )}
            </div>
          ))}

          {/* Reviews — only real ones, honest empty state */}
          <div className="rounded border border-slate-300 bg-white p-5">
            <h2 className="text-lg font-bold">What clients say</h2>
            {realReviews.length > 0 ? (
              <ul className="mt-2 space-y-3">
                {realReviews.map((r) => (
                  <li key={r.id} className="rounded border border-slate-200 px-3 py-2">
                    <p className="text-sm">
                      <strong>
                        {"★".repeat(r.rating)}
                        {"☆".repeat(5 - r.rating)}
                      </strong>{" "}
                      <span className="text-slate-500">
                        {r.rating} of 5 — {r.display_name} — {r.service_form_code}
                        {r.service_name ? ` (${r.service_name})` : ""} —{" "}
                        {new Date(r.created_at).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{r.body}</p>
                    {r.reply_text && (
                      <p className="mt-2 rounded bg-slate-50 px-2 py-1 text-sm">
                        <strong>Reply from {displayName}:</strong> {r.reply_text}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : reviewSections.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">{t("noReviewsYet", lang)}</p>
            ) : (
              reviewSections.map((s) => (
                <div key={s.id} className="mt-2">
                  {s.title !== "What clients say" && <p className="font-medium">{s.title}</p>}
                  <p className="whitespace-pre-wrap text-sm">{s.body}</p>
                </div>
              ))
            )}
            <p className="mt-2 text-xs text-slate-500">
              Only real reviews the professional has permission to show appear here.
            </p>
          </div>

          {/* Amenities */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded border border-slate-300 bg-white p-5">
              <h2 className="font-bold">{t("noNeedToCall", lang)}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Pick a service above and order it right here — no phone call needed. If you prefer
                to talk first, the free 15-minute call below is $0.
              </p>
            </div>
            <div className="rounded border border-slate-300 bg-white p-5">
              <h2 className="font-bold">{t("whatHappensNext", lang)}</h2>
              <ol className="mt-1 list-decimal pl-5 text-sm text-slate-700">
                <li>You order here — it lands in {displayName}&apos;s Lead Sheet.</li>
                <li>They review your order and confirm it with you.</li>
                <li>You complete intake and upload documents to the private vault.</li>
                <li>They prepare your packet and review it with you.</li>
                <li>You sign (E-Sign is not connected yet — signing is arranged directly) and the packet is filed.</li>
              </ol>
            </div>
            <div className="rounded border border-slate-300 bg-white p-5">
              <h2 className="font-bold">{t("docsSafe", lang)}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Documents go to a private, encrypted vault that only you and {displayName} can
                see. Never send IDs or case numbers by unsecured chat.
              </p>
            </div>
            <div className="rounded border border-slate-300 bg-white p-5">
              <h2 className="font-bold">{t("paySafely", lang)}</h2>
              <p className="mt-1 text-sm text-slate-600">
                No payment is taken on this page — Stripe checkout is NOT connected. The
                professional sends a payment link after confirming your order. Never pay by gift
                card or wire to an individual. USCIS/NVC government fees are paid to the U.S.
                Department of Homeland Security, never to a person.
              </p>
            </div>
          </div>

          {/* Check we are real */}
          <div className="rounded border border-slate-300 bg-white p-5">
            <h2 className="text-lg font-bold">{t("checkReal", lang)}</h2>
            <p className="mt-1 text-sm">
              Verification status: <strong>Verified &amp; Listed</strong> — this profile was
              approved by an admin before it could be listed.
            </p>
            {profile.role === "attorney" && (
              <p className="mt-1 text-sm text-slate-600">
                Licensed Immigration Attorney — bar number verified by admin. You can also verify
                any attorney with the state bar where they are licensed
                {profile.bar_states.length > 0 ? ` (${profile.bar_states.join(", ")})` : ""}.
              </p>
            )}
            {profile.role === "nonprofit" && (
              <div className="mt-2 text-sm text-slate-600">
                <p>
                  DOJ-Accredited Nonprofit — {profile.accreditation_level === "full_uscis_and_court" ? "Full (USCIS and Court)" : "Partial (USCIS only)"}.
                </p>
                <div className="mt-2">
                  <EoirRosterLinks compact />
                </div>
              </div>
            )}
            {profile.role === "preparer" && (
              <p className="mt-1 text-sm text-slate-600">
                Document Preparer — clerical help only. A preparer does not give legal advice and
                does not represent you. If your case needs legal advice, ask for a licensed
                attorney or a DOJ-Accredited Representative.
              </p>
            )}
          </div>

          {/* Quote request */}
          <form onSubmit={submitQuote} className="rounded border border-slate-300 bg-white p-5">
            <h2 className="text-lg font-bold">{t("requestQuote", lang)}</h2>
            <p className="mt-1 text-sm text-slate-600">
              Your request drops into this professional&apos;s Lead Sheet — and nobody
              else&apos;s.
            </p>
            <label className="mt-3 block text-sm">
              <span className="font-medium">Your full name *</span>
              <input type="text" required value={qName} onChange={(e) => setQName(e.target.value)} className={inputCls} />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium">Your email *</span>
              <input type="email" required value={qEmail} onChange={(e) => setQEmail(e.target.value)} className={inputCls} />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium">Your phone</span>
              <input type="tel" value={qPhone} onChange={(e) => setQPhone(e.target.value)} className={inputCls} />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium">{t("preferredLanguage", lang)}</span>
              <select value={qLang} onChange={(e) => setQLang(e.target.value as LanguageCode)} className={inputCls}>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label} — {l.native}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium">What do you need help with? *</span>
              <textarea required value={qMessage} onChange={(e) => setQMessage(e.target.value)} rows={3} placeholder="e.g. I-130 petition for my spouse…" className={inputCls} />
            </label>
            <button type="submit" disabled={quoteSending} className="mt-3 rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {quoteSending ? "Sending…" : "Send quote request"}
            </button>
            {quoteResult && (
              <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {quoteResult}
              </p>
            )}
          </form>

          {/* Free 15-min call */}
          <form onSubmit={submitBooking} className="rounded border border-slate-300 bg-white p-5">
            <h2 className="text-lg font-bold">{t("freeCall", lang)}</h2>
            <p className="mt-1 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              Booking calendar NOT connected — this form collects your request instead. No booking
              is made and no calendar event is created; the professional confirms the time with you
              directly. A longer 30-minute consultation is $99 (not legal advice unless from a
              licensed attorney).
            </p>
            <label className="mt-3 block text-sm">
              <span className="font-medium">Your full name *</span>
              <input type="text" required value={bName} onChange={(e) => setBName(e.target.value)} className={inputCls} />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium">Your email *</span>
              <input type="email" required value={bEmail} onChange={(e) => setBEmail(e.target.value)} className={inputCls} />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium">Your phone</span>
              <input type="tel" value={bPhone} onChange={(e) => setBPhone(e.target.value)} className={inputCls} />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium">Consultation type</span>
              <select value={bType} onChange={(e) => setBType(e.target.value as "phone" | "video" | "in_person")} className={inputCls}>
                <option value="video">Video consultation</option>
                <option value="phone">Phone consultation</option>
                <option value="in_person">In-person consultation</option>
              </select>
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium">Length — price up front</span>
              <select value={bLength} onChange={(e) => setBLength(Number(e.target.value) as 15 | 30)} className={inputCls}>
                <option value={15}>Free 15-minute consultation — $0</option>
                <option value={30}>30-minute consultation — $99 (not legal advice unless from a licensed attorney)</option>
              </select>
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium">Time preference</span>
              <select value={bTimePref} onChange={(e) => setBTimePref(e.target.value as "weekday" | "evening" | "weekend" | "any")} className={inputCls}>
                <option value="any">Any time</option>
                <option value="weekday">Weekday</option>
                <option value="evening">Evening</option>
                <option value="weekend">Weekend</option>
              </select>
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium">Language</span>
              <select value={bLang} onChange={(e) => setBLang(e.target.value as LanguageCode)} className={inputCls}>
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="ht">Kreyòl</option>
                <option value="fr">Français</option>
                <option value="pt">Português</option>
                <option value="zh">中文</option>
                <option value="ar">العربية</option>
              </select>
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium">Timezone</span>
              <input type="text" value={bTz} onChange={(e) => setBTz(e.target.value)} placeholder="e.g. America/New_York" className={inputCls} />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium">Preferred time (your request — not a booking)</span>
              <input type="text" value={bWhen} onChange={(e) => setBWhen(e.target.value)} placeholder="e.g. weekday afternoons" className={inputCls} />
            </label>
            {referralCode && (
              <p className="mt-2 text-sm text-slate-600">
                Referred here by a family referral link (code {referralCode}) — this request will be recorded with referral source “Referral”.
              </p>
            )}
            <button type="submit" disabled={bookingSending} className="mt-3 rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {bookingSending ? "Sending…" : "Collect call request (no booking made)"}
            </button>
            {bookingResult && (
              <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {bookingResult}
              </p>
            )}
          </form>
        </div>
      )}

      {/* Ask NIPTEI copilot — public storefront. Non-AI FAQ answers
          in this build (OpenRouter NOT connected). */}
      <AskNipteiChat context="storefront" professionalId={profile?.account_id} />

      {/* Footer disclaimers */}
      <footer className="mt-6 space-y-1 border-t border-slate-300 pt-4 text-xs text-slate-500">
        {profile?.role === "preparer" && (
          <p>
            {displayName} is a document preparer, not a law firm and not attorneys. No legal
            advice is given here, and this service is not affiliated with USCIS or the U.S.
            Department of State.
          </p>
        )}
        {profile?.role === "attorney" && (
          <p>
            {displayName} is a licensed immigration attorney. Legal advice on this storefront is
            given only by the attorney. This service is not affiliated with USCIS or the U.S.
            Department of State.
          </p>
        )}
        {profile?.role === "nonprofit" && (
          <p>
            {displayName} is a DOJ-Accredited nonprofit organization. Only a DOJ-Accredited
            Representative or a licensed attorney gives legal advice or represents a client
            (8 CFR 292.1). This service is not affiliated with USCIS or the U.S. Department of
            State.
          </p>
        )}
        {!profile && (
          <p>
            Immigration with NIPTEI is not a law firm and is not affiliated with USCIS. Only a
            licensed attorney or DOJ-Accredited Representative gives legal advice or represents a
            client (8 CFR 292.1).
          </p>
        )}
        <p>
          Government fees change. Confirm the current fee at{" "}
          <a href={USCIS_FEES_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">
            uscis.gov/fees
          </a>{" "}
          before you pay.
        </p>
        <p>
          Storefront: immigration.niptei.com/p/{slug}. Stripe checkout, calendar booking, and
          E-Sign are NOT connected.
        </p>
      </footer>
    </main>
  );
}
