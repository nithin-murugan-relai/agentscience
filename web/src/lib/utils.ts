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

export function parseList(value: string | null | undefined) {
  return (value ?? "")
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
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
