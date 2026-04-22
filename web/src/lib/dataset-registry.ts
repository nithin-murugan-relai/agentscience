import type { DatasetEntry } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import type { DatasetAreaKey } from "@/lib/topics";
import {
  datasetTopicSlugsSchema,
  resolveTopicIds,
} from "@/lib/topics";
import { inferDatasetTopicIdsForCandidate } from "@/lib/dataset-topic-inference";

const datasetRegistryMatchSelect = {
  id: true,
  name: true,
  shortName: true,
  url: true,
  domain: true,
  description: true,
  keywords: true,
  sourcePaperId: true,
  sourceRank: true,
  createdAt: true,
  provider: {
    select: {
      id: true,
      slug: true,
      name: true,
      domain: true,
    },
  },
  topics: {
    where: { status: "ACTIVE" as const },
    select: { id: true, slug: true, name: true, area: true },
    orderBy: { name: "asc" as const },
  },
} satisfies Record<string, unknown>;

export const datasetRegistryCandidateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  shortName: z
    .string()
    .trim()
    .min(1)
    .max(35)
    .optional()
    .nullable(),
  url: z
    .string()
    .trim()
    .url()
    .refine((value) => {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    }, "url must use http or https."),
  description: z.string().trim().min(12).max(2000),
  keywords: z.array(z.string().trim().min(1).max(60)).max(16).default([]),
  providerSlug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "providerSlug must be lowercase letters, digits, or hyphens.")
    .optional()
    .nullable(),
  topicSlugs: datasetTopicSlugsSchema.optional(),
  registryEligible: z.boolean().optional().default(true),
});

export const datasetRegistryCheckRequestSchema = z.object({
  datasets: z.array(datasetRegistryCandidateSchema).min(1).max(20),
});

export type DatasetRegistryCandidateInput = z.infer<typeof datasetRegistryCandidateSchema>;
export type DatasetRegistryCheckRequest = z.infer<typeof datasetRegistryCheckRequestSchema>;

type DatasetRegistryProviderMatch = {
  id: string;
  slug: string;
  name: string;
  domain: string;
};

type DatasetRegistryTopicMatch = {
  id: string;
  slug: string;
  name: string;
  area: DatasetAreaKey;
};

type DatasetRegistryEntryMatch = Pick<
  DatasetEntry,
  "id" | "name" | "shortName" | "url" | "domain" | "description" | "keywords" | "sourcePaperId" | "sourceRank" | "createdAt"
> & {
  provider: DatasetRegistryProviderMatch | null;
  topics: DatasetRegistryTopicMatch[];
};

export type DatasetRegistryCheckStatus = "registered" | "possible-duplicate" | "new";

export type DatasetRegistryCheckResult = {
  candidate: {
    name: string;
    shortName: string | null;
    url: string;
    domain: string;
    description: string;
    keywords: string[];
    providerSlug: string | null;
    topicSlugs: string[];
    unknownTopicSlugs: string[];
    registryEligible: boolean;
  };
  status: DatasetRegistryCheckStatus;
  matches: Array<{
    id: string;
    name: string;
    shortName: string | null;
    url: string;
    domain: string;
    description: string;
    keywords: string[];
    sourcePaperId: string | null;
    sourceRank: number | null;
    createdAt: string;
    provider: DatasetRegistryProviderMatch | null;
    topics: DatasetRegistryTopicMatch[];
  }>;
};

type DatasetProviderValidationRecord = {
  id: string;
  slug: string;
  name: string;
  domain: string;
  searchKind: string | null;
  searchEndpoint: string | null;
  searchQueryTemplate: string | null;
  datasetUrlTemplate: string | null;
  agentInstructions: string | null;
};

export class DatasetRegistryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatasetRegistryValidationError";
  }
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeDatasetName(value: string) {
  return normalizeWhitespace(value).toLowerCase();
}

