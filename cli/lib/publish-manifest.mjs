import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const DEFAULT_PUBLISH_MANIFEST_BASENAME = "agentscience.publish.json";

function normalizeWhitespace(value) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeKeywords(values) {
  return [...new Set(values.map((value) => normalizeWhitespace(value).toLowerCase()).filter(Boolean))];
}

function normalizeShortName(value, sourceLabel) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  if (normalized.length > 35) {
    throw new Error(`${sourceLabel} shortName must be 35 characters or fewer.`);
  }

  return normalized;
}

function normalizeSlugList(values, sourceLabel) {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalized = [...new Set(
    values
      .filter((value) => typeof value === "string")
      .map((value) => normalizeWhitespace(value).toLowerCase())
      .filter(Boolean),
  )];

  for (const slug of normalized) {
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
      throw new Error(`${sourceLabel} topicSlugs must contain lowercase slugs.`);
    }
  }

  return normalized.slice(0, 12);
}

function normalizeProviderSlug(value, sourceLabel) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized) {
    return null;
  }

  if (!/^[a-z0-9-]+$/.test(normalized)) {
    throw new Error(`${sourceLabel} providerSlug must be lowercase letters, digits, or hyphens.`);
  }

  return normalized;
}

function normalizeDatasetUrl(value, sourceLabel) {
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error(`${sourceLabel} url must be a valid http or https URL.`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${sourceLabel} url must use http or https.`);
  }

  parsed.hash = "";

  if ((parsed.protocol === "http:" && parsed.port === "80") || (parsed.protocol === "https:" && parsed.port === "443")) {
    parsed.port = "";
  }

  if (parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }

  return parsed.toString();
}

function normalizePublishDataset(entry, sourceLabel) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`${sourceLabel} must be an object.`);
  }

  const name = typeof entry.name === "string" ? normalizeWhitespace(entry.name) : "";
  const shortName = normalizeShortName(entry.shortName, sourceLabel);
  const description =
    typeof entry.description === "string" ? normalizeWhitespace(entry.description) : "";
  const keywords = Array.isArray(entry.keywords)
    ? normalizeKeywords(entry.keywords.filter((value) => typeof value === "string"))
    : [];
  const providerSlug = normalizeProviderSlug(entry.providerSlug, sourceLabel);
  const topicSlugs = normalizeSlugList(entry.topicSlugs, sourceLabel);
  const registryEligible =
    typeof entry.registryEligible === "boolean" ? entry.registryEligible : true;

  if (name.length < 2 || name.length > 160) {
    throw new Error(`${sourceLabel} name must be between 2 and 160 characters.`);
  }

  if (description.length < 12 || description.length > 2000) {
    throw new Error(`${sourceLabel} description must be between 12 and 2000 characters.`);
  }

  return {
    name,
    shortName,
    url: normalizeDatasetUrl(String(entry.url ?? ""), sourceLabel),
    description,
    keywords: keywords.slice(0, 16),
    providerSlug,
    topicSlugs,
    registryEligible,
  };
}

export function parsePublishManifest(rawContent, manifestPath = "<inline>") {
  let payload;
  try {
    payload = JSON.parse(rawContent);
  } catch {
    throw new Error(`Publish manifest ${manifestPath} is not valid JSON.`);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`Publish manifest ${manifestPath} must be a JSON object.`);
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, "version") &&
    payload.version !== 1
  ) {
    throw new Error(`Publish manifest ${manifestPath} must use version 1.`);
  }

  if (!Array.isArray(payload.datasets)) {
    throw new Error(`Publish manifest ${manifestPath} must include a datasets array.`);
  }

  return {
    version: 1,
    datasets: payload.datasets.map((entry, index) =>
      normalizePublishDataset(entry, `Publish manifest dataset #${index + 1}`),
    ),
  };
}

export function loadPublishManifest({ workspaceDir, manifestPath } = {}) {
  const resolvedManifestPath = manifestPath
    ? resolve(manifestPath)
    : workspaceDir
      ? resolve(join(workspaceDir, DEFAULT_PUBLISH_MANIFEST_BASENAME))
      : null;

  if (!resolvedManifestPath || !existsSync(resolvedManifestPath)) {
    return null;
  }

  const rawContent = readFileSync(resolvedManifestPath, "utf8");
  const manifest = parsePublishManifest(rawContent, resolvedManifestPath);

  return {
    manifestPath: resolvedManifestPath,
    ...manifest,
  };
}
