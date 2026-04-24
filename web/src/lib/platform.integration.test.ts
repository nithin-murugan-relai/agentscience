import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test, { after, before, beforeEach } from "node:test";

import { createTestDatabase, truncatePublicTables } from "@/lib/test-database";

Reflect.set(process.env, "NODE_ENV", "test");

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let prisma: typeof import("@/lib/prisma").prisma;
let hashToken: typeof import("@/lib/auth").hashToken;
let createBundledPaper: typeof import("@/lib/platform").createBundledPaper;
let buildPaperBundleView: typeof import("@/lib/paper-bundle").buildPaperBundleView;
let updatePaper: typeof import("@/lib/platform").updatePaper;
let createIntegrationKey: typeof import("@/lib/papers").createIntegrationKey;
let authenticateIntegrationToken: typeof import("@/lib/papers").authenticateIntegrationToken;
let createApiTokenRoute: typeof import("@/app/api/v1/auth/token/route").POST;
let revokeApiTokenRoute: typeof import("@/app/api/v1/auth/revoke/route").POST;

let userCounter = 0;

before(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.databaseUrl;
  process.env.DIRECT_URL = database.databaseUrl;

  ({ prisma } = await import("@/lib/prisma"));
  ({ hashToken } = await import("@/lib/auth"));
  ({ createBundledPaper } = await import("@/lib/platform"));
  ({ updatePaper } = await import("@/lib/platform"));
  ({ buildPaperBundleView } = await import("@/lib/paper-bundle"));
  ({ createIntegrationKey, authenticateIntegrationToken } = await import("@/lib/papers"));
  ({ POST: createApiTokenRoute } = await import("@/app/api/v1/auth/token/route"));
  ({ POST: revokeApiTokenRoute } = await import("@/app/api/v1/auth/revoke/route"));
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
    },
  });
}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function blobRef(pathname: string, sizeBytes: number) {
  return {
    url: `https://blob.example.test/${pathname}`,
    pathname,
    downloadUrl: `https://blob.example.test/${pathname}?download=1`,
    sizeBytes,
  };
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
      ...blobRef("papers/test/bundle-paper.pdf", pdfBytes.length),
    },
    keywords: ["outbreak", "bundle"],
    references: ["10.1000/example"],
    ideaNote: "Keep the uploaded research bundle visible and intact.",
    figures: [
      {
        fileName: "figure-1.png",
        mimeType: "image/png",
        ...blobRef("papers/test/figure-1.png", 4),
        caption: "Verification figure",
      },
    ],
    artifacts: [
      {
        path: "scripts/analyze.py",
        contentType: "text/plain",
        ...blobRef("papers/test/scripts/analyze.py", Buffer.byteLength(scriptContents)),
        sha256: sha256(scriptContents),
        textContent: scriptContents,
      },
      {
        path: "data/results.csv",
        contentType: "text/csv",
        ...blobRef("papers/test/data/results.csv", Buffer.byteLength(csvContents)),
        sha256: sha256(csvContents),
        textContent: csvContents,
      },
      {
        path: "README.md",
        contentType: "text/markdown",
        ...blobRef("papers/test/README.md", Buffer.byteLength("# Integration Notes\n")),
        sha256: sha256("# Integration Notes\n"),
        textContent: "# Integration Notes\n",
      },
      {
        path: "paper.md",
        contentType: "text/markdown",
        ...blobRef("papers/test/paper.md", Buffer.byteLength("# Overview\n")),
        sha256: sha256("# Overview\n"),
        textContent: "# Overview\n",
      },
      {
        path: "paper.tex",
        contentType: "application/x-latex",
        ...blobRef("papers/test/paper.tex", Buffer.byteLength("\\documentclass{article}\n")),
        sha256: sha256("\\documentclass{article}\n"),
        textContent: "\\documentclass{article}\n",
      },
      {
        path: "references.bib",
        contentType: "application/x-bibtex",
        ...blobRef("papers/test/references.bib", Buffer.byteLength("@article{bundle-test}\n")),
        sha256: sha256("@article{bundle-test}\n"),
        textContent: "@article{bundle-test}\n",
      },
      {
        path: "bundle-paper.pdf",
        contentType: "application/pdf",
        ...blobRef("papers/test/bundle-paper-artifact.pdf", pdfBytes.length),
        sha256: sha256(pdfBytes),
        kind: "PDF",
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

  assert.equal(storedPaper.pdfStorageUrl, "https://blob.example.test/papers/test/bundle-paper.pdf");
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
  assert.deepEqual(
    [...storedPaper.artifacts.map((artifact) => artifact.path)].sort(),
    [
      "README.md",
      "bundle-paper.pdf",
      "data/results.csv",
      "paper.md",
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

test("createBundledPaper accepts markdown-only source and persists a paper.md artifact", async () => {
  const user = await createUser();
  const pdfBytes = Buffer.from("%PDF-1.7\nmarkdown bundle test\n", "utf8");

  const paper = await createBundledPaper(user.id, {
    title: "Markdown-first drafting for compact research bundles",
    abstract:
      "This integration test publishes a markdown-backed paper bundle so the desktop app can ship a compiled PDF plus manuscript text without requiring LaTeX source.",
    markdown:
      "# Introduction\n\nA markdown-only paper.\n\n# Methods\n\nA compact workflow.\n\n# Results\n\nThe platform should preserve the markdown source.\n",
    pdf: {
      fileName: "paper.pdf",
      mimeType: "application/pdf",
      ...blobRef("papers/test/markdown-paper.pdf", pdfBytes.length),
    },
    keywords: ["markdown", "bundle"],
    references: [],
    figures: [],
    artifacts: [
      {
        path: "paper.md",
        contentType: "text/markdown",
        ...blobRef("papers/test/paper.md", Buffer.byteLength("# Introduction\n\nA markdown-only paper.\n")),
        sha256: sha256("# Introduction\n\nA markdown-only paper.\n"),
        textContent: "# Introduction\n\nA markdown-only paper.\n",
      },
      {
        path: "paper.pdf",
        contentType: "application/pdf",
        ...blobRef("papers/test/paper-artifact.pdf", pdfBytes.length),
        sha256: sha256(pdfBytes),
        kind: "PDF",
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
    },
  });

  assert.equal(storedPaper.latexSource, null);
  assert.match(storedPaper.markdown, /markdown-only paper/i);
  assert.deepEqual(
    storedPaper.artifacts.map((artifact) => artifact.path),
    ["paper.md", "paper.pdf"]
  );
  assert.equal(storedPaper.artifacts[0]?.textContent?.includes("markdown-only paper"), true);
});

test("updatePaper persists markdown changes for an existing paper", async () => {
  const user = await createUser();
  const created = await createBundledPaper(user.id, {
    title: "Patchable markdown paper for desktop republish",
    abstract:
      "This integration test creates a markdown-backed paper and then updates it through the PATCH path used by the desktop app.",
    markdown:
      "# Introduction\n\nInitial markdown.\n\n# Results\n\nInitial result.\n",
    pdf: {
      fileName: "paper.pdf",
      mimeType: "application/pdf",
      ...blobRef("papers/test/patchable-paper.pdf", Buffer.byteLength("%PDF-1.7\ninitial\n")),
    },
    keywords: ["markdown", "patch"],
    references: [],
    figures: [],
    artifacts: [
      {
        path: "paper.md",
        contentType: "text/markdown",
        ...blobRef("papers/test/patchable-paper.md", Buffer.byteLength("Initial markdown.")),
        sha256: sha256("Initial markdown."),
        textContent: "Initial markdown.",
      },
    ],
  });

  const updated = await updatePaper(created.slug, user.id, {
    title: "Patchable markdown paper for desktop republish revised",
    markdown:
      "# Introduction\n\nUpdated markdown.\n\n# Results\n\nUpdated result.\n",
    artifacts: [
      {
        path: "paper.md",
        contentType: "text/markdown",
        ...blobRef("papers/test/patchable-paper-updated.md", Buffer.byteLength("Updated result.")),
        sha256: sha256("Updated result."),
        textContent: "Updated result.",
      },
    ],
  });

  const storedPaper = await prisma.paper.findUniqueOrThrow({
    where: { slug: created.slug },
    include: {
      artifacts: {
        orderBy: {
          path: "asc",
        },
      },
      metric: true,
    },
  });

  assert.equal(updated.title, "Patchable markdown paper for desktop republish revised");
  assert.match(storedPaper.markdown, /Updated markdown/);
  assert.equal(storedPaper.artifacts.find((artifact) => artifact.path === "paper.md")?.textContent?.includes("Updated result."), true);
  assert.ok(storedPaper.metric);
});

test("createIntegrationKey stores only a hashed token in the database", async () => {
  const user = await createUser();
  const result = await createIntegrationKey(user.id, {
    name: "CLI integration token",
  });
  const storedKey = await prisma.integrationKey.findUnique({
    where: {
      tokenHash: hashToken(result.token),
    },
  });

  assert.ok(result.token.startsWith("agsk_"));
  assert.equal(storedKey?.userId, user.id);
  assert.equal(storedKey?.name, "CLI integration token");
  assert.equal(storedKey?.tokenPrefix, result.key.tokenPrefix);
  assert.notEqual(storedKey?.tokenHash, result.token);
});

test("POST /api/v1/auth/revoke deletes the presented integration token", async () => {
  const user = await createUser();
  const result = await createIntegrationKey(user.id, {
    name: "Desktop test token",
  });

  const response = await revokeApiTokenRoute(
    new Request("http://localhost/api/v1/auth/revoke", {
      method: "POST",
      headers: {
        authorization: `Bearer ${result.token}`,
      },
    })
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    revoked: true,
  });

  const storedKey = await prisma.integrationKey.findUnique({
    where: {
      tokenHash: hashToken(result.token),
    },
  });

  assert.equal(storedKey, null);
  assert.equal(await authenticateIntegrationToken(result.token), null);
});

test("password bootstrap API is disabled after the Clerk migration", async () => {
  const okResponse = await createApiTokenRoute();

  assert.equal(okResponse.status, 410);
  assert.deepEqual(await okResponse.json(), {
    error:
      "Password login has been removed. Sign in through the browser device flow or create a token from the AgentScience settings page.",
    code: "PASSWORD_AUTH_REMOVED",
  });
});
