import { randomBytes } from "node:crypto";

import {
  MetricStatus,
  PaperOrigin,
  Prisma,
  ReviewKind,
  ReviewVerdict,
  UserRole,
} from "@prisma/client";

import { hashPassword, hashToken } from "@/lib/auth";
import { aiJudgeConfigured, judgePaperWithOpenAI } from "@/lib/openai-judge";
import { prisma } from "@/lib/prisma";
import { buildPaperRankings } from "@/lib/ranking";
import {
  createTemporaryEmail,
  extractKeywords,
  slugify,
} from "@/lib/utils";
import { getUniqueConstraintTargets, UserFacingError } from "@/lib/errors";
import type {
  IdeaFormInput,
  IntegrationKeyInput,
  PaperFormInput,
  ReviewFormInput,
  SidekickPublishInput,
} from "@/lib/validation";

export const publicUserSelect = {
  name: true,
  handle: true,
  institution: true,
  role: true,
  bio: true,
  researchInterests: true,
  digestEnabled: true,
  digestEmailEnabled: true,
} satisfies Prisma.UserSelect;

export const paperFullInclude = {
  authors: {
    include: {
      user: {
        select: publicUserSelect,
      },
    },
    orderBy: {
      position: "asc",
    },
  },
  ideas: {
    include: {
      author: {
        select: publicUserSelect,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  },
  reviews: {
    include: {
      reviewer: {
        select: publicUserSelect,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  },
  saves: {
    select: {
      userId: true,
    },
  },
  assets: {
    orderBy: [
      {
        kind: "asc",
      },
      {
        fileName: "asc",
      },
    ],
  },
  artifacts: {
    orderBy: [
      {
        kind: "asc",
      },
      {
        path: "asc",
      },
    ],
  },
  referencesOut: {
    select: {
      targetPaperId: true,
      referenceDoi: true,
      referenceTitle: true,
    },
  },
  referencesIn: {
    select: {
      sourcePaperId: true,
    },
  },
  metric: true,
} satisfies Prisma.PaperInclude;

export const paperListInclude = {
  authors: {
    include: {
      user: {
        select: publicUserSelect,
      },
    },
    orderBy: {
      position: "asc",
    },
  },
  metric: true,
} satisfies Prisma.PaperInclude;

export type PaperWithRelations = Prisma.PaperGetPayload<{
  include: typeof paperFullInclude;
}>;

export type PaperListItem = Prisma.PaperGetPayload<{
  include: typeof paperListInclude;
}>;

export interface SerializedPaperListItem {
  id: string;
  slug: string;
  title: string;
  abstract: string;
  publishedAt: string;
  authors: Array<{
    user: {
      name: string;
    };
  }>;
  metric: {
    reviewCount: number;
  } | null;
}

export interface PaperFeedPage {
  papers: SerializedPaperListItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  query: string;
}

const DOI_PATTERN = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;
const MAX_ACTIVE_INTEGRATION_KEYS = 12;

export function summarizeIdea(content: string) {
  return content.length > 140 ? `${content.slice(0, 140)}…` : content;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function getImportedNoteHighlights(metadata: Prisma.JsonValue | null | undefined) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const noteHighlights = (metadata as Record<string, Prisma.JsonValue>).noteHighlights;

  if (!Array.isArray(noteHighlights)) {
    return [];
  }

  return noteHighlights.filter((value): value is string => typeof value === "string");
}

function verdictFromScore(score: number) {
  return score >= 0.6 ? ReviewVerdict.ENDORSE : ReviewVerdict.CONCERN;
}

function scoreToFivePoint(value: number) {
  return Math.min(5, Math.max(1, Math.round(value * 5)));
}

function parseSearchTerms(query: string) {
  return [...new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length >= 2))];
}

function parseSearchDateRange(query: string) {
  const trimmed = query.trim().toLowerCase();
  const monthLookup: Record<string, number> = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  };

  const exactDayMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (exactDayMatch) {
    const [, year, month, day] = exactDayMatch;
    const start = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return { gte: start, lt: new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + 1)) };
  }

  const yearMonthMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (yearMonthMatch) {
    const [, year, month] = yearMonthMatch;
    const start = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
    return { gte: start, lt: new Date(Date.UTC(Number(year), Number(month), 1)) };
  }

  const slashDayMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDayMatch) {
    const [, month, day, year] = slashDayMatch;
    const start = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return { gte: start, lt: new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + 1)) };
  }

  const monthYearMatch = trimmed.match(
    /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})$/
  );
  if (monthYearMatch) {
    const [, monthName, year] = monthYearMatch;
    const monthIndex = monthLookup[monthName];
    const start = new Date(Date.UTC(Number(year), monthIndex, 1));
    return { gte: start, lt: new Date(Date.UTC(Number(year), monthIndex + 1, 1)) };
  }

  const yearMatch = trimmed.match(/^(\d{4})$/);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    return {
      gte: new Date(Date.UTC(year, 0, 1)),
      lt: new Date(Date.UTC(year + 1, 0, 1)),
    };
  }

  return null;
}

