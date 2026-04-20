import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";

import { createTestDatabase, truncatePublicTables } from "@/lib/test-database";

Reflect.set(process.env, "NODE_ENV", "test");

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let prisma: typeof import("@/lib/prisma").prisma;
let checkDatasetRegistryCandidate: typeof import("@/lib/dataset-registry").checkDatasetRegistryCandidate;

let userCounter = 0;

before(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.databaseUrl;
  process.env.DIRECT_URL = database.databaseUrl;

  ({ prisma } = await import("@/lib/prisma"));
  ({ checkDatasetRegistryCandidate } = await import("@/lib/dataset-registry"));
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
      name: `Registry User ${userCounter}`,
      handle: `registry-user-${userCounter}`,
      email: `registry-user-${userCounter}@example.com`,
    },
  });
}

test("checkDatasetRegistryCandidate does not flag distinct GEO accessions as possible duplicates", async () => {
  const user = await createUser();

  await prisma.datasetEntry.create({
    data: {
      name: "DFCI 16-001 Pediatric ALL RNA-seq Cohort (GSE181157)",
      url: "https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE181157",
      domain: "ncbi.nlm.nih.gov",
      description: "Primary-patient pediatric ALL RNA-seq cohort with subtype calls used in the B-ALL integration analysis.",
      keywords: ["geo", "gse181157", "b-all"],
      addedBy: user.id,
    },
  });

  const result = await checkDatasetRegistryCandidate({
    name: "Paired Diagnosis/Relapse Pediatric B-ALL Cohort (GSE28460)",
    url: "https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE28460",
    description: "Paired diagnosis-versus-relapse pediatric B-ALL expression cohort used for relapse-direction support.",
    keywords: ["geo", "gse28460", "b-all", "relapse"],
    registryEligible: true,
  });

  assert.equal(result.status, "new");
  assert.deepEqual(result.matches, []);
});
