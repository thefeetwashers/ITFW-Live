// Metadata for this segment (Nov 28, 2026). This page is a client
// component ("use client"), which cannot export metadata itself, so
// the title + description live in this layout instead — same central
// copy as every other public page (src/lib/seo.ts PUBLIC_PAGE_META).
// No restyle, no behaviour change.
import type { Metadata } from "next";
import { PUBLIC_PAGE_META } from "@/lib/seo";

export const metadata: Metadata = {
  title: PUBLIC_PAGE_META["/interview-prep"].title,
  description: PUBLIC_PAGE_META["/interview-prep"].description,
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