function buildPaperFeedWhere(query?: string): Prisma.PaperWhereInput {
  const trimmed = query?.trim();

  if (!trimmed) {
    return {
      visibility: "PUBLIC",
    };
  }

  const searchTerms = parseSearchTerms(trimmed);
  const dateRange = parseSearchDateRange(trimmed);

  return {
    visibility: "PUBLIC",
    OR: [
      {
        title: {
          contains: trimmed,
          mode: "insensitive",
        },
      },
      {
        abstract: {
          contains: trimmed,
          mode: "insensitive",
        },
      },
      {
        markdown: {
          contains: trimmed,
          mode: "insensitive",
        },
      },
      {
        doi: {
          contains: trimmed,
          mode: "insensitive",
        },
      },
      {
        authors: {
          some: {
            user: {
              OR: [
                {
                  name: {
                    contains: trimmed,
                    mode: "insensitive",
                  },
                },
                {
                  handle: {
                    contains: trimmed.replace(/^@/, ""),
                    mode: "insensitive",
                  },
                },
              ],
            },
          },
        },
      },
      ...(searchTerms.length > 0
        ? [
            {
              keywords: {
                hasSome: searchTerms,
              },
            },
          ]
        : []),
      ...(dateRange
        ? [
            {
              publishedAt: {
                gte: dateRange.gte,
                lt: dateRange.lt,
              },
            },
          ]
        : []),
    ],
  };
}

function serializePaperListItem(paper: PaperListItem): SerializedPaperListItem {
  return {
    id: paper.id,
    slug: paper.slug,
    title: paper.title,
    abstract: paper.abstract,
    publishedAt: paper.publishedAt.toISOString(),
    authors: paper.authors.map((author) => ({
      user: {
        name: author.user.name,
      },
    })),
    metric: paper.metric
      ? {
          reviewCount: paper.metric.reviewCount,
        }
      : null,
  };
}

