import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";

import {
  buildRateLimitBucketKey,
  checkRateLimitWithDependencies,
  getRateLimitWindow,
  hashRateLimitSubject,
} from "./rate-limit";

test("getRateLimitWindow aligns requests to a fixed window boundary", () => {
  assert.deepEqual(getRateLimitWindow(605_001, 600_000), {
    windowStartMs: 600_000,
    resetAt: 1_200_000,
  });
});

test("buildRateLimitBucketKey hashes the subject instead of storing it in plaintext", () => {
  const subjectHash = hashRateLimitSubject("127.0.0.1:user@example.com");
  const bucketKey = buildRateLimitBucketKey(
    "sign-in",
    subjectHash,
    600_000
  );

  assert.match(bucketKey, /^rate-limit:sign-in:[0-9a-f]{64}:600000$/);
  assert.doesNotMatch(bucketKey, /user@example\.com/);
});

test("hashRateLimitSubject does not leak the raw subject", () => {
  const originalDirectUrl = process.env.DIRECT_URL;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DIRECT_URL;
  delete process.env.DATABASE_URL;

  try {
    const subjectHash = hashRateLimitSubject("127.0.0.1:user@example.com");

    assert.match(subjectHash, /^[0-9a-f]{64}$/);
    assert.doesNotMatch(subjectHash, /127\.0\.0\.1|user@example\.com/);
  } finally {
    if (originalDirectUrl === undefined) {
      delete process.env.DIRECT_URL;
    } else {
      process.env.DIRECT_URL = originalDirectUrl;
    }

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  }
});

test("hashRateLimitSubject uses a keyed digest when database config is available", () => {
  const originalDirectUrl = process.env.DIRECT_URL;
  process.env.DIRECT_URL = "postgresql://user:password@host/database";

  try {
    const subject = "127.0.0.1:user@example.com";
    const keyedHash = hashRateLimitSubject(subject);

    assert.equal(
      keyedHash,
      createHmac("sha256", "postgresql://user:password@host/database")
        .update(subject)
        .digest("hex")
    );
    assert.notEqual(
      keyedHash,
      createHash("sha256").update(subject).digest("hex")
    );
  } finally {
    if (originalDirectUrl === undefined) {
      delete process.env.DIRECT_URL;
    } else {
      process.env.DIRECT_URL = originalDirectUrl;
    }
  }
});

test("checkRateLimitWithDependencies returns remaining capacity when under the limit", async () => {
  let receivedTtlMs = 0;
  let receivedWindowStartMs = 0;

  const result = await checkRateLimitWithDependencies(
    {
      namespace: "sign-in",
      key: "subject",
      limit: 3,
      windowMs: 600_000,
    },
    {
      nowMs: 605_001,
      incrementBucket: async (options) => {
        receivedTtlMs = options.ttlMs;
        receivedWindowStartMs = options.windowStartMs;
        return { count: 2 };
      },
    }
  );

  assert.equal(receivedWindowStartMs, 600_000);
  assert.equal(receivedTtlMs, 594_999);
  assert.deepEqual(result, {
    ok: true,
    remaining: 1,
    resetAt: 1_200_000,
    retryAfterMs: 0,
  });
});

test("checkRateLimitWithDependencies blocks requests that exceed the limit", async () => {
  const result = await checkRateLimitWithDependencies(
    {
      namespace: "sign-in",
      key: "subject",
      limit: 3,
      windowMs: 600_000,
    },
    {
      nowMs: 605_001,
      incrementBucket: async () => ({ count: 4 }),
    }
  );

  assert.deepEqual(result, {
    ok: false,
    remaining: 0,
    resetAt: 1_200_000,
    retryAfterMs: 594_999,
  });
});
