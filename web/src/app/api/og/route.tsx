import { ImageResponse } from "next/og";

import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/metadata";

export const runtime = "edge";

const WIDTH = 1200;
const HEIGHT = 630;
const CACHE_CONTROL = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

const SURFACE = "#FAFAFA";
const INK = "#1A1A1A";
const INK_LIGHT = "#6E6E6E";
const INK_FAINT = "#ABABAB";
const RULE = "#E5E5E5";
const ACCENT = "#3b5bdb";

const HERO_HEADLINE = "Science, amplified.";

/** Extra glyphs so font subsets cover common punctuation and quotes. */
const FONT_FALLBACK_CHARS =
  `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789` +
  `.,;:!?'"()[]{}/\\-–—•·…@%&+#=<>°` +
  "\u201C\u201D\u2018\u2019";

async function loadGoogleFont(
  family: string,
  weight: number,
  text: string,
): Promise<ArrayBuffer> {
  const familyParam = family.replace(/ /g, "+");
  const url =
    `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weight}` +
    `&text=${encodeURIComponent(text)}`;

  const css = await fetch(url).then((res) => res.text());
  const fontUrl = css.match(/src:\s*url\((https:[^)]+)\)/)?.[1];
  if (!fontUrl) {
    throw new Error(`Could not resolve font URL for ${family} ${weight}`);
  }

  return fetch(fontUrl).then((res) => res.arrayBuffer());
}

function uniqueCharsForFont(...parts: string[]) {
  const seen = new Set<string>();
  let out = "";
  for (const part of parts) {
    for (const ch of part) {
      if (!seen.has(ch)) {
        seen.add(ch);
        out += ch;
      }
    }
  }
  for (const ch of FONT_FALLBACK_CHARS) {
    if (!seen.has(ch)) {
      seen.add(ch);
      out += ch;
    }
  }
  return out;
}

function FlaskLogo({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="280 218 460 520"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(512, 488)">
        <path
          d="M-72,-260 L-72,-100 L-205,190 Q-215,222 -180,238 L180,238 Q215,222 205,190 L72,-100 L72,-260"
          fill="none"
          stroke={INK}
          strokeWidth="16"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <line
          x1="-102"
          y1="-260"
          x2="102"
          y2="-260"
          stroke={INK}
          strokeWidth="16"
          strokeLinecap="round"
        />

        <line x1="-50" y1="60" x2="40" y2="145" stroke={ACCENT} strokeWidth="6" opacity="0.30" />
        <line x1="40" y1="145" x2="90" y2="78" stroke={ACCENT} strokeWidth="6" opacity="0.30" />
        <line x1="-50" y1="60" x2="-108" y2="145" stroke={ACCENT} strokeWidth="6" opacity="0.30" />
        <line x1="-108" y1="145" x2="40" y2="145" stroke={ACCENT} strokeWidth="5" opacity="0.22" />
        <line x1="40" y1="145" x2="-24" y2="195" stroke={ACCENT} strokeWidth="5" opacity="0.22" />
        <line x1="-50" y1="60" x2="18" y2="20" stroke={ACCENT} strokeWidth="5" opacity="0.22" />
        <line x1="90" y1="78" x2="18" y2="20" stroke={ACCENT} strokeWidth="4" opacity="0.18" />
        <line x1="-108" y1="145" x2="-24" y2="195" stroke={ACCENT} strokeWidth="4" opacity="0.18" />

        <circle cx="-50" cy="60" r="20" fill={ACCENT} opacity="0.85" />
        <circle cx="40" cy="145" r="23" fill={ACCENT} opacity="0.92" />
        <circle cx="90" cy="78" r="16" fill={ACCENT} opacity="0.70" />
        <circle cx="-108" cy="145" r="18" fill={ACCENT} opacity="0.75" />
        <circle cx="-24" cy="195" r="14" fill={ACCENT} opacity="0.60" />
        <circle cx="18" cy="20" r="13" fill={ACCENT} opacity="0.55" />
      </g>
    </svg>
  );
}

