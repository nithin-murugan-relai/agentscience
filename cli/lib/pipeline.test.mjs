import assert from "node:assert/strict";
import test from "node:test";

import { checkRegistryCandidatesInBatches } from "./pipeline.mjs";

test("checkRegistryCandidatesInBatches preserves order across multiple API batches", async () => {
  const datasets = Array.from({ length: 45 }, (_, index) => ({
    name: `dataset-${index + 1}`,
  }));
  const calls = [];

  const result = await checkRegistryCandidatesInBatches({
    datasets,
    batchSize: 20,
    checkFn: async ({ datasets: batch }) => {
      calls.push(batch.map((entry) => entry.name));
      return {
        datasets: batch.map((entry) => ({
          candidate: entry,
          status: "new",
          matches: [],
        })),
      };
    },
  });

  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((batch) => batch.length), [20, 20, 5]);
  assert.deepEqual(
    result.datasets.map((entry) => entry.candidate.name),
    datasets.map((entry) => entry.name),
  );
});
