import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRateLimitBucketKey,
  checkRateLimitWithDependencies,
  getRateLimitWindow,
} from "./rate-limit";

test("getRateLimitWindow aligns requests to a fixed window boundary", () => {
  assert.deepEqual(getRateLimitWindow(605_001, 600_000), {
    windowStartMs: 600_000,
    resetAt: 1_200_000,
  });
});

test("buildRateLimitBucketKey hashes the subject instead of storing it in plaintext", () => {
  const bucketKey = buildRateLimitBucketKey(
    "sign-in",
    "127.0.0.1:user@example.com",
    600_000
  );

  assert.match(bucketKey, /^rate-limit:sign-in:[0-9a-f]{64}:600000$/);
  assert.doesNotMatch(bucketKey, /user@example\.com/);
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
