import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://immigration.niptei.com"),
  title: "Immigration with NIPTEI — Client Portal",
  description:
    "Immigration with NIPTEI: client portal, role onboarding, and admin verification. Not a law firm. Clerical and educational help only.",
  openGraph: {
    title: "Immigration with NIPTEI — Client Portal",
    description:
      "Document-preparation help with immigration forms, in 7 languages. Not a law firm, not affiliated with USCIS. No approval is guaranteed.",
    url: "https://immigration.niptei.com",
    siteName: "Immigration with NIPTEI",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Immigration with NIPTEI — Client Portal",
    description:
      "Document-preparation help with immigration forms, in 7 languages. Not a law firm, not affiliated with USCIS.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
