import { NextResponse } from "next/server";

import { getDatasetProviders } from "@/lib/datasets";
import { parsePositiveInt } from "@/lib/public-api";
import { DATASET_AREA_KEYS, type DatasetAreaKey } from "@/lib/topics";

export const dynamic = "force-dynamic";

function isDatasetAreaKey(value: string): value is DatasetAreaKey {
  return (DATASET_AREA_KEYS as readonly string[]).includes(value);
}

/**
 * GET /api/v1/registry/providers?q=<query>&limit=<n>&area=<AREA>&topic=<slug>
 *
 * List dataset providers (OpenNeuro, HuggingFace, Kaggle, ...) with the agent-facing
 * search recipe (searchKind, searchEndpoint, searchQueryTemplate, datasetUrlTemplate,
 * agentInstructions). Public, no auth required. Supports taxonomy filters:
 * `area` (closed enum) and `topic` slug (open vocabulary).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = parsePositiveInt(url.searchParams.get("limit"), 100, 200);
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

  const providers = (
    await getDatasetProviders({
      query,
      limit,
      area: rawArea ? (rawArea as DatasetAreaKey) : undefined,
      topicSlug: rawTopic ?? undefined,
    })
  ).map((provider) => ({
    ...provider,
    createdAt: provider.createdAt.toISOString(),
  }));

  return NextResponse.json({ providers });
}
