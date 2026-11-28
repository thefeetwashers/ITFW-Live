// robots.txt — search engines may crawl public pages; private areas
// (portal, dashboards, family, auth, API) are disallowed. The sitemap
// is the public-pages-only list from src/app/sitemap.ts.
import type { MetadataRoute } from "next";
import { SITE_URL, PRIVATE_PATH_PREFIXES } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATH_PREFIXES,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
