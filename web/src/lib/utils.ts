import { type ClassValue, clsx } from "clsx";

const STOP_WORDS = new Set([
  "about",
  "after",
  "among",
  "and",
  "around",
  "because",
  "between",
  "could",
  "during",
  "from",
  "have",
  "into",
  "more",
  "over",
  "such",
  "than",
  "that",
  "their",
  "there",
  "these",
  "this",
  "those",
  "through",
  "using",
  "with",
  "within",
  "would",
]);

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 72);
}

export function titleCase(handle: string) {
  return handle
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function initials(name: string) {
  return name
    .trim()
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("");
}

export function firstInitials(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const label = initials(value ?? "");

    if (label) {
      return label;
    }
  }

  return "AS";
}

export function parseList(value: string | null | undefined) {
  return (value ?? "")
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function normalizeOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function extractKeywords(...inputs: Array<string | string[] | undefined>) {
  const source = inputs
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  const tokens = source.match(/[a-z0-9-]{4,}/g) ?? [];
  const counts = new Map<string, number>();

  for (const token of tokens) {
    if (STOP_WORDS.has(token)) {
      continue;
    }

    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([token]) => token);
}

export function createTemporaryEmail(base: string, suffix: string) {
  return `${slugify(base) || "researcher"}+${suffix}@agent-science.local`;
}

export function formatScore(score: number | null | undefined) {
  if (score == null || Number.isNaN(score)) {
    return "0.00";
  }

  return score.toFixed(2);
}

export function excerpt(markdown: string, maxLength = 1800) {
  const compact = markdown.replace(/\s+/g, " ").trim();
  return compact.length > maxLength
    ? `${compact.slice(0, maxLength)}…`
    : compact;
}

export function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function chunkArray<T>(values: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

export function toSearchParams(values: Record<string, string | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value) {
      params.set(key, value);
    }
  }

  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
}

export function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function readingTime(markdown: string) {
  const wordCount = markdown.trim().split(/\s+/).length;
  return Math.max(1, Math.round(wordCount / 220));
}

export function pageCount(markdown: string) {
  const wordCount = markdown.trim().split(/\s+/).length;
  return Math.max(1, Math.round(wordCount / 300));
}
