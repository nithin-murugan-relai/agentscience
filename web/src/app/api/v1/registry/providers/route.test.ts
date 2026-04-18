import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";

import { createTestDatabase, truncatePublicTables } from "@/lib/test-database";

Reflect.set(process.env, "NODE_ENV", "test");

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let prisma: typeof import("@/lib/prisma").prisma;
let getProvidersRoute: typeof import("./route").GET;

before(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.databaseUrl;
  process.env.DIRECT_URL = database.databaseUrl;

  ({ prisma } = await import("@/lib/prisma"));
  ({ GET: getProvidersRoute } = await import("./route"));
});

beforeEach(async () => {
  await truncatePublicTables(prisma);
});

after(async () => {
  await prisma.$disconnect();
  await database.destroy();
});

test("GET /api/v1/registry/providers returns seeded providers with search recipes", async () => {
  await prisma.datasetProvider.create({
    data: {
      slug: "openneuro",
      name: "OpenNeuro",
      homeUrl: "https://openneuro.org",
      domain: "openneuro.org",
      description: "A compendium of freely shared brain imaging datasets (MRI, iEEG, EEG, etc.).",
      searchKind: "GRAPHQL",
      searchEndpoint: "https://openneuro.org/crn/graphql",
      searchQueryTemplate: "query { datasets(first: 20, search: {{query}}) { ... } }",
      datasetUrlTemplate: "https://openneuro.org/datasets/{{accession}}",
      agentInstructions:
        "Use the GraphQL endpoint to search for datasets by keyword. Dataset accessions look like ds001234.",
    },
  });

  await prisma.datasetProvider.create({
    data: {
      slug: "huggingface",
      name: "Hugging Face Datasets",
      homeUrl: "https://huggingface.co",
      domain: "huggingface.co",
      description: "Open hub of ML datasets.",
      searchKind: "REST",
      searchEndpoint: "https://huggingface.co/api/datasets",
      searchQueryTemplate: "?search={{query}}&limit=20",
      datasetUrlTemplate: "https://huggingface.co/datasets/{{id}}",
      agentInstructions: "Hit the REST endpoint, parse JSON, and use the `id` field to build URLs.",
    },
  });

  const response = await getProvidersRoute(
    new Request("http://localhost/api/v1/registry/providers?limit=20"),
  );

  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(Array.isArray(payload.providers), true);
  assert.equal(payload.providers.length, 2);

  const openneuro = payload.providers.find((p: { slug: string }) => p.slug === "openneuro");
  assert.ok(openneuro, "openneuro provider should be returned");
  assert.equal(openneuro.name, "OpenNeuro");
  assert.equal(openneuro.domain, "openneuro.org");
  assert.equal(openneuro.searchKind, "GRAPHQL");
  assert.equal(openneuro.searchEndpoint, "https://openneuro.org/crn/graphql");
  assert.match(openneuro.searchQueryTemplate, /search: \{\{query\}\}/);
  assert.equal(openneuro.datasetUrlTemplate, "https://openneuro.org/datasets/{{accession}}");
  assert.match(openneuro.agentInstructions, /GraphQL endpoint/);
  assert.equal(openneuro.datasetCount, 0);
  assert.match(openneuro.createdAt ?? "", /^\d{4}-\d{2}-\d{2}T/);

  const huggingface = payload.providers.find((p: { slug: string }) => p.slug === "huggingface");
  assert.ok(huggingface);
  assert.equal(huggingface.searchKind, "REST");
});

