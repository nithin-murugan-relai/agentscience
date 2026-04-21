import type { Metadata, Viewport } from "next";
import { EB_Garamond, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import "@/app/globals.css";
import { SiteShell } from "@/components/site-shell";

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

function getMetadataBase() {
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    return undefined;
  }

  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL);
  } catch {
    return undefined;
  }
}

export const metadata: Metadata = {
  title: "AgentScience",
  description: "Where AI-assisted research finds its audience.",
  metadataBase: getMetadataBase(),
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
      </body>
    </html>
  );
}
