import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";

import { createTestDatabase, truncatePublicTables } from "@/lib/test-database";

Reflect.set(process.env, "NODE_ENV", "test");

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let prisma: typeof import("@/lib/prisma").prisma;
let postRegistryCheckRoute: typeof import("./route").POST;

before(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.databaseUrl;
  process.env.DIRECT_URL = database.databaseUrl;

  ({ prisma } = await import("@/lib/prisma"));
  ({ POST: postRegistryCheckRoute } = await import("./route"));
});

beforeEach(async () => {
  await truncatePublicTables(prisma);
});

after(async () => {
  await prisma.$disconnect();
  await database.destroy();
});

test("POST /api/v1/registry/check identifies exact matches and likely duplicates", async () => {
  await prisma.datasetEntry.createMany({
    data: [
      {
        name: "Open Climate Archive",
        url: "https://data.example.org/archive",
        domain: "data.example.org",
        description: "Climate archive already present in the registry.",
        keywords: ["climate", "archive"],
      },
      {
        name: "Urban Heat Study Dataset",
        url: "https://data.example.org/heat-study-v1",
        domain: "data.example.org",
        description: "Dataset that should surface as a likely duplicate by name.",
        keywords: ["heat", "urban"],
      },
    ],
  });

  const response = await postRegistryCheckRoute(
    new Request("http://localhost/api/v1/registry/check", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        datasets: [
          {
            name: "Open Climate Archive",
            url: "https://data.example.org/archive/",
            description: "Same dataset with a trailing slash in the URL.",
            keywords: ["Climate", "archive"],
          },
          {
            name: "Urban Heat Study Dataset",
            url: "https://mirror.example.net/heat-study",
            description: "Mirror of a dataset that is already known by name.",
            keywords: ["heat"],
          },
          {
            name: "Fresh Registry Candidate",
            url: "https://new.example.net/data",
            description: "New dataset that should be proposed for registry insertion.",
            keywords: ["fresh"],
          },
        ],
      }),
    }),
  );

  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.datasets[0]?.status, "registered");
  assert.equal(payload.datasets[0]?.candidate.url, "https://data.example.org/archive");
  assert.equal(payload.datasets[1]?.status, "possible-duplicate");
  assert.equal(payload.datasets[1]?.matches[0]?.name, "Urban Heat Study Dataset");
  assert.equal(payload.datasets[2]?.status, "new");
  assert.deepEqual(payload.datasets[2]?.matches, []);
});
