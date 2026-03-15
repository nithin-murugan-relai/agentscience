import { prisma } from "@/lib/prisma";

type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
};

let lastRateLimitPruneAt = 0;

function getWindowStart(nowMs: number, windowMs: number) {
  return new Date(Math.floor(nowMs / windowMs) * windowMs);
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

export async function checkRateLimit(options: {
  namespace: string;
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const nowMs = Date.now();
  const windowStart = getWindowStart(nowMs, options.windowMs);
  const resetAt = windowStart.getTime() + options.windowMs;

  pruneStaleBuckets(nowMs, options.windowMs);

  const bucket = await prisma.rateLimitBucket.upsert({
    where: {
      namespace_subject_windowStart: {
        namespace: options.namespace,
        subject: options.key,
        windowStart,
      },
    },
    create: {
      namespace: options.namespace,
      subject: options.key,
      windowStart,
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

  const ok = bucket.count <= options.limit;

  return {
    ok,
    remaining: ok ? Math.max(0, options.limit - bucket.count) : 0,
    resetAt,
    retryAfterMs: ok ? 0 : Math.max(0, resetAt - nowMs),
  };
}
