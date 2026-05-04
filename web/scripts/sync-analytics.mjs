#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { createClient } from "redis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const defaultOut = path.join(root, ".analytics/analytics-snapshot.json");

const analyticsEnvPath =
  process.env.ANALYTICS_ENV_FILE ?? "/home/vineet/agentscience-analytics.env";
if (existsSync(analyticsEnvPath)) {
  loadEnv({ path: analyticsEnvPath, override: false, quiet: true });
} else {
  loadEnv({ path: path.join(root, ".env.production.local"), override: false, quiet: true });
  loadEnv({ path: path.join(root, ".env.local"), override: false, quiet: true });
}

const analyticsRedisPrefix =
  process.env.ANALYTICS_REDIS_PREFIX ?? "agentscience:analytics:v1";

const panelMap = {
  pages: "pages",
  referrers: "referrers",
  countries: "countries",
  devices: "devices",
  browsers: "browsers",
  os: "operatingSystems",
  events: "events",
};

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const nextValue = inlineValue ?? argv[index + 1];
    if (inlineValue === undefined && nextValue && !nextValue.startsWith("--")) {
      index += 1;
    }
    args[rawKey] = nextValue ?? "true";
  }
  return args;
}

function readJson(filePath, fallback = null) {
  if (!filePath || !existsSync(filePath)) return fallback;
  const raw = readFileSync(filePath, "utf8").trim();
  if (!raw) return fallback;
  return JSON.parse(raw);
}

function resolveInput(filePath) {
  if (!filePath) return null;
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

function runTextCommand(command, args) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runPlatformCounts(args) {
  const databaseUrl = args["database-url"] ?? process.env.ANALYTICS_DATABASE_URL;

  try {
    if (!databaseUrl) {
      return {
        data: null,
        error: "ANALYTICS_DATABASE_URL is not set.",
      };
    }

    const sql = "SELECT public.analytics_counts()::text;";
    const output = runTextCommand("psql", [
      databaseUrl,
      "-v",
      "ON_ERROR_STOP=1",
      "-tA",
      "-c",
      sql,
    ]);
    return { data: JSON.parse(output), error: null };
  } catch (error) {
    return {
      data: null,
      error: error.stderr?.toString().trim() || error.message,
    };
  }
}

async function fetchPublicGithubJson(endpoint) {
  const response = await fetch(`https://api.github.com/${endpoint}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "agentscience-analytics",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API returned ${response.status}${text ? `: ${text}` : ""}`);
  }

  return response.json();
}

async function runLatestRelease(repository) {
  try {
    return {
      data: await fetchPublicGithubJson(`repos/${repository}/releases/latest`),
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error.message,
    };
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((value) => value.trim() !== ""));
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/[%,$\s]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRows(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const labelIndex = headers.findIndex((header) =>
    ["page", "route", "path", "referrer", "source", "country", "device", "browser", "os", "operating system", "event", "name"].includes(header),
  );
  const valueIndex = headers.findIndex((header) =>
    ["visitors", "page views", "pageviews", "views", "users", "total", "count", "launches", "downloads"].includes(header),
  );
  const shareIndex = headers.findIndex((header) =>
    ["share", "percentage", "percent", "%"].includes(header),
  );

  return rows.slice(1).flatMap((row) => {
    const fallbackLabelIndex = row.findIndex((cell) => parseNumber(cell) === null);
    const label = row[labelIndex >= 0 ? labelIndex : fallbackLabelIndex]?.trim();
    const numericIndex =
      valueIndex >= 0 ? valueIndex : row.findIndex((cell) => parseNumber(cell) !== null);
    const value = parseNumber(row[numericIndex]);
    const share = shareIndex >= 0 ? parseNumber(row[shareIndex]) : null;

    if (!label || value === null) return [];
    return [{ label, value, share }];
  });
}

function importPanelCsv(args, key) {
  const filePath = resolveInput(args[`${key}-csv`]);
  if (!filePath) return [];
  if (!existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }
  return normalizeRows(parseCsv(readFileSync(filePath, "utf8")));
}

function normalizeSourceRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row) return [];
    const label = row.label ?? row.name ?? row.path ?? row.page ?? row.country ?? row.source;
    const value =
      parseNumber(row.value) ??
      parseNumber(row.visitors) ??
      parseNumber(row.users) ??
      parseNumber(row.count) ??
      parseNumber(row.total);
    const share = parseNumber(row.share ?? row.percent ?? row.percentage);
    if (!label || value === null) return [];
    return [{ label: String(label), value, share }];
  });
}

