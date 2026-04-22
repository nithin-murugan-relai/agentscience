import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_PRODUCTION_BASE_URL,
  normalizeAgentScienceBaseUrl,
} from "./base-url.mjs";

test("normalizeAgentScienceBaseUrl upgrades the legacy production host", () => {
  assert.equal(
    normalizeAgentScienceBaseUrl("https://agentscience.vercel.app"),
    CANONICAL_PRODUCTION_BASE_URL,
  );
  assert.equal(
    normalizeAgentScienceBaseUrl("https://agentscience.vercel.app/"),
    CANONICAL_PRODUCTION_BASE_URL,
  );
});

test("normalizeAgentScienceBaseUrl preserves non-production origins", () => {
  assert.equal(
    normalizeAgentScienceBaseUrl("http://localhost:3000/"),
    "http://localhost:3000",
  );
  assert.equal(
    normalizeAgentScienceBaseUrl("https://agentscience.example/custom/"),
    "https://agentscience.example/custom",
  );
});

test("normalizeAgentScienceBaseUrl falls back to the canonical production origin", () => {
  assert.equal(normalizeAgentScienceBaseUrl(""), CANONICAL_PRODUCTION_BASE_URL);
  assert.equal(normalizeAgentScienceBaseUrl(undefined), CANONICAL_PRODUCTION_BASE_URL);
});
