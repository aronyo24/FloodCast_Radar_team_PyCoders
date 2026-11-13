import type { Metadata, Viewport } from "next";

import { AlertSignup } from "@/components/AlertSignup";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { LanguageProvider } from "@/lib/language";
import { OfficerProvider } from "@/lib/officer";
import { SkipLink } from "@/components/SkipLink";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FloodCast Radar — monsoon flooding, district by district",
    template: "%s · FloodCast Radar",
  },
  description:
    "Where the 2026 monsoon flooded Bangladesh, how much and when, from NASA-ISRO NISAR radar that sees through monsoon cloud.",
  applicationName: "FloodCast Radar",
  keywords: ["NISAR", "SAR", "flood", "Bangladesh", "monsoon", "NASA Space Apps"],
  openGraph: {
    title: "FloodCast Radar",
    description:
      "Monsoon flooding across Bangladesh, district by district, from NISAR radar.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#070d18",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col pb-20 sm:pb-0">
        <LanguageProvider>
          <OfficerProvider>
            <SkipLink />
            <SiteHeader />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter />
            {/* Phone: flood alerts one tap away from anywhere on the site. */}
            <div className="fixed bottom-4 right-4 z-[1000] sm:hidden">
              <AlertSignup />
            </div>
          </OfficerProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
