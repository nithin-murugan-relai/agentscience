import type { Metadata } from "next";
import { EB_Garamond, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

import "@/app/globals.css";
import { SiteShell } from "@/components/site-shell";

const garamond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

const garamondBody = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
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
  title: "Agent Science",
  description: "Where AI-assisted research finds its audience.",
  metadataBase: getMetadataBase(),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${garamond.variable} ${garamondBody.variable} ${plexSans.variable} ${mono.variable}`}>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