async function ensureUniqueSlug(baseSlug: string) {
  const root = baseSlug || "paper";
  let slug = root;
  let index = 1;

  while (await prisma.paper.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${root}-${index}`;
    index += 1;
  }

  return slug;
}

export async function ensureUniquePaperSlug(baseSlug: string) {
  return ensureUniqueSlug(baseSlug);
}

async function ensureUniqueHandle(baseHandle: string) {
  const root = slugify(baseHandle).replace(/-/g, "") || "researcher";
  let handle = root;
  let index = 1;

  while (await prisma.user.findUnique({ where: { handle }, select: { id: true } })) {
    handle = `${root}${index}`;
    index += 1;
  }

  return handle.slice(0, 28);
}

function inferredRoleFromAuthor(name: string, handle?: string) {
  const normalized = `${name} ${handle ?? ""}`.toLowerCase();
  return normalized.includes("agent") || normalized.includes("bot")
    ? UserRole.BOT
    : UserRole.RESEARCHER;
}

async function ensureImportedUser(author: SidekickPublishInput["authors"][number]) {
  const normalizedEmail = author.email?.toLowerCase();
  const normalizedHandle = author.handle?.toLowerCase();

  let existingUser = normalizedEmail
    ? await prisma.user.findUnique({
        where: { email: normalizedEmail },
      })
    : null;

  if (!existingUser && normalizedHandle) {
    existingUser = await prisma.user.findUnique({
      where: { handle: normalizedHandle },
    });
  }

  if (existingUser) {
    return existingUser;
  }

  const handle = await ensureUniqueHandle(normalizedHandle || author.name);
  const email =
    normalizedEmail ??
    createTemporaryEmail(author.name, randomBytes(6).toString("hex"));

  try {
    return await prisma.user.create({
      data: {
        name: author.name,
        handle,
        email,
        institution: author.institution,
        role: inferredRoleFromAuthor(author.name, handle),
        passwordHash: await hashPassword(randomBytes(24).toString("hex")),
      },
    });
  } catch (error) {
    const uniqueTargets = getUniqueConstraintTargets(error);
    if (uniqueTargets.includes("email") || uniqueTargets.includes("handle")) {
      const concurrentUser = normalizedEmail
        ? await prisma.user.findUnique({
            where: {
              email: normalizedEmail,
            },
          })
        : normalizedHandle || handle
          ? await prisma.user.findUnique({
              where: {
                handle: normalizedHandle || handle,
              },
            })
          : null;

      if (concurrentUser) {
        return concurrentUser;
      }
    }

    throw error;
  }
}

type NormalizedReference = {
  referenceTitle?: string;
  referenceDoi?: string;
  targetSlug?: string;
};

function normalizeTextReference(reference: string): NormalizedReference {
  const trimmed = reference.trim();
  if (!trimmed) {
    return {};
  }

  const doi = trimmed.match(DOI_PATTERN)?.[0];
  if (doi) {
    return {
      referenceTitle: trimmed,
      referenceDoi: doi.toLowerCase(),
    };
  }

  if (/^[a-z0-9-]{3,}$/i.test(trimmed)) {
    return {
      targetSlug: trimmed.toLowerCase(),
      referenceTitle: trimmed,
    };
  }

  return {
    referenceTitle: trimmed,
  };
}

async function resolveNormalizedReferenceRecords(references: NormalizedReference[]) {
  const filtered = references.filter(
    (reference) => reference.referenceTitle || reference.referenceDoi || reference.targetSlug
  );

  if (filtered.length === 0) {
    return [];
  }

  const dois = filtered
    .map((reference) => reference.referenceDoi)
    .filter((value): value is string => Boolean(value));
  const slugs = filtered
    .map((reference) => reference.targetSlug)
    .filter((value): value is string => Boolean(value));

  const candidates =
    dois.length > 0 || slugs.length > 0
      ? await prisma.paper.findMany({
          where: {
            OR: [
              ...(dois.length > 0 ? [{ doi: { in: dois } }] : []),
              ...(slugs.length > 0 ? [{ slug: { in: slugs } }] : []),
            ],
          },
          select: {
            id: true,
            title: true,
            doi: true,
            slug: true,
          },
        })
      : [];

  return filtered.map((reference) => {
    const matchedPaper =
      candidates.find((candidate) =>
        reference.referenceDoi
          ? candidate.doi?.toLowerCase() === reference.referenceDoi?.toLowerCase()
          : candidate.slug === reference.targetSlug
      ) ?? null;

    return {
      targetPaperId: matchedPaper?.id,
      referenceDoi: reference.referenceDoi?.toLowerCase(),
      referenceTitle: reference.referenceTitle || matchedPaper?.title,
    };
  });
}

export async function resolveTextReferenceRecords(references: string[]) {
  return resolveNormalizedReferenceRecords(
    uniqueStrings(references).map((reference) => normalizeTextReference(reference))
  );
}

async function getPaperForAiReview(paperId: string) {
  return prisma.paper.findUnique({
    where: { id: paperId },
    select: {
      id: true,
      title: true,
      abstract: true,
      markdown: true,
      keywords: true,
      referencesOut: {
        select: {
          referenceTitle: true,
          referenceDoi: true,
        },
      },
    },
  });
}

export async function syncAiReviewForPaper(paperId: string) {
  if (!aiJudgeConfigured()) {
    return MetricStatus.DISABLED;
  }

  const paper = await getPaperForAiReview(paperId);
  if (!paper) {
    return MetricStatus.FAILED;
  }

  const assessment = await judgePaperWithOpenAI({
    title: paper.title,
    abstract: paper.abstract,
    markdown: paper.markdown,
    keywords: paper.keywords,
    references: paper.referencesOut
      .map((reference) => reference.referenceDoi || reference.referenceTitle || "")
      .filter(Boolean),
  });

  if (!assessment) {
    return MetricStatus.FAILED;
  }

  const data = {
    reviewerName: "AgentScience Judge",
    kind: ReviewKind.AI,
    verdict: verdictFromScore(assessment.overall),
    summary: assessment.summary,
    novelty: scoreToFivePoint(assessment.novelty),
    rigor: scoreToFivePoint(assessment.rigor),
    clarity: scoreToFivePoint(assessment.clarity),
    reproducibility: scoreToFivePoint(assessment.reproducibility),
  };

  const existingReview = await prisma.review.findFirst({
    where: {
      paperId,
      kind: ReviewKind.AI,
    },
  });

  if (existingReview) {
    await prisma.review.update({
      where: { id: existingReview.id },
      data,
    });
  } else {
    await prisma.review.create({
      data: {
        paperId,
        ...data,
      },
    });
  }

  return MetricStatus.READY;
}

export async function refreshPaperMetrics(options: { syncMissingAi?: boolean } = {}) {
  if (options.syncMissingAi && aiJudgeConfigured()) {
    const aiCandidates = await prisma.paper.findMany({
      select: {
        id: true,
        reviews: {
          where: {
            kind: ReviewKind.AI,
          },
          select: {
            id: true,
            summary: true,
          },
        },
        metric: {
          select: {
            aiStatus: true,
          },
        },
      },
    });

    for (const paper of aiCandidates) {
      const aiReview = paper.reviews[0];
      const needsAiBackfill = Boolean(aiReview && aiReview.summary.trim().length <= 400);

      if (
        paper.reviews.length === 0 ||
        paper.metric?.aiStatus !== MetricStatus.READY ||
        needsAiBackfill
      ) {
        await syncAiReviewForPaper(paper.id);
      }
    }
  }

  const papers = await prisma.paper.findMany({
    select: {
      id: true,
      title: true,
      abstract: true,
      markdown: true,
      keywords: true,
      authors: {
        select: {
          userId: true,
        },
      },
      ideas: {
        select: {
          id: true,
        },
      },
      reviews: {
        select: {
          kind: true,
          verdict: true,
          summary: true,
          novelty: true,
          rigor: true,
          clarity: true,
          reproducibility: true,
        },
      },
      saves: {
        select: {
          id: true,
        },
      },
      referencesOut: {
        select: {
          targetPaperId: true,
        },
      },
      metric: {
        select: {
          aiStatus: true,
        },
      },
    },
  });

  const rankings = buildPaperRankings(
    papers.map((paper) => {
      const aiReview = paper.reviews.find((review) => review.kind === ReviewKind.AI);

      return {
        paperId: paper.id,
        title: paper.title,
        abstract: paper.abstract,
        markdown: paper.markdown,
        keywords: paper.keywords,
        authorIds: paper.authors.map((author) => author.userId),
        referenceTargets: paper.referencesOut
          .map((reference) => reference.targetPaperId)
          .filter((value): value is string => Boolean(value)),
        reviewScores: paper.reviews
          .filter(
            (review): review is typeof review & {
              novelty: number;
              rigor: number;
              clarity: number;
              reproducibility: number;
            } =>
              review.kind === ReviewKind.HUMAN &&
              review.novelty != null &&
              review.rigor != null &&
              review.clarity != null &&
              review.reproducibility != null
          )
          .map((review) => ({
            novelty: review.novelty,
            rigor: review.rigor,
            clarity: review.clarity,
            reproducibility: review.reproducibility,
            verdict: review.verdict,
          })),
        saveCount: paper.saves.length,
        ideaCount: paper.ideas.length,
        aiAssessment:
          aiReview &&
          aiReview.novelty != null &&
          aiReview.rigor != null &&
          aiReview.clarity != null &&
          aiReview.reproducibility != null
            ? {
                summary: aiReview.summary,
                overall:
                  (aiReview.novelty +
                    aiReview.rigor +
                    aiReview.clarity +
                    aiReview.reproducibility) /
                  20,
                novelty: aiReview.novelty / 5,
                rigor: aiReview.rigor / 5,
                clarity: aiReview.clarity / 5,
                reproducibility: aiReview.reproducibility / 5,
              }
            : null,
      };
    })
  );

  const rankingMap = new Map(rankings.map((ranking) => [ranking.paperId, ranking]));

  await prisma.$transaction(
    papers.map((paper) => {
      const ranking = rankingMap.get(paper.id);
      const hasAiReview = paper.reviews.some((review) => review.kind === ReviewKind.AI);
      const previousStatus = paper.metric?.aiStatus;
      const aiStatus = hasAiReview
        ? MetricStatus.READY
        : !aiJudgeConfigured()
          ? MetricStatus.DISABLED
          : previousStatus === MetricStatus.FAILED
            ? MetricStatus.FAILED
            : MetricStatus.PENDING;

      return prisma.paperMetric.upsert({
        where: {
          paperId: paper.id,
        },
        create: {
          paperId: paper.id,
          humanScore: ranking?.humanScore ?? 0,
          networkScore: ranking?.networkScore ?? 0,
          aiScore: ranking?.aiScore ?? null,
          finalScore: ranking?.finalScore ?? 0,
          aiStatus,
          aiSummary: ranking?.aiSummary,
          reviewCount: paper.reviews.filter((review) => review.kind === ReviewKind.HUMAN).length,
          saveCount: paper.saves.length,
          ideaCount: paper.ideas.length,
        },
        update: {
          humanScore: ranking?.humanScore ?? 0,
          networkScore: ranking?.networkScore ?? 0,
          aiScore: ranking?.aiScore ?? null,
          finalScore: ranking?.finalScore ?? 0,
          aiStatus,
          aiSummary: ranking?.aiSummary,
          reviewCount: paper.reviews.filter((review) => review.kind === ReviewKind.HUMAN).length,
          saveCount: paper.saves.length,
          ideaCount: paper.ideas.length,
        },
      });
    })
  );
}

function sortPapersByRank<T extends { metric: { finalScore: number | null } | null; publishedAt: Date }>(
  papers: T[]
) {
  return [...papers].sort((left, right) => {
    const rightScore = right.metric?.finalScore ?? 0;
    const leftScore = left.metric?.finalScore ?? 0;

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return right.publishedAt.getTime() - left.publishedAt.getTime();
  });
}

export async function getRankedPapers(limit?: number) {
  const papers = await prisma.paper.findMany({
    where: {
      visibility: "PUBLIC",
    },
    include: paperListInclude,
  });

  const ranked = sortPapersByRank(papers);
  return typeof limit === "number" ? ranked.slice(0, limit) : ranked;
}

export async function getPaperFeedPage({
  query,
  page = 1,
  limit = 20,
}: {
  query?: string;
  page?: number;
  limit?: number;
} = {}): Promise<PaperFeedPage> {
  const resolvedPage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  const resolvedLimit = Number.isFinite(limit) ? Math.min(50, Math.max(1, Math.floor(limit))) : 20;
  const trimmedQuery = query?.trim() ?? "";
  const papers = await prisma.paper.findMany({
    where: buildPaperFeedWhere(trimmedQuery),
    include: paperListInclude,
  });
  const ranked = sortPapersByRank(papers);
  const start = (resolvedPage - 1) * resolvedLimit;
  const sliced = ranked.slice(start, start + resolvedLimit);

  return {
    papers: sliced.map(serializePaperListItem),
    page: resolvedPage,
    limit: resolvedLimit,
    total: ranked.length,
    hasMore: start + resolvedLimit < ranked.length,
    query: trimmedQuery,
  };
}

export async function getHomeData() {
  const [papers, ideas] = await Promise.all([
    prisma.paper.findMany({
      where: {
        visibility: "PUBLIC",
      },
      include: paperListInclude,
      orderBy: {
        publishedAt: "desc",
      },
    }),
    getRecentIdeas(),
  ]);

  const ranked = sortPapersByRank(papers);

  return {
    featured: ranked.slice(0, 3),
    recent: papers.slice(0, 8),
    ideas,
    paperCount: papers.length,
  };
}

export async function getRecentIdeas(limit = 6) {
  return prisma.idea.findMany({
    where: {
      OR: [
        { paperId: null },
        {
          paper: {
            visibility: "PUBLIC",
          },
        },
      ],
    },
    include: {
      author: {
        select: publicUserSelect,
      },
      paper: {
        select: {
          title: true,
          slug: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
}

export async function getPaperBySlug(slug: string) {
  return prisma.paper.findUnique({
    where: { slug },
    include: paperFullInclude,
  });
}

export async function getIntegrationKeys(userId: string) {
  return prisma.integrationKey.findMany({
    where: { userId },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function createManualPaper(userId: string, input: PaperFormInput) {
  const slug = await ensureUniquePaperSlug(slugify(input.title));
  const markdown =
    input.markdown?.trim() ||
    [input.abstract.trim(), input.latexSource?.trim()].filter(Boolean).join("\n\n");
  const keywords =
    input.keywords.length > 0
      ? uniqueStrings(input.keywords.map((keyword) => keyword.toLowerCase()))
      : extractKeywords(input.title, input.abstract, markdown, input.latexSource, input.bibSource);
  const referenceRecords = await resolveTextReferenceRecords(input.references);

  const paper = await prisma.$transaction(async (transaction) => {
    const createdPaper = await transaction.paper.create({
      data: {
        slug,
        title: input.title,
        abstract: input.abstract,
        markdown,
        latexSource: input.latexSource,
        bibSource: input.bibSource,
        pdfUrl: input.pdfUrl,
        canonicalUrl: input.canonicalUrl,
        githubUrl: input.githubUrl,
        doi: input.doi?.toLowerCase(),
        keywords,
        origin: PaperOrigin.MANUAL,
        authors: {
          create: {
            userId,
            position: 0,
            isCorresponding: true,
          },
        },
        referencesOut: {
          create: referenceRecords,
        },
      },
    });

    if (input.ideaNote) {
      await transaction.idea.create({
        data: {
          authorId: userId,
          paperId: createdPaper.id,
          content: input.ideaNote,
          summary: summarizeIdea(input.ideaNote),
        },
      });
    }

    return createdPaper;
  });

  await syncAiReviewForPaper(paper.id);
  await refreshPaperMetrics();

  return prisma.paper.findUnique({
    where: {
      id: paper.id,
    },
    select: {
      slug: true,
    },
  });
}

export async function createIdeaForUser(userId: string, input: IdeaFormInput) {
  const linkedPaper = input.paperSlug
    ? await prisma.paper.findUnique({
        where: { slug: input.paperSlug },
        select: { id: true },
      })
    : null;

  if (input.paperSlug && !linkedPaper) {
    throw new UserFacingError("Paper not found.", 404);
  }

  const idea = await prisma.idea.create({
    data: {
      authorId: userId,
      paperId: linkedPaper?.id,
      content: input.content,
      summary: summarizeIdea(input.content),
    },
  });

  await refreshPaperMetrics();
  return idea;
}

export async function addReviewForUser(
  userId: string,
  paperSlug: string,
  input: ReviewFormInput
) {
  const paper = await prisma.paper.findUnique({
    where: { slug: paperSlug },
    select: {
      id: true,
      authors: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!paper) {
    throw new UserFacingError("Paper not found.", 404);
  }

  if (paper.authors.some((author) => author.userId === userId)) {
    throw new UserFacingError("Authors cannot review their own paper.", 403);
  }

  const existingReview = await prisma.review.findFirst({
    where: {
      paperId: paper.id,
      reviewerId: userId,
      kind: ReviewKind.HUMAN,
    },
  });

  const reviewData = {
    verdict: input.verdict,
    summary: input.summary,
    novelty: input.novelty,
    rigor: input.rigor,
    clarity: input.clarity,
    reproducibility: input.reproducibility,
  };

  if (existingReview) {
    await prisma.review.update({
      where: {
        id: existingReview.id,
      },
      data: reviewData,
    });
  } else {
    await prisma.review.create({
      data: {
        paperId: paper.id,
        reviewerId: userId,
        reviewerName: null,
        kind: ReviewKind.HUMAN,
        ...reviewData,
      },
    });
  }

  await refreshPaperMetrics();
}

export async function togglePaperSave(userId: string, paperSlug: string) {
  const paper = await prisma.paper.findUnique({
    where: { slug: paperSlug },
    select: { id: true },
  });

  if (!paper) {
    throw new UserFacingError("Paper not found.", 404);
  }

  const existingSave = await prisma.savedPaper.findUnique({
    where: {
      paperId_userId: {
        paperId: paper.id,
        userId,
      },
    },
  });

  if (existingSave) {
    await prisma.savedPaper.delete({
      where: {
        paperId_userId: {
          paperId: paper.id,
          userId,
        },
      },
    });
  } else {
    await prisma.savedPaper.create({
      data: {
        paperId: paper.id,
        userId,
      },
    });
  }

  await refreshPaperMetrics();
  return !existingSave;
}

export async function createIntegrationKey(userId: string, input: IntegrationKeyInput) {
  const activeKeyCount = await prisma.integrationKey.count({
    where: {
      userId,
    },
  });

  if (activeKeyCount >= MAX_ACTIVE_INTEGRATION_KEYS) {
    throw new UserFacingError(
      "You already have the maximum number of active Sidekick tokens. Revoke one before creating another.",
      409
    );
  }

  const token = `agsk_${randomBytes(24).toString("base64url")}`;
  const tokenPrefix = token.slice(0, 12);

  const key = await prisma.integrationKey.create({
    data: {
      userId,
      name: input.name,
      tokenPrefix,
      tokenHash: hashToken(token),
    },
  });

  return {
    key,
    token,
  };
}

export async function deleteIntegrationKey(userId: string, keyId: string) {
  const key = await prisma.integrationKey.findFirst({
    where: {
      id: keyId,
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!key) {
    throw new UserFacingError("Integration key not found.", 404);
  }

  await prisma.integrationKey.delete({
    where: {
      id: key.id,
    },
  });
}

export async function authenticateIntegrationToken(token: string) {
  const integrationKey = await prisma.integrationKey.findUnique({
    where: {
      tokenHash: hashToken(token),
    },
    include: {
      user: true,
    },
  });

  if (!integrationKey) {
    return null;
  }

  await prisma.integrationKey.update({
    where: {
      id: integrationKey.id,
    },
    data: {
      lastUsedAt: new Date(),
    },
  });

  return integrationKey.user;
}

export async function upsertSidekickPaper(input: SidekickPublishInput) {
  const authors = await Promise.all(input.authors.map((author) => ensureImportedUser(author)));
  const primaryAuthor = authors[0];
  const noteHighlights = uniqueStrings(input.noteHighlights);
  const keywords =
    input.keywords.length > 0
      ? uniqueStrings(input.keywords.map((keyword) => keyword.toLowerCase()))
      : extractKeywords(input.title, input.abstract, input.markdown);
  const references = await resolveNormalizedReferenceRecords(
    input.references
      .map((reference) => ({
        referenceTitle: reference.title?.trim(),
        referenceDoi: reference.doi?.toLowerCase(),
        targetSlug: reference.targetSlug?.trim().toLowerCase(),
      }))
      .filter(
        (reference, index, array) =>
          array.findIndex(
            (candidate) =>
              candidate.referenceTitle === reference.referenceTitle &&
              candidate.referenceDoi === reference.referenceDoi &&
              candidate.targetSlug === reference.targetSlug
          ) === index
      )
  );

  const existingPaper = await prisma.paper.findUnique({
    where: {
      externalId: input.externalId,
    },
    select: {
      id: true,
      slug: true,
      metadata: true,
      authors: {
        orderBy: {
          position: "asc",
        },
        take: 1,
        select: {
          userId: true,
        },
      },
    },
  });
  const previousImportedHighlights = getImportedNoteHighlights(existingPaper?.metadata);
  const previousPrimaryAuthorId = existingPaper?.authors[0]?.userId;

  const paper = await prisma.$transaction(async (transaction) => {
    const baseData = {
      title: input.title,
      abstract: input.abstract,
      markdown: input.markdown,
      latexSource: input.latexSource,
      bibSource: input.bibSource,
      pdfUrl: input.pdfUrl,
      canonicalUrl: input.canonicalUrl,
      githubUrl: input.githubUrl,
      doi: input.doi?.toLowerCase(),
      origin: PaperOrigin.SIDEKICK,
      keywords,
      sourceNoteIds: uniqueStrings(input.sourceNoteIds),
      metadata: {
        theme: input.theme,
        importedFrom: "sidekick",
        noteHighlights,
      },
    } satisfies Prisma.PaperUncheckedUpdateInput;

    const resolvedPaper = existingPaper
      ? await transaction.paper.update({
          where: {
            id: existingPaper.id,
          },
          data: baseData,
        })
      : await transaction.paper.create({
          data: {
            ...baseData,
            slug: await ensureUniqueSlug(slugify(input.title)),
            externalId: input.externalId,
          },
        });

    await transaction.paperAuthor.deleteMany({
      where: {
        paperId: resolvedPaper.id,
      },
    });

    await transaction.paperReference.deleteMany({
      where: {
        sourcePaperId: resolvedPaper.id,
      },
    });

    await transaction.paperAuthor.createMany({
      data: authors.map((author, index) => ({
        paperId: resolvedPaper.id,
        userId: author.id,
        position: index,
        affiliation: input.authors[index]?.institution,
        isCorresponding: input.authors[index]?.isCorresponding ?? index === 0,
      })),
    });

    if (references.length > 0) {
      await transaction.paperReference.createMany({
        data: references.map((reference) => ({
          sourcePaperId: resolvedPaper.id,
          ...reference,
        })),
      });
    }

    if (previousImportedHighlights.length > 0) {
      await transaction.idea.deleteMany({
        where: {
          paperId: resolvedPaper.id,
          content: {
            in: previousImportedHighlights,
          },
          authorId: {
            in: uniqueStrings(
              [previousPrimaryAuthorId, primaryAuthor.id].filter(
                (value): value is string => Boolean(value)
              )
            ),
          },
        },
      });
    }

    if (noteHighlights.length > 0) {
      await transaction.idea.createMany({
        data: noteHighlights.map((noteHighlight) => ({
          paperId: resolvedPaper.id,
          authorId: primaryAuthor.id,
          content: noteHighlight,
          summary: summarizeIdea(noteHighlight),
        })),
      });
    }

    return resolvedPaper;
  });

  await syncAiReviewForPaper(paper.id);
  await refreshPaperMetrics();

  return prisma.paper.findUnique({
    where: {
      id: paper.id,
    },
    select: {
      slug: true,
    },
  });
}