async function withRedis(callback) {
  if (!process.env.REDIS_URL) return null;

  const client = createClient({
    url: process.env.REDIS_URL,
    socket: {
      connectTimeout: 5_000,
      reconnectStrategy: false,
    },
  });

  client.on("error", (error) => {
    console.error("Redis client error", error);
  });

  try {
    await client.connect();
    return await callback(client);
  } catch {
    return null;
  } finally {
    if (client.isOpen) {
      await client.quit();
    }
  }
}

function dayKeys(days) {
  const now = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() - (days - index - 1));
    const day = date.toISOString().slice(0, 10);
    const prefix = `${analyticsRedisPrefix}:day:${day}`;
    return {
      date: day,
      pageViews: `${prefix}:pageViews`,
      visitors: `${prefix}:visitors`,
      pages: `${prefix}:pages`,
      referrers: `${prefix}:referrers`,
      countries: `${prefix}:countries`,
      devices: `${prefix}:devices`,
      operatingSystems: `${prefix}:operatingSystems`,
    };
  });
}

async function aggregateSortedSet(client, keys, limit) {
  const tempKey = `${analyticsRedisPrefix}:tmp:${Date.now()}:${Math.random()}`;
  try {
    await client.sendCommand(["ZUNIONSTORE", tempKey, String(keys.length), ...keys]);
    await client.expire(tempKey, 60);
    const rows = await client.zRangeWithScores(tempKey, 0, limit - 1, {
      REV: true,
    });
    return rows.map((row) => ({
      label: row.value,
      value: Number(row.score),
    }));
  } finally {
    await client.del(tempKey);
  }
}

function addShare(rows) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return rows.map((row) => ({
    ...row,
    share: total > 0 ? Math.round((row.value / total) * 100) : null,
  }));
}

async function loadFirstPartyWebAnalytics(days) {
  return withRedis(async (client) => {
    const keys = dayKeys(days);
    const timeseries = await Promise.all(
      keys.map(async (entry) => ({
        date: entry.date,
        visitors: Number(await client.sendCommand(["PFCOUNT", entry.visitors])),
        pageViews: Number((await client.get(entry.pageViews)) ?? 0),
      })),
    );
    const visitors = timeseries.reduce((sum, point) => sum + point.visitors, 0);
    const pageViews = timeseries.reduce((sum, point) => sum + point.pageViews, 0);

    const [pages, referrers, countries, devices, operatingSystems] =
      await Promise.all([
        aggregateSortedSet(client, keys.map((entry) => entry.pages), 12),
        aggregateSortedSet(client, keys.map((entry) => entry.referrers), 12),
        aggregateSortedSet(client, keys.map((entry) => entry.countries), 12),
        aggregateSortedSet(client, keys.map((entry) => entry.devices), 8),
        aggregateSortedSet(client, keys.map((entry) => entry.operatingSystems), 8),
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
      countries: addShare(countries),
      devices: addShare(devices),
      operatingSystems: addShare(operatingSystems),
    };
  });
}

function buildTimeseries(days, importedSeries = []) {
  if (Array.isArray(importedSeries) && importedSeries.length > 0) {
    return importedSeries.map((point) => ({
      date: String(point.date),
      visitors: parseNumber(point.visitors) ?? 0,
      pageViews: parseNumber(point.pageViews ?? point.pageviews) ?? 0,
      appUsers: parseNumber(point.appUsers ?? point.users),
    }));
  }

  const today = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (days - index - 1));
    return {
      date: date.toISOString().slice(0, 10),
      visitors: 0,
      pageViews: 0,
      appUsers: null,
    };
  });
}

function sumRows(rows) {
  return rows.reduce((total, row) => total + (parseNumber(row.value) ?? 0), 0);
}

function shortCommit(value) {
  if (!value || typeof value !== "string") return null;
  return value.slice(0, 7);
}

