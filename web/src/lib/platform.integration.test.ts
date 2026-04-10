import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";

import { createTestDatabase, truncatePublicTables } from "@/lib/test-database";

Reflect.set(process.env, "NODE_ENV", "test");

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let prisma: typeof import("@/lib/prisma").prisma;
let hashPassword: typeof import("@/lib/auth").hashPassword;
let hashToken: typeof import("@/lib/auth").hashToken;
let createSession: typeof import("@/lib/auth").createSession;
let createBundledPaper: typeof import("@/lib/platform").createBundledPaper;
let buildPaperBundleView: typeof import("@/lib/paper-bundle").buildPaperBundleView;
let createApiTokenRoute: typeof import("@/app/api/v1/auth/token/route").POST;

let userCounter = 0;
const TEST_PASSWORD = "correct horse battery staple";

before(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.databaseUrl;
  process.env.DIRECT_URL = database.databaseUrl;

  ({ prisma } = await import("@/lib/prisma"));
  ({ hashPassword, hashToken, createSession } = await import("@/lib/auth"));
  ({ createBundledPaper } = await import("@/lib/platform"));
  ({ buildPaperBundleView } = await import("@/lib/paper-bundle"));
  ({ POST: createApiTokenRoute } = await import("@/app/api/v1/auth/token/route"));
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
      name: `Integration User ${userCounter}`,
      handle: `integration-user-${userCounter}`,
      email: `integration-user-${userCounter}@example.com`,
      passwordHash: await hashPassword(TEST_PASSWORD),
    },
  });
}

test("createBundledPaper keeps uploaded bundle data intact and exposes it to the UI", async () => {
  const user = await createUser();
  const pdfBytes = Buffer.from("%PDF-1.7\nbundle test\n", "utf8");
  const scriptContents = "print('bundle-ok')\n";
  const csvContents = "condition,value\ncontrol,1\n";

  const paper = await createBundledPaper(user.id, {
    title: "Agent-mediated outbreak triage bundle",
    abstract:
      "This integration test publishes a compact but valid paper bundle so we can verify that uploaded code, figures, and compiled assets survive persistence intact.",
    markdown:
      "# Overview\n\nThis paper exists to verify bundle persistence.\n\n# Results\n\nThe uploaded code and figures should remain available after the write path completes.",
    latexSource:
      "\\documentclass{article}\n\\begin{document}\nIntegration bundle test.\n\\end{document}\n",
    bibSource: "@article{bundle-test,title={Bundle Test}}\n",
    pdf: {
      fileName: "bundle-paper.pdf",
      mimeType: "application/pdf",
      bytes: pdfBytes,
    },
    keywords: ["outbreak", "bundle"],
    references: ["10.1000/example"],
    ideaNote: "Keep the uploaded research bundle visible and intact.",
    figures: [
      {
        fileName: "figure-1.png",
        mimeType: "image/png",
        bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        caption: "Verification figure",
      },
    ],
    artifacts: [
      {
        path: "scripts/analyze.py",
        contentType: "text/plain",
        bytes: Buffer.from(scriptContents, "utf8"),
      },
      {
        path: "data/results.csv",
        contentType: "text/csv",
        bytes: Buffer.from(csvContents, "utf8"),
      },
      {
        path: "README.md",
        contentType: "text/markdown",
        bytes: Buffer.from("# Integration Notes\n", "utf8"),
      },
    ],
  });

  const storedPaper = await prisma.paper.findUniqueOrThrow({
    where: { slug: paper.slug },
    include: {
      artifacts: {
        orderBy: {
          path: "asc",
        },
      },
      assets: {
        orderBy: {
          fileName: "asc",
        },
      },
      ideas: true,
      metric: true,
      referencesOut: true,
    },
  });

  assert.equal(Buffer.from(storedPaper.pdfData ?? []).toString("utf8"), pdfBytes.toString("utf8"));
  assert.equal(storedPaper.metric?.reviewCount, 0);
  assert.equal(storedPaper.referencesOut.length, 1);
  assert.equal(storedPaper.ideas[0]?.summary, "Keep the uploaded research bundle visible and intact.");

  const scriptArtifact = storedPaper.artifacts.find(
    (artifact) => artifact.path === "scripts/analyze.py"
  );
  const csvArtifact = storedPaper.artifacts.find(
    (artifact) => artifact.path === "data/results.csv"
  );
  const pdfArtifact = storedPaper.artifacts.find(
    (artifact) => artifact.path === "bundle-paper.pdf"
  );

  assert.equal(scriptArtifact?.textContent, scriptContents);
  assert.equal(csvArtifact?.textContent, csvContents);
  assert.equal(pdfArtifact?.sizeBytes, pdfBytes.length);
  assert.equal(
    Buffer.from(pdfArtifact?.bytes ?? []).toString("utf8"),
    pdfBytes.toString("utf8")
  );
  assert.deepEqual(
    [...storedPaper.artifacts.map((artifact) => artifact.path)].sort(),
    [
      "README.md",
      "bundle-paper.pdf",
      "data/results.csv",
      "paper.tex",
      "references.bib",
      "scripts/analyze.py",
    ]
  );

  const bundle = buildPaperBundleView(paper, {
    includeTextContent: true,
  });
  const scriptBundleArtifact = bundle.artifacts.find(
    (artifact) => artifact.path === "scripts/analyze.py"
  );

  assert.equal(bundle.hasBundle, true);
  assert.equal(bundle.pdfUrl, `/api/v1/papers/${paper.slug}/download/pdf`);
  assert.equal(bundle.figures[0]?.downloadUrl, `/api/v1/papers/${paper.slug}/download/asset/${bundle.figures[0]?.id}`);
  assert.equal(scriptBundleArtifact?.downloadUrl, `/api/v1/papers/${paper.slug}/download/artifact/${scriptBundleArtifact?.id}`);
  assert.equal(scriptBundleArtifact?.isText, true);
  assert.equal(scriptBundleArtifact?.textContent, scriptContents);
});

