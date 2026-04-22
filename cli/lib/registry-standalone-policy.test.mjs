import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateStandaloneRegistryPolicy,
  extractProviderDatasetIdentifiers,
  formatStandaloneRegistryPolicyLines,
  isCanonicalRegistryProvider,
} from "./registry-standalone-policy.mjs";

test("isCanonicalRegistryProvider requires the provider search recipe fields", () => {
  assert.equal(
    isCanonicalRegistryProvider({
      searchKind: "GRAPHQL",
      searchEndpoint: "https://openneuro.org/crn/graphql",
      searchQueryTemplate: "query Search($q: String!) { datasets(first: 25, query: { text: $q }) { edges { node { id } } } }",
      datasetUrlTemplate: "https://openneuro.org/datasets/{datasetId}",
      agentInstructions: "Use GraphQL to search.",
    }),
    true,
  );
  assert.equal(
    isCanonicalRegistryProvider({
      searchKind: null,
      searchEndpoint: null,
      searchQueryTemplate: null,
      datasetUrlTemplate: null,
      agentInstructions: null,
    }),
    false,
  );
});

test("extractProviderDatasetIdentifiers parses template placeholders from canonical dataset URLs", () => {
  const identifiers = extractProviderDatasetIdentifiers(
    "https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc={accession}",
    "https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE68735",
    "ncbi.nlm.nih.gov",
  );

  assert.deepEqual(identifiers, { accession: "GSE68735" });
});

test("evaluateStandaloneRegistryPolicy passes for canonical provider URLs with explicit topics", () => {
  const result = evaluateStandaloneRegistryPolicy({
    candidate: {
      url: "https://openneuro.org/datasets/ds005398",
      providerSlug: "openneuro",
      topicSlugs: ["neuroscience"],
      sourcePaperId: null,
    },
    provider: {
      slug: "openneuro",
      domain: "openneuro.org",
      searchKind: "GRAPHQL",
      searchEndpoint: "https://openneuro.org/crn/graphql",
      searchQueryTemplate: "query Search($q: String!) { datasets(first: 25, query: { text: $q }) { edges { node { id } } } }",
      datasetUrlTemplate: "https://openneuro.org/datasets/{datasetId}",
      agentInstructions: "Use GraphQL to search.",
    },
    knownTopicSlugs: new Set(["neuroscience"]),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.identifiers, { datasetId: "ds005398" });
});

test("evaluateStandaloneRegistryPolicy rejects ad hoc export URLs and missing provider/topic metadata", () => {
  const result = evaluateStandaloneRegistryPolicy({
    candidate: {
      url: "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+*+from+pscomppars&format=csv",
      providerSlug: null,
      topicSlugs: [],
      sourcePaperId: null,
    },
    provider: null,
    knownTopicSlugs: new Set(["astronomy"]),
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("--provider-slug")));
  assert.ok(result.errors.some((error) => error.includes("--topic-slug")));
});

test("formatStandaloneRegistryPolicyLines produces readable output", () => {
  const lines = formatStandaloneRegistryPolicyLines({
    ok: false,
    mode: "standalone",
    errors: ["Unknown provider slug."],
    identifiers: null,
  });

  assert.ok(lines.some((line) => line.includes("Standalone policy: FAIL")));
  assert.ok(lines.some((line) => line.includes("Unknown provider slug")));
});
