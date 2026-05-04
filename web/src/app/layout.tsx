import type { Metadata, Viewport } from "next";
import { EB_Garamond, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import "@/app/globals.css";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { SiteShell } from "@/components/site-shell";
import {
  buildBrandMetadata,
  getMetadataBase,
  SITE_NAME,
} from "@/lib/metadata";

const garamond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  ...buildBrandMetadata(),
  metadataBase: getMetadataBase(),
  applicationName: SITE_NAME,
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FAFAFA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${garamond.variable} ${plexSans.variable} ${mono.variable}`}>
        <ClerkProvider
          afterSignOutUrl="/"
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
        >
          <SiteShell>{children}</SiteShell>
        </ClerkProvider>
        <AnalyticsTracker />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
