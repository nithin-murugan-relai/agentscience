import type { DatasetProviderSearchKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const MAX_DATASET_REGISTRY_ENTRIES = 500;
const MAX_DATASET_PROVIDER_ENTRIES = 200;

export type DatasetSourcePaper = {
  slug: string;
  title: string;
  authors: string[];
  publishedAt: Date;
  url: string;
};

export type DatasetProviderSummary = {
  id: string;
  slug: string;
  name: string;
  domain: string;
};

export type DatasetListItem = {
  id: string;
  name: string;
  shortName: string | null;
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
  provider: DatasetProviderSummary | null;
};

export type DatasetProviderListItem = {
  id: string;
  slug: string;
  name: string;
  homeUrl: string;
  domain: string;
  description: string;
  logoUrl: string | null;
  searchKind: DatasetProviderSearchKind | null;
  searchEndpoint: string | null;
  searchQueryTemplate: string | null;
  datasetUrlTemplate: string | null;
  agentInstructions: string | null;
  datasetCount: number;
  createdAt: Date;
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
    include: {
      provider: {
        select: {
          id: true,
          slug: true,
          name: true,
          domain: true,
        },
      },
    },
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
        shortName: dataset.shortName ?? null,
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
        provider: dataset.provider
          ? {
              id: dataset.provider.id,
              slug: dataset.provider.slug,
              name: dataset.provider.name,
              domain: dataset.provider.domain,
            }
          : null,
      },
    ];
  });
}

/**
 * List dataset providers (OpenNeuro, HuggingFace, etc.). Each provider carries
 * the agent-facing search recipe (endpoint + query template + instructions)
 * so a caller can query the underlying catalog without hardcoded knowledge.
 */
export async function getDatasetProviders(options?: {
  query?: string;
  limit?: number;
}): Promise<DatasetProviderListItem[]> {
  const query = options?.query?.trim() ?? "";
  const limit = parsePositiveInt(
    options?.limit,
    MAX_DATASET_PROVIDER_ENTRIES,
    MAX_DATASET_PROVIDER_ENTRIES,
  );

  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { slug: { contains: query, mode: "insensitive" as const } },
          { description: { contains: query, mode: "insensitive" as const } },
          { domain: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const providers = await prisma.datasetProvider.findMany({
    where,
    orderBy: [{ name: "asc" }],
    take: limit,
    include: {
      _count: {
        select: { datasets: true },
      },
    },
  });

  return providers.map((provider) => ({
    id: provider.id,
    slug: provider.slug,
    name: provider.name,
    homeUrl: provider.homeUrl,
    domain: normalizeDomain(provider.domain),
    description: provider.description,
    logoUrl: provider.logoUrl,
    searchKind: provider.searchKind,
    searchEndpoint: provider.searchEndpoint,
    searchQueryTemplate: provider.searchQueryTemplate,
    datasetUrlTemplate: provider.datasetUrlTemplate,
    agentInstructions: provider.agentInstructions,
    datasetCount: provider._count.datasets,
    createdAt: provider.createdAt,
  }));
}
