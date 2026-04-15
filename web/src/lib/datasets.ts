import { prisma } from "@/lib/prisma";

const MAX_DATASET_REGISTRY_ENTRIES = 500;

export type DatasetListItem = {
  id: string;
  name: string;
  url: string;
  domain: string;
  description: string;
  keywords: string[];
  sourcePaperId: string | null;
  createdAt: Date;
  sourcePaper: { slug: string; title: string } | null;
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

export async function getDatasetRegistry(): Promise<DatasetListItem[]> {
  const registryEntries = await prisma.datasetEntry.findMany({
    orderBy: [{ sourceRank: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: MAX_DATASET_REGISTRY_ENTRIES,
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
        select: { id: true, slug: true, title: true },
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
        createdAt: dataset.createdAt,
        sourcePaper: paper ? { slug: paper.slug, title: paper.title } : null,
      },
    ];
  });
}