function desktopReleaseRepository(args) {
  const configured =
    args["desktop-repo"] ?? process.env.AGENTSCIENCE_DESKTOP_RELEASE_REPOSITORY;
  if (!configured) return "vineet-reddy/agentscience-app";

  const [owner, repo, ...rest] = configured.split("/");
  if (!owner || !repo || rest.length > 0) {
    throw new Error(`Invalid desktop release repository: ${configured}`);
  }
  return `${owner}/${repo}`;
}

function isInstallerAsset(asset) {
  const name = asset?.name;
  if (!name || name.endsWith(".blockmap")) return false;
  return /\.(dmg|exe|AppImage)$/u.test(name);
}

function platformForAsset(name) {
  if (name.includes("mac") || name.endsWith(".dmg")) return "macOS";
  if (name.includes("win") || name.endsWith(".exe")) return "Windows";
  if (name.includes("linux") || name.endsWith(".AppImage")) return "Linux";
  return "Other";
}

function rowsFromCounts(counts) {
  return Object.entries(counts)
    .filter(([, value]) => value > 0)
    .sort(([, left], [, right]) => right - left)
    .map(([label, value]) => ({ label, value }));
}

function releaseAnalytics(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const installers = assets.filter(isInstallerAsset);
  const platformCounts = {};
  let downloads = 0;

  for (const asset of installers) {
    const count = parseNumber(asset.download_count) ?? 0;
    downloads += count;
    const platform = platformForAsset(asset.name);
    platformCounts[platform] = (platformCounts[platform] ?? 0) + count;
  }

  const tag = release?.tag_name ? String(release.tag_name) : null;
  return {
    downloads,
    versions: tag && downloads > 0 ? [{ label: tag, value: downloads }] : [],
    platforms: rowsFromCounts(platformCounts),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectName = args.project ?? process.env.ANALYTICS_PROJECT_NAME ?? "agentscience";
  const domain = args.domain ?? process.env.ANALYTICS_DOMAIN ?? "agentscience.app";
  const outPath = resolveInput(args.out) ?? defaultOut;
  const days = parseNumber(args.days) ?? 7;
  const rangeLabel = args["range-label"] ?? `Last ${days} days`;
  const environment = args.environment ?? "production";

  const current = readJson(outPath, {});
  const externalWeb =
    readJson(resolveInput(args["web-json"]), null) ??
    (await loadFirstPartyWebAnalytics(days)) ??
    {};
  const appInput = readJson(resolveInput(args["app-json"]), current.app ?? {});

  const release =
    args["skip-github-release"] === "true"
      ? { data: null, error: "Skipped by --skip-github-release." }
      : await runLatestRelease(desktopReleaseRepository(args));
  const platform =
    args["skip-platform"] === "true" || args["skip-neon"] === "true"
      ? { data: null, error: "Skipped by --skip-platform." }
      : runPlatformCounts(args);
  const releaseApp = release.data ? releaseAnalytics(release.data) : {};
  const app = {
    ...appInput,
    downloads:
      parseNumber(appInput.downloads) ??
      parseNumber(appInput.summary?.downloads) ??
      parseNumber(releaseApp.downloads),
    versions:
      normalizeSourceRows(appInput.versions).length > 0
        ? appInput.versions
        : releaseApp.versions,
    platforms:
      normalizeSourceRows(appInput.platforms).length > 0
        ? appInput.platforms
        : releaseApp.platforms,
  };

  const webPanels = {
    pages: normalizeSourceRows(externalWeb.pages ?? current.web?.pages),
    referrers: normalizeSourceRows(externalWeb.referrers ?? current.web?.referrers),
    countries: normalizeSourceRows(externalWeb.countries ?? current.web?.countries),
    devices: normalizeSourceRows(externalWeb.devices ?? current.web?.devices),
    browsers: normalizeSourceRows(externalWeb.browsers ?? current.web?.browsers),
    operatingSystems: normalizeSourceRows(
      externalWeb.operatingSystems ?? externalWeb.os ?? current.web?.operatingSystems,
    ),
    events: normalizeSourceRows(externalWeb.events ?? current.web?.events),
  };

  for (const [argKey, panelKey] of Object.entries(panelMap)) {
    const imported = importPanelCsv(args, argKey);
    if (imported.length > 0) {
      webPanels[panelKey] = imported;
    }
  }

  const importedTimeseries =
    externalWeb.timeseries ?? app.timeseries ?? current.timeseries ?? [];
  const timeseries = buildTimeseries(days, importedTimeseries);
  const pageViewsFromSeries = timeseries.reduce(
    (total, point) => total + (parseNumber(point.pageViews) ?? 0),
    0,
  );
  const visitorsFromSeries = timeseries.reduce(
    (total, point) => total + (parseNumber(point.visitors) ?? 0),
    0,
  );
  const visitorsFallback =
    visitorsFromSeries > 0 ? visitorsFromSeries : sumRows(webPanels.pages);
  const pageViewsFallback =
    pageViewsFromSeries > 0 ? pageViewsFromSeries : sumRows(webPanels.pages);

  const appUsers =
    parseNumber(app.activeUsers) ??
    parseNumber(app.summary?.appUsers) ??
    parseNumber(current.summary?.appUsers);
  const appDownloads =
    parseNumber(app.downloads) ??
    parseNumber(app.summary?.downloads) ??
    parseNumber(current.summary?.downloads);
  const appStatus =
    release.data || appUsers !== null || appDownloads !== null
      ? "synced"
      : app.status ?? "pending";
  const platformUsers =
    parseNumber(platform.data?.users) ?? parseNumber(current.platform?.users);
  const accounts =
    parseNumber(externalWeb.summary?.accounts) ??
    platformUsers ??
    parseNumber(current.summary?.accounts);
  const papers =
    parseNumber(platform.data?.papers) ?? parseNumber(current.summary?.papers);
  const reviews =
    parseNumber(platform.data?.reviews) ?? parseNumber(current.summary?.reviews);
  const ideas =
    parseNumber(platform.data?.ideas) ?? parseNumber(current.summary?.ideas);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    range: {
      label: rangeLabel,
      start: args.start ?? null,
      end: args.end ?? null,
    },
    sources: [
      {
        id: "agentscience-web",
        label: "AgentScience web",
        kind: "web",
        status: "synced",
        description: "Synced from first-party Redis analytics counters.",
      },
      {
        id: "agentscience-platform",
        label: "AgentScience platform",
        kind: "database",
        status: platform.data ? "synced" : "pending",
        description: platform.data
          ? "Synced from the read-only analytics Postgres connection."
          : `Platform counts not synced${platform.error ? `: ${platform.error}` : "."}`,
      },
      {
        id: "agentscience-app",
        label: "AgentScience App",
        kind: "app",
        status: appStatus,
        description:
          app.description ??
          (release.data
            ? `Synced from GitHub Releases for ${desktopReleaseRepository(args)}.`
            : `Desktop app analytics not synced${release.error ? `: ${release.error}` : "."}`),
      },
    ],
    summary: {
      visitors:
        parseNumber(externalWeb.summary?.visitors) ??
        visitorsFallback,
      pageViews:
        parseNumber(externalWeb.summary?.pageViews ?? externalWeb.summary?.pageviews) ??
        pageViewsFallback,
      bounceRate:
        parseNumber(externalWeb.summary?.bounceRate) ??
        parseNumber(current.summary?.bounceRate),
      accounts,
      platformUsers,
      papers,
      reviews,
      ideas,
      appUsers,
      downloads: appDownloads,
      countries: webPanels.countries.length,
    },
    timeseries,
    web: {
      project: {
        name: projectName,
        domain,
        environment,
        plan: "unknown",
        lastDeployment: null,
        lastCommit: shortCommit(process.env.VERCEL_GIT_COMMIT_SHA),
      },
      ...webPanels,
    },
    platform: {
      status: platform.data ? "synced" : "pending",
      users: platformUsers,
      papers,
      reviews,
      ideas,
    },
    app: {
      status: appStatus,
      activeUsers: appUsers,
      launches: parseNumber(app.launches),
      downloads: appDownloads,
      versions: normalizeSourceRows(app.versions),
      platforms: normalizeSourceRows(app.platforms),
      countries: normalizeSourceRows(app.countries),
    },
    notes: [
      "First-party web analytics were aggregated from Redis counters.",
      "Platform counts were queried through a read-only Postgres connection.",
      "Desktop app release download counts were fetched from the public GitHub Releases API when available.",
      "Desktop app analytics can be merged with --app-json.",
    ],
  };

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Wrote ${path.relative(root, outPath)}`);
}

await main();
