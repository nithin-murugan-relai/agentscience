import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";

import { createTestDatabase, truncatePublicTables } from "@/lib/test-database";

Reflect.set(process.env, "NODE_ENV", "test");

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let prisma: typeof import("@/lib/prisma").prisma;
let hashToken: typeof import("@/lib/auth").hashToken;
let getRegistryRoute: typeof import("./route").GET;
let postRegistryRoute: typeof import("./route").POST;

let userCounter = 0;

before(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.databaseUrl;
  process.env.DIRECT_URL = database.databaseUrl;

  ({ prisma } = await import("@/lib/prisma"));
  ({ hashToken } = await import("@/lib/auth"));
  ({ GET: getRegistryRoute, POST: postRegistryRoute } = await import("./route"));
});

beforeEach(async () => {
  await truncatePublicTables(prisma);
});

after(async () => {
  await prisma.$disconnect();
  await database.destroy();
});

async function createApiUserWithToken() {
  userCounter += 1;
  const token = `agsk_registry_test_${userCounter}`;
  const user = await prisma.user.create({
    data: {
      name: `Registry User ${userCounter}`,
      handle: `registry-user-${userCounter}`,
      email: `registry-user-${userCounter}@example.com`,
    },
  });

  await prisma.integrationKey.create({
    data: {
      userId: user.id,
      name: "Registry test token",
      tokenPrefix: token.slice(0, 12),
      tokenHash: hashToken(token),
    },
  });

  return { token, user };
}

test("POST /api/v1/registry rejects non-http URLs even when a domain is supplied", async () => {
  const { token } = await createApiUserWithToken();
  const response = await postRegistryRoute(
    new Request("http://localhost/api/v1/registry", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Bad dataset",
        url: "javascript:alert(1)",
        domain: "trusted.example.org",
        description: "This payload should be rejected before it can land in the public registry.",
      }),
    })
  );

  assert.equal(response.status, 400);
  assert.equal(await prisma.datasetEntry.count(), 0);

  const payload = await response.json();
  assert.match(payload.error, /http or https/i);
});

test("GET /api/v1/registry resolves public source paper metadata", async () => {
  const { user } = await createApiUserWithToken();
  const coauthor = await prisma.user.create({
    data: {
      name: "Registry Coauthor",
      handle: "registry-coauthor",
      email: "registry-coauthor@example.com",
    },
  });

  const paper = await prisma.paper.create({
    data: {
      slug: "climate-registry-paper",
      title: "Climate Registry Paper",
      abstract: "Paper used to verify source paper serialization in the dataset registry API.",
      markdown: "# Climate Registry Paper",
      visibility: "PUBLIC",
      authors: {
        create: [
          {
            userId: user.id,
            position: 0,
            isCorresponding: true,
          },
          {
            userId: coauthor.id,
            position: 1,
          },
        ],
      },
    },
  });

  await prisma.datasetEntry.create({
    data: {
      name: "Open Climate Archive",
      url: "https://data.example.org/open-climate",
      domain: "data.example.org",
      description: "Climate observations linked to a published paper.",
      keywords: ["climate", "archive"],
      sourcePaperId: paper.id,
      sourceRank: 97,
      addedBy: user.id,
    },
  });

  const response = await getRegistryRoute(
    new Request("http://localhost/api/v1/registry?limit=10"),
  );

  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.datasets.length, 1);
  assert.equal(payload.datasets[0].sourceRank, 97);
  assert.equal(payload.datasets[0].addedBy, user.id);
  assert.equal(payload.datasets[0].usedInPaperCount, 1);
  assert.equal(payload.datasets[0].sourcePaper?.slug, paper.slug);
  assert.equal(payload.datasets[0].sourcePaper?.title, paper.title);
  assert.deepEqual(payload.datasets[0].sourcePaper?.authors, [
    user.name,
    coauthor.name,
  ]);
  assert.equal(payload.datasets[0].sourcePaper?.url, `http://localhost/papers/${paper.slug}`);
  assert.match(payload.datasets[0].sourcePaper?.publishedAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
});

test("POST /api/v1/registry stores a normalized hostname from the validated URL", async () => {
  const { token, user } = await createApiUserWithToken();
  const response = await postRegistryRoute(
    new Request("http://localhost/api/v1/registry", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Open Climate Archive",
        url: "https://www.data.example.org/archive",
        domain: "wrong.example.org",
        description: "Public climate archive used to verify that the API derives its own trusted hostname.",
        keywords: ["Climate", "climate", "archive"],
      }),
    })
  );

  assert.equal(response.status, 201);

  const stored = await prisma.datasetEntry.findFirstOrThrow({
    where: {
      addedBy: user.id,
    },
  });

  assert.equal(stored.domain, "data.example.org");
  assert.deepEqual(stored.keywords, ["climate", "archive"]);
});

