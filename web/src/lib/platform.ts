import { createHash, randomBytes } from "node:crypto";

import { Prisma, UserRole } from "@prisma/client";

import { hashPassword } from "@/lib/auth";
import { UserFacingError } from "@/lib/errors";
import {
  paperFullInclude,
  paperListInclude,
  publicUserSelect,
  refreshPaperMetrics,
  syncAiReviewForPaper,
} from "@/lib/papers";
import { prisma } from "@/lib/prisma";
import type {
  CommentInput,
  PaperFormInput,
  ProfileUpdateInput,
} from "@/lib/validation";
import {
  createTemporaryEmail,
  excerpt,
  extractKeywords,
  formatDate,
  slugify,
} from "@/lib/utils";

const DOI_PATTERN = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;

export type PaperDetail = Prisma.PaperGetPayload<{
  include: typeof paperFullInclude;
}>;

export type PaperSummary = Prisma.PaperGetPayload<{
  include: typeof paperListInclude;
}>;

export type UploadDescriptor = {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  caption?: string;
};

export type BundledPaperInput = Omit<PaperFormInput, "references"> & {
  references: string[];
  pdf?: UploadDescriptor | null;
  figures?: UploadDescriptor[];
};

function hashSuffix(value: string) {
  return createHash("sha1").update(value).digest("hex").slice(0, 10);
}

function toPrismaBytes(bytes: Buffer) {
  return new Uint8Array(bytes);
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

async function ensureImportedUser(name: string, email?: string, institution?: string) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail) {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return existing;
    }
  }

  const baseHandle = slugify(name).replace(/-/g, "") || "researcher";
  let handle = baseHandle;
  let index = 1;

  while (await prisma.user.findUnique({ where: { handle }, select: { id: true } })) {
    handle = `${baseHandle}${index}`;
    index += 1;
  }

  return prisma.user.create({
    data: {
      name,
      handle: handle.slice(0, 28),
      email:
        normalizedEmail ??
        createTemporaryEmail(name, randomBytes(6).toString("hex")),
      institution,
      role: name.toLowerCase().includes("agent") ? UserRole.BOT : UserRole.RESEARCHER,
      passwordHash: await hashPassword(randomBytes(24).toString("hex")),
    },
  });
}

function normalizeReference(reference: string) {
  const trimmed = reference.trim();
  if (!trimmed) {
    return null;
  }

  const doi = trimmed.match(DOI_PATTERN)?.[0]?.toLowerCase();
  const slug =
    !doi && /^[a-z0-9-]{3,}$/i.test(trimmed) ? trimmed.toLowerCase() : undefined;

  return {
    referenceTitle: trimmed,
    referenceDoi: doi,
    targetSlug: slug,
  };
}

async function resolveReferenceRecords(references: string[]) {
  const normalized = references
    .map(normalizeReference)
    .filter((value): value is NonNullable<ReturnType<typeof normalizeReference>> =>
      Boolean(value)
    );

  if (normalized.length === 0) {
    return [];
  }

  const candidates = await prisma.paper.findMany({
    where: {
      OR: [
        {
          doi: {
            in: normalized
              .map((reference) => reference.referenceDoi)
              .filter((value): value is string => Boolean(value)),
          },
        },
        {
          slug: {
            in: normalized
              .map((reference) => reference.targetSlug)
              .filter((value): value is string => Boolean(value)),
          },
        },
      ],
    },
    select: {
      id: true,
      slug: true,
      doi: true,
      title: true,
    },
  });

  return normalized.map((reference) => {
    const match =
      candidates.find((candidate) =>
        reference.referenceDoi
          ? candidate.doi?.toLowerCase() === reference.referenceDoi
          : candidate.slug === reference.targetSlug
      ) ?? null;

    return {
      targetPaperId: match?.id,
      referenceTitle: reference.referenceTitle || match?.title,
      referenceDoi: reference.referenceDoi,
    };
  });
}

function normalizeKeywords(input: BundledPaperInput) {
  const provided = input.keywords.filter(Boolean).map((keyword) => keyword.toLowerCase());
  if (provided.length > 0) {
    return [...new Set(provided)].slice(0, 12);
  }

  return extractKeywords(
    input.title,
    input.abstract,
    input.markdown,
    input.latexSource,
    input.bibSource
  );
}

function buildPaperMarkdown(input: BundledPaperInput) {
  if (input.markdown?.trim()) {
    return input.markdown.trim();
  }

  return [input.abstract.trim(), input.latexSource?.trim()]
    .filter(Boolean)
    .map((chunk) => excerpt(chunk as string, 4000))
    .join("\n\n");
}

