import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test, { after, before, beforeEach } from "node:test";

import { MetricStatus } from "@prisma/client";

import { createTestDatabase, truncatePublicTables } from "@/lib/test-database";

Reflect.set(process.env, "NODE_ENV", "test");
delete process.env.OPENAI_API_KEY;
delete process.env.OPENAI_JUDGE_MODEL;
delete process.env.REDIS_URL;

type PlatformModule = typeof import("@/lib/platform");
type PapersModule = typeof import("@/lib/papers");
type AuthModule = typeof import("@/lib/auth");
type BundledPaperInput = Parameters<PlatformModule["createBundledPaper"]>[1];

type JsonPaperResponse = {
  paper: {
    slug: string;
    title: string;
    references: Array<{
      title: string | null;
      doi: string | null;
      targetPaperId: string | null;
    }>;
  };
};

type FeedResponse = {
  papers: Array<{
    slug: string;
    title: string;
    metric: {
      reviewCount: number;
    } | null;
  }>;
};

type RankingsResponse = {
  papers: Array<{
    slug: string;
    rank: number;
    score: number;
    reviewCount: number;
    saveCount: number;
  }>;
};

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let prisma: typeof import("@/lib/prisma").prisma;
let hashToken: AuthModule["hashToken"];
let syncClerkUserFromIdentity: AuthModule["syncClerkUserFromIdentity"];
let handleClerkUserDeleted: AuthModule["handleClerkUserDeleted"];
let createBundledPaper: PlatformModule["createBundledPaper"];
let createIntegrationKey: PapersModule["createIntegrationKey"];
let createDeviceFlowIntegrationKey: PapersModule["createDeviceFlowIntegrationKey"];
let createIdeaForUser: PapersModule["createIdeaForUser"];
let addReviewForUser: PapersModule["addReviewForUser"];
let togglePaperSave: PapersModule["togglePaperSave"];
let getAiReviewTriggerReason: PapersModule["getAiReviewTriggerReason"];
let createPaperRoute: typeof import("@/app/api/v1/papers/route").POST;
let getPaperRoute: typeof import("@/app/api/v1/papers/[slug]/route").GET;
let feedRoute: typeof import("@/app/api/papers/feed/route").GET;
let rankingsRoute: typeof import("@/app/api/v1/rankings/route").GET;
let meRoute: typeof import("@/app/api/v1/me/route").GET;
let patchMeRoute: typeof import("@/app/api/v1/me/route").PATCH;
let startDeviceRoute: typeof import("@/app/api/v1/auth/device/route").POST;
let pollDeviceRoute: typeof import("@/app/api/v1/auth/device/[code]/route").GET;
let revokeTokenRoute: typeof import("@/app/api/v1/auth/revoke/route").POST;

let userCounter = 0;
let blobCounter = 0;

before(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.databaseUrl;
  process.env.DIRECT_URL = database.databaseUrl;

  ({ prisma } = await import("@/lib/prisma"));
  ({ hashToken, syncClerkUserFromIdentity, handleClerkUserDeleted } = await import("@/lib/auth"));
  ({ createBundledPaper } = await import("@/lib/platform"));
  ({
    createIntegrationKey,
    createDeviceFlowIntegrationKey,
    createIdeaForUser,
    addReviewForUser,
    togglePaperSave,
    getAiReviewTriggerReason,
  } = await import("@/lib/papers"));
  ({ POST: createPaperRoute } = await import("@/app/api/v1/papers/route"));
  ({ GET: getPaperRoute } = await import("@/app/api/v1/papers/[slug]/route"));
  ({ GET: feedRoute } = await import("@/app/api/papers/feed/route"));
  ({ GET: rankingsRoute } = await import("@/app/api/v1/rankings/route"));
  ({ GET: meRoute, PATCH: patchMeRoute } = await import("@/app/api/v1/me/route"));
  ({ POST: startDeviceRoute } = await import("@/app/api/v1/auth/device/route"));
  ({ GET: pollDeviceRoute } = await import("@/app/api/v1/auth/device/[code]/route"));
  ({ POST: revokeTokenRoute } = await import("@/app/api/v1/auth/revoke/route"));
});

