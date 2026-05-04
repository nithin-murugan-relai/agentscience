import { createHmac } from "node:crypto";
import { randomUUID } from "node:crypto";

import { getRedisClient } from "@/lib/redis";

export const ANALYTICS_REDIS_PREFIX =
  process.env.ANALYTICS_REDIS_PREFIX ?? "agentscience:analytics:v1";
export const ANALYTICS_SNAPSHOT_REDIS_KEY =
  process.env.ANALYTICS_REDIS_KEY ?? "agentscience:analytics:snapshot";

const MAX_LABEL_LENGTH = 180;
const KNOWN_OPERATING_SYSTEMS = [
  ["Windows", /Windows NT/i],
  ["iOS", /iPhone|iPad|iPod/i],
  ["Android", /Android/i],
  ["Mac", /Mac OS X|Macintosh/i],
  ["GNU/Linux", /Linux/i],
] as const;

export type AnalyticsEventInput = {
  visitorId: string;
  path: string;
  referrer?: string | null;
  userAgent?: string | null;
  country?: string | null;
};

export type WebAnalyticsSnapshot = {
  summary: {
    visitors: number;
    pageViews: number;
    bounceRate: number | null;
  };
  timeseries: Array<{
    date: string;
    visitors: number;
    pageViews: number;
  }>;
  pages: AnalyticsRow[];
  referrers: AnalyticsRow[];
  countries: AnalyticsRow[];
  devices: AnalyticsRow[];
  operatingSystems: AnalyticsRow[];
};

export type AnalyticsRow = {
  label: string;
  value: number;
  share?: number | null;
};

function analyticsHashSecret() {
  return process.env.CRON_SECRET ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "agentscience";
}

function hashVisitorId(visitorId: string) {
  return createHmac("sha256", analyticsHashSecret()).update(visitorId).digest("hex");
}

function normalizePath(path: string) {
  const normalized = path.trim().split("?")[0]?.split("#")[0] || "/";
  if (!normalized.startsWith("/")) return "/";
  if (
    normalized.startsWith("/api/") ||
    normalized.startsWith("/_next/") ||
    normalized === "/favicon.ico"
  ) {
    return null;
  }
  return normalized.slice(0, MAX_LABEL_LENGTH);
}

function normalizeCountry(country: string | null | undefined) {
  const normalized = country?.trim();
  if (!normalized || normalized === "XX") return "Unknown";
  return normalized.slice(0, MAX_LABEL_LENGTH);
}

function normalizeReferrer(referrer: string | null | undefined) {
  if (!referrer) return "Direct";

  try {
    const parsed = new URL(referrer);
    const host = parsed.hostname.replace(/^www\./, "");
    return host || "Direct";
  } catch {
    return "Direct";
  }
}

function detectDevice(userAgent: string | null | undefined) {
  const agent = userAgent ?? "";
  if (/Mobile|Android|iPhone|iPod/i.test(agent)) return "Mobile";
  if (/iPad|Tablet/i.test(agent)) return "Tablet";
  return "Desktop";
}

function detectOperatingSystem(userAgent: string | null | undefined) {
  const agent = userAgent ?? "";
  for (const [label, pattern] of KNOWN_OPERATING_SYSTEMS) {
    if (pattern.test(agent)) return label;
  }
  return "Other";
}

function isBot(userAgent: string | null | undefined) {
  return /bot|crawl|spider|slurp|monitor|preview|facebookexternalhit|twitterbot|linkedinbot/i.test(
    userAgent ?? ""
  );
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function keysForDay(day: string) {
  const prefix = `${ANALYTICS_REDIS_PREFIX}:day:${day}`;
  return {
    pageViews: `${prefix}:pageViews`,
    visitors: `${prefix}:visitors`,
    pages: `${prefix}:pages`,
    referrers: `${prefix}:referrers`,
    countries: `${prefix}:countries`,
    devices: `${prefix}:devices`,
    operatingSystems: `${prefix}:operatingSystems`,
  };
}

function lastDays(days: number) {
  const now = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() - (days - index - 1));
    return dayKey(date);
  });
}