export async function listPapers({
  query,
  author,
  keyword,
  limit,
}: {
  query?: string;
  author?: string;
  keyword?: string;
  limit?: number;
} = {}) {
  const papers = await prisma.paper.findMany({
    where: {
      visibility: "PUBLIC",
      AND: [
        query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { abstract: { contains: query, mode: "insensitive" } },
                { markdown: { contains: query, mode: "insensitive" } },
                { keywords: { has: query.toLowerCase() } },
              ],
            }
          : {},
        author
          ? {
              authors: {
                some: {
                  user: {
                    OR: [
                      { handle: { contains: author.toLowerCase(), mode: "insensitive" } },
                      { name: { contains: author, mode: "insensitive" } },
                    ],
                  },
                },
              },
            }
          : {},
        keyword
          ? {
              keywords: { has: keyword.toLowerCase() },
            }
          : {},
      ],
    },
    include: paperListInclude,
    orderBy: [{ publishedAt: "desc" }],
    take: limit,
  });

  return papers;
}

export async function getPaperDetail(slug: string) {
  return prisma.paper.findUnique({
    where: { slug },
    include: paperFullInclude,
  });
}

export function serializePaperSummary(paper: PaperSummary) {
  return {
    id: paper.id,
    slug: paper.slug,
    title: paper.title,
    abstract: paper.abstract,
    publishedAt: paper.publishedAt.toISOString(),
    doi: paper.doi,
    keywords: paper.keywords,
    githubUrl: paper.githubUrl,
    authors: paper.authors.map((author) => ({
      name: author.user.name,
      handle: author.user.handle,
      institution: author.user.institution,
      role: author.user.role,
    })),
    score: paper.metric?.finalScore ?? 0,
    reviewCount: paper.metric?.reviewCount ?? 0,
    saveCount: paper.metric?.saveCount ?? 0,
  };
}

export function serializePaperDetail(paper: PaperDetail) {
  return {
    ...serializePaperSummary(paper),
    markdown: paper.markdown,
    latexSource: paper.latexSource,
    bibSource: paper.bibSource,
    pdf: paper.pdfData || paper.pdfUrl
      ? {
          fileName: paper.pdfFileName ?? `${paper.slug}.pdf`,
          mimeType: paper.pdfMimeType ?? "application/pdf",
          url: `/api/v1/papers/${paper.slug}/download/pdf`,
          sourceUrl: paper.pdfUrl,
        }
      : null,
    canonicalUrl: paper.canonicalUrl,
    references: paper.referencesOut.map((reference) => ({
      title: reference.referenceTitle,
      doi: reference.referenceDoi,
      targetPaperId: reference.targetPaperId,
    })),
    figures: paper.assets.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      caption: asset.caption,
      downloadUrl: `/api/v1/papers/${paper.slug}/download/asset/${asset.id}`,
    })),
    comments: paper.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      author: {
        name: comment.author.name,
        handle: comment.author.handle,
        institution: comment.author.institution,
      },
    })),
  };
}

export async function createBundledPaper(userId: string, input: BundledPaperInput) {
  if (!input.latexSource?.trim()) {
    throw new UserFacingError("LaTeX source is required.", 400);
  }

  if (!input.pdf && !input.pdfUrl?.trim()) {
    throw new UserFacingError("Provide a compiled PDF file or PDF URL.", 400);
  }

  if (!input.githubUrl?.trim()) {
    throw new UserFacingError("A GitHub repository URL is required.", 400);
  }

  const slug = await ensureUniqueSlug(slugify(input.title));
  const keywords = normalizeKeywords(input);
  const referenceRecords = await resolveReferenceRecords(input.references);
  const markdown = buildPaperMarkdown(input);
  const latexSource = input.latexSource.trim();

  const paper = await prisma.$transaction(async (transaction) => {
    const createdPaper = await transaction.paper.create({
      data: {
        slug,
        title: input.title,
        abstract: input.abstract,
        markdown,
        latexSource,
        bibSource: input.bibSource,
        pdfUrl: input.pdfUrl?.trim(),
        pdfData: input.pdf ? toPrismaBytes(input.pdf.bytes) : null,
        pdfMimeType: input.pdf?.mimeType ?? (input.pdfUrl ? "application/pdf" : null),
        pdfFileName: input.pdf?.fileName ?? (input.pdfUrl ? `${slug}.pdf` : null),
        canonicalUrl: input.canonicalUrl,
        githubUrl: input.githubUrl,
        doi: input.doi?.toLowerCase(),
        keywords,
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
          summary: excerpt(input.ideaNote, 140),
        },
      });
    }

    if (input.bibSource?.trim()) {
      await transaction.paperAsset.create({
        data: {
          paperId: createdPaper.id,
          kind: "SUPPLEMENT",
          fileName: "references.bib",
          mimeType: "application/x-bibtex",
          textContent: input.bibSource.trim(),
          sizeBytes: Buffer.byteLength(input.bibSource.trim(), "utf8"),
        },
      });
    }

    await transaction.paperAsset.create({
        data: {
          paperId: createdPaper.id,
          kind: "SUPPLEMENT",
          fileName: "paper.tex",
          mimeType: "application/x-latex",
          textContent: latexSource,
          sizeBytes: Buffer.byteLength(latexSource, "utf8"),
        },
      });

    if (input.figures?.length) {
      await transaction.paperAsset.createMany({
        data: input.figures.map((figure, index) => ({
          paperId: createdPaper.id,
          kind: "FIGURE",
          fileName:
            figure.fileName ||
            `figure-${String(index + 1).padStart(2, "0")}-${hashSuffix(
              figure.bytes.toString("base64url")
            )}.png`,
          mimeType: figure.mimeType,
          bytes: toPrismaBytes(figure.bytes),
          sizeBytes: figure.bytes.length,
          caption: figure.caption,
        })),
      });
    }

    return createdPaper;
  });

  await syncAiReviewForPaper(paper.id);
  await refreshPaperMetrics();

  const detail = await getPaperDetail(slug);

  if (!detail) {
    throw new UserFacingError("Paper was created but could not be loaded.", 500);
  }

  return detail;
}

