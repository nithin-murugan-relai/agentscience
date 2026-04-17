import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  loadRegistryManifest,
  parseRegistryManifest,
} from "./registry-manifest.mjs";

test("parseRegistryManifest normalizes dataset metadata", () => {
  const manifest = parseRegistryManifest(
    JSON.stringify({
      version: 1,
      datasets: [
        {
          name: " DepMap 24Q2 Public ",
          url: "https://doi.org/10.25452/figshare.plus.25880521.v1/",
          description: " Public Broad DepMap dependency and expression release used to rank B-ALL vulnerabilities. ",
          keywords: ["DepMap", "b-all", "depmap"],
          sourcePaperId: " cmnvixfm00000l4045bi0uwjf ",
          sourceRank: 0.4641,
        },
      ],
    }),
    "manifest.json",
  );

  assert.deepEqual(manifest.datasets, [
    {
      name: "DepMap 24Q2 Public",
      url: "https://doi.org/10.25452/figshare.plus.25880521.v1",
      description: "Public Broad DepMap dependency and expression release used to rank B-ALL vulnerabilities.",
      keywords: ["depmap", "b-all"],
      sourcePaperId: "cmnvixfm00000l4045bi0uwjf",
      sourceRank: 0.4641,
    },
  ]);
});

test("loadRegistryManifest reads a manifest from disk", () => {
  const workspace = mkdtempSync(join(tmpdir(), "agentscience-registry-manifest-"));
  const manifestPath = join(workspace, "registry-manifest.json");

  writeFileSync(
    manifestPath,
    JSON.stringify({
      version: 1,
      datasets: [
        {
          name: "National Survey of Children's Health",
          url: "https://www.census.gov/programs-surveys/nsch/data/datasets.html",
          description: "Annual U.S. child health survey files used to pool the pediatric epilepsy smoking-exposure cohort.",
          keywords: ["nsch", "pediatric epilepsy"],
          sourcePaperId: "cmnnqjs5b0000jm04j13glmkv",
          sourceRank: 0.49725,
        },
      ],
    }),
  );

  const manifest = loadRegistryManifest(manifestPath);

  assert.equal(manifest.manifestPath, manifestPath);
  assert.equal(manifest.datasets[0]?.name, "National Survey of Children's Health");
});
