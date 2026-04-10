import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const TEST_DATABASE_ADMIN_URL =
  process.env.AGENTSCIENCE_TEST_ADMIN_DATABASE_URL ??
  "postgresql://vineetreddy@127.0.0.1:5432/postgres";
const TEST_DATABASE_BASE_URL =
  process.env.AGENTSCIENCE_TEST_BASE_URL ??
  "postgresql://vineetreddy@127.0.0.1:5432";

type PrismaDatabaseClient = {
  $executeRawUnsafe(query: string): Promise<unknown>;
  $queryRawUnsafe<T>(query: string): Promise<T>;
};

function runDatabaseCommand(args: string[], env: NodeJS.ProcessEnv = process.env) {
  execFileSync("psql", [TEST_DATABASE_ADMIN_URL, ...args], {
    env,
    stdio: "pipe",
  });
}

export async function createTestDatabase(prefix = "agentscience_web_test") {
  const databaseName = `${prefix}_${randomUUID().replace(/-/g, "_")}`;
  const databaseUrl = `${TEST_DATABASE_BASE_URL}/${databaseName}`;

  runDatabaseCommand(["-c", `CREATE DATABASE "${databaseName}"`]);
  execFileSync(
    "npx",
    ["prisma", "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        DIRECT_URL: databaseUrl,
      },
      stdio: "pipe",
    }
  );

  return {
    databaseName,
    databaseUrl,
    async destroy() {
      runDatabaseCommand(["-c", `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`]);
    },
  };
}

export async function truncatePublicTables(prisma: PrismaDatabaseClient) {
  const tables = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
    `SELECT tablename
       FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> '_prisma_migrations'
      ORDER BY tablename`
  );

  if (tables.length === 0) {
    return;
  }

  const tableList = tables
    .map(({ tablename }) => `"public"."${tablename}"`)
    .join(", ");

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} CASCADE`);
}