beforeEach(async () => {
  await truncatePublicTables(prisma);
});

after(async () => {
  await prisma.$disconnect();
  await database.destroy();
});

async function expectJson<T>(response: Response, status = 200) {
  const payload = (await response.json()) as T;
  assert.equal(response.status, status, JSON.stringify(payload));
  return payload;
}

async function createUser(label = "Production Flow User") {
  userCounter += 1;

  return prisma.user.create({
    data: {
      name: `${label} ${userCounter}`,
      handle: `production-flow-${userCounter}`,
      email: `production-flow-${userCounter}@example.com`,
    },
  });
}

async function createApiUser(label?: string) {
  const user = await createUser(label);
  const result = await createIntegrationKey(user.id, {
    name: "Production flow token",
  });

  return {
    user,
    token: result.token,
  };
}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function blobRef(path: string, sizeBytes: number) {
  blobCounter += 1;

  return {
    url: `https://blob.example.test/${blobCounter}/${path}`,
    pathname: `papers/test/${blobCounter}/${path}`,
    downloadUrl: `https://blob.example.test/${blobCounter}/${path}?download=1`,
    sizeBytes,
  };
}

function paperInput(overrides: Partial<BundledPaperInput> = {}): BundledPaperInput {
  const title = overrides.title ?? `Production flow paper ${blobCounter + 1}`;
  const markdown =
    overrides.markdown ??
    [
      "# Introduction",
      "",
      "This paper describes a concrete production test flow for AgentScience.",
      "",
      "# Methods",
      "",
      "The methods section names datasets, analysis code, and validation checks.",
      "",
      "# Results",
      "",
      "The result is intentionally compact but structured.",
      "",
      "# Discussion",
      "",
      "The discussion records limitations and reference coverage.",
      "",
      "References",
      "",
      "- 10.5555/example",
    ].join("\n");
  const artifactText = `${markdown}\n`;
  const pdfBytes = Buffer.from(`%PDF-1.7\n${title}\n`, "utf8");

  return {
    title,
    abstract:
      overrides.abstract ??
      "This integration test paper has a complete enough abstract to pass the public publishing validator while exercising reference validation, scoring, and feed recomputation paths.",
    markdown,
    latexSource: overrides.latexSource,
    bibSource: overrides.bibSource,
    pdfUrl: overrides.pdfUrl,
    canonicalUrl: overrides.canonicalUrl,
    githubUrl: overrides.githubUrl,
    doi: overrides.doi,
    keywords: overrides.keywords ?? ["production", "integration", "ranking"],
    references: overrides.references ?? [],
    ideaNote: overrides.ideaNote,
    pdf:
      overrides.pdf ??
      {
        fileName: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
        mimeType: "application/pdf",
        ...blobRef("paper.pdf", pdfBytes.length),
      },
    figures: overrides.figures ?? [],
    artifacts:
      overrides.artifacts ??
      [
        {
          path: "paper.md",
          contentType: "text/markdown",
          ...blobRef("paper.md", Buffer.byteLength(artifactText)),
          sha256: sha256(artifactText),
          textContent: artifactText,
        },
      ],
  };
}

function bearerRequest(url: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);

  return new Request(url, {
    ...init,
    headers,
  });
}