function HeaderBar() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "56px 80px 32px",
      }}
    >
      <FlaskLogo size={40} />
      <span
        style={{
          fontFamily: "EB Garamond",
          fontSize: 36,
          fontWeight: 400,
          letterSpacing: "-0.005em",
          lineHeight: 1,
          color: INK,
        }}
      >
        {SITE_NAME}
      </span>
    </div>
  );
}

function HeaderRule() {
  return (
    <div
      style={{
        display: "flex",
        height: 1,
        background: RULE,
        margin: "0 80px",
      }}
    />
  );
}

function paperTitleSize(title: string) {
  if (title.length > 115) {
    return 40;
  }
  if (title.length > 82) {
    return 46;
  }
  return 52;
}

function paperAbstractSize(abstract: string) {
  return abstract.length > 220 ? 24 : 26;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const isPaper = requestUrl.searchParams.get("kind") === "paper";

  const title = isPaper
    ? getPreviewParam(requestUrl, "title", "Untitled paper", 150)
    : "";
  const abstract = isPaper ? getPreviewParam(requestUrl, "abstract", "", 280) : "";
  const authors = isPaper ? getPreviewParam(requestUrl, "authors", "", 120) : "";
  const publishedAt = isPaper ? getPreviewParam(requestUrl, "publishedAt", "", 40) : "";

  const garamondSubset = isPaper
    ? uniqueCharsForFont(SITE_NAME, title)
    : uniqueCharsForFont(SITE_NAME, HERO_HEADLINE);

  const plexSubset = isPaper
    ? uniqueCharsForFont(SITE_DESCRIPTION, abstract, authors, publishedAt, SITE_NAME)
    : uniqueCharsForFont(SITE_DESCRIPTION);

  const [garamond, plexSans] = await Promise.all([
    loadGoogleFont("EB Garamond", 400, garamondSubset),
    loadGoogleFont("IBM Plex Sans", 400, plexSubset),
  ]);

  const metadataLine = [authors, publishedAt].filter(Boolean).join(" · ") || SITE_NAME;

  const body = isPaper ? (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "40px 80px 48px",
        minHeight: 0,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontFamily: "EB Garamond",
          fontSize: paperTitleSize(title),
          fontWeight: 400,
          lineHeight: 1.14,
          color: INK,
          maxHeight: 200,
          overflow: "hidden",
        }}
      >
        {title}
      </div>

      <div style={{ marginTop: 28, height: 1, background: RULE, flexShrink: 0 }} />

      <div
        style={{
          marginTop: 28,
          flex: 1,
          minHeight: 0,
          fontSize: paperAbstractSize(abstract),
          fontWeight: 400,
          lineHeight: 1.5,
          color: INK_LIGHT,
          overflow: "hidden",
        }}
      >
        {abstract}
      </div>

      <div style={{ marginTop: 28, height: 1, background: RULE, flexShrink: 0 }} />

      <div
        style={{
          marginTop: 22,
          fontSize: 21,
          fontWeight: 400,
          lineHeight: 1.4,
          color: INK_FAINT,
        }}
      >
        {metadataLine}
      </div>
    </div>
  ) : (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 80px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: "EB Garamond",
          fontSize: 112,
          fontWeight: 400,
          lineHeight: 1.04,
          letterSpacing: "-0.018em",
          color: INK,
          whiteSpace: "nowrap",
        }}
      >
        {HERO_HEADLINE}
      </div>
      <div
        style={{
          marginTop: 28,
          fontSize: 30,
          fontWeight: 400,
          lineHeight: 1.4,
          color: INK_LIGHT,
          maxWidth: 880,
        }}
      >
        {SITE_DESCRIPTION}
      </div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: SURFACE,
          color: INK,
          display: "flex",
          flexDirection: "column",
          fontFamily: "IBM Plex Sans",
        }}
      >
        <HeaderBar />
        <HeaderRule />
        {body}
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        "cache-control": CACHE_CONTROL,
      },
      fonts: [
        {
          name: "EB Garamond",
          data: garamond,
          weight: 400,
          style: "normal",
        },
        {
          name: "IBM Plex Sans",
          data: plexSans,
          weight: 400,
          style: "normal",
        },
      ],
    },
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
