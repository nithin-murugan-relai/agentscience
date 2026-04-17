import { prisma } from "@/lib/prisma";

const MAX_DATASET_REGISTRY_ENTRIES = 500;

export type DatasetSourcePaper = {
  slug: string;
  title: string;
  authors: string[];
  publishedAt: Date;
  url: string;
};

export type DatasetListItem = {
  id: string;
  name: string;
  url: string;
  domain: string;
  description: string;
  keywords: string[];
  sourcePaperId: string | null;
  sourceRank: number | null;
  addedBy: string | null;
  createdAt: Date;
  sourcePaper: DatasetSourcePaper | null;
  usedInPaperCount: number;
};

function parseHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function normalizeDomain(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.replace(/^www\./i, "") : "";
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function parsePositiveInt(value: number | undefined, fallback: number, max = MAX_DATASET_REGISTRY_ENTRIES) {
  if (!Number.isFinite(value) || value === undefined || value <= 0) {
    return fallback;
  }

  return Math.min(max, Math.floor(value));
}

export async function getDatasetRegistry(options?: {
  query?: string;
  limit?: number;
}): Promise<DatasetListItem[]> {
  const query = options?.query?.trim() ?? "";
  const limit = parsePositiveInt(options?.limit, MAX_DATASET_REGISTRY_ENTRIES);

  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { description: { contains: query, mode: "insensitive" as const } },
          { domain: { contains: query, mode: "insensitive" as const } },
          { keywords: { hasSome: query.toLowerCase().split(/\s+/).filter(Boolean) } },
        ],
      }
    : {};

  const registryEntries = await prisma.datasetEntry.findMany({
    where,
    orderBy: [{ sourceRank: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: limit,
  });

  const paperIds = registryEntries
    .map((dataset) => dataset.sourcePaperId)
    .filter((id): id is string => Boolean(id));

  const publicPapers = paperIds.length
    ? await prisma.paper.findMany({
        where: {
          id: { in: paperIds },
          visibility: "PUBLIC",
        },
        select: {
          id: true,
          slug: true,
          title: true,
          publishedAt: true,
          authors: {
            orderBy: { position: "asc" },
            select: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      })
    : [];

  const publicPaperById = new Map(publicPapers.map((paper) => [paper.id, paper]));

  return registryEntries.flatMap((dataset) => {
    const parsedUrl = parseHttpUrl(dataset.url);
    if (!parsedUrl) {
      return [];
    }

    const paper = dataset.sourcePaperId ? publicPaperById.get(dataset.sourcePaperId) ?? null : null;

    return [
      {
        id: dataset.id,
        name: dataset.name,
        url: parsedUrl.toString(),
        domain:
          normalizeDomain(dataset.domain) ||
          normalizeDomain(parsedUrl.hostname) ||
          "registry",
        description: dataset.description,
        keywords: uniqueStrings(dataset.keywords).slice(0, 8),
        sourcePaperId: dataset.sourcePaperId,
        sourceRank: dataset.sourceRank,
        addedBy: dataset.addedBy,
        createdAt: dataset.createdAt,
        sourcePaper: paper
          ? {
              slug: paper.slug,
              title: paper.title,
              authors: uniqueStrings(paper.authors.map((author) => author.user.name)),
              publishedAt: paper.publishedAt,
              url: `/papers/${paper.slug}`,
            }
          : null,
        usedInPaperCount: paper ? 1 : 0,
      },
    ];
  });
}
