import { NextResponse } from "next/server";

import { getDatasetProviders } from "@/lib/datasets";
import { parsePositiveInt } from "@/lib/public-api";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/registry/providers?q=<query>&limit=<n>
 *
 * List dataset providers (OpenNeuro, HuggingFace, Kaggle, ...) with the agent-facing
 * search recipe (searchKind, searchEndpoint, searchQueryTemplate, datasetUrlTemplate,
 * agentInstructions). Public, no auth required. This is the "how to search inside
 * a compendium" half of the registry; specific datasets remain at /api/v1/registry.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = parsePositiveInt(url.searchParams.get("limit"), 100, 200);
  const providers = (await getDatasetProviders({ query, limit })).map((provider) => ({
    ...provider,
    createdAt: provider.createdAt.toISOString(),
  }));

  return NextResponse.json({ providers });
}