export async function createCommentForUser(
  userId: string,
  paperSlug: string,
  input: CommentInput
) {
  const paper = await prisma.paper.findUnique({
    where: { slug: paperSlug },
    select: { id: true },
  });

  if (!paper) {
    throw new UserFacingError("Paper not found.", 404);
  }

  return prisma.comment.create({
    data: {
      paperId: paper.id,
      authorId: userId,
      body: input.body,
    },
    include: {
      author: {
        select: publicUserSelect,
      },
    },
  });
}

export async function getProfileByHandle(handle: string) {
  return prisma.user.findUnique({
    where: {
      handle: handle.toLowerCase(),
    },
    select: {
      ...publicUserSelect,
      createdAt: true,
      authoredPapers: {
        include: {
          paper: {
            include: paperListInclude,
          },
        },
        orderBy: {
          paper: {
            publishedAt: "desc",
          },
        },
      },
      comments: {
        include: {
          paper: {
            select: {
              slug: true,
              title: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 12,
      },
    },
  });
}

export async function updateProfileForUser(userId: string, input: ProfileUpdateInput) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(typeof input.name === "string" ? { name: input.name } : {}),
      ...(typeof input.bio === "string" ? { bio: input.bio || null } : {}),
      ...(typeof input.institution === "string"
        ? { institution: input.institution || null }
        : {}),
      researchInterests: input.researchInterests,
      ...(typeof input.digestEnabled === "boolean"
        ? { digestEnabled: input.digestEnabled }
        : {}),
      ...(typeof input.digestEmailEnabled === "boolean"
        ? { digestEmailEnabled: input.digestEmailEnabled }
        : {}),
    },
    select: publicUserSelect,
  });
}

function paperRelevanceScore(paper: PaperDetail | PaperSummary, interests: string[]) {
  const interestTerms = interests.map((interest) => interest.toLowerCase());
  const haystack = `${paper.title} ${paper.abstract} ${paper.keywords.join(" ")}`.toLowerCase();
  const matches = interestTerms.filter((interest) => haystack.includes(interest)).length;
  return matches * 2 + (paper.metric?.finalScore ?? 0);
}

export async function buildDigestForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      handle: true,
      digestEnabled: true,
      digestEmailEnabled: true,
      researchInterests: true,
    },
  });

  if (!user) {
    throw new UserFacingError("User not found.", 404);
  }

  const papers = await prisma.paper.findMany({
    where: {
      visibility: "PUBLIC",
    },
    include: paperListInclude,
    orderBy: {
      publishedAt: "desc",
    },
    take: 24,
  });

  const ranked = [...papers]
    .sort(
      (left, right) =>
        paperRelevanceScore(right, user.researchInterests) -
        paperRelevanceScore(left, user.researchInterests)
    )
    .slice(0, 5);

  return {
    generatedAt: new Date().toISOString(),
    user: {
      name: user.name,
      handle: user.handle,
      digestEnabled: user.digestEnabled,
      digestEmailEnabled: user.digestEmailEnabled,
      researchInterests: user.researchInterests,
    },
    summary:
      ranked.length > 0
        ? `Top papers for ${user.name} on ${formatDate(new Date())}: ${ranked
            .map((paper) => paper.title)
            .join("; ")}.`
        : `No recent papers matched ${user.name}'s interests today.`,
    papers: ranked.map((paper) => serializePaperSummary(paper)),
  };
}

export async function ensureCoAuthor(name: string, email?: string, institution?: string) {
  return ensureImportedUser(name, email, institution);
}
