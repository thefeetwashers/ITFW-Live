// Metadata for this dynamic segment (Nov 28, 2026). This page is a
// client component ("use client"), which cannot export metadata
// itself, so the title + description live in this layout instead.
// Generic copy only — never a name, claim, or review invented for
// an unknown code (src/lib/seo.ts REFERRAL_META).
import type { Metadata } from "next";
import { REFERRAL_META } from "@/lib/seo";

export const metadata: Metadata = {
  title: REFERRAL_META.title,
  description: REFERRAL_META.description,
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
