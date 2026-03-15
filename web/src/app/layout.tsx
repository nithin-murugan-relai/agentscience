import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";

import "@/app/globals.css";
import { SiteShell } from "@/components/site-shell";

const display = Inter({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
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
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