test("createSession stores hashed tokens and caps the number of active sessions", async () => {
  const user = await createUser();
  const tokens = await Promise.all(Array.from({ length: 14 }, () => createSession(user.id)));
  const sessions = await prisma.session.findMany({
    where: {
      userId: user.id,
    },
  });

  assert.equal(sessions.length, 12);
  assert.equal(
    sessions.some((session) => tokens.includes(session.tokenHash)),
    false
  );

  for (const session of sessions) {
    assert.equal(tokens.some((token) => hashToken(token) === session.tokenHash), true);
  }
});

test("API token sign-in validates the password and stores only a hashed integration key", async () => {
  const user = await createUser();
  const okResponse = await createApiTokenRoute(
    new Request("http://localhost/api/v1/auth/token", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        password: TEST_PASSWORD,
        name: "CLI integration token",
      }),
    })
  );

  assert.equal(okResponse.status, 200);

  const okPayload = await okResponse.json();
  const storedKey = await prisma.integrationKey.findUnique({
    where: {
      tokenHash: hashToken(okPayload.token),
    },
  });

  assert.ok(okPayload.token.startsWith("agsk_"));
  assert.equal(okPayload.tokenPrefix, okPayload.token.slice(0, 12));
  assert.equal(okPayload.user.email, user.email);
  assert.equal(storedKey?.userId, user.id);
  assert.equal(storedKey?.name, "CLI integration token");
  assert.equal(storedKey?.tokenPrefix, okPayload.tokenPrefix);
  assert.notEqual(storedKey?.tokenHash, okPayload.token);

  const badResponse = await createApiTokenRoute(
    new Request("http://localhost/api/v1/auth/token", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        password: "wrong password",
        name: "CLI integration token",
      }),
    })
  );

  assert.equal(badResponse.status, 401);
  assert.deepEqual(await badResponse.json(), {
    error: "Email or password is incorrect.",
  });
});
