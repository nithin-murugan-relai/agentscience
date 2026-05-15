import type { Metadata } from "next";

import { formatDate, toSearchParams } from "@/lib/utils";

export const SITE_NAME = "AgentScience";
export const SITE_DESCRIPTION = "Where AI-assisted research finds its audience.";
export const DEFAULT_SITE_URL = "https://agentscience.vercel.app";

const BRAND_PREVIEW_IMAGE = {
  url: "/api/og",
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} | ${SITE_DESCRIPTION}`,
};

const OG_IMAGE_WIDTH = BRAND_PREVIEW_IMAGE.width;
const OG_IMAGE_HEIGHT = BRAND_PREVIEW_IMAGE.height;
const GENERIC_OG_IMAGE_PATH = BRAND_PREVIEW_IMAGE.url;

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

export type PaperPreviewMetadataInput = {
  title: string;
  abstract: string;
  authors: string[];
  publishedAt: Date | string;
};

export function buildPaperPreviewMetadata({
  title,
  abstract,
  authors,
  publishedAt,
}: PaperPreviewMetadataInput): Pick<Metadata, "openGraph" | "twitter"> {
  const description = trimPreviewText(abstract, 220);
  const authorLabel = formatPreviewAuthors(authors);
  const publishedLabel = formatDate(publishedAt);
  const imagePath = `${GENERIC_OG_IMAGE_PATH}${toSearchParams({
    kind: "paper",
    title: trimPreviewText(title, 150),
    abstract: trimPreviewText(abstract, 280),
    authors: authorLabel,
    publishedAt: publishedLabel,
  })}`;

  return {
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      type: "article",
      publishedTime: new Date(publishedAt).toISOString(),
      authors,
      images: [
        {
          url: imagePath,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: `${title} - ${SITE_NAME}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imagePath],
    },
  };
}

function formatPreviewAuthors(authors: string[]) {
  const names = authors.map((author) => normalizeWhitespace(author)).filter(Boolean);

  if (names.length <= 3) {
    return names.join(", ");
  }

  return `${names.slice(0, 3).join(", ")} et al.`;
}

function trimPreviewText(value: string, maxLength: number) {
  const normalized = normalizeWhitespace(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const clipped = normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd();
  const lastSpace = clipped.lastIndexOf(" ");
  const trimmed =
    lastSpace > Math.floor(maxLength * 0.65) ? clipped.slice(0, lastSpace) : clipped;

  return `${trimmed}...`;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
