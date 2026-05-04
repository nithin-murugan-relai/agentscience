#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { createClient } from "redis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const snapshotPath = process.argv[2];

const analyticsEnvPath =
  process.env.ANALYTICS_ENV_FILE ?? "/home/vineet/agentscience-analytics.env";
if (existsSync(analyticsEnvPath)) {
  loadEnv({ path: analyticsEnvPath, override: false, quiet: true });
} else {
  loadEnv({ path: path.join(root, ".env.production.local"), override: false, quiet: true });
  loadEnv({ path: path.join(root, ".env.local"), override: false, quiet: true });
}

const redisKey = process.env.ANALYTICS_REDIS_KEY ?? "agentscience:analytics:snapshot";

if (!snapshotPath) {
  throw new Error("Usage: publish-analytics-snapshot.mjs <snapshot-json-path>");
}

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is required to publish analytics snapshots.");
}

const snapshot = readFileSync(snapshotPath, "utf8");
JSON.parse(snapshot);

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

await client.connect();
await client.set(redisKey, snapshot);
await client.quit();

console.log(`Published analytics snapshot to Redis key ${redisKey}.`);