test("E2E publish resolves references and persists heuristic integrity scoring", async () => {
  const { user, token } = await createApiUser("Reference Author");
  const citedPaper = await prisma.paper.create({
    data: {
      slug: "reference-validation-anchor",
      title: "Reference Validation Anchor Paper",
      abstract:
        "This existing paper anchors DOI and slug reference resolution for the production publishing flow test.",
      markdown:
        "# Introduction\n\n# Methods\n\n# Results\n\n# Discussion\n\nThe anchor paper is intentionally small.",
      pdfUrl: "https://example.test/reference-validation-anchor.pdf",
      doi: "10.5555/reference-anchor",
      keywords: ["reference", "anchor"],
      authors: {
        create: {
          userId: user.id,
          position: 0,
          isCorresponding: true,
        },
      },
    },
  });

  const response = await createPaperRoute(
    bearerRequest("http://localhost/api/v1/papers", token, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(
        paperInput({
          title: "Reference validation and integrity scoring pipeline",
          references: [
            "reference-validation-anchor",
            "10.5555/reference-anchor",
            "External calibration protocol without a platform match",
          ],
          ideaNote: "Build on the cited anchor and keep the integrity signal visible.",
        })
      ),
    })
  );
  const payload = await expectJson<JsonPaperResponse>(response);

  const storedPaper = await prisma.paper.findUniqueOrThrow({
    where: { slug: payload.paper.slug },
    include: {
      referencesOut: {
        orderBy: {
          referenceTitle: "asc",
        },
      },
      metric: true,
    },
  });
  const resolvedReferences = storedPaper.referencesOut.filter(
    (reference) => reference.targetPaperId === citedPaper.id
  );
  const unresolvedReference = storedPaper.referencesOut.find(
    (reference) => reference.referenceTitle === "External calibration protocol without a platform match"
  );

  assert.equal(storedPaper.referencesOut.length, 3);
  assert.equal(resolvedReferences.length, 2);
  assert.equal(unresolvedReference?.targetPaperId, null);
  assert.equal(storedPaper.metric?.aiStatus, MetricStatus.DISABLED);
  assert.ok(storedPaper.metric?.integrityScore != null);
  assert.match(storedPaper.metric?.integritySummary ?? "", /Integrity stress-test fallback/);
  assert.ok((storedPaper.metric?.finalScore ?? 1) < 0.5);

  const detail = await expectJson<JsonPaperResponse>(
    await getPaperRoute(
      new Request(`http://localhost/api/v1/papers/${payload.paper.slug}`),
      { params: Promise.resolve({ slug: payload.paper.slug }) }
    )
  );

  assert.equal(detail.paper.slug, payload.paper.slug);
  assert.equal(
    detail.paper.references.filter((reference) => reference.targetPaperId === citedPaper.id).length,
    2
  );
});

test("E2E engagement signals recompute metrics and promote the paper in feeds", async () => {
  const engagedAuthor = await createUser("Engaged Author");
  const quietAuthor = await createUser("Quiet Author");
  const builder = await createUser("Builder");
  const reproducer = await createUser("Reproducer");
  const challenger = await createUser("Challenger");
  const saver = await createUser("Saver");
  const engagedPaper = await createBundledPaper(
    engagedAuthor.id,
    paperInput({
      title: "Build reproduce challenge engagement target",
    })
  );
  const quietPaper = await createBundledPaper(
    quietAuthor.id,
    paperInput({
      title: "Quiet newer paper without engagement",
    })
  );

  await prisma.paper.update({
    where: { id: engagedPaper.id },
    data: { publishedAt: new Date("2026-01-01T00:00:00.000Z") },
  });
  await prisma.paper.update({
    where: { id: quietPaper.id },
    data: { publishedAt: new Date("2026-01-02T00:00:00.000Z") },
  });

  await createIdeaForUser(builder.id, {
    paperSlug: engagedPaper.slug,
    content:
      "Build signal: extend the benchmark with a second dataset and publish a follow-up bundle.",
  });
  await addReviewForUser(reproducer.id, engagedPaper.slug, {
    summary:
      "Reproduce signal: I reran the described analysis and the central result held with the provided artifacts.",
    novelty: 5,
    rigor: 5,
    clarity: 4,
    reproducibility: 5,
    verdict: "ENDORSE",
  });
  await addReviewForUser(challenger.id, engagedPaper.slug, {
    summary:
      "Challenge signal: the result is useful, but the uncertainty analysis should be tighter before broad claims.",
    novelty: 3,
    rigor: 3,
    clarity: 4,
    reproducibility: 3,
    verdict: "CONCERN",
  });
  assert.equal(await togglePaperSave(saver.id, engagedPaper.slug), true);

  const engagedMetric = await prisma.paperMetric.findUniqueOrThrow({
    where: { paperId: engagedPaper.id },
  });
  const quietMetric = await prisma.paperMetric.findUniqueOrThrow({
    where: { paperId: quietPaper.id },
  });

  assert.equal(engagedMetric.reviewCount, 2);
  assert.equal(engagedMetric.saveCount, 1);
  assert.equal(engagedMetric.ideaCount, 1);
  assert.ok(engagedMetric.humanScore > 0);
  assert.ok(engagedMetric.networkScore > quietMetric.networkScore);
  assert.ok(engagedMetric.finalScore > quietMetric.finalScore);

  const feed = await expectJson<FeedResponse>(
    await feedRoute(new Request("http://localhost/api/papers/feed?limit=2"))
  );
  const rankings = await expectJson<RankingsResponse>(
    await rankingsRoute(new Request("http://localhost/api/v1/rankings?limit=2"))
  );

  assert.equal(feed.papers[0]?.slug, engagedPaper.slug);
  assert.equal(feed.papers[0]?.metric?.reviewCount, 2);
  assert.equal(rankings.papers[0]?.slug, engagedPaper.slug);
  assert.equal(rankings.papers[0]?.reviewCount, 2);
  assert.equal(rankings.papers[0]?.saveCount, 1);
});

