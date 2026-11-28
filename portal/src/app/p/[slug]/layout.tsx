// Metadata for this dynamic segment (Nov 28, 2026). This page is a
// client component ("use client"), which cannot export metadata
// itself, so the title + description live in this layout instead.
// Generic copy only — never a name, claim, or review invented for
// an unknown slug (src/lib/seo.ts STOREFRONT_META).
import type { Metadata } from "next";
import { STOREFRONT_META } from "@/lib/seo";

export const metadata: Metadata = {
  title: STOREFRONT_META.title,
  description: STOREFRONT_META.description,
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
