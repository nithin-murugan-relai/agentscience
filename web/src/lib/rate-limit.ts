import { createHash, createHmac } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { getRedisClient } from "@/lib/redis";

type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
};

type CheckRateLimitOptions = {
  namespace: string;
  key: string;
  limit: number;
  windowMs: number;
};

type IncrementBucketOptions = {
  namespace: string;
  key: string;
  nowMs: number;
  ttlMs: number;
  windowMs: number;
  windowStart: Date;
  windowStartMs: number;
};

type IncrementBucketResult = {
  count: number;
};

type RateLimitDependencies = {
  nowMs: number;
  incrementBucket: (options: IncrementBucketOptions) => Promise<IncrementBucketResult>;
};

let lastRateLimitPruneAt = 0;
let loggedRedisFallback = false;

const RATE_LIMIT_INCREMENT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
local ttl = tonumber(ARGV[1])

if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ttl)
end

local remainingTtl = redis.call("PTTL", KEYS[1])

if remainingTtl < 0 then
  redis.call("PEXPIRE", KEYS[1], ttl)
  remainingTtl = ttl
end

return { current, remainingTtl }
`;

export function getRateLimitWindow(nowMs: number, windowMs: number) {
  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;

  return {
    windowStartMs,
    resetAt: windowStartMs + windowMs,
  };
}

export function buildRateLimitBucketKey(
  namespace: string,
  subjectHash: string,
  windowStartMs: number
) {
  return `rate-limit:${namespace}:${subjectHash}:${windowStartMs}`;
}

export function hashRateLimitSubject(subject: string) {
  const hashSecret = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

  if (!hashSecret) {
    return createHash("sha256").update(subject).digest("hex");
  }

  return createHmac("sha256", hashSecret).update(subject).digest("hex");
}

function logRedisFallback(reason: string) {
  if (loggedRedisFallback) {
    return;
  }

  loggedRedisFallback = true;
  console.warn(`Redis rate limiting unavailable (${reason}); falling back to database buckets.`);
}

function pruneStaleBuckets(nowMs: number, windowMs: number) {
  if (nowMs - lastRateLimitPruneAt < Math.max(windowMs, 60 * 1000)) {
    return;
  }

  lastRateLimitPruneAt = nowMs;
  const pruneBefore = new Date(nowMs - Math.max(windowMs * 12, 60 * 60 * 1000));

  void prisma.rateLimitBucket
    .deleteMany({
      where: {
        updatedAt: {
          lt: pruneBefore,
        },
      },
    })
    .catch(() => undefined);
}

async function incrementRedisBucket(
  options: IncrementBucketOptions
): Promise<IncrementBucketResult | null> {
  const client = await getRedisClient();

  if (!client) {
    logRedisFallback(process.env.REDIS_URL ? "connection failed" : "REDIS_URL is not set");
    return null;
  }

  try {
    const subjectHash = hashRateLimitSubject(options.key);
    const rawReply = await client.eval(RATE_LIMIT_INCREMENT_SCRIPT, {
      keys: [
        buildRateLimitBucketKey(
          options.namespace,
          subjectHash,
          options.windowStartMs
        ),
      ],
      arguments: [String(options.ttlMs)],
    });

    if (!Array.isArray(rawReply) || rawReply.length < 2) {
      throw new Error("Unexpected Redis rate limit response.");
    }

    return {
      count: Number(rawReply[0]),
    };
  } catch (error) {
    console.error("Redis rate limit increment failed", error);
    logRedisFallback("command failed");
    return null;
  }
}

async function incrementDatabaseBucket(
  options: IncrementBucketOptions
): Promise<IncrementBucketResult> {
  pruneStaleBuckets(options.nowMs, options.windowMs);
  const subjectHash = hashRateLimitSubject(options.key);

  const bucket = await prisma.rateLimitBucket.upsert({
    where: {
      namespace_subject_windowStart: {
        namespace: options.namespace,
        subject: subjectHash,
        windowStart: options.windowStart,
      },
    },
    create: {
      namespace: options.namespace,
      subject: subjectHash,
      windowStart: options.windowStart,
      count: 1,
    },
    update: {
      count: {
        increment: 1,
      },
    },
    select: {
      count: true,
    },
  });

  return {
    count: bucket.count,
  };
}

async function incrementRateLimitBucket(options: IncrementBucketOptions) {
  const redisBucket = await incrementRedisBucket(options);

  if (redisBucket) {
    return redisBucket;
  }

  return incrementDatabaseBucket(options);
}

export async function checkRateLimitWithDependencies(
  options: CheckRateLimitOptions,
  dependencies: RateLimitDependencies
): Promise<RateLimitResult> {
  const { nowMs } = dependencies;
  const { windowStartMs, resetAt } = getRateLimitWindow(nowMs, options.windowMs);
  const bucket = await dependencies.incrementBucket({
    ...options,
    nowMs,
    ttlMs: Math.max(1, resetAt - nowMs),
    windowMs: options.windowMs,
    windowStart: new Date(windowStartMs),
    windowStartMs,
  });
  const ok = bucket.count <= options.limit;

  return {
    ok,
    remaining: ok ? Math.max(0, options.limit - bucket.count) : 0,
    resetAt,
    retryAfterMs: ok ? 0 : Math.max(0, resetAt - nowMs),
  };
}

export async function checkRateLimit(
  options: CheckRateLimitOptions
): Promise<RateLimitResult> {
  return checkRateLimitWithDependencies(options, {
    nowMs: Date.now(),
    incrementBucket: incrementRateLimitBucket,
  });
}