test("POST /api/v1/registry auto-links a new dataset to the existing provider for its domain", async () => {
  const { token, user } = await createApiUserWithToken();

  const provider = await prisma.datasetProvider.create({
    data: {
      slug: "openneuro",
      name: "OpenNeuro",
      homeUrl: "https://openneuro.org",
      domain: "openneuro.org",
      description: "Neuroimaging datasets.",
      searchKind: "GRAPHQL",
      searchEndpoint: "https://openneuro.org/crn/graphql",
      searchQueryTemplate: "query { datasets(search: {{query}}) { ... } }",
      datasetUrlTemplate: "https://openneuro.org/datasets/{{accession}}",
      agentInstructions: "Use GraphQL to search.",
    },
  });

  const response = await postRegistryRoute(
    new Request("http://localhost/api/v1/registry", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "OpenNeuro ds099999",
        url: "https://openneuro.org/datasets/ds099999",
        description: "A newly registered OpenNeuro dataset used to verify provider auto-linking.",
      }),
    }),
  );

  assert.equal(response.status, 201);

  const payload = await response.json();
  assert.equal(payload.created, true);
  assert.equal(payload.dataset.provider?.id, provider.id);
  assert.equal(payload.dataset.provider?.slug, "openneuro");
  assert.equal(payload.dataset.provider?.name, "OpenNeuro");

  const stored = await prisma.datasetEntry.findFirstOrThrow({
    where: { addedBy: user.id },
  });
  assert.equal(stored.providerId, provider.id);
});

test("POST /api/v1/registry honors explicit providerSlug when supplied", async () => {
  const { token } = await createApiUserWithToken();

  const provider = await prisma.datasetProvider.create({
    data: {
      slug: "huggingface",
      name: "Hugging Face Datasets",
      homeUrl: "https://huggingface.co",
      domain: "huggingface.co",
      description: "ML dataset hub.",
    },
  });

  const response = await postRegistryRoute(
    new Request("http://localhost/api/v1/registry", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Mirror of squad on custom host",
        url: "https://mirror.example.com/datasets/squad",
        description: "A dataset mirrored on an unrelated host but conceptually hosted by HuggingFace.",
        providerSlug: "huggingface",
      }),
    }),
  );

  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.dataset.provider?.id, provider.id);
  assert.equal(payload.dataset.provider?.slug, "huggingface");
});

test("POST /api/v1/registry falls back to domain-based provider linking when providerSlug is unknown", async () => {
  const { token } = await createApiUserWithToken();

  const response = await postRegistryRoute(
    new Request("http://localhost/api/v1/registry", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Dataset on fresh domain",
        url: "https://fresh-domain.example.org/datasets/foo",
        description:
          "Unknown providerSlug should not block registration; the resolver falls back to the URL domain and auto-creates a stub provider.",
        providerSlug: "not-a-real-provider-slug",
      }),
    }),
  );

  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.ok(payload.dataset.provider, "dataset should be linked to an auto-created provider");
  assert.equal(payload.dataset.provider.domain, "fresh-domain.example.org");
  assert.equal(payload.dataset.provider.slug, "fresh-domain-example-org");
});

test("GET /api/v1/registry filters datasets by area and topic", async () => {
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

  await prisma.datasetEntry.create({
    data: {
      name: "OpenNeuro ds099999",
      url: "https://openneuro.org/datasets/ds099999",
      domain: "openneuro.org",
      description: "Tagged with neuroscience and used to verify area filtering.",
      topics: { connect: [{ id: neuroscience.id }] },
    },
  });
  await prisma.datasetEntry.create({
    data: {
      name: "SQuAD",
      url: "https://huggingface.co/datasets/squad",
      domain: "huggingface.co",
      description: "Tagged with machine-learning to verify area scoping.",
      topics: { connect: [{ id: ml.id }] },
    },
  });
  await prisma.datasetEntry.create({
    data: {
      name: "Untagged fixture",
      url: "https://example.org/untagged",
      domain: "example.org",
      description: "A dataset with no topics — must not leak into scoped listings.",
    },
  });

  const areaResponse = await getRegistryRoute(
    new Request("http://localhost/api/v1/registry?area=LIFE_SCIENCES"),
  );
  assert.equal(areaResponse.status, 200);
  const areaPayload = await areaResponse.json();
  assert.deepEqual(
    areaPayload.datasets.map((d: { name: string }) => d.name),
    ["OpenNeuro ds099999"],
  );

  const topicResponse = await getRegistryRoute(
    new Request("http://localhost/api/v1/registry?topic=machine-learning"),
  );
  assert.equal(topicResponse.status, 200);
  const topicPayload = await topicResponse.json();
  assert.deepEqual(
    topicPayload.datasets.map((d: { name: string }) => d.name),
    ["SQuAD"],
  );
});