test("GET /api/v1/registry/providers filters by query across name, slug, description, domain", async () => {
  await prisma.datasetProvider.createMany({
    data: [
      {
        slug: "openneuro",
        name: "OpenNeuro",
        homeUrl: "https://openneuro.org",
        domain: "openneuro.org",
        description: "Neuroimaging datasets.",
      },
      {
        slug: "kaggle",
        name: "Kaggle",
        homeUrl: "https://www.kaggle.com",
        domain: "kaggle.com",
        description: "ML competitions and datasets.",
      },
      {
        slug: "physionet",
        name: "PhysioNet",
        homeUrl: "https://physionet.org",
        domain: "physionet.org",
        description: "Physiologic signals and biomedical data.",
      },
    ],
  });

  const response = await getProvidersRoute(
    new Request("http://localhost/api/v1/registry/providers?q=neuro"),
  );

  assert.equal(response.status, 200);

  const payload = await response.json();
  const slugs = payload.providers.map((p: { slug: string }) => p.slug).sort();
  assert.deepEqual(slugs, ["openneuro"]);
});

test("GET /api/v1/registry/providers includes datasetCount for linked datasets", async () => {
  const provider = await prisma.datasetProvider.create({
    data: {
      slug: "openneuro",
      name: "OpenNeuro",
      homeUrl: "https://openneuro.org",
      domain: "openneuro.org",
      description: "Neuroimaging datasets.",
    },
  });

  await prisma.datasetEntry.createMany({
    data: [
      {
        name: "OpenNeuro ds005398",
        url: "https://openneuro.org/datasets/ds005398",
        domain: "openneuro.org",
        description: "Pediatric epilepsy iEEG sleep dataset.",
        providerId: provider.id,
      },
      {
        name: "OpenNeuro ds004584",
        url: "https://openneuro.org/datasets/ds004584",
        domain: "openneuro.org",
        description: "Resting-state fMRI dataset.",
        providerId: provider.id,
      },
    ],
  });

  const response = await getProvidersRoute(
    new Request("http://localhost/api/v1/registry/providers"),
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.providers.length, 1);
  assert.equal(payload.providers[0].datasetCount, 2);
});

test("GET /api/v1/registry/providers filters by area and topic and returns topic summaries", async () => {
  const neuroscience = await prisma.datasetTopic.create({
    data: {
      slug: "neuroscience",
      name: "Neuroscience",
      area: "LIFE_SCIENCES",
      status: "ACTIVE",
    },
  });
  const ml = await prisma.datasetTopic.create({
    data: {
      slug: "machine-learning",
      name: "Machine Learning",
      area: "COMPUTING_ENGINEERING",
      status: "ACTIVE",
    },
  });

  await prisma.datasetProvider.create({
    data: {
      slug: "openneuro",
      name: "OpenNeuro",
      homeUrl: "https://openneuro.org",
      domain: "openneuro.org",
      description: "Neuroimaging datasets.",
      topics: { connect: [{ id: neuroscience.id }] },
    },
  });
  await prisma.datasetProvider.create({
    data: {
      slug: "huggingface",
      name: "Hugging Face Datasets",
      homeUrl: "https://huggingface.co",
      domain: "huggingface.co",
      description: "Open hub of ML datasets.",
      topics: { connect: [{ id: ml.id }] },
    },
  });

  const lifeResponse = await getProvidersRoute(
    new Request("http://localhost/api/v1/registry/providers?area=LIFE_SCIENCES"),
  );
  assert.equal(lifeResponse.status, 200);
  const lifePayload = await lifeResponse.json();
  assert.deepEqual(
    lifePayload.providers.map((p: { slug: string }) => p.slug),
    ["openneuro"],
  );
  // Topic summaries travel with the provider so the client can render chips without a second fetch.
  assert.deepEqual(
    lifePayload.providers[0].topics.map((t: { slug: string }) => t.slug),
    ["neuroscience"],
  );

  const topicResponse = await getProvidersRoute(
    new Request("http://localhost/api/v1/registry/providers?topic=machine-learning"),
  );
  assert.equal(topicResponse.status, 200);
  const topicPayload = await topicResponse.json();
  assert.deepEqual(
    topicPayload.providers.map((p: { slug: string }) => p.slug),
    ["huggingface"],
  );
});

test("GET /api/v1/registry/providers rejects unknown area values", async () => {
  const response = await getProvidersRoute(
    new Request("http://localhost/api/v1/registry/providers?area=BOGUS"),
  );
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.match(payload.error, /Unknown area/);
});
