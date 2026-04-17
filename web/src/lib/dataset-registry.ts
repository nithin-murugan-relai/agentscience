import type { DatasetEntry } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const datasetRegistryMatchSelect = {
  id: true,
  name: true,
  url: true,
  domain: true,
  description: true,
  keywords: true,
  sourcePaperId: true,
  sourceRank: true,
  createdAt: true,
} satisfies Record<string, true>;

export const datasetRegistryCandidateSchema = z.object({
  name: z.string().trim().min(2).max(160),
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
  registryEligible: z.boolean().optional().default(true),
});

export const datasetRegistryCheckRequestSchema = z.object({
  datasets: z.array(datasetRegistryCandidateSchema).min(1).max(20),
});

export type DatasetRegistryCandidateInput = z.infer<typeof datasetRegistryCandidateSchema>;
export type DatasetRegistryCheckRequest = z.infer<typeof datasetRegistryCheckRequestSchema>;

type DatasetRegistryEntryMatch = Pick<
  DatasetEntry,
  "id" | "name" | "url" | "domain" | "description" | "keywords" | "sourcePaperId" | "sourceRank" | "createdAt"
>;

export type DatasetRegistryCheckStatus = "registered" | "possible-duplicate" | "new";

export type DatasetRegistryCheckResult = {
  candidate: {
    name: string;
    url: string;
    domain: string;
    description: string;
    keywords: string[];
    registryEligible: boolean;
  };
  status: DatasetRegistryCheckStatus;
  matches: Array<{
    id: string;
    name: string;
    url: string;
    domain: string;
    description: string;
    keywords: string[];
    sourcePaperId: string | null;
    sourceRank: number | null;
    createdAt: string;
  }>;
};

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeDatasetName(value: string) {
  return normalizeWhitespace(value).toLowerCase();
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
    url: entry.url,
    domain: entry.domain,
    description: entry.description,
    keywords: entry.keywords,
    sourcePaperId: entry.sourcePaperId,
    sourceRank: entry.sourceRank,
    createdAt: entry.createdAt.toISOString(),
  };
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
  const pool = await loadRegistryCandidatePool(candidate);

  const exactMatch = pool.find((entry) => {
    try {
      return normalizeDatasetUrl(entry.url) === normalizedUrl;
    } catch {
      return false;
    }
  });

  if (exactMatch) {
    return {
      candidate: {
        name: normalizeWhitespace(candidate.name),
        url: normalizedUrl,
        domain: normalizedDomain,
        description: normalizeWhitespace(candidate.description),
        keywords,
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
      url: normalizedUrl,
      domain: normalizedDomain,
      description: normalizeWhitespace(candidate.description),
      keywords,
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
    });

    return {
      created: false,
      duplicateStatus: "registered" as const,
      dataset: existing,
      check: checked,
    };
  }

  const created = await prisma.datasetEntry.create({
    data: {
      name: checked.candidate.name,
      url: checked.candidate.url,
      domain: checked.candidate.domain,
      description: checked.candidate.description,
      keywords: checked.candidate.keywords,
      sourcePaperId: input.sourcePaperId ?? null,
      sourceRank: input.sourceRank ?? null,
      addedBy: input.userId,
    },
  });

  return {
    created: true,
    duplicateStatus: checked.status,
    dataset: created,
    check: checked,
  };
}