test("GET /api/v1/registry rejects unknown area values", async () => {
  const response = await getRegistryRoute(
    new Request("http://localhost/api/v1/registry?area=BOGUS"),
  );
  assert.equal(response.status, 400);
});

test("POST /api/v1/registry tags explicit topicSlugs and surfaces unknown ones on the check payload", async () => {
  const { token } = await createApiUserWithToken();
  const neuroscience = await prisma.datasetTopic.create({
    data: {
      slug: "neuroscience",
      name: "Neuroscience",
      area: "LIFE_SCIENCES",
      status: "ACTIVE",
    },
  });

  const response = await postRegistryRoute(
    new Request("http://localhost/api/v1/registry", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "OpenNeuro ds088888",
        url: "https://openneuro.org/datasets/ds088888",
        description: "Tagged explicitly with neuroscience; the unknown slug should be dropped.",
        topicSlugs: ["neuroscience", "not-a-real-topic"],
      }),
    }),
  );
  assert.equal(response.status, 201);

  const payload = await response.json();
  assert.deepEqual(
    payload.dataset.topics.map((t: { slug: string }) => t.slug),
    ["neuroscience"],
  );
  assert.deepEqual(payload.check.candidate.unknownTopicSlugs, ["not-a-real-topic"]);

  const stored = await prisma.datasetEntry.findFirstOrThrow({
    where: { url: "https://openneuro.org/datasets/ds088888" },
    include: { topics: { select: { id: true } } },
  });
  assert.deepEqual(
    stored.topics.map((t: { id: string }) => t.id).sort(),
    [neuroscience.id].sort(),
  );
});

test("POST /api/v1/registry falls back to canonical provider topics when metadata is sparse", async () => {
  const { token } = await createApiUserWithToken();
  const neuroscience = await prisma.datasetTopic.create({
    data: {
      slug: "neuroscience",
      name: "Neuroscience",
      area: "LIFE_SCIENCES",
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

  const response = await postRegistryRoute(
    new Request("http://localhost/api/v1/registry", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "OpenNeuro ds077777",
        url: "https://openneuro.org/datasets/ds077777",
        description:
          "Minimal metadata; the dataset should still inherit neuroscience from its canonical provider.",
      }),
    }),
  );
  assert.equal(response.status, 201);

  const payload = await response.json();
  assert.deepEqual(
    payload.dataset.topics.map((t: { slug: string }) => t.slug),
    ["neuroscience"],
  );
});

test("POST /api/v1/registry infers specific topics before falling back to an auto-created stub provider", async () => {
  const { token } = await createApiUserWithToken();
  await prisma.datasetTopic.createMany({
    data: [
      {
        slug: "interdisciplinary",
        name: "Interdisciplinary",
        area: "OTHER",
        status: "ACTIVE",
      },
      {
        slug: "public-health",
        name: "Public Health",
        area: "MEDICINE_HEALTH",
        status: "ACTIVE",
      },
      {
        slug: "neuroscience",
        name: "Neuroscience",
        area: "LIFE_SCIENCES",
        status: "ACTIVE",
      },
    ],
  });

  const response = await postRegistryRoute(
    new Request("http://localhost/api/v1/registry", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "National Survey of Children's Health",
        url: "https://www.census.gov/programs-surveys/nsch/data.html",
        description:
          "Annual child health survey public-use files pooled across 2016-2024 to study smoking exposure and functional burden in pediatric epilepsy.",
        keywords: [
          "nsch",
          "pediatric epilepsy",
          "survey",
          "secondhand smoke",
          "health disparities",
        ],
      }),
    }),
  );
  assert.equal(response.status, 201);

  const payload = await response.json();
  assert.deepEqual(
    payload.dataset.topics.map((t: { slug: string }) => t.slug).sort(),
    ["neuroscience", "public-health"],
  );
  assert.equal(payload.dataset.provider?.slug, "census-gov");
});

test("POST /api/v1/registry reuses an existing dataset when the normalized URL already exists", async () => {
  const { token, user } = await createApiUserWithToken();

  const existing = await prisma.datasetEntry.create({
    data: {
      name: "Air Quality Signals",
      url: "https://data.example.org/air-quality",
      domain: "data.example.org",
      description: "Existing entry used to verify exact URL deduplication.",
      keywords: ["air", "quality"],
      addedBy: user.id,
    },
  });

  const response = await postRegistryRoute(
    new Request("http://localhost/api/v1/registry", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Air Quality Signals",
        url: "https://data.example.org/air-quality/",
        description: "Duplicate candidate with a trailing slash in the URL.",
        keywords: ["air", "quality"],
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(await prisma.datasetEntry.count(), 1);

  const payload = await response.json();
  assert.equal(payload.created, false);
  assert.equal(payload.dataset.id, existing.id);
  assert.equal(payload.duplicateStatus, "registered");
});