function normalizeDatasetShortName(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = normalizeWhitespace(value);
  if (trimmed.length === 0 || trimmed.length > 35) {
    return null;
  }
  return trimmed;
}

export function normalizeDatasetKeywords(values: string[]) {
  return [...new Set(values.map((value) => normalizeWhitespace(value).toLowerCase()).filter(Boolean))];
}

export function normalizeDatasetUrl(value: string) {
  const parsed = new URL(value.trim());

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("url must use http or https.");
  }

  parsed.hash = "";

  if ((parsed.protocol === "http:" && parsed.port === "80") || (parsed.protocol === "https:" && parsed.port === "443")) {
    parsed.port = "";
  }

  if (parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }

  return parsed.toString();
}

export function normalizeDatasetDomainFromUrl(value: string) {
  return new URL(normalizeDatasetUrl(value)).hostname.replace(/^www\./i, "");
}

function normalizeUrlPathFingerprint(value: string) {
  const parsed = new URL(normalizeDatasetUrl(value));
  const normalizedPath = parsed.pathname.replace(/\/+$/, "") || "/";
  const normalizedSearch = [...parsed.searchParams.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) {
        return leftValue.localeCompare(rightValue);
      }
      return leftKey.localeCompare(rightKey);
    })
    .map(([key, entryValue]) => `${key}=${entryValue}`)
    .join("&");
  const searchSuffix = normalizedSearch ? `?${normalizedSearch}` : "";
  return `${parsed.hostname.replace(/^www\./i, "")}${normalizedPath}${searchSuffix}`.toLowerCase();
}

function toRegistryMatchSummary(entry: DatasetRegistryEntryMatch) {
  return {
    id: entry.id,
    name: entry.name,
    shortName: entry.shortName ?? null,
    url: entry.url,
    domain: entry.domain,
    description: entry.description,
    keywords: entry.keywords,
    sourcePaperId: entry.sourcePaperId,
    sourceRank: entry.sourceRank,
    createdAt: entry.createdAt.toISOString(),
    provider: entry.provider
      ? {
          id: entry.provider.id,
          slug: entry.provider.slug,
          name: entry.provider.name,
          domain: entry.provider.domain,
        }
      : null,
    topics: entry.topics.map((topic) => ({
      id: topic.id,
      slug: topic.slug,
      name: topic.name,
      area: topic.area as DatasetAreaKey,
    })),
  };
}

function normalizeTopicSlugs(values: string[] | undefined): string[] {
  if (!values) return [];
  const parsed = datasetTopicSlugsSchema.safeParse(
    values.map((value) => value.trim().toLowerCase()),
  );
  if (!parsed.success) return [];
  return [...new Set(parsed.data.filter((slug) => slug.length > 0))];
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isCanonicalDatasetProvider(provider: DatasetProviderValidationRecord | null | undefined) {
  return Boolean(
    provider?.searchKind &&
      provider.searchEndpoint &&
      provider.searchQueryTemplate &&
      provider.datasetUrlTemplate &&
      provider.agentInstructions,
  );
}

function normalizeUrlForProviderComparison(value: string, providerDomain: string) {
  const parsed = new URL(normalizeDatasetUrl(value));
  parsed.hostname = providerDomain;
  return parsed.toString();
}

function extractProviderDatasetIdentifiers(
  template: string,
  datasetUrl: string,
  providerDomain: string,
) {
  const tokenizedTemplate = template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (_, token) => {
    return `__TOKEN_${token}__`;
  });
  const normalizedTemplate = normalizeUrlForProviderComparison(tokenizedTemplate, providerDomain);
  const normalizedDatasetUrl = normalizeUrlForProviderComparison(datasetUrl, providerDomain);
  const patternSource = escapeRegex(normalizedTemplate).replace(
    /__TOKEN_([A-Za-z0-9_]+)__/g,
    (_, token) => `(?<${token}>.+?)`,
  );
  const match = new RegExp(`^${patternSource}$`, "i").exec(normalizedDatasetUrl);
  if (!match?.groups) {
    return null;
  }

  const identifiers = Object.fromEntries(
    Object.entries(match.groups)
      .map(([key, value]) => [key, decodeURIComponent(value)])
      .filter(([, value]) => typeof value === "string" && value.trim().length > 0),
  );

  return Object.keys(identifiers).length > 0 ? identifiers : null;
}

