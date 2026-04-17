import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";

import { createTestDatabase, truncatePublicTables } from "@/lib/test-database";

Reflect.set(process.env, "NODE_ENV", "test");

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let prisma: typeof import("@/lib/prisma").prisma;
let hashPassword: typeof import("@/lib/auth").hashPassword;
let hashToken: typeof import("@/lib/auth").hashToken;
let getRegistryRoute: typeof import("./route").GET;
let postRegistryRoute: typeof import("./route").POST;

let userCounter = 0;

before(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.databaseUrl;
  process.env.DIRECT_URL = database.databaseUrl;

  ({ prisma } = await import("@/lib/prisma"));
  ({ hashPassword, hashToken } = await import("@/lib/auth"));
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
      passwordHash: await hashPassword("correct horse battery staple"),
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
      passwordHash: await hashPassword("correct horse battery staple"),
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
