import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "./route";

test("GET /api/v1/app/model-catalog exposes account-scoped Codex models", async () => {
  const response = await GET();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("Cache-Control") ?? "", /max-age=300/);

  const payload = await response.json();
  const models = payload.providers.codex.models as Array<{
    slug: string;
    availableFor: string[];
    capabilities: { reasoningEffortLevels: Array<{ value: string; isDefault?: boolean }> };
  }>;

  assert.equal(
    models.some((model) => model.slug === "gpt-5.5"),
    false,
  );

  const gpt54 = models.find((model) => model.slug === "gpt-5.4");
  assert.ok(gpt54);
  assert.ok(gpt54.availableFor.includes("apiKey"));
  assert.equal(
    gpt54.capabilities.reasoningEffortLevels.find((level) => level.value === "medium")?.isDefault,
    true,
  );
});
