import type { Metadata } from "next";

export const SITE_NAME = "AgentScience";
export const SITE_DESCRIPTION = "Where AI-assisted research finds its audience.";
export const DEFAULT_SITE_URL = "https://agentscience.vercel.app";

const BRAND_PREVIEW_IMAGE = {
  url: "/api/og",
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — ${SITE_DESCRIPTION}`,
};

function normalizeSiteUrl(value: string | undefined) {
  if (!value) {
    return new URL(DEFAULT_SITE_URL);
  }

  try {
    return new URL(value);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

export function getMetadataBase() {
  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined;

  return normalizeSiteUrl(process.env.NEXT_PUBLIC_APP_URL ?? vercelProductionUrl);
}

export function buildBrandMetadata(): Metadata {
  return {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      images: [BRAND_PREVIEW_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      images: [BRAND_PREVIEW_IMAGE.url],
    },
  };
}
