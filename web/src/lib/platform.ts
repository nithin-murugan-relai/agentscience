import { randomBytes } from "node:crypto";

import { PaperArtifactKind, Prisma, UserRole } from "@prisma/client";
import { del } from "@vercel/blob";

import { buildPaperBundleView } from "@/lib/paper-bundle";
import { UserFacingError } from "@/lib/errors";
import {
  classifyArtifactKind,
  guessArtifactContentType,
  isTextLikeArtifact,
  normalizeArtifactPath,
} from "@/lib/paper-artifacts";
import {
  ensureUniquePaperSlug,
  paperFullInclude,
  paperListInclude,
  publicUserSelect,
  refreshPaperMetrics,
  resolveTextReferenceRecords,
  summarizeIdea,
  syncAiReviewForPaper,
} from "@/lib/papers";
import { prisma } from "@/lib/prisma";
import {
  getPublicationProfileStatus,
  requirePublicationProfile,
} from "@/lib/publication-profile";
import { validatePaperBlobBudget } from "@/lib/paper-storage-policy";
import type {
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

export type PaperDetail = Prisma.PaperGetPayload<{
  include: typeof paperFullInclude;
}>;

export type PaperSummary = Prisma.PaperGetPayload<{
  include: typeof paperListInclude;
}>;

export type UploadDescriptor = {
  fileName: string;
  mimeType: string;
  url: string;
  pathname: string;
  downloadUrl?: string;
  sizeBytes: number;
  caption?: string;
};

export type ArtifactUploadDescriptor = {
  path: string;
  contentType?: string;
  url: string;
  pathname: string;
  downloadUrl?: string;
  sizeBytes: number;
  sha256: string;
  textContent?: string | null;
  kind?: PaperArtifactKind;
};

export type BundledPaperInput = Omit<PaperFormInput, "references"> & {
  references: string[];
  pdf?: UploadDescriptor | null;
  figures?: UploadDescriptor[];
  artifacts?: ArtifactUploadDescriptor[];
};

const MAX_INLINE_ARTIFACT_TEXT_BYTES = 256 * 1024;

function assertPaperBlobBudget(input: {
  pdf?: UploadDescriptor | null;
  figures?: UploadDescriptor[];
  artifacts?: ArtifactUploadDescriptor[];
}) {
  const error = validatePaperBlobBudget({
    pdf: input.pdf ?? null,
    figures: input.figures ?? [],
    artifacts: input.artifacts ?? [],
  });
  if (error) {
    throw new UserFacingError(error, 413);
  }
}

function managedBlobPathnames(pathnames: Array<string | null | undefined>) {
  return [
    ...new Set(
      pathnames.filter(
        (pathname): pathname is string =>
          typeof pathname === "string" && pathname.startsWith("papers/staged/")
      )
    ),
  ];
}

async function deleteManagedBlobPathnames(pathnames: Array<string | null | undefined>) {
  const managed = managedBlobPathnames(pathnames);
  if (managed.length === 0) {
    return;
  }

  try {
    await del(managed);
  } catch (error) {
    console.warn("Failed to delete paper blobs.", error);
  }
}

function materializeArtifact(
  descriptor: ArtifactUploadDescriptor,
  fallbackKind?: PaperArtifactKind
) {
  const path = normalizeArtifactPath(descriptor.path);
  const contentType =
    descriptor.contentType?.trim() || guessArtifactContentType(path);
  const kind = descriptor.kind ?? fallbackKind ?? classifyArtifactKind(path);
  const textContent =
    isTextLikeArtifact(path, contentType) &&
    typeof descriptor.textContent === "string" &&
    Buffer.byteLength(descriptor.textContent, "utf8") <= MAX_INLINE_ARTIFACT_TEXT_BYTES
      ? descriptor.textContent
      : null;

  return {
    kind,
    path,
    fileName: path.split("/").at(-1) ?? path,
    contentType,
    sha256: descriptor.sha256,
    textContent,
    blobUrl: descriptor.url,
    blobPath: descriptor.pathname,
    downloadUrl: descriptor.downloadUrl,
    sizeBytes: descriptor.sizeBytes,
  };
}

function dedupeArtifactsByPath(artifacts: ArtifactUploadDescriptor[]) {
  const byPath = new Map<string, ArtifactUploadDescriptor>();

  for (const artifact of artifacts) {
    byPath.set(normalizeArtifactPath(artifact.path), artifact);
  }

  return [...byPath.values()];
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
    },
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
      institution: author.affiliation ?? author.user.institution,
      role: author.user.role,
    })),
    score: paper.metric?.finalScore ?? 0,
    reviewCount: paper.metric?.reviewCount ?? 0,
    saveCount: paper.metric?.saveCount ?? 0,
  };
}

