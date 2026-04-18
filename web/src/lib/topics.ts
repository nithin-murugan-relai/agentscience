import type { DatasetArea, DatasetTopicStatus, Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const MAX_TOPIC_SUGGESTION_NAME = 80;
const MAX_TOPIC_SUGGESTION_DESCRIPTION = 1000;
const MAX_TOPIC_SUGGESTION_JUSTIFICATION = 2000;

/**
 * The nine canonical research areas. Closed vocabulary — agents cannot invent
 * new ones. This stable top-level keeps the UI nav from rotting.
 *
 * The display names mirror how universities and major journals self-organize.
 */
export const DATASET_AREA_KEYS = [
  "LIFE_SCIENCES",
  "MEDICINE_HEALTH",
  "SOCIAL_SCIENCES",
  "PHYSICAL_SCIENCES",
  "EARTH_ENVIRONMENT",
  "COMPUTING_ENGINEERING",
  "MATH_STATISTICS",
  "HUMANITIES",
  "OTHER",
] as const satisfies readonly DatasetArea[];

export type DatasetAreaKey = (typeof DATASET_AREA_KEYS)[number];

export interface DatasetAreaMeta {
  key: DatasetAreaKey;
  name: string;
  description: string;
}

export const DATASET_AREA_META: Record<DatasetAreaKey, DatasetAreaMeta> = {
  LIFE_SCIENCES: {
    key: "LIFE_SCIENCES",
    name: "Life Sciences",
    description:
      "Biology, genomics, neuroscience, ecology, and other living-systems research.",
  },
  MEDICINE_HEALTH: {
    key: "MEDICINE_HEALTH",
    name: "Medicine & Health",
    description:
      "Clinical research, epidemiology, imaging, pharmacology, and health-system data.",
  },
  SOCIAL_SCIENCES: {
    key: "SOCIAL_SCIENCES",
    name: "Social Sciences",
    description:
      "Psychology, economics, sociology, political science, and related fields.",
  },
  PHYSICAL_SCIENCES: {
    key: "PHYSICAL_SCIENCES",
    name: "Physical Sciences",
    description: "Physics, chemistry, astronomy, materials, and particle physics.",
  },
  EARTH_ENVIRONMENT: {
    key: "EARTH_ENVIRONMENT",
    name: "Earth & Environment",
    description:
      "Climate, oceanography, geology, atmospheric science, and remote sensing.",
  },
  COMPUTING_ENGINEERING: {
    key: "COMPUTING_ENGINEERING",
    name: "Computing & Engineering",
    description:
      "Machine learning, vision, NLP, robotics, software, and cybersecurity.",
  },
  MATH_STATISTICS: {
    key: "MATH_STATISTICS",
    name: "Mathematics & Statistics",
    description: "Statistics, probability, and numerical-methods benchmarks.",
  },
  HUMANITIES: {
    key: "HUMANITIES",
    name: "Humanities",
    description:
      "Linguistic, historical, literary, and digital-humanities datasets.",
  },
  OTHER: {
    key: "OTHER",
    name: "Other",
    description:
      "Interdisciplinary, meta-research, benchmarks, and datasets that span areas.",
  },
};

export function getDatasetAreaMeta(): DatasetAreaMeta[] {
  return DATASET_AREA_KEYS.map((key) => DATASET_AREA_META[key]);
}

export const datasetAreaSchema = z.enum(DATASET_AREA_KEYS);

export const datasetTopicSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    "topic slug must be lowercase letters, digits, or internal hyphens.",
  );

export const datasetTopicSlugsSchema = z
  .array(datasetTopicSlugSchema)
  .max(12)
  .default([]);

export const datasetTopicSuggestionSchema = z.object({
  name: z.string().trim().min(2).max(MAX_TOPIC_SUGGESTION_NAME),
  area: datasetAreaSchema,
  description: z
    .string()
    .trim()
    .max(MAX_TOPIC_SUGGESTION_DESCRIPTION)
    .optional()
    .nullable(),
  justification: z
    .string()
    .trim()
    .max(MAX_TOPIC_SUGGESTION_JUSTIFICATION)
    .optional()
    .nullable(),
});

export type DatasetTopicSuggestionInput = z.infer<
  typeof datasetTopicSuggestionSchema
>;

export interface DatasetTopicSummary {
  id: string;
  slug: string;
  name: string;
  area: DatasetAreaKey;
}

export interface DatasetTopicListItem {
  id: string;
  slug: string;
  name: string;
  area: DatasetAreaKey;
  description: string | null;
  agentInstructions: string | null;
  status: DatasetTopicStatus;
  createdAt: Date;
  providerCount: number;
  datasetCount: number;
}

