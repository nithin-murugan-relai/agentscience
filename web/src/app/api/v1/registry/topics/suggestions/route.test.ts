import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";

import { createTestDatabase, truncatePublicTables } from "@/lib/test-database";

Reflect.set(process.env, "NODE_ENV", "test");

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let prisma: typeof import("@/lib/prisma").prisma;
let hashPassword: typeof import("@/lib/auth").hashPassword;
let hashToken: typeof import("@/lib/auth").hashToken;
let postSuggestionRoute: typeof import("./route").POST;

let userCounter = 0;

before(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.databaseUrl;
  process.env.DIRECT_URL = database.databaseUrl;

  ({ prisma } = await import("@/lib/prisma"));
  ({ hashPassword, hashToken } = await import("@/lib/auth"));
  ({ POST: postSuggestionRoute } = await import("./route"));
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
  const token = `agsk_topic_suggestion_${userCounter}`;
  const user = await prisma.user.create({
    data: {
      name: `Topic User ${userCounter}`,
      handle: `topic-user-${userCounter}`,
      email: `topic-user-${userCounter}@example.com`,
      passwordHash: await hashPassword("correct horse battery staple"),
    },
  });

  await prisma.integrationKey.create({
    data: {
      userId: user.id,
      name: "Topic suggestion token",
      tokenPrefix: token.slice(0, 12),
      tokenHash: hashToken(token),
    },
  });

  return { token, user };
}

test("POST /api/v1/registry/topics/suggestions requires authentication", async () => {
  const response = await postSuggestionRoute(
    new Request("http://localhost/api/v1/registry/topics/suggestions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Synthetic Biology",
        area: "LIFE_SCIENCES",
      }),
    }),
  );
  assert.equal(response.status, 401);
});

test("POST /api/v1/registry/topics/suggestions rejects unknown areas", async () => {
  const { token } = await createApiUserWithToken();
  const response = await postSuggestionRoute(
    new Request("http://localhost/api/v1/registry/topics/suggestions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Synthetic Biology",
        area: "BOGUS",
      }),
    }),
  );
  assert.equal(response.status, 400);
});

test("POST /api/v1/registry/topics/suggestions creates a PENDING topic on first submission", async () => {
  const { token } = await createApiUserWithToken();
  const response = await postSuggestionRoute(
    new Request("http://localhost/api/v1/registry/topics/suggestions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Synthetic Biology",
        area: "LIFE_SCIENCES",
        description: "Engineered biological systems and design-build-test cycles.",
        justification: "Several SynBio datasets need a home; Genomics is too narrow.",
      }),
    }),
  );
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.alreadyExisted, false);
  assert.equal(payload.topic.slug, "synthetic-biology");
  assert.equal(payload.topic.area, "LIFE_SCIENCES");
  assert.equal(payload.topic.status, "PENDING");
  assert.equal(payload.topic.providerCount, 0);
  assert.equal(payload.topic.datasetCount, 0);

  const stored = await prisma.datasetTopic.findUniqueOrThrow({
    where: { slug: "synthetic-biology" },
  });
  assert.equal(stored.status, "PENDING");
});

test("POST /api/v1/registry/topics/suggestions returns the existing topic on duplicate submissions without creating a new row", async () => {
  const { token } = await createApiUserWithToken();
  await prisma.datasetTopic.create({
    data: {
      slug: "neuroscience",
      name: "Neuroscience",
      area: "LIFE_SCIENCES",
      status: "ACTIVE",
    },
  });

  const response = await postSuggestionRoute(
    new Request("http://localhost/api/v1/registry/topics/suggestions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Neuroscience",
        area: "LIFE_SCIENCES",
      }),
    }),
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.alreadyExisted, true);
  assert.equal(payload.topic.slug, "neuroscience");
  // Status is preserved — a re-submission must NOT downgrade ACTIVE back to PENDING.
  assert.equal(payload.topic.status, "ACTIVE");
  assert.equal(await prisma.datasetTopic.count(), 1);
});