test("AI review trigger conditions cover missing, stale, and not-ready reviews", () => {
  const richSummary = "A".repeat(401);

  assert.equal(
    getAiReviewTriggerReason({
      reviews: [],
      metric: null,
    }),
    "missing_ai_review"
  );
  assert.equal(
    getAiReviewTriggerReason({
      reviews: [{ summary: richSummary }],
      metric: { aiStatus: MetricStatus.PENDING },
    }),
    "metric_not_ready"
  );
  assert.equal(
    getAiReviewTriggerReason({
      reviews: [{ summary: "Too short to be the current integrity stress-test output." }],
      metric: { aiStatus: MetricStatus.READY },
    }),
    "stale_ai_summary"
  );
  assert.equal(
    getAiReviewTriggerReason({
      reviews: [{ summary: richSummary }],
      metric: { aiStatus: MetricStatus.READY },
    }),
    null
  );
});

test("E2E bearer token auth updates profile data and revokes access", async () => {
  const { user, token } = await createApiUser("Bearer User");

  assert.equal(
    (
      await prisma.integrationKey.findUniqueOrThrow({
        where: { tokenHash: hashToken(token) },
      })
    ).lastUsedAt,
    null
  );

  const me = await expectJson<{ id: string; handle: string }>(
    await meRoute(bearerRequest("http://localhost/api/v1/me", token))
  );
  assert.equal(me.id, user.id);
  assert.ok(
    (
      await prisma.integrationKey.findUniqueOrThrow({
        where: { tokenHash: hashToken(token) },
      })
    ).lastUsedAt
  );

  const profile = await expectJson<{ name: string; researchInterests: string[] }>(
    await patchMeRoute(
      bearerRequest("http://localhost/api/v1/me", token, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Bearer Auth Researcher",
          bio: "Tests authenticated profile writes.",
          institution: "AgentScience QA",
          researchInterests: ["causal inference", "replication"],
        }),
      })
    )
  );
  assert.equal(profile.name, "Bearer Auth Researcher");
  assert.deepEqual(profile.researchInterests, ["causal inference", "replication"]);

  await expectJson<{ ok: boolean; revoked: boolean }>(
    await revokeTokenRoute(
      bearerRequest("http://localhost/api/v1/auth/revoke", token, {
        method: "POST",
      })
    )
  );
  await expectJson<{ error: string }>(
    await meRoute(bearerRequest("http://localhost/api/v1/me", token)),
    401
  );
});