export function slugifyTopicName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Return an alphabetized list of topics, optionally scoped to an area, optionally
 * filtered by a free-text query, with provider + dataset counts so callers can
 * render "N providers" on each topic chip.
 *
 * PENDING topics are excluded by default — they live in an admin review queue
 * until promoted. Pass `includePending: true` to surface them.
 */
export async function getDatasetTopics(options?: {
  area?: DatasetAreaKey;
  query?: string;
  includePending?: boolean;
  limit?: number;
}): Promise<DatasetTopicListItem[]> {
  const where: Prisma.DatasetTopicWhereInput = {};
  if (options?.area) {
    where.area = options.area;
  }
  if (!options?.includePending) {
    where.status = "ACTIVE";
  }
  const query = options?.query?.trim();
  if (query && query.length > 0) {
    where.OR = [
      { slug: { contains: query, mode: "insensitive" } },
      { name: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
    ];
  }

  const take = Math.min(Math.max(1, options?.limit ?? 200), 500);

  const topics = await prisma.datasetTopic.findMany({
    where,
    orderBy: [{ area: "asc" }, { name: "asc" }],
    take,
    include: {
      _count: {
        select: { providers: true, datasets: true },
      },
    },
  });

  return topics.map((topic) => ({
    id: topic.id,
    slug: topic.slug,
    name: topic.name,
    area: topic.area,
    description: topic.description,
    agentInstructions: topic.agentInstructions,
    status: topic.status,
    createdAt: topic.createdAt,
    providerCount: topic._count.providers,
    datasetCount: topic._count.datasets,
  }));
}

/**
 * Resolve topic slugs to topic IDs. Unknown slugs are rejected (agents must
 * register new ones via the suggestion endpoint first). Only ACTIVE topics
 * are resolved by default — this prevents a pending topic from auto-tagging
 * datasets while it's still under review.
 */
export async function resolveTopicIds(
  slugs: string[],
  options?: { includePending?: boolean },
): Promise<{
  ids: string[];
  missing: string[];
}> {
  const normalized = [...new Set(slugs.map((slug) => slug.trim().toLowerCase()))].filter(
    (slug) => slug.length > 0,
  );
  if (normalized.length === 0) {
    return { ids: [], missing: [] };
  }

  const statusFilter: DatasetTopicStatus[] = options?.includePending
    ? ["ACTIVE", "PENDING"]
    : ["ACTIVE"];

  const topics = await prisma.datasetTopic.findMany({
    where: {
      slug: { in: normalized },
      status: { in: statusFilter },
    },
    select: { id: true, slug: true },
  });

  const bySlug = new Map(topics.map((topic) => [topic.slug, topic.id]));
  const ids = normalized.flatMap((slug) => {
    const id = bySlug.get(slug);
    return id ? [id] : [];
  });
  const missing = normalized.filter((slug) => !bySlug.has(slug));

  return { ids, missing };
}

/**
 * Create a PENDING topic suggestion. Agents and users can call this when they
 * want to register a dataset under a topic that doesn't exist yet. Admins
 * later promote PENDING → ACTIVE (or delete). If a topic with the same
 * generated slug already exists, the existing row is returned unchanged.
 */
export async function createDatasetTopicSuggestion(
  input: DatasetTopicSuggestionInput,
): Promise<{ topic: DatasetTopicListItem; alreadyExisted: boolean }> {
  const parsed = datasetTopicSuggestionSchema.parse(input);
  const slug = slugifyTopicName(parsed.name);
  if (slug.length < 2) {
    throw new Error("topic name must produce a valid slug (>=2 chars after normalization).");
  }

  const existing = await prisma.datasetTopic.findUnique({
    where: { slug },
    include: {
      _count: {
        select: { providers: true, datasets: true },
      },
    },
  });

  if (existing) {
    return {
      alreadyExisted: true,
      topic: {
        id: existing.id,
        slug: existing.slug,
        name: existing.name,
        area: existing.area,
        description: existing.description,
        agentInstructions: existing.agentInstructions,
        status: existing.status,
        createdAt: existing.createdAt,
        providerCount: existing._count.providers,
        datasetCount: existing._count.datasets,
      },
    };
  }

  const created = await prisma.datasetTopic.create({
    data: {
      slug,
      name: parsed.name,
      area: parsed.area,
      description: parsed.description ?? null,
      agentInstructions: parsed.justification ?? null,
      status: "PENDING",
    },
    include: {
      _count: {
        select: { providers: true, datasets: true },
      },
    },
  });

  return {
    alreadyExisted: false,
    topic: {
      id: created.id,
      slug: created.slug,
      name: created.name,
      area: created.area,
      description: created.description,
      agentInstructions: created.agentInstructions,
      status: created.status,
      createdAt: created.createdAt,
      providerCount: created._count.providers,
      datasetCount: created._count.datasets,
    },
  };
}