function rowValue(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function withShare(rows: AnalyticsRow[]) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return rows.map((row) => ({
    ...row,
    share: total > 0 ? Math.round((row.value / total) * 100) : null,
  }));
}

async function aggregateSortedSet(keys: string[], limit: number) {
  const client = await getRedisClient();
  if (!client || keys.length === 0) return [];

  const tempKey = `${ANALYTICS_REDIS_PREFIX}:tmp:${randomUUID()}`;
  try {
    await client.sendCommand(["ZUNIONSTORE", tempKey, String(keys.length), ...keys]);
    await client.expire(tempKey, 60);
    const rows = await client.zRangeWithScores(tempKey, 0, limit - 1, {
      REV: true,
    });
    return rows.map((row) => ({
      label: row.value,
      value: rowValue(row.score),
    }));
  } finally {
    await client.del(tempKey);
  }
}

export async function recordAnalyticsEvent(input: AnalyticsEventInput) {
  if (isBot(input.userAgent)) return;

  const path = normalizePath(input.path);
  if (!path || !input.visitorId.trim()) return;

  const client = await getRedisClient();
  if (!client) return;

  const day = dayKey(new Date());
  const keys = keysForDay(day);
  const visitorHash = hashVisitorId(input.visitorId);
  const ttlSeconds = 60 * 60 * 24 * 45;

  await Promise.all([
    client.incr(keys.pageViews),
    client.sendCommand(["PFADD", keys.visitors, visitorHash]),
    client.zIncrBy(keys.pages, 1, path),
    client.zIncrBy(keys.referrers, 1, normalizeReferrer(input.referrer)),
    client.zIncrBy(keys.countries, 1, normalizeCountry(input.country)),
    client.zIncrBy(keys.devices, 1, detectDevice(input.userAgent)),
    client.zIncrBy(keys.operatingSystems, 1, detectOperatingSystem(input.userAgent)),
  ]);

  await Promise.all(Object.values(keys).map((key) => client.expire(key, ttlSeconds)));
}

export async function getWebAnalyticsSnapshot(days = 7): Promise<WebAnalyticsSnapshot> {
  const client = await getRedisClient();
  const daysToRead = lastDays(days);
  const dayKeys = daysToRead.map(keysForDay);

  if (!client) {
    return {
      summary: { visitors: 0, pageViews: 0, bounceRate: null },
      timeseries: daysToRead.map((date) => ({ date, visitors: 0, pageViews: 0 })),
      pages: [],
      referrers: [],
      countries: [],
      devices: [],
      operatingSystems: [],
    };
  }

  const timeseries = await Promise.all(
    dayKeys.map(async (keys, index) => ({
      date: daysToRead[index],
      visitors: Number(await client.sendCommand(["PFCOUNT", keys.visitors])),
      pageViews: Number((await client.get(keys.pageViews)) ?? 0),
    }))
  );
  const visitors = timeseries.reduce((sum, point) => sum + point.visitors, 0);
  const pageViews = timeseries.reduce((sum, point) => sum + point.pageViews, 0);

  const [pages, referrers, countries, devices, operatingSystems] = await Promise.all([
    aggregateSortedSet(dayKeys.map((keys) => keys.pages), 12),
    aggregateSortedSet(dayKeys.map((keys) => keys.referrers), 12),
    aggregateSortedSet(dayKeys.map((keys) => keys.countries), 12),
    aggregateSortedSet(dayKeys.map((keys) => keys.devices), 8),
    aggregateSortedSet(dayKeys.map((keys) => keys.operatingSystems), 8),
  ]);

  return {
    summary: {
      visitors,
      pageViews,
      bounceRate: null,
    },
    timeseries,
    pages,
    referrers,
    countries: withShare(countries),
    devices: withShare(devices),
    operatingSystems: withShare(operatingSystems),
  };
}
