import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Immigration with NIPTEI — Client Portal",
  description:
    "Immigration with NIPTEI: client portal, role onboarding, and admin verification. Not a law firm. Clerical and educational help only.",
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