async function findDatasetProviderBySlug(slug: string) {
  return prisma.datasetProvider.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      domain: true,
      searchKind: true,
      searchEndpoint: true,
      searchQueryTemplate: true,
      datasetUrlTemplate: true,
      agentInstructions: true,
    },
  });
}

async function findDatasetProviderByDomain(domain: string) {
  return prisma.datasetProvider.findUnique({
    where: { domain },
    select: {
      id: true,
      slug: true,
      name: true,
      domain: true,
      searchKind: true,
      searchEndpoint: true,
      searchQueryTemplate: true,
      datasetUrlTemplate: true,
      agentInstructions: true,
    },
  });
}

async function enforceStandaloneDatasetRegistryPolicy(input: {
  candidate: DatasetRegistryCheckResult["candidate"];
}) {
  const { candidate } = input;

  if (!candidate.providerSlug) {
    throw new DatasetRegistryValidationError(
      "Standalone dataset registry adds require --provider-slug and it must reference a canonical provider.",
    );
  }

  const provider = await findDatasetProviderBySlug(candidate.providerSlug);
  if (!provider) {
    throw new DatasetRegistryValidationError(
      `Unknown providerSlug '${candidate.providerSlug}'. Use a canonical dataset provider slug from the provider catalog.`,
    );
  }

  if (!isCanonicalDatasetProvider(provider)) {
    throw new DatasetRegistryValidationError(
      `Provider '${provider.slug}' is not a canonical dataset provider yet, so standalone registry adds are blocked for it.`,
    );
  }

  if (normalizeDatasetDomainFromUrl(candidate.url) !== provider.domain) {
    throw new DatasetRegistryValidationError(
      `Dataset URL domain '${candidate.domain}' does not match the canonical provider domain '${provider.domain}'.`,
    );
  }

  const identifiers = extractProviderDatasetIdentifiers(
    provider.datasetUrlTemplate!,
    candidate.url,
    provider.domain,
  );
  if (!identifiers) {
    throw new DatasetRegistryValidationError(
      `Dataset URL does not match provider '${provider.slug}' URL template '${provider.datasetUrlTemplate}'. Use a canonical dataset page URL, not an ad hoc export or query result.`,
    );
  }

  if (candidate.topicSlugs.length === 0) {
    throw new DatasetRegistryValidationError(
      "Standalone dataset registry adds require at least one explicit --topic-slug.",
    );
  }

  if (candidate.unknownTopicSlugs.length > 0) {
    throw new DatasetRegistryValidationError(
      `Unknown topic slug(s): ${candidate.unknownTopicSlugs.join(", ")}.`,
    );
  }

  const resolvedTopics = await resolveTopicIds(candidate.topicSlugs);
  if (resolvedTopics.ids.length === 0) {
    throw new DatasetRegistryValidationError(
      "Standalone dataset registry adds require at least one valid explicit topic slug.",
    );
  }

  return {
    providerId: provider.id,
    topicConnect: resolvedTopics.ids.map((id) => ({ id })),
    provider,
    identifiers,
  };
}

/**
 * Resolve the provider a dataset should be linked to on create.
 * Priority: explicit providerSlug → provider matching domain → auto-create a
 * stub provider from the domain so the dataset keeps a source anchor even when
 * ops has not yet registered a canonical provider row.
 */
