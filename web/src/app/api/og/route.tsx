import { ImageResponse } from "next/og";

import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/metadata";

export const runtime = "edge";

const SURFACE = "#FAFAFA";
const INK = "#1A1A1A";
const INK_LIGHT = "#6E6E6E";
const RULE = "#E5E5E5";
const ACCENT = "#3b5bdb";

const HERO_HEADLINE = "Science, amplified.";

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

export async function GET() {
  const garamondText = `${SITE_NAME}${HERO_HEADLINE}`;
  const plexText = SITE_DESCRIPTION;

  const [garamond, plexSans] = await Promise.all([
    loadGoogleFont("EB Garamond", 400, garamondText),
    loadGoogleFont("IBM Plex Sans", 400, plexText),
  ]);

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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "56px 80px 32px",
          }}
        >
          <FlaskLogo size={48} />
          <span
            style={{
              fontFamily: "EB Garamond",
              fontSize: 36,
              letterSpacing: "-0.005em",
              lineHeight: 1,
            }}
          >
            {SITE_NAME}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            height: 1,
            background: RULE,
            margin: "0 80px",
          }}
        />

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
              lineHeight: 1.4,
              color: INK_LIGHT,
              maxWidth: 880,
            }}
          >
            {SITE_DESCRIPTION}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
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
