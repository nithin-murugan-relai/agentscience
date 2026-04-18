import type { DatasetArea, DatasetProviderSearchKind, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { DatasetAreaKey } from "@/lib/topics";

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

export type DatasetTopicSummary = {
  id: string;
  slug: string;
  name: string;
  area: DatasetAreaKey;
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
  topics: DatasetTopicSummary[];
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
  topics: DatasetTopicSummary[];
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
  area?: DatasetAreaKey;
  topicSlug?: string;
}): Promise<DatasetListItem[]> {
  const query = options?.query?.trim() ?? "";
  const limit = parsePositiveInt(options?.limit, MAX_DATASET_REGISTRY_ENTRIES);

  const andClauses: Prisma.DatasetEntryWhereInput[] = [];
  if (query) {
    andClauses.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { domain: { contains: query, mode: "insensitive" } },
        { keywords: { hasSome: query.toLowerCase().split(/\s+/).filter(Boolean) } },
      ],
    });
  }
  if (options?.area) {
    andClauses.push({ topics: { some: { area: options.area as DatasetArea } } });
  }
  if (options?.topicSlug) {
    andClauses.push({ topics: { some: { slug: options.topicSlug } } });
  }

  const where: Prisma.DatasetEntryWhereInput =
    andClauses.length === 0 ? {} : andClauses.length === 1 ? andClauses[0]! : { AND: andClauses };

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
      topics: {
        where: { status: "ACTIVE" },
        select: { id: true, slug: true, name: true, area: true },
        orderBy: { name: "asc" },
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
        topics: dataset.topics.map((topic) => ({
          id: topic.id,
          slug: topic.slug,
          name: topic.name,
          area: topic.area,
        })),
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
  area?: DatasetAreaKey;
  topicSlug?: string;
}): Promise<DatasetProviderListItem[]> {
  const query = options?.query?.trim() ?? "";
  const limit = parsePositiveInt(
    options?.limit,
    MAX_DATASET_PROVIDER_ENTRIES,
    MAX_DATASET_PROVIDER_ENTRIES,
  );

  const andClauses: Prisma.DatasetProviderWhereInput[] = [];
  if (query) {
    andClauses.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { slug: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { domain: { contains: query, mode: "insensitive" } },
      ],
    });
  }
  if (options?.area) {
    andClauses.push({ topics: { some: { area: options.area as DatasetArea } } });
  }
  if (options?.topicSlug) {
    andClauses.push({ topics: { some: { slug: options.topicSlug } } });
  }

  const where: Prisma.DatasetProviderWhereInput =
    andClauses.length === 0 ? {} : andClauses.length === 1 ? andClauses[0]! : { AND: andClauses };

  const providers = await prisma.datasetProvider.findMany({
    where,
    orderBy: [{ name: "asc" }],
    take: limit,
    include: {
      _count: {
        select: { datasets: true },
      },
      topics: {
        where: { status: "ACTIVE" },
        select: { id: true, slug: true, name: true, area: true },
        orderBy: { name: "asc" },
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
    topics: provider.topics.map((topic) => ({
      id: topic.id,
      slug: topic.slug,
      name: topic.name,
      area: topic.area,
    })),
  }));
}