async function resolveProviderIdForCandidate(input: {
  providerSlug: string | null;
  domain: string;
}): Promise<string | null> {
  const normalizedDomain = input.domain.toLowerCase();
  if (input.providerSlug) {
    const bySlug = await findDatasetProviderBySlug(input.providerSlug);
    if (bySlug) return bySlug.id;
  }

  const byDomain = await findDatasetProviderByDomain(normalizedDomain);
  if (byDomain) return byDomain.id;

  if (!normalizedDomain) return null;
  const fallbackSlug = normalizedDomain.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!fallbackSlug) return null;

  const created = await prisma.datasetProvider.create({
    data: {
      slug: fallbackSlug,
      name: normalizedDomain
        .split(".")[0]!
        .replace(/-/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase()),
      homeUrl: `https://${normalizedDomain}`,
      domain: normalizedDomain,
      description: "Auto-linked from a dataset registry submission.",
    },
    select: { id: true },
  });
  return created.id;
}

async function loadRegistryCandidatePool(candidate: DatasetRegistryCandidateInput) {
  const domain = normalizeDatasetDomainFromUrl(candidate.url);
  const name = normalizeWhitespace(candidate.name);

  const [domainMatches, nameMatches] = await Promise.all([
    prisma.datasetEntry.findMany({
      where: { domain },
      select: datasetRegistryMatchSelect,
      orderBy: [{ sourceRank: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    }),
    prisma.datasetEntry.findMany({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
      select: datasetRegistryMatchSelect,
      orderBy: [{ sourceRank: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    }),
  ]);

  const uniqueMatches = new Map<string, DatasetRegistryEntryMatch>();

  for (const match of [...domainMatches, ...nameMatches]) {
    uniqueMatches.set(match.id, match);
  }

  return [...uniqueMatches.values()];
}

export async function checkDatasetRegistryCandidate(
  input: DatasetRegistryCandidateInput,
): Promise<DatasetRegistryCheckResult> {
  const candidate = datasetRegistryCandidateSchema.parse(input);
  const normalizedUrl = normalizeDatasetUrl(candidate.url);
  const normalizedDomain = normalizeDatasetDomainFromUrl(normalizedUrl);
  const normalizedName = normalizeDatasetName(candidate.name);
  const normalizedPathFingerprint = normalizeUrlPathFingerprint(normalizedUrl);
  const keywords = normalizeDatasetKeywords(candidate.keywords);
  const normalizedTopicSlugs = normalizeTopicSlugs(candidate.topicSlugs);
  const { ids: resolvedTopicIds, missing: unknownTopicSlugs } = await resolveTopicIds(
    normalizedTopicSlugs,
  );
  const acceptedTopicSlugs = normalizedTopicSlugs.filter(
    (_, index) => !unknownTopicSlugs.includes(normalizedTopicSlugs[index]!),
  );
  void resolvedTopicIds;
  const pool = await loadRegistryCandidatePool(candidate);

  const exactMatch = pool.find((entry) => {
    try {
      return normalizeDatasetUrl(entry.url) === normalizedUrl;
    } catch {
      return false;
    }
  });

  const normalizedShortName = normalizeDatasetShortName(candidate.shortName);

  const providerSlug = candidate.providerSlug ?? null;

  if (exactMatch) {
    return {
      candidate: {
        name: normalizeWhitespace(candidate.name),
        shortName: normalizedShortName,
        url: normalizedUrl,
        domain: normalizedDomain,
        description: normalizeWhitespace(candidate.description),
        keywords,
        providerSlug,
        topicSlugs: acceptedTopicSlugs,
        unknownTopicSlugs,
        registryEligible: candidate.registryEligible,
      },
      status: "registered",
      matches: [toRegistryMatchSummary(exactMatch)],
    };
  }

  const possibleMatches = pool.filter((entry) => {
    const entryName = normalizeDatasetName(entry.name);
    if (entryName === normalizedName) {
      return true;
    }

    try {
      return normalizeUrlPathFingerprint(entry.url) === normalizedPathFingerprint;
    } catch {
      return false;
    }
  });

  return {
    candidate: {
      name: normalizeWhitespace(candidate.name),
      shortName: normalizedShortName,
      url: normalizedUrl,
      domain: normalizedDomain,
      description: normalizeWhitespace(candidate.description),
      keywords,
      providerSlug,
      topicSlugs: acceptedTopicSlugs,
      unknownTopicSlugs,
      registryEligible: candidate.registryEligible,
    },
    status: possibleMatches.length > 0 ? "possible-duplicate" : "new",
    matches: possibleMatches.slice(0, 5).map(toRegistryMatchSummary),
  };
}

export async function createDatasetRegistryEntry(input: {
  userId: string;
  dataset: DatasetRegistryCandidateInput;
  sourcePaperId?: string | null;
  sourceRank?: number | null;
}) {
  const parsed = datasetRegistryCandidateSchema.parse(input.dataset);
  const checked = await checkDatasetRegistryCandidate(parsed);

  if (checked.status === "registered") {
    const existing = await prisma.datasetEntry.findUniqueOrThrow({
      where: {
        id: checked.matches[0]!.id,
      },
      include: {
        provider: {
          select: { id: true, slug: true, name: true, domain: true },
        },
        topics: {
          where: { status: "ACTIVE" },
          select: { id: true, slug: true, name: true, area: true },
          orderBy: { name: "asc" },
        },
      },
    });

    return {
      created: false,
      duplicateStatus: "registered" as const,
      dataset: existing,
      check: checked,
    };
  }

  const isStandaloneAdd = !input.sourcePaperId;

  let providerId: string | null;
  let topicConnect: Array<{ id: string }> = [];

  if (isStandaloneAdd) {
    const standalonePolicy = await enforceStandaloneDatasetRegistryPolicy({
      candidate: checked.candidate,
    });
    providerId = standalonePolicy.providerId;
    topicConnect = standalonePolicy.topicConnect;
  } else {
    providerId = await resolveProviderIdForCandidate({
      providerSlug: checked.candidate.providerSlug,
      domain: checked.candidate.domain,
    });

    // Resolve topics: explicit slugs take precedence. Otherwise classify from
    // the dataset metadata (name/description/keywords plus source-paper context)
    // and only fall back to provider topics when they are the best signal.
    if (checked.candidate.topicSlugs.length > 0) {
      const resolved = await resolveTopicIds(checked.candidate.topicSlugs);
      topicConnect = resolved.ids.map((id) => ({ id }));
    } else {
      const inferredTopicIds = await inferDatasetTopicIdsForCandidate({
        name: checked.candidate.name,
        shortName: checked.candidate.shortName,
        description: checked.candidate.description,
        keywords: checked.candidate.keywords,
        domain: checked.candidate.domain,
        providerId,
        sourcePaperId: input.sourcePaperId ?? null,
      });
      topicConnect = inferredTopicIds.map((id) => ({ id }));
    }
  }

  const created = await prisma.datasetEntry.create({
    data: {
      name: checked.candidate.name,
      shortName: checked.candidate.shortName,
      url: checked.candidate.url,
      domain: checked.candidate.domain,
      description: checked.candidate.description,
      keywords: checked.candidate.keywords,
      sourcePaperId: input.sourcePaperId ?? null,
      sourceRank: input.sourceRank ?? null,
      addedBy: input.userId,
      providerId,
      topics: topicConnect.length > 0 ? { connect: topicConnect } : undefined,
    },
    include: {
      provider: {
        select: { id: true, slug: true, name: true, domain: true },
      },
      topics: {
        where: { status: "ACTIVE" },
        select: { id: true, slug: true, name: true, area: true },
        orderBy: { name: "asc" },
      },
    },
  });

  return {
    created: true,
    duplicateStatus: checked.status,
    dataset: created,
    check: checked,
  };
}
