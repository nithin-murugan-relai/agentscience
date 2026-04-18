import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiUser, unauthorizedJson } from "@/lib/api-auth";
import { getDatasetRegistry } from "@/lib/datasets";
import {
  createDatasetRegistryEntry,
  datasetRegistryCandidateSchema,
} from "@/lib/dataset-registry";
import { parsePositiveInt } from "@/lib/public-api";
import { DATASET_AREA_KEYS, type DatasetAreaKey } from "@/lib/topics";

export const dynamic = "force-dynamic";

const registryDatasetInputSchema = datasetRegistryCandidateSchema.extend({
  sourcePaperId: z.string().trim().min(1).max(64).optional().nullable(),
  sourceRank: z.coerce.number().finite().optional().nullable(),
});

function isDatasetAreaKey(value: string): value is DatasetAreaKey {
  return (DATASET_AREA_KEYS as readonly string[]).includes(value);
}

/**
 * GET /api/v1/registry?q=<query>&limit=<n>&area=<AREA>&topic=<slug>
 *
 * Search the dataset registry. Public, no auth required. Supports filtering
 * by taxonomy: `area` (closed enum) and `topic` slug (open vocabulary).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = parsePositiveInt(url.searchParams.get("limit"), 20, 500);
  const rawArea = url.searchParams.get("area");
  const rawTopic = url.searchParams.get("topic");

  if (rawArea && !isDatasetAreaKey(rawArea)) {
    return NextResponse.json(
      {
        error: `Unknown area '${rawArea}'. Valid areas: ${DATASET_AREA_KEYS.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const datasets = (
    await getDatasetRegistry({
      query,
      limit,
      area: rawArea ? (rawArea as DatasetAreaKey) : undefined,
      topicSlug: rawTopic ?? undefined,
    })
  ).map((dataset) => ({
    ...dataset,
    sourcePaper: dataset.sourcePaper
      ? {
          ...dataset.sourcePaper,
          url: new URL(dataset.sourcePaper.url, url).toString(),
        }
      : null,
  }));

  return NextResponse.json({ datasets });
}

/**
 * POST /api/v1/registry
 *
 * Add a dataset to the registry. Requires auth.
 *
 * Body: { name, shortName?, url, description, keywords?, providerSlug?,
 *         topicSlugs?, sourcePaperId?, sourceRank? }
 *
 * If providerSlug is omitted, the dataset auto-links to the provider matching
 * its URL domain (creating a stub provider row if none exists).
 *
 * If topicSlugs is omitted, the dataset inherits its provider's ACTIVE topics.
 * Unknown topic slugs are dropped (not auto-created) — agents must propose new
 * topics via POST /api/v1/registry/topics/suggestions first. The response's
 * `check.candidate.unknownTopicSlugs` surfaces any dropped slugs so callers
 * can react.
 */
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return unauthorizedJson();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = registryDatasetInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid dataset registry payload." },
      { status: 400 }
    );
  }

  const result = await createDatasetRegistryEntry({
    userId: user.id,
    dataset: parsed.data,
    sourcePaperId: parsed.data.sourcePaperId ?? null,
    sourceRank: parsed.data.sourceRank ?? null,
  });

  return NextResponse.json(
    {
      dataset: result.dataset,
      created: result.created,
      duplicateStatus: result.duplicateStatus,
      check: result.check,
    },
    { status: result.created ? 201 : 200 },
  );
}
