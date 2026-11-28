// Sitemap — public pages ONLY (src/lib/seo.ts).
// Private/dashboard URLs are never listed: isPublicSitemapUrl() is the
// guard, and the smoke test asserts every entry passes it. Storefront
// URLs (/p/<slug>) are not listed until a profile is actually
// published — no slug is ever invented.
import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries().map((e) => ({
    url: e.url,
    lastModified: e.lastModified,
  }));
}
