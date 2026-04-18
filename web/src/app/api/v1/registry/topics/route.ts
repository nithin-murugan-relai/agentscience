import { NextResponse } from "next/server";

import {
  DATASET_AREA_KEYS,
  getDatasetAreaMeta,
  getDatasetTopics,
  type DatasetAreaKey,
} from "@/lib/topics";
import { parsePositiveInt } from "@/lib/public-api";

export const dynamic = "force-dynamic";

function isDatasetAreaKey(value: string): value is DatasetAreaKey {
  return (DATASET_AREA_KEYS as readonly string[]).includes(value);
}

/**
 * GET /api/v1/registry/topics?area=<AREA>&q=<query>&limit=<n>&includePending=<bool>
 *
 * Returns the registry taxonomy: the closed set of Areas plus the topics
 * that live under each area. Agents use this to classify datasets before
 * registering them. Only ACTIVE topics are returned by default — pass
 * includePending=true to surface proposals awaiting admin review.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawArea = url.searchParams.get("area");
  const query = url.searchParams.get("q") ?? "";
  const limit = parsePositiveInt(url.searchParams.get("limit"), 200, 500);
  const includePending = url.searchParams.get("includePending") === "true";

  if (rawArea && !isDatasetAreaKey(rawArea)) {
    return NextResponse.json(
      {
        error: `Unknown area '${rawArea}'. Valid areas: ${DATASET_AREA_KEYS.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const topics = (
    await getDatasetTopics({
      area: rawArea ? (rawArea as DatasetAreaKey) : undefined,
      query,
      limit,
      includePending,
    })
  ).map((topic) => ({
    id: topic.id,
    slug: topic.slug,
    name: topic.name,
    area: topic.area,
    description: topic.description,
    agentInstructions: topic.agentInstructions,
    status: topic.status,
    providerCount: topic.providerCount,
    datasetCount: topic.datasetCount,
    createdAt: topic.createdAt.toISOString(),
  }));

  return NextResponse.json({
    areas: getDatasetAreaMeta(),
    topics,
  });
}
