import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";

import { createTestDatabase, truncatePublicTables } from "@/lib/test-database";

Reflect.set(process.env, "NODE_ENV", "test");

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let prisma: typeof import("@/lib/prisma").prisma;
let getTopicsRoute: typeof import("./route").GET;

before(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.databaseUrl;
  process.env.DIRECT_URL = database.databaseUrl;

  ({ prisma } = await import("@/lib/prisma"));
  ({ GET: getTopicsRoute } = await import("./route"));
});

beforeEach(async () => {
  await truncatePublicTables(prisma);
});

after(async () => {
  await prisma.$disconnect();
  await database.destroy();
});

async function seedTopics() {
  await prisma.datasetTopic.createMany({
    data: [
      {
        slug: "neuroscience",
        name: "Neuroscience",
        area: "LIFE_SCIENCES",
        description: "Brains, circuits, and nervous-system data.",
        agentInstructions: "Tag datasets about EEG, fMRI, iEEG, and behavioral neuroscience.",
        status: "ACTIVE",
      },
      {
        slug: "genomics",
        name: "Genomics",
        area: "LIFE_SCIENCES",
        description: "Sequencing, variants, and gene expression.",
        status: "ACTIVE",
      },
      {
        slug: "machine-learning",
        name: "Machine Learning",
        area: "COMPUTING_ENGINEERING",
        description: "Benchmarks and training corpora for ML.",
        status: "ACTIVE",
      },
      {
        slug: "under-review",
        name: "Under Review",
        area: "OTHER",
        description: "A pending suggestion that shouldn't leak by default.",
        status: "PENDING",
      },
    ],
  });
}

test("GET /api/v1/registry/topics returns every ACTIVE topic alongside every area", async () => {
  await seedTopics();

  const response = await getTopicsRoute(
    new Request("http://localhost/api/v1/registry/topics"),
  );
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.ok(Array.isArray(payload.areas));
  // Nine canonical areas must always be present so UIs can render a stable strip.
  assert.equal(payload.areas.length, 9);
  const areaKeys = payload.areas.map((a: { key: string }) => a.key).sort();
  assert.deepEqual(areaKeys, [
    "COMPUTING_ENGINEERING",
    "EARTH_ENVIRONMENT",
    "HUMANITIES",
    "LIFE_SCIENCES",
    "MATH_STATISTICS",
    "MEDICINE_HEALTH",
    "OTHER",
    "PHYSICAL_SCIENCES",
    "SOCIAL_SCIENCES",
  ]);

  const topicSlugs = payload.topics.map((t: { slug: string }) => t.slug).sort();
  assert.deepEqual(topicSlugs, ["genomics", "machine-learning", "neuroscience"]);
  const pending = payload.topics.find((t: { slug: string }) => t.slug === "under-review");
  assert.equal(pending, undefined);
});

test("GET /api/v1/registry/topics scopes results to a specific area", async () => {
  await seedTopics();

  const response = await getTopicsRoute(
    new Request("http://localhost/api/v1/registry/topics?area=LIFE_SCIENCES"),
  );
  assert.equal(response.status, 200);

  const payload = await response.json();
  const slugs = payload.topics.map((t: { slug: string }) => t.slug).sort();
  assert.deepEqual(slugs, ["genomics", "neuroscience"]);
});

test("GET /api/v1/registry/topics rejects unknown areas", async () => {
  const response = await getTopicsRoute(
    new Request("http://localhost/api/v1/registry/topics?area=BOGUS"),
  );
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.match(payload.error, /Unknown area/);
});

test("GET /api/v1/registry/topics surfaces PENDING suggestions when includePending=true", async () => {
  await seedTopics();

  const response = await getTopicsRoute(
    new Request("http://localhost/api/v1/registry/topics?includePending=true"),
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  const slugs = payload.topics.map((t: { slug: string }) => t.slug).sort();
  assert.deepEqual(slugs, ["genomics", "machine-learning", "neuroscience", "under-review"]);
  const pending = payload.topics.find((t: { slug: string }) => t.slug === "under-review");
  assert.equal(pending.status, "PENDING");
});

test("GET /api/v1/registry/topics filters by free-text query", async () => {
  await seedTopics();

  const response = await getTopicsRoute(
    new Request("http://localhost/api/v1/registry/topics?q=neur"),
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  const slugs = payload.topics.map((t: { slug: string }) => t.slug).sort();
  assert.deepEqual(slugs, ["neuroscience"]);
});

test("GET /api/v1/registry/topics returns live providerCount and datasetCount per topic", async () => {
  await seedTopics();

  const neuro = await prisma.datasetTopic.findUniqueOrThrow({
    where: { slug: "neuroscience" },
  });
  const provider = await prisma.datasetProvider.create({
    data: {
      slug: "openneuro",
      name: "OpenNeuro",
      homeUrl: "https://openneuro.org",
      domain: "openneuro.org",
      description: "Neuroimaging datasets.",
      topics: { connect: [{ id: neuro.id }] },
    },
  });
  await prisma.datasetEntry.create({
    data: {
      name: "OpenNeuro ds099999",
      url: "https://openneuro.org/datasets/ds099999",
      domain: "openneuro.org",
      description: "Test dataset linked to the neuroscience topic.",
      providerId: provider.id,
      topics: { connect: [{ id: neuro.id }] },
    },
  });

  const response = await getTopicsRoute(
    new Request("http://localhost/api/v1/registry/topics?area=LIFE_SCIENCES"),
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  const neuroTopic = payload.topics.find((t: { slug: string }) => t.slug === "neuroscience");
  assert.ok(neuroTopic);
  assert.equal(neuroTopic.providerCount, 1);
  assert.equal(neuroTopic.datasetCount, 1);
});
