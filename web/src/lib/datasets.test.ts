import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";

import { PaperVisibility } from "@prisma/client";

import { createTestDatabase, truncatePublicTables } from "@/lib/test-database";

Reflect.set(process.env, "NODE_ENV", "test");

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let prisma: typeof import("@/lib/prisma").prisma;
let hashPassword: typeof import("@/lib/auth").hashPassword;
let getDatasetRegistry: typeof import("@/lib/datasets").getDatasetRegistry;

let userCounter = 0;

before(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.databaseUrl;
  process.env.DIRECT_URL = database.databaseUrl;

  ({ prisma } = await import("@/lib/prisma"));
  ({ hashPassword } = await import("@/lib/auth"));
  ({ getDatasetRegistry } = await import("@/lib/datasets"));
});

beforeEach(async () => {
  await truncatePublicTables(prisma);
});

after(async () => {
  await prisma.$disconnect();
  await database.destroy();
});

async function createUser() {
  userCounter += 1;

  return prisma.user.create({
    data: {
      name: `Dataset User ${userCounter}`,
      handle: `dataset-user-${userCounter}`,
      email: `dataset-user-${userCounter}@example.com`,
      passwordHash: await hashPassword("correct horse battery staple"),
    },
  });
}

async function createPaper(
  userId: string,
  {
    slug,
    title,
    visibility = PaperVisibility.PUBLIC,
    keywords = [],
  }: {
    slug: string;
    title: string;
    visibility?: PaperVisibility;
    keywords?: string[];
  }
) {
  return prisma.paper.create({
    data: {
      slug,
      title,
      abstract:
        "This paper exists to verify dataset registry behavior and ensure public bundle data remains discoverable without leaking hidden metadata.",
      markdown:
        "# Introduction\n\nThis paper exists for dataset registry tests.\n\n# Methods\n\nWe upload bundle data.\n\n# Results\n\nThe catalog should find it.\n\n# Discussion\n\nPrivate papers must stay private.\n",
      visibility,
      keywords,
      authors: {
        create: {
          userId,
          position: 0,
          isCorresponding: true,
        },
      },
    },
  });
}

test("getDatasetRegistry keeps valid registry entries and hides links to unlisted papers", async () => {
  const user = await createUser();
  const publicPaper = await createPaper(user.id, {
    slug: "public-dataset-paper",
    title: "Public Dataset Paper",
    keywords: ["omics", "benchmark"],
  });
  const hiddenPaper = await createPaper(user.id, {
    slug: "hidden-dataset-paper",
    title: "Hidden Dataset Paper",
    visibility: PaperVisibility.UNLISTED,
    keywords: ["private"],
  });

  await prisma.datasetEntry.create({
    data: {
      name: "Curated Atlas",
      url: "https://datasets.example.org/atlas",
      domain: "datasets.example.org",
      description: "Well-curated atlas dataset used to verify the public registry rendering path.",
      keywords: ["atlas", "genomics"],
      sourcePaperId: publicPaper.id,
      addedBy: user.id,
    },
  });

  await prisma.datasetEntry.create({
    data: {
      name: "Unsafe Legacy Entry",
      url: "javascript:alert(1)",
      domain: "legacy.example.org",
      description: "Old invalid data should be ignored instead of rendered as a public link.",
      keywords: ["legacy"],
      addedBy: user.id,
    },
  });

  await prisma.datasetEntry.create({
    data: {
      name: "Private Registry Entry",
      url: "https://private.example.org/hidden",
      domain: "private.example.org",
      description: "This entry points at an unlisted paper and should not expose that paper on the public page.",
      keywords: ["hidden"],
      sourcePaperId: hiddenPaper.id,
      addedBy: user.id,
    },
  });

  const datasets = await getDatasetRegistry();

  const curated = datasets.find((dataset) => dataset.name === "Curated Atlas");
  assert.ok(curated);
  assert.equal(curated.domain, "datasets.example.org");
  assert.equal(curated.url, "https://datasets.example.org/atlas");
  assert.equal(curated.sourcePaper?.slug, publicPaper.slug);

  const privateRegistryEntry = datasets.find((dataset) => dataset.name === "Private Registry Entry");
  assert.ok(privateRegistryEntry);
  assert.equal(privateRegistryEntry.sourcePaper, null);

  assert.equal(
    datasets.some((dataset) => dataset.name === "Unsafe Legacy Entry"),
    false
  );
});