export function serializePaperDetail(paper: PaperDetail) {
  const bundle = buildPaperBundleView(paper);

  return {
    ...serializePaperSummary(paper),
    markdown: paper.markdown,
    latexSource: paper.latexSource,
    bibSource: paper.bibSource,
    pdf: paper.pdfStorageUrl || paper.pdfUrl
      ? {
          fileName: paper.pdfFileName ?? `${paper.slug}.pdf`,
          mimeType: paper.pdfMimeType ?? "application/pdf",
          url: `/api/v1/papers/${paper.slug}/download/pdf`,
          sourceUrl: paper.pdfStorageUrl ?? paper.pdfUrl,
        }
      : null,
    canonicalUrl: paper.canonicalUrl,
    references: paper.referencesOut.map((reference) => ({
      title: reference.referenceTitle,
      doi: reference.referenceDoi,
      targetPaperId: reference.targetPaperId,
    })),
    artifacts: bundle.artifacts,
    figures: bundle.figures,
  };
}

export async function createBundledPaper(userId: string, input: BundledPaperInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      institution: true,
      publicationProfileCompletedAt: true,
    },
  });

  if (!user) {
    throw new UserFacingError("User not found.", 404);
  }

  requirePublicationProfile(user);

  if (!input.latexSource?.trim() && !input.markdown?.trim()) {
    throw new UserFacingError("LaTeX or Markdown source is required.", 400);
  }

  if (!input.pdf && !input.pdfUrl?.trim()) {
    throw new UserFacingError("Provide a compiled PDF file or PDF URL.", 400);
  }

  assertPaperBlobBudget(input);

  const slug = await ensureUniquePaperSlug(slugify(input.title));
  const keywords = normalizeKeywords(input);
  const referenceRecords = await resolveTextReferenceRecords(input.references);
  const markdown = buildPaperMarkdown(input);
  const latexSource = input.latexSource?.trim() || null;
  const bibSource = input.bibSource?.trim();
  const artifacts = dedupeArtifactsByPath(input.artifacts ?? []).map((artifact) =>
    materializeArtifact(artifact)
  );

  const paper = await prisma.$transaction(async (transaction) => {
    const createdPaper = await transaction.paper.create({
      data: {
        slug,
        title: input.title,
        abstract: input.abstract,
        markdown,
        latexSource,
        bibSource,
        pdfUrl: input.pdfUrl?.trim(),
        pdfStorageUrl: input.pdf?.url ?? null,
        pdfStoragePath: input.pdf?.pathname ?? null,
        pdfDownloadUrl: input.pdf?.downloadUrl ?? null,
        pdfSizeBytes: input.pdf?.sizeBytes ?? null,
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
            affiliation: user.institution?.trim() || null,
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

    if (artifacts.length > 0) {
      await transaction.paperArtifact.createMany({
        data: artifacts.map((artifact) => ({
          paperId: createdPaper.id,
          ...artifact,
        })),
      });
    }

    if (input.figures?.length) {
      await transaction.paperAsset.createMany({
        data: input.figures.map((figure, index) => ({
          paperId: createdPaper.id,
          kind: "FIGURE",
          fileName:
            figure.fileName ||
            `figure-${String(index + 1).padStart(2, "0")}.png`,
          mimeType: figure.mimeType,
          blobUrl: figure.url,
          blobPath: figure.pathname,
          downloadUrl: figure.downloadUrl,
          sizeBytes: figure.sizeBytes,
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
    },
  });
}

export async function updateProfileForUser(userId: string, input: ProfileUpdateInput) {
  let publicationProfileCompletedAt: Date | undefined;

  if (input.publicationProfileCompleted) {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, institution: true, publicationProfileCompletedAt: true },
    });

    if (!existing) {
      throw new UserFacingError("User not found.", 404);
    }

    const nextProfile = {
      ...existing,
      ...(typeof input.name === "string" ? { name: input.name } : {}),
      ...(typeof input.institution === "string"
        ? { institution: input.institution || null }
        : {}),
    };

    if (!getPublicationProfileStatus(nextProfile).hasPublishName) {
      throw new UserFacingError(
        "Add the name you want to publish with before connecting AgentScience.",
        400
      );
    }

    publicationProfileCompletedAt = new Date();
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(typeof input.name === "string" ? { name: input.name } : {}),
      ...(typeof input.handle === "string" ? { handle: input.handle } : {}),
      ...(typeof input.bio === "string" ? { bio: input.bio || null } : {}),
      ...(typeof input.institution === "string"
        ? { institution: input.institution || null }
        : {}),
      ...(publicationProfileCompletedAt ? { publicationProfileCompletedAt } : {}),
      ...(input.researchInterests !== undefined
        ? { researchInterests: input.researchInterests }
        : {}),
    },
    select: {
      ...publicUserSelect,
      publicationProfileCompletedAt: true,
    },
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

export async function checkPaperOwnership(slug: string, userId: string) {
  const paper = await prisma.paper.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      pdfFileName: true,
      pdfStoragePath: true,
      artifacts: {
        select: {
          path: true,
          blobPath: true,
        },
      },
      assets: {
        select: {
          blobPath: true,
        },
      },
      authors: {
        where: { userId },
        select: { userId: true },
      },
    },
  });

  if (!paper) {
    return { paper: null, isOwner: false };
  }

  return { paper, isOwner: paper.authors.length > 0 };
}

export async function deletePaper(slug: string, userId: string) {
  const { paper, isOwner } = await checkPaperOwnership(slug, userId);

  if (!paper) {
    throw new UserFacingError("Paper not found.", 404);
  }

  if (!isOwner) {
    throw new UserFacingError("You do not have permission to delete this paper.", 403);
  }

  await prisma.paper.delete({ where: { id: paper.id } });
  await deleteManagedBlobPathnames([
    paper.pdfStoragePath,
    ...paper.artifacts.map((artifact) => artifact.blobPath),
    ...paper.assets.map((asset) => asset.blobPath),
  ]);
}

export type PaperUpdateInput = {
  title?: string;
  abstract?: string;
  markdown?: string;
  latexSource?: string;
  bibSource?: string;
  pdf?: UploadDescriptor | null;
  keywords?: string[];
  artifacts?: ArtifactUploadDescriptor[];
};

export async function updatePaper(slug: string, userId: string, input: PaperUpdateInput) {
  const { paper, isOwner } = await checkPaperOwnership(slug, userId);

  if (!paper) {
    throw new UserFacingError("Paper not found.", 404);
  }

  if (!isOwner) {
    throw new UserFacingError("You do not have permission to update this paper.", 403);
  }

  assertPaperBlobBudget(input);

  const data: Record<string, unknown> = {};

  if (input.title !== undefined) data.title = input.title;
  if (input.abstract !== undefined) data.abstract = input.abstract;
  if (input.markdown !== undefined) data.markdown = input.markdown;
  if (input.latexSource !== undefined) data.latexSource = input.latexSource;
  if (input.bibSource !== undefined) data.bibSource = input.bibSource;
  if (input.keywords !== undefined) data.keywords = input.keywords;

  if (input.pdf) {
    data.pdfStorageUrl = input.pdf.url;
    data.pdfStoragePath = input.pdf.pathname;
    data.pdfDownloadUrl = input.pdf.downloadUrl ?? null;
    data.pdfSizeBytes = input.pdf.sizeBytes;
    data.pdfMimeType = input.pdf.mimeType;
    data.pdfFileName = input.pdf.fileName;
  }

  const replacedBlobPathnames = [
    input.pdf && paper.pdfStoragePath !== input.pdf.pathname
      ? paper.pdfStoragePath
      : null,
  ];

  if (input.artifacts?.length) {
    const incomingByPath = new Map(
      dedupeArtifactsByPath(input.artifacts).map((artifact) => [
        normalizeArtifactPath(artifact.path),
        artifact.pathname,
      ])
    );

    for (const artifact of paper.artifacts) {
      const incomingPathname = incomingByPath.get(artifact.path);
      if (incomingPathname && incomingPathname !== artifact.blobPath) {
        replacedBlobPathnames.push(artifact.blobPath);
      }
    }
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.paper.update({
      where: { id: paper.id },
      data,
    });

    if (input.artifacts?.length) {
      const artifacts = dedupeArtifactsByPath(input.artifacts).map((artifact) =>
        materializeArtifact(artifact)
      );

      for (const artifact of artifacts) {
        await transaction.paperArtifact.upsert({
          where: {
            paperId_path: {
              paperId: paper.id,
              path: artifact.path,
            },
          },
          update: {
            ...artifact,
          },
          create: {
            paperId: paper.id,
            ...artifact,
          },
        });
      }
    }
  });

  await deleteManagedBlobPathnames(replacedBlobPathnames);

  await syncAiReviewForPaper(paper.id);
  await refreshPaperMetrics();

  const detail = await getPaperDetail(slug);
  if (!detail) {
    throw new UserFacingError("Paper was updated but could not be loaded.", 500);
  }

  return detail;
}

export async function ensureCoAuthor(name: string, email?: string, institution?: string) {
  return ensureImportedUser(name, email, institution);
}
