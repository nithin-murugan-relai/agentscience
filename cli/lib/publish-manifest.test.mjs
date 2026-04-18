import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  DEFAULT_PUBLISH_MANIFEST_BASENAME,
  loadPublishManifest,
  parsePublishManifest,
} from "./publish-manifest.mjs";

test("parsePublishManifest normalizes dataset URLs and keywords", () => {
  const manifest = parsePublishManifest(
    JSON.stringify({
      version: 1,
      datasets: [
        {
          name: " Open Climate Archive ",
          url: "https://data.example.org/archive/",
          description: "Public climate archive used in the paper bundle.",
          keywords: ["Climate", "archive", "climate"],
          providerSlug: " Data-Example ",
          topicSlugs: ["Climate", "public-health", "climate"],
        },
      ],
    }),
    "manifest.json",
  );

  assert.deepEqual(manifest.datasets, [
    {
      name: "Open Climate Archive",
      url: "https://data.example.org/archive",
      description: "Public climate archive used in the paper bundle.",
      keywords: ["climate", "archive"],
      providerSlug: "data-example",
      topicSlugs: ["climate", "public-health"],
      registryEligible: true,
    },
  ]);
});

test("loadPublishManifest auto-detects the default workspace manifest", () => {
  const workspace = mkdtempSync(join(tmpdir(), "agentscience-publish-manifest-"));
  const manifestPath = join(workspace, DEFAULT_PUBLISH_MANIFEST_BASENAME);

  writeFileSync(
    manifestPath,
    JSON.stringify({
      version: 1,
      datasets: [
        {
          name: "Heat Mortality Records",
          url: "https://data.example.org/heat",
          description: "Heat exposure and mortality data used by the published paper.",
          keywords: ["heat", "mortality"],
        },
      ],
    }),
  );

  const manifest = loadPublishManifest({ workspaceDir: workspace });

  assert.equal(manifest?.manifestPath, manifestPath);
  assert.equal(manifest?.datasets[0]?.name, "Heat Mortality Records");
});