test("E2E device-code auth returns a one-time token without storing Clerk email", async () => {
  const sessionUser = await syncClerkUserFromIdentity({
    id: "clerk_device_flow_user",
    username: "device-flow-user",
    firstName: "Device",
    lastName: "Scientist",
    primaryEmailAddressId: "email_primary",
    emailAddresses: [
      {
        id: "email_primary",
        emailAddress: "Device.Scientist@Example.com",
      },
    ],
  });
  const renamedSessionUser = await syncClerkUserFromIdentity({
    id: "clerk_device_flow_user",
    username: "device-flow-user",
    firstName: "Device",
    lastName: "Reviewer",
    primaryEmailAddressId: "email_primary",
    emailAddresses: [
      {
        id: "email_primary",
        emailAddress: "Device.Scientist@Example.com",
      },
    ],
  });

  assert.equal(renamedSessionUser.id, sessionUser.id);
  assert.equal(renamedSessionUser.name, "Device Reviewer");
  assert.equal(renamedSessionUser.email, null);

  const started = await expectJson<{
    code: string;
    verificationUrl: string;
    pollUrl: string;
    expiresIn: number;
  }>(
    await startDeviceRoute(
      new Request("http://localhost/api/v1/auth/device", {
        method: "POST",
        headers: {
          "x-forwarded-for": "198.51.100.41",
        },
      })
    )
  );
  assert.match(started.code, /^[A-F0-9]{4}-[A-F0-9]{4}$/);
  assert.match(started.pollUrl, new RegExp(`/api/v1/auth/device/${started.code}$`));

  await expectJson<{ status: string }>(
    await pollDeviceRoute(
      new Request(`http://localhost/api/v1/auth/device/${started.code}`, {
        headers: {
          "x-forwarded-for": "198.51.100.42",
        },
      }),
      { params: Promise.resolve({ code: started.code }) }
    )
  );

  const { token } = await createDeviceFlowIntegrationKey(prisma, renamedSessionUser.id);
  await prisma.deviceCode.update({
    where: { code: started.code },
    data: {
      token,
      userId: renamedSessionUser.id,
    },
  });

  const completed = await expectJson<{ status: string; token: string }>(
    await pollDeviceRoute(
      new Request(`http://localhost/api/v1/auth/device/${started.code}`, {
        headers: {
          "x-forwarded-for": "198.51.100.43",
        },
      }),
      { params: Promise.resolve({ code: started.code }) }
    )
  );
  assert.equal(completed.status, "complete");
  assert.equal(completed.token, token);

  const me = await expectJson<{ id: string; email: string | null }>(
    await meRoute(bearerRequest("http://localhost/api/v1/me", completed.token))
  );
  assert.equal(me.id, renamedSessionUser.id);
  assert.equal(me.email, null);

  await expectJson<{ status: string }>(
    await pollDeviceRoute(
      new Request(`http://localhost/api/v1/auth/device/${started.code}`, {
        headers: {
          "x-forwarded-for": "198.51.100.44",
        },
      }),
      { params: Promise.resolve({ code: started.code }) }
    ),
    404
  );

  await createIntegrationKey(renamedSessionUser.id, { name: "Deleted with session" });
  await prisma.deviceCode.create({
    data: {
      code: "DEAD-BEEF",
      userId: renamedSessionUser.id,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });

  await handleClerkUserDeleted("clerk_device_flow_user");

  const deletedSessionUser = await prisma.user.findUniqueOrThrow({
    where: { id: renamedSessionUser.id },
  });
  assert.equal(deletedSessionUser.clerkId, null);
  assert.equal(
    await prisma.integrationKey.count({ where: { userId: renamedSessionUser.id } }),
    0
  );
  assert.equal(
    await prisma.deviceCode.count({ where: { userId: renamedSessionUser.id } }),
    0
  );
});
