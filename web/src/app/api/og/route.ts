import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";
import { createElement } from "react";
import type { CSSProperties, ReactElement } from "react";

import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/metadata";

export const runtime = "nodejs";

const WIDTH = 1200;
const HEIGHT = 630;
const CACHE_CONTROL = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

let logoDataUrlPromise: Promise<string> | undefined;

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const logoDataUrl = await getLogoDataUrl();
  const card =
    requestUrl.searchParams.get("kind") === "paper"
      ? renderPaperCard({
          logoDataUrl,
          title: getPreviewParam(requestUrl, "title", "Untitled paper", 150),
          abstract: getPreviewParam(requestUrl, "abstract", "", 280),
          authors: getPreviewParam(requestUrl, "authors", "", 120),
          publishedAt: getPreviewParam(requestUrl, "publishedAt", "", 40),
        })
      : renderGenericCard(logoDataUrl);

  return new ImageResponse(card, {
    width: WIDTH,
    height: HEIGHT,
    headers: {
      "cache-control": CACHE_CONTROL,
    },
  });
}

async function getLogoDataUrl() {
  logoDataUrlPromise ??= readFile(join(process.cwd(), "public", "logo.svg"), "utf8").then(
    (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
  );

  return logoDataUrlPromise;
}

function renderGenericCard(logoDataUrl: string): ReactElement {
  return createElement(
    "div",
    {
      style: {
        ...baseCardStyle,
        alignItems: "center",
        justifyContent: "center",
        padding: "70px",
        textAlign: "center",
      },
    },
    createElement("img", {
      src: logoDataUrl,
      alt: "",
      width: 156,
      height: 156,
      style: {
        border: "1px solid #e5e0d8",
        borderRadius: 28,
      },
    }),
    createElement(
      "div",
      {
        style: {
          marginTop: 28,
          fontSize: 72,
          fontWeight: 700,
          lineHeight: 1,
          color: "#171717",
        },
      },
      SITE_NAME
    ),
    createElement(
      "div",
      {
        style: {
          marginTop: 24,
          maxWidth: 780,
          fontSize: 36,
          lineHeight: 1.22,
          color: "#3f3f46",
        },
      },
      SITE_DESCRIPTION
    )
  );
}

function renderPaperCard({
  logoDataUrl,
  title,
  abstract,
  authors,
  publishedAt,
}: {
  logoDataUrl: string;
  title: string;
  abstract: string;
  authors: string;
  publishedAt: string;
}): ReactElement {
  const titleFontSize = title.length > 115 ? 48 : title.length > 82 ? 54 : 60;
  const abstractFontSize = abstract.length > 220 ? 25 : 28;
  const metadata = [authors, publishedAt].filter(Boolean).join(" | ");

  return createElement(
    "div",
    {
      style: {
        ...baseCardStyle,
        justifyContent: "space-between",
        padding: "58px 72px 54px",
      },
    },
    createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
        },
      },
      createElement(
        "div",
        {
          style: {
            maxHeight: 245,
            overflow: "hidden",
            fontSize: titleFontSize,
            fontWeight: 700,
            lineHeight: 1.08,
            color: "#171717",
          },
        },
        title
      ),
      createElement(
        "div",
        {
          style: {
            marginTop: 30,
            maxHeight: 154,
            overflow: "hidden",
            fontSize: abstractFontSize,
            lineHeight: 1.35,
            color: "#3f3f46",
          },
        },
        abstract
      )
    ),
    createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          width: "100%",
        },
      },
      createElement(
        "div",
        {
          style: {
            maxWidth: 760,
            overflow: "hidden",
            fontSize: 26,
            lineHeight: 1.25,
            color: "#52525b",
          },
        },
        metadata || SITE_NAME
      ),
      renderBrandMark(logoDataUrl)
    )
  );
}

function renderBrandMark(logoDataUrl: string): ReactElement {
  return createElement(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        marginLeft: 32,
      },
    },
    createElement("img", {
      src: logoDataUrl,
      alt: "",
      width: 42,
      height: 42,
      style: {
        border: "1px solid #e5e0d8",
        borderRadius: 9,
      },
    }),
    createElement(
      "div",
      {
        style: {
          marginLeft: 12,
          fontSize: 24,
          fontWeight: 700,
          color: "#171717",
        },
      },
      SITE_NAME
    )
  );
}

function getPreviewParam(url: URL, key: string, fallback: string, maxLength: number) {
  const value = normalizeWhitespace(url.searchParams.get(key) ?? "");

  if (!value) {
    return fallback;
  }

  if (value.length <= maxLength) {
    return value;
  }

  const clipped = value.slice(0, Math.max(0, maxLength - 3)).trimEnd();
  const lastSpace = clipped.lastIndexOf(" ");
  const trimmed =
    lastSpace > Math.floor(maxLength * 0.65) ? clipped.slice(0, lastSpace) : clipped;

  return `${trimmed}...`;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

const baseCardStyle = {
  display: "flex",
  flexDirection: "column",
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: "#fafafa",
  border: "1px solid #e5e0d8",
  boxSizing: "border-box",
  fontFamily: "sans serif",
} satisfies CSSProperties;
