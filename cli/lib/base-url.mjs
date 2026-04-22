export const CANONICAL_PRODUCTION_BASE_URL = "https://agentscience.app";
export const LEGACY_PRODUCTION_BASE_URL = "https://agentscience.vercel.app";

export function normalizeAgentScienceBaseUrl(value) {
  const rawValue = typeof value === "string" ? value.trim() : "";
  if (!rawValue) {
    return CANONICAL_PRODUCTION_BASE_URL;
  }

  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch {
    return rawValue;
  }

  parsed.hash = "";

  if (
    parsed.hostname === "agentscience.vercel.app" &&
    (parsed.protocol === "http:" || parsed.protocol === "https:")
  ) {
    parsed.protocol = "https:";
    parsed.hostname = "agentscience.app";
    parsed.port = "";
  }

  const normalizedPath =
    parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");

  return `${parsed.origin}${normalizedPath}${parsed.search}`;
}
